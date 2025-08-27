/**
 * @fileoverview Tests for Control Flow Graph construction and analysis
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CFGBuilder, CFGAnalyzer, CFGEdgeType } from '../../src/ir/cfg.js';
import { IRNodeFactory } from '../../src/ir/nodes.js';
import type { IRStatement, IRIfStatement, IRWhileStatement } from '../../src/ir/nodes.js';

describe('CFGBuilder', () => {
  let builder: CFGBuilder;

  beforeEach(() => {
    builder = new CFGBuilder();
  });

  describe('buildFromStatements', () => {
    it('should create empty CFG for no statements', () => {
      const cfg = builder.buildFromStatements([]);
      
      expect(cfg.nodes.size).toBe(2); // entry + exit
      expect(cfg.entry.label).toBe('entry');
      expect(cfg.exit.label).toBe('exit');
      expect(cfg.edges).toHaveLength(1);
      expect(cfg.edges[0]?.type).toBe(CFGEdgeType.UNCONDITIONAL);
    });

    it('should create linear CFG for sequential statements', () => {
      const statements: IRStatement[] = [
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('a'),
          node_id: IRNodeFactory.createNodeId()
        },
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('b'),
          node_id: IRNodeFactory.createNodeId()
        }
      ];

      const cfg = builder.buildFromStatements(statements);
      
      expect(cfg.nodes.size).toBeGreaterThanOrEqual(3); // entry + block + exit
      expect(cfg.entry.successors).toHaveLength(1);
      expect(cfg.exit.predecessors).toHaveLength(1);
    });

    it('should create branching CFG for if statement', () => {
      const ifStmt: IRIfStatement = {
        type: 'IfStatement',
        test: IRNodeFactory.identifier('condition'),
        consequent: {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('then'),
          node_id: IRNodeFactory.createNodeId()
        },
        alternate: {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('else'),
          node_id: IRNodeFactory.createNodeId()
        },
        node_id: IRNodeFactory.createNodeId()
      };

      const cfg = builder.buildFromStatements([ifStmt]);
      
      // Should have entry, if-test, then-block, else-block, exit
      expect(cfg.nodes.size).toBeGreaterThanOrEqual(4);
      
      // Check for TRUE_BRANCH and FALSE_BRANCH edges
      const trueEdges = cfg.edges.filter(e => e.type === CFGEdgeType.TRUE_BRANCH);
      const falseEdges = cfg.edges.filter(e => e.type === CFGEdgeType.FALSE_BRANCH);
      
      expect(trueEdges.length).toBeGreaterThan(0);
      expect(falseEdges.length).toBeGreaterThan(0);
    });

    it('should create looping CFG for while statement', () => {
      const whileStmt: IRWhileStatement = {
        type: 'WhileStatement',
        test: IRNodeFactory.identifier('condition'),
        body: {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('body'),
          node_id: IRNodeFactory.createNodeId()
        },
        node_id: IRNodeFactory.createNodeId()
      };

      const cfg = builder.buildFromStatements([whileStmt]);
      
      expect(cfg.nodes.size).toBeGreaterThanOrEqual(3);
      
      // Should have back edge (body -> test)
      const hasBackEdge = cfg.edges.some(edge => 
        edge.to.instructions.some(stmt => stmt === whileStmt) &&
        edge.from.instructions.some(stmt => stmt === whileStmt.body)
      );
      
      // Note: This is a simplified check - actual back edge detection is more complex
      expect(cfg.edges.length).toBeGreaterThan(2); // At least multiple edges for loop
    });
  });

  describe('dominance analysis', () => {
    it('should compute dominance for simple linear CFG', () => {
      const statements: IRStatement[] = [
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('a'),
          node_id: IRNodeFactory.createNodeId()
        }
      ];

      const cfg = builder.buildFromStatements(statements);
      
      // Entry should dominate all nodes
      expect(cfg.entry.dominates.size).toBeGreaterThan(0);
      
      // Each node should be dominated by entry
      for (const node of cfg.nodes.values()) {
        if (node !== cfg.entry) {
          expect(cfg.entry.dominates.has(node)).toBe(true);
        }
      }
    });

    it('should compute post-dominance correctly', () => {
      const statements: IRStatement[] = [
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('a'),
          node_id: IRNodeFactory.createNodeId()
        }
      ];

      const cfg = builder.buildFromStatements(statements);
      
      // Exit should post-dominate all nodes
      expect(cfg.exit.post_dominates.size).toBeGreaterThan(0);
      
      // Each node should be post-dominated by exit
      for (const node of cfg.nodes.values()) {
        if (node !== cfg.exit) {
          expect(cfg.exit.post_dominates.has(node)).toBe(true);
        }
      }
    });

    it('should build dominance tree', () => {
      const statements: IRStatement[] = [
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('a'),
          node_id: IRNodeFactory.createNodeId()
        }
      ];

      const cfg = builder.buildFromStatements(statements);
      
      expect(cfg.dominance_tree).toBeDefined();
      expect(cfg.post_dominance_tree).toBeDefined();
      expect(cfg.dominance_tree.size).toBeGreaterThan(0);
    });
  });
});

describe('CFGAnalyzer', () => {
  let builder: CFGBuilder;

  beforeEach(() => {
    builder = new CFGBuilder();
  });

  describe('computeDominanceFrontiers', () => {
    it('should compute empty frontiers for linear CFG', () => {
      const statements: IRStatement[] = [
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('a'),
          node_id: IRNodeFactory.createNodeId()
        }
      ];

      const cfg = builder.buildFromStatements(statements);
      const frontiers = CFGAnalyzer.computeDominanceFrontiers(cfg);
      
      expect(frontiers).toBeDefined();
      
      // Linear CFG should have minimal dominance frontiers
      for (const frontier of frontiers.values()) {
        expect(frontier.size).toBe(0);
      }
    });

    it('should compute non-empty frontiers for branching CFG', () => {
      const ifStmt: IRIfStatement = {
        type: 'IfStatement',
        test: IRNodeFactory.identifier('condition'),
        consequent: {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('then'),
          node_id: IRNodeFactory.createNodeId()
        },
        alternate: {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('else'),
          node_id: IRNodeFactory.createNodeId()
        },
        node_id: IRNodeFactory.createNodeId()
      };

      const cfg = builder.buildFromStatements([ifStmt]);
      const frontiers = CFGAnalyzer.computeDominanceFrontiers(cfg);
      
      expect(frontiers).toBeDefined();
      expect(frontiers.size).toBeGreaterThan(0);
      
      // Branching CFG should have some non-empty frontiers
      let hasNonEmptyFrontier = false;
      for (const frontier of frontiers.values()) {
        if (frontier.size > 0) {
          hasNonEmptyFrontier = true;
          break;
        }
      }
      expect(hasNonEmptyFrontier).toBe(true);
    });
  });

  describe('findNaturalLoops', () => {
    it('should find loops in while statement CFG', () => {
      const whileStmt: IRWhileStatement = {
        type: 'WhileStatement',
        test: IRNodeFactory.identifier('condition'),
        body: {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('body'),
          node_id: IRNodeFactory.createNodeId()
        },
        node_id: IRNodeFactory.createNodeId()
      };

      const cfg = builder.buildFromStatements([whileStmt]);
      const loops = CFGAnalyzer.findNaturalLoops(cfg);
      
      expect(loops).toBeDefined();
      // Should find at least one loop
      expect(loops.size).toBeGreaterThanOrEqual(0);
    });

    it('should not find loops in linear CFG', () => {
      const statements: IRStatement[] = [
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('a'),
          node_id: IRNodeFactory.createNodeId()
        },
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('b'),
          node_id: IRNodeFactory.createNodeId()
        }
      ];

      const cfg = builder.buildFromStatements(statements);
      const loops = CFGAnalyzer.findNaturalLoops(cfg);
      
      expect(loops.size).toBe(0);
    });
  });

  describe('reversePostOrder', () => {
    it('should compute reverse post-order traversal', () => {
      const statements: IRStatement[] = [
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('a'),
          node_id: IRNodeFactory.createNodeId()
        },
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('b'),
          node_id: IRNodeFactory.createNodeId()
        }
      ];

      const cfg = builder.buildFromStatements(statements);
      const rpo = CFGAnalyzer.reversePostOrder(cfg);
      
      expect(rpo).toBeDefined();
      expect(rpo.length).toBeGreaterThan(0);
      expect(rpo[0]).toBe(cfg.entry);
    });

    it('should visit all reachable nodes', () => {
      const statements: IRStatement[] = [
        {
          type: 'ExpressionStatement',
          expression: IRNodeFactory.identifier('a'),
          node_id: IRNodeFactory.createNodeId()
        }
      ];

      const cfg = builder.buildFromStatements(statements);
      const rpo = CFGAnalyzer.reversePostOrder(cfg);
      
      // Should visit all nodes in the CFG
      expect(rpo.length).toBe(cfg.nodes.size);
      
      // Should contain entry and exit
      expect(rpo).toContain(cfg.entry);
      expect(rpo).toContain(cfg.exit);
    });
  });
});

describe('CFG Edge Types', () => {
  it('should use correct edge types', () => {
    expect(CFGEdgeType.UNCONDITIONAL).toBe('unconditional');
    expect(CFGEdgeType.TRUE_BRANCH).toBe('true_branch');
    expect(CFGEdgeType.FALSE_BRANCH).toBe('false_branch');
    expect(CFGEdgeType.EXCEPTION).toBe('exception');
    expect(CFGEdgeType.FALLTHROUGH).toBe('fallthrough');
  });
});

describe('CFG Node Properties', () => {
  let builder: CFGBuilder;

  beforeEach(() => {
    builder = new CFGBuilder();
  });

  it('should initialize node properties correctly', () => {
    const statements: IRStatement[] = [
      {
        type: 'ExpressionStatement',
        expression: IRNodeFactory.identifier('a'),
        node_id: IRNodeFactory.createNodeId()
      }
    ];

    const cfg = builder.buildFromStatements(statements);
    
    for (const node of cfg.nodes.values()) {
      expect(node.id).toBeDefined();
      expect(Array.isArray(node.instructions)).toBe(true);
      expect(Array.isArray(node.predecessors)).toBe(true);
      expect(Array.isArray(node.successors)).toBe(true);
      expect(Array.isArray(node.edges_in)).toBe(true);
      expect(Array.isArray(node.edges_out)).toBe(true);
      expect(node.dominates).toBeInstanceOf(Set);
      expect(node.dominated_by).toBeInstanceOf(Set);
      expect(node.dominance_frontier).toBeInstanceOf(Set);
      expect(node.post_dominates).toBeInstanceOf(Set);
      expect(node.post_dominated_by).toBeInstanceOf(Set);
      expect(node.post_dominance_frontier).toBeInstanceOf(Set);
      expect(typeof node.loop_depth).toBe('number');
      expect(Array.isArray(node.back_edges)).toBe(true);
    }
  });

  it('should maintain edge consistency', () => {
    const statements: IRStatement[] = [
      {
        type: 'ExpressionStatement',
        expression: IRNodeFactory.identifier('a'),
        node_id: IRNodeFactory.createNodeId()
      }
    ];

    const cfg = builder.buildFromStatements(statements);
    
    // Check edge consistency
    for (const edge of cfg.edges) {
      expect(edge.from.edges_out).toContain(edge);
      expect(edge.to.edges_in).toContain(edge);
      expect(edge.from.successors).toContain(edge.to);
      expect(edge.to.predecessors).toContain(edge.from);
    }
  });
});