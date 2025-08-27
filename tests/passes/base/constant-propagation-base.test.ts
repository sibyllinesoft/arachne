/**
 * @fileoverview Tests for constant propagation base class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ConstantPropagationBase,
  type LatticeValue,
  type ConstantPropagationConfig,
  type ConstantPropagationStats,
  type TopValue,
  type BottomValue,
  type ConstantValue
} from '../../../src/passes/base/constant-propagation-base.ts';
import { IRNodeFactory } from '../../../src/ir/nodes.ts';
import type { IRState, IRNode, IRLiteral, IRIdentifier, IRBinaryExpression, IRUnaryExpression, IRVariableDeclaration, IRAssignmentExpression, NodeId } from '../../../src/ir/nodes.ts';
import type { CFG } from '../../../src/ir/cfg.ts';

// Concrete implementation for testing
class TestConstantPropagationPass extends ConstantPropagationBase {
  constructor(config?: ConstantPropagationConfig) {
    super(config);
  }

  get name(): string {
    return 'test-constant-propagation';
  }

  get description(): string {
    return 'Test constant propagation pass';
  }

  // Expose protected methods for testing
  public testEvaluateNode(node: IRNode, constants: Map<NodeId, LatticeValue>): LatticeValue {
    return this.evaluateNode(node, constants);
  }

  public testEvaluateLiteral(node: IRLiteral): LatticeValue {
    return this.evaluateLiteral(node);
  }

  public testEvaluateIdentifier(node: IRIdentifier): LatticeValue {
    return this.evaluateIdentifier(node);
  }

  public testEvaluateBinaryExpression(node: IRBinaryExpression, constants: Map<NodeId, LatticeValue>): LatticeValue {
    return this.evaluateBinaryExpression(node, constants);
  }

  public testEvaluateUnaryExpression(node: IRUnaryExpression, constants: Map<NodeId, LatticeValue>): LatticeValue {
    return this.evaluateUnaryExpression(node, constants);
  }

  public testEvaluateBinaryOperation(
    operator: string,
    left: string | number | boolean | null | bigint,
    right: string | number | boolean | null | bigint
  ): string | number | boolean | null | bigint {
    return this.evaluateBinaryOperation(operator, left, right);
  }

  public testEvaluateUnaryOperation(
    operator: string,
    operand: string | number | boolean | null | bigint
  ): string | number | boolean | null {
    return this.evaluateUnaryOperation(operator, operand);
  }

  public testEvaluateComparisonOperation(
    operator: string,
    left: string | number | boolean | null | bigint,
    right: string | number | boolean | null | bigint
  ): boolean {
    return this.evaluateComparisonOperation(operator, left, right);
  }

  public testEvaluateBitwiseOperation(
    operator: string,
    left: string | number | boolean | null | bigint,
    right: string | number | boolean | null | bigint
  ): number {
    return this.evaluateBitwiseOperation(operator, left, right);
  }

  public testEvaluateLogicalOperation(
    operator: string,
    left: string | number | boolean | null | bigint,
    right: string | number | boolean | null | bigint
  ): string | number | boolean | null | bigint {
    return this.evaluateLogicalOperation(operator, left, right);
  }

  public testCreateTop(): TopValue {
    return this.createTop();
  }

  public testCreateBottom(): BottomValue {
    return this.createBottom();
  }

  public testCreateConstant(value: string | number | boolean | null | bigint, confidence?: number): ConstantValue {
    return this.createConstant(value, confidence);
  }

  public testResetState(): void {
    return this.resetState();
  }

  public testAnalyzeConstants(state: IRState): Map<NodeId, LatticeValue> {
    return this.analyzeConstants(state);
  }

  public testPropagateConstants(
    state: IRState,
    constants: Map<NodeId, LatticeValue>
  ): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    return this.propagateConstants(state, constants);
  }

  public testTransformNode(node: IRNode, constants: Map<NodeId, LatticeValue>): IRNode {
    return this.transformNode(node, constants);
  }

  public testGetNodeValue(node: IRNode, constants: Map<NodeId, LatticeValue>): LatticeValue {
    return this.getNodeValue(node, constants);
  }
}

describe('ConstantPropagationBase', () => {
  let pass: TestConstantPropagationPass;
  let state: IRState;

  beforeEach(() => {
    pass = new TestConstantPropagationPass();
    
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
      const defaultPass = new TestConstantPropagationPass();
      expect(defaultPass.name).toBe('test-constant-propagation');
      expect(defaultPass.description).toBe('Test constant propagation pass');
    });

    it('should create with custom configuration', () => {
      const config: ConstantPropagationConfig = {
        confidenceThreshold: 0.8,
        enableArithmeticEvaluation: false,
        enableStringConcatenation: false,
        enableBooleanEvaluation: false,
        maxIterations: 50
      };
      const customPass = new TestConstantPropagationPass(config);
      expect(customPass).toBeDefined();
    });

    it('should have correct initial statistics', () => {
      const stats = pass.getStats();
      expect(stats.constantsFound).toBe(0);
      expect(stats.expressionsEvaluated).toBe(0);
      expect(stats.nodesReplaced).toBe(0);
      expect(stats.iterations).toBe(0);
    });
  });

  describe('lattice value creation', () => {
    it('should create top value', () => {
      const topValue = pass.testCreateTop();
      expect(topValue.type).toBe('top');
    });

    it('should create bottom value', () => {
      const bottomValue = pass.testCreateBottom();
      expect(bottomValue.type).toBe('bottom');
    });

    it('should create constant value with default confidence', () => {
      const constantValue = pass.testCreateConstant(42);
      expect(constantValue.type).toBe('constant');
      expect(constantValue.value).toBe(42);
      expect(constantValue.confidence).toBe(1.0);
    });

    it('should create constant value with custom confidence', () => {
      const constantValue = pass.testCreateConstant('hello', 0.8);
      expect(constantValue.type).toBe('constant');
      expect(constantValue.value).toBe('hello');
      expect(constantValue.confidence).toBe(0.8);
    });
  });

  describe('literal evaluation', () => {
    it('should evaluate string literal', () => {
      const literal = IRNodeFactory.literal('hello world');
      const result = pass.testEvaluateLiteral(literal);
      expect(result.type).toBe('constant');
      if (result.type === 'constant') {
        expect(result.value).toBe('hello world');
        expect(result.confidence).toBe(1.0);
      }
    });

    it('should evaluate number literal', () => {
      const literal = IRNodeFactory.literal(42);
      const result = pass.testEvaluateLiteral(literal);
      expect(result.type).toBe('constant');
      if (result.type === 'constant') {
        expect(result.value).toBe(42);
        expect(result.confidence).toBe(1.0);
      }
    });

    it('should evaluate boolean literal', () => {
      const literal = IRNodeFactory.literal(true);
      const result = pass.testEvaluateLiteral(literal);
      expect(result.type).toBe('constant');
      if (result.type === 'constant') {
        expect(result.value).toBe(true);
        expect(result.confidence).toBe(1.0);
      }
    });

    it('should evaluate null literal', () => {
      const literal = IRNodeFactory.literal(null);
      const result = pass.testEvaluateLiteral(literal);
      expect(result.type).toBe('constant');
      if (result.type === 'constant') {
        expect(result.value).toBe(null);
        expect(result.confidence).toBe(1.0);
      }
    });

    it('should not evaluate regex literal', () => {
      const literal = IRNodeFactory.literal(/test/g);
      const result = pass.testEvaluateLiteral(literal);
      expect(result.type).toBe('top');
    });

    it('should evaluate bigint literal', () => {
      const literal = IRNodeFactory.literal(123n);
      const result = pass.testEvaluateLiteral(literal);
      expect(result.type).toBe('constant');
      if (result.type === 'constant') {
        expect(result.value).toBe(123n);
        expect(result.confidence).toBe(1.0);
      }
    });
  });

  describe('binary operation evaluation', () => {
    describe('arithmetic operations', () => {
      it('should evaluate addition of numbers', () => {
        const result = pass.testEvaluateBinaryOperation('+', 5, 3);
        expect(result).toBe(8);
      });

      it('should evaluate string concatenation', () => {
        const result = pass.testEvaluateBinaryOperation('+', 'hello', 'world');
        expect(result).toBe('helloworld');
      });

      it('should evaluate mixed string and number addition', () => {
        const result = pass.testEvaluateBinaryOperation('+', '5', 3);
        expect(result).toBe('53');
      });

      it('should evaluate subtraction', () => {
        const result = pass.testEvaluateBinaryOperation('-', 10, 3);
        expect(result).toBe(7);
      });

      it('should evaluate multiplication', () => {
        const result = pass.testEvaluateBinaryOperation('*', 5, 4);
        expect(result).toBe(20);
      });

      it('should evaluate division', () => {
        const result = pass.testEvaluateBinaryOperation('/', 10, 2);
        expect(result).toBe(5);
      });

      it('should throw on division by zero', () => {
        expect(() => pass.testEvaluateBinaryOperation('/', 5, 0)).toThrow('Division by zero');
      });

      it('should evaluate modulus', () => {
        const result = pass.testEvaluateBinaryOperation('%', 10, 3);
        expect(result).toBe(1);
      });

      it('should evaluate exponentiation', () => {
        const result = pass.testEvaluateBinaryOperation('**', 2, 3);
        expect(result).toBe(8);
      });
    });

    describe('comparison operations', () => {
      it('should evaluate loose equality', () => {
        const result = pass.testEvaluateComparisonOperation('==', 5, '5');
        expect(result).toBe(true);
      });

      it('should evaluate loose inequality', () => {
        const result = pass.testEvaluateComparisonOperation('!=', 5, '6');
        expect(result).toBe(true);
      });

      it('should evaluate strict equality', () => {
        const result = pass.testEvaluateComparisonOperation('===', 5, 5);
        expect(result).toBe(true);
      });

      it('should evaluate strict inequality', () => {
        const result = pass.testEvaluateComparisonOperation('!==', 5, '5');
        expect(result).toBe(true);
      });

      it('should evaluate less than', () => {
        const result = pass.testEvaluateComparisonOperation('<', 3, 5);
        expect(result).toBe(true);
      });

      it('should evaluate less than or equal', () => {
        const result = pass.testEvaluateComparisonOperation('<=', 5, 5);
        expect(result).toBe(true);
      });

      it('should evaluate greater than', () => {
        const result = pass.testEvaluateComparisonOperation('>', 5, 3);
        expect(result).toBe(true);
      });

      it('should evaluate greater than or equal', () => {
        const result = pass.testEvaluateComparisonOperation('>=', 5, 5);
        expect(result).toBe(true);
      });
    });

    describe('bitwise operations', () => {
      it('should evaluate left shift', () => {
        const result = pass.testEvaluateBitwiseOperation('<<', 5, 1);
        expect(result).toBe(10);
      });

      it('should evaluate right shift', () => {
        const result = pass.testEvaluateBitwiseOperation('>>', 10, 1);
        expect(result).toBe(5);
      });

      it('should evaluate unsigned right shift', () => {
        const result = pass.testEvaluateBitwiseOperation('>>>', 10, 1);
        expect(result).toBe(5);
      });

      it('should evaluate bitwise AND', () => {
        const result = pass.testEvaluateBitwiseOperation('&', 5, 3);
        expect(result).toBe(1);
      });

      it('should evaluate bitwise OR', () => {
        const result = pass.testEvaluateBitwiseOperation('|', 5, 3);
        expect(result).toBe(7);
      });

      it('should evaluate bitwise XOR', () => {
        const result = pass.testEvaluateBitwiseOperation('^', 5, 3);
        expect(result).toBe(6);
      });
    });

    describe('logical operations', () => {
      it('should evaluate logical AND', () => {
        const result = pass.testEvaluateLogicalOperation('&&', true, false);
        expect(result).toBe(false);
      });

      it('should evaluate logical OR', () => {
        const result = pass.testEvaluateLogicalOperation('||', false, true);
        expect(result).toBe(true);
      });

      it('should evaluate nullish coalescing', () => {
        const result = pass.testEvaluateLogicalOperation('??', null, 'default');
        expect(result).toBe('default');
      });

      it('should evaluate nullish coalescing with non-null left operand', () => {
        const result = pass.testEvaluateLogicalOperation('??', 'value', 'default');
        expect(result).toBe('value');
      });
    });

    describe('error cases', () => {
      it('should throw on unknown binary operator', () => {
        expect(() => pass.testEvaluateBinaryOperation('???', 5, 3)).toThrow('Unknown binary operator');
      });

      it('should throw on unknown comparison operator', () => {
        expect(() => pass.testEvaluateComparisonOperation('???', 5, 3)).toThrow('Unknown comparison operator');
      });

      it('should throw on unknown bitwise operator', () => {
        expect(() => pass.testEvaluateBitwiseOperation('???', 5, 3)).toThrow('Unknown bitwise operator');
      });

      it('should throw on unknown logical operator', () => {
        expect(() => pass.testEvaluateLogicalOperation('???', 5, 3)).toThrow('Unknown logical operator');
      });
    });
  });

  describe('unary operation evaluation', () => {
    it('should evaluate unary plus', () => {
      const result = pass.testEvaluateUnaryOperation('+', '42');
      expect(result).toBe(42);
    });

    it('should evaluate unary minus', () => {
      const result = pass.testEvaluateUnaryOperation('-', 42);
      expect(result).toBe(-42);
    });

    it('should evaluate logical not', () => {
      const result = pass.testEvaluateUnaryOperation('!', true);
      expect(result).toBe(false);
    });

    it('should evaluate bitwise not', () => {
      const result = pass.testEvaluateUnaryOperation('~', 5);
      expect(result).toBe(-6);
    });

    it('should evaluate typeof', () => {
      const result = pass.testEvaluateUnaryOperation('typeof', 'hello');
      expect(result).toBe('string');
    });

    it('should evaluate void', () => {
      const result = pass.testEvaluateUnaryOperation('void', 42);
      expect(result).toBe(undefined);
    });

    it('should throw on unknown unary operator', () => {
      expect(() => pass.testEvaluateUnaryOperation('???', 42)).toThrow('Unknown unary operator');
    });
  });

  describe('binary expression evaluation', () => {
    it('should evaluate constant binary expression', () => {
      const left = IRNodeFactory.literal(5);
      const right = IRNodeFactory.literal(3);
      const expr = IRNodeFactory.binaryExpression('+', left, right);
      
      const constants = new Map<NodeId, LatticeValue>();
      constants.set(left.node_id, { type: 'constant', value: 5, confidence: 1.0 });
      constants.set(right.node_id, { type: 'constant', value: 3, confidence: 1.0 });
      
      const result = pass.testEvaluateBinaryExpression(expr, constants);
      expect(result.type).toBe('constant');
      if (result.type === 'constant') {
        expect(result.value).toBe(8);
        expect(result.confidence).toBe(1.0);
      }
    });

    it('should return top for non-constant operands', () => {
      const left = IRNodeFactory.literal(5);
      const right = IRNodeFactory.identifier('x');
      const expr = IRNodeFactory.binaryExpression('+', left, right);
      
      const constants = new Map<NodeId, LatticeValue>();
      constants.set(left.node_id, { type: 'constant', value: 5, confidence: 1.0 });
      // right operand not in constants map
      
      const result = pass.testEvaluateBinaryExpression(expr, constants);
      expect(result.type).toBe('top');
    });

    it('should handle evaluation errors gracefully', () => {
      const left = IRNodeFactory.literal(5);
      const right = IRNodeFactory.literal(0);
      const expr = IRNodeFactory.binaryExpression('/', left, right);
      
      const constants = new Map<NodeId, LatticeValue>();
      constants.set(left.node_id, { type: 'constant', value: 5, confidence: 1.0 });
      constants.set(right.node_id, { type: 'constant', value: 0, confidence: 1.0 });
      
      const result = pass.testEvaluateBinaryExpression(expr, constants);
      expect(result.type).toBe('top');
    });
  });

  describe('unary expression evaluation', () => {
    it('should evaluate constant unary expression', () => {
      const operand = IRNodeFactory.literal(42);
      const expr: IRUnaryExpression = {
        type: 'UnaryExpression',
        operator: '-',
        argument: operand,
        node_id: IRNodeFactory.createNodeId()
      };
      
      const constants = new Map<NodeId, LatticeValue>();
      constants.set(operand.node_id, { type: 'constant', value: 42, confidence: 1.0 });
      
      const result = pass.testEvaluateUnaryExpression(expr, constants);
      expect(result.type).toBe('constant');
      if (result.type === 'constant') {
        expect(result.value).toBe(-42);
        expect(result.confidence).toBe(1.0);
      }
    });

    it('should return top for non-constant operand', () => {
      const operand = IRNodeFactory.identifier('x');
      const expr: IRUnaryExpression = {
        type: 'UnaryExpression',
        operator: '-',
        argument: operand,
        node_id: IRNodeFactory.createNodeId()
      };
      
      const constants = new Map<NodeId, LatticeValue>();
      // operand not in constants map
      
      const result = pass.testEvaluateUnaryExpression(expr, constants);
      expect(result.type).toBe('top');
    });

    it('should handle evaluation errors gracefully', () => {
      // Create a scenario that would cause an error (though hard to trigger with unary ops)
      const operand = IRNodeFactory.literal('invalid');
      const expr: IRUnaryExpression = {
        type: 'UnaryExpression',
        operator: '~', // Bitwise NOT on string might cause issues
        argument: operand,
        node_id: IRNodeFactory.createNodeId()
      };
      
      const constants = new Map<NodeId, LatticeValue>();
      constants.set(operand.node_id, { type: 'constant', value: 'invalid', confidence: 1.0 });
      
      const result = pass.testEvaluateUnaryExpression(expr, constants);
      // Should handle gracefully, either return a result or top
      expect(['constant', 'top']).toContain(result.type);
    });
  });

  describe('configuration options', () => {
    it('should respect arithmetic evaluation disabled', () => {
      const disabledPass = new TestConstantPropagationPass({
        enableArithmeticEvaluation: false
      });
      
      // Addition of numbers should throw when arithmetic is disabled
      expect(() => disabledPass.testEvaluateBinaryOperation('-', 5, 3)).toThrow('Operation disabled');
    });

    it('should respect string concatenation disabled', () => {
      const disabledPass = new TestConstantPropagationPass({
        enableStringConcatenation: false
      });
      
      // Should still do numeric addition when string concat is disabled
      const result = disabledPass.testEvaluateBinaryOperation('+', 'hello', 'world');
      expect(result).toBe('hello'); // Should return left operand unchanged
    });

    it('should respect boolean evaluation disabled', () => {
      const disabledPass = new TestConstantPropagationPass({
        enableBooleanEvaluation: false
      });
      
      expect(() => disabledPass.testEvaluateBinaryOperation('==', 5, 5)).toThrow('Operation disabled');
    });
  });

  describe('state management', () => {
    it('should reset state correctly', () => {
      // Set up some state first
      const stats = pass.getStats();
      stats.constantsFound = 5;
      stats.expressionsEvaluated = 10;
      
      pass.testResetState();
      
      const newStats = pass.getStats();
      expect(newStats.constantsFound).toBe(0);
      expect(newStats.expressionsEvaluated).toBe(0);
      expect(newStats.nodesReplaced).toBe(0);
      expect(newStats.iterations).toBe(0);
    });
  });

  describe('integration tests', () => {
    it('should run a complete pass on simple state', async () => {
      const literal = IRNodeFactory.literal(42);
      state.nodes.set(literal.node_id, literal);
      
      const result = await pass.run(state);
      expect(result).toBeDefined();
      expect(result.state).toBeDefined();
      expect(typeof result.changed).toBe('boolean');
    });

    it('should handle complex nested expressions', () => {
      // Create (5 + 3) * 2
      const leftOperand = IRNodeFactory.literal(5);
      const rightOperand = IRNodeFactory.literal(3);
      const innerExpr = IRNodeFactory.binaryExpression('+', leftOperand, rightOperand);
      const multiplier = IRNodeFactory.literal(2);
      const outerExpr = IRNodeFactory.binaryExpression('*', innerExpr, multiplier);
      
      state.nodes.set(leftOperand.node_id, leftOperand);
      state.nodes.set(rightOperand.node_id, rightOperand);
      state.nodes.set(innerExpr.node_id, innerExpr);
      state.nodes.set(multiplier.node_id, multiplier);
      state.nodes.set(outerExpr.node_id, outerExpr);
      
      const constants = pass.testAnalyzeConstants(state);
      expect(constants).toBeDefined();
      expect(constants.size).toBeGreaterThan(0);
    });

    it('should handle variable declarations', () => {
      const varDecl: IRVariableDeclaration = {
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('x'),
          init: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      };
      
      state.nodes.set(varDecl.node_id, varDecl);
      
      const constants = new Map<NodeId, LatticeValue>();
      pass.testEvaluateNode(varDecl, constants);
      
      // Should not crash
      expect(true).toBe(true);
    });

    it('should handle assignment expressions', () => {
      const assignment: IRAssignmentExpression = {
        type: 'AssignmentExpression',
        operator: '=',
        left: IRNodeFactory.identifier('x'),
        right: IRNodeFactory.literal(42),
        node_id: IRNodeFactory.createNodeId()
      };
      
      state.nodes.set(assignment.node_id, assignment);
      
      const constants = new Map<NodeId, LatticeValue>();
      const result = pass.testEvaluateNode(assignment, constants);
      
      expect(result.type).toBe('constant');
      if (result.type === 'constant') {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle unknown node types', () => {
      const unknownNode = {
        type: 'UnknownType',
        node_id: IRNodeFactory.createNodeId()
      } as any;
      
      const constants = new Map<NodeId, LatticeValue>();
      const result = pass.testEvaluateNode(unknownNode, constants);
      
      expect(result.type).toBe('top');
    });

    it('should handle missing node IDs gracefully', () => {
      const nodeWithoutId = {
        type: 'Literal',
        value: 42
      } as any;
      
      const constants = new Map<NodeId, LatticeValue>();
      const result = pass.testGetNodeValue(nodeWithoutId, constants);
      
      expect(result).toBeDefined();
    });

    it('should handle bigint operations', () => {
      const result = pass.testEvaluateBinaryOperation('+', 123n, 456n);
      expect(result).toBe(579);
    });

    it('should handle null and undefined in operations', () => {
      const result = pass.testEvaluateBinaryOperation('??', null, 'default');
      expect(result).toBe('default');
    });
  });

  describe('performance and limits', () => {
    it('should respect maxIterations config', () => {
      const limitedPass = new TestConstantPropagationPass({
        maxIterations: 1
      });
      
      // Create a state that would require multiple iterations
      const lit1 = IRNodeFactory.literal(1);
      const lit2 = IRNodeFactory.literal(2);
      const expr1 = IRNodeFactory.binaryExpression('+', lit1, lit2);
      const expr2 = IRNodeFactory.binaryExpression('*', expr1, IRNodeFactory.literal(3));
      
      state.nodes.set(lit1.node_id, lit1);
      state.nodes.set(lit2.node_id, lit2);
      state.nodes.set(expr1.node_id, expr1);
      state.nodes.set(expr2.node_id, expr2);
      
      const constants = limitedPass.testAnalyzeConstants(state);
      const stats = limitedPass.getStats();
      expect(stats.iterations).toBeLessThanOrEqual(1);
    });

    it('should handle confidence thresholds', () => {
      const strictPass = new TestConstantPropagationPass({
        confidenceThreshold: 0.9
      });
      
      const lowConfidenceValue: ConstantValue = {
        type: 'constant',
        value: 42,
        confidence: 0.5
      };
      
      const identifier = IRNodeFactory.identifier('x');
      const constants = new Map<NodeId, LatticeValue>();
      constants.set(identifier.node_id, lowConfidenceValue);
      
      const transformed = strictPass.testTransformNode(identifier, constants);
      // Should not transform due to low confidence
      expect(transformed).toBe(identifier);
    });
  });
});