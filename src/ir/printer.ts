/**
 * @fileoverview IR to JavaScript printer with sourcemap generation
 * 
 * This module converts IR nodes back to JavaScript source code while preserving
 * formatting, comments, and generating accurate source maps for debugging.
 */

import type {
  IRNode,
  IRStatement,
  IRExpression,
  IRProgram,
  IRBlockStatement,
  IRIdentifier,
  IRLiteral,
  IRBinaryExpression,
  IRUnaryExpression,
  IRCallExpression,
  IRMemberExpression,
  IRVariableDeclaration,
  IRFunctionDeclaration,
  IRIfStatement,
  IRWhileStatement,
  IRForStatement,
  IRReturnStatement,
  IRPhiNode,
  IRSSAIdentifier,
  IRPattern
} from './nodes.js';
import { SourceMapGenerator } from 'source-map';

/**
 * Printer configuration options
 */
export interface PrinterOptions {
  readonly indent: string;
  readonly newline: string;
  readonly preserveComments: boolean;
  readonly generateSourceMap: boolean;
  readonly sourceMapFile?: string;
  readonly sourceRoot?: string;
  readonly minify: boolean;
  readonly maxLineLength: number;
}

/**
 * Default printer options
 */
export const defaultPrinterOptions: PrinterOptions = {
  indent: '  ',
  newline: '\n',
  preserveComments: true,
  generateSourceMap: false,
  minify: false,
  maxLineLength: 100
};

/**
 * Printer context for tracking state during printing
 */
interface PrinterContext {
  readonly options: PrinterOptions;
  readonly sourceMap?: SourceMapGenerator;
  currentIndent: string;
  currentLine: number;
  currentColumn: number;
  needsNewline: boolean;
  needsSemicolon: boolean;
}

/**
 * JavaScript printer result
 */
export interface PrintResult {
  readonly code: string;
  readonly sourceMap?: string;
  readonly sourceMapObject?: object;
}

/**
 * IR to JavaScript printer
 */
export class IRPrinter {
  private readonly context: PrinterContext;

  constructor(options: Partial<PrinterOptions> = {}) {
    const fullOptions: PrinterOptions = { ...defaultPrinterOptions, ...options };
    
    this.context = {
      options: fullOptions,
      sourceMap: fullOptions.generateSourceMap ? new SourceMapGenerator({
        file: fullOptions.sourceMapFile || 'generated.js',
        sourceRoot: fullOptions.sourceRoot
      }) : undefined,
      currentIndent: '',
      currentLine: 1,
      currentColumn: 0,
      needsNewline: false,
      needsSemicolon: false
    };
  }

  /**
   * Print IR node to JavaScript source
   */
  print(node: IRNode): PrintResult {
    const code = this.printNode(node);
    
    return {
      code,
      sourceMap: this.context.sourceMap?.toString(),
      sourceMapObject: this.context.sourceMap?.toJSON()
    };
  }

  /**
   * Print any IR node
   */
  private printNode(node: IRNode): string {
    // Add source map mapping if location available
    if (this.context.sourceMap && node.loc) {
      this.context.sourceMap.addMapping({
        generated: {
          line: this.context.currentLine,
          column: this.context.currentColumn
        },
        original: {
          line: node.loc.start.line,
          column: node.loc.start.column
        },
        source: node.loc.source || 'source.js'
      });
    }

    switch (node.type) {
      // Program
      case 'Program':
        return this.printProgram(node);

      // Statements
      case 'BlockStatement':
        return this.printBlockStatement(node);
      case 'ExpressionStatement':
        return this.printExpressionStatement(node);
      case 'VariableDeclaration':
        return this.printVariableDeclaration(node);
      case 'FunctionDeclaration':
        return this.printFunctionDeclaration(node);
      case 'ReturnStatement':
        return this.printReturnStatement(node);
      case 'IfStatement':
        return this.printIfStatement(node);
      case 'WhileStatement':
        return this.printWhileStatement(node);
      case 'ForStatement':
        return this.printForStatement(node);
      case 'BreakStatement':
        return this.write('break');
      case 'ContinueStatement':
        return this.write('continue');
      case 'EmptyStatement':
        return '';
      case 'DebuggerStatement':
        return this.write('debugger');

      // Expressions
      case 'Identifier':
        return this.printIdentifier(node);
      case 'Literal':
        return this.printLiteral(node);
      case 'BinaryExpression':
        return this.printBinaryExpression(node);
      case 'UnaryExpression':
        return this.printUnaryExpression(node);
      case 'UpdateExpression':
        return this.printUpdateExpression(node);
      case 'AssignmentExpression':
        return this.printAssignmentExpression(node);
      case 'LogicalExpression':
        return this.printLogicalExpression(node);
      case 'ConditionalExpression':
        return this.printConditionalExpression(node);
      case 'CallExpression':
        return this.printCallExpression(node);
      case 'NewExpression':
        return this.printNewExpression(node);
      case 'MemberExpression':
        return this.printMemberExpression(node);
      case 'ArrayExpression':
        return this.printArrayExpression(node);
      case 'ObjectExpression':
        return this.printObjectExpression(node);
      case 'SequenceExpression':
        return this.printSequenceExpression(node);

      // SSA-specific nodes (should be normalized before printing)
      case 'PhiNode':
        return this.printPhiNode(node);
      case 'SSAIdentifier':
        return this.printSSAIdentifier(node);

      default:
        throw new Error(`Unknown IR node type: ${(node as IRNode).type}`);
    }
  }

  /**
   * Print program node
   */
  private printProgram(node: IRProgram): string {
    const statements = node.body.map(stmt => {
      const code = this.printNode(stmt);
      this.addSemicolonIfNeeded(stmt);
      return code;
    });

    return statements.join(this.context.options.minify ? '' : this.context.options.newline);
  }

  /**
   * Print block statement
   */
  private printBlockStatement(node: IRBlockStatement): string {
    if (node.body.length === 0) {
      return this.write('{}');
    }

    let result = this.write('{');
    this.increaseIndent();
    this.writeNewline();

    // Print phi nodes as comments if present
    if (node.phi_nodes && node.phi_nodes.length > 0) {
      for (const phi of node.phi_nodes) {
        result += this.writeIndent();
        result += this.write(`// φ ${this.printPhiNode(phi)}`);
        this.writeNewline();
      }
    }

    for (let i = 0; i < node.body.length; i++) {
      result += this.writeIndent();
      result += this.printNode(node.body[i]!);
      this.addSemicolonIfNeeded(node.body[i]!);
      
      if (i < node.body.length - 1) {
        this.writeNewline();
      }
    }

    this.decreaseIndent();
    this.writeNewline();
    result += this.writeIndent();
    result += this.write('}');

    return result;
  }

  /**
   * Print expression statement
   */
  private printExpressionStatement(node: { expression: IRExpression }): string {
    return this.printNode(node.expression);
  }

  /**
   * Print variable declaration
   */
  private printVariableDeclaration(node: IRVariableDeclaration): string {
    const declarations = node.declarations.map(decl => {
      let result = this.printNode(decl.id);
      if (decl.init) {
        result += this.write(' = ');
        result += this.printNode(decl.init);
      }
      return result;
    });

    return this.write(`${node.kind} `) + declarations.join(this.write(', '));
  }

  /**
   * Print function declaration
   */
  private printFunctionDeclaration(node: IRFunctionDeclaration): string {
    let result = this.write(node.async ? 'async ' : '');
    result += this.write('function');
    if (node.generator) result += this.write('*');
    if (node.id) {
      result += this.write(' ');
      result += this.printNode(node.id);
    }
    
    result += this.write('(');
    result += node.params.map(param => this.printNode(param)).join(this.write(', '));
    result += this.write(') ');
    result += this.printNode(node.body);

    return result;
  }

  /**
   * Print return statement
   */
  private printReturnStatement(node: IRReturnStatement): string {
    let result = this.write('return');
    if (node.argument) {
      result += this.write(' ');
      result += this.printNode(node.argument);
    }
    return result;
  }

  /**
   * Print if statement
   */
  private printIfStatement(node: IRIfStatement): string {
    let result = this.write('if (');
    result += this.printNode(node.test);
    result += this.write(') ');
    result += this.printStatementWithBlock(node.consequent);

    if (node.alternate) {
      result += this.write(' else ');
      result += this.printStatementWithBlock(node.alternate);
    }

    return result;
  }

  /**
   * Print while statement
   */
  private printWhileStatement(node: IRWhileStatement): string {
    let result = this.write('while (');
    result += this.printNode(node.test);
    result += this.write(') ');
    result += this.printStatementWithBlock(node.body);
    return result;
  }

  /**
   * Print for statement
   */
  private printForStatement(node: IRForStatement): string {
    let result = this.write('for (');
    
    if (node.init) {
      if (node.init.type === 'VariableDeclaration') {
        // Don't add extra semicolon for variable declarations in for loops
        result += this.printVariableDeclaration(node.init);
      } else {
        result += this.printNode(node.init);
      }
    }
    result += this.write('; ');
    
    if (node.test) {
      result += this.printNode(node.test);
    }
    result += this.write('; ');
    
    if (node.update) {
      result += this.printNode(node.update);
    }
    result += this.write(') ');
    result += this.printStatementWithBlock(node.body);

    return result;
  }

  /**
   * Print identifier
   */
  private printIdentifier(node: IRIdentifier): string {
    return this.write(node.name);
  }

  /**
   * Print literal
   */
  private printLiteral(node: IRLiteral): string {
    if (node.raw) {
      return this.write(node.raw);
    }

    if (typeof node.value === 'string') {
      return this.write(`"${this.escapeString(node.value)}"`);
    } else if (typeof node.value === 'number') {
      return this.write(String(node.value));
    } else if (typeof node.value === 'boolean') {
      return this.write(String(node.value));
    } else if (node.value === null) {
      return this.write('null');
    } else if (node.value instanceof RegExp) {
      return this.write(node.value.toString());
    } else if (typeof node.value === 'bigint') {
      return this.write(`${node.value}n`);
    }

    return this.write(String(node.value));
  }

  /**
   * Print binary expression
   */
  private printBinaryExpression(node: IRBinaryExpression): string {
    const needsParens = this.needsParentheses(node.left) || this.needsParentheses(node.right);
    
    let result = '';
    if (needsParens && this.needsParentheses(node.left)) result += this.write('(');
    result += this.printNode(node.left);
    if (needsParens && this.needsParentheses(node.left)) result += this.write(')');
    
    result += this.write(` ${node.operator} `);
    
    if (needsParens && this.needsParentheses(node.right)) result += this.write('(');
    result += this.printNode(node.right);
    if (needsParens && this.needsParentheses(node.right)) result += this.write(')');
    
    return result;
  }

  /**
   * Print unary expression
   */
  private printUnaryExpression(node: IRUnaryExpression): string {
    if (node.prefix) {
      let result = this.write(node.operator);
      if (this.needsSpace(node.operator)) result += this.write(' ');
      
      if (this.needsParentheses(node.argument)) result += this.write('(');
      result += this.printNode(node.argument);
      if (this.needsParentheses(node.argument)) result += this.write(')');
      
      return result;
    } else {
      let result = '';
      if (this.needsParentheses(node.argument)) result += this.write('(');
      result += this.printNode(node.argument);
      if (this.needsParentheses(node.argument)) result += this.write(')');
      result += this.write(node.operator);
      return result;
    }
  }

  /**
   * Print update expression (++/--)
   */
  private printUpdateExpression(node: { operator: string; argument: IRExpression; prefix: boolean }): string {
    if (node.prefix) {
      return this.write(node.operator) + this.printNode(node.argument);
    } else {
      return this.printNode(node.argument) + this.write(node.operator);
    }
  }

  /**
   * Print assignment expression
   */
  private printAssignmentExpression(node: { operator: string; left: IRPattern; right: IRExpression }): string {
    return this.printNode(node.left as any) + 
           this.write(` ${node.operator} `) + 
           this.printNode(node.right);
  }

  /**
   * Print logical expression
   */
  private printLogicalExpression(node: { operator: string; left: IRExpression; right: IRExpression }): string {
    return this.printNode(node.left) + 
           this.write(` ${node.operator} `) + 
           this.printNode(node.right);
  }

  /**
   * Print conditional expression (ternary)
   */
  private printConditionalExpression(node: { test: IRExpression; consequent: IRExpression; alternate: IRExpression }): string {
    return this.printNode(node.test) + 
           this.write(' ? ') + 
           this.printNode(node.consequent) + 
           this.write(' : ') + 
           this.printNode(node.alternate);
  }

  /**
   * Print call expression
   */
  private printCallExpression(node: IRCallExpression): string {
    let result = this.printNode(node.callee);
    if (node.optional) result += this.write('?.');
    result += this.write('(');
    result += node.arguments.map(arg => this.printNode(arg)).join(this.write(', '));
    result += this.write(')');
    return result;
  }

  /**
   * Print new expression
   */
  private printNewExpression(node: { callee: IRExpression; arguments: readonly IRExpression[] }): string {
    let result = this.write('new ');
    result += this.printNode(node.callee);
    result += this.write('(');
    result += node.arguments.map(arg => this.printNode(arg)).join(this.write(', '));
    result += this.write(')');
    return result;
  }

  /**
   * Print member expression
   */
  private printMemberExpression(node: IRMemberExpression): string {
    let result = this.printNode(node.object);
    
    if (node.optional) result += this.write('?.');
    
    if (node.computed) {
      result += this.write('[');
      result += this.printNode(node.property);
      result += this.write(']');
    } else {
      if (!node.optional) result += this.write('.');
      result += this.printNode(node.property);
    }
    
    return result;
  }

  /**
   * Print array expression
   */
  private printArrayExpression(node: { elements: readonly (IRExpression | null)[] }): string {
    let result = this.write('[');
    
    const elements = node.elements.map(elem => 
      elem ? this.printNode(elem) : ''
    );
    
    result += elements.join(this.write(', '));
    result += this.write(']');
    return result;
  }

  /**
   * Print object expression
   */
  private printObjectExpression(node: { properties: readonly any[] }): string {
    if (node.properties.length === 0) {
      return this.write('{}');
    }

    let result = this.write('{');
    
    if (!this.context.options.minify) {
      this.increaseIndent();
      this.writeNewline();
    }

    const properties = node.properties.map((prop, index) => {
      let propResult = '';
      
      if (!this.context.options.minify) {
        propResult += this.writeIndent();
      }
      
      if (prop.type === 'Property') {
        if (prop.computed) {
          propResult += this.write('[');
          propResult += this.printNode(prop.key);
          propResult += this.write(']');
        } else {
          propResult += this.printNode(prop.key);
        }
        
        propResult += this.write(': ');
        propResult += this.printNode(prop.value);
      } else if (prop.type === 'SpreadElement') {
        propResult += this.write('...');
        propResult += this.printNode(prop.argument);
      }
      
      if (index < node.properties.length - 1) {
        propResult += this.write(',');
      }
      
      return propResult;
    });

    result += properties.join(this.context.options.minify ? '' : this.context.options.newline);

    if (!this.context.options.minify) {
      this.decreaseIndent();
      this.writeNewline();
      result += this.writeIndent();
    }
    
    result += this.write('}');
    return result;
  }

  /**
   * Print sequence expression
   */
  private printSequenceExpression(node: { expressions: readonly IRExpression[] }): string {
    return node.expressions.map(expr => this.printNode(expr)).join(this.write(', '));
  }

  /**
   * Print phi node (as comment)
   */
  private printPhiNode(node: IRPhiNode): string {
    const operands = Array.from(node.operands.entries())
      .map(([blockId, identifier]) => `${blockId}: ${this.printNode(identifier)}`)
      .join(', ');
    
    return `${node.variable}_${node.target_version} = φ(${operands})`;
  }

  /**
   * Print SSA identifier (remove version for normal output)
   */
  private printSSAIdentifier(node: IRSSAIdentifier): string {
    return this.write(node.original_name);
  }

  /**
   * Helper: Write text and update position
   */
  private write(text: string): string {
    this.context.currentColumn += text.length;
    return text;
  }

  /**
   * Helper: Write newline and update position
   */
  private writeNewline(): string {
    if (this.context.options.minify) return '';
    
    this.context.currentLine++;
    this.context.currentColumn = 0;
    return this.context.options.newline;
  }

  /**
   * Helper: Write current indentation
   */
  private writeIndent(): string {
    if (this.context.options.minify) return '';
    
    this.context.currentColumn += this.context.currentIndent.length;
    return this.context.currentIndent;
  }

  /**
   * Helper: Increase indentation
   */
  private increaseIndent(): void {
    this.context.currentIndent += this.context.options.indent;
  }

  /**
   * Helper: Decrease indentation
   */
  private decreaseIndent(): void {
    this.context.currentIndent = this.context.currentIndent.slice(0, -this.context.options.indent.length);
  }

  /**
   * Helper: Print statement with proper blocking
   */
  private printStatementWithBlock(stmt: IRStatement): string {
    if (stmt.type === 'BlockStatement') {
      return this.printNode(stmt);
    } else {
      // Wrap in block if not already a block
      return '{\n' + this.context.options.indent + this.printNode(stmt) + ';\n}';
    }
  }

  /**
   * Helper: Check if expression needs parentheses
   */
  private needsParentheses(node: IRExpression): boolean {
    // Simplified - could be made more sophisticated based on precedence
    return node.type === 'BinaryExpression' || 
           node.type === 'LogicalExpression' ||
           node.type === 'ConditionalExpression';
  }

  /**
   * Helper: Check if operator needs space
   */
  private needsSpace(operator: string): boolean {
    return operator === 'typeof' || operator === 'void' || operator === 'delete';
  }

  /**
   * Helper: Escape string for JavaScript output
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Helper: Add semicolon if needed
   */
  private addSemicolonIfNeeded(stmt: IRStatement): string {
    const needsSemi = stmt.type === 'ExpressionStatement' ||
                      stmt.type === 'VariableDeclaration' ||
                      stmt.type === 'ReturnStatement' ||
                      stmt.type === 'BreakStatement' ||
                      stmt.type === 'ContinueStatement' ||
                      stmt.type === 'ThrowStatement' ||
                      stmt.type === 'DebuggerStatement';
    
    return needsSemi ? this.write(';') : '';
  }
}

/**
 * Convenience function for quick printing
 */
export function printIR(node: IRNode, options?: Partial<PrinterOptions>): PrintResult {
  const printer = new IRPrinter(options);
  return printer.print(node);
}