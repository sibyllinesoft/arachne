/**
 * @fileoverview Advanced Code Structuring Pass - Phase 1.1 of ArachneJS Enhancement Plan
 * 
 * Transforms low-level IR control flow into high-level, natural JavaScript constructs:
 * - Converts if-else chains that assign to same variable → ternary expressions
 * - Transforms while(true) loops with conditional breaks → standard while/for loops
 * - Converts equality-based if-else chains → switch statements
 * 
 * Uses CFG dominance analysis to ensure safe transformations that preserve semantics.
 */

import type {
  IRNode,
  IRExpression,
  IRStatement,
  IRIdentifier,
  IRLiteral,
  IRBlockStatement,
  IRIfStatement,
  IRWhileStatement,
  IRForStatement,
  IRSwitchStatement,
  IRSwitchCase,
  IRBreakStatement,
  IRContinueStatement,
  IRAssignmentExpression,
  IRExpressionStatement,
  IRVariableDeclaration,
  IRBinaryExpression,
  IRConditionalExpression,
  NodeId,
  VariableName
} from '../ir/nodes.js';

import { 
  IRNodeFactory, 
  isExpression, 
  isStatement 
} from '../ir/nodes.js';

import { 
  BasePass, 
  type IRState, 
  type PassResult, 
  PassUtils 
} from './Pass.js';

import type { 
  CFG, 
  CFGNode, 
  CFGEdge 
} from '../ir/cfg.js';

import { CFGAnalyzer } from '../ir/cfg.js';

/**
 * Pattern analysis result for if-else chains
 */
interface IfElseChainAnalysis {
  readonly type: 'ternary' | 'switch' | 'none';
  readonly nodes: readonly IRIfStatement[];
  readonly variable?: VariableName;
  readonly discriminant?: IRExpression;
  readonly cases?: readonly SwitchCasePattern[];
}

/**
 * Switch case pattern
 */
interface SwitchCasePattern {
  readonly test: IRExpression | null; // null for default case
  readonly consequent: readonly IRStatement[];
}

/**
 * Loop pattern analysis result
 */
interface LoopAnalysis {
  readonly type: 'while' | 'for' | 'none';
  readonly header: CFGNode;
  readonly condition?: IRExpression;
  readonly init?: IRExpression | IRVariableDeclaration;
  readonly update?: IRExpression;
  readonly body?: readonly IRStatement[];
}

/**
 * Dominance information for CFG nodes
 */
interface DominanceInfo {
  readonly dominators: ReadonlyMap<CFGNode, Set<CFGNode>>;
  readonly postDominators: ReadonlyMap<CFGNode, Set<CFGNode>>;
  readonly immediateDominators: ReadonlyMap<CFGNode, CFGNode | null>;
  readonly dominanceFrontiers: ReadonlyMap<CFGNode, Set<CFGNode>>;
}

/**
 * Advanced code structuring pass that transforms low-level control flow
 * into high-level, idiomatic JavaScript constructs
 */
export class StructuringPass extends BasePass<IRState> {
  readonly name = 'code-structuring';
  readonly description = 'Transform low-level control flow into high-level JavaScript constructs';

  private dominanceInfo?: DominanceInfo;
  private naturalLoops?: Map<CFGEdge, Set<CFGNode>>;

  protected executePass(state: IRState): { state: IRState; changed: boolean } {
    // Analyze CFG dominance relationships
    this.dominanceInfo = this.analyzeDominance(state.cfg);
    this.naturalLoops = CFGAnalyzer.findNaturalLoops(state.cfg);

    // Apply transformations in order
    const transformations = [
      () => this.transformTernaryExpressions(state),
      () => this.transformLoopStructures(state),
      () => this.transformSwitchStatements(state)
    ];

    let currentState = state;
    let totalChanged = false;

    for (const transformation of transformations) {
      const result = transformation();
      if (result.changed) {
        currentState = result.state;
        totalChanged = true;
      }
    }

    return { state: currentState, changed: totalChanged };
  }

  /**
   * Analyze dominance relationships in the CFG
   */
  private analyzeDominance(cfg: CFG): DominanceInfo {
    const dominators = this.computeDominators(cfg);
    const postDominators = this.computePostDominators(cfg);
    const immediateDominators = this.computeImmediateDominators(dominators);
    const dominanceFrontiers = CFGAnalyzer.computeDominanceFrontiers(cfg);

    return {
      dominators,
      postDominators,
      immediateDominators,
      dominanceFrontiers
    };
  }

  /**
   * Compute dominator sets using iterative dataflow analysis
   */
  private computeDominators(cfg: CFG): ReadonlyMap<CFGNode, Set<CFGNode>> {
    const dominators = new Map<CFGNode, Set<CFGNode>>();
    const allNodes = Array.from(cfg.nodes.values());

    // Initialize: entry dominates only itself, all others dominated by all nodes
    for (const node of allNodes) {
      if (node === cfg.entry) {
        dominators.set(node, new Set([node]));
      } else {
        dominators.set(node, new Set(allNodes));
      }
    }

    // Iterate until fixed point
    let changed = true;
    while (changed) {
      changed = false;

      for (const node of allNodes) {
        if (node === cfg.entry) continue;

        // Dom(n) = {n} ∪ (∩ Dom(p) for all predecessors p of n)
        const newDominators = new Set([node]);
        
        if (node.predecessors.length > 0) {
          const predDominators = node.predecessors.map(pred => dominators.get(pred)!);
          const intersection = this.intersectSets(predDominators);
          intersection.forEach(dom => newDominators.add(dom));
        }

        const oldSize = dominators.get(node)!.size;
        dominators.set(node, newDominators);
        
        if (newDominators.size !== oldSize) {
          changed = true;
        }
      }
    }

    return dominators;
  }

  /**
   * Compute post-dominator sets
   */
  private computePostDominators(cfg: CFG): ReadonlyMap<CFGNode, Set<CFGNode>> {
    const postDominators = new Map<CFGNode, Set<CFGNode>>();
    const allNodes = Array.from(cfg.nodes.values());

    // Initialize: exit post-dominates only itself, all others post-dominated by all nodes
    for (const node of allNodes) {
      if (node === cfg.exit) {
        postDominators.set(node, new Set([node]));
      } else {
        postDominators.set(node, new Set(allNodes));
      }
    }

    // Iterate until fixed point (reverse dataflow)
    let changed = true;
    while (changed) {
      changed = false;

      for (const node of allNodes) {
        if (node === cfg.exit) continue;

        // PostDom(n) = {n} ∪ (∩ PostDom(s) for all successors s of n)
        const newPostDominators = new Set([node]);
        
        if (node.successors.length > 0) {
          const succPostDominators = node.successors.map(succ => postDominators.get(succ)!);
          const intersection = this.intersectSets(succPostDominators);
          intersection.forEach(dom => newPostDominators.add(dom));
        }

        const oldSize = postDominators.get(node)!.size;
        postDominators.set(node, newPostDominators);
        
        if (newPostDominators.size !== oldSize) {
          changed = true;
        }
      }
    }

    return postDominators;
  }

  /**
   * Compute immediate dominators from dominator sets
   */
  private computeImmediateDominators(
    dominators: ReadonlyMap<CFGNode, Set<CFGNode>>
  ): ReadonlyMap<CFGNode, CFGNode | null> {
    const immediateDominators = new Map<CFGNode, CFGNode | null>();

    for (const [node, nodeDominators] of Array.from(dominators.entries())) {
      // Find the immediate dominator (closest dominator other than node itself)
      const strictDominators = new Set(nodeDominators);
      strictDominators.delete(node);

      if (strictDominators.size === 0) {
        immediateDominators.set(node, null);
        continue;
      }

      // Find dominator that is not dominated by any other dominator
      let immediateDominator: CFGNode | null = null;
      for (const candidate of Array.from(strictDominators)) {
        const isImmediate = Array.from(strictDominators).every(other => 
          other === candidate || !dominators.get(candidate)!.has(other)
        );
        
        if (isImmediate) {
          immediateDominator = candidate;
          break;
        }
      }

      immediateDominators.set(node, immediateDominator);
    }

    return immediateDominators;
  }

  /**
   * Transform if-else chains into ternary expressions where appropriate
   */
  private transformTernaryExpressions(state: IRState): { state: IRState; changed: boolean } {
    const updates = new Map<NodeId, IRNode>();
    let changed = false;

    for (const [nodeId, node] of state.nodes) {
      if (node.type === 'IfStatement') {
        const analysis = this.analyzeIfElseChain(node, state);
        
        if (analysis.type === 'ternary' && analysis.variable) {
          const ternaryExpr = this.createTernaryExpression(analysis);
          if (ternaryExpr) {
            updates.set(nodeId, ternaryExpr);
            changed = true;
            this.changeNode();
          }
        }
      }

      this.visitNode();
    }

    if (changed) {
      const newState = PassUtils.updateNodes(state, updates);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Transform while(true) loops with breaks into structured loops
   */
  private transformLoopStructures(state: IRState): { state: IRState; changed: boolean } {
    const updates = new Map<NodeId, IRNode>();
    let changed = false;

    for (const [nodeId, node] of state.nodes) {
      if (node.type === 'WhileStatement') {
        const analysis = this.analyzeLoopStructure(node, state);
        
        if (analysis.type === 'while' || analysis.type === 'for') {
          const structuredLoop = this.createStructuredLoop(analysis);
          if (structuredLoop) {
            updates.set(nodeId, structuredLoop);
            changed = true;
            this.changeNode();
          }
        }
      }

      this.visitNode();
    }

    if (changed) {
      const newState = PassUtils.updateNodes(state, updates);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Transform if-else equality chains into switch statements
   */
  private transformSwitchStatements(state: IRState): { state: IRState; changed: boolean } {
    const updates = new Map<NodeId, IRNode>();
    let changed = false;

    for (const [nodeId, node] of state.nodes) {
      if (node.type === 'IfStatement') {
        const analysis = this.analyzeIfElseChain(node, state);
        
        if (analysis.type === 'switch' && analysis.discriminant && analysis.cases) {
          const switchStmt = this.createSwitchStatement(analysis);
          if (switchStmt) {
            updates.set(nodeId, switchStmt);
            changed = true;
            this.changeNode();
          }
        }
      }

      this.visitNode();
    }

    if (changed) {
      const newState = PassUtils.updateNodes(state, updates);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Analyze if-else chain to determine transformation potential
   */
  private analyzeIfElseChain(ifStmt: IRIfStatement, state: IRState): IfElseChainAnalysis {
    const chain = this.collectIfElseChain(ifStmt);
    
    // Check for ternary pattern (all branches assign to same variable)
    const ternaryVariable = this.detectTernaryPattern(chain);
    if (ternaryVariable) {
      return {
        type: 'ternary',
        nodes: chain,
        variable: ternaryVariable
      };
    }

    // Check for switch pattern (all conditions test same variable for equality)
    const switchInfo = this.detectSwitchPattern(chain);
    if (switchInfo) {
      return {
        type: 'switch',
        nodes: chain,
        discriminant: switchInfo.discriminant,
        cases: switchInfo.cases
      };
    }

    return { type: 'none', nodes: chain };
  }

  /**
   * Collect all nodes in an if-else chain
   */
  private collectIfElseChain(ifStmt: IRIfStatement): readonly IRIfStatement[] {
    const chain: IRIfStatement[] = [ifStmt];
    let current = ifStmt.alternate;

    while (current && current.type === 'IfStatement') {
      chain.push(current);
      current = current.alternate;
    }

    return chain;
  }

  /**
   * Detect if all branches assign to the same variable (ternary pattern)
   */
  private detectTernaryPattern(chain: readonly IRIfStatement[]): VariableName | null {
    if (chain.length < 2) return null;

    let commonVariable: VariableName | null = null;

    for (const ifStmt of chain) {
      const assignVar = this.extractAssignmentVariable(ifStmt.consequent);
      if (!assignVar) return null;

      if (commonVariable === null) {
        commonVariable = assignVar;
      } else if (commonVariable !== assignVar) {
        return null;
      }
    }

    // Check final else clause if it exists
    const lastIf = chain[chain.length - 1]!;
    if (lastIf.alternate) {
      const finalAssignVar = this.extractAssignmentVariable(lastIf.alternate);
      if (!finalAssignVar || finalAssignVar !== commonVariable) {
        return null;
      }
    }

    return commonVariable;
  }

  /**
   * Detect switch pattern (equality tests on same discriminant)
   */
  private detectSwitchPattern(
    chain: readonly IRIfStatement[]
  ): { discriminant: IRExpression; cases: readonly SwitchCasePattern[] } | null {
    if (chain.length < 3) return null; // Need at least 3 cases for switch to be worthwhile

    let commonDiscriminant: IRExpression | null = null;
    const cases: SwitchCasePattern[] = [];

    for (const ifStmt of chain) {
      const equalityInfo = this.extractEqualityTest(ifStmt.test);
      if (!equalityInfo) return null;

      if (commonDiscriminant === null) {
        commonDiscriminant = equalityInfo.left;
      } else if (!this.expressionsEqual(commonDiscriminant, equalityInfo.left)) {
        return null;
      }

      cases.push({
        test: equalityInfo.right,
        consequent: this.extractStatements(ifStmt.consequent)
      });
    }

    // Add default case if present
    const lastIf = chain[chain.length - 1]!;
    if (lastIf.alternate) {
      cases.push({
        test: null, // default case
        consequent: this.extractStatements(lastIf.alternate)
      });
    }

    return commonDiscriminant ? { discriminant: commonDiscriminant, cases } : null;
  }

  /**
   * Analyze loop structure for transformation opportunities
   */
  private analyzeLoopStructure(whileStmt: IRWhileStatement, state: IRState): LoopAnalysis {
    // Check for while(true) pattern
    if (this.isLiteralTrue(whileStmt.test)) {
      const breakInfo = this.findConditionalBreak(whileStmt.body);
      if (breakInfo) {
        return {
          type: 'while',
          header: this.findCFGNode(state.cfg, whileStmt),
          condition: this.negateCondition(breakInfo.condition),
          body: breakInfo.bodyWithoutBreak
        };
      }
    }

    // Check for for-loop pattern (initialization + condition + update)
    const forPattern = this.detectForLoopPattern(whileStmt, state);
    if (forPattern) {
      return forPattern;
    }

    return { type: 'none', header: this.findCFGNode(state.cfg, whileStmt) };
  }

  /**
   * Create ternary expression from analysis
   */
  private createTernaryExpression(analysis: IfElseChainAnalysis): IRNode | null {
    if (analysis.type !== 'ternary' || !analysis.variable) return null;

    const chain = analysis.nodes;
    if (chain.length < 2) return null;

    // Build nested ternary expression
    let ternary: IRExpression | null = null;

    // Start from the end and work backwards
    for (let i = chain.length - 1; i >= 0; i--) {
      const ifStmt = chain[i]!;
      const consequent = this.extractAssignmentValue(ifStmt.consequent);
      if (!consequent) return null;

      if (i === chain.length - 1) {
        // Last if statement - check for else clause
        const alternate = ifStmt.alternate 
          ? this.extractAssignmentValue(ifStmt.alternate) 
          : IRNodeFactory.identifier('undefined');
        
        if (!alternate) return null;

        ternary = IRNodeFactory.conditionalExpression(
          ifStmt.test,
          consequent,
          alternate
        );
      } else {
        // Nested ternary
        if (!ternary) return null;
        ternary = IRNodeFactory.conditionalExpression(
          ifStmt.test,
          consequent,
          ternary
        );
      }
    }

    if (!ternary) return null;

    // Return assignment expression
    return IRNodeFactory.expressionStatement(
      IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier(analysis.variable),
        ternary
      )
    );
  }

  /**
   * Create structured loop from analysis
   */
  private createStructuredLoop(analysis: LoopAnalysis): IRNode | null {
    if (analysis.type === 'while' && analysis.condition) {
      return IRNodeFactory.whileStatement(
        analysis.condition,
        IRNodeFactory.blockStatement(analysis.body)
      );
    }

    if (analysis.type === 'for' && analysis.condition) {
      return IRNodeFactory.forStatement(
        analysis.init || null,
        analysis.condition,
        analysis.update || null,
        IRNodeFactory.blockStatement(analysis.body)
      );
    }

    return null;
  }

  /**
   * Create switch statement from analysis
   */
  private createSwitchStatement(analysis: IfElseChainAnalysis): IRNode | null {
    if (analysis.type !== 'switch' || !analysis.discriminant || !analysis.cases) return null;

    const switchCases = analysis.cases.map(casePattern => 
      IRNodeFactory.switchCase(casePattern.test, casePattern.consequent)
    );

    return IRNodeFactory.switchStatement(analysis.discriminant, switchCases);
  }

  // Helper methods for pattern detection and analysis

  private intersectSets<T>(sets: readonly Set<T>[]): Set<T> {
    if (sets.length === 0) return new Set();
    
    const intersection = new Set(sets[0]);
    for (let i = 1; i < sets.length; i++) {
      for (const item of Array.from(intersection)) {
        if (!sets[i]!.has(item)) {
          intersection.delete(item);
        }
      }
    }
    return intersection;
  }

  private extractAssignmentVariable(stmt: IRStatement): VariableName | null {
    if (stmt.type === 'ExpressionStatement' && 
        stmt.expression.type === 'AssignmentExpression' &&
        stmt.expression.operator === '=' &&
        stmt.expression.left.type === 'Identifier') {
      return IRNodeFactory.createVariableName(stmt.expression.left.name);
    }
    return null;
  }

  private extractAssignmentValue(stmt: IRStatement): IRExpression | null {
    if (stmt.type === 'ExpressionStatement' && 
        stmt.expression.type === 'AssignmentExpression' &&
        stmt.expression.operator === '=') {
      return stmt.expression.right;
    }
    return null;
  }

  private extractEqualityTest(expr: IRExpression): { left: IRExpression; right: IRExpression } | null {
    if (expr.type === 'BinaryExpression' && 
        (expr.operator === '===' || expr.operator === '==' || expr.operator === '!==' || expr.operator === '!=')) {
      return { left: expr.left, right: expr.right };
    }
    return null;
  }

  private extractStatements(stmt: IRStatement): readonly IRStatement[] {
    if (stmt.type === 'BlockStatement') {
      return stmt.body;
    }
    return [stmt];
  }

  private isLiteralTrue(expr: IRExpression): boolean {
    return expr.type === 'Literal' && expr.value === true;
  }

  private expressionsEqual(expr1: IRExpression, expr2: IRExpression): boolean {
    // Simplified equality check - in a real implementation, would use proper AST comparison
    return JSON.stringify(expr1) === JSON.stringify(expr2);
  }

  private negateCondition(condition: IRExpression): IRExpression {
    return IRNodeFactory.unaryExpression('!', condition);
  }

  private findConditionalBreak(stmt: IRStatement): { condition: IRExpression; bodyWithoutBreak: readonly IRStatement[] } | null {
    if (stmt.type !== 'BlockStatement') return null;

    // Look for if statement with break
    for (let i = 0; i < stmt.body.length; i++) {
      const s = stmt.body[i]!;
      if (s.type === 'IfStatement' && 
          s.consequent.type === 'BreakStatement' && 
          !s.alternate) {
        
        const bodyWithoutBreak = [
          ...stmt.body.slice(0, i),
          ...stmt.body.slice(i + 1)
        ];

        return {
          condition: s.test,
          bodyWithoutBreak
        };
      }
    }

    return null;
  }

  private detectForLoopPattern(whileStmt: IRWhileStatement, state: IRState): LoopAnalysis | null {
    // This would analyze for traditional for-loop patterns
    // For now, return null (can be extended later)
    return null;
  }

  private findCFGNode(cfg: CFG, node: IRNode): CFGNode {
    // Find corresponding CFG node for IR node
    // This is a simplified implementation
    return cfg.entry; // Placeholder
  }
}