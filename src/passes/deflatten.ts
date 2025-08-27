/**
 * @fileoverview Control Flow Deflattening Pass
 * 
 * This pass reconstructs natural control flow from flattened control flow
 * patterns commonly used by obfuscators. It detects dispatcher-based patterns,
 * reconstructs state machines, and restores natural loop structures using
 * dominance analysis and region-based reconstruction.
 */

import type {
  IRNode,
  IRExpression,
  IRStatement,
  IRBlockStatement,
  IRSwitchStatement,
  IRSwitchCase,
  IRWhileStatement,
  IRForStatement,
  IRIfStatement,
  IRIdentifier,
  IRLiteral,
  IRVariableDeclaration,
  IRAssignmentExpression,
  IRUpdateExpression,
  VariableName,
  NodeId
} from '../ir/nodes.js';
import { IRNodeFactory, isExpression, isStatement } from '../ir/nodes.js';
import { BasePass, type IRState, type PassResult, PassUtils } from './Pass.js';
import type { CFG, CFGNode } from '../ir/cfg.js';

/**
 * Dispatcher pattern information
 */
export interface DispatcherPattern {
  readonly type: DispatcherType;
  readonly dispatcherVariable: VariableName;
  readonly switchStatement: IRSwitchStatement;
  readonly stateMapping: ReadonlyMap<number, CFGNode>;
  readonly entryState: number;
  readonly exitStates: readonly number[];
  readonly confidence: number;
}

/**
 * Types of control flow flattening patterns
 */
export type DispatcherType = 
  | 'switch-dispatcher'      // Switch-based state machine
  | 'while-switch'          // While loop with switch dispatcher
  | 'do-while-switch'       // Do-while with switch dispatcher
  | 'computed-goto'         // Computed goto simulation
  | 'indirect-jump'         // Indirect jump table
  | 'state-machine';        // Generic state machine

/**
 * Control flow region representation
 */
export interface ControlFlowRegion {
  readonly id: string;
  readonly type: RegionType;
  readonly entryBlock: CFGNode;
  readonly exitBlocks: readonly CFGNode[];
  readonly containedBlocks: readonly CFGNode[];
  readonly dominanceInfo: DominanceInfo;
  readonly naturalLoops: readonly NaturalLoop[];
}

/**
 * Types of control flow regions
 */
export type RegionType = 
  | 'sequential'     // Linear sequence of blocks
  | 'conditional'    // If-then-else structure
  | 'loop'          // Natural loop
  | 'switch'        // Multi-way branch
  | 'complex';      // Irreducible control flow

/**
 * Dominance information for control flow analysis
 */
export interface DominanceInfo {
  readonly dominators: ReadonlyMap<CFGNode, ReadonlySet<CFGNode>>;
  readonly immediateDominators: ReadonlyMap<CFGNode, CFGNode | null>;
  readonly dominanceFrontier: ReadonlyMap<CFGNode, ReadonlySet<CFGNode>>;
  readonly postDominators: ReadonlyMap<CFGNode, ReadonlySet<CFGNode>>;
}

/**
 * Natural loop information
 */
export interface NaturalLoop {
  readonly header: CFGNode;
  readonly backEdges: readonly [CFGNode, CFGNode][];
  readonly loopBlocks: ReadonlySet<CFGNode>;
  readonly exitBlocks: ReadonlySet<CFGNode>;
  readonly isInnermost: boolean;
  readonly nestingLevel: number;
}

/**
 * State transition information
 */
export interface StateTransition {
  readonly fromState: number;
  readonly toState: number;
  readonly condition?: IRExpression;
  readonly isConditional: boolean;
  readonly block: CFGNode;
}

/**
 * Reconstructed control flow structure  
 */
export interface ReconstructedFlow {
  readonly originalPattern: DispatcherPattern;
  readonly reconstructedRegions: readonly ControlFlowRegion[];
  readonly eliminatedNodes: ReadonlySet<NodeId>;
  readonly newControlFlow: IRStatement;
  readonly complexity: number;
}

/**
 * Control Flow Deflattening Pass
 * 
 * Detects and reconstructs flattened control flow patterns:
 * - Switch-based dispatchers with state variables
 * - While loops containing switch statements  
 * - Computed goto patterns and indirect jumps
 * - State machine reconstruction from case labels
 * - Natural loop recovery using dominance analysis
 */
export class ControlFlowDeflatteningPass extends BasePass<IRState> {
  readonly name = 'control-flow-deflattening';
  readonly description = 'Reconstruct natural control flow from flattened patterns';

  private cfg: CFG | null = null;
  private dominanceInfo: DominanceInfo | null = null;
  private dispatcherPatterns: Map<NodeId, DispatcherPattern> = new Map();
  private reconstructedFlows: Map<NodeId, ReconstructedFlow> = new Map();

  protected executePass(state: IRState): { state: IRState; changed: boolean } {
    if (!state.cfg) {
      this.warnings.push('CFG not available, skipping control flow deflattening');
      return { state, changed: false };
    }

    this.cfg = state.cfg;
    this.dispatcherPatterns.clear();
    this.reconstructedFlows.clear();

    // Phase 1: Compute dominance information
    this.dominanceInfo = this.computeDominanceInfo(state.cfg);

    // Phase 2: Identify dispatcher patterns
    const dispatchers = this.identifyDispatcherPatterns(state);

    // Phase 3: Analyze state transitions  
    const stateTransitions = this.analyzeStateTransitions(dispatchers);

    // Phase 4: Reconstruct control flow regions
    const reconstructedFlows = this.reconstructControlFlowRegions(dispatchers, stateTransitions);

    // Phase 5: Apply deflattening transformations
    const { newNodes, changed } = this.applyDeflatteningTransformations(state, reconstructedFlows);

    if (changed) {
      const newState = PassUtils.updateNodes(state, newNodes);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Compute dominance information for CFG
   */
  private computeDominanceInfo(cfg: CFG): DominanceInfo {
    const blocks = Array.from(cfg.nodes.values());
    const dominators = new Map<CFGNode, Set<CFGNode>>();
    const immediateDominators = new Map<CFGNode, CFGNode | null>();
    
    // Initialize dominators - entry block dominates only itself
    const entryBlock = cfg.entry;
    if (!entryBlock) {
      throw new Error('CFG has no entry block');
    }

    dominators.set(entryBlock, new Set([entryBlock]));
    for (const block of blocks) {
      if (block !== entryBlock) {
        dominators.set(block, new Set(blocks)); // Initially all blocks dominate
      }
    }

    // Iterative dominance computation
    let changed = true;
    while (changed) {
      changed = false;
      for (const block of blocks) {
        if (block === entryBlock) continue;

        const predecessors = block.predecessors;
        if (predecessors.length === 0) continue;

        // Intersection of predecessor dominators
        let newDominators = new Set(dominators.get(predecessors[0]) || []);
        for (let i = 1; i < predecessors.length; i++) {
          const predBlock = predecessors[i];
          const predDominators = dominators.get(predBlock) || new Set();
          newDominators = new Set([...newDominators].filter(d => predDominators.has(d)));
        }
        
        // Add self
        newDominators.add(block);

        const currentDominators = dominators.get(block)!;
        if (newDominators.size !== currentDominators.size || 
            ![...newDominators].every(d => currentDominators.has(d))) {
          dominators.set(block, newDominators);
          changed = true;
        }
      }
    }

    // Compute immediate dominators
    for (const block of blocks) {
      const blockDominators = dominators.get(block)!;
      const strictDominators = new Set(blockDominators);
      strictDominators.delete(block);

      let immediatelyDominated = [...strictDominators];
      for (const dominator of strictDominators) {
        immediatelyDominated = immediatelyDominated.filter(d => 
          d === dominator || !dominators.get(d)!.has(dominator));
      }

      immediateDominators.set(block, immediatelyDominated[0] || null);
    }

    // Compute dominance frontier and post-dominators (simplified)
    const dominanceFrontier = new Map<CFGNode, Set<CFGNode>>();
    const postDominators = new Map<CFGNode, Set<CFGNode>>();

    for (const block of blocks) {
      dominanceFrontier.set(block, new Set());
      postDominators.set(block, new Set(blocks));
    }

    return {
      dominators: new Map([...dominators].map(([k, v]) => [k, v as ReadonlySet<CFGNode>])),
      immediateDominators,
      dominanceFrontier: new Map([...dominanceFrontier].map(([k, v]) => [k, v as ReadonlySet<CFGNode>])),
      postDominators: new Map([...postDominators].map(([k, v]) => [k, v as ReadonlySet<CFGNode>]))
    };
  }

  /**
   * Identify dispatcher-based control flow patterns
   */
  private identifyDispatcherPatterns(state: IRState): DispatcherPattern[] {
    const patterns: DispatcherPattern[] = [];

    for (const [nodeId, node] of state.nodes) {
      // Look for while/for loops containing switch statements
      if (node.type === 'WhileStatement') {
        const pattern = this.analyzeWhileSwitchPattern(node, state);
        if (pattern) {
          patterns.push(pattern);
          this.dispatcherPatterns.set(nodeId, pattern);
          this.nodesVisited++;
        }
      }
      
      // Look for standalone switch statements used as dispatchers
      else if (node.type === 'SwitchStatement') {
        const pattern = this.analyzeSwitchDispatcherPattern(node, state);
        if (pattern) {
          patterns.push(pattern);
          this.dispatcherPatterns.set(nodeId, pattern);
          this.nodesVisited++;
        }
      }
    }

    return patterns;
  }

  /**
   * Analyze while-loop containing switch statement pattern
   */
  private analyzeWhileSwitchPattern(
    whileLoop: IRWhileStatement, 
    state: IRState
  ): DispatcherPattern | null {
    // Check if body contains a switch statement
    if (whileLoop.body.type !== 'BlockStatement') return null;
    
    const switchStmt = this.findSwitchInBlock(whileLoop.body);
    if (!switchStmt) return null;

    // Analyze the switch discriminant to find state variable
    const stateVar = this.extractStateVariable(switchStmt.discriminant);
    if (!stateVar) return null;

    // Check while condition uses the same state variable  
    const conditionUsesStateVar = this.expressionUsesVariable(whileLoop.test, stateVar);
    if (!conditionUsesStateVar) return null;

    // Analyze switch cases for state mapping
    const stateMapping = this.buildStateMapping(switchStmt, state);
    if (stateMapping.size < 2) return null; // Need at least 2 states

    return {
      type: 'while-switch',
      dispatcherVariable: stateVar,
      switchStatement: switchStmt,
      stateMapping,
      entryState: this.findEntryState(stateMapping),
      exitStates: this.findExitStates(stateMapping, whileLoop),
      confidence: this.calculatePatternConfidence('while-switch', stateMapping.size)
    };
  }

  /**
   * Analyze standalone switch statement dispatcher pattern
   */
  private analyzeSwitchDispatcherPattern(
    switchStmt: IRSwitchStatement,
    state: IRState
  ): DispatcherPattern | null {
    const stateVar = this.extractStateVariable(switchStmt.discriminant);
    if (!stateVar) return null;

    const stateMapping = this.buildStateMapping(switchStmt, state);
    if (stateMapping.size < 2) return null;

    // Check if this switch is inside a larger control structure
    const enclosingLoop = this.findEnclosingLoop(switchStmt, state);
    const dispatcherType: DispatcherType = enclosingLoop ? 'switch-dispatcher' : 'state-machine';

    return {
      type: dispatcherType,
      dispatcherVariable: stateVar,
      switchStatement: switchStmt,
      stateMapping,
      entryState: this.findEntryState(stateMapping),
      exitStates: this.findExitStates(stateMapping, enclosingLoop),
      confidence: this.calculatePatternConfidence(dispatcherType, stateMapping.size)
    };
  }

  /**
   * Analyze state transitions between dispatcher cases
   */
  private analyzeStateTransitions(dispatchers: DispatcherPattern[]): Map<DispatcherPattern, StateTransition[]> {
    const transitionMap = new Map<DispatcherPattern, StateTransition[]>();

    for (const dispatcher of dispatchers) {
      const transitions: StateTransition[] = [];

      for (const [state, block] of dispatcher.stateMapping) {
        // Analyze how this state transitions to others
        const stateTransitions = this.analyzeBlockStateTransitions(
          block, 
          dispatcher.dispatcherVariable,
          dispatcher.stateMapping
        );
        transitions.push(...stateTransitions);
      }

      transitionMap.set(dispatcher, transitions);
    }

    return transitionMap;
  }

  /**
   * Analyze state transitions within a basic block
   */
  private analyzeBlockStateTransitions(
    block: CFGNode,
    stateVariable: VariableName,
    stateMapping: ReadonlyMap<number, CFGNode>
  ): StateTransition[] {
    const transitions: StateTransition[] = [];

    // Look for assignments to the state variable
    for (const stmt of block.instructions) {
      if (stmt.type === 'ExpressionStatement' && 
          stmt.expression.type === 'AssignmentExpression') {
        
        const assignment = stmt.expression;
        if (assignment.left.type === 'Identifier' && 
            assignment.left.name === stateVariable &&
            assignment.right.type === 'Literal' &&
            typeof assignment.right.value === 'number') {
          
          const targetState = assignment.right.value;
          if (stateMapping.has(targetState)) {
            transitions.push({
              fromState: this.getBlockState(block, stateMapping),
              toState: targetState,
              isConditional: false,
              block
            });
          }
        }
      }
      
      // Look for conditional assignments
      else if (stmt.type === 'IfStatement' && stmt.consequent.type === 'BlockStatement') {
        const conditionalTransitions = this.findConditionalStateTransitions(
          stmt, stateVariable, stateMapping, block
        );
        transitions.push(...conditionalTransitions);
      }
    }

    return transitions;
  }

  /**
   * Reconstruct control flow regions from dispatcher patterns
   */
  private reconstructControlFlowRegions(
    dispatchers: DispatcherPattern[],
    stateTransitions: Map<DispatcherPattern, StateTransition[]>
  ): ReconstructedFlow[] {
    const reconstructedFlows: ReconstructedFlow[] = [];

    for (const dispatcher of dispatchers) {
      const transitions = stateTransitions.get(dispatcher) || [];
      
      // Build control flow graph of states
      const stateGraph = this.buildStateGraph(dispatcher, transitions);
      
      // Identify natural loop structures
      const loops = this.identifyNaturalLoops(stateGraph, dispatcher);
      
      // Reconstruct regions using dominance analysis
      const regions = this.reconstructRegions(dispatcher, stateGraph, loops);
      
      // Generate new control flow structure
      const newControlFlow = this.generateControlFlow(regions, dispatcher);
      
      reconstructedFlows.push({
        originalPattern: dispatcher,
        reconstructedRegions: regions,
        eliminatedNodes: this.identifyEliminatedNodes(dispatcher),
        newControlFlow,
        complexity: this.calculateReconstructionComplexity(regions)
      });
    }

    return reconstructedFlows;
  }

  /**
   * Apply deflattening transformations to the IR
   */
  private applyDeflatteningTransformations(
    state: IRState,
    reconstructedFlows: ReconstructedFlow[]
  ): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    const newNodes = new Map<NodeId, IRNode>();
    let changed = false;

    for (const flow of reconstructedFlows) {
      if (flow.complexity > 50) {
        this.warnings.push(`Skipping complex control flow reconstruction (complexity: ${flow.complexity})`);
        continue;
      }

      // Replace the original dispatcher pattern with reconstructed control flow
      const dispatcherNodeId = this.findDispatcherNodeId(flow.originalPattern, state);
      if (dispatcherNodeId) {
        newNodes.set(dispatcherNodeId, flow.newControlFlow);
        changed = true;
        this.nodesChanged++;

        // Mark eliminated nodes for removal
        for (const eliminatedNodeId of flow.eliminatedNodes) {
          newNodes.set(eliminatedNodeId, IRNodeFactory.blockStatement([]));
        }
      }
    }

    return { newNodes, changed };
  }

  // Helper methods

  private findSwitchInBlock(block: IRBlockStatement): IRSwitchStatement | null {
    for (const stmt of block.body) {
      if (stmt.type === 'SwitchStatement') {
        return stmt;
      }
      // Could recursively check nested blocks
    }
    return null;
  }

  private extractStateVariable(discriminant: IRExpression): VariableName | null {
    if (discriminant.type === 'Identifier') {
      return discriminant.name as VariableName;
    }
    // Could handle more complex expressions like member access
    return null;
  }

  private expressionUsesVariable(expr: IRExpression, variable: VariableName): boolean {
    if (expr.type === 'Identifier') {
      return expr.name === variable;
    }
    
    switch (expr.type) {
      case 'BinaryExpression':
      case 'LogicalExpression':
        return this.expressionUsesVariable(expr.left, variable) ||
               this.expressionUsesVariable(expr.right, variable);
      case 'UnaryExpression':
        return this.expressionUsesVariable(expr.argument, variable);
      default:
        return false;
    }
  }

  private buildStateMapping(
    switchStmt: IRSwitchStatement, 
    state: IRState
  ): Map<number, CFGNode> {
    const stateMapping = new Map<number, CFGNode>();

    for (const switchCase of switchStmt.cases) {
      if (switchCase.test?.type === 'Literal' && 
          typeof switchCase.test.value === 'number') {
        
        const stateValue = switchCase.test.value;
        // Create basic block from case consequent
        const block = this.createCFGNodeFromStatements(switchCase.consequent);
        stateMapping.set(stateValue, block);
      }
    }

    return stateMapping;
  }

  private createCFGNodeFromStatements(statements: readonly IRStatement[]): CFGNode {
    // This is a simplified CFGNode creation - in a real implementation,
    // this should be done through the CFGBuilder
    return {
      id: `block_${Math.random().toString(36).substr(2, 9)}` as NodeId,
      label: undefined,
      instructions: [...statements],
      statements: [...statements], // Add missing statements property
      predecessors: [],
      successors: [],
      edges_in: [],
      edges_out: [],
      dominates: new Set(),
      dominated_by: new Set(),
      immediate_dominator: undefined,
      dominance_frontier: new Set(),
      post_dominates: new Set(),
      post_dominated_by: new Set(),
      immediate_post_dominator: undefined,
      post_dominance_frontier: new Set(),
      loop_depth: 0,
      loop_header: undefined,
      back_edges: []
    };
  }

  private findEntryState(stateMapping: ReadonlyMap<number, CFGNode>): number {
    // Simple heuristic: smallest state value is often the entry
    const states = Array.from(stateMapping.keys()).sort((a, b) => a - b);
    return states[0] || 0;
  }

  private findExitStates(
    stateMapping: ReadonlyMap<number, CFGNode>, 
    enclosingStructure?: IRNode
  ): number[] {
    const exitStates: number[] = [];

    // Look for states that break out of the control structure
    for (const [state, block] of stateMapping) {
      const hasBreak = block.instructions.some(stmt => stmt.type === 'BreakStatement');
      const hasReturn = block.instructions.some(stmt => stmt.type === 'ReturnStatement');
      
      if (hasBreak || hasReturn) {
        exitStates.push(state);
      }
    }

    return exitStates;
  }

  private calculatePatternConfidence(type: DispatcherType, stateCount: number): number {
    let baseConfidence = 0.6;
    
    switch (type) {
      case 'while-switch':
        baseConfidence = 0.8;
        break;
      case 'switch-dispatcher':
        baseConfidence = 0.75;
        break;
      case 'state-machine':
        baseConfidence = 0.7;
        break;
    }

    // More states usually indicate stronger pattern
    const stateBonus = Math.min(0.2, (stateCount - 2) * 0.05);
    return Math.min(0.95, baseConfidence + stateBonus);
  }

  private findEnclosingLoop(switchStmt: IRSwitchStatement, state: IRState): IRNode | null {
    // Simplified - would need proper parent tracking in real implementation
    return null;
  }

  private getBlockState(block: CFGNode, stateMapping: ReadonlyMap<number, CFGNode>): number {
    for (const [state, mappedBlock] of stateMapping) {
      if (mappedBlock.id === block.id) {
        return state;
      }
    }
    return -1;
  }

  private findConditionalStateTransitions(
    ifStmt: IRIfStatement,
    stateVariable: VariableName,
    stateMapping: ReadonlyMap<number, CFGNode>,
    currentBlock: CFGNode
  ): StateTransition[] {
    const transitions: StateTransition[] = [];
    
    // Look for state assignments in consequent
    if (ifStmt.consequent.type === 'BlockStatement') {
      for (const stmt of ifStmt.consequent.body) {
        if (stmt.type === 'ExpressionStatement' && 
            stmt.expression.type === 'AssignmentExpression') {
          const assignment = stmt.expression;
          if (assignment.left.type === 'Identifier' && 
              assignment.left.name === stateVariable &&
              assignment.right.type === 'Literal' &&
              typeof assignment.right.value === 'number') {
            
            transitions.push({
              fromState: this.getBlockState(currentBlock, stateMapping),
              toState: assignment.right.value,
              condition: ifStmt.test,
              isConditional: true,
              block: currentBlock
            });
          }
        }
      }
    }

    return transitions;
  }

  private buildStateGraph(
    dispatcher: DispatcherPattern,
    transitions: StateTransition[]
  ): Map<number, Set<number>> {
    const graph = new Map<number, Set<number>>();
    
    // Initialize nodes
    for (const state of dispatcher.stateMapping.keys()) {
      graph.set(state, new Set());
    }
    
    // Add edges
    for (const transition of transitions) {
      const successors = graph.get(transition.fromState);
      if (successors) {
        successors.add(transition.toState);
      }
    }
    
    return graph;
  }

  private identifyNaturalLoops(
    stateGraph: Map<number, Set<number>>,
    dispatcher: DispatcherPattern
  ): NaturalLoop[] {
    // Simplified natural loop detection
    const loops: NaturalLoop[] = [];
    
    // Look for back edges (edges to lower-numbered states)
    for (const [fromState, successors] of stateGraph) {
      for (const toState of successors) {
        if (toState <= fromState) {
          // Found potential back edge
          const loopBlocks = new Set<CFGNode>();
          const headerBlock = dispatcher.stateMapping.get(toState);
          
          if (headerBlock) {
            loops.push({
              header: headerBlock,
              backEdges: [[
                dispatcher.stateMapping.get(fromState)!,
                dispatcher.stateMapping.get(toState)!
              ]],
              loopBlocks,
              exitBlocks: new Set(),
              isInnermost: true,
              nestingLevel: 1
            });
          }
        }
      }
    }
    
    return loops;
  }

  private reconstructRegions(
    dispatcher: DispatcherPattern,
    stateGraph: Map<number, Set<number>>,
    loops: NaturalLoop[]
  ): ControlFlowRegion[] {
    const regions: ControlFlowRegion[] = [];
    
    // Create sequential regions for simple state chains
    const visited = new Set<number>();
    
    for (const [state, successors] of stateGraph) {
      if (visited.has(state)) continue;
      
      // Look for sequential chains
      const chain = this.findSequentialChain(state, stateGraph, visited);
      if (chain.length > 1) {
        const entryBlock = dispatcher.stateMapping.get(chain[0])!;
        const exitBlocks = [dispatcher.stateMapping.get(chain[chain.length - 1])!];
        const containedBlocks = chain.map(s => dispatcher.stateMapping.get(s)!);
        
        regions.push({
          id: `sequential_${chain[0]}_${chain[chain.length - 1]}`,
          type: 'sequential',
          entryBlock,
          exitBlocks,
          containedBlocks,
          dominanceInfo: this.dominanceInfo!,
          naturalLoops: []
        });
        
        chain.forEach(s => visited.add(s));
      }
    }
    
    return regions;
  }

  private findSequentialChain(
    startState: number,
    stateGraph: Map<number, Set<number>>,
    visited: Set<number>
  ): number[] {
    const chain = [startState];
    let currentState = startState;
    
    while (true) {
      const successors = stateGraph.get(currentState);
      if (!successors || successors.size !== 1) break;
      
      const nextState = [...successors][0];
      if (visited.has(nextState)) break;
      
      // Check if nextState has only one predecessor (currentState)
      let predecessorCount = 0;
      for (const [state, succs] of stateGraph) {
        if (succs.has(nextState)) {
          predecessorCount++;
        }
      }
      
      if (predecessorCount !== 1) break;
      
      chain.push(nextState);
      currentState = nextState;
    }
    
    return chain;
  }

  private generateControlFlow(
    regions: ControlFlowRegion[],
    dispatcher: DispatcherPattern
  ): IRStatement {
    if (regions.length === 0) {
      return IRNodeFactory.blockStatement([]);
    }
    
    // Generate sequential composition of regions
    const statements: IRStatement[] = [];
    
    for (const region of regions) {
      switch (region.type) {
        case 'sequential':
          // Generate sequential block
          const sequentialStatements = this.generateSequentialRegion(region);
          statements.push(...sequentialStatements);
          break;
          
        case 'conditional':
          // Generate if-then-else structure
          const conditionalStmt = this.generateConditionalRegion(region, dispatcher);
          if (conditionalStmt) {
            statements.push(conditionalStmt);
          }
          break;
          
        case 'loop':
          // Generate while loop
          const loopStmt = this.generateLoopRegion(region, dispatcher);
          if (loopStmt) {
            statements.push(loopStmt);
          }
          break;
          
        case 'switch':
          // Generate natural switch statement
          const switchStmt = this.generateSwitchRegion(region, dispatcher);
          if (switchStmt) {
            statements.push(switchStmt);
          }
          break;
      }
    }
    
    return statements.length === 1 ? statements[0] : IRNodeFactory.blockStatement(statements);
  }

  /**
   * Generate sequential region statements
   */
  private generateSequentialRegion(region: ControlFlowRegion): IRStatement[] {
    const statements: IRStatement[] = [];
    
    for (const block of region.containedBlocks) {
      // Filter out dispatcher-related statements
      const cleanStatements = block.instructions.filter(stmt => 
        !this.isDispatcherStatement(stmt));
      statements.push(...cleanStatements);
    }
    
    return statements;
  }

  /**
   * Generate conditional region (if-then-else)
   */
  private generateConditionalRegion(
    region: ControlFlowRegion, 
    dispatcher: DispatcherPattern
  ): IRIfStatement | null {
    if (region.containedBlocks.length < 2) return null;
    
    // Extract condition from the first block
    const conditionBlock = region.containedBlocks[0];
    const condition = this.extractConditionFromBlock(conditionBlock, dispatcher);
    
    if (!condition) return null;
    
    // Generate consequent and alternate branches
    const consequentBlocks = region.containedBlocks.slice(1, region.containedBlocks.length / 2 + 1);
    const alternateBlocks = region.containedBlocks.slice(region.containedBlocks.length / 2 + 1);
    
    const consequent = this.generateBlockFromCFGNodes(consequentBlocks);
    const alternate = alternateBlocks.length > 0 ? 
      this.generateBlockFromCFGNodes(alternateBlocks) : null;
    
    return IRNodeFactory.ifStatement(condition, consequent, alternate);
  }

  /**
   * Generate loop region (while loop)
   */
  private generateLoopRegion(
    region: ControlFlowRegion, 
    dispatcher: DispatcherPattern
  ): IRWhileStatement | null {
    if (region.naturalLoops.length === 0) return null;
    
    const loop = region.naturalLoops[0];
    
    // Create loop condition - typically checking against exit states
    const condition = this.generateLoopCondition(dispatcher, loop);
    const body = this.generateBlockFromCFGNodes(Array.from(loop.loopBlocks));
    
    return IRNodeFactory.whileStatement(condition, body);
  }

  /**
   * Generate switch region
   */
  private generateSwitchRegion(
    region: ControlFlowRegion, 
    dispatcher: DispatcherPattern
  ): IRSwitchStatement | null {
    // For now, return null - would need to reconstruct natural switch
    // This is complex and would require analyzing the original state mapping
    return null;
  }

  /**
   * Check if statement is related to dispatcher mechanism
   */
  private isDispatcherStatement(stmt: IRStatement): boolean {
    // Check for assignments to dispatcher variable
    if (stmt.type === 'ExpressionStatement' && 
        stmt.expression.type === 'AssignmentExpression') {
      const assignment = stmt.expression;
      if (assignment.left.type === 'Identifier') {
        // This would check against known dispatcher variables
        return assignment.left.name.startsWith('_0x') || // Common obfuscator pattern
               !!assignment.left.name.match(/^[a-zA-Z]$/); // Single letter variables
      }
    }
    
    return false;
  }

  /**
   * Extract condition from a basic block
   */
  private extractConditionFromBlock(
    block: CFGNode, 
    dispatcher: DispatcherPattern
  ): IRExpression | null {
    // Look for if statements or conditional expressions
    for (const stmt of block.instructions) {
      if (stmt.type === 'IfStatement') {
        return stmt.test;
      }
      
      if (stmt.type === 'ExpressionStatement' && 
          stmt.expression.type === 'ConditionalExpression') {
        return stmt.expression.test;
      }
    }
    
    // Default condition for loops
    return IRNodeFactory.binaryExpression(
      '!==',
      IRNodeFactory.identifier(dispatcher.dispatcherVariable),
      IRNodeFactory.literal(-1, 'number')
    );
  }

  /**
   * Generate block statement from basic blocks
   */
  private generateBlockFromCFGNodes(blocks: CFGNode[]): IRBlockStatement {
    const statements: IRStatement[] = [];
    
    for (const block of blocks) {
      const cleanStatements = block.instructions.filter(stmt => 
        !this.isDispatcherStatement(stmt));
      statements.push(...cleanStatements);
    }
    
    return IRNodeFactory.blockStatement(statements);
  }

  /**
   * Generate loop condition
   */
  private generateLoopCondition(
    dispatcher: DispatcherPattern, 
    loop: NaturalLoop
  ): IRExpression {
    // Create condition that continues while not in exit state
    const exitStates = dispatcher.exitStates;
    
    if (exitStates.length === 1) {
      return IRNodeFactory.binaryExpression(
        '!==',
        IRNodeFactory.identifier(dispatcher.dispatcherVariable),
        IRNodeFactory.literal(exitStates[0], 'number')
      );
    } else {
      // Multiple exit states - create compound condition
      let condition = IRNodeFactory.binaryExpression(
        '!==',
        IRNodeFactory.identifier(dispatcher.dispatcherVariable),
        IRNodeFactory.literal(exitStates[0], 'number')
      );
      
      for (let i = 1; i < exitStates.length; i++) {
        const nextCondition = IRNodeFactory.binaryExpression(
          '!==',
          IRNodeFactory.identifier(dispatcher.dispatcherVariable),
          IRNodeFactory.literal(exitStates[i], 'number')
        );
        
        // Chain conditions with logical AND - using binary expression since logical factory doesn't exist
        condition = IRNodeFactory.binaryExpression(
          '&&',
          condition,
          nextCondition
        );
      }
      
      return condition;
    }
  }

  private identifyEliminatedNodes(dispatcher: DispatcherPattern): Set<NodeId> {
    const eliminated = new Set<NodeId>();
    
    // Mark the original switch statement for elimination
    eliminated.add(dispatcher.switchStatement.node_id);
    
    // Mark state variable declarations if they're only used for dispatching
    // This would require more sophisticated analysis in practice
    
    return eliminated;
  }

  private calculateReconstructionComplexity(regions: ControlFlowRegion[]): number {
    let complexity = 0;
    
    for (const region of regions) {
      complexity += region.containedBlocks.length;
      complexity += region.naturalLoops.length * 5; // Loops add complexity
      
      if (region.type === 'complex') {
        complexity += 20; // Irreducible control flow is complex
      }
    }
    
    return complexity;
  }

  private findDispatcherNodeId(pattern: DispatcherPattern, state: IRState): NodeId | null {
    for (const [nodeId, node] of state.nodes) {
      if (node === pattern.switchStatement) {
        return nodeId;
      }
      
      // Look for containing while loop
      if (node.type === 'WhileStatement' && node.body.type === 'BlockStatement') {
        const containsSwitch = node.body.body.some(stmt => stmt === pattern.switchStatement);
        if (containsSwitch) {
          return nodeId;
        }
      }
    }
    
    return null;
  }
}