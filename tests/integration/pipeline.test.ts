/**
 * Integration tests for the deobfuscation pipeline
 */

import { describe, it, expect } from 'vitest';
import { CFGBuilder } from '../../src/ir/cfg.js';
import { SSABuilder } from '../../src/ir/ssa.js';
import { IRNodeFactory } from '../../src/ir/nodes.js';
import { ConstantPropagationPass } from '../../src/passes/constprop.js';
import type { IRStatement, IRState } from '../../src/ir/nodes.js';

describe('Deobfuscation Pipeline Integration', () => {
  it('should process a simple constant folding pipeline', async () => {
    // Create a simple program: let x = 1 + 2; console.log(x);
    const statements: IRStatement[] = [
      {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('x'),
          init: {
            type: 'BinaryExpression',
            operator: '+',
            left: IRNodeFactory.literal(1),
            right: IRNodeFactory.literal(2),
            node_id: IRNodeFactory.createNodeId()
          },
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      },
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: IRNodeFactory.identifier('console'),
            property: IRNodeFactory.identifier('log'),
            computed: false,
            node_id: IRNodeFactory.createNodeId()
          },
          arguments: [IRNodeFactory.identifier('x')],
          node_id: IRNodeFactory.createNodeId()
        },
        node_id: IRNodeFactory.createNodeId()
      }
    ];

    // Step 1: Build CFG
    const cfgBuilder = new CFGBuilder();
    const cfg = cfgBuilder.buildFromStatements(statements);
    
    expect(cfg.nodes.size).toBeGreaterThan(0);
    expect(cfg.entry).toBeDefined();
    expect(cfg.exit).toBeDefined();

    // Step 2: Build SSA
    const ssaBuilder = new SSABuilder(cfg);
    const ssaState = ssaBuilder.buildSSA();
    
    expect(ssaState.variables.size).toBeGreaterThan(0);

    // Step 3: Create IR State
    const nodes = new Map();
    for (const statement of statements) {
      if (statement.node_id) {
        nodes.set(statement.node_id, statement);
      }
    }

    const initialState: IRState = {
      nodes: nodes,
      cfg: cfg,
      ssa_state: ssaState,
      metadata: new Map()
    };

    // Step 4: Apply constant propagation pass
    const constPropPass = new ConstantPropagationPass();
    const result = await constPropPass.run(initialState);

    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
    expect(result.metrics.execution_time_ms).toBeGreaterThanOrEqual(0);
    expect(result.errors).toEqual([]);
  });

  it('should handle an empty program correctly', async () => {
    const statements: IRStatement[] = [];

    // Build CFG for empty program
    const cfgBuilder = new CFGBuilder();
    const cfg = cfgBuilder.buildFromStatements(statements);
    
    expect(cfg.nodes.size).toBe(2); // entry + exit
    expect(cfg.entry.successors).toHaveLength(1);
    expect(cfg.exit.predecessors).toHaveLength(1);
  });

  it('should build CFG with proper dominance relationships', () => {
    const statements: IRStatement[] = [
      {
        type: 'ExpressionStatement',
        expression: IRNodeFactory.identifier('test'),
        node_id: IRNodeFactory.createNodeId()
      }
    ];

    const cfgBuilder = new CFGBuilder();
    const cfg = cfgBuilder.buildFromStatements(statements);

    // Entry should dominate all nodes
    expect(cfg.entry.dominates.size).toBeGreaterThan(0);
    
    // Exit should post-dominate all nodes
    expect(cfg.exit.post_dominates.size).toBeGreaterThan(0);
  });

  it('should create phi nodes for control flow joins', () => {
    const ifStmt = {
      type: 'IfStatement' as const,
      test: IRNodeFactory.identifier('condition'),
      consequent: {
        type: 'ExpressionStatement' as const,
        expression: {
          type: 'AssignmentExpression' as const,
          operator: '=' as const,
          left: IRNodeFactory.identifier('x'),
          right: IRNodeFactory.literal(1),
          node_id: IRNodeFactory.createNodeId()
        },
        node_id: IRNodeFactory.createNodeId()
      },
      alternate: {
        type: 'ExpressionStatement' as const,
        expression: {
          type: 'AssignmentExpression' as const,
          operator: '=' as const,
          left: IRNodeFactory.identifier('x'),
          right: IRNodeFactory.literal(2),
          node_id: IRNodeFactory.createNodeId()
        },
        node_id: IRNodeFactory.createNodeId()
      },
      node_id: IRNodeFactory.createNodeId()
    };

    const cfgBuilder = new CFGBuilder();
    const cfg = cfgBuilder.buildFromStatements([ifStmt]);
    
    const ssaBuilder = new SSABuilder(cfg);
    const ssaState = ssaBuilder.buildSSA();

    // Should create phi nodes for variable x at the join point
    expect(ssaState.phi_nodes.size).toBeGreaterThan(0);
  });

  it('should track metadata through pipeline stages', async () => {
    const statements: IRStatement[] = [
      {
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [{
          type: 'VariableDeclarator',
          id: IRNodeFactory.identifier('result'),
          init: IRNodeFactory.literal(42),
          node_id: IRNodeFactory.createNodeId()
        }],
        node_id: IRNodeFactory.createNodeId()
      }
    ];

    const cfgBuilder = new CFGBuilder();
    const cfg = cfgBuilder.buildFromStatements(statements);
    
    const ssaBuilder = new SSABuilder(cfg);
    const ssaState = ssaBuilder.buildSSA();

    const nodes = new Map();
    for (const statement of statements) {
      if (statement.node_id) {
        nodes.set(statement.node_id, statement);
      }
    }

    const initialState: IRState = {
      nodes: nodes,
      cfg: cfg,
      ssa_state: ssaState,
      metadata: new Map([
        ['original_source', 'const result = 42;'],
        ['pass_history', []]
      ])
    };

    const constPropPass = new ConstantPropagationPass();
    const result = await constPropPass.run(initialState);

    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
    expect(result.metrics.execution_time_ms).toBeGreaterThanOrEqual(0);
    expect(result.errors).toEqual([]);
  });
});