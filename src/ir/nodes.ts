/**
 * @fileoverview ESTree-aligned Intermediate Representation (IR) nodes with SSA support
 * 
 * This module defines IR nodes that are compatible with ESTree but optimized for analysis.
 * Each node can carry additional metadata for SSA form, scope tracking, and shape analysis.
 */

import type { SourceLocation } from 'acorn';

// Branded types for type safety
export type NodeId = string & { readonly __brand: 'NodeId' };
export type ScopeId = number & { readonly __brand: 'ScopeId' };
export type ShapeId = number & { readonly __brand: 'ShapeId' };
export type SSAVersion = number & { readonly __brand: 'SSAVersion' };
export type VariableName = string & { readonly __brand: 'VariableName' };

/**
 * Base interface for all IR nodes with optional SSA and analysis metadata
 */
export interface IRNodeBase {
  readonly type: string;
  readonly loc?: SourceLocation;
  readonly range?: [number, number];
  
  // Analysis metadata
  readonly scope_id?: ScopeId;
  readonly shape_id?: ShapeId;
  readonly node_id?: NodeId;
  readonly ssa_name?: VariableName;
  
  // SSA-specific metadata
  readonly ssa_version?: SSAVersion;
  readonly ssa_uses?: Set<NodeId>;
  readonly ssa_defs?: Set<VariableName>;
}

/**
 * SSA-specific nodes for phi functions and versioned variables
 */

export interface IRPhiNode extends IRNodeBase {
  readonly type: 'PhiNode';
  readonly variable: VariableName;
  readonly operands: Map<NodeId, IRIdentifier>; // Block ID -> Variable version
  readonly target_version: SSAVersion;
}

export interface IRSSAIdentifier extends IRNodeBase {
  readonly type: 'SSAIdentifier';
  readonly name: VariableName;
  readonly version: SSAVersion;
  readonly original_name: string;
}

/**
 * Core expression nodes (ESTree compatible)
 */

export interface IRIdentifier extends IRNodeBase {
  readonly type: 'Identifier';
  readonly name: string;
  readonly ssa_name?: VariableName;
  readonly ssa_version?: SSAVersion;
}

export interface IRLiteral extends IRNodeBase {
  readonly type: 'Literal';
  readonly value: string | number | boolean | null | RegExp | bigint;
  readonly raw?: string;
  readonly regex?: {
    readonly pattern: string;
    readonly flags: string;
  };
  readonly bigint?: string;
}

export interface IRBinaryExpression extends IRNodeBase {
  readonly type: 'BinaryExpression';
  readonly operator: '+' | '-' | '*' | '/' | '%' | '**' | 
                     '==' | '!=' | '===' | '!==' | 
                     '<' | '<=' | '>' | '>=' |
                     '<<' | '>>' | '>>>' |
                     '&' | '|' | '^' |
                     '&&' | '||' | '??' |
                     'in' | 'instanceof';
  readonly left: IRExpression;
  readonly right: IRExpression;
}

export interface IRUnaryExpression extends IRNodeBase {
  readonly type: 'UnaryExpression';
  readonly operator: '-' | '+' | '!' | '~' | 'typeof' | 'void' | 'delete';
  readonly argument: IRExpression;
  readonly prefix: boolean;
}

export interface IRUpdateExpression extends IRNodeBase {
  readonly type: 'UpdateExpression';
  readonly operator: '++' | '--';
  readonly argument: IRExpression;
  readonly prefix: boolean;
}

export interface IRAssignmentExpression extends IRNodeBase {
  readonly type: 'AssignmentExpression';
  readonly operator: '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '**=' |
                     '<<=' | '>>=' | '>>>=' |
                     '&=' | '|=' | '^=' |
                     '&&=' | '||=' | '??=';
  readonly left: IRPattern;
  readonly right: IRExpression;
}

export interface IRLogicalExpression extends IRNodeBase {
  readonly type: 'LogicalExpression';
  readonly operator: '&&' | '||' | '??';
  readonly left: IRExpression;
  readonly right: IRExpression;
}

export interface IRConditionalExpression extends IRNodeBase {
  readonly type: 'ConditionalExpression';
  readonly test: IRExpression;
  readonly consequent: IRExpression;
  readonly alternate: IRExpression;
}

export interface IRCallExpression extends IRNodeBase {
  readonly type: 'CallExpression';
  readonly callee: IRExpression;
  readonly arguments: readonly IRExpression[];
  readonly optional?: boolean;
}

export interface IRNewExpression extends IRNodeBase {
  readonly type: 'NewExpression';
  readonly callee: IRExpression;
  readonly arguments: readonly IRExpression[];
}

export interface IRMemberExpression extends IRNodeBase {
  readonly type: 'MemberExpression';
  readonly object: IRExpression;
  readonly property: IRExpression;
  readonly computed: boolean;
  readonly optional?: boolean;
}

export interface IRArrayExpression extends IRNodeBase {
  readonly type: 'ArrayExpression';
  readonly elements: readonly (IRExpression | null)[];
}

export interface IRObjectExpression extends IRNodeBase {
  readonly type: 'ObjectExpression';
  readonly properties: readonly (IRProperty | IRSpreadElement)[];
}

export interface IRProperty extends IRNodeBase {
  readonly type: 'Property';
  readonly key: IRExpression;
  readonly value: IRExpression;
  readonly kind: 'init' | 'get' | 'set';
  readonly method: boolean;
  readonly shorthand: boolean;
  readonly computed: boolean;
}

export interface IRSpreadElement extends IRNodeBase {
  readonly type: 'SpreadElement';
  readonly argument: IRExpression;
}

export interface IRSequenceExpression extends IRNodeBase {
  readonly type: 'SequenceExpression';
  readonly expressions: readonly IRExpression[];
}

/**
 * Statement nodes
 */

export interface IRExpressionStatement extends IRNodeBase {
  readonly type: 'ExpressionStatement';
  readonly expression: IRExpression;
}

export interface IRBlockStatement extends IRNodeBase {
  readonly type: 'BlockStatement';
  readonly body: readonly IRStatement[];
  readonly phi_nodes?: readonly IRPhiNode[];
}

export interface IRVariableDeclaration extends IRNodeBase {
  readonly type: 'VariableDeclaration';
  readonly declarations: readonly IRVariableDeclarator[];
  readonly kind: 'var' | 'let' | 'const';
}

export interface IRVariableDeclarator extends IRNodeBase {
  readonly type: 'VariableDeclarator';
  readonly id: IRPattern;
  readonly init: IRExpression | null;
}

export interface IRFunctionDeclaration extends IRNodeBase {
  readonly type: 'FunctionDeclaration';
  readonly id: IRIdentifier | null;
  readonly params: readonly IRPattern[];
  readonly body: IRBlockStatement;
  readonly generator: boolean;
  readonly async: boolean;
}

export interface IRReturnStatement extends IRNodeBase {
  readonly type: 'ReturnStatement';
  readonly argument: IRExpression | null;
}

export interface IRIfStatement extends IRNodeBase {
  readonly type: 'IfStatement';
  readonly test: IRExpression;
  readonly consequent: IRStatement;
  readonly alternate: IRStatement | null;
}

export interface IRWhileStatement extends IRNodeBase {
  readonly type: 'WhileStatement';
  readonly test: IRExpression;
  readonly body: IRStatement;
}

export interface IRForStatement extends IRNodeBase {
  readonly type: 'ForStatement';
  readonly init: IRVariableDeclaration | IRExpression | null;
  readonly test: IRExpression | null;
  readonly update: IRExpression | null;
  readonly body: IRStatement;
}

export interface IRBreakStatement extends IRNodeBase {
  readonly type: 'BreakStatement';
  readonly label: IRIdentifier | null;
}

export interface IRContinueStatement extends IRNodeBase {
  readonly type: 'ContinueStatement';
  readonly label: IRIdentifier | null;
}

export interface IRThrowStatement extends IRNodeBase {
  readonly type: 'ThrowStatement';
  readonly argument: IRExpression;
}

export interface IRTryStatement extends IRNodeBase {
  readonly type: 'TryStatement';
  readonly block: IRBlockStatement;
  readonly handler: IRCatchClause | null;
  readonly finalizer: IRBlockStatement | null;
}

export interface IRCatchClause extends IRNodeBase {
  readonly type: 'CatchClause';
  readonly param: IRPattern | null;
  readonly body: IRBlockStatement;
}

export interface IRSwitchStatement extends IRNodeBase {
  readonly type: 'SwitchStatement';
  readonly discriminant: IRExpression;
  readonly cases: readonly IRSwitchCase[];
}

export interface IRSwitchCase extends IRNodeBase {
  readonly type: 'SwitchCase';
  readonly test: IRExpression | null;
  readonly consequent: readonly IRStatement[];
}

export interface IRLabeledStatement extends IRNodeBase {
  readonly type: 'LabeledStatement';
  readonly label: IRIdentifier;
  readonly body: IRStatement;
}

export interface IREmptyStatement extends IRNodeBase {
  readonly type: 'EmptyStatement';
}

export interface IRDebuggerStatement extends IRNodeBase {
  readonly type: 'DebuggerStatement';
}

/**
 * Pattern nodes for destructuring
 */

export interface IRArrayPattern extends IRNodeBase {
  readonly type: 'ArrayPattern';
  readonly elements: readonly (IRPattern | null)[];
}

export interface IRObjectPattern extends IRNodeBase {
  readonly type: 'ObjectPattern';
  readonly properties: readonly (IRAssignmentProperty | IRRestElement)[];
}

export interface IRAssignmentProperty extends IRNodeBase {
  readonly type: 'AssignmentProperty';
  readonly key: IRExpression;
  readonly value: IRPattern;
  readonly computed: boolean;
  readonly shorthand: boolean;
}

export interface IRRestElement extends IRNodeBase {
  readonly type: 'RestElement';
  readonly argument: IRPattern;
}

/**
 * Program and module nodes
 */

export interface IRProgram extends IRNodeBase {
  readonly type: 'Program';
  readonly body: readonly IRStatement[];
  readonly sourceType: 'script' | 'module';
}

/**
 * Union types for different node categories
 */

export type IRExpression = 
  | IRIdentifier
  | IRLiteral
  | IRBinaryExpression
  | IRUnaryExpression
  | IRUpdateExpression
  | IRAssignmentExpression
  | IRLogicalExpression
  | IRConditionalExpression
  | IRCallExpression
  | IRNewExpression
  | IRMemberExpression
  | IRArrayExpression
  | IRObjectExpression
  | IRSequenceExpression
  | IRSSAIdentifier;

export type IRStatement = 
  | IRExpressionStatement
  | IRBlockStatement
  | IRVariableDeclaration
  | IRFunctionDeclaration
  | IRReturnStatement
  | IRIfStatement
  | IRWhileStatement
  | IRForStatement
  | IRBreakStatement
  | IRContinueStatement
  | IRThrowStatement
  | IRTryStatement
  | IRSwitchStatement
  | IRLabeledStatement
  | IREmptyStatement
  | IRDebuggerStatement;

export type IRPattern = 
  | IRIdentifier
  | IRSSAIdentifier
  | IRArrayPattern
  | IRObjectPattern
  | IRRestElement;

export type IRNode = 
  | IRExpression
  | IRStatement
  | IRPattern
  | IRProgram
  | IRPhiNode
  | IRProperty
  | IRSpreadElement
  | IRVariableDeclarator
  | IRCatchClause
  | IRSwitchCase
  | IRAssignmentProperty;

/**
 * Factory functions for creating IR nodes with proper typing
 */

export class IRNodeFactory {
  private static nextNodeId = 0;
  private static nextScopeId = 0;
  private static nextShapeId = 0;

  static createNodeId(): NodeId {
    return `node_${this.nextNodeId++}` as NodeId;
  }

  static createScopeId(): ScopeId {
    return this.nextScopeId++ as ScopeId;
  }

  static createShapeId(): ShapeId {
    return this.nextShapeId++ as ShapeId;
  }

  static createVariableName(name: string): VariableName {
    return name as VariableName;
  }

  static createSSAVersion(version: number): SSAVersion {
    return version as SSAVersion;
  }

  /**
   * Helper method to create base node properties
   */
  private static createBaseNode<T extends IRNodeBase>(
    type: T['type'],
    properties: Omit<T, keyof IRNodeBase>,
    metadata?: Partial<IRNodeBase>
  ): T {
    return {
      ...metadata,
      ...properties,
      type,
      node_id: this.createNodeId(),
    } as T;
  }

  static identifier(
    name: string,
    metadata?: Partial<IRNodeBase>
  ): IRIdentifier {
    return this.createBaseNode('Identifier', { name }, metadata);
  }

  static literal(
    value: IRLiteral['value'],
    raw?: string,
    metadata?: Partial<IRNodeBase>
  ): IRLiteral {
    return this.createBaseNode('Literal', { value, raw }, metadata);
  }

  /**
   * Alias for literal method for compatibility
   */
  static createLiteral(
    value: IRLiteral['value'],
    raw?: string,
    metadata?: Partial<IRNodeBase>
  ): IRLiteral {
    return this.literal(value, raw, metadata);
  }

  static binaryExpression(
    operator: IRBinaryExpression['operator'],
    left: IRExpression,
    right: IRExpression,
    metadata?: Partial<IRNodeBase>
  ): IRBinaryExpression {
    return this.createBaseNode('BinaryExpression', { operator, left, right }, metadata);
  }

  static unaryExpression(
    operator: IRUnaryExpression['operator'],
    argument: IRExpression,
    prefix: boolean = true,
    metadata?: Partial<IRNodeBase>
  ): IRUnaryExpression {
    return this.createBaseNode('UnaryExpression', { operator, argument, prefix }, metadata);
  }

  static blockStatement(
    body: readonly IRStatement[],
    phiNodes?: readonly IRPhiNode[],
    metadata?: Partial<IRNodeBase>
  ): IRBlockStatement {
    return this.createBaseNode('BlockStatement', { body, phi_nodes: phiNodes }, metadata);
  }

  static phiNode(
    variable: VariableName,
    operands: Map<NodeId, IRIdentifier>,
    targetVersion: SSAVersion,
    metadata?: Partial<IRNodeBase>
  ): IRPhiNode {
    return this.createBaseNode('PhiNode', { 
      variable, 
      operands, 
      target_version: targetVersion 
    }, metadata);
  }

  static ssaIdentifier(
    name: VariableName,
    version: SSAVersion,
    originalName: string,
    metadata?: Partial<IRNodeBase>
  ): IRSSAIdentifier {
    return this.createBaseNode('SSAIdentifier', { 
      name, 
      version, 
      original_name: originalName 
    }, metadata);
  }

  static program(
    body: readonly IRStatement[],
    sourceType: 'script' | 'module' = 'script',
    metadata?: Partial<IRNodeBase>
  ): IRProgram {
    return this.createBaseNode('Program', { body, sourceType }, metadata);
  }

  static ifStatement(
    test: IRExpression,
    consequent: IRStatement,
    alternate?: IRStatement | null,
    metadata?: Partial<IRNodeBase>
  ): IRIfStatement {
    return this.createBaseNode('IfStatement', { 
      test, 
      consequent, 
      alternate: alternate ?? null 
    }, metadata);
  }

  static whileStatement(
    test: IRExpression,
    body: IRStatement,
    metadata?: Partial<IRNodeBase>
  ): IRWhileStatement {
    return this.createBaseNode('WhileStatement', { test, body }, metadata);
  }

  static forStatement(
    init: IRVariableDeclaration | IRExpression | null,
    test: IRExpression | null,
    update: IRExpression | null,
    body: IRStatement,
    metadata?: Partial<IRNodeBase>
  ): IRForStatement {
    return this.createBaseNode('ForStatement', { init, test, update, body }, metadata);
  }

  static switchStatement(
    discriminant: IRExpression,
    cases: readonly IRSwitchCase[],
    metadata?: Partial<IRNodeBase>
  ): IRSwitchStatement {
    return this.createBaseNode('SwitchStatement', { discriminant, cases }, metadata);
  }

  static switchCase(
    test: IRExpression | null,
    consequent: readonly IRStatement[],
    metadata?: Partial<IRNodeBase>
  ): IRSwitchCase {
    return this.createBaseNode('SwitchCase', { test, consequent }, metadata);
  }

  static conditionalExpression(
    test: IRExpression,
    consequent: IRExpression,
    alternate: IRExpression,
    metadata?: Partial<IRNodeBase>
  ): IRConditionalExpression {
    return this.createBaseNode('ConditionalExpression', { test, consequent, alternate }, metadata);
  }

  static breakStatement(
    label?: IRIdentifier | null,
    metadata?: Partial<IRNodeBase>
  ): IRBreakStatement {
    return {
      ...metadata,
      type: 'BreakStatement' as const,
      label: label ?? null,
      node_id: this.createNodeId(),
    };
  }

  static continueStatement(
    label?: IRIdentifier | null,
    metadata?: Partial<IRNodeBase>
  ): IRContinueStatement {
    return {
      ...metadata,
      type: 'ContinueStatement' as const,
      label: label ?? null,
      node_id: this.createNodeId(),
    };
  }

  static assignmentExpression(
    operator: IRAssignmentExpression['operator'],
    left: IRPattern,
    right: IRExpression,
    metadata?: Partial<IRNodeBase>
  ): IRAssignmentExpression {
    return this.createBaseNode('AssignmentExpression', { operator, left, right }, metadata);
  }

  static updateExpression(
    operator: IRUpdateExpression['operator'],
    argument: IRExpression,
    prefix: boolean,
    metadata?: Partial<IRNodeBase>
  ): IRUpdateExpression {
    return this.createBaseNode('UpdateExpression', { operator, argument, prefix }, metadata);
  }

  static variableDeclaration(
    declarations: readonly IRVariableDeclarator[],
    kind: 'var' | 'let' | 'const' = 'var',
    metadata?: Partial<IRNodeBase>
  ): IRVariableDeclaration {
    return this.createBaseNode('VariableDeclaration', { declarations, kind }, metadata);
  }

  /**
   * Alias for variableDeclaration method for compatibility
   */
  static createVariableDeclaration(
    declarations: readonly IRVariableDeclarator[],
    kind: 'var' | 'let' | 'const' = 'var',
    metadata?: Partial<IRNodeBase>
  ): IRVariableDeclaration {
    return this.variableDeclaration(declarations, kind, metadata);
  }

  static variableDeclarator(
    id: IRPattern,
    init?: IRExpression | null,
    metadata?: Partial<IRNodeBase>
  ): IRVariableDeclarator {
    return this.createBaseNode('VariableDeclarator', { id, init: init ?? null }, metadata);
  }

  static expressionStatement(
    expression: IRExpression,
    metadata?: Partial<IRNodeBase>
  ): IRExpressionStatement {
    return this.createBaseNode('ExpressionStatement', { expression }, metadata);
  }

  static functionDeclaration(
    id: IRIdentifier | null,
    params: readonly IRPattern[],
    body: IRBlockStatement,
    generator: boolean = false,
    async: boolean = false,
    metadata?: Partial<IRNodeBase>
  ): IRFunctionDeclaration {
    return this.createBaseNode('FunctionDeclaration', { id, params, body, generator, async }, metadata);
  }

  static returnStatement(
    argument?: IRExpression | null,
    metadata?: Partial<IRNodeBase>
  ): IRReturnStatement {
    return this.createBaseNode('ReturnStatement', { argument: argument ?? null }, metadata);
  }

  static arrayExpression(
    elements: readonly (IRExpression | null)[],
    metadata?: Partial<IRNodeBase>
  ): IRArrayExpression {
    return {
      ...metadata,
      type: 'ArrayExpression' as const,
      elements,
      node_id: this.createNodeId(),
    };
  }

  static callExpression(
    callee: IRExpression,
    args: readonly IRExpression[],
    optional?: boolean,
    metadata?: Partial<IRNodeBase>
  ): IRCallExpression {
    return this.createBaseNode('CallExpression', { 
      callee, 
      arguments: args, 
      optional: optional ?? false 
    }, metadata);
  }
}

/**
 * Type guards for IR nodes
 */

export function isExpression(node: IRNode): node is IRExpression {
  return node.type === 'Identifier' ||
         node.type === 'Literal' ||
         node.type === 'BinaryExpression' ||
         node.type === 'UnaryExpression' ||
         node.type === 'UpdateExpression' ||
         node.type === 'AssignmentExpression' ||
         node.type === 'LogicalExpression' ||
         node.type === 'ConditionalExpression' ||
         node.type === 'CallExpression' ||
         node.type === 'NewExpression' ||
         node.type === 'MemberExpression' ||
         node.type === 'ArrayExpression' ||
         node.type === 'ObjectExpression' ||
         node.type === 'SequenceExpression' ||
         node.type === 'SSAIdentifier';
}

export function isStatement(node: IRNode): node is IRStatement {
  return node.type === 'ExpressionStatement' ||
         node.type === 'BlockStatement' ||
         node.type === 'VariableDeclaration' ||
         node.type === 'FunctionDeclaration' ||
         node.type === 'ReturnStatement' ||
         node.type === 'IfStatement' ||
         node.type === 'WhileStatement' ||
         node.type === 'ForStatement' ||
         node.type === 'BreakStatement' ||
         node.type === 'ContinueStatement' ||
         node.type === 'ThrowStatement' ||
         node.type === 'TryStatement' ||
         node.type === 'SwitchStatement' ||
         node.type === 'LabeledStatement' ||
         node.type === 'EmptyStatement' ||
         node.type === 'DebuggerStatement';
}

export function isPhiNode(node: IRNode): node is IRPhiNode {
  return node.type === 'PhiNode';
}

export function isSSAIdentifier(node: IRNode): node is IRSSAIdentifier {
  return node.type === 'SSAIdentifier';
}

/**
 * Utility functions for working with IR nodes
 */

export class IRUtils {
  /**
   * Extract the name from a pattern if it's an identifier
   */
  static getPatternName(pattern: IRPattern): string | null {
    if (pattern.type === 'Identifier') {
      return pattern.name;
    }
    if (pattern.type === 'SSAIdentifier') {
      return pattern.original_name;
    }
    return null;
  }
  /**
   * Deep clone an IR node with new node IDs
   */
  static clone<T extends IRNode>(node: T): T {
    const cloned = JSON.parse(JSON.stringify(node)) as T;
    return {
      ...cloned,
      node_id: IRNodeFactory.createNodeId(),
    };
  }

  /**
   * Extract all identifiers from a node tree
   */
  static extractIdentifiers(node: IRNode): IRIdentifier[] {
    const identifiers: IRIdentifier[] = [];
    
    const visit = (n: IRNode): void => {
      if (n.type === 'Identifier') {
        identifiers.push(n);
      }
      
      // Visit child nodes based on type
      switch (n.type) {
        case 'BinaryExpression':
          visit(n.left);
          visit(n.right);
          break;
        case 'UnaryExpression':
        case 'UpdateExpression':
          visit(n.argument);
          break;
        case 'CallExpression':
        case 'NewExpression':
          visit(n.callee);
          n.arguments.forEach(visit);
          break;
        case 'MemberExpression':
          visit(n.object);
          visit(n.property);
          break;
        case 'BlockStatement':
          n.body.forEach(visit);
          break;
        // Add more cases as needed
      }
    };
    
    visit(node);
    return identifiers;
  }

  /**
   * Check if a node has SSA metadata
   */
  static hasSSAMetadata(node: IRNode): boolean {
    return node.ssa_version !== undefined || 
           node.ssa_uses !== undefined || 
           node.ssa_defs !== undefined;
  }
}