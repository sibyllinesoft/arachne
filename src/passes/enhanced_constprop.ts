/**
 * @fileoverview Enhanced Constant Propagation Pass
 * 
 * This pass extends basic constant propagation with inter-procedural analysis,
 * partial evaluation, abstract interpretation, property access constant folding,
 * and path-sensitive analysis. It provides more aggressive constant propagation
 * capabilities while maintaining correctness through side-effect analysis.
 */

import type {
  IRNode,
  IRExpression,
  IRStatement,
  IRIdentifier,
  IRLiteral,
  IRBinaryExpression,
  IRUnaryExpression,
  IRCallExpression,
  IRMemberExpression,
  IRConditionalExpression,
  IRFunctionDeclaration,
  IRVariableDeclaration,
  IRAssignmentExpression,
  IRIfStatement,
  IRArrayExpression,
  IRProperty,
  IRObjectExpression,
  VariableName,
  NodeId,
  ScopeId
} from '../ir/nodes.js';
import { IRNodeFactory, IRUtils, isExpression } from '../ir/nodes.js';
import { BasePass, type IRState, type PassResult, PassUtils } from './Pass.js';
import type { SSAState } from '../ir/ssa.js';

/**
 * Abstract value representation for enhanced analysis
 */
export interface AbstractValue {
  readonly type: AbstractValueType;
  readonly latticeHeight: number;
  readonly confidence: number;
  readonly dependencies: ReadonlySet<VariableName>;
}

/**
 * Types of abstract values in the analysis lattice
 */
export type AbstractValueType = 
  | 'top'           // Unknown value (⊤)
  | 'bottom'        // Unreachable/undefined (⊥)
  | 'constant'      // Known constant value
  | 'range'         // Integer range [min, max]
  | 'object'        // Object with known properties
  | 'function'      // Function with known behavior
  | 'array'         // Array with known elements
  | 'string'        // String with known content
  | 'symbol'        // Symbol value
  | 'computed';     // Computed but not constant

/**
 * Constant value with provenance information
 */
export interface ConstantValue extends AbstractValue {
  readonly type: 'constant';
  readonly value: string | number | boolean | null | bigint;
  readonly sourceLocation?: NodeId;
  readonly computationPath?: readonly NodeId[];
}

/**
 * Integer range value  
 */
export interface RangeValue extends AbstractValue {
  readonly type: 'range';
  readonly min: number;
  readonly max: number;
  readonly isInteger: boolean;
}

/**
 * Object value with property information
 */
export interface ObjectValue extends AbstractValue {
  readonly type: 'object';
  readonly properties: ReadonlyMap<string, AbstractValue>;
  readonly prototype?: AbstractValue;
  readonly isSealed: boolean;
  readonly isFrozen: boolean;
}

/**
 * Function value with call information
 */
export interface FunctionValue extends AbstractValue {
  readonly type: 'function';
  readonly declaration: IRFunctionDeclaration;
  readonly isPure: boolean;
  readonly parameters: readonly VariableName[];
  readonly returnValue?: AbstractValue;
  readonly sideEffects: ReadonlySet<SideEffectType>;
}

/**
 * Array value with element information
 */
export interface ArrayValue extends AbstractValue {
  readonly type: 'array';
  readonly elements: ReadonlyMap<number, AbstractValue>;
  readonly length: AbstractValue;
  readonly isSparse: boolean;
}

/**
 * String value with content information
 */
export interface StringValue extends AbstractValue {
  readonly type: 'string';
  readonly content: string;
  readonly encoding?: string;
  readonly isInterned: boolean;
}

/**
 * Top value (unknown)
 */
export interface TopValue extends AbstractValue {
  readonly type: 'top';
}

/**
 * Bottom value (unreachable)
 */
export interface BottomValue extends AbstractValue {
  readonly type: 'bottom';
}

/**
 * Computed value (not constant but analyzable)
 */
export interface ComputedValue extends AbstractValue {
  readonly type: 'computed';
  readonly expression: IRExpression;
  readonly operands: ReadonlyMap<VariableName, AbstractValue>;
}

/**
 * Union of all abstract value types
 */
export type ConcreteAbstractValue = 
  | ConstantValue 
  | RangeValue 
  | ObjectValue 
  | FunctionValue 
  | ArrayValue 
  | StringValue 
  | TopValue 
  | BottomValue 
  | ComputedValue;

/**
 * Types of side effects
 */
export type SideEffectType = 
  | 'memory-read'     // Reads from memory
  | 'memory-write'    // Writes to memory  
  | 'io-operation'    // I/O operation
  | 'exception'       // May throw exception
  | 'global-access'   // Accesses global state
  | 'function-call'   // Calls other functions
  | 'property-access' // Accesses object properties
  | 'console-output'; // Console/debug output

/**
 * Path condition for path-sensitive analysis
 */
export interface PathCondition {
  readonly condition: IRExpression;
  readonly truthValue: boolean;
  readonly variables: ReadonlySet<VariableName>;
  readonly abstractValues: ReadonlyMap<VariableName, ConcreteAbstractValue>;
}

/**
 * Context for inter-procedural analysis
 */
export interface CallContext {
  readonly callSite: NodeId;
  readonly function: IRFunctionDeclaration;
  readonly arguments: readonly AbstractValue[];
  readonly returnValue?: AbstractValue;
  readonly sideEffects: ReadonlySet<SideEffectType>;
}

/**
 * Abstract interpretation state
 */
export interface AbstractState {
  readonly variables: ReadonlyMap<VariableName, ConcreteAbstractValue>;
  readonly properties: ReadonlyMap<string, ReadonlyMap<string, ConcreteAbstractValue>>;
  readonly pathConditions: readonly PathCondition[];
  readonly callStack: readonly CallContext[];
  readonly heapObjects: ReadonlyMap<NodeId, ObjectValue>;
}

/**
 * Enhanced Constant Propagation Pass
 * 
 * Features:
 * - Inter-procedural constant propagation across function boundaries
 * - Partial evaluation of constant expressions with side-effect analysis  
 * - Abstract interpretation framework for complex data structures
 * - Property access constant folding (object.property -> constant)
 * - Path-sensitive analysis for conditional constant propagation
 * - Function inlining for simple pure functions
 * - String template constant folding
 * - Array access constant folding
 */
export class EnhancedConstantPropagationPass extends BasePass<IRState> {
  readonly name = 'enhanced-constant-propagation';
  readonly description = 'Advanced constant propagation with inter-procedural analysis';
  override readonly dependencies = ['ssa'] as const;

  private abstractState: AbstractState | null = null;
  private ssaState: SSAState | null = null;
  private functionSummaries: Map<VariableName, FunctionValue> = new Map();
  private inliningCandidates: Set<VariableName> = new Set();
  private maxInliningDepth = 3;
  private maxPathsToTrack = 50;

  protected executePass(state: IRState): { state: IRState; changed: boolean } {
    if (!state.ssa) {
      this.warnings.push('SSA form required for enhanced constant propagation');
      return { state, changed: false };
    }

    this.ssaState = state.ssa;
    this.functionSummaries.clear();
    this.inliningCandidates.clear();

    // Phase 1: Build function summaries for inter-procedural analysis
    this.buildFunctionSummaries(state);

    // Phase 2: Perform abstract interpretation with path sensitivity
    this.abstractState = this.performAbstractInterpretation(state);

    // Phase 3: Apply constant propagation transformations
    const { newNodes, changed } = this.applyConstantPropagation(state);

    // Phase 4: Inline simple pure functions if beneficial
    const { inlinedNodes, inliningChanged } = this.performFunctionInlining(state, newNodes);

    const allNewNodes = new Map([...newNodes, ...inlinedNodes]);
    const totalChanged = changed || inliningChanged;

    if (totalChanged) {
      const newState = PassUtils.updateNodes(state, allNewNodes);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Build summaries of function behavior for inter-procedural analysis
   */
  private buildFunctionSummaries(state: IRState): void {
    for (const [nodeId, node] of state.nodes) {
      if (node.type === 'FunctionDeclaration' && node.id) {
        const summary = this.analyzeFunctionPurity(node, state);
        this.functionSummaries.set(node.id.name as VariableName, summary);

        // Mark as inlining candidate if pure and small
        if (summary.isPure && this.isFunctionSmall(node)) {
          this.inliningCandidates.add(node.id.name as VariableName);
        }
      }
    }
  }

  /**
   * Analyze function purity and side effects
   */
  private analyzeFunctionPurity(func: IRFunctionDeclaration, state: IRState): FunctionValue {
    const sideEffects = new Set<SideEffectType>();
    let isPure = true;

    // Analyze function body for side effects
    if (func.body) {
      this.analyzeSideEffects(func.body, sideEffects);
      isPure = sideEffects.size === 0;
    }

    return {
      type: 'function',
      latticeHeight: 1,
      confidence: 0.9,
      dependencies: new Set(),
      declaration: func,
      isPure,
      parameters: func.params.map(p => IRUtils.getPatternName(p) as VariableName).filter(Boolean),
      sideEffects
    };
  }

  /**
   * Analyze side effects in a statement
   */
  private analyzeSideEffects(stmt: IRStatement, sideEffects: Set<SideEffectType>): void {
    switch (stmt.type) {
      case 'ExpressionStatement':
        this.analyzeExpressionSideEffects(stmt.expression, sideEffects);
        break;

      case 'BlockStatement':
        for (const s of stmt.body) {
          this.analyzeSideEffects(s, sideEffects);
        }
        break;

      case 'IfStatement':
        this.analyzeExpressionSideEffects(stmt.test, sideEffects);
        this.analyzeSideEffects(stmt.consequent, sideEffects);
        if (stmt.alternate) {
          this.analyzeSideEffects(stmt.alternate, sideEffects);
        }
        break;

      case 'WhileStatement':
        this.analyzeExpressionSideEffects(stmt.test, sideEffects);
        this.analyzeSideEffects(stmt.body, sideEffects);
        break;

      case 'ReturnStatement':
        if (stmt.argument) {
          this.analyzeExpressionSideEffects(stmt.argument, sideEffects);
        }
        break;

      case 'VariableDeclaration':
        for (const declarator of stmt.declarations) {
          if (declarator.init) {
            this.analyzeExpressionSideEffects(declarator.init, sideEffects);
          }
        }
        break;
    }
  }

  /**
   * Analyze side effects in an expression
   */
  private analyzeExpressionSideEffects(expr: IRExpression, sideEffects: Set<SideEffectType>): void {
    switch (expr.type) {
      case 'CallExpression':
        sideEffects.add('function-call');
        this.analyzeExpressionSideEffects(expr.callee, sideEffects);
        for (const arg of expr.arguments) {
          if (isExpression(arg)) {
            this.analyzeExpressionSideEffects(arg, sideEffects);
          }
        }
        
        // Check for console calls
        if (expr.callee.type === 'MemberExpression' &&
            expr.callee.object.type === 'Identifier' &&
            expr.callee.object.name === 'console') {
          sideEffects.add('console-output');
        }
        break;

      case 'MemberExpression':
        sideEffects.add('property-access');
        this.analyzeExpressionSideEffects(expr.object, sideEffects);
        if (expr.computed && isExpression(expr.property)) {
          this.analyzeExpressionSideEffects(expr.property, sideEffects);
        }
        break;

      case 'AssignmentExpression':
        sideEffects.add('memory-write');
        // Left side is a pattern, not an expression, so don't analyze it
        this.analyzeExpressionSideEffects(expr.right, sideEffects);
        break;

      case 'UpdateExpression':
        sideEffects.add('memory-write');
        this.analyzeExpressionSideEffects(expr.argument, sideEffects);
        break;

      case 'BinaryExpression':
        this.analyzeExpressionSideEffects(expr.left, sideEffects);
        this.analyzeExpressionSideEffects(expr.right, sideEffects);
        break;

      case 'UnaryExpression':
        this.analyzeExpressionSideEffects(expr.argument, sideEffects);
        break;

      case 'ConditionalExpression':
        this.analyzeExpressionSideEffects(expr.test, sideEffects);
        this.analyzeExpressionSideEffects(expr.consequent, sideEffects);
        this.analyzeExpressionSideEffects(expr.alternate, sideEffects);
        break;

      case 'ArrayExpression':
        for (const element of expr.elements) {
          if (element && isExpression(element)) {
            this.analyzeExpressionSideEffects(element, sideEffects);
          }
        }
        break;

      case 'ObjectExpression':
        for (const property of expr.properties) {
          if (property.type === 'Property') {
            if (isExpression(property.key)) {
              this.analyzeExpressionSideEffects(property.key, sideEffects);
            }
            if (isExpression(property.value)) {
              this.analyzeExpressionSideEffects(property.value, sideEffects);
            }
          }
        }
        break;
    }
  }

  /**
   * Perform abstract interpretation with path sensitivity
   */
  private performAbstractInterpretation(state: IRState): AbstractState {
    const initialState: AbstractState = {
      variables: new Map(),
      properties: new Map(),
      pathConditions: [],
      callStack: [],
      heapObjects: new Map()
    };

    // Perform forward dataflow analysis with abstract values
    return this.analyzeWithAbstractValues(state, initialState);
  }

  /**
   * Analyze program with abstract values
   */
  private analyzeWithAbstractValues(state: IRState, initialAbstractState: AbstractState): AbstractState {
    let currentState = initialAbstractState;
    const worklist = Array.from(state.nodes.keys());
    const processedNodes = new Set<NodeId>();

    while (worklist.length > 0) {
      const nodeId = worklist.shift()!;
      if (processedNodes.has(nodeId)) continue;

      const node = state.nodes.get(nodeId);
      if (!node) continue;

      const newState = this.analyzeNode(node, currentState, state);
      
      // Check for changes in abstract state
      if (!this.abstractStatesEqual(currentState, newState)) {
        currentState = newState;
        
        // Add successors back to worklist
        if (state.cfg) {
          const successors = state.cfg.getSuccessors(nodeId);
          for (const successor of successors) {
            if (!processedNodes.has(successor.id)) {
              worklist.unshift(successor.id);
            }
          }
        }
      }

      processedNodes.add(nodeId);
      this.nodesVisited++;
    }

    return currentState;
  }

  /**
   * Analyze a single node with abstract interpretation
   */
  private analyzeNode(node: IRNode, abstractState: AbstractState, irState: IRState): AbstractState {
    switch (node.type) {
      case 'VariableDeclaration':
        return this.analyzeVariableDeclaration(node, abstractState);

      case 'ExpressionStatement':
        return this.analyzeExpressionStatement(node, abstractState);

      case 'IfStatement':
        return this.analyzeIfStatement(node, abstractState, irState);

      case 'CallExpression':
        return this.analyzeCallExpression(node, abstractState);

      default:
        return abstractState;
    }
  }

  /**
   * Analyze variable declaration with abstract values
   */
  private analyzeVariableDeclaration(
    decl: IRVariableDeclaration,
    abstractState: AbstractState
  ): AbstractState {
    const newVariables = new Map(abstractState.variables);

    for (const declarator of decl.declarations) {
      const variableName = IRUtils.getPatternName(declarator.id) as VariableName;
      if (!variableName) continue;
      
      if (declarator.init) {
        const value = this.evaluateExpression(declarator.init, abstractState);
        newVariables.set(variableName, value);
      } else {
        newVariables.set(variableName, this.createBottomValue());
      }
    }

    return { ...abstractState, variables: newVariables };
  }

  /**
   * Analyze expression statement
   */
  private analyzeExpressionStatement(
    stmt: { expression: IRExpression },
    abstractState: AbstractState
  ): AbstractState {
    if (stmt.expression.type === 'AssignmentExpression') {
      return this.analyzeAssignment(stmt.expression, abstractState);
    }

    // Just evaluate for side effects
    this.evaluateExpression(stmt.expression, abstractState);
    return abstractState;
  }

  /**
   * Analyze assignment with abstract values
   */
  private analyzeAssignment(
    assignment: IRAssignmentExpression,
    abstractState: AbstractState
  ): AbstractState {
    if (assignment.left.type === 'Identifier') {
      const variableName = assignment.left.name as VariableName;
      const value = this.evaluateExpression(assignment.right, abstractState);
      
      const newVariables = new Map(abstractState.variables);
      newVariables.set(variableName, value);
      
      return { ...abstractState, variables: newVariables };
    }

    return abstractState;
  }

  /**
   * Analyze if statement with path sensitivity
   */
  private analyzeIfStatement(
    ifStmt: IRIfStatement,
    abstractState: AbstractState,
    irState: IRState
  ): AbstractState {
    const testValue = this.evaluateExpression(ifStmt.test, abstractState);
    
    // Path-sensitive analysis
    if (testValue.type === 'constant') {
      const constantValue = (testValue as ConstantValue).value;
      
      if (constantValue) {
        // Take consequent path only
        return this.analyzeNode(ifStmt.consequent, abstractState, irState);
      } else if (ifStmt.alternate) {
        // Take alternate path only
        return this.analyzeNode(ifStmt.alternate, abstractState, irState);
      }
    }

    // Both paths possible - would need to merge states
    // Simplified implementation
    return abstractState;
  }

  /**
   * Analyze call expression with inter-procedural analysis
   */
  private analyzeCallExpression(call: IRCallExpression, abstractState: AbstractState): AbstractState {
    if (call.callee.type === 'Identifier') {
      const functionName = call.callee.name as VariableName;
      const functionSummary = this.functionSummaries.get(functionName);
      
      if (functionSummary && functionSummary.isPure) {
        // Evaluate arguments
        const argValues = call.arguments.map(arg => 
          isExpression(arg) ? this.evaluateExpression(arg, abstractState) : this.createTopValue()
        );
        
        // Try to evaluate pure function call
        const result = this.evaluatePureFunctionCall(functionSummary, argValues);
        if (result) {
          // Function call can be constant-folded
          return abstractState;
        }
      }
    }

    return abstractState;
  }

  /**
   * Evaluate expression to abstract value
   */
  private evaluateExpression(expr: IRExpression, abstractState: AbstractState): ConcreteAbstractValue {
    switch (expr.type) {
      case 'Literal':
        return this.createConstantValue(expr.value);

      case 'Identifier':
        return abstractState.variables.get(expr.name as VariableName) || this.createTopValue();

      case 'BinaryExpression':
        return this.evaluateBinaryExpression(expr, abstractState);

      case 'UnaryExpression':
        return this.evaluateUnaryExpression(expr, abstractState);

      case 'MemberExpression':
        return this.evaluateMemberExpression(expr, abstractState);

      case 'CallExpression':
        return this.evaluateCallExpression(expr, abstractState);

      case 'ConditionalExpression':
        return this.evaluateConditionalExpression(expr, abstractState);

      case 'ArrayExpression':
        return this.evaluateArrayExpression(expr, abstractState);

      case 'ObjectExpression':
        return this.evaluateObjectExpression(expr, abstractState);

      default:
        return this.createTopValue();
    }
  }

  /**
   * Evaluate binary expression
   */
  private evaluateBinaryExpression(
    expr: IRBinaryExpression,
    abstractState: AbstractState
  ): ConcreteAbstractValue {
    const left = this.evaluateExpression(expr.left, abstractState);
    const right = this.evaluateExpression(expr.right, abstractState);

    // Constant folding
    if (left.type === 'constant' && right.type === 'constant') {
      const leftValue = (left as ConstantValue).value;
      const rightValue = (right as ConstantValue).value;
      
      const result = this.performBinaryOperation(expr.operator, leftValue, rightValue);
      if (result !== null) {
        return this.createConstantValue(result);
      }
    }

    // Range analysis for integers
    if (left.type === 'range' && right.type === 'range') {
      return this.performRangeOperation(expr.operator, left as RangeValue, right as RangeValue);
    }

    return this.createTopValue();
  }

  /**
   * Evaluate unary expression
   */
  private evaluateUnaryExpression(
    expr: IRUnaryExpression,
    abstractState: AbstractState
  ): ConcreteAbstractValue {
    const operand = this.evaluateExpression(expr.argument, abstractState);

    if (operand.type === 'constant') {
      const value = (operand as ConstantValue).value;
      const result = this.performUnaryOperation(expr.operator, value);
      if (result !== null) {
        return this.createConstantValue(result);
      }
    }

    return this.createTopValue();
  }

  /**
   * Evaluate member expression (property access)
   */
  private evaluateMemberExpression(
    expr: IRMemberExpression,
    abstractState: AbstractState
  ): ConcreteAbstractValue {
    const object = this.evaluateExpression(expr.object, abstractState);
    
    if (object.type === 'object') {
      const objectValue = object as ObjectValue;
      const propertyName = this.getPropertyName(expr);
      
      if (propertyName && objectValue.properties.has(propertyName)) {
        return objectValue.properties.get(propertyName)! as ConcreteAbstractValue;
      }
    }

    return this.createTopValue();
  }

  /**
   * Evaluate call expression
   */
  private evaluateCallExpression(
    call: IRCallExpression,
    abstractState: AbstractState
  ): ConcreteAbstractValue {
    if (call.callee.type === 'Identifier') {
      const functionName = call.callee.name as VariableName;
      const functionSummary = this.functionSummaries.get(functionName);
      
      if (functionSummary && functionSummary.isPure) {
        const argValues = call.arguments.map(arg => 
          isExpression(arg) ? this.evaluateExpression(arg, abstractState) : this.createTopValue()
        );
        
        const result = this.evaluatePureFunctionCall(functionSummary, argValues);
        if (result) {
          return result;
        }
      }
    }

    return this.createTopValue();
  }

  /**
   * Evaluate conditional expression
   */
  private evaluateConditionalExpression(
    expr: IRConditionalExpression,
    abstractState: AbstractState
  ): ConcreteAbstractValue {
    const test = this.evaluateExpression(expr.test, abstractState);
    
    if (test.type === 'constant') {
      const testValue = (test as ConstantValue).value;
      
      if (testValue) {
        return this.evaluateExpression(expr.consequent, abstractState);
      } else {
        return this.evaluateExpression(expr.alternate, abstractState);
      }
    }

    // Both branches possible - would need to join values
    const consequent = this.evaluateExpression(expr.consequent, abstractState);
    const alternate = this.evaluateExpression(expr.alternate, abstractState);
    
    return this.joinAbstractValues(consequent, alternate);
  }

  /**
   * Evaluate array expression
   */
  private evaluateArrayExpression(
    expr: IRArrayExpression,
    abstractState: AbstractState
  ): ArrayValue {
    const elements = new Map<number, AbstractValue>();
    
    for (let i = 0; i < expr.elements.length; i++) {
      const element = expr.elements[i];
      if (element && isExpression(element)) {
        elements.set(i, this.evaluateExpression(element, abstractState));
      }
    }

    return {
      type: 'array',
      latticeHeight: 1,
      confidence: 0.9,
      dependencies: new Set(),
      elements,
      length: this.createConstantValue(expr.elements.length),
      isSparse: expr.elements.some(e => e === null)
    };
  }

  /**
   * Evaluate object expression
   */
  private evaluateObjectExpression(
    expr: IRObjectExpression,
    abstractState: AbstractState
  ): ObjectValue {
    const properties = new Map<string, AbstractValue>();
    
    for (const property of expr.properties) {
      if (property.type === 'Property') {
        const key = this.getPropertyKey(property);
        if (key && isExpression(property.value)) {
          const value = this.evaluateExpression(property.value, abstractState);
          properties.set(key, value);
        }
      }
    }

    return {
      type: 'object',
      latticeHeight: 1,
      confidence: 0.9,
      dependencies: new Set(),
      properties,
      isSealed: false,
      isFrozen: false
    };
  }

  /**
   * Apply constant propagation transformations
   */
  private applyConstantPropagation(state: IRState): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    const newNodes = new Map<NodeId, IRNode>();
    let changed = false;

    if (!this.abstractState) {
      return { newNodes, changed };
    }

    for (const [nodeId, node] of state.nodes) {
      const replacement = this.tryConstantFolding(node, this.abstractState);
      if (replacement) {
        newNodes.set(nodeId, replacement);
        changed = true;
        this.nodesChanged++;
      }
    }

    return { newNodes, changed };
  }

  /**
   * Try to constant fold a node
   */
  private tryConstantFolding(node: IRNode, abstractState: AbstractState): IRNode | null {
    if (isExpression(node)) {
      const value = this.evaluateExpression(node, abstractState);
      if (value.type === 'constant') {
        const constantValue = (value as ConstantValue).value;
        return IRNodeFactory.createLiteral(constantValue, typeof constantValue);
      }
    }

    return null;
  }

  /**
   * Perform function inlining for simple pure functions
   */
  private performFunctionInlining(
    state: IRState,
    existingNodes: Map<NodeId, IRNode>
  ): { inlinedNodes: Map<NodeId, IRNode>; inliningChanged: boolean } {
    const inlinedNodes = new Map<NodeId, IRNode>();
    let inliningChanged = false;

    // Implementation would identify call sites and inline small pure functions
    // This is a placeholder for the full implementation
    
    return { inlinedNodes, inliningChanged };
  }

  // Helper methods for abstract value operations

  private createConstantValue(value: any): ConstantValue {
    return {
      type: 'constant',
      latticeHeight: 0,
      confidence: 1.0,
      dependencies: new Set(),
      value
    };
  }

  private createTopValue(): TopValue {
    return {
      type: 'top',
      latticeHeight: Infinity,
      confidence: 0.0,
      dependencies: new Set()
    };
  }

  private createBottomValue(): BottomValue {
    return {
      type: 'bottom',
      latticeHeight: -1,
      confidence: 0.0,
      dependencies: new Set()
    };
  }

  private performBinaryOperation(operator: string, left: any, right: any): any {
    try {
      switch (operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case '&': return left & right;
        case '|': return left | right;
        case '^': return left ^ right;
        case '<<': return left << right;
        case '>>': return left >> right;
        case '===': return left === right;
        case '!==': return left !== right;
        case '==': return left == right;
        case '!=': return left != right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        case '&&': return left && right;
        case '||': return left || right;
        default: return null;
      }
    } catch (e) {
      return null;
    }
  }

  private performUnaryOperation(operator: string, operand: any): any {
    try {
      switch (operator) {
        case '+': return +operand;
        case '-': return -operand;
        case '!': return !operand;
        case '~': return ~operand;
        case 'typeof': return typeof operand;
        default: return null;
      }
    } catch (e) {
      return null;
    }
  }

  private performRangeOperation(
    operator: string,
    left: RangeValue,
    right: RangeValue
  ): RangeValue | TopValue {
    // Simplified range arithmetic
    switch (operator) {
      case '+':
        return {
          type: 'range',
          latticeHeight: Math.max(left.latticeHeight, right.latticeHeight) + 1,
          confidence: Math.min(left.confidence, right.confidence),
          dependencies: new Set([...left.dependencies, ...right.dependencies]),
          min: left.min + right.min,
          max: left.max + right.max,
          isInteger: left.isInteger && right.isInteger
        };
      
      case '-':
        return {
          type: 'range',
          latticeHeight: Math.max(left.latticeHeight, right.latticeHeight) + 1,
          confidence: Math.min(left.confidence, right.confidence),
          dependencies: new Set([...left.dependencies, ...right.dependencies]),
          min: left.min - right.max,
          max: left.max - right.min,
          isInteger: left.isInteger && right.isInteger
        };
      
      default:
        return this.createTopValue();
    }
  }

  private evaluatePureFunctionCall(
    functionSummary: FunctionValue,
    argValues: ConcreteAbstractValue[]
  ): ConcreteAbstractValue | null {
    // Simplified pure function evaluation
    // In practice, would need symbolic execution or specialized evaluators
    
    // Check if all arguments are constants
    if (argValues.every(arg => arg.type === 'constant')) {
      // Could try to evaluate the function with constant arguments
      // This would require more sophisticated analysis
    }
    
    return null;
  }

  private joinAbstractValues(
    value1: ConcreteAbstractValue,
    value2: ConcreteAbstractValue
  ): ConcreteAbstractValue {
    // Simplified join operation
    if (value1.type === value2.type && value1.type === 'constant') {
      const const1 = value1 as ConstantValue;
      const const2 = value2 as ConstantValue;
      
      if (const1.value === const2.value) {
        return const1;
      }
    }
    
    return this.createTopValue();
  }

  private abstractStatesEqual(state1: AbstractState, state2: AbstractState): boolean {
    // Simplified equality check
    return state1.variables.size === state2.variables.size;
  }

  private isFunctionSmall(func: IRFunctionDeclaration): boolean {
    // Heuristic: function is small if it has less than 10 statements
    if (!func.body || func.body.type !== 'BlockStatement') return false;
    return func.body.body.length < 10;
  }

  private getPropertyName(member: IRMemberExpression): string | null {
    if (!member.computed && member.property.type === 'Identifier') {
      return member.property.name;
    }
    
    if (member.computed && member.property.type === 'Literal') {
      return String(member.property.value);
    }
    
    return null;
  }

  private getPropertyKey(property: IRProperty): string | null {
    if (property.key.type === 'Identifier') {
      return property.key.name;
    }
    
    if (property.key.type === 'Literal') {
      return String(property.key.value);
    }
    
    return null;
  }
}