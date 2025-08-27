/**
 * @fileoverview AST Visitor Pattern utilities
 * 
 * This module provides a comprehensive visitor pattern implementation for IR nodes,
 * reducing code duplication across analysis passes and transformations.
 */

import type {
  IRNode,
  IRExpression,
  IRStatement,
  IRPattern,
  IRArrayExpression,
  IRBinaryExpression,
  IRBlockStatement,
  IRCallExpression,
  IRConditionalExpression,
  IRExpressionStatement,
  IRForStatement,
  IRFunctionDeclaration,
  IRIdentifier,
  IRIfStatement,
  IRLiteral,
  IRMemberExpression,
  IRObjectExpression,
  IRProgram,
  IRReturnStatement,
  IRUnaryExpression,
  IRUpdateExpression,
  IRVariableDeclaration,
  IRWhileStatement,
  IRAssignmentExpression,
  IRProperty,
  IRArrayPattern,
  IRObjectPattern,
  IRRestElement,
  IRSpreadElement
} from './nodes.js';

/**
 * Visitor interface for traversing IR nodes
 */
export interface IRVisitor<T = void> {
  // Program and Statements
  visitProgram?(node: IRProgram, context?: any): T;
  visitBlockStatement?(node: IRBlockStatement, context?: any): T;
  visitExpressionStatement?(node: IRExpressionStatement, context?: any): T;
  visitVariableDeclaration?(node: IRVariableDeclaration, context?: any): T;
  visitFunctionDeclaration?(node: IRFunctionDeclaration, context?: any): T;
  visitReturnStatement?(node: IRReturnStatement, context?: any): T;
  visitIfStatement?(node: IRIfStatement, context?: any): T;
  visitWhileStatement?(node: IRWhileStatement, context?: any): T;
  visitForStatement?(node: IRForStatement, context?: any): T;

  // Expressions
  visitIdentifier?(node: IRIdentifier, context?: any): T;
  visitLiteral?(node: IRLiteral, context?: any): T;
  visitBinaryExpression?(node: IRBinaryExpression, context?: any): T;
  visitUnaryExpression?(node: IRUnaryExpression, context?: any): T;
  visitAssignmentExpression?(node: IRAssignmentExpression, context?: any): T;
  visitUpdateExpression?(node: IRUpdateExpression, context?: any): T;
  visitCallExpression?(node: IRCallExpression, context?: any): T;
  visitMemberExpression?(node: IRMemberExpression, context?: any): T;
  visitConditionalExpression?(node: IRConditionalExpression, context?: any): T;
  visitArrayExpression?(node: IRArrayExpression, context?: any): T;
  visitObjectExpression?(node: IRObjectExpression, context?: any): T;

  // Patterns
  visitArrayPattern?(node: IRArrayPattern, context?: any): T;
  visitObjectPattern?(node: IRObjectPattern, context?: any): T;
  visitProperty?(node: IRProperty, context?: any): T;
  visitRestElement?(node: IRRestElement, context?: any): T;
  visitSpreadElement?(node: IRSpreadElement, context?: any): T;

  // Generic fallback
  visitNode?(node: IRNode, context?: any): T;
}

/**
 * Base traversal visitor that calls appropriate visit methods
 */
export class BaseVisitor<T = void> implements IRVisitor<T> {
  /**
   * Default implementation for visitNode - can be overridden by subclasses
   */
  visitNode(node: IRNode, context?: any): T {
    // Default behavior is to visit children
    this.visitChildren(node, context);
    return undefined as any;
  }
  /**
   * Visit a node and dispatch to appropriate method
   */
  visit(node: IRNode | null | undefined, context?: any): T | undefined {
    if (!node) return undefined;

    const methodName = `visit${node.type}` as keyof this;
    const method = this[methodName] as any;

    if (typeof method === 'function') {
      return method.call(this, node, context);
    }

    return this.visitNode?.(node, context);
  }

  /**
   * Visit all children of a node
   */
  visitChildren(node: IRNode, context?: any): T[] {
    const results: T[] = [];

    switch (node.type) {
      case 'Program':
        for (const stmt of node.body) {
          const result = this.visit(stmt, context);
          if (result !== undefined) results.push(result);
        }
        break;

      case 'BlockStatement':
        for (const stmt of node.body) {
          const result = this.visit(stmt, context);
          if (result !== undefined) results.push(result);
        }
        break;

      case 'ExpressionStatement':
        const exprResult = this.visit(node.expression, context);
        if (exprResult !== undefined) results.push(exprResult);
        break;

      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          const idResult = this.visit(declarator.id, context);
          if (idResult !== undefined) results.push(idResult);
          
          if (declarator.init) {
            const initResult = this.visit(declarator.init, context);
            if (initResult !== undefined) results.push(initResult);
          }
        }
        break;

      case 'FunctionDeclaration':
        if (node.id) {
          const idResult = this.visit(node.id, context);
          if (idResult !== undefined) results.push(idResult);
        }
        
        for (const param of node.params) {
          const paramResult = this.visit(param, context);
          if (paramResult !== undefined) results.push(paramResult);
        }
        
        const bodyResult = this.visit(node.body, context);
        if (bodyResult !== undefined) results.push(bodyResult);
        break;

      case 'ReturnStatement':
        if (node.argument) {
          const argResult = this.visit(node.argument, context);
          if (argResult !== undefined) results.push(argResult);
        }
        break;

      case 'IfStatement':
        const testResult = this.visit(node.test, context);
        if (testResult !== undefined) results.push(testResult);
        
        const consequentResult = this.visit(node.consequent, context);
        if (consequentResult !== undefined) results.push(consequentResult);
        
        if (node.alternate) {
          const alternateResult = this.visit(node.alternate, context);
          if (alternateResult !== undefined) results.push(alternateResult);
        }
        break;

      case 'WhileStatement':
        const whileTestResult = this.visit(node.test, context);
        if (whileTestResult !== undefined) results.push(whileTestResult);
        
        const whileBodyResult = this.visit(node.body, context);
        if (whileBodyResult !== undefined) results.push(whileBodyResult);
        break;

      case 'ForStatement':
        if (node.init) {
          const initResult = this.visit(node.init, context);
          if (initResult !== undefined) results.push(initResult);
        }
        
        if (node.test) {
          const forTestResult = this.visit(node.test, context);
          if (forTestResult !== undefined) results.push(forTestResult);
        }
        
        if (node.update) {
          const updateResult = this.visit(node.update, context);
          if (updateResult !== undefined) results.push(updateResult);
        }
        
        const forBodyResult = this.visit(node.body, context);
        if (forBodyResult !== undefined) results.push(forBodyResult);
        break;

      case 'BinaryExpression':
        const leftResult = this.visit(node.left, context);
        if (leftResult !== undefined) results.push(leftResult);
        
        const rightResult = this.visit(node.right, context);
        if (rightResult !== undefined) results.push(rightResult);
        break;

      case 'UnaryExpression':
        const argumentResult = this.visit(node.argument, context);
        if (argumentResult !== undefined) results.push(argumentResult);
        break;

      case 'AssignmentExpression':
        const assignLeftResult = this.visit(node.left, context);
        if (assignLeftResult !== undefined) results.push(assignLeftResult);
        
        const assignRightResult = this.visit(node.right, context);
        if (assignRightResult !== undefined) results.push(assignRightResult);
        break;

      case 'UpdateExpression':
        const updateArgResult = this.visit(node.argument, context);
        if (updateArgResult !== undefined) results.push(updateArgResult);
        break;

      case 'CallExpression':
        const calleeResult = this.visit(node.callee, context);
        if (calleeResult !== undefined) results.push(calleeResult);
        
        for (const arg of node.arguments) {
          const argResult = this.visit(arg, context);
          if (argResult !== undefined) results.push(argResult);
        }
        break;

      case 'MemberExpression':
        const objectResult = this.visit(node.object, context);
        if (objectResult !== undefined) results.push(objectResult);
        
        if (node.computed) {
          const propertyResult = this.visit(node.property, context);
          if (propertyResult !== undefined) results.push(propertyResult);
        }
        break;

      case 'ConditionalExpression':
        const condTestResult = this.visit(node.test, context);
        if (condTestResult !== undefined) results.push(condTestResult);
        
        const condConsequentResult = this.visit(node.consequent, context);
        if (condConsequentResult !== undefined) results.push(condConsequentResult);
        
        const condAlternateResult = this.visit(node.alternate, context);
        if (condAlternateResult !== undefined) results.push(condAlternateResult);
        break;

      case 'ArrayExpression':
        for (const element of node.elements) {
          if (element) {
            const elementResult = this.visit(element, context);
            if (elementResult !== undefined) results.push(elementResult);
          }
        }
        break;

      case 'ObjectExpression':
        for (const property of node.properties) {
          const propResult = this.visit(property, context);
          if (propResult !== undefined) results.push(propResult);
        }
        break;

      case 'Property':
        const keyResult = this.visit(node.key, context);
        if (keyResult !== undefined) results.push(keyResult);
        
        const valueResult = this.visit(node.value, context);
        if (valueResult !== undefined) results.push(valueResult);
        break;

      case 'ArrayPattern':
        for (const element of node.elements) {
          if (element) {
            const elemResult = this.visit(element, context);
            if (elemResult !== undefined) results.push(elemResult);
          }
        }
        break;

      case 'ObjectPattern':
        for (const property of node.properties) {
          const objPropResult = this.visit(property, context);
          if (objPropResult !== undefined) results.push(objPropResult);
        }
        break;

      case 'RestElement':
        const restArgResult = this.visit(node.argument, context);
        if (restArgResult !== undefined) results.push(restArgResult);
        break;

      case 'SpreadElement':
        const spreadArgResult = this.visit(node.argument, context);
        if (spreadArgResult !== undefined) results.push(spreadArgResult);
        break;
    }

    return results;
  }
}

/**
 * Transformer visitor that can modify the AST
 */
export class TransformerVisitor extends BaseVisitor<IRNode> {
  /**
   * Transform a node, returning the same node or a replacement
   */
  transform(node: IRNode, context?: any): IRNode {
    const result = this.visit(node, context);
    return result || node;
  }

  /**
   * Transform children and update the node if any changed
   */
  transformChildren(node: IRNode, context?: any): IRNode {
    let changed = false;
    const newNode = { ...node } as any;

    switch (node.type) {
      case 'Program':
        const newBody = node.body.map(stmt => {
          const transformed = this.transform(stmt, context);
          if (transformed !== stmt) changed = true;
          return transformed as IRStatement;
        });
        if (changed) newNode.body = newBody;
        break;

      case 'BlockStatement':
        const newBlockBody = node.body.map(stmt => {
          const transformed = this.transform(stmt, context);
          if (transformed !== stmt) changed = true;
          return transformed as IRStatement;
        });
        if (changed) newNode.body = newBlockBody;
        break;

      case 'BinaryExpression':
        const newLeft = this.transform(node.left, context);
        const newRight = this.transform(node.right, context);
        if (newLeft !== node.left || newRight !== node.right) {
          changed = true;
          newNode.left = newLeft as IRExpression;
          newNode.right = newRight as IRExpression;
        }
        break;

      case 'CallExpression':
        const newCallee = this.transform(node.callee, context);
        const newArgs = node.arguments.map(arg => this.transform(arg, context));
        const argsChanged = newArgs.some((arg, i) => arg !== node.arguments[i]);
        
        if (newCallee !== node.callee || argsChanged) {
          changed = true;
          newNode.callee = newCallee as IRExpression;
          newNode.arguments = newArgs as IRExpression[];
        }
        break;

      // Add more cases as needed for specific transformation needs
    }

    return changed ? newNode : node;
  }
}

/**
 * Collector visitor that gathers information from the AST
 */
export class CollectorVisitor<T> extends BaseVisitor<void> {
  protected collected: T[] = [];

  /**
   * Get all collected items
   */
  getCollected(): T[] {
    return [...this.collected];
  }

  /**
   * Clear collected items
   */
  clear(): void {
    this.collected = [];
  }

  /**
   * Add an item to the collection
   */
  protected collect(item: T): void {
    this.collected.push(item);
  }
}

/**
 * Utility functions for common visitor patterns
 */
export class VisitorUtils {
  /**
   * Collect all nodes of a specific type
   */
  static collectNodesByType<T extends IRNode>(
    root: IRNode,
    nodeType: T['type']
  ): T[] {
    const collector = new (class extends CollectorVisitor<T> {
      override visitNode(node: IRNode) {
        if (node.type === nodeType) {
          this.collect(node as T);
        }
        this.visitChildren(node);
      }
    })();

    collector.visit(root);
    return collector.getCollected();
  }

  /**
   * Collect all identifiers with their names
   */
  static collectIdentifiers(root: IRNode): IRIdentifier[] {
    return VisitorUtils.collectNodesByType<IRIdentifier>(root, 'Identifier');
  }

  /**
   * Collect all function declarations
   */
  static collectFunctions(root: IRNode): IRFunctionDeclaration[] {
    return VisitorUtils.collectNodesByType<IRFunctionDeclaration>(root, 'FunctionDeclaration');
  }

  /**
   * Collect all variable declarations
   */
  static collectVariableDeclarations(root: IRNode): IRVariableDeclaration[] {
    return VisitorUtils.collectNodesByType<IRVariableDeclaration>(root, 'VariableDeclaration');
  }

  /**
   * Check if a node contains any child of a specific type
   */
  static containsNodeType(root: IRNode, nodeType: string): boolean {
    let found = false;
    
    const visitor = new (class extends BaseVisitor<void> {
      override visitNode(node: IRNode) {
        if (node.type === nodeType) {
          found = true;
          return;
        }
        if (!found) {
          this.visitChildren(node);
        }
      }
    })();

    visitor.visit(root);
    return found;
  }

  /**
   * Count nodes of a specific type
   */
  static countNodesByType(root: IRNode, nodeType: string): number {
    let count = 0;
    
    const visitor = new (class extends BaseVisitor<void> {
      override visitNode(node: IRNode) {
        if (node.type === nodeType) {
          count++;
        }
        this.visitChildren(node);
      }
    })();

    visitor.visit(root);
    return count;
  }
}