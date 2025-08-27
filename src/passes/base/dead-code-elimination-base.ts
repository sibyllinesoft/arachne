/**
 * @fileoverview Base class for dead code elimination passes
 * 
 * This module provides common functionality shared between the basic and enhanced
 * dead code elimination passes, reducing code duplication and improving maintainability.
 */

import { BasePass, PassUtils } from '../Pass.js';
import type { 
  IRNode, 
  IRExpression, 
  IRStatement, 
  IRIdentifier,
  IRVariableDeclaration,
  IRBlockStatement,
  NodeId,
  VariableName
} from '../../ir/nodes.js';
import { IRNodeFactory, isStatement, isExpression } from '../../ir/nodes.js';
import type { IRState } from '../Pass.js';

/**
 * Information about variable liveness
 */
export interface LivenessInfo {
  defined: Set<VariableName>;
  used: Set<VariableName>;
  liveIn: Set<VariableName>;
  liveOut: Set<VariableName>;
}

/**
 * Configuration for dead code elimination
 */
export interface DeadCodeEliminationConfig {
  removeUnusedVariables?: boolean;
  removeUnreachableCode?: boolean;
  removeEmptyStatements?: boolean;
  removeUnusedFunctions?: boolean;
  aggressiveElimination?: boolean;
  maxIterations?: number;
}

/**
 * Statistics for dead code elimination
 */
export interface DeadCodeEliminationStats {
  nodesRemoved: number;
  variablesRemoved: number;
  functionsRemoved: number;
  statementsRemoved: number;
  iterations: number;
}

/**
 * Base class for dead code elimination passes
 */
export abstract class DeadCodeEliminationBase extends BasePass<IRState> {
  protected config: Required<DeadCodeEliminationConfig>;
  protected stats: DeadCodeEliminationStats;
  protected livenessInfo: Map<NodeId, LivenessInfo> = new Map();
  protected definedVariables: Set<VariableName> = new Set();
  protected usedVariables: Set<VariableName> = new Set();

  constructor(config: DeadCodeEliminationConfig = {}) {
    super();
    
    this.config = {
      removeUnusedVariables: true,
      removeUnreachableCode: true,
      removeEmptyStatements: true,
      removeUnusedFunctions: true,
      aggressiveElimination: false,
      maxIterations: 100,
      ...config
    };

    this.stats = {
      nodesRemoved: 0,
      variablesRemoved: 0,
      functionsRemoved: 0,
      statementsRemoved: 0,
      iterations: 0
    };
  }

  protected executePass(state: IRState): { state: IRState; changed: boolean } {
    this.resetState();

    // Perform liveness analysis
    this.performLivenessAnalysis(state);
    
    // Remove dead code based on analysis
    const { newNodes, changed } = this.eliminateDeadCode(state);

    if (changed) {
      const newState = PassUtils.updateNodes(state, newNodes);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Reset internal state for new analysis
   */
  protected resetState(): void {
    this.livenessInfo.clear();
    this.definedVariables.clear();
    this.usedVariables.clear();
    this.stats = {
      nodesRemoved: 0,
      variablesRemoved: 0,
      functionsRemoved: 0,
      statementsRemoved: 0,
      iterations: 0
    };
  }

  /**
   * Perform liveness analysis on the IR
   */
  protected performLivenessAnalysis(state: IRState): void {
    // First pass: collect all variable definitions and uses
    this.collectVariableInfo(state);
    
    // Second pass: compute liveness information
    this.computeLiveness(state);
  }

  /**
   * Collect variable definition and usage information
   */
  protected collectVariableInfo(state: IRState): void {
    for (const [nodeId, node] of state.nodes) {
      const liveness: LivenessInfo = {
        defined: new Set(),
        used: new Set(),
        liveIn: new Set(),
        liveOut: new Set()
      };

      this.collectNodeVariables(node, liveness);
      this.livenessInfo.set(nodeId, liveness);
    }
  }

  /**
   * Collect variable information from a single node
   */
  protected collectNodeVariables(node: IRNode, liveness: LivenessInfo): void {
    switch (node.type) {
      case 'VariableDeclaration':
        this.collectVariableDeclarationInfo(node, liveness);
        break;
      
      case 'Identifier':
        this.collectIdentifierInfo(node, liveness);
        break;
      
      case 'AssignmentExpression':
        this.collectAssignmentInfo(node, liveness);
        break;
      
      case 'BlockStatement':
        this.collectBlockStatementInfo(node, liveness);
        break;
      
      case 'BinaryExpression':
      case 'UnaryExpression':
      case 'CallExpression':
        this.collectExpressionInfo(node, liveness);
        break;
      
      default:
        // For other node types, recursively analyze children
        this.collectChildrenInfo(node, liveness);
        break;
    }
  }

  /**
   * Collect information from variable declarations
   */
  protected collectVariableDeclarationInfo(node: IRVariableDeclaration, liveness: LivenessInfo): void {
    for (const declarator of node.declarations) {
      if (declarator.id.type === 'Identifier') {
        const varName = IRNodeFactory.createVariableName(declarator.id.name);
        liveness.defined.add(varName);
        this.definedVariables.add(varName);
        
        // If there's an initializer, it uses variables
        if (declarator.init) {
          this.collectExpressionUses(declarator.init, liveness);
        }
      }
    }
  }

  /**
   * Collect information from identifier nodes
   */
  protected collectIdentifierInfo(node: IRIdentifier, liveness: LivenessInfo): void {
    const varName = IRNodeFactory.createVariableName(node.name);
    liveness.used.add(varName);
    this.usedVariables.add(varName);
  }

  /**
   * Collect information from assignment expressions
   */
  protected collectAssignmentInfo(node: any, liveness: LivenessInfo): void {
    // Right side uses variables
    this.collectExpressionUses(node.right, liveness);
    
    // Left side defines variables (for simple assignments)
    if (node.left.type === 'Identifier' && node.operator === '=') {
      const varName = IRNodeFactory.createVariableName(node.left.name);
      liveness.defined.add(varName);
      this.definedVariables.add(varName);
    } else {
      // Complex left side (property access, etc.) also uses variables
      this.collectExpressionUses(node.left, liveness);
    }
  }

  /**
   * Collect information from block statements
   */
  protected collectBlockStatementInfo(node: IRBlockStatement, liveness: LivenessInfo): void {
    for (const stmt of node.body) {
      this.collectNodeVariables(stmt, liveness);
    }
  }

  /**
   * Collect information from expressions
   */
  protected collectExpressionInfo(node: any, liveness: LivenessInfo): void {
    this.collectExpressionUses(node, liveness);
  }

  /**
   * Collect variable uses from an expression
   */
  protected collectExpressionUses(expr: any, liveness: LivenessInfo): void {
    if (!expr) return;

    switch (expr.type) {
      case 'Identifier':
        const varName = IRNodeFactory.createVariableName(expr.name);
        liveness.used.add(varName);
        this.usedVariables.add(varName);
        break;
      
      case 'BinaryExpression':
        this.collectExpressionUses(expr.left, liveness);
        this.collectExpressionUses(expr.right, liveness);
        break;
      
      case 'UnaryExpression':
        this.collectExpressionUses(expr.argument, liveness);
        break;
      
      case 'CallExpression':
        this.collectExpressionUses(expr.callee, liveness);
        for (const arg of expr.arguments) {
          this.collectExpressionUses(arg, liveness);
        }
        break;
      
      case 'MemberExpression':
        this.collectExpressionUses(expr.object, liveness);
        if (expr.computed) {
          this.collectExpressionUses(expr.property, liveness);
        }
        break;
      
      case 'ArrayExpression':
        for (const element of expr.elements) {
          if (element) {
            this.collectExpressionUses(element, liveness);
          }
        }
        break;
      
      case 'ObjectExpression':
        for (const property of expr.properties) {
          if (property.computed) {
            this.collectExpressionUses(property.key, liveness);
          }
          this.collectExpressionUses(property.value, liveness);
        }
        break;
      
      default:
        // For other expression types, recursively analyze children
        this.collectChildrenInfo(expr, liveness);
        break;
    }
  }

  /**
   * Collect information from child nodes
   */
  protected collectChildrenInfo(node: any, liveness: LivenessInfo): void {
    for (const key in node) {
      if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') {
        continue;
      }

      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(childNode => {
          if (childNode && typeof childNode === 'object' && childNode.type) {
            this.collectNodeVariables(childNode, liveness);
          }
        });
      } else if (child && typeof child === 'object' && child.type) {
        this.collectNodeVariables(child, liveness);
      }
    }
  }

  /**
   * Compute liveness information using dataflow analysis
   */
  protected computeLiveness(state: IRState): void {
    let changed = true;
    let iterations = 0;

    // Iterative dataflow analysis until convergence
    while (changed && iterations < this.config.maxIterations) {
      changed = false;
      iterations++;

      for (const [nodeId, node] of state.nodes) {
        const liveness = this.livenessInfo.get(nodeId);
        if (!liveness) continue;

        const oldLiveIn = new Set(liveness.liveIn);
        const oldLiveOut = new Set(liveness.liveOut);

        // Compute live-out: union of live-in of all successors
        // (This is simplified - in practice would use CFG)
        liveness.liveOut = new Set(liveness.used);

        // Compute live-in: (live-out - defined) ∪ used
        liveness.liveIn = new Set([
          ...liveness.used,
          ...Array.from(liveness.liveOut).filter(v => !liveness.defined.has(v))
        ]);

        // Check for changes
        if (!this.setsEqual(oldLiveIn, liveness.liveIn) || 
            !this.setsEqual(oldLiveOut, liveness.liveOut)) {
          changed = true;
        }
      }
    }

    this.stats.iterations = iterations;
  }

  /**
   * Check if two sets are equal
   */
  protected setsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }

  /**
   * Eliminate dead code based on liveness analysis
   */
  protected eliminateDeadCode(state: IRState): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    const newNodes = new Map<NodeId, IRNode>();
    let changed = false;

    for (const [nodeId, node] of state.nodes) {
      const transformedNode = this.eliminateNodeDeadCode(node, state);
      
      if (transformedNode === null) {
        // Node was completely removed
        changed = true;
        this.stats.nodesRemoved++;
        this.changeNode();
      } else if (transformedNode !== node) {
        newNodes.set(nodeId, transformedNode);
        changed = true;
        this.changeNode();
      }
    }

    return { newNodes, changed };
  }

  /**
   * Eliminate dead code from a single node
   */
  protected eliminateNodeDeadCode(node: IRNode, state: IRState): IRNode | null {
    if (this.config.removeEmptyStatements && this.isEmptyStatement(node)) {
      this.stats.statementsRemoved++;
      return null;
    }

    if (this.config.removeUnusedVariables && this.isUnusedVariableDeclaration(node)) {
      this.stats.variablesRemoved++;
      return this.removeUnusedFromVariableDeclaration(node as IRVariableDeclaration);
    }

    if (this.config.removeUnusedFunctions && this.isUnusedFunction(node)) {
      this.stats.functionsRemoved++;
      return null;
    }

    return this.transformNodeChildren(node, state);
  }

  /**
   * Check if a node is an empty statement
   */
  protected isEmptyStatement(node: IRNode): boolean {
    return node.type === 'EmptyStatement' ||
           (node.type === 'BlockStatement' && node.body.length === 0) ||
           (node.type === 'ExpressionStatement' && !node.expression);
  }

  /**
   * Check if a variable declaration is unused
   */
  protected isUnusedVariableDeclaration(node: IRNode): boolean {
    if (node.type !== 'VariableDeclaration') return false;
    
    const varDecl = node as IRVariableDeclaration;
    return varDecl.declarations.some(decl => {
      if (decl.id.type === 'Identifier') {
        const varName = IRNodeFactory.createVariableName(decl.id.name);
        return !this.usedVariables.has(varName);
      }
      return false;
    });
  }

  /**
   * Check if a function is unused
   */
  protected isUnusedFunction(node: IRNode): boolean {
    if (node.type !== 'FunctionDeclaration') return false;
    
    const funcDecl = node as any;
    if (!funcDecl.id) return false;
    
    const funcName = IRNodeFactory.createVariableName(funcDecl.id.name);
    return !this.usedVariables.has(funcName);
  }

  /**
   * Remove unused declarations from a variable declaration
   */
  protected removeUnusedFromVariableDeclaration(node: IRVariableDeclaration): IRNode | null {
    const usedDeclarations = node.declarations.filter(decl => {
      if (decl.id.type === 'Identifier') {
        const varName = IRNodeFactory.createVariableName(decl.id.name);
        return this.usedVariables.has(varName);
      }
      return true; // Keep non-identifier declarations
    });

    if (usedDeclarations.length === 0) {
      return null; // Remove entire declaration
    }

    if (usedDeclarations.length !== node.declarations.length) {
      return {
        ...node,
        declarations: usedDeclarations
      };
    }

    return node;
  }

  /**
   * Transform children of a node recursively
   */
  protected transformNodeChildren(node: IRNode, state: IRState): IRNode {
    switch (node.type) {
      case 'BlockStatement':
        return this.transformBlockStatement(node as IRBlockStatement, state);
      
      case 'Program':
        return this.transformProgram(node as any, state);
      
      default:
        return node;
    }
  }

  /**
   * Transform block statement by removing dead statements
   */
  protected transformBlockStatement(node: IRBlockStatement, state: IRState): IRNode {
    const aliveStatements = [];
    
    for (const stmt of node.body) {
      const transformedStmt = this.eliminateNodeDeadCode(stmt, state);
      if (transformedStmt !== null) {
        aliveStatements.push(transformedStmt as IRStatement);
      }
    }

    if (aliveStatements.length !== node.body.length) {
      this.stats.statementsRemoved += node.body.length - aliveStatements.length;
      return {
        ...node,
        body: aliveStatements
      };
    }

    return node;
  }

  /**
   * Transform program by removing dead top-level statements
   */
  protected transformProgram(node: any, state: IRState): IRNode {
    const aliveStatements = [];
    
    for (const stmt of node.body) {
      const transformedStmt = this.eliminateNodeDeadCode(stmt, state);
      if (transformedStmt !== null) {
        aliveStatements.push(transformedStmt);
      }
    }

    if (aliveStatements.length !== node.body.length) {
      this.stats.statementsRemoved += node.body.length - aliveStatements.length;
      return {
        ...node,
        body: aliveStatements
      };
    }

    return node;
  }

  /**
   * Get analysis statistics
   */
  public getStats(): DeadCodeEliminationStats {
    return { ...this.stats };
  }

  /**
   * Get liveness information for debugging
   */
  public getLivenessInfo(): Map<NodeId, LivenessInfo> {
    return new Map(this.livenessInfo);
  }
}