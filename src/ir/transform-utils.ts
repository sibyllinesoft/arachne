/**
 * @fileoverview Common transformation utilities
 * 
 * This module provides reusable transformation patterns used across multiple
 * passes to reduce code duplication and improve consistency.
 */

import type {
  IRNode,
  IRExpression,
  IRStatement,
  IRIdentifier,
  IRBinaryExpression,
  IRUnaryExpression,
  IRCallExpression,
  IRLiteral,
  IRAssignmentExpression,
  IRPattern,
  VariableName,
  NodeId
} from './nodes.js';
import { IRNodeFactory, IRUtils } from './nodes.js';

/**
 * Common transformation patterns
 */
export class TransformUtils {
  /**
   * Replace an expression with a literal if it evaluates to a constant
   */
  static replaceWithLiteral(
    node: IRExpression,
    value: string | number | boolean | null | bigint,
    preserveLocation = true
  ): IRLiteral {
    return IRNodeFactory.literal(value, String(value), preserveLocation ? {
      node_id: node.node_id,
      loc: node.loc
    } : undefined);
  }

  /**
   * Check if two expressions are structurally equivalent
   */
  static areExpressionsEquivalent(left: IRExpression, right: IRExpression): boolean {
    if (left.type !== right.type) return false;

    switch (left.type) {
      case 'Literal':
        return left.value === (right as IRLiteral).value;
      
      case 'Identifier':
        return left.name === (right as IRIdentifier).name;
      
      case 'BinaryExpression':
        const rightBinary = right as IRBinaryExpression;
        return left.operator === rightBinary.operator &&
               TransformUtils.areExpressionsEquivalent(left.left, rightBinary.left) &&
               TransformUtils.areExpressionsEquivalent(left.right, rightBinary.right);
      
      case 'UnaryExpression':
        const rightUnary = right as IRUnaryExpression;
        return left.operator === rightUnary.operator &&
               left.prefix === rightUnary.prefix &&
               TransformUtils.areExpressionsEquivalent(left.argument, rightUnary.argument);
      
      default:
        // For more complex expressions, fall back to string comparison
        return JSON.stringify(left) === JSON.stringify(right);
    }
  }

  /**
   * Check if an expression is a simple constant
   */
  static isConstant(expr: IRExpression): boolean {
    return expr.type === 'Literal' && 
           !(expr.value instanceof RegExp) &&
           expr.value !== undefined;
  }

  /**
   * Get the constant value from a literal expression
   */
  static getConstantValue(expr: IRExpression): string | number | boolean | null | bigint | undefined {
    if (expr.type === 'Literal') {
      // Filter out RegExp values since they're not simple constants
      return expr.value instanceof RegExp ? undefined : expr.value;
    }
    return undefined;
  }

  /**
   * Check if an expression has side effects
   */
  static hasSideEffects(expr: IRExpression): boolean {
    switch (expr.type) {
      case 'Literal':
      case 'Identifier':
        return false;
      
      case 'BinaryExpression':
        return TransformUtils.hasSideEffects(expr.left) || 
               TransformUtils.hasSideEffects(expr.right);
      
      case 'UnaryExpression':
        // Some unary operators like delete have side effects
        if (expr.operator === 'delete') return true;
        return TransformUtils.hasSideEffects(expr.argument);
      
      case 'AssignmentExpression':
      case 'UpdateExpression':
      case 'CallExpression':
      case 'NewExpression':
        return true;
      
      case 'MemberExpression':
        // Property access can trigger getters
        return true;
      
      case 'ConditionalExpression':
        return TransformUtils.hasSideEffects(expr.test) ||
               TransformUtils.hasSideEffects(expr.consequent) ||
               TransformUtils.hasSideEffects(expr.alternate);
      
      case 'LogicalExpression':
        return TransformUtils.hasSideEffects(expr.left) ||
               TransformUtils.hasSideEffects(expr.right);
      
      case 'ArrayExpression':
        return expr.elements.some(elem => 
          elem && TransformUtils.hasSideEffects(elem)
        );
      
      case 'ObjectExpression':
        return expr.properties.some(prop =>
          prop.type === 'Property' && (
            (prop.computed && TransformUtils.hasSideEffects(prop.key)) ||
            TransformUtils.hasSideEffects(prop.value)
          )
        );
      
      default:
        // Conservative: assume unknown expressions have side effects
        return true;
    }
  }

  /**
   * Check if an expression is pure (no side effects and deterministic)
   */
  static isPure(expr: IRExpression): boolean {
    return !TransformUtils.hasSideEffects(expr);
  }

  /**
   * Simplify boolean expressions using logical rules
   */
  static simplifyBooleanExpression(expr: IRBinaryExpression): IRExpression {
    // true && x -> x
    if (expr.operator === '&&' && 
        TransformUtils.isConstant(expr.left) && 
        TransformUtils.getConstantValue(expr.left) === true) {
      return expr.right;
    }

    // false && x -> false
    if (expr.operator === '&&' && 
        TransformUtils.isConstant(expr.left) && 
        TransformUtils.getConstantValue(expr.left) === false) {
      return expr.left;
    }

    // x && true -> x
    if (expr.operator === '&&' && 
        TransformUtils.isConstant(expr.right) && 
        TransformUtils.getConstantValue(expr.right) === true) {
      return expr.left;
    }

    // x && false -> false
    if (expr.operator === '&&' && 
        TransformUtils.isConstant(expr.right) && 
        TransformUtils.getConstantValue(expr.right) === false) {
      return expr.right;
    }

    // false || x -> x
    if (expr.operator === '||' && 
        TransformUtils.isConstant(expr.left) && 
        TransformUtils.getConstantValue(expr.left) === false) {
      return expr.right;
    }

    // true || x -> true
    if (expr.operator === '||' && 
        TransformUtils.isConstant(expr.left) && 
        TransformUtils.getConstantValue(expr.left) === true) {
      return expr.left;
    }

    // x || false -> x
    if (expr.operator === '||' && 
        TransformUtils.isConstant(expr.right) && 
        TransformUtils.getConstantValue(expr.right) === false) {
      return expr.left;
    }

    // x || true -> true
    if (expr.operator === '||' && 
        TransformUtils.isConstant(expr.right) && 
        TransformUtils.getConstantValue(expr.right) === true) {
      return expr.right;
    }

    return expr;
  }

  /**
   * Simplify arithmetic expressions
   */
  static simplifyArithmeticExpression(expr: IRBinaryExpression): IRExpression {
    const left = TransformUtils.getConstantValue(expr.left);
    const right = TransformUtils.getConstantValue(expr.right);

    // x + 0 -> x
    if (expr.operator === '+' && right === 0) {
      return expr.left;
    }

    // 0 + x -> x
    if (expr.operator === '+' && left === 0) {
      return expr.right;
    }

    // x - 0 -> x
    if (expr.operator === '-' && right === 0) {
      return expr.left;
    }

    // x * 1 -> x
    if (expr.operator === '*' && right === 1) {
      return expr.left;
    }

    // 1 * x -> x
    if (expr.operator === '*' && left === 1) {
      return expr.right;
    }

    // x * 0 -> 0
    if (expr.operator === '*' && (left === 0 || right === 0)) {
      return IRNodeFactory.literal(0);
    }

    // x / 1 -> x
    if (expr.operator === '/' && right === 1) {
      return expr.left;
    }

    return expr;
  }

  /**
   * Remove unnecessary parentheses based on operator precedence
   */
  static removeUnnecessaryParentheses(expr: IRExpression): IRExpression {
    // This would require a more sophisticated precedence analysis
    // For now, just return the expression as-is
    return expr;
  }

  /**
   * Collect all variable names used in an expression
   */
  static collectUsedVariables(expr: IRExpression): Set<VariableName> {
    const variables = new Set<VariableName>();

    function collectFromPattern(pattern: IRPattern): void {
      const name = IRUtils.getPatternName(pattern);
      if (name) {
        variables.add(IRNodeFactory.createVariableName(name));
      }
      // Handle complex patterns like ArrayPattern, ObjectPattern if needed
    }

    function collect(node: IRExpression): void {
      switch (node.type) {
        case 'Identifier':
          variables.add(IRNodeFactory.createVariableName(node.name));
          break;
        
        case 'BinaryExpression':
          collect(node.left);
          collect(node.right);
          break;
        
        case 'UnaryExpression':
          collect(node.argument);
          break;
        
        case 'AssignmentExpression':
          collectFromPattern(node.left);
          collect(node.right);
          break;
        
        case 'UpdateExpression':
          collect(node.argument);
          break;
        
        case 'CallExpression':
          collect(node.callee);
          for (const arg of node.arguments) {
            collect(arg);
          }
          break;
        
        case 'MemberExpression':
          collect(node.object);
          if (node.computed) {
            collect(node.property);
          }
          break;
        
        case 'ConditionalExpression':
          collect(node.test);
          collect(node.consequent);
          collect(node.alternate);
          break;
        
        case 'ArrayExpression':
          for (const element of node.elements) {
            if (element) collect(element);
          }
          break;
        
        case 'ObjectExpression':
          for (const property of node.properties) {
            if (property.type === 'Property') {
              if (property.computed) collect(property.key);
              collect(property.value);
            }
          }
          break;
      }
    }

    collect(expr);
    return variables;
  }

  /**
   * Check if a variable is used in an expression
   */
  static isVariableUsed(expr: IRExpression, variableName: VariableName): boolean {
    const usedVars = TransformUtils.collectUsedVariables(expr);
    return usedVars.has(variableName);
  }

  /**
   * Replace all occurrences of a variable with an expression
   */
  static replaceVariable(
    expr: IRExpression, 
    oldName: VariableName, 
    replacement: IRExpression
  ): IRExpression {
    function replace(node: IRExpression): IRExpression {
      switch (node.type) {
        case 'Identifier':
          return IRNodeFactory.createVariableName(node.name) === oldName 
            ? replacement 
            : node;
        
        case 'BinaryExpression':
          const newLeft = replace(node.left);
          const newRight = replace(node.right);
          if (newLeft !== node.left || newRight !== node.right) {
            return { ...node, left: newLeft, right: newRight };
          }
          return node;
        
        case 'UnaryExpression':
          const newArgument = replace(node.argument);
          if (newArgument !== node.argument) {
            return { ...node, argument: newArgument };
          }
          return node;
        
        // Add more cases as needed
        default:
          return node;
      }
    }

    return replace(expr);
  }

  /**
   * Estimate the complexity of an expression (for optimization decisions)
   */
  static getComplexity(expr: IRExpression): number {
    switch (expr.type) {
      case 'Literal':
      case 'Identifier':
        return 1;
      
      case 'BinaryExpression':
        return 1 + TransformUtils.getComplexity(expr.left) + 
                   TransformUtils.getComplexity(expr.right);
      
      case 'UnaryExpression':
        return 1 + TransformUtils.getComplexity(expr.argument);
      
      case 'CallExpression':
        return 5 + TransformUtils.getComplexity(expr.callee) +
                   expr.arguments.reduce((sum, arg) => 
                     sum + TransformUtils.getComplexity(arg), 0);
      
      case 'MemberExpression':
        return 2 + TransformUtils.getComplexity(expr.object) +
                   (expr.computed ? TransformUtils.getComplexity(expr.property) : 0);
      
      case 'ConditionalExpression':
        return 3 + TransformUtils.getComplexity(expr.test) +
                   TransformUtils.getComplexity(expr.consequent) +
                   TransformUtils.getComplexity(expr.alternate);
      
      default:
        return 10; // Conservative estimate for unknown expressions
    }
  }

  /**
   * Check if inlining an expression would be beneficial
   */
  static shouldInline(expr: IRExpression, usageCount: number): boolean {
    const complexity = TransformUtils.getComplexity(expr);
    
    // Always inline constants and simple identifiers
    if (complexity <= 1) return true;
    
    // Inline simple expressions if used only once
    if (complexity <= 3 && usageCount === 1) return true;
    
    // Don't inline complex expressions used multiple times
    if (complexity > 5 && usageCount > 1) return false;
    
    // Middle ground: inline moderately complex expressions if used sparingly
    return complexity <= 5 && usageCount <= 2;
  }
}