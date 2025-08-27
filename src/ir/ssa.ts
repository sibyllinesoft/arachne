/**
 * @fileoverview Static Single Assignment (SSA) form construction and utilities
 * 
 * This module implements SSA form construction with phi-node insertion,
 * variable renaming with version numbers, use-def chain construction,
 * and SSA destruction for final output.
 */

import type {
  IRNode,
  IRStatement,
  IRExpression,
  IRIdentifier,
  IRPhiNode,
  IRBlockStatement,
  IRVariableDeclaration,
  IRAssignmentExpression,
  VariableName,
  SSAVersion,
  NodeId,
  IRPattern
} from './nodes.js';
import { IRNodeFactory, isStatement, isExpression } from './nodes.js';
import type { CFG, CFGNode } from './cfg.js';
import { CFGAnalyzer } from './cfg.js';

/**
 * SSA variable with version information
 */
export interface SSAVariable {
  readonly name: VariableName;
  readonly version: SSAVersion;
  readonly original_name: string;
  readonly def_site: NodeId;
  readonly use_sites: readonly NodeId[];
}

/**
 * Use-def chain information
 */
export interface UseDefChain {
  readonly variable: SSAVariable;
  readonly defs: readonly NodeId[];
  readonly uses: readonly NodeId[];
  readonly reaching_defs: ReadonlyMap<NodeId, NodeId>;
}

/**
 * SSA construction state
 */
export interface SSAState {
  readonly cfg: CFG;
  readonly variables: ReadonlyMap<VariableName, SSAVariable[]>;
  readonly use_def_chains: ReadonlyMap<VariableName, UseDefChain>;
  readonly phi_nodes: ReadonlyMap<NodeId, readonly IRPhiNode[]>;
  readonly renamed_nodes: ReadonlyMap<NodeId, IRNode>;
}

/**
 * SSA Form Builder
 */
export class SSABuilder {
  private readonly variable_versions = new Map<VariableName, number>();
  private readonly variable_stacks = new Map<VariableName, SSAVariable[]>();
  private readonly phi_nodes = new Map<NodeId, IRPhiNode[]>();
  private readonly renamed_nodes = new Map<NodeId, IRNode>();
  private readonly variable_defs = new Map<VariableName, SSAVariable[]>();
  private readonly dominance_frontiers: ReadonlyMap<CFGNode, Set<CFGNode>>;

  constructor(private readonly cfg: CFG) {
    this.dominance_frontiers = CFGAnalyzer.computeDominanceFrontiers(cfg);
  }

  /**
   * Convert CFG to SSA form
   */
  buildSSA(): SSAState {
    // Step 1: Insert phi nodes at join points
    this.insertPhiNodes();
    
    // Step 2: Rename variables
    this.renameVariables();
    
    // Step 3: Build use-def chains
    const useDefChains = this.buildUseDefChains();
    
    return {
      cfg: this.cfg,
      variables: new Map(this.variable_defs),
      use_def_chains: useDefChains,
      phi_nodes: new Map(this.phi_nodes),
      renamed_nodes: new Map(this.renamed_nodes)
    };
  }

  /**
   * Insert phi nodes at dominance frontier join points
   */
  private insertPhiNodes(): void {
    // Collect all variables that are assigned
    const assignedVars = new Set<VariableName>();
    
    for (const node of this.cfg.nodes.values()) {
      for (const stmt of node.instructions) {
        this.collectAssignedVariables(stmt, assignedVars);
      }
    }

    // For each variable, insert phi nodes at dominance frontiers
    for (const variable of assignedVars) {
      const defSites = this.findDefSites(variable);
      const phiSites = new Set<CFGNode>();
      
      for (const defSite of defSites) {
        const frontiers = this.dominance_frontiers.get(defSite);
        if (frontiers) {
          for (const frontierNode of frontiers) {
            if (!phiSites.has(frontierNode)) {
              phiSites.add(frontierNode);
              this.insertPhiNode(frontierNode, variable);
            }
          }
        }
      }
    }
  }

  /**
   * Collect variables that are assigned in a statement
   */
  private collectAssignedVariables(node: IRNode, assignedVars: Set<VariableName>): void {
    switch (node.type) {
      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          if (declarator.id.type === 'Identifier') {
            assignedVars.add(IRNodeFactory.createVariableName(declarator.id.name));
          }
        }
        break;
        
      case 'AssignmentExpression':
        if (node.left.type === 'Identifier') {
          assignedVars.add(IRNodeFactory.createVariableName(node.left.name));
        }
        break;
        
      case 'UpdateExpression':
        if (node.argument.type === 'Identifier') {
          assignedVars.add(IRNodeFactory.createVariableName(node.argument.name));
        }
        break;
        
      case 'ExpressionStatement':
        // Handle assignments wrapped in expression statements
        this.collectAssignedVariables(node.expression, assignedVars);
        break;
        
      case 'BlockStatement':
        for (const stmt of node.body) {
          this.collectAssignedVariables(stmt, assignedVars);
        }
        break;
        
      case 'IfStatement':
        this.collectAssignedVariables(node.consequent, assignedVars);
        if (node.alternate) {
          this.collectAssignedVariables(node.alternate, assignedVars);
        }
        break;
        
      case 'WhileStatement':
      case 'ForStatement':
        this.collectAssignedVariables(node.body, assignedVars);
        break;
        
      // Add more cases as needed
    }
  }

  /**
   * Find CFG nodes that define a variable
   */
  private findDefSites(variable: VariableName): CFGNode[] {
    const defSites: CFGNode[] = [];
    
    for (const node of this.cfg.nodes.values()) {
      for (const stmt of node.instructions) {
        if (this.statementDefinesVariable(stmt, variable)) {
          defSites.push(node);
          break; // Only count each node once
        }
      }
    }
    
    return defSites;
  }

  /**
   * Check if a statement defines a variable
   */
  private statementDefinesVariable(stmt: IRStatement, variable: VariableName): boolean {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return stmt.declarations.some(decl => 
          decl.id.type === 'Identifier' && 
          decl.id.name === variable
        );
        
      case 'ExpressionStatement':
        if (stmt.expression.type === 'AssignmentExpression') {
          return stmt.expression.left.type === 'Identifier' && 
                 stmt.expression.left.name === variable;
        }
        return false;
        
      default:
        return false;
    }
  }

  /**
   * Insert phi node at a CFG node
   */
  private insertPhiNode(cfgNode: CFGNode, variable: VariableName): void {
    const operands = new Map<NodeId, IRIdentifier>();
    
    // Create operands for each predecessor
    for (const pred of cfgNode.predecessors) {
      const identifier = IRNodeFactory.identifier(`${variable}_?`, { node_id: pred.id });
      operands.set(pred.id, identifier);
    }
    
    const version = IRNodeFactory.createSSAVersion(this.getNextVersion(variable));
    const phiNode = IRNodeFactory.phiNode(variable, operands, version);
    
    const existingPhis = this.phi_nodes.get(cfgNode.id) || [];
    existingPhis.push(phiNode);
    this.phi_nodes.set(cfgNode.id, existingPhis);
  }

  /**
   * Get next version number for a variable
   */
  private getNextVersion(variable: VariableName): number {
    const current = this.variable_versions.get(variable) || 0;
    const next = current + 1;
    this.variable_versions.set(variable, next);
    return next;
  }

  /**
   * Rename variables to SSA form using DFS traversal
   */
  private renameVariables(): void {
    const visited = new Set<CFGNode>();
    this.renameVariablesDFS(this.cfg.entry, visited);
  }

  /**
   * DFS traversal for variable renaming
   */
  private renameVariablesDFS(node: CFGNode, visited: Set<CFGNode>): void {
    if (visited.has(node)) return;
    visited.add(node);

    // Save current stack state
    const stackState = new Map<VariableName, SSAVariable[]>();
    for (const [var_, stack] of this.variable_stacks) {
      stackState.set(var_, [...stack]);
    }

    // Process phi nodes first
    const phis = this.phi_nodes.get(node.id) || [];
    for (const phi of phis) {
      this.processPhiDefinition(phi);
    }

    // Process regular instructions
    for (const stmt of node.instructions) {
      const renamedStmt = this.renameInStatement(stmt);
      this.renamed_nodes.set(stmt.node_id || IRNodeFactory.createNodeId(), renamedStmt);
    }

    // Process phi operands in successors
    for (const successor of node.successors) {
      const successorPhis = this.phi_nodes.get(successor.id) || [];
      for (const phi of successorPhis) {
        this.updatePhiOperand(phi, node, successor);
      }
    }

    // Recursively process successors
    for (const successor of node.successors) {
      this.renameVariablesDFS(successor, visited);
    }

    // Restore stack state
    this.variable_stacks.clear();
    for (const [var_, stack] of stackState) {
      this.variable_stacks.set(var_, stack);
    }
  }

  /**
   * Process phi node definition
   */
  private processPhiDefinition(phi: IRPhiNode): void {
    const ssaVar: SSAVariable = {
      name: phi.variable,
      version: phi.target_version,
      original_name: phi.variable,
      def_site: phi.node_id || IRNodeFactory.createNodeId(),
      use_sites: []
    };

    this.pushVariable(phi.variable, ssaVar);
  }

  /**
   * Update phi node operand for specific predecessor
   */
  private updatePhiOperand(phi: IRPhiNode, predecessor: CFGNode, successor: CFGNode): void {
    const currentVar = this.getCurrentVariable(phi.variable);
    if (currentVar) {
      const identifier = IRNodeFactory.identifier(
        `${currentVar.name}_${currentVar.version}`,
        { node_id: predecessor.id }
      );
      phi.operands.set(predecessor.id, identifier);
    }
  }

  /**
   * Rename variables in a statement
   */
  private renameInStatement(stmt: IRStatement): IRStatement {
    switch (stmt.type) {
      case 'VariableDeclaration':
        return this.renameVariableDeclaration(stmt);
      case 'ExpressionStatement':
        return {
          ...stmt,
          expression: this.renameInExpression(stmt.expression)
        };
      case 'BlockStatement':
        return {
          ...stmt,
          body: stmt.body.map(s => this.renameInStatement(s))
        };
      case 'IfStatement':
        return {
          ...stmt,
          test: this.renameInExpression(stmt.test),
          consequent: this.renameInStatement(stmt.consequent),
          alternate: stmt.alternate ? this.renameInStatement(stmt.alternate) : null
        };
      case 'ReturnStatement':
        return {
          ...stmt,
          argument: stmt.argument ? this.renameInExpression(stmt.argument) : null
        };
      default:
        return stmt; // Return unchanged for now
    }
  }

  /**
   * Rename variables in variable declaration
   */
  private renameVariableDeclaration(decl: IRVariableDeclaration): IRVariableDeclaration {
    return {
      ...decl,
      declarations: decl.declarations.map(declarator => {
        // Rename RHS first
        const newInit = declarator.init ? this.renameInExpression(declarator.init) : null;
        
        // Then handle LHS definition
        if (declarator.id.type === 'Identifier') {
          const variable = IRNodeFactory.createVariableName(declarator.id.name);
          const version = IRNodeFactory.createSSAVersion(this.getNextVersion(variable));
          
          const ssaVar: SSAVariable = {
            name: variable,
            version,
            original_name: declarator.id.name,
            def_site: declarator.node_id || IRNodeFactory.createNodeId(),
            use_sites: []
          };
          
          this.pushVariable(variable, ssaVar);
          
          const newId = IRNodeFactory.ssaIdentifier(variable, version, declarator.id.name);
          
          return {
            ...declarator,
            id: newId,
            init: newInit
          };
        }
        
        return {
          ...declarator,
          init: newInit
        };
      })
    };
  }

  /**
   * Rename variables in expressions
   */
  private renameInExpression(expr: IRExpression): IRExpression {
    switch (expr.type) {
      case 'Identifier':
        return this.renameIdentifier(expr);
        
      case 'BinaryExpression':
        return {
          ...expr,
          left: this.renameInExpression(expr.left),
          right: this.renameInExpression(expr.right)
        };
        
      case 'UnaryExpression':
        return {
          ...expr,
          argument: this.renameInExpression(expr.argument)
        };
        
      case 'AssignmentExpression':
        // Handle RHS first, then LHS
        const newRight = this.renameInExpression(expr.right);
        
        if (expr.left.type === 'Identifier') {
          const variable = IRNodeFactory.createVariableName(expr.left.name);
          const version = IRNodeFactory.createSSAVersion(this.getNextVersion(variable));
          
          const ssaVar: SSAVariable = {
            name: variable,
            version,
            original_name: expr.left.name,
            def_site: expr.node_id || IRNodeFactory.createNodeId(),
            use_sites: []
          };
          
          this.pushVariable(variable, ssaVar);
          
          const newLeft = IRNodeFactory.ssaIdentifier(variable, version, expr.left.name);
          
          return {
            ...expr,
            left: newLeft,
            right: newRight
          };
        }
        
        return {
          ...expr,
          right: newRight
        };
        
      case 'CallExpression':
        return {
          ...expr,
          callee: this.renameInExpression(expr.callee),
          arguments: expr.arguments.map(arg => this.renameInExpression(arg))
        };
        
      case 'MemberExpression':
        return {
          ...expr,
          object: this.renameInExpression(expr.object),
          property: expr.computed ? this.renameInExpression(expr.property) : expr.property
        };
        
      case 'Literal':
        return expr; // Literals don't need renaming
        
      default:
        return expr; // Return unchanged for other types
    }
  }

  /**
   * Rename identifier to SSA form
   */
  private renameIdentifier(id: IRIdentifier): IRExpression {
    const variable = IRNodeFactory.createVariableName(id.name);
    const currentVar = this.getCurrentVariable(variable);
    
    if (currentVar) {
      // Record use site
      (currentVar.use_sites as NodeId[]).push(id.node_id || IRNodeFactory.createNodeId());
      
      return IRNodeFactory.ssaIdentifier(
        currentVar.name,
        currentVar.version,
        currentVar.original_name,
        { node_id: id.node_id }
      );
    }
    
    // Variable not found in scope - might be global or error
    return id;
  }

  /**
   * Push variable onto stack
   */
  private pushVariable(name: VariableName, variable: SSAVariable): void {
    const stack = this.variable_stacks.get(name) || [];
    stack.push(variable);
    this.variable_stacks.set(name, stack);
    
    // Also track in defs
    const defs = this.variable_defs.get(name) || [];
    defs.push(variable);
    this.variable_defs.set(name, defs);
  }

  /**
   * Get current (top of stack) variable
   */
  private getCurrentVariable(name: VariableName): SSAVariable | undefined {
    const stack = this.variable_stacks.get(name);
    return stack && stack.length > 0 ? stack[stack.length - 1] : undefined;
  }

  /**
   * Build use-def chains for all variables
   */
  private buildUseDefChains(): ReadonlyMap<VariableName, UseDefChain> {
    const chains = new Map<VariableName, UseDefChain>();
    
    for (const [name, variables] of this.variable_defs) {
      const allDefs: NodeId[] = [];
      const allUses: NodeId[] = [];
      const reachingDefs = new Map<NodeId, NodeId>();
      
      for (const variable of variables) {
        allDefs.push(variable.def_site);
        allUses.push(...variable.use_sites);
        
        // Simple reaching definitions - each use reaches its defining def
        for (const useSite of variable.use_sites) {
          reachingDefs.set(useSite, variable.def_site);
        }
      }
      
      chains.set(name, {
        variable: variables[0]!, // Representative variable
        defs: allDefs,
        uses: allUses,
        reaching_defs: reachingDefs
      });
    }
    
    return chains;
  }
}

/**
 * SSA Destruction - convert back from SSA to normal form
 */
export class SSADestroyer {
  constructor(private readonly ssaState: SSAState) {}

  /**
   * Convert SSA form back to normal form
   */
  destroySSA(): Map<NodeId, IRNode> {
    const normalizedNodes = new Map<NodeId, IRNode>();
    
    for (const [nodeId, node] of this.ssaState.renamed_nodes) {
      const normalizedNode = this.normalizeNode(node);
      normalizedNodes.set(nodeId, normalizedNode);
    }
    
    return normalizedNodes;
  }

  /**
   * Normalize a single node (remove SSA annotations)
   */
  private normalizeNode(node: IRNode): IRNode {
    switch (node.type) {
      case 'SSAIdentifier':
        return IRNodeFactory.identifier(node.original_name, {
          node_id: node.node_id,
          loc: node.loc
        });
        
      case 'BlockStatement':
        return {
          ...node,
          body: node.body.map(stmt => this.normalizeNode(stmt) as IRStatement),
          phi_nodes: undefined // Remove phi nodes
        };
        
      case 'VariableDeclaration':
        return {
          ...node,
          declarations: node.declarations.map(decl => ({
            ...decl,
            id: this.normalizeNode(decl.id) as IRPattern,
            init: decl.init ? this.normalizeNode(decl.init) as IRExpression : null
          }))
        };
        
      case 'BinaryExpression':
        return {
          ...node,
          left: this.normalizeNode(node.left) as IRExpression,
          right: this.normalizeNode(node.right) as IRExpression
        };
        
      default:
        return node; // Return unchanged if no SSA-specific content
    }
  }
}

/**
 * SSA Analysis utilities
 */
export class SSAAnalyzer {
  /**
   * Find all uses of a definition
   */
  static findUses(ssaState: SSAState, defSite: NodeId): NodeId[] {
    for (const chain of ssaState.use_def_chains.values()) {
      if (chain.defs.includes(defSite)) {
        return [...chain.uses];
      }
    }
    return [];
  }

  /**
   * Find the definition that reaches a use
   */
  static findReachingDef(ssaState: SSAState, useSite: NodeId): NodeId | undefined {
    for (const chain of ssaState.use_def_chains.values()) {
      const reachingDef = chain.reaching_defs.get(useSite);
      if (reachingDef) {
        return reachingDef;
      }
    }
    return undefined;
  }

  /**
   * Check if two variables interfere (have overlapping live ranges)
   */
  static doVariablesInterfere(
    ssaState: SSAState,
    var1: VariableName,
    var2: VariableName
  ): boolean {
    const chain1 = ssaState.use_def_chains.get(var1);
    const chain2 = ssaState.use_def_chains.get(var2);
    
    if (!chain1 || !chain2) return false;
    
    // Simple interference check - could be made more sophisticated
    const range1 = new Set([...chain1.defs, ...chain1.uses]);
    const range2 = new Set([...chain2.defs, ...chain2.uses]);
    
    for (const node of range1) {
      if (range2.has(node)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Validate SSA properties
   */
  static validateSSA(ssaState: SSAState): boolean {
    // Check that each variable has exactly one definition
    for (const [name, chain] of ssaState.use_def_chains) {
      if (chain.defs.length === 0) {
        console.warn(`Variable ${name} has no definitions`);
        return false;
      }
      
      // In proper SSA, each variable version should have exactly one def
      const variables = ssaState.variables.get(name) || [];
      for (const variable of variables) {
        if (variable.use_sites.some(use => 
          ssaState.use_def_chains.get(name)?.reaching_defs.get(use) !== variable.def_site
        )) {
          console.warn(`Variable ${name} has incorrect reaching definitions`);
          return false;
        }
      }
    }
    
    return true;
  }
}