#!/usr/bin/env node

/**
 * @fileoverview Advanced deobfuscation example using the shared base class
 * 
 * This replaces the redundant test-deobfuscator-complete.js file and demonstrates
 * advanced deobfuscation techniques using the consolidated base class.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { DeobfuscatorBase, type DeobfuscationConfig } from '../utils/deobfuscator-base.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Advanced deobfuscator with comprehensive transformations
 */
class AdvancedDeobfuscator extends DeobfuscatorBase {
  private inlinableFunctions = new Map<string, any>();
  private deadVariables = new Set<string>();
  private usedArrayElements = new Set<string>();

  constructor(config?: DeobfuscationConfig) {
    super({
      verbose: true,
      enableConstantFolding: true,
      enableStringArrayDeobfuscation: true,
      enableDeadCodeElimination: true,
      enableFunctionInlining: true,
      ...config
    });
  }

  /**
   * Enhanced transformation pipeline with additional passes
   */
  protected applyTransformations(ast: any): void {
    console.log('   🔧 Applying string array deobfuscation...');
    super.applyTransformations(ast);
    
    console.log('   🔧 Normalizing property access...');
    this.normalizePropertyAccess(ast);
    
    console.log('   🔧 Identifying inlinable functions...');
    this.identifyInlinableFunctions(ast);
    
    console.log('   🔧 Performing advanced function inlining...');
    this.advancedFunctionInlining(ast);
    
    console.log('   🔧 Removing unused variables...');
    this.removeUnusedVariables(ast);
    
    console.log('   🔧 Cleaning up string array declarations...');
    this.cleanupStringArrays(ast);
    
    console.log('   🔧 Final optimization pass...');
    this.finalOptimizationPass(ast);
  }

  /**
   * Normalize property access patterns (obj['prop'] -> obj.prop)
   */
  private normalizePropertyAccess(ast: any): void {
    this.walkAST(ast, (node) => {
      if (node.type === 'MemberExpression' && 
          node.computed && 
          node.property.type === 'Literal' && 
          typeof node.property.value === 'string' &&
          /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(node.property.value)) {
        
        // Convert to dot notation
        node.computed = false;
        node.property = {
          type: 'Identifier',
          name: node.property.value
        };
      }
    });
  }

  /**
   * Identify functions that can be safely inlined
   */
  private identifyInlinableFunctions(ast: any): void {
    this.walkAST(ast, (node) => {
      if (node.type === 'FunctionDeclaration' && 
          node.id && 
          node.body.body.length === 1 &&
          node.body.body[0].type === 'ReturnStatement') {
        
        const funcName = node.id.name;
        this.inlinableFunctions.set(funcName, node);
        this.log(`   🎯 Function ${funcName} marked for inlining`);
      }
    });
  }

  /**
   * Advanced function inlining with safety checks
   */
  private advancedFunctionInlining(ast: any): void {
    this.walkAST(ast, (node) => {
      if (node.type === 'CallExpression' && 
          node.callee.type === 'Identifier' &&
          this.inlinableFunctions.has(node.callee.name)) {
        
        const funcName = node.callee.name;
        const funcNode = this.inlinableFunctions.get(funcName);
        const returnExpr = funcNode.body.body[0].argument;
        
        if (returnExpr && this.canSafelyInline(returnExpr, node.arguments)) {
          // Replace the call with the inlined expression
          this.inlineExpression(node, returnExpr, funcNode.params, node.arguments);
          this.stats.functionsInlined++;
          this.log(`   ✅ Inlined function: ${funcName}`);
        }
      }
    });
  }

  /**
   * Check if an expression can be safely inlined
   */
  private canSafelyInline(returnExpr: any, args: any[]): boolean {
    // Simple safety check - avoid complex expressions with side effects
    return returnExpr.type === 'BinaryExpression' || 
           returnExpr.type === 'Identifier' || 
           returnExpr.type === 'Literal';
  }

  /**
   * Inline an expression by substituting parameters
   */
  private inlineExpression(callNode: any, returnExpr: any, params: any[], args: any[]): void {
    // Create a parameter substitution map
    const substitutions = new Map<string, any>();
    params.forEach((param, index) => {
      if (args[index]) {
        substitutions.set(param.name, args[index]);
      }
    });

    // Clone and substitute the expression
    const inlinedExpr = this.cloneAndSubstitute(returnExpr, substitutions);
    
    // Replace the call node with the inlined expression
    Object.assign(callNode, inlinedExpr);
  }

  /**
   * Clone and substitute parameters in an expression
   */
  private cloneAndSubstitute(expr: any, substitutions: Map<string, any>): any {
    if (!expr || typeof expr !== 'object') {
      return expr;
    }

    if (expr.type === 'Identifier' && substitutions.has(expr.name)) {
      return this.cloneNode(substitutions.get(expr.name));
    }

    const cloned = { ...expr };
    for (const key in cloned) {
      if (Array.isArray(cloned[key])) {
        cloned[key] = cloned[key].map((item: any) => 
          this.cloneAndSubstitute(item, substitutions)
        );
      } else if (cloned[key] && typeof cloned[key] === 'object') {
        cloned[key] = this.cloneAndSubstitute(cloned[key], substitutions);
      }
    }

    return cloned;
  }

  /**
   * Deep clone a node
   */
  private cloneNode(node: any): any {
    if (!node || typeof node !== 'object') {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map(item => this.cloneNode(item));
    }

    const cloned: any = {};
    for (const key in node) {
      cloned[key] = this.cloneNode(node[key]);
    }
    return cloned;
  }

  /**
   * Remove unused variables
   */
  private removeUnusedVariables(ast: any): void {
    const declaredVars = new Set<string>();
    const usedVars = new Set<string>();

    // First pass: collect all declarations
    this.walkAST(ast, (node) => {
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
        declaredVars.add(node.id.name);
      }
    });

    // Second pass: collect all usages
    this.walkAST(ast, (node) => {
      if (node.type === 'Identifier') {
        usedVars.add(node.name);
      }
    });

    // Find unused variables
    for (const varName of declaredVars) {
      if (!usedVars.has(varName)) {
        this.deadVariables.add(varName);
        this.stats.deadCodeRemoved++;
      }
    }

    this.log(`   🗑️ Found ${this.deadVariables.size} unused variables`);
  }

  /**
   * Clean up string array declarations that are no longer needed
   */
  private cleanupStringArrays(ast: any): void {
    this.walkAST(ast, (node, parent, key, index) => {
      if (node.type === 'VariableDeclaration') {
        // Filter out string array declarations
        node.declarations = node.declarations.filter((decl: any) => {
          if (decl.id.type === 'Identifier' && this.stringArrays.has(decl.id.name)) {
            this.log(`   🧹 Removed string array declaration: ${decl.id.name}`);
            return false;
          }
          return true;
        });

        // Remove empty variable declarations
        if (node.declarations.length === 0 && parent && Array.isArray(parent[key])) {
          parent[key].splice(index, 1);
        }
      }
    });
  }

  /**
   * Final optimization pass to clean up remaining artifacts
   */
  private finalOptimizationPass(ast: any): void {
    this.walkAST(ast, (node, parent, key, index) => {
      // Remove empty statements
      if (node.type === 'EmptyStatement' && parent && Array.isArray(parent[key])) {
        parent[key].splice(index, 1);
        return;
      }

      // Remove unused function declarations
      if (node.type === 'FunctionDeclaration' && 
          node.id && 
          this.inlinableFunctions.has(node.id.name)) {
        if (parent && Array.isArray(parent[key])) {
          parent[key].splice(index, 1);
          this.log(`   🧹 Removed inlined function: ${node.id.name}`);
        }
      }
    });
  }

  /**
   * Enhanced AST walker with parent and index information
   */
  protected walkAST(node: any, callback: (node: any, parent?: any, key?: string, index?: number) => void, parent?: any, key?: string, index?: number): void {
    callback(node, parent, key, index);

    for (const childKey in node) {
      if (childKey === 'parent' || childKey === 'leadingComments' || childKey === 'trailingComments') {
        continue;
      }

      const child = node[childKey];
      if (Array.isArray(child)) {
        child.forEach((childNode, childIndex) => {
          if (childNode && typeof childNode === 'object' && childNode.type) {
            this.walkAST(childNode, callback, node, childKey, childIndex);
          }
        });
      } else if (child && typeof child === 'object' && child.type) {
        this.walkAST(child, callback, node, childKey);
      }
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 ArachneJS Advanced Deobfuscation Demo');
    console.log('========================================\n');

    // Create a complex obfuscated sample for demonstration
    const complexObfuscatedCode = `
      var _0x4f2a = ['test', 'hello', 'world', 'function', 'return'];
      var _0x1b3c = function(a, b) { return a + b; };
      var _0x2d4e = function() { return _0x4f2a[0]; };
      var _0x3f5g = function(x) { return x * 2; };
      
      function decoder(index) { 
        return _0x4f2a[index]; 
      }
      
      var message = decoder(1) + ' ' + decoder(2);
      var unused_var = 'never used';
      var result = _0x1b3c(5, 3);
      var doubled = _0x3f5g(result);
      
      console['log'](message);
      console['log']('Result:', doubled);
    `;

    console.log('📝 Complex obfuscated code sample:');
    console.log('----------------------------------------');
    console.log(complexObfuscatedCode);
    console.log('----------------------------------------\n');

    // Create advanced deobfuscator and process
    const deobfuscator = new AdvancedDeobfuscator();
    const cleanedCode = deobfuscator.deobfuscate(complexObfuscatedCode);
    
    console.log('\n✨ Fully deobfuscated code:');
    console.log('----------------------------------------');
    console.log(cleanedCode);
    console.log('----------------------------------------\n');
    
    // Save output
    const outputPath = path.join(__dirname, '../../output/advanced-deobfuscated.js');
    DeobfuscatorBase.writeFile(outputPath, cleanedCode);
    console.log(`💾 Saved deobfuscated code to: ${outputPath}`);
    
    console.log('\n✅ Advanced deobfuscation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during advanced deobfuscation:', (error as Error).message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${__filename}`) {
  main();
}

export { AdvancedDeobfuscator };