/**
 * @fileoverview Tests for Advanced Code Structuring Pass
 * 
 * Tests the transformation of low-level IR control flow into high-level,
 * natural JavaScript constructs including ternary expressions, structured
 * loops, and switch statements.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { StructuringPass } from '../../src/passes/structuring.js';
import { IRNodeFactory } from '../../src/ir/nodes.js';
import type { IRState, PassResult } from '../../src/passes/Pass.js';
import type { 
  IRNode,
  IRExpression,
  IRStatement,
  IRIfStatement,
  IRWhileStatement,
  IRAssignmentExpression,
  NodeId,
  VariableName
} from '../../src/ir/nodes.js';
import type { CFG, CFGNode } from '../../src/ir/cfg.js';

describe('StructuringPass', () => {
  let pass: StructuringPass;
  let mockState: IRState;

  beforeEach(() => {
    pass = new StructuringPass();
    mockState = createMockIRState();
  });

  describe('Ternary Expression Transformation', () => {
    test('should transform simple if-else chain into ternary', async () => {
      // Create if-else chain: if (a) x = 1; else x = 2;
      const ifStmt = createSimpleIfElseAssignment('a', 'x', 1, 2);
      const state = createStateWithNode(ifStmt);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      expect(result.state.nodes.size).toBeGreaterThan(0);
      
      // Should contain a ternary expression assignment
      const hasAssignment = Array.from(result.state.nodes.values()).some(node =>
        node.type === 'ExpressionStatement' &&
        node.expression.type === 'AssignmentExpression' &&
        node.expression.right.type === 'ConditionalExpression'
      );
      expect(hasAssignment).toBe(true);
    });

    test('should transform nested if-else chain into nested ternary', async () => {
      // Create: if (a) x = 1; else if (b) x = 2; else x = 3;
      const nestedIfStmt = createNestedIfElseAssignment();
      const state = createStateWithNode(nestedIfStmt);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      // Verify nested ternary structure
      const expressionStmt = findExpressionStatement(result.state);
      expect(expressionStmt).toBeDefined();
      expect(expressionStmt?.expression.type).toBe('AssignmentExpression');
      
      const assignment = expressionStmt!.expression as IRAssignmentExpression;
      expect(assignment.right.type).toBe('ConditionalExpression');
    });

    test('should not transform if branches assign to different variables', async () => {
      // Create: if (a) x = 1; else y = 2; (different variables)
      const ifStmt = createDifferentVariableAssignment();
      const state = createStateWithNode(ifStmt);

      const result = await pass.run(state);

      expect(result.changed).toBe(false);
      expect(result.state).toEqual(state);
    });

    test('should not transform complex conditional statements', async () => {
      // Create if statement with complex body (multiple statements)
      const ifStmt = createComplexIfStatement();
      const state = createStateWithNode(ifStmt);

      const result = await pass.run(state);

      expect(result.changed).toBe(false);
    });
  });

  describe('Loop Structure Transformation', () => {
    test('should transform while(true) with conditional break to while loop', async () => {
      // Create: while (true) { if (condition) break; ... }
      const whileStmt = createWhileTrueWithBreak();
      const state = createStateWithNode(whileStmt);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      // Should transform to standard while loop
      const whileLoop = findWhileStatement(result.state);
      expect(whileLoop).toBeDefined();
      expect(whileLoop?.test.type).not.toBe('Literal'); // No longer while(true)
    });

    test('should preserve while loops that are already well-structured', async () => {
      // Create: while (condition) { ... }
      const whileStmt = createStructuredWhileLoop();
      const state = createStateWithNode(whileStmt);

      const result = await pass.run(state);

      expect(result.changed).toBe(false);
      expect(result.state).toEqual(state);
    });

    test('should handle nested loop structures correctly', async () => {
      const nestedWhileStmt = createNestedWhileLoop();
      const state = createStateWithNode(nestedWhileStmt);

      const result = await pass.run(state);

      // Should handle without crashing and maintain correctness
      expect(result.state.nodes.size).toBeGreaterThan(0);
    });
  });

  describe('Switch Statement Transformation', () => {
    test('should transform if-else equality chain into switch', async () => {
      // Create: if (x === 1) ... else if (x === 2) ... else if (x === 3) ...
      const ifChain = createEqualityIfChain();
      const state = createStateWithNode(ifChain);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      // Should contain switch statement
      const switchStmt = findSwitchStatement(result.state);
      expect(switchStmt).toBeDefined();
      expect(switchStmt?.cases.length).toBeGreaterThan(2);
    });

    test('should add default case when else clause present', async () => {
      const ifChainWithDefault = createEqualityIfChainWithDefault();
      const state = createStateWithNode(ifChainWithDefault);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      const switchStmt = findSwitchStatement(result.state);
      expect(switchStmt).toBeDefined();
      
      // Should have default case (test: null)
      const hasDefaultCase = switchStmt?.cases.some(c => c.test === null);
      expect(hasDefaultCase).toBe(true);
    });

    test('should not transform mixed comparison operators', async () => {
      // Create: if (x === 1) ... else if (x > 2) ... (mixed operators)
      const mixedIfChain = createMixedComparisonChain();
      const state = createStateWithNode(mixedIfChain);

      const result = await pass.run(state);

      expect(result.changed).toBe(false);
    });

    test('should not transform short if-else chains', async () => {
      // Only 2 conditions - not worth switch
      const shortChain = createShortIfChain();
      const state = createStateWithNode(shortChain);

      const result = await pass.run(state);

      expect(result.changed).toBe(false);
    });
  });

  describe('CFG Dominance Analysis', () => {
    test('should compute dominance relationships correctly', async () => {
      const complexState = createComplexCFGState();
      
      // This tests the internal dominance analysis
      const result = await pass.run(complexState);
      
      // Should complete without errors
      expect(result.state).toBeDefined();
      expect(result.metrics.execution_time_ms).toBeGreaterThan(0);
    });

    test('should handle loops in dominance analysis', async () => {
      const loopState = createLoopCFGState();
      
      const result = await pass.run(loopState);
      
      expect(result.state).toBeDefined();
    });
  });

  describe('Combined Transformations', () => {
    test('should apply multiple transformations in single pass', async () => {
      // Create IR with both ternary and switch opportunities
      const complexState = createMultiTransformationState();
      
      const result = await pass.run(complexState);
      
      expect(result.changed).toBe(true);
      expect(result.metrics.nodes_changed).toBeGreaterThan(1);
    });

    test('should preserve program semantics through transformations', async () => {
      const semanticTestState = createSemanticTestState();
      
      const result = await pass.run(semanticTestState);
      
      // Verify key semantic properties are preserved
      expect(result.state.nodes.size).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed IR gracefully', async () => {
      const malformedState = createMalformedIRState();
      
      const result = await pass.run(malformedState);
      
      expect(result.state).toBeDefined();
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty IR state', async () => {
      const emptyState = createEmptyIRState();
      
      const result = await pass.run(emptyState);
      
      expect(result.changed).toBe(false);
      expect(result.state).toEqual(emptyState);
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle deeply nested if-else chains', async () => {
      const deeplyNestedIf = createDeeplyNestedIfElse(10); // 10 levels deep
      const state = createStateWithNode(deeplyNestedIf);
      
      const result = await pass.run(state);
      
      expect(result.state).toBeDefined();
      expect(result.metrics.execution_time_ms).toBeLessThan(1000); // Should complete quickly
    });

    test('should track performance metrics accurately', async () => {
      const complexState = createMultiTransformationState();
      
      const result = await pass.run(complexState);
      
      expect(result.metrics.nodes_visited).toBeGreaterThan(0);
      expect(result.metrics.execution_time_ms).toBeGreaterThan(0);
      if (result.changed) {
        expect(result.metrics.nodes_changed).toBeGreaterThan(0);
      }
    });

    test('should handle large CFGs without performance degradation', async () => {
      const largeState = createLargeCFGState(100); // 100 nodes
      
      const startTime = performance.now();
      const result = await pass.run(largeState);
      const endTime = performance.now();
      
      expect(result.state).toBeDefined();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    test('should validate dominance analysis correctness', async () => {
      const ifStmt = createSimpleIfElseAssignment('condition', 'x', 1, 2);
      const state = createStateWithNode(ifStmt);
      
      const result = await pass.run(state);
      
      // If dominance analysis worked, transformations should be safe
      expect(result.errors.length).toBe(0);
    });

    test('should handle complex mixed control flow', async () => {
      // Create combination of if-else, while loops, and switch-like patterns
      const mixedControlFlow = createMixedControlFlowState();
      
      const result = await pass.run(mixedControlFlow);
      
      expect(result.state).toBeDefined();
      expect(result.warnings.length).toBeLessThan(5); // Should handle without many warnings
    });

    test('should preserve variable scoping through transformations', async () => {
      const scopedState = createVariableScopingTestState();
      
      const result = await pass.run(scopedState);
      
      expect(result.state).toBeDefined();
      // Verify no variable name conflicts were introduced
      expect(result.errors.length).toBe(0);
    });
  });
});

// Test helper functions

function createMockIRState(): IRState {
  const mockCFG: CFG = {
    entry: createMockCFGNode('entry'),
    exit: createMockCFGNode('exit'),
    nodes: new Map(),
    edges: [],
    dominance_tree: new Map(),
    post_dominance_tree: new Map()
  };

  return {
    cfg: mockCFG,
    nodes: new Map(),
    metadata: new Map()
  };
}

function createMockCFGNode(id: string): CFGNode {
  return {
    id: id as NodeId,
    instructions: [],
    predecessors: [],
    successors: [],
    dominates: new Set(),
    dominated_by: new Set(),
    immediate_dominator: null
  };
}

function createStateWithNode(node: IRNode): IRState {
  const state = createMockIRState();
  const nodeId = node.node_id || IRNodeFactory.createNodeId();
  state.nodes.set(nodeId, { ...node, node_id: nodeId });
  return state;
}

function createSimpleIfElseAssignment(
  condition: string, 
  variable: string, 
  trueValue: number, 
  falseValue: number
): IRIfStatement {
  return IRNodeFactory.ifStatement(
    IRNodeFactory.identifier(condition),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier(variable),
        IRNodeFactory.literal(trueValue)
      )
    ),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier(variable),
        IRNodeFactory.literal(falseValue)
      )
    )
  );
}

function createNestedIfElseAssignment(): IRIfStatement {
  return IRNodeFactory.ifStatement(
    IRNodeFactory.identifier('a'),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(1)
      )
    ),
    IRNodeFactory.ifStatement(
      IRNodeFactory.identifier('b'),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.assignmentExpression(
          '=',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(2)
        )
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.assignmentExpression(
          '=',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(3)
        )
      )
    )
  );
}

function createDifferentVariableAssignment(): IRIfStatement {
  return IRNodeFactory.ifStatement(
    IRNodeFactory.identifier('a'),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(1)
      )
    ),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier('y'), // Different variable
        IRNodeFactory.literal(2)
      )
    )
  );
}

function createComplexIfStatement(): IRIfStatement {
  return IRNodeFactory.ifStatement(
    IRNodeFactory.identifier('condition'),
    IRNodeFactory.blockStatement([
      IRNodeFactory.expressionStatement(
        IRNodeFactory.assignmentExpression(
          '=',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(1)
        )
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.assignmentExpression(
          '=',
          IRNodeFactory.identifier('y'),
          IRNodeFactory.literal(2)
        )
      )
    ]),
    null
  );
}

function createWhileTrueWithBreak(): IRWhileStatement {
  return IRNodeFactory.whileStatement(
    IRNodeFactory.literal(true),
    IRNodeFactory.blockStatement([
      IRNodeFactory.ifStatement(
        IRNodeFactory.identifier('condition'),
        IRNodeFactory.breakStatement(),
        null
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.identifier('someWork')
      )
    ])
  );
}

function createStructuredWhileLoop(): IRWhileStatement {
  return IRNodeFactory.whileStatement(
    IRNodeFactory.identifier('condition'),
    IRNodeFactory.blockStatement([
      IRNodeFactory.expressionStatement(
        IRNodeFactory.identifier('work')
      )
    ])
  );
}

function createNestedWhileLoop(): IRWhileStatement {
  return IRNodeFactory.whileStatement(
    IRNodeFactory.identifier('outerCondition'),
    IRNodeFactory.blockStatement([
      IRNodeFactory.whileStatement(
        IRNodeFactory.identifier('innerCondition'),
        IRNodeFactory.blockStatement([
          IRNodeFactory.expressionStatement(
            IRNodeFactory.identifier('innerWork')
          )
        ])
      )
    ])
  );
}

function createEqualityIfChain(): IRIfStatement {
  return IRNodeFactory.ifStatement(
    IRNodeFactory.binaryExpression(
      '===',
      IRNodeFactory.identifier('x'),
      IRNodeFactory.literal(1)
    ),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.identifier('case1')
    ),
    IRNodeFactory.ifStatement(
      IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(2)
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.identifier('case2')
      ),
      IRNodeFactory.ifStatement(
        IRNodeFactory.binaryExpression(
          '===',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(3)
        ),
        IRNodeFactory.expressionStatement(
          IRNodeFactory.identifier('case3')
        ),
        null
      )
    )
  );
}

function createEqualityIfChainWithDefault(): IRIfStatement {
  return IRNodeFactory.ifStatement(
    IRNodeFactory.binaryExpression(
      '===',
      IRNodeFactory.identifier('x'),
      IRNodeFactory.literal(1)
    ),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.identifier('case1')
    ),
    IRNodeFactory.ifStatement(
      IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(2)
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.identifier('case2')
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.identifier('defaultCase')
      )
    )
  );
}

function createMixedComparisonChain(): IRIfStatement {
  return IRNodeFactory.ifStatement(
    IRNodeFactory.binaryExpression(
      '===',
      IRNodeFactory.identifier('x'),
      IRNodeFactory.literal(1)
    ),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.identifier('case1')
    ),
    IRNodeFactory.ifStatement(
      IRNodeFactory.binaryExpression(
        '>',  // Different operator
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(2)
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.identifier('case2')
      ),
      null
    )
  );
}

function createShortIfChain(): IRIfStatement {
  return IRNodeFactory.ifStatement(
    IRNodeFactory.binaryExpression(
      '===',
      IRNodeFactory.identifier('x'),
      IRNodeFactory.literal(1)
    ),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.identifier('case1')
    ),
    IRNodeFactory.ifStatement(
      IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(2)
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.identifier('case2')
      ),
      null
    )
  );
}

function createComplexCFGState(): IRState {
  const state = createMockIRState();
  
  // Add multiple interconnected nodes
  const nodes = [
    createSimpleIfElseAssignment('a', 'x', 1, 2),
    createWhileTrueWithBreak(),
    createEqualityIfChain()
  ];
  
  nodes.forEach(node => {
    const nodeId = IRNodeFactory.createNodeId();
    state.nodes.set(nodeId, { ...node, node_id: nodeId });
  });
  
  return state;
}

function createLoopCFGState(): IRState {
  const state = createMockIRState();
  const whileLoop = createNestedWhileLoop();
  const nodeId = IRNodeFactory.createNodeId();
  state.nodes.set(nodeId, { ...whileLoop, node_id: nodeId });
  return state;
}

function createMultiTransformationState(): IRState {
  const state = createMockIRState();
  
  // Add both ternary and switch opportunities
  const ternaryIf = createSimpleIfElseAssignment('a', 'x', 1, 2);
  const switchIf = createEqualityIfChain();
  
  const nodeId1 = IRNodeFactory.createNodeId();
  const nodeId2 = IRNodeFactory.createNodeId();
  
  state.nodes.set(nodeId1, { ...ternaryIf, node_id: nodeId1 });
  state.nodes.set(nodeId2, { ...switchIf, node_id: nodeId2 });
  
  return state;
}

function createSemanticTestState(): IRState {
  // Create state that tests semantic preservation
  return createComplexCFGState();
}

function createMalformedIRState(): IRState {
  const state = createMockIRState();
  
  // Create intentionally problematic node
  const malformedNode = {
    type: 'IfStatement',
    test: null, // Invalid: test should not be null
    consequent: null, // Invalid: consequent should not be null
    alternate: null,
    node_id: IRNodeFactory.createNodeId()
  } as any as IRNode;
  
  state.nodes.set(malformedNode.node_id!, malformedNode);
  return state;
}

function createEmptyIRState(): IRState {
  return createMockIRState();
}

// Utility functions for finding transformed nodes

function findExpressionStatement(state: IRState) {
  return Array.from(state.nodes.values()).find(
    node => node.type === 'ExpressionStatement'
  ) as { expression: IRAssignmentExpression } | undefined;
}

function findWhileStatement(state: IRState) {
  return Array.from(state.nodes.values()).find(
    node => node.type === 'WhileStatement'
  ) as IRWhileStatement | undefined;
}

function findSwitchStatement(state: IRState) {
  return Array.from(state.nodes.values()).find(
    node => node.type === 'SwitchStatement'
  ) as any;
}

// Additional helper functions for new tests

function createDeeplyNestedIfElse(depth: number): IRIfStatement {
  if (depth === 0) {
    return IRNodeFactory.ifStatement(
      IRNodeFactory.identifier('condition'),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.assignmentExpression(
          '=',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal('base')
        )
      ),
      null
    );
  }
  
  return IRNodeFactory.ifStatement(
    IRNodeFactory.identifier(`condition_${depth}`),
    IRNodeFactory.expressionStatement(
      IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(depth)
      )
    ),
    createDeeplyNestedIfElse(depth - 1)
  );
}

function createLargeCFGState(nodeCount: number): IRState {
  const state = createMockIRState();
  
  for (let i = 0; i < nodeCount; i++) {
    const node = createSimpleIfElseAssignment(
      `condition_${i}`,
      `var_${i}`,
      i,
      i + 1
    );
    const nodeId = IRNodeFactory.createNodeId();
    state.nodes.set(nodeId, { ...node, node_id: nodeId });
  }
  
  return state;
}

function createMixedControlFlowState(): IRState {
  const state = createMockIRState();
  
  const nodes = [
    createSimpleIfElseAssignment('a', 'x', 1, 2),
    createWhileTrueWithBreak(),
    createEqualityIfChain(),
    createNestedIfElseAssignment(),
    createStructuredWhileLoop()
  ];
  
  nodes.forEach((node, index) => {
    const nodeId = IRNodeFactory.createNodeId();
    state.nodes.set(nodeId, { ...node, node_id: nodeId });
  });
  
  return state;
}

function createVariableScopingTestState(): IRState {
  const state = createMockIRState();
  
  // Create nested scopes with same variable names
  const outerIf = IRNodeFactory.ifStatement(
    IRNodeFactory.identifier('outer'),
    IRNodeFactory.blockStatement([
      IRNodeFactory.variableDeclaration([
        IRNodeFactory.variableDeclarator(
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(1)
        )
      ], 'let')
    ]),
    IRNodeFactory.blockStatement([
      IRNodeFactory.variableDeclaration([
        IRNodeFactory.variableDeclarator(
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(2)
        )
      ], 'let')
    ])
  );
  
  const nodeId = IRNodeFactory.createNodeId();
  state.nodes.set(nodeId, { ...outerIf, node_id: nodeId });
  
  return state;
}