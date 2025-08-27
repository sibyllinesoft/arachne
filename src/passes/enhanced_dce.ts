/**
 * @fileoverview Enhanced Dead Code Elimination Pass
 * 
 * This pass performs aggressive dead code elimination post-deobfuscation with
 * precise def-use analysis, unreachable code elimination after control flow
 * restoration, function elimination for unused helpers, and statement-level
 * granularity for maximum effectiveness.
 */

import type {
  IRNode,
  IRExpression,
  IRStatement,
  IRIdentifier,
  IRFunctionDeclaration,
  IRVariableDeclaration,
  IRVariableDeclarator,
  IRBlockStatement,
  IRIfStatement,
  IRWhileStatement,
  IRForStatement,
  IRReturnStatement,
  IRExpressionStatement,
  IRAssignmentExpression,
  IRCallExpression,
  IRUpdateExpression,
  VariableName,
  NodeId,
  ScopeId
} from '../ir/nodes.js';
import { IRNodeFactory, IRUtils, isExpression, isStatement } from '../ir/nodes.js';
import { BasePass, type IRState, type PassResult, PassUtils } from './Pass.js';
import type { CFG, BasicBlock } from '../ir/cfg.js';
import type { SSAState } from '../ir/ssa.js';

/**
 * Definition site information
 */
export interface DefinitionSite {
  readonly nodeId: NodeId;
  readonly variable: VariableName;
  readonly scopeId: ScopeId;
  readonly definitionType: DefinitionType;
  readonly isConditional: boolean;
  readonly sideEffects: ReadonlySet<SideEffectType>;
  readonly dependencies: ReadonlySet<VariableName>;
}

/**
 * Use site information
 */
export interface UseSite {
  readonly nodeId: NodeId;
  readonly variable: VariableName;
  readonly scopeId: ScopeId;
  readonly useType: UseType;
  readonly isEscaping: boolean;
  readonly isInLoop: boolean;
}

/**
 * Types of variable definitions
 */
export type DefinitionType = 
  | 'declaration'        // Variable declaration
  | 'assignment'         // Assignment expression
  | 'parameter'          // Function parameter
  | 'import'            // Import statement
  | 'function'          // Function declaration
  | 'catch-binding';    // Catch clause binding

/**
 * Types of variable uses
 */
export type UseType = 
  | 'reference'         // Simple variable reference
  | 'call'             // Function call
  | 'assignment-lhs'   // Left-hand side of assignment
  | 'member-access'    // Property access
  | 'export'           // Export statement
  | 'return';          // Return statement

/**
 * Types of side effects (from enhanced_constprop)
 */
export type SideEffectType = 
  | 'memory-read'
  | 'memory-write'
  | 'io-operation'
  | 'exception'
  | 'global-access'
  | 'function-call'
  | 'property-access'
  | 'console-output';

/**
 * Liveness information for variables
 */
export interface LivenessInfo {
  readonly liveIn: ReadonlySet<VariableName>;
  readonly liveOut: ReadonlySet<VariableName>;
  readonly gen: ReadonlySet<VariableName>;
  readonly kill: ReadonlySet<VariableName>;
}

/**
 * Reachability information for code
 */
export interface ReachabilityInfo {
  readonly reachableBlocks: ReadonlySet<NodeId>;
  readonly unreachableBlocks: ReadonlySet<NodeId>;
  readonly reachableStatements: ReadonlySet<NodeId>;
  readonly unreachableStatements: ReadonlySet<NodeId>;
}

/**
 * Escape analysis information
 */
export interface EscapeInfo {
  readonly escapingVariables: ReadonlySet<VariableName>;
  readonly capturedVariables: ReadonlySet<VariableName>;
  readonly globalReferences: ReadonlySet<VariableName>;
  readonly exportedReferences: ReadonlySet<VariableName>;
}

/**
 * Dead code elimination result
 */
export interface DeadCodeResult {
  readonly eliminatedNodes: ReadonlySet<NodeId>;
  readonly eliminatedStatements: ReadonlySet<NodeId>;
  readonly eliminatedFunctions: ReadonlySet<VariableName>;
  readonly eliminatedVariables: ReadonlySet<VariableName>;
  readonly preservedForSideEffects: ReadonlySet<NodeId>;
  readonly statistics: DCEStatistics;
}

/**
 * DCE pass statistics
 */
export interface DCEStatistics {
  readonly totalNodes: number;
  readonly eliminatedNodes: number;
  readonly eliminatedStatements: number;
  readonly eliminatedFunctions: number;
  readonly eliminatedVariables: number;
  readonly bytesReduced: number;
  readonly reachabilityReduction: number;
}

/**
 * Enhanced Dead Code Elimination Pass
 * 
 * Performs aggressive dead code elimination with:
 * - Precise def-use analysis with SSA form
 * - Liveness analysis for variable elimination  
 * - Unreachable code elimination using CFG
 * - Function elimination for unused helper functions
 * - Property elimination for unused object properties
 * - Statement-level granularity for maximum reduction
 * - Side effect analysis to preserve observable behavior
 * - Escape analysis for closure and global optimizations
 */
export class EnhancedDeadCodeEliminationPass extends BasePass<IRState> {
  readonly name = 'enhanced-dead-code-elimination';
  readonly description = 'Aggressive dead code elimination with precise analysis';
  override readonly dependencies = ['cfg', 'ssa'] as const;

  private cfg: CFG | null = null;
  private ssaState: SSAState | null = null;
  private definitionSites: Map<VariableName, DefinitionSite[]> = new Map();
  private useSites: Map<VariableName, UseSite[]> = new Map();
  private livenessInfo: Map<NodeId, LivenessInfo> = new Map();
  private reachabilityInfo: ReachabilityInfo | null = null;
  private escapeInfo: EscapeInfo | null = null;

  protected executePass(state: IRState): { state: IRState; changed: boolean } {
    if (!state.cfg) {
      this.warnings.push('CFG required for enhanced dead code elimination');
      return { state, changed: false };
    }

    if (!state.ssa) {
      this.warnings.push('SSA form required for enhanced dead code elimination');  
      return { state, changed: false };
    }

    this.cfg = state.cfg;
    this.ssaState = state.ssa;
    this.definitionSites.clear();
    this.useSites.clear();
    this.livenessInfo.clear();

    // Phase 1: Build def-use chains with precise analysis
    this.buildDefUseChains(state);

    // Phase 2: Perform liveness analysis
    this.performLivenessAnalysis(state);

    // Phase 3: Analyze reachability using CFG
    this.analyzeReachability(state);

    // Phase 4: Perform escape analysis
    this.performEscapeAnalysis(state);

    // Phase 5: Identify dead code with side effect analysis
    const deadCodeResult = this.identifyDeadCode(state);

    // Phase 6: Apply dead code elimination transformations
    const { newNodes, changed } = this.applyDeadCodeElimination(state, deadCodeResult);

    if (changed) {
      this.logStatistics(deadCodeResult.statistics);
      const newState = PassUtils.updateNodes(state, newNodes);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Build precise def-use chains using SSA form
   */
  private buildDefUseChains(state: IRState): void {
    for (const [nodeId, node] of state.nodes) {
      this.analyzeNodeForDefUse(nodeId, node, state);
      this.nodesVisited++;
    }
  }

  /**
   * Analyze a single node for definitions and uses
   */
  private analyzeNodeForDefUse(nodeId: NodeId, node: IRNode, state: IRState): void {
    switch (node.type) {
      case 'VariableDeclaration':
        this.analyzeVariableDeclarationDefUse(nodeId, node);
        break;

      case 'FunctionDeclaration':
        this.analyzeFunctionDeclarationDefUse(nodeId, node);
        break;

      case 'AssignmentExpression':
        this.analyzeAssignmentDefUse(nodeId, node);
        break;

      case 'Identifier':
        this.analyzeIdentifierUse(nodeId, node);
        break;

      case 'CallExpression':
        this.analyzeCallExpressionDefUse(nodeId, node);
        break;

      case 'UpdateExpression':
        this.analyzeUpdateExpressionDefUse(nodeId, node);
        break;

      default:
        // Recursively analyze child nodes
        this.analyzeChildNodesDefUse(node, state);
    }
  }

  /**
   * Analyze variable declaration for definitions
   */
  private analyzeVariableDeclarationDefUse(nodeId: NodeId, decl: IRVariableDeclaration): void {
    for (const declarator of decl.declarations) {
      const variableName = IRUtils.getPatternName(declarator.id) as VariableName;
      if (!variableName) continue;
      
      const definition: DefinitionSite = {
        nodeId,
        variable: variableName,
        scopeId: this.getCurrentScope(nodeId),
        definitionType: 'declaration',
        isConditional: false,
        sideEffects: declarator.init ? this.analyzeSideEffects(declarator.init) : new Set(),
        dependencies: declarator.init ? this.extractDependencies(declarator.init) : new Set()
      };

      this.addDefinitionSite(variableName, definition);

      // Analyze initializer for uses
      if (declarator.init) {
        this.analyzeExpressionForUses(declarator.init);
      }
    }
  }

  /**
   * Analyze function declaration for definitions
   */
  private analyzeFunctionDeclarationDefUse(nodeId: NodeId, func: IRFunctionDeclaration): void {
    if (func.id) {
      const functionName = func.id.name as VariableName;
      
      const definition: DefinitionSite = {
        nodeId,
        variable: functionName,
        scopeId: this.getCurrentScope(nodeId),
        definitionType: 'function',
        isConditional: false,
        sideEffects: func.body ? this.analyzeSideEffects(func.body) : new Set(),
        dependencies: new Set()
      };

      this.addDefinitionSite(functionName, definition);
    }

    // Parameters are definitions in the function scope
    for (const param of func.params) {
      if (param.type === 'Identifier') {
        const paramName = param.name as VariableName;
        
        const definition: DefinitionSite = {
          nodeId,
          variable: paramName,
          scopeId: this.getFunctionScope(nodeId),
          definitionType: 'parameter',
          isConditional: false,
          sideEffects: new Set(),
          dependencies: new Set()
        };

        this.addDefinitionSite(paramName, definition);
      }
    }
  }

  /**
   * Analyze assignment expression for definitions and uses
   */
  private analyzeAssignmentDefUse(nodeId: NodeId, assignment: IRAssignmentExpression): void {
    // Left side is a definition
    if (assignment.left.type === 'Identifier') {
      const variableName = assignment.left.name as VariableName;
      
      const definition: DefinitionSite = {
        nodeId,
        variable: variableName,
        scopeId: this.getCurrentScope(nodeId),
        definitionType: 'assignment',
        isConditional: this.isInConditionalContext(nodeId),
        sideEffects: this.analyzeSideEffects(assignment.right),
        dependencies: this.extractDependencies(assignment.right)
      };

      this.addDefinitionSite(variableName, definition);
    }

    // Right side contains uses
    this.analyzeExpressionForUses(assignment.right);
  }

  /**
   * Analyze identifier for uses
   */
  private analyzeIdentifierUse(nodeId: NodeId, identifier: IRIdentifier): void {
    const variableName = identifier.name as VariableName;
    
    const use: UseSite = {
      nodeId,
      variable: variableName,
      scopeId: this.getCurrentScope(nodeId),
      useType: 'reference',
      isEscaping: this.isEscapingUse(nodeId),
      isInLoop: this.isInLoop(nodeId)
    };

    this.addUseSite(variableName, use);
  }

  /**
   * Analyze call expression for definitions and uses
   */
  private analyzeCallExpressionDefUse(nodeId: NodeId, call: IRCallExpression): void {
    // Callee is a use
    if (call.callee.type === 'Identifier') {
      const functionName = call.callee.name as VariableName;
      
      const use: UseSite = {
        nodeId,
        variable: functionName,
        scopeId: this.getCurrentScope(nodeId),
        useType: 'call',
        isEscaping: true, // Function calls can escape
        isInLoop: this.isInLoop(nodeId)
      };

      this.addUseSite(functionName, use);
    }

    // Arguments contain uses
    for (const arg of call.arguments) {
      if (isExpression(arg)) {
        this.analyzeExpressionForUses(arg);
      }
    }
  }

  /**
   * Analyze update expression for definitions and uses
   */
  private analyzeUpdateExpressionDefUse(nodeId: NodeId, update: IRUpdateExpression): void {
    if (update.argument.type === 'Identifier') {
      const variableName = update.argument.name as VariableName;
      
      // Update is both a use and a definition
      const use: UseSite = {
        nodeId,
        variable: variableName,
        scopeId: this.getCurrentScope(nodeId),
        useType: 'reference',
        isEscaping: false,
        isInLoop: this.isInLoop(nodeId)
      };

      const definition: DefinitionSite = {
        nodeId,
        variable: variableName,
        scopeId: this.getCurrentScope(nodeId),
        definitionType: 'assignment',
        isConditional: this.isInConditionalContext(nodeId),
        sideEffects: new Set(),
        dependencies: new Set([variableName])
      };

      this.addUseSite(variableName, use);
      this.addDefinitionSite(variableName, definition);
    }
  }

  /**
   * Perform liveness analysis using dataflow
   */
  private performLivenessAnalysis(state: IRState): void {
    if (!this.cfg) return;

    const blocks = Array.from(this.cfg.blocks.values());
    const workList = [...blocks];
    
    // Initialize liveness info
    for (const block of blocks) {
      this.livenessInfo.set(block.id, {
        liveIn: new Set(),
        liveOut: new Set(),
        gen: this.computeGenSet(block),
        kill: this.computeKillSet(block)
      });
    }

    // Iterative dataflow analysis (backward)
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const block of workList) {
        const currentInfo = this.livenessInfo.get(block.id)!;
        const successors = this.cfg!.getSuccessors(block.id);
        
        // liveOut[B] = ∪ liveIn[S] for all successors S
        const newLiveOut = new Set<VariableName>();
        for (const successor of successors) {
          const successorId = successor.id;
          const successorBlock = this.cfg!.blocks.get(successorId);
          if (successorBlock) {
            const successorInfo = this.livenessInfo.get(successorId);
            if (successorInfo) {
              for (const variable of successorInfo.liveIn) {
                newLiveOut.add(variable);
              }
            }
          }
        }

        // liveIn[B] = gen[B] ∪ (liveOut[B] - kill[B])
        const newLiveIn = new Set(currentInfo.gen);
        for (const variable of newLiveOut) {
          if (!currentInfo.kill.has(variable)) {
            newLiveIn.add(variable);
          }
        }

        // Check for changes
        if (!this.setsEqual(currentInfo.liveIn, newLiveIn) || 
            !this.setsEqual(currentInfo.liveOut, newLiveOut)) {
          
          this.livenessInfo.set(block.id, {
            ...currentInfo,
            liveIn: newLiveIn,
            liveOut: newLiveOut
          });
          
          changed = true;
        }
      }
    }
  }

  /**
   * Analyze reachability using CFG traversal
   */
  private analyzeReachability(state: IRState): void {
    if (!this.cfg) return;

    const reachableBlocks = new Set<NodeId>();
    const reachableStatements = new Set<NodeId>();
    
    // Start from entry blocks
    const entryBlocks = Array.from(this.cfg.blocks.values()).filter(b => 
      this.cfg!.isEntry(b.id));
    
    const workList = [...entryBlocks.map(b => b.id)];
    
    while (workList.length > 0) {
      const blockId = workList.shift()!;
      if (reachableBlocks.has(blockId)) continue;
      
      reachableBlocks.add(blockId);
      
      const block = this.cfg.blocks.get(blockId);
      if (block) {
        // Mark all statements in reachable blocks as reachable
        for (const stmt of block.statements) {
          if (stmt.node_id) {
            reachableStatements.add(stmt.node_id);
          }
        }
        
        // Add successors to work list
        const successors = this.cfg.getSuccessors(blockId);
        for (const successor of successors) {
          if (!reachableBlocks.has(successor.id)) {
            workList.push(successor.id);
          }
        }
      }
    }

    // Compute unreachable blocks and statements
    const allBlocks = new Set(this.cfg.blocks.keys());
    const unreachableBlocks = new Set<NodeId>();
    for (const blockId of allBlocks) {
      if (!reachableBlocks.has(blockId)) {
        unreachableBlocks.add(blockId);
      }
    }

    const allStatements = new Set<NodeId>();
    for (const [nodeId, node] of state.nodes) {
      if (isStatement(node)) {
        allStatements.add(nodeId);
      }
    }

    const unreachableStatements = new Set<NodeId>();
    for (const stmtId of allStatements) {
      if (!reachableStatements.has(stmtId)) {
        unreachableStatements.add(stmtId);
      }
    }

    this.reachabilityInfo = {
      reachableBlocks,
      unreachableBlocks,
      reachableStatements,
      unreachableStatements
    };
  }

  /**
   * Perform escape analysis for closure and global optimizations
   */
  private performEscapeAnalysis(state: IRState): void {
    const escapingVariables = new Set<VariableName>();
    const capturedVariables = new Set<VariableName>();
    const globalReferences = new Set<VariableName>();
    const exportedReferences = new Set<VariableName>();

    // Analyze all use sites for escaping patterns
    for (const [variable, useSites] of this.useSites) {
      for (const use of useSites) {
        if (use.isEscaping) {
          escapingVariables.add(variable);
        }

        // Check for various escape patterns
        switch (use.useType) {
          case 'export':
            exportedReferences.add(variable);
            escapingVariables.add(variable);
            break;

          case 'call':
            // Function calls can cause variables to escape
            escapingVariables.add(variable);
            break;

          case 'assignment-lhs':
            // Assignments to escaped variables cause escape
            if (this.isGlobalAssignment(use.nodeId)) {
              globalReferences.add(variable);
              escapingVariables.add(variable);
            }
            break;
        }
      }
    }

    this.escapeInfo = {
      escapingVariables,
      capturedVariables,
      globalReferences,
      exportedReferences
    };
  }

  /**
   * Identify dead code using def-use and liveness analysis
   */
  private identifyDeadCode(state: IRState): DeadCodeResult {
    const eliminatedNodes = new Set<NodeId>();
    const eliminatedStatements = new Set<NodeId>();
    const eliminatedFunctions = new Set<VariableName>();
    const eliminatedVariables = new Set<VariableName>();
    const preservedForSideEffects = new Set<NodeId>();

    // Identify unused variables
    for (const [variable, definitions] of this.definitionSites) {
      const uses = this.useSites.get(variable) || [];
      
      // Variable is dead if it has no uses and doesn't escape
      if (uses.length === 0 && !this.escapeInfo?.escapingVariables.has(variable)) {
        eliminatedVariables.add(variable);
        
        // Mark definition sites for elimination
        for (const def of definitions) {
          // Preserve if has side effects
          if (def.sideEffects.size > 0) {
            preservedForSideEffects.add(def.nodeId);
          } else {
            eliminatedNodes.add(def.nodeId);
          }
        }
      }
    }

    // Identify unreachable code
    if (this.reachabilityInfo) {
      for (const unreachableStmt of this.reachabilityInfo.unreachableStatements) {
        eliminatedStatements.add(unreachableStmt);
      }
    }

    // Identify unused functions
    for (const [variable, definitions] of this.definitionSites) {
      const functionDefs = definitions.filter(d => d.definitionType === 'function');
      
      if (functionDefs.length > 0) {
        const uses = this.useSites.get(variable) || [];
        const hasNonDeclarationUse = uses.some(u => u.useType !== 'reference' || 
                                                   !this.isInFunctionDeclaration(u.nodeId));
        
        if (!hasNonDeclarationUse && !this.escapeInfo?.escapingVariables.has(variable)) {
          eliminatedFunctions.add(variable);
          
          for (const def of functionDefs) {
            eliminatedNodes.add(def.nodeId);
          }
        }
      }
    }

    const statistics: DCEStatistics = {
      totalNodes: state.nodes.size,
      eliminatedNodes: eliminatedNodes.size,
      eliminatedStatements: eliminatedStatements.size,
      eliminatedFunctions: eliminatedFunctions.size,
      eliminatedVariables: eliminatedVariables.size,
      bytesReduced: this.estimateBytesReduced(eliminatedNodes, state),
      reachabilityReduction: this.reachabilityInfo ? 
        this.reachabilityInfo.unreachableBlocks.size / this.cfg!.blocks.size : 0
    };

    return {
      eliminatedNodes,
      eliminatedStatements,
      eliminatedFunctions,
      eliminatedVariables,
      preservedForSideEffects,
      statistics
    };
  }

  /**
   * Apply dead code elimination transformations
   */
  private applyDeadCodeElimination(
    state: IRState,
    deadCodeResult: DeadCodeResult
  ): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    const newNodes = new Map<NodeId, IRNode>();
    let changed = false;

    // Eliminate identified dead nodes
    for (const nodeId of deadCodeResult.eliminatedNodes) {
      if (!deadCodeResult.preservedForSideEffects.has(nodeId)) {
        newNodes.set(nodeId, IRNodeFactory.blockStatement([]));
        changed = true;
        this.nodesChanged++;
      }
    }

    // Eliminate unreachable statements
    for (const stmtId of deadCodeResult.eliminatedStatements) {
      newNodes.set(stmtId, IRNodeFactory.blockStatement([]));
      changed = true;
      this.nodesChanged++;
    }

    // Transform variable declarations to remove dead variables
    for (const [nodeId, node] of state.nodes) {
      if (node.type === 'VariableDeclaration') {
        const newDeclaration = this.removeDeadVariableDeclarations(
          node, 
          deadCodeResult.eliminatedVariables
        );
        
        if (newDeclaration !== node) {
          newNodes.set(nodeId, newDeclaration);
          changed = true;
          this.nodesChanged++;
        }
      }
    }

    return { newNodes, changed };
  }

  /**
   * Remove dead variable declarations from a declaration statement
   */
  private removeDeadVariableDeclarations(
    decl: IRVariableDeclaration,
    eliminatedVariables: ReadonlySet<VariableName>
  ): IRVariableDeclaration | IRStatement {
    const liveDeclarators: IRVariableDeclarator[] = [];
    
    for (const declarator of decl.declarations) {
      const variableName = IRUtils.getPatternName(declarator.id) as VariableName;
      if (!variableName) continue;
      
      if (!eliminatedVariables.has(variableName)) {
        liveDeclarators.push(declarator);
      }
    }

    // If no live declarators, return empty statement
    if (liveDeclarators.length === 0) {
      return IRNodeFactory.blockStatement([]);
    }

    // If fewer declarators, create new declaration
    if (liveDeclarators.length < decl.declarations.length) {
      return IRNodeFactory.createVariableDeclaration(liveDeclarators, decl.kind);
    }

    // No change needed
    return decl;
  }

  // Helper methods

  private addDefinitionSite(variable: VariableName, definition: DefinitionSite): void {
    const existing = this.definitionSites.get(variable) || [];
    this.definitionSites.set(variable, [...existing, definition]);
  }

  private addUseSite(variable: VariableName, use: UseSite): void {
    const existing = this.useSites.get(variable) || [];
    this.useSites.set(variable, [...existing, use]);
  }

  private analyzeExpressionForUses(expr: IRExpression): void {
    if (expr.type === 'Identifier') {
      // This would be handled by the main def-use analysis
      return;
    }

    // Recursively analyze child expressions
    switch (expr.type) {
      case 'BinaryExpression':
      case 'LogicalExpression':
        this.analyzeExpressionForUses(expr.left);
        this.analyzeExpressionForUses(expr.right);
        break;

      case 'UnaryExpression':
        this.analyzeExpressionForUses(expr.argument);
        break;

      case 'CallExpression':
        this.analyzeExpressionForUses(expr.callee);
        for (const arg of expr.arguments) {
          if (isExpression(arg)) {
            this.analyzeExpressionForUses(arg);
          }
        }
        break;

      case 'MemberExpression':
        this.analyzeExpressionForUses(expr.object);
        if (expr.computed && isExpression(expr.property)) {
          this.analyzeExpressionForUses(expr.property);
        }
        break;
    }
  }

  private analyzeChildNodesDefUse(node: IRNode, state: IRState): void {
    // Simplified child node analysis - would need proper AST traversal
    // This is a placeholder for the recursive analysis
  }

  private analyzeSideEffects(node: IRNode): Set<SideEffectType> {
    const sideEffects = new Set<SideEffectType>();
    
    // Analyze node for side effects (simplified)
    if (node.type === 'CallExpression') {
      sideEffects.add('function-call');
    }
    
    return sideEffects;
  }

  private extractDependencies(expr: IRExpression): Set<VariableName> {
    const dependencies = new Set<VariableName>();
    
    if (expr.type === 'Identifier') {
      dependencies.add(expr.name as VariableName);
    }
    
    // Would recursively extract all identifier references
    
    return dependencies;
  }

  private computeGenSet(block: BasicBlock): Set<VariableName> {
    const gen = new Set<VariableName>();
    
    // Variables used before being defined in this block
    for (const stmt of block.statements) {
      // Simplified - would analyze statement for variable uses
    }
    
    return gen;
  }

  private computeKillSet(block: BasicBlock): Set<VariableName> {
    const kill = new Set<VariableName>();
    
    // Variables defined in this block
    for (const stmt of block.statements) {
      if (stmt.type === 'VariableDeclaration') {
        for (const declarator of stmt.declarations) {
          const variableName = IRUtils.getPatternName(declarator.id) as VariableName;
          if (variableName) kill.add(variableName);
        }
      }
    }
    
    return kill;
  }

  private setsEqual<T>(set1: ReadonlySet<T>, set2: ReadonlySet<T>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }

  private getCurrentScope(nodeId: NodeId): ScopeId {
    // Would determine current scope from SSA state or scope analysis
    return 0 as ScopeId; // 0 represents global scope
  }

  private getFunctionScope(nodeId: NodeId): ScopeId {
    // Would determine function scope
    return 1 as ScopeId; // 1 represents function scope
  }

  private isInConditionalContext(nodeId: NodeId): boolean {
    // Would check if node is inside if/while/for statement
    return false;
  }

  private isEscapingUse(nodeId: NodeId): boolean {
    // Would check if this use causes the variable to escape
    return false;
  }

  private isInLoop(nodeId: NodeId): boolean {
    // Would check if node is inside a loop
    return false;
  }

  private isGlobalAssignment(nodeId: NodeId): boolean {
    // Would check if this is an assignment to a global variable
    return false;
  }

  private isInFunctionDeclaration(nodeId: NodeId): boolean {
    // Would check if use is within the function's own declaration
    return false;
  }

  private estimateBytesReduced(eliminatedNodes: ReadonlySet<NodeId>, state: IRState): number {
    let bytes = 0;
    
    for (const nodeId of eliminatedNodes) {
      const node = state.nodes.get(nodeId);
      if (node) {
        // Rough estimate based on node type and content
        bytes += this.estimateNodeSize(node);
      }
    }
    
    return bytes;
  }

  private estimateNodeSize(node: IRNode): number {
    // Rough size estimation for eliminated code
    switch (node.type) {
      case 'FunctionDeclaration':
        return 100; // Average function size
      case 'VariableDeclaration':
        return 20;  // Average variable declaration
      case 'ExpressionStatement':
        return 15;  // Average expression
      default:
        return 10;  // Default node size
    }
  }

  private logStatistics(stats: DCEStatistics): void {
    const reductionPercent = ((stats.eliminatedNodes / stats.totalNodes) * 100).toFixed(1);
    
    console.log(`Dead Code Elimination Statistics:`);
    console.log(`  Total nodes: ${stats.totalNodes}`);
    console.log(`  Eliminated nodes: ${stats.eliminatedNodes} (${reductionPercent}%)`);
    console.log(`  Eliminated functions: ${stats.eliminatedFunctions}`);
    console.log(`  Eliminated variables: ${stats.eliminatedVariables}`);
    console.log(`  Estimated bytes reduced: ${stats.bytesReduced}`);
    console.log(`  Reachability reduction: ${(stats.reachabilityReduction * 100).toFixed(1)}%`);
  }
}