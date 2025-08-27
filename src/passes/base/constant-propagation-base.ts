/**
 * @fileoverview Base class for constant propagation passes
 * 
 * This module provides common functionality shared between the basic and enhanced
 * constant propagation passes, reducing code duplication and improving maintainability.
 */

import { BasePass, PassUtils } from '../Pass.js';
import type { 
  IRNode, 
  IRExpression, 
  IRStatement, 
  IRIdentifier, 
  IRLiteral,
  IRBinaryExpression,
  IRUnaryExpression,
  IRVariableDeclaration,
  IRAssignmentExpression,
  NodeId,
  VariableName
} from '../../ir/nodes.js';
import { IRNodeFactory } from '../../ir/nodes.js';
import type { IRState } from '../Pass.js';

/**
 * Lattice value types for constant analysis
 */
export type LatticeValueType = 'top' | 'constant' | 'bottom';

/**
 * Base lattice value interface
 */
export interface BaseLatticeValue {
  type: LatticeValueType;
}

/**
 * Top value (unknown/non-constant)
 */
export interface TopValue extends BaseLatticeValue {
  type: 'top';
}

/**
 * Bottom value (unreachable)
 */
export interface BottomValue extends BaseLatticeValue {
  type: 'bottom';
}

/**
 * Constant value
 */
export interface ConstantValue extends BaseLatticeValue {
  type: 'constant';
  value: string | number | boolean | null | bigint;
  confidence: number;
}

/**
 * Union type for all lattice values
 */
export type LatticeValue = TopValue | BottomValue | ConstantValue;

/**
 * Configuration for constant propagation
 */
export interface ConstantPropagationConfig {
  confidenceThreshold?: number;
  enableArithmeticEvaluation?: boolean;
  enableStringConcatenation?: boolean;
  enableBooleanEvaluation?: boolean;
  maxIterations?: number;
}

/**
 * Statistics for constant propagation
 */
export interface ConstantPropagationStats {
  constantsFound: number;
  expressionsEvaluated: number;
  nodesReplaced: number;
  iterations: number;
}

/**
 * Base class for constant propagation passes
 */
export abstract class ConstantPropagationBase extends BasePass<IRState> {
  protected constantState: Map<VariableName, LatticeValue> = new Map();
  protected expressionCache: Map<NodeId, LatticeValue> = new Map();
  protected config: Required<ConstantPropagationConfig>;
  protected stats: ConstantPropagationStats;

  constructor(config: ConstantPropagationConfig = {}) {
    super();
    
    this.config = {
      confidenceThreshold: 0.9,
      enableArithmeticEvaluation: true,
      enableStringConcatenation: true,
      enableBooleanEvaluation: true,
      maxIterations: 100,
      ...config
    };

    this.stats = {
      constantsFound: 0,
      expressionsEvaluated: 0,
      nodesReplaced: 0,
      iterations: 0
    };
  }

  protected executePass(state: IRState): { state: IRState; changed: boolean } {
    this.resetState();

    // Perform dataflow analysis to find constants
    const constants = this.analyzeConstants(state);
    
    // Transform the IR with constant values
    const { newNodes, changed } = this.propagateConstants(state, constants);

    if (changed) {
      const newState = PassUtils.updateNodes(state, newNodes);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Reset internal state for new analysis
   */
  protected resetState(): void {
    this.constantState.clear();
    this.expressionCache.clear();
    this.stats = {
      constantsFound: 0,
      expressionsEvaluated: 0,
      nodesReplaced: 0,
      iterations: 0
    };
  }

  /**
   * Analyze constants using dataflow analysis (can be overridden by subclasses)
   */
  protected analyzeConstants(state: IRState): Map<NodeId, LatticeValue> {
    const constants = new Map<NodeId, LatticeValue>();
    
    // Simple forward dataflow analysis
    const worklist = Array.from(state.nodes.keys());
    const processedNodes = new Set<NodeId>();

    while (worklist.length > 0 && this.stats.iterations < this.config.maxIterations) {
      const nodeId = worklist.shift()!;
      if (processedNodes.has(nodeId)) continue;
      
      const node = state.nodes.get(nodeId);
      if (!node) continue;

      this.visitNode();
      processedNodes.add(nodeId);
      this.stats.iterations++;

      const value = this.evaluateNode(node, constants);
      if (value.type !== 'top') {
        constants.set(nodeId, value);
        this.expressionCache.set(nodeId, value);
        this.stats.constantsFound++;
      }

      // Add dependent nodes to worklist
      const dependents = this.findDependentNodes(state, nodeId);
      for (const dependent of dependents) {
        if (!processedNodes.has(dependent)) {
          worklist.push(dependent);
        }
      }
    }

    return constants;
  }

  /**
   * Evaluate a single node to determine if it's constant
   */
  protected evaluateNode(node: IRNode, constants: Map<NodeId, LatticeValue>): LatticeValue {
    this.stats.expressionsEvaluated++;

    switch (node.type) {
      case 'Literal':
        return this.evaluateLiteral(node);
      
      case 'Identifier':
        return this.evaluateIdentifier(node);
      
      case 'BinaryExpression':
        return this.evaluateBinaryExpression(node, constants);
      
      case 'UnaryExpression':
        return this.evaluateUnaryExpression(node, constants);
      
      case 'VariableDeclaration':
        this.evaluateVariableDeclaration(node, constants);
        return this.createTop();
      
      case 'AssignmentExpression':
        return this.evaluateAssignmentExpression(node, constants);
      
      default:
        return this.createTop(); // Unknown/complex expression
    }
  }

  /**
   * Evaluate literal node
   */
  protected evaluateLiteral(node: IRLiteral): LatticeValue {
    // Handle RegExp literals separately as they're not constant propagatable
    if (node.value instanceof RegExp) {
      return this.createTop();
    }
    
    return {
      type: 'constant',
      value: node.value,
      confidence: 1.0
    };
  }

  /**
   * Evaluate identifier node
   */
  protected evaluateIdentifier(node: IRIdentifier): LatticeValue {
    const varName = IRNodeFactory.createVariableName(node.name);
    return this.constantState.get(varName) || this.createTop();
  }

  /**
   * Evaluate binary expression
   */
  protected evaluateBinaryExpression(
    node: IRBinaryExpression,
    constants: Map<NodeId, LatticeValue>
  ): LatticeValue {
    const leftValue = this.getNodeValue(node.left, constants);
    const rightValue = this.getNodeValue(node.right, constants);

    if (leftValue.type !== 'constant' || rightValue.type !== 'constant') {
      return this.createTop();
    }

    try {
      const result = this.evaluateBinaryOperation(
        node.operator,
        leftValue.value,
        rightValue.value
      );
      
      return {
        type: 'constant',
        value: result,
        confidence: Math.min(leftValue.confidence, rightValue.confidence)
      };
    } catch {
      // Evaluation error (division by zero, etc.)
      return this.createTop();
    }
  }

  /**
   * Evaluate unary expression
   */
  protected evaluateUnaryExpression(
    node: IRUnaryExpression,
    constants: Map<NodeId, LatticeValue>
  ): LatticeValue {
    const argValue = this.getNodeValue(node.argument, constants);

    if (argValue.type !== 'constant') {
      return this.createTop();
    }

    try {
      const result = this.evaluateUnaryOperation(node.operator, argValue.value);
      
      return {
        type: 'constant',
        value: result,
        confidence: argValue.confidence
      };
    } catch {
      return this.createTop();
    }
  }

  /**
   * Evaluate variable declaration
   */
  protected evaluateVariableDeclaration(
    node: IRVariableDeclaration,
    constants: Map<NodeId, LatticeValue>
  ): void {
    for (const declarator of node.declarations) {
      if (declarator.id.type === 'Identifier') {
        const varName = IRNodeFactory.createVariableName(declarator.id.name);
        
        if (declarator.init) {
          const initValue = this.getNodeValue(declarator.init, constants);
          this.constantState.set(varName, initValue);
        } else {
          this.constantState.set(varName, this.createTop());
        }
      }
    }
  }

  /**
   * Evaluate assignment expression
   */
  protected evaluateAssignmentExpression(
    node: IRAssignmentExpression,
    constants: Map<NodeId, LatticeValue>
  ): LatticeValue {
    const rightValue = this.getNodeValue(node.right, constants);
    
    if (node.left.type === 'Identifier' && node.operator === '=') {
      const varName = IRNodeFactory.createVariableName(node.left.name);
      this.constantState.set(varName, rightValue);
    }
    
    return rightValue;
  }

  /**
   * Get lattice value for a node
   */
  protected getNodeValue(node: IRExpression, constants: Map<NodeId, LatticeValue>): LatticeValue {
    const nodeId = node.node_id;
    if (nodeId && constants.has(nodeId)) {
      return constants.get(nodeId)!;
    }
    
    // Evaluate node directly if not in cache
    return this.evaluateNode(node, constants);
  }

  /**
   * Perform binary operation on constants
   */
  protected evaluateBinaryOperation(
    operator: string,
    left: string | number | boolean | null | bigint,
    right: string | number | boolean | null | bigint
  ): string | number | boolean | null | bigint {
    switch (operator) {
      case '+':
        if (!this.config.enableArithmeticEvaluation && !this.config.enableStringConcatenation) {
          throw new Error('Operation disabled');
        }
        if (typeof left === 'string' || typeof right === 'string') {
          return this.config.enableStringConcatenation ? String(left) + String(right) : left;
        }
        return this.config.enableArithmeticEvaluation ? Number(left) + Number(right) : left;
      
      case '-':
        if (!this.config.enableArithmeticEvaluation) throw new Error('Operation disabled');
        return Number(left) - Number(right);
      
      case '*':
        if (!this.config.enableArithmeticEvaluation) throw new Error('Operation disabled');
        return Number(left) * Number(right);
      
      case '/':
        if (!this.config.enableArithmeticEvaluation) throw new Error('Operation disabled');
        const rightNum = Number(right);
        if (rightNum === 0) {
          throw new Error('Division by zero');
        }
        return Number(left) / rightNum;
      
      case '%':
        if (!this.config.enableArithmeticEvaluation) throw new Error('Operation disabled');
        return Number(left) % Number(right);
      
      case '**':
        if (!this.config.enableArithmeticEvaluation) throw new Error('Operation disabled');
        return Math.pow(Number(left), Number(right));
      
      case '==':
      case '!=':
      case '===':
      case '!==':
      case '<':
      case '<=':
      case '>':
      case '>=':
        if (!this.config.enableBooleanEvaluation) throw new Error('Operation disabled');
        return this.evaluateComparisonOperation(operator, left, right);
      
      case '<<':
      case '>>':
      case '>>>':
      case '&':
      case '|':
      case '^':
        if (!this.config.enableArithmeticEvaluation) throw new Error('Operation disabled');
        return this.evaluateBitwiseOperation(operator, left, right);
      
      case '&&':
      case '||':
      case '??':
        if (!this.config.enableBooleanEvaluation) throw new Error('Operation disabled');
        return this.evaluateLogicalOperation(operator, left, right);
      
      default:
        throw new Error(`Unknown binary operator: ${operator}`);
    }
  }

  /**
   * Evaluate comparison operations
   */
  protected evaluateComparisonOperation(
    operator: string,
    left: string | number | boolean | null | bigint,
    right: string | number | boolean | null | bigint
  ): boolean {
    switch (operator) {
      case '==': return left == right; // eslint-disable-line eqeqeq
      case '!=': return left != right; // eslint-disable-line eqeqeq
      case '===': return left === right;
      case '!==': return left !== right;
      case '<': return left < right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '>=': return left >= right;
      default: throw new Error(`Unknown comparison operator: ${operator}`);
    }
  }

  /**
   * Evaluate bitwise operations
   */
  protected evaluateBitwiseOperation(
    operator: string,
    left: string | number | boolean | null | bigint,
    right: string | number | boolean | null | bigint
  ): number {
    switch (operator) {
      case '<<': return Number(left) << Number(right);
      case '>>': return Number(left) >> Number(right);
      case '>>>': return Number(left) >>> Number(right);
      case '&': return Number(left) & Number(right);
      case '|': return Number(left) | Number(right);
      case '^': return Number(left) ^ Number(right);
      default: throw new Error(`Unknown bitwise operator: ${operator}`);
    }
  }

  /**
   * Evaluate logical operations
   */
  protected evaluateLogicalOperation(
    operator: string,
    left: string | number | boolean | null | bigint,
    right: string | number | boolean | null | bigint
  ): string | number | boolean | null | bigint {
    switch (operator) {
      case '&&': return left && right;
      case '||': return left || right;
      case '??': return left ?? right;
      default: throw new Error(`Unknown logical operator: ${operator}`);
    }
  }

  /**
   * Perform unary operation on constant
   */
  protected evaluateUnaryOperation(
    operator: string,
    operand: string | number | boolean | null | bigint
  ): string | number | boolean | null {
    switch (operator) {
      case '+': return Number(operand);
      case '-': return -Number(operand);
      case '!': return !operand;
      case '~': return ~Number(operand);
      case 'typeof': return typeof operand;
      case 'void': return undefined;
      default: throw new Error(`Unknown unary operator: ${operator}`);
    }
  }

  /**
   * Propagate constants in the IR
   */
  protected propagateConstants(
    state: IRState,
    constants: Map<NodeId, LatticeValue>
  ): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    const newNodes = new Map<NodeId, IRNode>();
    let changed = false;

    for (const [nodeId, node] of state.nodes) {
      const transformedNode = this.transformNode(node, constants);
      
      if (transformedNode !== node) {
        newNodes.set(nodeId, transformedNode);
        changed = true;
        this.stats.nodesReplaced++;
        this.changeNode();
      }
    }

    return { newNodes, changed };
  }

  /**
   * Transform a single node by replacing constants (can be overridden)
   */
  protected transformNode(node: IRNode, constants: Map<NodeId, LatticeValue>): IRNode {
    switch (node.type) {
      case 'Identifier':
        return this.transformIdentifier(node, constants);
      
      case 'BinaryExpression':
        return this.transformBinaryExpression(node, constants);
      
      case 'UnaryExpression':
        return this.transformUnaryExpression(node, constants);
      
      case 'VariableDeclaration':
        return this.transformVariableDeclaration(node, constants);
      
      case 'BlockStatement':
        return {
          ...node,
          body: node.body.map(stmt => this.transformNode(stmt, constants) as IRStatement)
        };
      
      default:
        return node;
    }
  }

  /**
   * Transform identifier to constant if possible
   */
  protected transformIdentifier(node: IRIdentifier, constants: Map<NodeId, LatticeValue>): IRNode {
    const nodeId = node.node_id;
    if (!nodeId) return node;

    const constantValue = constants.get(nodeId);
    if (constantValue?.type === 'constant' && constantValue.confidence >= this.config.confidenceThreshold) {
      return IRNodeFactory.literal(constantValue.value, undefined, {
        node_id: nodeId,
        loc: node.loc
      });
    }

    return node;
  }

  /**
   * Transform binary expression
   */
  protected transformBinaryExpression(
    node: IRBinaryExpression,
    constants: Map<NodeId, LatticeValue>
  ): IRNode {
    const nodeId = node.node_id;
    if (!nodeId) return node;

    const constantValue = constants.get(nodeId);
    if (constantValue?.type === 'constant' && constantValue.confidence >= this.config.confidenceThreshold) {
      return IRNodeFactory.literal(constantValue.value, undefined, {
        node_id: nodeId,
        loc: node.loc
      });
    }

    // Transform operands
    const left = this.transformNode(node.left, constants) as IRExpression;
    const right = this.transformNode(node.right, constants) as IRExpression;

    if (left !== node.left || right !== node.right) {
      return { ...node, left, right };
    }

    return node;
  }

  /**
   * Transform unary expression
   */
  protected transformUnaryExpression(
    node: IRUnaryExpression,
    constants: Map<NodeId, LatticeValue>
  ): IRNode {
    const nodeId = node.node_id;
    if (!nodeId) return node;

    const constantValue = constants.get(nodeId);
    if (constantValue?.type === 'constant' && constantValue.confidence >= this.config.confidenceThreshold) {
      return IRNodeFactory.literal(constantValue.value, undefined, {
        node_id: nodeId,
        loc: node.loc
      });
    }

    // Transform operand
    const argument = this.transformNode(node.argument, constants) as IRExpression;

    if (argument !== node.argument) {
      return { ...node, argument };
    }

    return node;
  }

  /**
   * Transform variable declaration
   */
  protected transformVariableDeclaration(
    node: IRVariableDeclaration,
    constants: Map<NodeId, LatticeValue>
  ): IRNode {
    const newDeclarations = node.declarations.map(decl => ({
      ...decl,
      init: decl.init ? this.transformNode(decl.init, constants) as IRExpression : null
    }));

    const changed = newDeclarations.some((decl, index) => 
      decl.init !== node.declarations[index]!.init
    );

    if (changed) {
      return { ...node, declarations: newDeclarations };
    }

    return node;
  }

  /**
   * Find nodes that depend on a given node
   */
  protected findDependentNodes(state: IRState, nodeId: NodeId): NodeId[] {
    const dependents: NodeId[] = [];
    
    // Simple implementation - in reality would use use-def chains
    for (const [otherNodeId, node] of state.nodes) {
      if (otherNodeId !== nodeId && this.nodeReferences(node, nodeId)) {
        dependents.push(otherNodeId);
      }
    }
    
    return dependents;
  }

  /**
   * Check if a node references another node
   */
  protected nodeReferences(node: IRNode, targetId: NodeId): boolean {
    // Simplified implementation - would need proper visitor pattern
    const nodeStr = JSON.stringify(node);
    return nodeStr.includes(targetId);
  }

  /**
   * Create top lattice value
   */
  protected createTop(): TopValue {
    return { type: 'top' };
  }

  /**
   * Create bottom lattice value
   */
  protected createBottom(): BottomValue {
    return { type: 'bottom' };
  }

  /**
   * Create constant lattice value
   */
  protected createConstant(
    value: string | number | boolean | null | bigint, 
    confidence: number = 1.0
  ): ConstantValue {
    return { type: 'constant', value, confidence };
  }

  /**
   * Get analysis statistics
   */
  public getStats(): ConstantPropagationStats {
    return { ...this.stats };
  }
}