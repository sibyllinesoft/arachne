/**
 * Tests for Intelligent Renaming Pass
 * 
 * Test suite for the simplified but functional renaming pass implementation.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { IntelligentRenamingPass } from '../../src/passes/rename';
import type { IRState, NodeId } from '../../src/passes/Pass';
import type { 
  CFG, 
  CFGNode,
  IRNode,
  IRIdentifier,
  IRLiteral,
  IRVariableDeclaration,
  IRVariableDeclarator
} from '../../src/ir/nodes';
import { IRNodeFactory } from '../../src/ir/nodes';

describe('IntelligentRenamingPass', () => {
  let pass: IntelligentRenamingPass;
  let mockState: IRState;

  beforeEach(() => {
    pass = new IntelligentRenamingPass();
    mockState = createMockIRState();
  });

  describe('Basic Functionality', () => {
    test('should rename obfuscated variable with numeric literal', async () => {
      // Create: let _0x1234 = 42;
      const numericDeclaration = createVariableDeclaration('_0x1234', 42);
      const state = createStateWithNode(numericDeclaration);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      // Should rename to something with 'num' prefix
      const renamedDeclaration = findVariableDeclaration(result.state);
      expect(renamedDeclaration).toBeDefined();
      expect(renamedDeclaration!.declarations[0]!.id.name).toMatch(/^num/);
    });

    test('should rename obfuscated variable with string literal', async () => {
      // Create: let _0xabcd = "hello";
      const stringDeclaration = createVariableDeclaration('_0xabcd', 'hello');
      const state = createStateWithNode(stringDeclaration);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      // Should rename to something with 'str' prefix
      const renamedDeclaration = findVariableDeclaration(result.state);
      expect(renamedDeclaration).toBeDefined();
      expect(renamedDeclaration!.declarations[0]!.id.name).toMatch(/^str/);
    });

    test('should rename obfuscated variable with boolean literal', async () => {
      // Create: let _$flag = true;
      const booleanDeclaration = createVariableDeclaration('_$flag', true);
      const state = createStateWithNode(booleanDeclaration);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      // Should rename to something with 'bool' prefix  
      const renamedDeclaration = findVariableDeclaration(result.state);
      expect(renamedDeclaration).toBeDefined();
      expect(renamedDeclaration!.declarations[0]!.id.name).toMatch(/^bool/);
    });

    test('should use generic "var" prefix for unknown types', async () => {
      // Create: let _0x5678 = null;
      const unknownDeclaration = createVariableDeclaration('_0x5678', null);
      const state = createStateWithNode(unknownDeclaration);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      // Should rename to something with 'var' prefix
      const renamedDeclaration = findVariableDeclaration(result.state);
      expect(renamedDeclaration).toBeDefined();
      expect(renamedDeclaration!.declarations[0]!.id.name).toMatch(/^var/);
    });
  });

  describe('Obfuscation Pattern Detection', () => {
    test('should detect _0x hex patterns', async () => {
      const hexVar = createVariableDeclaration('_0x1a2b3c', 42);
      const state = createStateWithNode(hexVar);

      const result = await pass.run(state);
      expect(result.changed).toBe(true);
    });

    test('should detect _$ patterns', async () => {
      const dollarVar = createVariableDeclaration('_$abc123', 'test');
      const state = createStateWithNode(dollarVar);

      const result = await pass.run(state);
      expect(result.changed).toBe(true);
    });

    test('should detect single letter variables', async () => {
      const singleLetterVar = createVariableDeclaration('x', 100);
      const state = createStateWithNode(singleLetterVar);

      const result = await pass.run(state);
      expect(result.changed).toBe(true);
    });

    test('should detect very short meaningless names', async () => {
      const shortNameVar = createVariableDeclaration('ab', 'data');
      const state = createStateWithNode(shortNameVar);

      const result = await pass.run(state);
      expect(result.changed).toBe(true);
    });

    test('should not rename meaningful names', async () => {
      const meaningfulVar = createVariableDeclaration('userData', 42);
      const state = createStateWithNode(meaningfulVar);

      const result = await pass.run(state);
      expect(result.changed).toBe(false);
    });
  });

  describe('Collision Avoidance', () => {
    test('should avoid naming conflicts', async () => {
      // Create multiple variables that would generate same base name
      const var1 = createVariableDeclaration('_0x1', 42);
      const var2 = createVariableDeclaration('_0x2', 43);
      const state = createStateWithMultipleNodes([var1, var2]);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      // Should have unique names
      const allDeclarations = findAllVariableDeclarations(result.state);
      const names = allDeclarations.map(decl => decl.declarations[0]!.id.name);
      const uniqueNames = new Set(names);
      
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('Identifier Renaming', () => {
    test('should rename standalone identifiers', async () => {
      const identifier = createStandaloneIdentifier('_0xtest');
      const state = createStateWithNode(identifier);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      const renamedId = findIdentifier(result.state);
      expect(renamedId).toBeDefined();
      expect(renamedId!.name).toMatch(/^var/);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty IR state', async () => {
      const emptyState = createEmptyIRState();

      const result = await pass.run(emptyState);

      expect(result.changed).toBe(false);
      expect(result.state).toEqual(emptyState);
    });

    test('should validate preconditions', () => {
      const emptyState = createEmptyIRState();
      expect(pass.canRun(emptyState)).toBe(true);
      
      const stateWithNodes = createStateWithNode(createVariableDeclaration('test', 1));
      expect(pass.canRun(stateWithNodes)).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    test('should track nodes visited and changed', async () => {
      const declaration = createVariableDeclaration('_0xvar', 42);
      const state = createStateWithNode(declaration);

      const result = await pass.run(state);

      expect(result.metrics.nodes_visited).toBeGreaterThan(0);
      if (result.changed) {
        expect(result.metrics.nodes_changed).toBeGreaterThan(0);
      }
      expect(result.metrics.execution_time_ms).toBeGreaterThan(0);
    });
  });

  describe('Ollama Integration', () => {
    beforeEach(() => {
      // Mock fetch globally for Ollama tests
      global.fetch = vi.fn();
    });

    test('should use Ollama when enabled', async () => {
      const ollamaPass = new IntelligentRenamingPass({
        useOllama: true,
        ollamaUrl: 'http://localhost:11434'
      });

      // Mock successful Ollama response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'userCount'
        })
      });

      const declaration = createVariableDeclaration('_0x1234', 42);
      const state = createStateWithNode(declaration);

      const result = await ollamaPass.run(state);

      expect(result.changed).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('codellama')
        })
      );
    });

    test('should fall back to heuristics when Ollama fails', async () => {
      const ollamaPass = new IntelligentRenamingPass({
        useOllama: true,
        ollamaUrl: 'http://localhost:11434'
      });

      // Mock failed Ollama response
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection failed'));

      const declaration = createVariableDeclaration('_0x1234', 42);
      const state = createStateWithNode(declaration);

      const result = await ollamaPass.run(state);

      expect(result.changed).toBe(true);
      expect(result.warnings).toContain(
        expect.stringContaining('Ollama suggestion failed')
      );
      
      // Should still rename using heuristics
      const renamedDeclaration = findVariableDeclaration(result.state);
      expect(renamedDeclaration).toBeDefined();
      expect(renamedDeclaration!.declarations[0]!.id.name).toMatch(/^num/);
    });

    test('should sanitize invalid LLM responses', async () => {
      const ollamaPass = new IntelligentRenamingPass({
        useOllama: true,
        ollamaUrl: 'http://localhost:11434'
      });

      // Mock invalid Ollama response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: '123invalid-name!@#'
        })
      });

      const declaration = createVariableDeclaration('_0x1234', 42);
      const state = createStateWithNode(declaration);

      const result = await ollamaPass.run(state);

      expect(result.changed).toBe(true);
      
      // Should fall back to heuristics when LLM response is invalid
      const renamedDeclaration = findVariableDeclaration(result.state);
      expect(renamedDeclaration).toBeDefined();
      expect(renamedDeclaration!.declarations[0]!.id.name).toMatch(/^num/);
    });

    test('should reject JavaScript reserved words', async () => {
      const ollamaPass = new IntelligentRenamingPass({
        useOllama: true,
        ollamaUrl: 'http://localhost:11434'
      });

      // Mock Ollama response with reserved word
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'function'
        })
      });

      const declaration = createVariableDeclaration('_0x1234', 42);
      const state = createStateWithNode(declaration);

      const result = await ollamaPass.run(state);

      expect(result.changed).toBe(true);
      
      // Should fall back to heuristics when LLM suggests reserved word
      const renamedDeclaration = findVariableDeclaration(result.state);
      expect(renamedDeclaration).toBeDefined();
      expect(renamedDeclaration!.declarations[0]!.id.name).toMatch(/^num/);
    });

    test('should use custom Ollama URL', async () => {
      const customUrl = 'http://custom-ollama:8080';
      const ollamaPass = new IntelligentRenamingPass({
        useOllama: true,
        ollamaUrl: customUrl
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          response: 'counter'
        })
      });

      const declaration = createVariableDeclaration('_0x1234', 42);
      const state = createStateWithNode(declaration);

      await ollamaPass.run(state);

      expect(global.fetch).toHaveBeenCalledWith(
        `${customUrl}/api/generate`,
        expect.any(Object)
      );
    });
  });

  describe('Context Analysis', () => {
    test('should extract context from variable declarations', async () => {
      // Create variable with meaningful initializer
      const arrayDeclaration = createVariableDeclarationWithArray('_0x1234');
      const state = createStateWithNode(arrayDeclaration);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      const renamedDeclaration = findVariableDeclaration(result.state);
      expect(renamedDeclaration).toBeDefined();
      // Should infer array type from context
      expect(renamedDeclaration!.declarations[0]!.id.name).toMatch(/^arr/);
    });

    test('should extract context from function calls', async () => {
      // Create identifier used in function call context
      const callExpr = createFunctionCallWithObfuscatedArg('_0xfunc', 'someFunction');
      const state = createStateWithNode(callExpr);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      const renamed = findAllNodes(result.state, 'Identifier')
        .find((id: any) => id.name.startsWith('func'));
      expect(renamed).toBeDefined();
    });

    test('should handle complex nested expressions', async () => {
      // Create a complex expression with multiple obfuscated variables
      const complexExpr = createComplexExpression();
      const state = createStateWithNode(complexExpr);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      expect(result.metrics.nodes_changed).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long variable names', async () => {
      const longName = '_0x' + 'a'.repeat(100);
      const declaration = createVariableDeclaration(longName, 42);
      const state = createStateWithNode(declaration);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      const renamed = findVariableDeclaration(result.state);
      expect(renamed!.declarations[0]!.id.name.length).toBeLessThan(50);
    });

    test('should handle unicode characters', async () => {
      const unicodeName = '_0x123αβγ';
      const declaration = createVariableDeclaration(unicodeName, 'test');
      const state = createStateWithNode(declaration);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      const renamed = findVariableDeclaration(result.state);
      expect(renamed!.declarations[0]!.id.name).toMatch(/^str/);
    });

    test('should maintain reference consistency', async () => {
      // Create variable declaration and usage
      const declaration = createVariableDeclaration('_0xvar', 42);
      const usage = createVariableUsage('_0xvar');
      const state = createStateWithMultipleNodes([declaration, usage]);

      const result = await pass.run(state);

      expect(result.changed).toBe(true);
      
      // Both declaration and usage should have same new name
      const allIdentifiers = findAllNodes(result.state, 'Identifier') as IRIdentifier[];
      const uniqueNames = new Set(allIdentifiers.map(id => id.name));
      
      // Should have exactly one unique name for the renamed variable
      const renamedNames = Array.from(uniqueNames).filter(name => 
        name.startsWith('num') || name.startsWith('str') || name.startsWith('var')
      );
      expect(renamedNames).toHaveLength(1);
    });
  });
});

// Helper functions for creating test IR structures

function createMockCFGNode(id: string): CFGNode {
  return {
    id: id as NodeId,
    statements: [],
    predecessors: [],
    successors: [],
    dominates: new Set(),
    dominated_by: new Set(),
    post_dominates: new Set(),
    post_dominated_by: new Set()
  };
}

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

function createStateWithNode(node: IRNode): IRState {
  const state = createMockIRState();
  const nodeId = node.node_id || ('test_node_' + Math.random()) as NodeId;
  
  const nodeMap = new Map(state.nodes);
  nodeMap.set(nodeId, { ...node, node_id: nodeId });
  
  return {
    ...state,
    nodes: nodeMap
  };
}

function createStateWithMultipleNodes(nodes: IRNode[]): IRState {
  const state = createMockIRState();
  const nodeMap = new Map(state.nodes);
  
  nodes.forEach((node, index) => {
    const nodeId = node.node_id || ('test_node_' + index) as NodeId;
    nodeMap.set(nodeId, { ...node, node_id: nodeId });
  });
  
  return {
    ...state,
    nodes: nodeMap
  };
}

function createVariableDeclaration(name: string, value: unknown): IRVariableDeclaration {
  const literal = IRNodeFactory.literal(value);
  const id = IRNodeFactory.identifier(name);
  
  const declarator: IRVariableDeclarator = {
    type: 'VariableDeclarator',
    id,
    init: literal,
    node_id: ('decl_' + Math.random()) as NodeId
  };
  
  return IRNodeFactory.variableDeclaration([declarator], 'let');
}

function createStandaloneIdentifier(name: string): IRIdentifier {
  return IRNodeFactory.identifier(name);
}

function createEmptyIRState(): IRState {
  return createMockIRState();
}

// Helper functions for extracting information from results

function findVariableDeclaration(state: IRState): IRVariableDeclaration | undefined {
  for (const node of state.nodes.values()) {
    if (node.type === 'VariableDeclaration') {
      return node;
    }
  }
  return undefined;
}

function findAllVariableDeclarations(state: IRState): IRVariableDeclaration[] {
  const declarations: IRVariableDeclaration[] = [];
  for (const node of state.nodes.values()) {
    if (node.type === 'VariableDeclaration') {
      declarations.push(node);
    }
  }
  return declarations;
}

function findIdentifier(state: IRState): IRIdentifier | undefined {
  for (const node of state.nodes.values()) {
    if (node.type === 'Identifier') {
      return node;
    }
  }
  return undefined;
}

// Additional helper functions for comprehensive testing

function createVariableDeclarationWithArray(name: string): IRVariableDeclaration {
  const arrayExpr = IRNodeFactory.arrayExpression([
    IRNodeFactory.literal(1),
    IRNodeFactory.literal(2),
    IRNodeFactory.literal(3)
  ]);
  const id = IRNodeFactory.identifier(name);
  
  const declarator: IRVariableDeclarator = {
    type: 'VariableDeclarator',
    id,
    init: arrayExpr,
    node_id: ('decl_arr_' + Math.random()) as NodeId
  };
  
  return IRNodeFactory.variableDeclaration([declarator], 'let');
}

function createFunctionCallWithObfuscatedArg(argName: string, funcName: string): any {
  return IRNodeFactory.expressionStatement(
    IRNodeFactory.callExpression(
      IRNodeFactory.identifier(funcName),
      [IRNodeFactory.identifier(argName)]
    )
  );
}

function createVariableUsage(name: string): any {
  return IRNodeFactory.expressionStatement(
    IRNodeFactory.identifier(name)
  );
}

function createComplexExpression(): any {
  // Create: _0xa + _0xb * _0xc
  return IRNodeFactory.expressionStatement(
    IRNodeFactory.binaryExpression(
      '+',
      IRNodeFactory.identifier('_0xa'),
      IRNodeFactory.binaryExpression(
        '*',
        IRNodeFactory.identifier('_0xb'),
        IRNodeFactory.identifier('_0xc')
      )
    )
  );
}

function findAllNodes(state: IRState, nodeType: string): IRNode[] {
  const nodes: IRNode[] = [];
  
  function traverse(node: any): void {
    if (node && typeof node === 'object') {
      if (node.type === nodeType) {
        nodes.push(node);
      }
      
      // Traverse all properties
      for (const key in node) {
        if (key !== 'type' && key !== 'node_id') {
          const value = node[key];
          if (Array.isArray(value)) {
            value.forEach(traverse);
          } else if (value && typeof value === 'object') {
            traverse(value);
          }
        }
      }
    }
  }
  
  for (const stateNode of state.nodes.values()) {
    traverse(stateNode);
  }
  
  return nodes;
}