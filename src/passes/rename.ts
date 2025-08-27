/**
 * Intelligent Renaming Pass - Phase 1.2 of ArachneJS Enhancement Plan
 * 
 * Renames obfuscated identifiers to meaningful names based on inferred types
 * and usage patterns. This is a simplified but functional implementation that
 * demonstrates the core renaming concepts.
 */

import { BasePass, PassUtils } from './Pass.js';
import type { 
  IRState, 
  PassResult
} from './Pass.js';
import type {
  IRNode,
  IRIdentifier,
  IRVariableDeclaration,
  IRLiteral,
  IRExpression,
  IRStatement,
  IRPattern,
  IRBinaryExpression,
  IRUnaryExpression,
  IRAssignmentExpression,
  IRCallExpression,
  IRBlockStatement,
  IRExpressionStatement,
  IRIfStatement,
  IRWhileStatement,
  IRForStatement,
  IRReturnStatement,
  NodeId,
  VariableName,
  ScopeId
} from '../ir/nodes.js';
import { IRNodeFactory } from '../ir/nodes.js';

/**
 * Simple renaming strategy
 */
interface RenamingStrategy {
  readonly originalName: string;
  readonly newName: string;
  readonly reason: string;
}

/**
 * Intelligent Renaming Pass implementation
 * 
 * A simplified but functional implementation that renames obfuscated identifiers
 * to more readable names based on basic heuristics and type inference.
 */
export class IntelligentRenamingPass extends BasePass<IRState> {
  readonly name = 'intelligent-renaming';
  readonly description = 'Rename obfuscated identifiers using heuristics and optional LLM assistance';

  private readonly renamingMap = new Map<string, string>();
  private readonly usedNames = new Set<string>();
  private heuristicCounters = new Map<string, number>();
  
  // Ollama integration options
  private readonly useOllama: boolean;
  private readonly ollamaUrl: string;

  constructor(options: { useOllama?: boolean; ollamaUrl?: string } = {}) {
    super();
    this.useOllama = options.useOllama ?? false;
    this.ollamaUrl = options.ollamaUrl ?? 'http://localhost:11434';
  }

  protected async executePass(state: IRState): Promise<{ state: IRState; changed: boolean }> {
    // Reset state
    this.renamingMap.clear();
    this.usedNames.clear();
    this.heuristicCounters.clear();

    // Debug: console.log('🔍 IntelligentRenamingPass: Starting execution');

    // Collect all obfuscated variables
    const obfuscatedVars = this.collectObfuscatedVariables(state);
    
    if (obfuscatedVars.size === 0) {
      return { state, changed: false };
    }

    // Generate new names for obfuscated variables
    await this.generateRenamings(obfuscatedVars, state);

    // Apply renamings to all nodes
    const { newNodes, changed } = this.applyRenamings(state);

    if (changed) {
      const newState = PassUtils.updateNodes(state, newNodes);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Collect all obfuscated variable names in the IR
   */
  private collectObfuscatedVariables(state: IRState): Set<string> {
    const obfuscatedVars = new Set<string>();

    for (const [nodeId, node] of state.nodes) {
      this.visitNode();
      this.findObfuscatedInNode(node, obfuscatedVars);
    }
    return obfuscatedVars;
  }

  /**
   * Recursively find obfuscated identifiers in a node
   */
  private findObfuscatedInNode(node: IRNode, obfuscatedVars: Set<string>): void {
    console.log(`    findObfuscatedInNode: processing ${node.type}`);
    
    switch (node.type) {
      case 'Program':
        console.log(`      Program: processing ${node.body.length} statements`);
        for (const stmt of node.body) {
          this.findObfuscatedInNode(stmt, obfuscatedVars);
        }
        break;
        
      case 'Identifier':
        console.log(`      Identifier: "${node.name}"`);
        if (this.isObfuscatedName(node.name)) {
          console.log(`        ✅ Found obfuscated: "${node.name}"`);
          obfuscatedVars.add(node.name);
        } else {
          console.log(`        ❌ Not obfuscated: "${node.name}"`);
        }
        break;
        
      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          this.findObfuscatedInNode(declarator.id, obfuscatedVars);
          if (declarator.init) {
            this.findObfuscatedInNode(declarator.init, obfuscatedVars);
          }
        }
        break;
        
      case 'AssignmentExpression':
        this.findObfuscatedInNode(node.left, obfuscatedVars);
        this.findObfuscatedInNode(node.right, obfuscatedVars);
        break;
        
      case 'BinaryExpression':
        this.findObfuscatedInNode(node.left, obfuscatedVars);
        this.findObfuscatedInNode(node.right, obfuscatedVars);
        break;
        
      case 'UnaryExpression':
        this.findObfuscatedInNode(node.argument, obfuscatedVars);
        break;
        
      case 'CallExpression':
        this.findObfuscatedInNode(node.callee, obfuscatedVars);
        for (const arg of node.arguments) {
          this.findObfuscatedInNode(arg, obfuscatedVars);
        }
        break;
        
      case 'BlockStatement':
        for (const stmt of node.body) {
          this.findObfuscatedInNode(stmt, obfuscatedVars);
        }
        break;
        
      case 'ExpressionStatement':
        this.findObfuscatedInNode(node.expression, obfuscatedVars);
        break;
        
      case 'IfStatement':
        this.findObfuscatedInNode(node.test, obfuscatedVars);
        this.findObfuscatedInNode(node.consequent, obfuscatedVars);
        if (node.alternate) {
          this.findObfuscatedInNode(node.alternate, obfuscatedVars);
        }
        break;
        
      case 'WhileStatement':
        this.findObfuscatedInNode(node.test, obfuscatedVars);
        this.findObfuscatedInNode(node.body, obfuscatedVars);
        break;
        
      case 'ForStatement':
        if (node.init) this.findObfuscatedInNode(node.init, obfuscatedVars);
        if (node.test) this.findObfuscatedInNode(node.test, obfuscatedVars);
        if (node.update) this.findObfuscatedInNode(node.update, obfuscatedVars);
        this.findObfuscatedInNode(node.body, obfuscatedVars);
        break;
        
      case 'ReturnStatement':
        if (node.argument) {
          this.findObfuscatedInNode(node.argument, obfuscatedVars);
        }
        break;
    }
  }

  /**
   * Check if a name appears obfuscated using common patterns
   */
  private isObfuscatedName(name: string): boolean {
    return (
      /^_0x[a-fA-F0-9]+$/i.test(name) ||      // _0x1234, _0xabcd
      /^_\$[a-zA-Z0-9]+$/.test(name) ||       // _$abcd, _$flag
      /^[a-zA-Z]$/.test(name) ||              // Single letters
      /^[a-zA-Z]{1,2}$/.test(name) ||         // Very short names (2 chars)
      /^[a-zA-Z](?:\d+)?$/.test(name) ||      // Single letter + optional numbers
      /^[_$][a-zA-Z0-9]{1,3}$/.test(name) ||  // Short underscore/dollar prefixed
      /^hex_[a-fA-F0-9]+$/i.test(name) ||     // hex_123abc pattern
      /^[a-zA-Z]+_[a-fA-F0-9]+$/i.test(name)  // general_hex123 patterns
    );
  }

  /**
   * Generate renaming suggestions for all obfuscated variables
   */
  private async generateRenamings(obfuscatedVars: Set<string>, state: IRState): Promise<void> {
    for (const varName of obfuscatedVars) {
      if (this.renamingMap.has(varName)) continue;

      let newName: string;
      
      if (this.useOllama) {
        try {
          const context = this.extractVariableContext(varName, state);
          const suggestion = await this.getOllamaNameSuggestion(varName, context);
          newName = this.sanitizeLlmResponse(suggestion) || this.generateHeuristicName(varName, context);
        } catch (error) {
          this.warn(`Ollama suggestion failed for ${varName}: ${error instanceof Error ? error.message : String(error)}`);
          newName = this.generateHeuristicName(varName, '');
        }
      } else {
        const context = this.extractVariableContext(varName, state);
        newName = this.generateHeuristicName(varName, context);
      }

      const uniqueName = this.ensureUniqueName(newName);
      this.renamingMap.set(varName, uniqueName);
    }
  }

  /**
   * Extract context around a variable to understand its purpose
   */
  private extractVariableContext(varName: string, state: IRState): string {
    const contexts: string[] = [];
    
    for (const [nodeId, node] of state.nodes) {
      const context = this.extractContextFromNode(node, varName);
      if (context) {
        contexts.push(context);
      }
    }
    
    return contexts.slice(0, 3).join('; '); // Limit context size
  }

  /**
   * Extract context about a variable from a specific node
   */
  private extractContextFromNode(node: IRNode, targetVar: string): string | null {
    switch (node.type) {
      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          if (declarator.id.type === 'Identifier' && declarator.id.name === targetVar) {
            if (declarator.init) {
              return `declared as ${this.nodeToContextString(declarator.init)}`;
            }
          }
        }
        break;
        
      case 'AssignmentExpression':
        if (node.left.type === 'Identifier' && node.left.name === targetVar) {
          return `assigned ${this.nodeToContextString(node.right)}`;
        }
        break;
        
      case 'BinaryExpression':
        if (node.left.type === 'Identifier' && node.left.name === targetVar) {
          return `compared with ${this.nodeToContextString(node.right)}`;
        }
        if (node.right.type === 'Identifier' && node.right.name === targetVar) {
          return `compared with ${this.nodeToContextString(node.left)}`;
        }
        break;
        
      case 'CallExpression':
        if (node.callee.type === 'Identifier' && node.callee.name === targetVar) {
          return 'called as function';
        }
        for (const arg of node.arguments) {
          if (arg.type === 'Identifier' && arg.name === targetVar) {
            return 'used as function argument';
          }
        }
        break;
    }
    
    return null;
  }

  /**
   * Convert a node to a brief context string
   */
  private nodeToContextString(node: IRNode): string {
    switch (node.type) {
      case 'Literal':
        if (typeof node.value === 'string') {
          return `string "${node.value.slice(0, 20)}"`;
        } else if (typeof node.value === 'number') {
          return `number ${node.value}`;
        } else if (typeof node.value === 'boolean') {
          return `boolean ${node.value}`;
        }
        return 'literal';
        
      case 'Identifier':
        return `identifier ${node.name}`;
        
      case 'BinaryExpression':
        return `${node.operator} expression`;
        
      case 'CallExpression':
        return 'function call';
        
      case 'ArrayExpression':
        return 'array';
        
      case 'ObjectExpression':
        return 'object';
        
      default:
        return node.type;
    }
  }

  /**
   * Generate a heuristic name based on context and patterns
   */
  private generateHeuristicName(originalName: string, context: string): string {
    // Analyze context for clues
    if (context.includes('number')) {
      return this.getNextHeuristicName('num');
    }
    
    if (context.includes('string')) {
      return this.getNextHeuristicName('str');
    }
    
    if (context.includes('boolean')) {
      return this.getNextHeuristicName('bool');
    }
    
    if (context.includes('array')) {
      return this.getNextHeuristicName('arr');
    }
    
    if (context.includes('object')) {
      return this.getNextHeuristicName('obj');
    }
    
    if (context.includes('function') || context.includes('called')) {
      return this.getNextHeuristicName('func');
    }
    
    if (context.includes('compared')) {
      return this.getNextHeuristicName('flag');
    }
    
    // Pattern-based fallbacks
    if (/^_0x/.test(originalName)) {
      return this.getNextHeuristicName('hex');
    }
    
    if (/^[a-z]$/.test(originalName)) {
      return this.getNextHeuristicName('var');
    }
    
    // Default fallback
    return this.getNextHeuristicName('unknown');
  }

  /**
   * Get next available heuristic name with counter
   */
  private getNextHeuristicName(baseName: string): string {
    const currentCount = this.heuristicCounters.get(baseName) || 0;
    const newCount = currentCount + 1;
    this.heuristicCounters.set(baseName, newCount);
    
    return `${baseName}_${newCount}`;
  }

  /**
   * Get name suggestion from Ollama LLM
   */
  private async getOllamaNameSuggestion(originalName: string, context: string): Promise<string> {
    const prompt = `You are a code analysis expert. Given an obfuscated JavaScript variable name and its usage context, suggest a meaningful variable name.

Rules:
1. Use camelCase for variable names
2. Be concise (1-2 words max)
3. Focus on the variable's purpose/type
4. Avoid generic names like 'value' or 'data'
5. Return ONLY the variable name, no explanation

Original name: ${originalName}
Context: ${context || 'no context available'}

Suggested variable name:`;

    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'codellama', // or 'llama2', 'mistral', etc.
        prompt,
        stream: false,
        options: {
          temperature: 0.3,  // Lower temperature for more deterministic responses
          max_tokens: 50,    // Short response
          stop: ['\n', '.', ':', ';']  // Stop at punctuation
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response?.trim() || '';
  }

  /**
   * Sanitize and validate LLM response to ensure it's a valid JavaScript identifier
   */
  private sanitizeLlmResponse(response: string): string | null {
    if (!response) return null;
    
    // Extract potential variable name (remove quotes, whitespace, etc.)
    let cleaned = response
      .replace(/['"]/g, '')           // Remove quotes
      .replace(/\s+/g, '')            // Remove whitespace
      .replace(/[^a-zA-Z0-9_$]/g, '') // Remove invalid identifier chars
      .trim();

    // Ensure it starts with a valid character
    if (!/^[a-zA-Z_$]/.test(cleaned)) {
      return null;
    }
    
    // Ensure it's not empty and not too long
    if (cleaned.length === 0 || cleaned.length > 30) {
      return null;
    }
    
    // Ensure it's not a JavaScript reserved word
    const reservedWords = [
      'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
      'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
      'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new',
      'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
      'void', 'while', 'with', 'yield'
    ];
    
    if (reservedWords.includes(cleaned.toLowerCase())) {
      return null;
    }
    
    return cleaned;
  }

  /**
   * Ensure name uniqueness across the entire codebase
   */
  private ensureUniqueName(baseName: string): string {
    let uniqueName = baseName;
    let counter = 1;

    while (this.usedNames.has(uniqueName)) {
      uniqueName = `${baseName}_${counter}`;
      counter++;
    }

    this.usedNames.add(uniqueName);
    return uniqueName;
  }

  /**
   * Apply all renamings to the IR state
   */
  private applyRenamings(state: IRState): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    const newNodes = new Map<NodeId, IRNode>();
    let changed = false;

    console.log('🔍 applyRenamings: processing', state.nodes.size, 'nodes');
    console.log('Available renaming map:', Object.fromEntries(this.renamingMap));

    for (const [nodeId, node] of state.nodes) {
      console.log(`  Processing node ${nodeId}: ${node.type}`);
      const renamedNode = this.applyRenamingToNode(node);
      
      if (renamedNode !== node) {
        console.log(`    ✅ Node changed: ${nodeId}`);
        newNodes.set(nodeId, renamedNode);
        changed = true;
        this.changeNode();
      } else {
        console.log(`    ❌ Node unchanged: ${nodeId}`);
      }
    }

    console.log(`🔍 applyRenamings: changed=${changed}, newNodes=${newNodes.size}`);
    return { newNodes, changed };
  }

  /**
   * Recursively apply renaming to a node and all its children
   */
  private applyRenamingToNode(node: IRNode): IRNode {
    console.log(`      applyRenamingToNode: ${node.type}`);
    
    switch (node.type) {
      case 'Program':
        console.log(`        Program: processing ${node.body.length} statements`);
        const newBody = node.body.map(stmt => this.applyRenamingToNode(stmt) as IRStatement);
        const bodyChanged = newBody.some((stmt, index) => stmt !== node.body[index]);
        
        if (bodyChanged) {
          console.log(`        ✅ Program body changed`);
          return { ...node, body: newBody };
        }
        return node;
        
      case 'Identifier':
        const newName = this.renamingMap.get(node.name);
        console.log(`        Identifier "${node.name}" -> ${newName || 'unchanged'}`);
        if (newName) {
          console.log(`        ✅ Renaming "${node.name}" to "${newName}"`);
          return { ...node, name: newName };
        }
        return node;
        
      case 'VariableDeclaration':
        const newDeclarations = node.declarations.map(declarator => ({
          ...declarator,
          id: this.applyRenamingToNode(declarator.id) as IRIdentifier,
          init: declarator.init ? this.applyRenamingToNode(declarator.init) as IRExpression : null
        }));
        
        const declChanged = newDeclarations.some((decl, index) => 
          decl !== node.declarations[index]
        );
        
        return declChanged ? { ...node, declarations: newDeclarations } : node;
        
      case 'AssignmentExpression':
        const newLeft = this.applyRenamingToNode(node.left) as IRPattern;
        const newRight = this.applyRenamingToNode(node.right) as IRExpression;
        
        if (newLeft !== node.left || newRight !== node.right) {
          return { ...node, left: newLeft, right: newRight };
        }
        return node;
        
      case 'BinaryExpression':
        const newBinLeft = this.applyRenamingToNode(node.left) as IRExpression;
        const newBinRight = this.applyRenamingToNode(node.right) as IRExpression;
        
        if (newBinLeft !== node.left || newBinRight !== node.right) {
          return { ...node, left: newBinLeft, right: newBinRight };
        }
        return node;
        
      case 'UnaryExpression':
        const newArgument = this.applyRenamingToNode(node.argument) as IRExpression;
        
        if (newArgument !== node.argument) {
          return { ...node, argument: newArgument };
        }
        return node;
        
      case 'CallExpression':
        const newCallee = this.applyRenamingToNode(node.callee) as IRExpression;
        const newArguments = node.arguments.map(arg => 
          this.applyRenamingToNode(arg) as IRExpression
        );
        
        const callChanged = newCallee !== node.callee || 
          newArguments.some((arg, index) => arg !== node.arguments[index]);
          
        if (callChanged) {
          return { ...node, callee: newCallee, arguments: newArguments };
        }
        return node;
        
      case 'BlockStatement':
        const newBlockBody = node.body.map(stmt => 
          this.applyRenamingToNode(stmt) as IRStatement
        );
        
        const blockChanged = newBlockBody.some((stmt, index) => stmt !== node.body[index]);
        
        if (blockChanged) {
          return { ...node, body: newBlockBody };
        }
        return node;
        
      case 'ExpressionStatement':
        const newExpression = this.applyRenamingToNode(node.expression) as IRExpression;
        
        if (newExpression !== node.expression) {
          return { ...node, expression: newExpression };
        }
        return node;
        
      case 'IfStatement':
        const newTest = this.applyRenamingToNode(node.test) as IRExpression;
        const newConsequent = this.applyRenamingToNode(node.consequent) as IRStatement;
        const newAlternate = node.alternate ? 
          this.applyRenamingToNode(node.alternate) as IRStatement : null;
        
        const ifChanged = newTest !== node.test || newConsequent !== node.consequent || 
          newAlternate !== node.alternate;
          
        if (ifChanged) {
          return { ...node, test: newTest, consequent: newConsequent, alternate: newAlternate };
        }
        return node;
        
      case 'WhileStatement':
        const newWhileTest = this.applyRenamingToNode(node.test) as IRExpression;
        const newWhileBody = this.applyRenamingToNode(node.body) as IRStatement;
        
        if (newWhileTest !== node.test || newWhileBody !== node.body) {
          return { ...node, test: newWhileTest, body: newWhileBody };
        }
        return node;
        
      case 'ForStatement':
        const newForInit = node.init ? 
          this.applyRenamingToNode(node.init) as IRVariableDeclaration | IRExpression : null;
        const newForTest = node.test ? 
          this.applyRenamingToNode(node.test) as IRExpression : null;
        const newForUpdate = node.update ? 
          this.applyRenamingToNode(node.update) as IRExpression : null;
        const newForBody = this.applyRenamingToNode(node.body) as IRStatement;
        
        const forChanged = newForInit !== node.init || newForTest !== node.test || 
          newForUpdate !== node.update || newForBody !== node.body;
          
        if (forChanged) {
          return { 
            ...node, 
            init: newForInit, 
            test: newForTest, 
            update: newForUpdate, 
            body: newForBody 
          };
        }
        return node;
        
      case 'ReturnStatement':
        const newReturnArg = node.argument ? 
          this.applyRenamingToNode(node.argument) as IRExpression : null;
          
        if (newReturnArg !== node.argument) {
          return { ...node, argument: newReturnArg };
        }
        return node;
        
      // For other node types, return as-is (literals, etc.)
      default:
        return node;
    }
  }

  /**
   * Validate pass can run on the current state
   */
  override canRun(state: IRState): boolean {
    return true; // Can always run, even on empty state
  }
}