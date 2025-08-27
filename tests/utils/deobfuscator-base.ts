/**
 * @fileoverview Shared deobfuscation utilities for test scripts
 * 
 * This module provides common functionality used across various test scripts
 * to avoid code duplication and improve maintainability.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'acorn';
import { generate } from 'escodegen';
import type { Node } from 'acorn';

/**
 * Configuration options for deobfuscation
 */
export interface DeobfuscationConfig {
  verbose?: boolean;
  enableConstantFolding?: boolean;
  enableFunctionInlining?: boolean;
  enableDeadCodeElimination?: boolean;
  enableStringArrayDeobfuscation?: boolean;
}

/**
 * Statistics about the deobfuscation process
 */
export interface DeobfuscationStats {
  stringArraysFound: number;
  functionsInlined: number;
  constantsFolded: number;
  deadCodeRemoved: number;
  variablesRenamed: number;
}

/**
 * Base class for deobfuscation functionality
 */
export class DeobfuscatorBase {
  protected stringArrays = new Map<string, unknown[]>();
  protected constants = new Map<string, unknown>();
  protected functions = new Map<string, Node>();
  protected config: DeobfuscationConfig;
  protected stats: DeobfuscationStats;

  constructor(config: DeobfuscationConfig = {}) {
    this.config = {
      verbose: false,
      enableConstantFolding: true,
      enableFunctionInlining: true,
      enableDeadCodeElimination: true,
      enableStringArrayDeobfuscation: true,
      ...config
    };

    this.stats = {
      stringArraysFound: 0,
      functionsInlined: 0,
      constantsFolded: 0,
      deadCodeRemoved: 0,
      variablesRenamed: 0
    };
  }

  /**
   * Main deobfuscation pipeline
   */
  public deobfuscate(code: string): string {
    this.log('🔄 Starting deobfuscation process...\n');
    
    // Parse JavaScript to AST
    this.log('📋 Step 1: Parsing JavaScript to AST');
    const ast = this.parseJavaScript(code);
    
    // Analyze obfuscation patterns
    this.log('📋 Step 2: Analyzing obfuscation patterns');
    this.analyzeObfuscationPatterns(ast);
    
    // Apply transformations
    this.log('📋 Step 3: Applying deobfuscation transformations');
    this.applyTransformations(ast);
    
    // Generate cleaned code
    this.log('📋 Step 4: Generating cleaned JavaScript');
    const cleanedCode = this.generateJavaScript(ast);
    
    // Output statistics
    if (this.config.verbose) {
      this.printStats();
    }
    
    return cleanedCode;
  }

  /**
   * Parse JavaScript code to AST using Acorn
   */
  protected parseJavaScript(code: string): Node {
    try {
      return parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'script',
        locations: true
      });
    } catch (error) {
      throw new Error(`Failed to parse JavaScript: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze the AST to identify obfuscation patterns
   */
  protected analyzeObfuscationPatterns(ast: Node): void {
    this.walkAST(ast, (node) => {
      // String array detection
      if (this.config.enableStringArrayDeobfuscation) {
        this.detectStringArrays(node);
      }

      // Function detection
      this.detectFunctions(node);

      // Constant detection
      if (this.config.enableConstantFolding) {
        this.detectConstants(node);
      }
    });
  }

  /**
   * Apply deobfuscation transformations
   */
  protected applyTransformations(ast: Node): void {
    if (this.config.enableStringArrayDeobfuscation) {
      this.transformStringArrayAccess(ast);
    }

    if (this.config.enableConstantFolding) {
      this.foldConstants(ast);
    }

    if (this.config.enableFunctionInlining) {
      this.inlineFunctions(ast);
    }

    if (this.config.enableDeadCodeElimination) {
      this.eliminateDeadCode(ast);
    }
  }

  /**
   * Detect string arrays in the AST
   */
  private detectStringArrays(node: any): void {
    if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations) {
        if (declarator.init?.type === 'ArrayExpression') {
          const arrayName = declarator.id.name;
          const arrayValues = declarator.init.elements
            .map((elem: any) => elem?.type === 'Literal' ? elem.value : null)
            .filter((val: any) => val !== null);
          
          if (arrayValues.length > 0) {
            this.stringArrays.set(arrayName, arrayValues);
            this.stats.stringArraysFound++;
            this.log(`   🔍 Found string array: ${arrayName} with ${arrayValues.length} elements`);
          }
        }
      }
    }
  }

  /**
   * Detect function declarations
   */
  private detectFunctions(node: any): void {
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      this.functions.set(node.id.name, node);
      this.log(`   🔍 Found function: ${node.id.name}`);
    }
  }

  /**
   * Detect constant assignments
   */
  private detectConstants(node: any): void {
    if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations) {
        if (declarator.init?.type === 'Literal') {
          this.constants.set(declarator.id.name, declarator.init.value);
        }
      }
    }
  }

  /**
   * Transform string array access patterns
   */
  protected transformStringArrayAccess(ast: Node): void {
    this.walkAST(ast, (node) => {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        // Look for patterns like _0xc4f8(0) -> "test"
        const arrayName = node.callee.name;
        if (this.stringArrays.has(arrayName) && node.arguments.length === 1) {
          const indexArg = node.arguments[0];
          if (indexArg.type === 'Literal' && typeof indexArg.value === 'number') {
            const stringArray = this.stringArrays.get(arrayName);
            if (stringArray && indexArg.value < stringArray.length) {
              // Replace with literal string
              node.type = 'Literal';
              node.value = stringArray[indexArg.value];
              delete node.callee;
              delete node.arguments;
              this.stats.constantsFolded++;
            }
          }
        }
      }
    });
  }

  /**
   * Fold constants throughout the AST
   */
  protected foldConstants(ast: Node): void {
    this.walkAST(ast, (node) => {
      if (node.type === 'Identifier' && this.constants.has(node.name)) {
        const constantValue = this.constants.get(node.name);
        node.type = 'Literal';
        (node as any).value = constantValue;
        delete (node as any).name;
        this.stats.constantsFolded++;
      }
    });
  }

  /**
   * Inline simple functions
   */
  protected inlineFunctions(ast: Node): void {
    // Basic function inlining logic
    // This is a simplified implementation
    this.stats.functionsInlined += 0; // Placeholder
  }

  /**
   * Remove dead code
   */
  protected eliminateDeadCode(ast: Node): void {
    // Basic dead code elimination logic
    // This is a simplified implementation
    this.stats.deadCodeRemoved += 0; // Placeholder
  }

  /**
   * Generate JavaScript from AST
   */
  protected generateJavaScript(ast: Node): string {
    try {
      return generate(ast);
    } catch (error) {
      throw new Error(`Failed to generate JavaScript: ${(error as Error).message}`);
    }
  }

  /**
   * Walk the AST and apply a callback to each node
   */
  protected walkAST(node: any, callback: (node: any) => void): void {
    callback(node);

    for (const key in node) {
      if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments') {
        continue;
      }

      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(childNode => {
          if (childNode && typeof childNode === 'object' && childNode.type) {
            this.walkAST(childNode, callback);
          }
        });
      } else if (child && typeof child === 'object' && child.type) {
        this.walkAST(child, callback);
      }
    }
  }

  /**
   * Check if a variable name looks obfuscated
   */
  public static isObfuscatedName(name: string): boolean {
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
   * Read file with error handling
   */
  public static readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Write file with error handling
   */
  public static writeFile(filePath: string, content: string): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Log message if verbose mode is enabled
   */
  protected log(message: string): void {
    if (this.config.verbose) {
      console.log(message);
    }
  }

  /**
   * Print deobfuscation statistics
   */
  protected printStats(): void {
    console.log('\n📊 Deobfuscation Statistics:');
    console.log(`   String arrays found: ${this.stats.stringArraysFound}`);
    console.log(`   Constants folded: ${this.stats.constantsFolded}`);
    console.log(`   Functions inlined: ${this.stats.functionsInlined}`);
    console.log(`   Dead code removed: ${this.stats.deadCodeRemoved}`);
    console.log(`   Variables renamed: ${this.stats.variablesRenamed}`);
  }

  /**
   * Get deobfuscation statistics
   */
  public getStats(): DeobfuscationStats {
    return { ...this.stats };
  }
}