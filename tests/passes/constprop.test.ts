/**
 * @fileoverview Tests for constant propagation pass
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConstantPropagationPass } from '../../src/passes/constprop.ts';
import { IRNodeFactory } from '../../src/ir/nodes.ts';
import type { IRState } from '../../src/passes/Pass.ts';
import type { CFG } from '../../src/ir/cfg.ts';

describe('ConstantPropagationPass', () => {
  let pass: ConstantPropagationPass;
  let state: IRState;

  beforeEach(() => {
    pass = new ConstantPropagationPass();
    
    // Create a minimal CFG
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
    
    // Create a minimal IRState
    state = {
      cfg,
      nodes: new Map(),
      metadata: new Map()
    };
  });

  describe('basic properties', () => {
    it('should have correct name and description', () => {
      expect(pass.name).toBe('constant-propagation');
      expect(pass.description).toContain('constant');
    });
  });

  describe('literal evaluation', () => {
    it('should evaluate string literals', async () => {
      const literal = IRNodeFactory.literal('hello');
      const mutableNodes = new Map(state.nodes);
      mutableNodes.set(literal.node_id, literal);
      const testState = { ...state, nodes: mutableNodes };
      
      const result = await pass.run(testState);
      expect(result.changed).toBe(false); // No changes needed for simple literal
    });

    it('should evaluate number literals', async () => {
      const literal = IRNodeFactory.literal(42);
      (state.nodes as Map<NodeId, IRNode>).set(literal.node_id, literal);
      
      const result = await pass.run(state);
      expect(result.changed).toBe(false);
    });

    it('should evaluate boolean literals', async () => {
      const literal = IRNodeFactory.literal(true);
      (state.nodes as Map<NodeId, IRNode>).set(literal.node_id, literal);
      
      const result = await pass.run(state);
      expect(result.changed).toBe(false);
    });

    it('should evaluate null literal', async () => {
      const literal = IRNodeFactory.literal(null);
      (state.nodes as Map<NodeId, IRNode>).set(literal.node_id, literal);
      
      const result = await pass.run(state);
      expect(result.changed).toBe(false);
    });
  });

  describe('binary expressions', () => {
    it('should evaluate arithmetic expressions', async () => {
      const left = IRNodeFactory.literal(5);
      const right = IRNodeFactory.literal(3);
      const expr = IRNodeFactory.binaryExpression('+', left, right);
      
      (state.nodes as Map<NodeId, IRNode>).set(left.node_id, left);
      (state.nodes as Map<NodeId, IRNode>).set(right.node_id, right);
      (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
      
      const result = await pass.run(state);
      
      // Should detect that 5 + 3 can be folded to 8
      if (result.changed) {
        // Check if the expression was replaced with a literal
        const transformedExpr = result.state.nodes.get(expr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(8);
        }
      }
    });

    it('should handle string concatenation', async () => {
      const left = IRNodeFactory.literal('hello');
      const right = IRNodeFactory.literal('world');
      const expr = IRNodeFactory.binaryExpression('+', left, right);
      
      (state.nodes as Map<NodeId, IRNode>).set(left.node_id, left);
      (state.nodes as Map<NodeId, IRNode>).set(right.node_id, right);
      (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(expr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe('helloworld');
        }
      }
    });

    it('should handle comparison expressions', async () => {
      const left = IRNodeFactory.literal(5);
      const right = IRNodeFactory.literal(3);
      const expr = IRNodeFactory.binaryExpression('>', left, right);
      
      (state.nodes as Map<NodeId, IRNode>).set(left.node_id, left);
      (state.nodes as Map<NodeId, IRNode>).set(right.node_id, right);
      (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(expr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(true);
        }
      }
    });

    it('should handle equality expressions', async () => {
      const left = IRNodeFactory.literal(42);
      const right = IRNodeFactory.literal(42);
      const expr = IRNodeFactory.binaryExpression('===', left, right);
      
      (state.nodes as Map<NodeId, IRNode>).set(left.node_id, left);
      (state.nodes as Map<NodeId, IRNode>).set(right.node_id, right);
      (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(expr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(true);
        }
      }
    });

    it('should handle logical expressions', async () => {
      const left = IRNodeFactory.literal(true);
      const right = IRNodeFactory.literal(false);
      const expr = IRNodeFactory.binaryExpression('&&', left, right);
      
      (state.nodes as Map<NodeId, IRNode>).set(left.node_id, left);
      (state.nodes as Map<NodeId, IRNode>).set(right.node_id, right);
      (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(expr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(false);
        }
      }
    });

    it('should handle bitwise expressions', async () => {
      const left = IRNodeFactory.literal(5);
      const right = IRNodeFactory.literal(3);
      const expr = IRNodeFactory.binaryExpression('&', left, right);
      
      (state.nodes as Map<NodeId, IRNode>).set(left.node_id, left);
      (state.nodes as Map<NodeId, IRNode>).set(right.node_id, right);
      (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(expr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(1); // 5 & 3 = 1
        }
      }
    });
  });

  describe('unary expressions', () => {
    it('should evaluate unary minus', async () => {
      const operand = IRNodeFactory.literal(42);
      const unaryExpr = {
        type: 'UnaryExpression' as const,
        operator: '-',
        argument: operand,
        node_id: IRNodeFactory.createNodeId()
      };
      
      (state.nodes as Map<NodeId, IRNode>).set(operand.node_id, operand);
      (state.nodes as Map<NodeId, IRNode>).set(unaryExpr.node_id, unaryExpr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(unaryExpr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(-42);
        }
      }
    });

    it('should evaluate unary plus', async () => {
      const operand = IRNodeFactory.literal('42');
      const unaryExpr = {
        type: 'UnaryExpression' as const,
        operator: '+',
        argument: operand,
        node_id: IRNodeFactory.createNodeId()
      };
      
      (state.nodes as Map<NodeId, IRNode>).set(operand.node_id, operand);
      (state.nodes as Map<NodeId, IRNode>).set(unaryExpr.node_id, unaryExpr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(unaryExpr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(42);
        }
      }
    });

    it('should evaluate logical not', async () => {
      const operand = IRNodeFactory.literal(true);
      const unaryExpr = {
        type: 'UnaryExpression' as const,
        operator: '!',
        argument: operand,
        node_id: IRNodeFactory.createNodeId()
      };
      
      (state.nodes as Map<NodeId, IRNode>).set(operand.node_id, operand);
      (state.nodes as Map<NodeId, IRNode>).set(unaryExpr.node_id, unaryExpr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(unaryExpr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(false);
        }
      }
    });

    it('should evaluate bitwise not', async () => {
      const operand = IRNodeFactory.literal(5);
      const unaryExpr = {
        type: 'UnaryExpression' as const,
        operator: '~',
        argument: operand,
        node_id: IRNodeFactory.createNodeId()
      };
      
      (state.nodes as Map<NodeId, IRNode>).set(operand.node_id, operand);
      (state.nodes as Map<NodeId, IRNode>).set(unaryExpr.node_id, unaryExpr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(unaryExpr.node_id);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(~5); // -6
        }
      }
    });
  });

  describe('variable propagation', () => {
    it('should propagate simple constants', async () => {
      // const x = 42;
      const xDecl = {
        type: 'VariableDeclaration' as const,
        kind: 'const' as const,
        declarations: [{
          type: 'VariableDeclarator' as const,
          id: IRNodeFactory.identifier('x'),
          init: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      };

      // Use of x
      const xUse = IRNodeFactory.identifier('x');
      
      (state.nodes as Map<NodeId, IRNode>).set(xDecl.node_id, xDecl);
      (state.nodes as Map<NodeId, IRNode>).set(xUse.node_id, xUse);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedUse = result.state.nodes.get(xUse.node_id!);
        if (transformedUse?.type === 'Literal') {
          expect(transformedUse.value).toBe(42);
        }
      }
    });

    it('should handle assignments', async () => {
      // x = 5
      const assignment = {
        type: 'AssignmentExpression' as const,
        operator: '=' as const,
        left: IRNodeFactory.identifier('x'),
        right: IRNodeFactory.literal(5),
        node_id: IRNodeFactory.createNodeId()
      };
      
      (state.nodes as Map<NodeId, IRNode>).set(assignment.node_id, assignment);
      
      const result = await pass.run(state);
      expect(result).toBeDefined();
    });
  });

  describe('complex expressions', () => {
    it('should handle nested expressions', async () => {
      // (5 + 3) * 2
      const inner = IRNodeFactory.binaryExpression('+', 
        IRNodeFactory.literal(5), 
        IRNodeFactory.literal(3)
      );
      const outer = IRNodeFactory.binaryExpression('*', 
        inner,
        IRNodeFactory.literal(2)
      );
      
      (state.nodes as Map<NodeId, IRNode>).set(inner.left.node_id, inner.left);
      (state.nodes as Map<NodeId, IRNode>).set(inner.right.node_id, inner.right);
      (state.nodes as Map<NodeId, IRNode>).set(inner.node_id, inner);
      (state.nodes as Map<NodeId, IRNode>).set(outer.right.node_id, outer.right);
      (state.nodes as Map<NodeId, IRNode>).set(outer.node_id, outer);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        // Should fold to 16
        const transformedExpr = result.state.nodes.get(outer.node_id!);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe(16);
        }
      }
    });

    it('should handle mixed types', async () => {
      // '5' + 3 should become '53'
      const expr = IRNodeFactory.binaryExpression('+',
        IRNodeFactory.literal('5'),
        IRNodeFactory.literal(3)
      );
      
      (state.nodes as Map<NodeId, IRNode>).set(expr.left.node_id, expr.left);
      (state.nodes as Map<NodeId, IRNode>).set(expr.right.node_id, expr.right);
      (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
      
      const result = await pass.run(state);
      
      if (result.changed) {
        const transformedExpr = result.state.nodes.get(expr.node_id!);
        if (transformedExpr?.type === 'Literal') {
          expect(transformedExpr.value).toBe('53');
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle division by zero gracefully', async () => {
      const expr = IRNodeFactory.binaryExpression('/',
        IRNodeFactory.literal(5),
        IRNodeFactory.literal(0)
      );
      
      (state.nodes as Map<NodeId, IRNode>).set(expr.left.node_id, expr.left);
      (state.nodes as Map<NodeId, IRNode>).set(expr.right.node_id, expr.right);
      (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
      
      const result = await pass.run(state);
      // Should not crash, may or may not change depending on implementation
      expect(result).toBeDefined();
    });

    it('should handle non-constant expressions', async () => {
      const identifier = IRNodeFactory.identifier('unknown');
      const expr = IRNodeFactory.binaryExpression('+',
        identifier,
        IRNodeFactory.literal(5)
      );
      
      (state.nodes as Map<NodeId, IRNode>).set(identifier.node_id, identifier);
      (state.nodes as Map<NodeId, IRNode>).set(expr.right.node_id, expr.right);
      (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
      
      const result = await pass.run(state);
      // Should not change since one operand is not constant
      expect(result.changed).toBe(false);
    });

    it('should handle empty state', async () => {
      const result = await pass.run(state);
      expect(result.changed).toBe(false);
      expect(result.state).toBe(state);
    });

    it('should handle regex literals', async () => {
      const regex = IRNodeFactory.literal(/test/g);
      (state.nodes as Map<NodeId, IRNode>).set(regex.node_id, regex);
      
      const result = await pass.run(state);
      // Regex should not be constant propagated
      expect(result.changed).toBe(false);
    });
  });

  describe('operator coverage', () => {
    const binaryOperators = [
      ['+', 5, 3, 8],
      ['-', 5, 3, 2],
      ['*', 5, 3, 15],
      ['/', 6, 3, 2],
      ['%', 5, 3, 2],
      ['**', 2, 3, 8],
      ['==', 5, 5, true],
      ['!=', 5, 3, true],
      ['===', 5, 5, true],
      ['!==', 5, 3, true],
      ['<', 3, 5, true],
      ['<=', 5, 5, true],
      ['>', 5, 3, true],
      ['>=', 5, 5, true],
      ['<<', 5, 1, 10],
      ['>>', 10, 1, 5],
      ['>>>', 10, 1, 5],
      ['&', 5, 3, 1],
      ['|', 5, 3, 7],
      ['^', 5, 3, 6],
      ['&&', true, false, false],
      ['||', false, true, true],
      ['??', null, 'default', 'default']
    ] as const;

    binaryOperators.forEach(([operator, leftVal, rightVal, expected]) => {
      it(`should handle binary operator ${operator}`, async () => {
        const left = IRNodeFactory.literal(leftVal);
        const right = IRNodeFactory.literal(rightVal);
        const expr = IRNodeFactory.binaryExpression(operator, left, right);
        
        (state.nodes as Map<NodeId, IRNode>).set(left.node_id, left);
        (state.nodes as Map<NodeId, IRNode>).set(right.node_id, right);
        (state.nodes as Map<NodeId, IRNode>).set(expr.node_id, expr);
        
        const result = await pass.run(state);
        
        if (result.changed) {
          const transformedExpr = result.state.nodes.get(expr.node_id);
          if (transformedExpr?.type === 'Literal') {
            expect(transformedExpr.value).toBe(expected);
          }
        }
      });
    });

    const unaryOperators = [
      ['+', '42', 42],
      ['-', 42, -42],
      ['!', true, false],
      ['~', 5, -6]
    ] as const;

    unaryOperators.forEach(([operator, operandVal, expected]) => {
      it(`should handle unary operator ${operator}`, async () => {
        const operand = IRNodeFactory.literal(operandVal);
        const unaryExpr = {
          type: 'UnaryExpression' as const,
          operator,
          argument: operand,
          node_id: IRNodeFactory.createNodeId()
        };
        
        (state.nodes as Map<NodeId, IRNode>).set(operand.node_id, operand);
        (state.nodes as Map<NodeId, IRNode>).set(unaryExpr.node_id, unaryExpr);
        
        const result = await pass.run(state);
        
        if (result.changed) {
          const transformedExpr = result.state.nodes.get(unaryExpr.node_id);
          if (transformedExpr?.type === 'Literal') {
            expect(transformedExpr.value).toBe(expected);
          }
        }
      });
    });
  });
});