"use strict";
/**
 * @fileoverview ESTree-aligned Intermediate Representation (IR) nodes with SSA support
 *
 * This module defines IR nodes that are compatible with ESTree but optimized for analysis.
 * Each node can carry additional metadata for SSA form, scope tracking, and shape analysis.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IRUtils = exports.IRNodeFactory = void 0;
exports.isExpression = isExpression;
exports.isStatement = isStatement;
exports.isPhiNode = isPhiNode;
exports.isSSAIdentifier = isSSAIdentifier;
/**
 * Factory functions for creating IR nodes with proper typing
 */
class IRNodeFactory {
    static createNodeId() {
        return `node_${this.nextNodeId++}`;
    }
    static createScopeId() {
        return this.nextScopeId++;
    }
    static createShapeId() {
        return this.nextShapeId++;
    }
    static createVariableName(name) {
        return name;
    }
    static createSSAVersion(version) {
        return version;
    }
    static identifier(name, metadata) {
        return {
            type: 'Identifier',
            name,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static literal(value, raw, metadata) {
        return {
            type: 'Literal',
            value,
            raw,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static binaryExpression(operator, left, right, metadata) {
        return {
            type: 'BinaryExpression',
            operator,
            left,
            right,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static unaryExpression(operator, argument, prefix = true, metadata) {
        return {
            type: 'UnaryExpression',
            operator,
            argument,
            prefix,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static blockStatement(body, phiNodes, metadata) {
        return {
            type: 'BlockStatement',
            body,
            phi_nodes: phiNodes,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static phiNode(variable, operands, targetVersion, metadata) {
        return {
            type: 'PhiNode',
            variable,
            operands,
            target_version: targetVersion,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static ssaIdentifier(name, version, originalName, metadata) {
        return {
            type: 'SSAIdentifier',
            name,
            version,
            original_name: originalName,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static program(body, sourceType = 'script', metadata) {
        return {
            type: 'Program',
            body,
            sourceType,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static ifStatement(test, consequent, alternate, metadata) {
        return {
            type: 'IfStatement',
            test,
            consequent,
            alternate: alternate ?? null,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static whileStatement(test, body, metadata) {
        return {
            type: 'WhileStatement',
            test,
            body,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static forStatement(init, test, update, body, metadata) {
        return {
            type: 'ForStatement',
            init,
            test,
            update,
            body,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static switchStatement(discriminant, cases, metadata) {
        return {
            type: 'SwitchStatement',
            discriminant,
            cases,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static switchCase(test, consequent, metadata) {
        return {
            type: 'SwitchCase',
            test,
            consequent,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static conditionalExpression(test, consequent, alternate, metadata) {
        return {
            type: 'ConditionalExpression',
            test,
            consequent,
            alternate,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static breakStatement(label, metadata) {
        return {
            type: 'BreakStatement',
            label: label ?? null,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static continueStatement(label, metadata) {
        return {
            type: 'ContinueStatement',
            label: label ?? null,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static assignmentExpression(operator, left, right, metadata) {
        return {
            type: 'AssignmentExpression',
            operator,
            left,
            right,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static updateExpression(operator, argument, prefix, metadata) {
        return {
            type: 'UpdateExpression',
            operator,
            argument,
            prefix,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static variableDeclaration(declarations, kind = 'var', metadata) {
        return {
            type: 'VariableDeclaration',
            declarations,
            kind,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static variableDeclarator(id, init, metadata) {
        return {
            type: 'VariableDeclarator',
            id,
            init: init ?? null,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static expressionStatement(expression, metadata) {
        return {
            type: 'ExpressionStatement',
            expression,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static functionDeclaration(id, params, body, generator = false, async = false, metadata) {
        return {
            type: 'FunctionDeclaration',
            id,
            params,
            body,
            generator,
            async,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
    static returnStatement(argument, metadata) {
        return {
            type: 'ReturnStatement',
            argument: argument ?? null,
            node_id: this.createNodeId(),
            ...metadata,
        };
    }
}
exports.IRNodeFactory = IRNodeFactory;
IRNodeFactory.nextNodeId = 0;
IRNodeFactory.nextScopeId = 0;
IRNodeFactory.nextShapeId = 0;
/**
 * Type guards for IR nodes
 */
function isExpression(node) {
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
function isStatement(node) {
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
function isPhiNode(node) {
    return node.type === 'PhiNode';
}
function isSSAIdentifier(node) {
    return node.type === 'SSAIdentifier';
}
/**
 * Utility functions for working with IR nodes
 */
class IRUtils {
    /**
     * Deep clone an IR node with new node IDs
     */
    static clone(node) {
        const cloned = JSON.parse(JSON.stringify(node));
        return {
            ...cloned,
            node_id: IRNodeFactory.createNodeId(),
        };
    }
    /**
     * Extract all identifiers from a node tree
     */
    static extractIdentifiers(node) {
        const identifiers = [];
        const visit = (n) => {
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
    static hasSSAMetadata(node) {
        return node.ssa_version !== undefined ||
            node.ssa_uses !== undefined ||
            node.ssa_defs !== undefined;
    }
}
exports.IRUtils = IRUtils;
