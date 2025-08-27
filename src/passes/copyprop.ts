/**
 * @fileoverview Copy propagation pass
 * 
 * This module implements copy propagation to replace variables with their
 * copied values (x = y; use of x becomes use of y) to simplify the IR.
 */

import type {
  IRNode,
  IRExpression,
  IRStatement,
  IRIdentifier,
  IRVariableDeclaration,
  IRAssignmentExpression,
  IRBlockStatement,
  IRBinaryExpression,
  IRUnaryExpression,
  IRCallExpression,
  IRMemberExpression,
  VariableName,
  NodeId
} from '../ir/nodes.js';
import { IRNodeFactory } from '../ir/nodes.js';
import { BasePass, type IRState, PassUtils } from './Pass.js';
import type { CFGNode } from '../ir/cfg.js';

/**
 * Copy information for a variable
 */
export interface CopyInfo {
  readonly from: VariableName;
  readonly to: VariableName;
  readonly copy_site: NodeId;
  readonly confidence: number; // 0-1, how sure we are this is a pure copy
}

/**
 * Available copies at a program point
 */
export interface CopyState {
  readonly available_copies: ReadonlyMap<VariableName, CopyInfo>;
  readonly killed_copies: ReadonlySet<VariableName>;
}

/**
 * Copy propagation pass
 */
export class CopyPropagationPass extends BasePass<IRState> {
  readonly name = 'copy-propagation';
  readonly description = 'Propagate variable copies to eliminate redundant assignments';

  private availableCopies = new Map<NodeId, Map<VariableName, CopyInfo>>();
  private copyDefinitions = new Map<NodeId, CopyInfo[]>();
  private copyKills = new Map<NodeId, Set<VariableName>>();

  protected executePass(state: IRState): { state: IRState; changed: boolean } {
    this.availableCopies.clear();
    this.copyDefinitions.clear();
    this.copyKills.clear();

    // Step 1: Identify copy statements
    this.identifyCopyStatements(state);

    // Step 2: Perform dataflow analysis to find available copies
    this.performCopyAnalysis(state);

    // Step 3: Propagate copies
    const { newNodes, changed } = this.propagateCopies(state);

    if (changed) {
      const newState = PassUtils.updateNodes(state, newNodes);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Identify statements that define copies (x = y)
   */
  private identifyCopyStatements(state: IRState): void {
    for (const [nodeId, node] of state.nodes) {
      this.visitNode();
      
      const copies = this.findCopiesInNode(node);
      if (copies.length > 0) {
        this.copyDefinitions.set(nodeId, copies);
      }

      const kills = this.findKillsInNode(node);
      if (kills.size > 0) {
        this.copyKills.set(nodeId, kills);
      }
    }
  }

  /**
   * Find copy assignments in a node
   */
  private findCopiesInNode(node: IRNode): CopyInfo[] {
    const copies: CopyInfo[] = [];

    switch (node.type) {
      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier' && 
              decl.init?.type === 'Identifier') {
            const copy: CopyInfo = {
              from: IRNodeFactory.createVariableName(decl.init.name),
              to: IRNodeFactory.createVariableName(decl.id.name),
              copy_site: node.node_id || IRNodeFactory.createNodeId(),
              confidence: this.calculateCopyConfidence(decl.init, node)
            };
            copies.push(copy);
          }
        }
        break;

      case 'AssignmentExpression':
        if (node.left.type === 'Identifier' && 
            node.right.type === 'Identifier' &&
            node.operator === '=') {
          const copy: CopyInfo = {
            from: IRNodeFactory.createVariableName(node.right.name),
            to: IRNodeFactory.createVariableName(node.left.name),
            copy_site: node.node_id || IRNodeFactory.createNodeId(),
            confidence: this.calculateCopyConfidence(node.right, node)
          };
          copies.push(copy);
        }
        break;

      case 'ExpressionStatement':
        if (node.expression.type === 'AssignmentExpression') {
          return this.findCopiesInNode(node.expression);
        }
        break;

      case 'BlockStatement':
        for (const stmt of node.body) {
          copies.push(...this.findCopiesInNode(stmt));
        }
        break;
    }

    return copies;
  }

  /**
   * Find variables killed (redefined) in a node
   */
  private findKillsInNode(node: IRNode): Set<VariableName> {
    const kills = new Set<VariableName>();

    switch (node.type) {
      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier') {
            kills.add(IRNodeFactory.createVariableName(decl.id.name));
          }
        }
        break;

      case 'AssignmentExpression':
        if (node.left.type === 'Identifier') {
          kills.add(IRNodeFactory.createVariableName(node.left.name));
        }
        break;

      case 'UpdateExpression':
        if (node.argument.type === 'Identifier') {
          kills.add(IRNodeFactory.createVariableName(node.argument.name));
        }
        break;

      case 'ExpressionStatement':
        return this.findKillsInNode(node.expression);

      case 'BlockStatement':
        for (const stmt of node.body) {
          const stmtKills = this.findKillsInNode(stmt);
          for (const kill of stmtKills) {
            kills.add(kill);
          }
        }
        break;

      // Function calls might modify variables (conservative)
      case 'CallExpression':
        // Could kill any variable (conservative analysis)
        break;
    }

    return kills;
  }

  /**
   * Calculate confidence that this is a pure copy
   */
  private calculateCopyConfidence(sourceExpr: IRExpression, context: IRNode): number {
    // Simple heuristic - could be made more sophisticated
    if (sourceExpr.type === 'Identifier') {
      // Direct identifier copy has high confidence
      return 0.9;
    }

    // Other expressions have lower confidence
    return 0.5;
  }

  /**
   * Perform dataflow analysis to compute available copies
   */
  private performCopyAnalysis(state: IRState): void {
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    // Initialize available copies
    for (const nodeId of state.nodes.keys()) {
      this.availableCopies.set(nodeId, new Map());
    }

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      // Process CFG nodes in forward order
      const processedNodes = new Set<NodeId>();
      
      for (const cfgNode of state.cfg.nodes.values()) {
        if (processedNodes.has(cfgNode.id)) continue;
        processedNodes.add(cfgNode.id);

        const oldCopies = new Map(this.availableCopies.get(cfgNode.id));
        const newCopies = this.computeAvailableCopies(cfgNode, state);
        
        if (!this.copyMapsEqual(oldCopies, newCopies)) {
          this.availableCopies.set(cfgNode.id, newCopies);
          changed = true;
        }
      }
    }

    if (iterations >= maxIterations) {
      this.warn('Copy propagation analysis did not converge within maximum iterations');
    }
  }

  /**
   * Compute available copies for a CFG node
   */
  private computeAvailableCopies(
    cfgNode: CFGNode,
    state: IRState
  ): Map<VariableName, CopyInfo> {
    // Start with intersection of predecessor copies
    let availableCopies = this.computeCopiesIn(cfgNode);

    // Process instructions in this basic block
    for (const stmt of cfgNode.instructions) {
      if (!stmt.node_id) continue;

      // Add new copies generated by this statement
      const newCopies = this.copyDefinitions.get(stmt.node_id) || [];
      for (const copy of newCopies) {
        if (copy.confidence >= 0.8) { // Only propagate high-confidence copies
          availableCopies.set(copy.to, copy);
        }
      }

      // Remove killed copies
      const kills = this.copyKills.get(stmt.node_id) || new Set();
      for (const killedVar of kills) {
        availableCopies.delete(killedVar);
        
        // Also remove copies where this variable is the source
        for (const [copyTo, copyInfo] of availableCopies) {
          if (copyInfo.from === killedVar) {
            availableCopies.delete(copyTo);
          }
        }
      }
    }

    return availableCopies;
  }

  /**
   * Compute copies available at the entry of a CFG node
   */
  private computeCopiesIn(cfgNode: CFGNode): Map<VariableName, CopyInfo> {
    const copiesIn = new Map<VariableName, CopyInfo>();

    if (cfgNode.predecessors.length === 0) {
      // Entry node - no copies available
      return copiesIn;
    }

    // Intersection of all predecessors' available copies
    let firstPred = true;
    for (const pred of cfgNode.predecessors) {
      const predCopies = this.availableCopies.get(pred.id) || new Map();
      
      if (firstPred) {
        // Initialize with first predecessor
        for (const [var_, copy] of predCopies) {
          copiesIn.set(var_, copy);
        }
        firstPred = false;
      } else {
        // Intersect with remaining predecessors
        const toRemove: VariableName[] = [];
        
        for (const [var_, copy] of copiesIn) {
          const predCopy = predCopies.get(var_);
          if (!predCopy || !this.copiesEqual(copy, predCopy)) {
            toRemove.push(var_);
          }
        }
        
        for (const var_ of toRemove) {
          copiesIn.delete(var_);
        }
      }
    }

    return copiesIn;
  }

  /**
   * Propagate copies in the IR
   */
  private propagateCopies(state: IRState): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    const newNodes = new Map<NodeId, IRNode>();
    let changed = false;

    for (const [nodeId, node] of state.nodes) {
      const availableCopies = this.getAvailableCopiesForNode(nodeId, state);
      const transformedNode = this.transformNode(node, availableCopies);
      
      if (transformedNode !== node) {
        newNodes.set(nodeId, transformedNode);
        changed = true;
        this.changeNode();
      }
    }

    return { newNodes, changed };
  }

  /**
   * Get available copies for a specific node
   */
  private getAvailableCopiesForNode(
    nodeId: NodeId,
    state: IRState
  ): Map<VariableName, CopyInfo> {
    // Find the CFG node containing this instruction
    for (const cfgNode of state.cfg.nodes.values()) {
      if (cfgNode.instructions.some(stmt => stmt.node_id === nodeId)) {
        return this.availableCopies.get(cfgNode.id) || new Map();
      }
    }
    
    return new Map();
  }

  /**
   * Transform a node by propagating available copies
   */
  private transformNode(
    node: IRNode,
    availableCopies: Map<VariableName, CopyInfo>
  ): IRNode {
    switch (node.type) {
      case 'Identifier':
        return this.transformIdentifier(node, availableCopies);
      
      case 'BinaryExpression':
        return this.transformBinaryExpression(node, availableCopies);
      
      case 'UnaryExpression':
        return this.transformUnaryExpression(node, availableCopies);
      
      case 'CallExpression':
        return this.transformCallExpression(node, availableCopies);
      
      case 'MemberExpression':
        return this.transformMemberExpression(node, availableCopies);
      
      case 'AssignmentExpression':
        return this.transformAssignmentExpression(node, availableCopies);
      
      case 'VariableDeclaration':
        return this.transformVariableDeclaration(node, availableCopies);
      
      case 'BlockStatement':
        return this.transformBlockStatement(node, availableCopies);
      
      case 'ExpressionStatement':
        return {
          ...node,
          expression: this.transformNode(node.expression, availableCopies) as IRExpression
        };
      
      default:
        return node;
    }
  }

  /**
   * Transform identifier by replacing with copy source
   */
  private transformIdentifier(
    node: IRIdentifier,
    availableCopies: Map<VariableName, CopyInfo>
  ): IRNode {
    const varName = IRNodeFactory.createVariableName(node.name);
    const copyInfo = availableCopies.get(varName);
    
    if (copyInfo && copyInfo.confidence >= 0.8) {
      // Replace with copy source
      return IRNodeFactory.identifier(copyInfo.from, {
        node_id: node.node_id,
        loc: node.loc
      });
    }
    
    return node;
  }

  /**
   * Transform binary expression
   */
  private transformBinaryExpression(
    node: IRBinaryExpression,
    availableCopies: Map<VariableName, CopyInfo>
  ): IRNode {
    const left = this.transformNode(node.left, availableCopies) as IRExpression;
    const right = this.transformNode(node.right, availableCopies) as IRExpression;
    
    if (left !== node.left || right !== node.right) {
      return {
        ...node,
        left,
        right
      };
    }
    
    return node;
  }

  /**
   * Transform unary expression
   */
  private transformUnaryExpression(
    node: IRUnaryExpression,
    availableCopies: Map<VariableName, CopyInfo>
  ): IRNode {
    const argument = this.transformNode(node.argument, availableCopies) as IRExpression;
    
    if (argument !== node.argument) {
      return {
        ...node,
        argument
      };
    }
    
    return node;
  }

  /**
   * Transform call expression
   */
  private transformCallExpression(
    node: IRCallExpression,
    availableCopies: Map<VariableName, CopyInfo>
  ): IRNode {
    const callee = this.transformNode(node.callee, availableCopies) as IRExpression;
    const args = node.arguments.map(arg => 
      this.transformNode(arg, availableCopies) as IRExpression
    );
    
    const calleeChanged = callee !== node.callee;
    const argsChanged = args.some((arg, index) => arg !== node.arguments[index]);
    
    if (calleeChanged || argsChanged) {
      return {
        ...node,
        callee,
        arguments: args
      };
    }
    
    return node;
  }

  /**
   * Transform member expression
   */
  private transformMemberExpression(
    node: IRMemberExpression,
    availableCopies: Map<VariableName, CopyInfo>
  ): IRNode {
    const object = this.transformNode(node.object, availableCopies) as IRExpression;
    const property = node.computed ? 
      this.transformNode(node.property, availableCopies) as IRExpression :
      node.property;
    
    if (object !== node.object || property !== node.property) {
      return {
        ...node,
        object,
        property
      };
    }
    
    return node;
  }

  /**
   * Transform assignment expression
   */
  private transformAssignmentExpression(
    node: IRAssignmentExpression,
    availableCopies: Map<VariableName, CopyInfo>
  ): IRNode {
    // Only transform right side - left side is a definition
    const right = this.transformNode(node.right, availableCopies) as IRExpression;
    
    if (right !== node.right) {
      return {
        ...node,
        right
      };
    }
    
    return node;
  }

  /**
   * Transform variable declaration
   */
  private transformVariableDeclaration(
    node: IRVariableDeclaration,
    availableCopies: Map<VariableName, CopyInfo>
  ): IRNode {
    const newDeclarations = node.declarations.map(decl => ({
      ...decl,
      init: decl.init ? 
        this.transformNode(decl.init, availableCopies) as IRExpression : 
        null
    }));
    
    const changed = newDeclarations.some((decl, index) => 
      decl.init !== node.declarations[index]!.init
    );
    
    if (changed) {
      return {
        ...node,
        declarations: newDeclarations
      };
    }
    
    return node;
  }

  /**
   * Transform block statement
   */
  private transformBlockStatement(
    node: IRBlockStatement,
    availableCopies: Map<VariableName, CopyInfo>
  ): IRNode {
    const newBody = node.body.map(stmt => 
      this.transformNode(stmt, availableCopies) as IRStatement
    );
    
    const changed = newBody.some((stmt, index) => stmt !== node.body[index]);
    
    if (changed) {
      return {
        ...node,
        body: newBody
      };
    }
    
    return node;
  }

  /**
   * Check if two copy info objects are equal
   */
  private copiesEqual(copy1: CopyInfo, copy2: CopyInfo): boolean {
    return copy1.from === copy2.from &&
           copy1.to === copy2.to &&
           copy1.copy_site === copy2.copy_site;
  }

  /**
   * Check if two copy maps are equal
   */
  private copyMapsEqual(
    map1: Map<VariableName, CopyInfo>,
    map2: Map<VariableName, CopyInfo>
  ): boolean {
    if (map1.size !== map2.size) return false;
    
    for (const [var_, copy1] of map1) {
      const copy2 = map2.get(var_);
      if (!copy2 || !this.copiesEqual(copy1, copy2)) {
        return false;
      }
    }
    
    return true;
  }
}