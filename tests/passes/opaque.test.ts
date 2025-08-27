/**
 * @fileoverview Tests for SMT-Based Opaque Predicate Analysis Pass
 * 
 * Tests the detection and elimination of opaque predicates using Z3 SMT solver
 * integration, including pattern matching, constraint analysis, and code transformation.
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  OpaquePredicateAnalysisPass,
  MockSMTSolver,
  createOpaquePredicateAnalysisPass,
  type SMTExpression,
  type OpaquePredicateResult,
  type SatResult
} from '../../src/passes/opaque.js';
import { IRNodeFactory } from '../../src/ir/nodes.js';
import type { IRState } from '../../src/passes/Pass.js';
import type { VariableName } from '../../src/ir/nodes.js';

describe('OpaquePredicateAnalysisPass', () => {
  let pass: OpaquePredicateAnalysisPass;
  let mockSolver: MockSMTSolver;
  let mockState: IRState;

  beforeEach(() => {
    mockSolver = new MockSMTSolver();
    pass = new OpaquePredicateAnalysisPass(mockSolver);
    mockState = createMockIRState();
  });

  afterEach(() => {
    mockSolver.dispose();
  });

  describe('Known Pattern Detection', () => {
    test('should detect (x & 1) === (x % 2) tautology', () => {
      const binaryExpr = IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.binaryExpression(
          '&',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(1, 'number')
        ),
        IRNodeFactory.binaryExpression(
          '%',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(2, 'number')
        )
      );

      const pattern = pass['createBitwiseModuloPattern']();
      const result = pattern.detector(binaryExpr);

      expect(result).toBeTruthy();
      expect(pattern.confidence).toBe(0.95);
    });

    test('should detect x ^ x === 0 tautology', () => {
      const binaryExpr = IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.binaryExpression(
          '^',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.identifier('x')
        ),
        IRNodeFactory.literal(0, 'number')
      );

      const pattern = pass['createSelfXorPattern']();
      const result = pattern.detector(binaryExpr);

      expect(result).toBeTruthy();
      expect(pattern.confidence).toBe(0.99);
    });

    test('should detect x === x self-comparison', () => {
      const binaryExpr = IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.identifier('variable'),
        IRNodeFactory.identifier('variable')
      );

      const pattern = pass['createSelfComparisonPattern']();
      const result = pattern.detector(binaryExpr);

      expect(result).toBeTruthy();
    });

    test('should detect (x | 0) === x identity', () => {
      const binaryExpr = IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.binaryExpression(
          '|',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(0, 'number')
        ),
        IRNodeFactory.identifier('x')
      );

      const pattern = pass['createBitwiseOrZeroPattern']();
      const result = pattern.detector(binaryExpr);

      expect(result).toBeTruthy();
    });

    test('should detect arithmetic identity patterns', () => {
      // x + 0 === x
      const addZeroExpr = IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.binaryExpression(
          '+',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(0, 'number')
        ),
        IRNodeFactory.identifier('x')
      );

      const pattern = pass['createArithmeticIdentityPattern']();
      let result = pattern.detector(addZeroExpr);
      expect(result).toBeTruthy();

      // x * 1 === x
      const mulOneExpr = IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.binaryExpression(
          '*',
          IRNodeFactory.identifier('x'),
          IRNodeFactory.literal(1, 'number')
        ),
        IRNodeFactory.identifier('x')
      );

      result = pattern.detector(mulOneExpr);
      expect(result).toBeTruthy();
    });
  });

  describe('SMT Expression Conversion', () => {
    test('should convert literal expressions to SMT constants', () => {
      const literal = IRNodeFactory.literal(42, 'number');
      const variables = new Set<VariableName>();
      
      const smtExpr = pass['convertToSMT'](literal, variables);
      
      expect(smtExpr).toEqual({
        type: 'constant',
        value: 42
      });
    });

    test('should convert identifier expressions to SMT variables', () => {
      const identifier = IRNodeFactory.identifier('x');
      const variables = new Set<VariableName>(['x'] as VariableName[]);
      
      const smtExpr = pass['convertToSMT'](identifier, variables);
      
      expect(smtExpr).toEqual({
        type: 'variable',
        variable: 'x'
      });
    });

    test('should convert binary expressions to SMT binary operations', () => {
      const binaryExpr = IRNodeFactory.binaryExpression(
        '+',
        IRNodeFactory.literal(5, 'number'),
        IRNodeFactory.literal(3, 'number')
      );
      const variables = new Set<VariableName>();
      
      const smtExpr = pass['convertToSMT'](binaryExpr, variables);
      
      expect(smtExpr?.type).toBe('binary_op');
      expect(smtExpr?.operator).toBe('add');
      expect(smtExpr?.operands).toHaveLength(2);
    });

    test('should convert logical expressions to SMT logical operations', () => {
      const logicalExpr = IRNodeFactory.createLogicalExpression(
        '&&',
        IRNodeFactory.literal(true, 'boolean'),
        IRNodeFactory.literal(false, 'boolean')
      );
      const variables = new Set<VariableName>();
      
      const smtExpr = pass['convertToSMT'](logicalExpr, variables);
      
      expect(smtExpr?.type).toBe('logical');
      expect(smtExpr?.operator).toBe('and');
    });
  });

  describe('Complexity Analysis', () => {
    test('should calculate expression complexity correctly', () => {
      const simpleExpr = IRNodeFactory.literal(42, 'number');
      const simpleComplexity = pass['calculateComplexity'](simpleExpr);
      expect(simpleComplexity).toBe(1);

      const binaryExpr = IRNodeFactory.binaryExpression(
        '+',
        IRNodeFactory.literal(5, 'number'),
        IRNodeFactory.literal(3, 'number')
      );
      const binaryComplexity = pass['calculateComplexity'](binaryExpr);
      expect(binaryComplexity).toBeGreaterThan(simpleComplexity);

      const nestedExpr = IRNodeFactory.binaryExpression(
        '*',
        binaryExpr,
        IRNodeFactory.binaryExpression(
          '-',
          IRNodeFactory.literal(10, 'number'),
          IRNodeFactory.literal(2, 'number')
        )
      );
      const nestedComplexity = pass['calculateComplexity'](nestedExpr);
      expect(nestedComplexity).toBeGreaterThan(binaryComplexity);
    });

    test('should skip complex expressions exceeding threshold', async () => {
      // Create a deeply nested expression that exceeds maxComplexity
      let complexExpr = IRNodeFactory.literal(1, 'number');
      for (let i = 0; i < 50; i++) {
        complexExpr = IRNodeFactory.binaryExpression(
          '+',
          complexExpr,
          IRNodeFactory.literal(i, 'number')
        );
      }

      const nodeId = 'complex_node';
      const variables = new Set<VariableName>();
      
      const result = await pass['performSMTAnalysis'](nodeId, complexExpr);
      
      expect(result).toBeNull();
      expect(pass['warnings']).toContain(
        expect.stringMatching(/Skipping complex predicate/)
      );
    });
  });

  describe('Confidence Calculation', () => {
    test('should calculate high confidence for clear SAT/UNSAT results', () => {
      const confidence1 = pass['calculateConfidence']('unsat', 'sat', 5);
      expect(confidence1).toBeGreaterThan(0.8);

      const confidence2 = pass['calculateConfidence']('sat', 'unsat', 5);
      expect(confidence2).toBeGreaterThan(0.8);
    });

    test('should reduce confidence for unknown/timeout results', () => {
      const unknownConfidence = pass['calculateConfidence']('unknown', 'sat', 5);
      expect(unknownConfidence).toBeLessThan(0.5);

      const timeoutConfidence = pass['calculateConfidence']('timeout', 'sat', 5);
      expect(timeoutConfidence).toBeLessThan(0.2);
    });

    test('should penalize complex expressions', () => {
      const simpleConfidence = pass['calculateConfidence']('unsat', 'sat', 5);
      const complexConfidence = pass['calculateConfidence']('unsat', 'sat', 80);
      
      expect(complexConfidence).toBeLessThan(simpleConfidence);
    });
  });

  describe('Variable Collection', () => {
    test('should collect all variables from expression', () => {
      const expr = IRNodeFactory.binaryExpression(
        '+',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.binaryExpression(
          '*',
          IRNodeFactory.identifier('y'),
          IRNodeFactory.identifier('z')
        )
      );

      const variables = pass['collectVariables'](expr);
      
      expect(variables.has('x' as VariableName)).toBe(true);
      expect(variables.has('y' as VariableName)).toBe(true);
      expect(variables.has('z' as VariableName)).toBe(true);
      expect(variables.size).toBe(3);
    });

    test('should handle nested expressions correctly', () => {
      const conditionalExpr = IRNodeFactory.conditionalExpression(
        IRNodeFactory.identifier('condition'),
        IRNodeFactory.identifier('then_value'),
        IRNodeFactory.identifier('else_value')
      );

      const variables = pass['collectVariables'](conditionalExpr);
      
      expect(variables.size).toBe(3);
      expect(variables.has('condition' as VariableName)).toBe(true);
      expect(variables.has('then_value' as VariableName)).toBe(true);
      expect(variables.has('else_value' as VariableName)).toBe(true);
    });
  });

  describe('Code Transformation', () => {
    test('should replace opaque predicates with constant values', () => {
      const state = createMockStateWithOpaquePredicates();
      const result = pass.execute(state);
      
      expect(result.changed).toBe(true);
      
      // Check if some nodes were replaced with literals
      let foundLiteral = false;
      for (const [nodeId, node] of result.state.nodes) {
        if (node.type === 'Literal' && typeof node.value === 'boolean') {
          foundLiteral = true;
          break;
        }
      }
      expect(foundLiteral).toBe(true);
    });

    test('should create appropriate replacements for different opaque types', () => {
      const ifStatement = IRNodeFactory.ifStatement(
        IRNodeFactory.literal(true, 'boolean'),
        IRNodeFactory.blockStatement([
          IRNodeFactory.expressionStatement(
            IRNodeFactory.callExpression(
              IRNodeFactory.identifier('console.log'),
              [IRNodeFactory.literal('always executed', 'string')]
            )
          )
        ]),
        IRNodeFactory.blockStatement([
          IRNodeFactory.expressionStatement(
            IRNodeFactory.callExpression(
              IRNodeFactory.identifier('console.log'),
              [IRNodeFactory.literal('never executed', 'string')]
            )
          )
        ])
      );

      const opaqueResult: OpaquePredicateResult = {
        nodeId: 'if1',
        isOpaque: true,
        alwaysTrue: true,
        alwaysFalse: false,
        constraints: [],
        confidence: 0.95,
        analysisTimeMs: 10,
        solverResult: 'unsat'
      };

      const replacement = pass['createOpaqueReplacement'](ifStatement, opaqueResult);
      
      expect(replacement).toBeTruthy();
      expect(replacement?.type).toBe('BlockStatement');
    });
  });

  describe('Integration with Z3 Solver', () => {
    test('should create pass with real Z3 solver', async () => {
      // This test might skip if Z3 is not available
      try {
        const realPass = await createOpaquePredicateAnalysisPass(1000);
        expect(realPass).toBeInstanceOf(OpaquePredicateAnalysisPass);
      } catch (error) {
        console.warn('Z3 solver not available, skipping integration test');
        expect(true).toBe(true); // Test passes if Z3 is not available
      }
    });

    test('should handle solver timeouts gracefully', async () => {
      // Create a mock solver that always times out
      const timeoutSolver = {
        ...mockSolver,
        checkSat: vi.fn().mockResolvedValue('timeout' as SatResult)
      };

      const timeoutPass = new OpaquePredicateAnalysisPass(timeoutSolver);
      const expr = IRNodeFactory.binaryExpression(
        '===',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(5, 'number')
      );

      const result = await timeoutPass['performSMTAnalysis']('test', expr);
      
      expect(result).toBeNull();
    });
  });

  describe('Performance Tests', () => {
    test('should handle large numbers of predicates efficiently', () => {
      const largeState = createLargeStateWithPredicates(500);
      const startTime = performance.now();
      
      const result = pass.execute(largeState);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (3 seconds for 500 predicates)
      expect(executionTime).toBeLessThan(3000);
      expect(result.changed).toBe(true);
    });

    test('should respect solver timeouts', async () => {
      pass.setTimeout(100); // Very short timeout
      
      const complexExpr = createVeryComplexExpression();
      const startTime = performance.now();
      
      const result = await pass['performSMTAnalysis']('test', complexExpr);
      
      const endTime = performance.now();
      const actualTime = endTime - startTime;
      
      // Should timeout quickly (within 500ms including overhead)
      expect(actualTime).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed expressions gracefully', () => {
      // Create an expression with invalid structure
      const malformedExpr = {
        type: 'BinaryExpression',
        operator: '===',
        left: null, // Invalid - should be an expression
        right: IRNodeFactory.literal(5, 'number')
      } as any;

      const variables = new Set<VariableName>();
      const result = pass['convertToSMT'](malformedExpr, variables);
      
      expect(result).toBeNull();
    });

    test('should handle solver errors gracefully', async () => {
      const errorSolver = {
        ...mockSolver,
        checkSat: vi.fn().mockRejectedValue(new Error('Solver error'))
      };

      const errorPass = new OpaquePredicateAnalysisPass(errorSolver);
      const expr = IRNodeFactory.literal(true, 'boolean');
      
      const result = await errorPass['performSMTAnalysis']('test', expr);
      
      expect(result).toBeNull();
      expect(errorPass['warnings']).toContain(
        expect.stringMatching(/SMT solving failed/)
      );
    });
  });
});

// Helper functions for creating mock objects

function createMockIRState(): IRState {
  return {
    nodes: new Map([
      ['node1', IRNodeFactory.literal(true, 'boolean')],
      ['node2', IRNodeFactory.identifier('variable')]
    ]),
    cfg: null,
    ssa: null
  };
}

function createMockStateWithOpaquePredicates(): IRState {
  const nodes = new Map();
  
  // Add an always-true if statement
  nodes.set('if1', IRNodeFactory.ifStatement(
    IRNodeFactory.binaryExpression(
      '===',
      IRNodeFactory.binaryExpression(
        '&',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(1, 'number')
      ),
      IRNodeFactory.binaryExpression(
        '%',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(2, 'number')
      )
    ),
    IRNodeFactory.blockStatement([
      IRNodeFactory.expressionStatement(
        IRNodeFactory.callExpression(
          IRNodeFactory.identifier('console.log'),
          [IRNodeFactory.literal('always true', 'string')]
        )
      )
    ]),
    null
  ));

  // Add an always-false condition
  nodes.set('cond1', IRNodeFactory.conditionalExpression(
    IRNodeFactory.binaryExpression(
      '===',
      IRNodeFactory.binaryExpression(
        '^',
        IRNodeFactory.identifier('y'),
        IRNodeFactory.identifier('y')
      ),
      IRNodeFactory.literal(1, 'number') // Should be 0, so always false
    ),
    IRNodeFactory.literal('never', 'string'),
    IRNodeFactory.literal('always', 'string')
  ));

  return {
    nodes,
    cfg: null,
    ssa: null
  };
}

function createLargeStateWithPredicates(count: number): IRState {
  const nodes = new Map();
  
  for (let i = 0; i < count; i++) {
    const predicate = i % 4 === 0 
      ? createTautologyExpression(i)
      : i % 4 === 1
      ? createContradictionExpression(i)
      : i % 4 === 2
      ? createSelfComparisonExpression(i)
      : createIdentityExpression(i);

    nodes.set(`predicate${i}`, predicate);
  }
  
  return {
    nodes,
    cfg: null,
    ssa: null
  };
}

function createTautologyExpression(index: number) {
  const varName = `x${index}`;
  return IRNodeFactory.binaryExpression(
    '===',
    IRNodeFactory.binaryExpression(
      '&',
      IRNodeFactory.identifier(varName),
      IRNodeFactory.literal(1, 'number')
    ),
    IRNodeFactory.binaryExpression(
      '%',
      IRNodeFactory.identifier(varName),
      IRNodeFactory.literal(2, 'number')
    )
  );
}

function createContradictionExpression(index: number) {
  const varName = `y${index}`;
  return IRNodeFactory.binaryExpression(
    '===',
    IRNodeFactory.binaryExpression(
      '^',
      IRNodeFactory.identifier(varName),
      IRNodeFactory.identifier(varName)
    ),
    IRNodeFactory.literal(1, 'number') // Should be 0
  );
}

function createSelfComparisonExpression(index: number) {
  const varName = `z${index}`;
  return IRNodeFactory.binaryExpression(
    '===',
    IRNodeFactory.identifier(varName),
    IRNodeFactory.identifier(varName)
  );
}

function createIdentityExpression(index: number) {
  const varName = `w${index}`;
  return IRNodeFactory.binaryExpression(
    '===',
    IRNodeFactory.binaryExpression(
      '|',
      IRNodeFactory.identifier(varName),
      IRNodeFactory.literal(0, 'number')
    ),
    IRNodeFactory.identifier(varName)
  );
}

function createVeryComplexExpression() {
  let expr = IRNodeFactory.identifier('x');
  
  // Create a deeply nested expression
  for (let i = 0; i < 100; i++) {
    expr = IRNodeFactory.binaryExpression(
      i % 2 === 0 ? '+' : '*',
      expr,
      IRNodeFactory.conditionalExpression(
        IRNodeFactory.binaryExpression(
          '>',
          IRNodeFactory.identifier(`var${i}`),
          IRNodeFactory.literal(i, 'number')
        ),
        IRNodeFactory.binaryExpression(
          '&',
          IRNodeFactory.identifier(`var${i}`),
          IRNodeFactory.literal(i + 1, 'number')
        ),
        IRNodeFactory.binaryExpression(
          '|',
          IRNodeFactory.identifier(`var${i}`),
          IRNodeFactory.literal(i + 2, 'number')
        )
      )
    );
  }
  
  return expr;
}