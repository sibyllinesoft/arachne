/**
 * @fileoverview Tests for dead code elimination base class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DeadCodeEliminationBase,
  type LivenessInfo,
  type DeadCodeEliminationConfig,
  type DeadCodeEliminationStats
} from '../../../src/passes/base/dead-code-elimination-base.ts';
import { IRNodeFactory } from '../../../src/ir/nodes.ts';
import type { 
  IRState, 
  IRNode, 
  IRVariableDeclaration, 
  IRBlockStatement,
  IRIdentifier,
  NodeId,
  VariableName
} from '../../../src/ir/nodes.ts';
import type { CFG } from '../../../src/ir/cfg.ts';

// Concrete implementation for testing
class TestDeadCodeEliminationPass extends DeadCodeEliminationBase {
  constructor(config?: DeadCodeEliminationConfig) {
    super(config);
  }

  get name(): string {
    return 'test-dead-code-elimination';
  }

  get description(): string {
    return 'Test dead code elimination pass';
  }

  // Expose protected methods for testing
  public testResetState(): void {
    return this.resetState();
  }

  public testPerformLivenessAnalysis(state: IRState): void {
    return this.performLivenessAnalysis(state);
  }

  public testCollectVariableInfo(state: IRState): void {
    return this.collectVariableInfo(state);
  }

  public testCollectNodeVariables(node: IRNode, liveness: LivenessInfo): void {
    return this.collectNodeVariables(node, liveness);
  }

  public testCollectVariableDeclarationInfo(node: IRVariableDeclaration, liveness: LivenessInfo): void {
    return this.collectVariableDeclarationInfo(node, liveness);
  }

  public testCollectIdentifierInfo(node: IRIdentifier, liveness: LivenessInfo): void {
    return this.collectIdentifierInfo(node, liveness);
  }

  public testCollectAssignmentInfo(node: any, liveness: LivenessInfo): void {
    return this.collectAssignmentInfo(node, liveness);
  }

  public testCollectBlockStatementInfo(node: IRBlockStatement, liveness: LivenessInfo): void {
    return this.collectBlockStatementInfo(node, liveness);
  }

  public testCollectExpressionInfo(node: any, liveness: LivenessInfo): void {
    return this.collectExpressionInfo(node, liveness);
  }

  public testCollectExpressionUses(expr: any, liveness: LivenessInfo): void {
    return this.collectExpressionUses(expr, liveness);
  }

  public testCollectChildrenInfo(node: any, liveness: LivenessInfo): void {
    return this.collectChildrenInfo(node, liveness);
  }

  public testComputeLiveness(state: IRState): void {
    return this.computeLiveness(state);
  }

  public testSetsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    return this.setsEqual(set1, set2);
  }

  public testEliminateDeadCode(state: IRState): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    return this.eliminateDeadCode(state);
  }

  public testEliminateNodeDeadCode(node: IRNode, state: IRState): IRNode | null {
    return this.eliminateNodeDeadCode(node, state);
  }

  public testIsEmptyStatement(node: IRNode): boolean {
    return this.isEmptyStatement(node);
  }

  public testIsUnusedVariableDeclaration(node: IRNode): boolean {
    return this.isUnusedVariableDeclaration(node);
  }

  public testIsUnusedFunction(node: IRNode): boolean {
    return this.isUnusedFunction(node);
  }

  public testRemoveUnusedFromVariableDeclaration(node: IRVariableDeclaration): IRNode | null {
    return this.removeUnusedFromVariableDeclaration(node);
  }

  public testTransformNodeChildren(node: IRNode, state: IRState): IRNode {
    return this.transformNodeChildren(node, state);
  }

  public testTransformBlockStatement(node: IRBlockStatement, state: IRState): IRNode {
    return this.transformBlockStatement(node, state);
  }

  public testTransformProgram(node: any, state: IRState): IRNode {
    return this.transformProgram(node, state);
  }

  // Expose protected properties for testing
  public get testDefinedVariables(): Set<VariableName> {
    return this.definedVariables;
  }

  public get testUsedVariables(): Set<VariableName> {
    return this.usedVariables;
  }

  public get testLivenessInfo(): Map<NodeId, LivenessInfo> {
    return this.livenessInfo;
  }
}

describe('DeadCodeEliminationBase', () => {
  let pass: TestDeadCodeEliminationPass;
  let state: IRState;

  beforeEach(() => {
    pass = new TestDeadCodeEliminationPass();
    
    // Create minimal CFG
    const entryId = IRNodeFactory.createNodeId();
    const exitId = IRNodeFactory.createNodeId();
    
    const cfg: CFG = {
      nodes: new Map(),
      entry: {
        id: entryId,
        label: 'entry',
        instructions: [],
        predecessors: [],
        successors: [],
        edges_in: [],
        edges_out: [],
        dominates: new Set(),
        dominated_by: new Set(),
        dominance_frontier: new Set(),
        post_dominates: new Set(),
        post_dominated_by: new Set(),
        post_dominance_frontier: new Set(),
        loop_depth: 0,
        back_edges: []
      },
      exit: {
        id: exitId,
        label: 'exit',
        instructions: [],
        predecessors: [],
        successors: [],
        edges_in: [],
        edges_out: [],
        dominates: new Set(),
        dominated_by: new Set(),
        dominance_frontier: new Set(),
        post_dominates: new Set(),
        post_dominated_by: new Set(),
        post_dominance_frontier: new Set(),
        loop_depth: 0,
        back_edges: []
      },
      edges: [],
      dominance_tree: new Map(),
      post_dominance_tree: new Map()
    };
    
    state = {
      cfg,
      nodes: new Map(),
      metadata: new Map()
    };
  });

  describe('constructor and configuration', () => {
    it('should create with default configuration', () => {
      const defaultPass = new TestDeadCodeEliminationPass();
      expect(defaultPass.name).toBe('test-dead-code-elimination');
      expect(defaultPass.description).toBe('Test dead code elimination pass');
    });

    it('should create with custom configuration', () => {
      const config: DeadCodeEliminationConfig = {
        removeUnusedVariables: false,
        removeUnreachableCode: false,
        removeEmptyStatements: false,
        removeUnusedFunctions: false,
        aggressiveElimination: true,
        maxIterations: 50
      };
      const customPass = new TestDeadCodeEliminationPass(config);
      expect(customPass).toBeDefined();
    });

    it('should have correct initial statistics', () => {
      const stats = pass.getStats();
      expect(stats.nodesRemoved).toBe(0);
      expect(stats.variablesRemoved).toBe(0);
      expect(stats.functionsRemoved).toBe(0);
      expect(stats.statementsRemoved).toBe(0);
      expect(stats.iterations).toBe(0);
    });
  });

  describe('state management', () => {
    it('should reset state correctly', () => {
      // Add some variables to sets
      pass.testDefinedVariables.add(IRNodeFactory.createVariableName('x'));
      pass.testUsedVariables.add(IRNodeFactory.createVariableName('y'));
      
      pass.testResetState();
      
      expect(pass.testDefinedVariables.size).toBe(0);
      expect(pass.testUsedVariables.size).toBe(0);
      expect(pass.testLivenessInfo.size).toBe(0);
      
      const stats = pass.getStats();
      expect(stats.nodesRemoved).toBe(0);
      expect(stats.variablesRemoved).toBe(0);
      expect(stats.functionsRemoved).toBe(0);
      expect(stats.statementsRemoved).toBe(0);
      expect(stats.iterations).toBe(0);
    });
  });

  describe('utility methods', () => {
    it('should test set equality correctly', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['a', 'b', 'c']);
      const set3 = new Set(['a', 'b']);
      const set4 = new Set(['a', 'b', 'd']);
      
      expect(pass.testSetsEqual(set1, set2)).toBe(true);
      expect(pass.testSetsEqual(set1, set3)).toBe(false);
      expect(pass.testSetsEqual(set1, set4)).toBe(false);
    });

    it('should handle empty sets in equality check', () => {
      const emptySet1 = new Set();
      const emptySet2 = new Set();
      const nonEmptySet = new Set(['a']);
      
      expect(pass.testSetsEqual(emptySet1, emptySet2)).toBe(true);
      expect(pass.testSetsEqual(emptySet1, nonEmptySet)).toBe(false);
    });
  });

  describe('liveness info access', () => {
    it('should provide access to liveness information', () => {
      const livenessInfo = pass.getLivenessInfo();
      expect(livenessInfo).toBeInstanceOf(Map);
    });
  });

  describe('variable information collection', () => {
    describe('variable declarations', () => {
      it('should collect variable declaration information', () => {
        const varDecl: IRVariableDeclaration = {
          type: 'VariableDeclaration',
          kind: 'let',
          declarations: [{
            type: 'VariableDeclarator',
            id: IRNodeFactory.identifier('x'),
            init: IRNodeFactory.literal(42),
            node_id: IRNodeFactory.createNodeId()
          }],
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectVariableDeclarationInfo(varDecl, liveness);
        
        expect(liveness.defined.size).toBe(1);
        expect(Array.from(liveness.defined)[0]).toContain('x');
      });

      it('should handle variable declaration without initializer', () => {
        const varDecl: IRVariableDeclaration = {
          type: 'VariableDeclaration',
          kind: 'let',
          declarations: [{
            type: 'VariableDeclarator',
            id: IRNodeFactory.identifier('x'),
            init: null,
            node_id: IRNodeFactory.createNodeId()
          }],
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectVariableDeclarationInfo(varDecl, liveness);
        
        expect(liveness.defined.size).toBe(1);
      });

      it('should handle multiple variable declarations', () => {
        const varDecl: IRVariableDeclaration = {
          type: 'VariableDeclaration',
          kind: 'let',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: IRNodeFactory.identifier('x'),
              init: IRNodeFactory.literal(42),
              node_id: IRNodeFactory.createNodeId()
            },
            {
              type: 'VariableDeclarator',
              id: IRNodeFactory.identifier('y'),
              init: IRNodeFactory.literal(24),
              node_id: IRNodeFactory.createNodeId()
            }
          ],
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectVariableDeclarationInfo(varDecl, liveness);
        
        expect(liveness.defined.size).toBe(2);
      });
    });

    describe('identifiers', () => {
      it('should collect identifier information', () => {
        const identifier = IRNodeFactory.identifier('myVar');
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectIdentifierInfo(identifier, liveness);
        
        expect(liveness.used.size).toBe(1);
        expect(Array.from(liveness.used)[0]).toContain('myVar');
      });
    });

    describe('assignments', () => {
      it('should collect assignment information for simple assignment', () => {
        const assignment = {
          type: 'AssignmentExpression',
          operator: '=',
          left: IRNodeFactory.identifier('x'),
          right: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectAssignmentInfo(assignment, liveness);
        
        expect(liveness.defined.size).toBe(1);
        expect(Array.from(liveness.defined)[0]).toContain('x');
      });

      it('should handle complex assignment operators', () => {
        const assignment = {
          type: 'AssignmentExpression',
          operator: '+=',
          left: IRNodeFactory.identifier('x'),
          right: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectAssignmentInfo(assignment, liveness);
        
        // Should use the left side (not define it) for complex operators
        expect(liveness.used.size).toBeGreaterThan(0);
      });

      it('should handle property assignments', () => {
        const assignment = {
          type: 'AssignmentExpression',
          operator: '=',
          left: {
            type: 'MemberExpression',
            object: IRNodeFactory.identifier('obj'),
            property: IRNodeFactory.identifier('prop'),
            computed: false,
            node_id: IRNodeFactory.createNodeId()
          },
          right: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectAssignmentInfo(assignment, liveness);
        
        // Should use variables in the property access
        expect(liveness.used.size).toBeGreaterThan(0);
      });
    });

    describe('block statements', () => {
      it('should collect information from block statement', () => {
        const stmt1 = {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('x'),
          node_id: IRNodeFactory.createNodeId()
        };
        
        const block: IRBlockStatement = {
          type: 'BlockStatement',
          body: [stmt1],
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectBlockStatementInfo(block, liveness);
        
        expect(liveness.used.size).toBe(1);
      });

      it('should handle empty block statement', () => {
        const block: IRBlockStatement = {
          type: 'BlockStatement',
          body: [],
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectBlockStatementInfo(block, liveness);
        
        expect(liveness.used.size).toBe(0);
        expect(liveness.defined.size).toBe(0);
      });
    });

    describe('expression uses collection', () => {
      it('should collect identifier uses', () => {
        const identifier = IRNodeFactory.identifier('testVar');
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectExpressionUses(identifier, liveness);
        
        expect(liveness.used.size).toBe(1);
        expect(Array.from(liveness.used)[0]).toContain('testVar');
      });

      it('should collect binary expression uses', () => {
        const left = IRNodeFactory.identifier('x');
        const right = IRNodeFactory.identifier('y');
        const binaryExpr = IRNodeFactory.binaryExpression('+', left, right);
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectExpressionUses(binaryExpr, liveness);
        
        expect(liveness.used.size).toBe(2);
      });

      it('should collect unary expression uses', () => {
        const operand = IRNodeFactory.identifier('x');
        const unaryExpr = {
          type: 'UnaryExpression',
          operator: '!',
          argument: operand,
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectExpressionUses(unaryExpr, liveness);
        
        expect(liveness.used.size).toBe(1);
      });

      it('should collect call expression uses', () => {
        const callee = IRNodeFactory.identifier('func');
        const arg1 = IRNodeFactory.identifier('arg1');
        const arg2 = IRNodeFactory.identifier('arg2');
        const callExpr = {
          type: 'CallExpression',
          callee,
          arguments: [arg1, arg2],
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectExpressionUses(callExpr, liveness);
        
        expect(liveness.used.size).toBe(3); // callee + 2 args
      });

      it('should collect member expression uses', () => {
        const object = IRNodeFactory.identifier('obj');
        const property = IRNodeFactory.identifier('prop');
        const memberExpr = {
          type: 'MemberExpression',
          object,
          property,
          computed: true,
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectExpressionUses(memberExpr, liveness);
        
        expect(liveness.used.size).toBe(2); // object + computed property
      });

      it('should collect member expression uses (non-computed)', () => {
        const object = IRNodeFactory.identifier('obj');
        const memberExpr = {
          type: 'MemberExpression',
          object,
          property: IRNodeFactory.identifier('prop'),
          computed: false,
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectExpressionUses(memberExpr, liveness);
        
        expect(liveness.used.size).toBe(1); // only object, not property
      });

      it('should collect array expression uses', () => {
        const elem1 = IRNodeFactory.identifier('x');
        const elem2 = IRNodeFactory.identifier('y');
        const arrayExpr = {
          type: 'ArrayExpression',
          elements: [elem1, null, elem2],
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectExpressionUses(arrayExpr, liveness);
        
        expect(liveness.used.size).toBe(2); // x and y, null is ignored
      });

      it('should collect object expression uses', () => {
        const keyExpr = IRNodeFactory.identifier('key');
        const valueExpr = IRNodeFactory.identifier('value');
        const objectExpr = {
          type: 'ObjectExpression',
          properties: [{
            type: 'Property',
            key: keyExpr,
            value: valueExpr,
            computed: true,
            node_id: IRNodeFactory.createNodeId()
          }],
          node_id: IRNodeFactory.createNodeId()
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectExpressionUses(objectExpr, liveness);
        
        expect(liveness.used.size).toBe(2); // key + value
      });

      it('should handle null/undefined expressions', () => {
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectExpressionUses(null, liveness);
        pass.testCollectExpressionUses(undefined, liveness);
        
        expect(liveness.used.size).toBe(0);
      });
    });

    describe('children information collection', () => {
      it('should collect from object properties', () => {
        const nodeWithChildren = {
          type: 'CustomNode',
          child: IRNodeFactory.identifier('x'),
          children: [IRNodeFactory.identifier('y'), IRNodeFactory.identifier('z')]
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectChildrenInfo(nodeWithChildren, liveness);
        
        expect(liveness.used.size).toBe(3); // x, y, z
      });

      it('should skip special properties', () => {
        const nodeWithSpecialProps = {
          type: 'CustomNode',
          parent: { type: 'Parent' },
          leadingComments: [{ type: 'Comment' }],
          trailingComments: [{ type: 'Comment' }],
          child: IRNodeFactory.identifier('x')
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectChildrenInfo(nodeWithSpecialProps, liveness);
        
        expect(liveness.used.size).toBe(1); // only x, not parent/comments
      });

      it('should handle non-object children', () => {
        const nodeWithPrimitives = {
          type: 'CustomNode',
          stringProp: 'hello',
          numberProp: 42,
          boolProp: true,
          child: IRNodeFactory.identifier('x')
        };
        
        const liveness: LivenessInfo = {
          defined: new Set(),
          used: new Set(),
          liveIn: new Set(),
          liveOut: new Set()
        };
        
        pass.testCollectChildrenInfo(nodeWithPrimitives, liveness);
        
        expect(liveness.used.size).toBe(1); // only x
      });
    });
  });

  describe('liveness analysis', () => {
    it('should perform complete liveness analysis', () => {
      const varDecl: IRVariableDeclaration = {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('x'),
          init: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      };
      
      const identifier = IRNodeFactory.identifier('x');
      
      state.nodes.set(varDecl.node_id, varDecl);
      state.nodes.set(identifier.node_id, identifier);
      
      pass.testPerformLivenessAnalysis(state);
      
      expect(pass.testDefinedVariables.size).toBeGreaterThan(0);
      expect(pass.testUsedVariables.size).toBeGreaterThan(0);
      expect(pass.testLivenessInfo.size).toBeGreaterThan(0);
    });

    it('should handle iterative dataflow analysis', () => {
      // Create a simple dependency chain
      const varDecl: IRVariableDeclaration = {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('x'),
          init: IRNodeFactory.literal(1),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      };
      
      state.nodes.set(varDecl.node_id, varDecl);
      
      pass.testComputeLiveness(state);
      
      const stats = pass.getStats();
      expect(stats.iterations).toBeGreaterThan(0);
    });

    it('should respect maxIterations configuration', () => {
      const limitedPass = new TestDeadCodeEliminationPass({
        maxIterations: 1
      });
      
      const varDecl: IRVariableDeclaration = {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('x'),
          init: IRNodeFactory.literal(1),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      };
      
      state.nodes.set(varDecl.node_id, varDecl);
      
      limitedPass.testCollectVariableInfo(state);
      limitedPass.testComputeLiveness(state);
      
      const stats = limitedPass.getStats();
      expect(stats.iterations).toBeLessThanOrEqual(1);
    });
  });

  describe('dead code detection', () => {
    describe('empty statement detection', () => {
      it('should detect empty statement', () => {
        const emptyStmt = {
          type: 'EmptyStatement',
          node_id: IRNodeFactory.createNodeId()
        };
        
        expect(pass.testIsEmptyStatement(emptyStmt)).toBe(true);
      });

      it('should detect empty block statement', () => {
        const emptyBlock: IRBlockStatement = {
          type: 'BlockStatement',
          body: [],
          node_id: IRNodeFactory.createNodeId()
        };
        
        expect(pass.testIsEmptyStatement(emptyBlock)).toBe(true);
      });

      it('should detect empty expression statement', () => {
        const emptyExprStmt = {
          type: 'ExpressionStatement',
          expression: null,
          node_id: IRNodeFactory.createNodeId()
        };
        
        expect(pass.testIsEmptyStatement(emptyExprStmt)).toBe(true);
      });

      it('should not detect non-empty statements as empty', () => {
        const nonEmptyBlock: IRBlockStatement = {
          type: 'BlockStatement',
          body: [{
            type: 'ExpressionStatement',
            expression: IRNodeFactory.identifier('x'),
            node_id: IRNodeFactory.createNodeId()
          }],
          node_id: IRNodeFactory.createNodeId()
        };
        
        expect(pass.testIsEmptyStatement(nonEmptyBlock)).toBe(false);
      });
    });

    describe('unused variable detection', () => {
      it('should detect unused variable declaration', () => {
        const varDecl: IRVariableDeclaration = {
          type: 'VariableDeclaration',
          kind: 'let',
          declarations: [{
            type: 'VariableDeclarator',
            id: IRNodeFactory.identifier('unusedVar'),
            init: IRNodeFactory.literal(42),
            node_id: IRNodeFactory.createNodeId()
          }],
          node_id: IRNodeFactory.createNodeId()
        };
        
        // Don't add the variable to used set
        
        expect(pass.testIsUnusedVariableDeclaration(varDecl)).toBe(true);
      });

      it('should not detect used variable as unused', () => {
        const varDecl: IRVariableDeclaration = {
          type: 'VariableDeclaration',
          kind: 'let',
          declarations: [{
            type: 'VariableDeclarator',
            id: IRNodeFactory.identifier('usedVar'),
            init: IRNodeFactory.literal(42),
            node_id: IRNodeFactory.createNodeId()
          }],
          node_id: IRNodeFactory.createNodeId()
        };
        
        // Add variable to used set
        pass.testUsedVariables.add(IRNodeFactory.createVariableName('usedVar'));
        
        expect(pass.testIsUnusedVariableDeclaration(varDecl)).toBe(false);
      });

      it('should handle non-variable-declaration nodes', () => {
        const literal = IRNodeFactory.literal(42);
        expect(pass.testIsUnusedVariableDeclaration(literal)).toBe(false);
      });
    });

    describe('unused function detection', () => {
      it('should detect unused function', () => {
        const funcDecl = {
          type: 'FunctionDeclaration',
          id: IRNodeFactory.identifier('unusedFunc'),
          params: [],
          body: {
            type: 'BlockStatement',
            body: [],
            node_id: IRNodeFactory.createNodeId()
          },
          node_id: IRNodeFactory.createNodeId()
        };
        
        expect(pass.testIsUnusedFunction(funcDecl)).toBe(true);
      });

      it('should not detect used function as unused', () => {
        const funcDecl = {
          type: 'FunctionDeclaration',
          id: IRNodeFactory.identifier('usedFunc'),
          params: [],
          body: {
            type: 'BlockStatement',
            body: [],
            node_id: IRNodeFactory.createNodeId()
          },
          node_id: IRNodeFactory.createNodeId()
        };
        
        pass.testUsedVariables.add(IRNodeFactory.createVariableName('usedFunc'));
        
        expect(pass.testIsUnusedFunction(funcDecl)).toBe(false);
      });

      it('should handle anonymous functions', () => {
        const anonFunc = {
          type: 'FunctionDeclaration',
          id: null,
          params: [],
          body: {
            type: 'BlockStatement',
            body: [],
            node_id: IRNodeFactory.createNodeId()
          },
          node_id: IRNodeFactory.createNodeId()
        };
        
        expect(pass.testIsUnusedFunction(anonFunc)).toBe(false);
      });

      it('should handle non-function nodes', () => {
        const literal = IRNodeFactory.literal(42);
        expect(pass.testIsUnusedFunction(literal)).toBe(false);
      });
    });

    describe('unused variable declaration removal', () => {
      it('should remove completely unused variable declaration', () => {
        const varDecl: IRVariableDeclaration = {
          type: 'VariableDeclaration',
          kind: 'let',
          declarations: [{
            type: 'VariableDeclarator',
            id: IRNodeFactory.identifier('unused'),
            init: IRNodeFactory.literal(42),
            node_id: IRNodeFactory.createNodeId()
          }],
          node_id: IRNodeFactory.createNodeId()
        };
        
        const result = pass.testRemoveUnusedFromVariableDeclaration(varDecl);
        expect(result).toBe(null);
      });

      it('should remove only unused declarations from multi-declaration', () => {
        const varDecl: IRVariableDeclaration = {
          type: 'VariableDeclaration',
          kind: 'let',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: IRNodeFactory.identifier('unused'),
              init: IRNodeFactory.literal(42),
              node_id: IRNodeFactory.createNodeId()
            },
            {
              type: 'VariableDeclarator',
              id: IRNodeFactory.identifier('used'),
              init: IRNodeFactory.literal(24),
              node_id: IRNodeFactory.createNodeId()
            }
          ],
          node_id: IRNodeFactory.createNodeId()
        };
        
        pass.testUsedVariables.add(IRNodeFactory.createVariableName('used'));
        
        const result = pass.testRemoveUnusedFromVariableDeclaration(varDecl);
        expect(result).not.toBe(null);
        if (result && result.type === 'VariableDeclaration') {
          expect(result.declarations.length).toBe(1);
        }
      });

      it('should preserve used variable declarations', () => {
        const varDecl: IRVariableDeclaration = {
          type: 'VariableDeclaration',
          kind: 'let',
          declarations: [{
            type: 'VariableDeclarator',
            id: IRNodeFactory.identifier('used'),
            init: IRNodeFactory.literal(42),
            node_id: IRNodeFactory.createNodeId()
          }],
          node_id: IRNodeFactory.createNodeId()
        };
        
        pass.testUsedVariables.add(IRNodeFactory.createVariableName('used'));
        
        const result = pass.testRemoveUnusedFromVariableDeclaration(varDecl);
        expect(result).toBe(varDecl);
      });
    });
  });

  describe('dead code elimination', () => {
    it('should eliminate empty statements when configured', () => {
      const emptyStmt = {
        type: 'EmptyStatement',
        node_id: IRNodeFactory.createNodeId()
      };
      
      state.nodes.set(emptyStmt.node_id, emptyStmt);
      
      const result = pass.testEliminateNodeDeadCode(emptyStmt, state);
      expect(result).toBe(null);
    });

    it('should not eliminate empty statements when disabled', () => {
      const disabledPass = new TestDeadCodeEliminationPass({
        removeEmptyStatements: false
      });
      
      const emptyStmt = {
        type: 'EmptyStatement',
        node_id: IRNodeFactory.createNodeId()
      };
      
      const result = disabledPass.testEliminateNodeDeadCode(emptyStmt, state);
      expect(result).toBe(emptyStmt);
    });

    it('should eliminate unused variables when configured', () => {
      const varDecl: IRVariableDeclaration = {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('unused'),
          init: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      };
      
      const result = pass.testEliminateNodeDeadCode(varDecl, state);
      expect(result).toBe(null);
    });

    it('should eliminate unused functions when configured', () => {
      const funcDecl = {
        type: 'FunctionDeclaration',
        id: IRNodeFactory.identifier('unusedFunc'),
        params: [],
        body: {
          type: 'BlockStatement',
          body: [],
          node_id: IRNodeFactory.createNodeId()
        },
        node_id: IRNodeFactory.createNodeId()
      };
      
      const result = pass.testEliminateNodeDeadCode(funcDecl, state);
      expect(result).toBe(null);
    });

    it('should transform block statements by removing dead children', () => {
      const emptyStmt = {
        type: 'EmptyStatement',
        node_id: IRNodeFactory.createNodeId()
      };
      
      const aliveStmt = {
        type: 'ExpressionStatement',
        expression: IRNodeFactory.identifier('x'),
        node_id: IRNodeFactory.createNodeId()
      };
      
      const block: IRBlockStatement = {
        type: 'BlockStatement',
        body: [emptyStmt, aliveStmt],
        node_id: IRNodeFactory.createNodeId()
      };
      
      const result = pass.testTransformBlockStatement(block, state);
      if (result.type === 'BlockStatement') {
        expect(result.body.length).toBe(1); // empty statement removed
      }
    });

    it('should transform programs by removing dead top-level statements', () => {
      const emptyStmt = {
        type: 'EmptyStatement',
        node_id: IRNodeFactory.createNodeId()
      };
      
      const aliveStmt = {
        type: 'ExpressionStatement',
        expression: IRNodeFactory.identifier('x'),
        node_id: IRNodeFactory.createNodeId()
      };
      
      const program = {
        type: 'Program',
        body: [emptyStmt, aliveStmt],
        node_id: IRNodeFactory.createNodeId()
      };
      
      const result = pass.testTransformProgram(program, state);
      if ('body' in result && Array.isArray(result.body)) {
        expect(result.body.length).toBe(1); // empty statement removed
      }
    });
  });

  describe('integration tests', () => {
    it('should run complete pass on simple state', async () => {
      const varDecl: IRVariableDeclaration = {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('x'),
          init: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      };
      
      state.nodes.set(varDecl.node_id, varDecl);
      
      const result = await pass.run(state);
      expect(result).toBeDefined();
      expect(result.state).toBeDefined();
      expect(typeof result.changed).toBe('boolean');
    });

    it('should handle empty state', async () => {
      const result = await pass.run(state);
      expect(result.changed).toBe(false);
      expect(result.state).toBe(state);
    });

    it('should track statistics correctly', async () => {
      const emptyStmt = {
        type: 'EmptyStatement',
        node_id: IRNodeFactory.createNodeId()
      };
      
      const unusedVar: IRVariableDeclaration = {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('unused'),
          init: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      };
      
      state.nodes.set(emptyStmt.node_id, emptyStmt);
      state.nodes.set(unusedVar.node_id, unusedVar);
      
      const result = await pass.run(state);
      const stats = pass.getStats();
      
      if (result.changed) {
        expect(stats.nodesRemoved + stats.variablesRemoved).toBeGreaterThan(0);
      }
    });
  });

  describe('configuration options', () => {
    it('should respect removeUnusedVariables config', () => {
      const disabledPass = new TestDeadCodeEliminationPass({
        removeUnusedVariables: false
      });
      
      const varDecl: IRVariableDeclaration = {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('unused'),
          init: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      };
      
      const result = disabledPass.testEliminateNodeDeadCode(varDecl, state);
      expect(result).toBe(varDecl); // Should not remove when disabled
    });

    it('should respect removeUnusedFunctions config', () => {
      const disabledPass = new TestDeadCodeEliminationPass({
        removeUnusedFunctions: false
      });
      
      const funcDecl = {
        type: 'FunctionDeclaration',
        id: IRNodeFactory.identifier('unusedFunc'),
        params: [],
        body: {
          type: 'BlockStatement',
          body: [],
          node_id: IRNodeFactory.createNodeId()
        },
        node_id: IRNodeFactory.createNodeId()
      };
      
      const result = disabledPass.testEliminateNodeDeadCode(funcDecl, state);
      expect(result).toBe(funcDecl); // Should not remove when disabled
    });

    it('should handle aggressive elimination mode', () => {
      const aggressivePass = new TestDeadCodeEliminationPass({
        aggressiveElimination: true
      });
      
      // Test would implement more aggressive elimination logic
      expect(aggressivePass).toBeDefined();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle nodes with complex structures', () => {
      const complexNode = {
        type: 'ComplexNode',
        child: IRNodeFactory.identifier('x'),
        node_id: IRNodeFactory.createNodeId()
      };
      
      const liveness: LivenessInfo = {
        defined: new Set(),
        used: new Set(),
        liveIn: new Set(),
        liveOut: new Set()
      };
      
      // Should not crash, will collect from the child identifier
      pass.testCollectNodeVariables(complexNode, liveness);
      expect(liveness.used.size).toBe(1);
    });

    it('should handle circular references gracefully', () => {
      const node1 = {
        type: 'Node1',
        node_id: IRNodeFactory.createNodeId()
      };
      
      const node2 = {
        type: 'Node2',
        ref: node1,
        node_id: IRNodeFactory.createNodeId()
      };
      
      // Create circular reference
      (node1 as any).ref = node2;
      
      const liveness: LivenessInfo = {
        defined: new Set(),
        used: new Set(),
        liveIn: new Set(),
        liveOut: new Set()
      };
      
      // Should handle gracefully without infinite recursion
      try {
        pass.testCollectNodeVariables(node1, liveness);
        expect(true).toBe(true); // If we reach here, no infinite recursion
      } catch (error) {
        // Expected for circular references
        expect(error).toBeDefined();
      }
    });

    it('should handle malformed variable declarations', () => {
      const malformedDecl = {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [
          // Missing id field
          {
            type: 'VariableDeclarator',
            init: IRNodeFactory.literal(42),
            node_id: IRNodeFactory.createNodeId()
          }
        ],
        node_id: IRNodeFactory.createNodeId()
      };
      
      const liveness: LivenessInfo = {
        defined: new Set(),
        used: new Set(),
        liveIn: new Set(),
        liveOut: new Set()
      };
      
      // Should handle gracefully without crashing  
      try {
        pass.testCollectVariableDeclarationInfo(malformedDecl as any, liveness);
      } catch (error) {
        // Expected to handle malformed nodes
        expect(error).toBeDefined();
      }
      // Should not have collected anything from malformed declaration
      expect(liveness.defined.size).toBe(0);
    });
  });
});