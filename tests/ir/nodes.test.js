/**
 * @fileoverview Tests for IR node definitions and factory functions
 */
import { describe, it, expect } from 'vitest';
import { IRNodeFactory, IRUtils, isExpression, isStatement, isPhiNode, isSSAIdentifier } from '../../src/ir/nodes.ts';
describe('IRNodeFactory', () => {
    describe('createNodeId', () => {
        it('should create unique node IDs', () => {
            const id1 = IRNodeFactory.createNodeId();
            const id2 = IRNodeFactory.createNodeId();
            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('string');
            expect(typeof id2).toBe('string');
        });
        it('should create IDs with proper branding', () => {
            const id = IRNodeFactory.createNodeId();
            expect(id).toMatch(/^node_\d+$/);
        });
    });
    describe('createScopeId', () => {
        it('should create unique scope IDs', () => {
            const id1 = IRNodeFactory.createScopeId();
            const id2 = IRNodeFactory.createScopeId();
            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('number');
            expect(typeof id2).toBe('number');
        });
    });
    describe('createShapeId', () => {
        it('should create unique shape IDs', () => {
            const id1 = IRNodeFactory.createShapeId();
            const id2 = IRNodeFactory.createShapeId();
            expect(id1).not.toBe(id2);
            expect(typeof id1).toBe('number');
            expect(typeof id2).toBe('number');
        });
    });
    describe('identifier', () => {
        it('should create identifier node with correct properties', () => {
            const name = 'testVar';
            const identifier = IRNodeFactory.identifier(name);
            expect(identifier.type).toBe('Identifier');
            expect(identifier.name).toBe(name);
            expect(identifier.node_id).toBeDefined();
        });
        it('should include metadata when provided', () => {
            const name = 'testVar';
            const metadata = {
                loc: {
                    start: { line: 1, column: 0, index: 0 },
                    end: { line: 1, column: 7, index: 7 }
                },
                scope_id: IRNodeFactory.createScopeId()
            };
            const identifier = IRNodeFactory.identifier(name, metadata);
            expect(identifier.loc).toBe(metadata.loc);
            expect(identifier.scope_id).toBe(metadata.scope_id);
        });
    });
    describe('literal', () => {
        it('should create string literal', () => {
            const value = 'hello world';
            const literal = IRNodeFactory.literal(value);
            expect(literal.type).toBe('Literal');
            expect(literal.value).toBe(value);
            expect(literal.node_id).toBeDefined();
        });
        it('should create number literal', () => {
            const value = 42;
            const literal = IRNodeFactory.literal(value);
            expect(literal.type).toBe('Literal');
            expect(literal.value).toBe(value);
        });
        it('should create boolean literal', () => {
            const value = true;
            const literal = IRNodeFactory.literal(value);
            expect(literal.type).toBe('Literal');
            expect(literal.value).toBe(value);
        });
        it('should create null literal', () => {
            const value = null;
            const literal = IRNodeFactory.literal(value);
            expect(literal.type).toBe('Literal');
            expect(literal.value).toBe(value);
        });
        it('should include raw value when provided', () => {
            const value = 42;
            const raw = '0x2A';
            const literal = IRNodeFactory.literal(value, raw);
            expect(literal.value).toBe(value);
            expect(literal.raw).toBe(raw);
        });
    });
    describe('binaryExpression', () => {
        it('should create binary expression with correct properties', () => {
            const left = IRNodeFactory.identifier('a');
            const right = IRNodeFactory.literal(5);
            const operator = '+';
            const binaryExpr = IRNodeFactory.binaryExpression(operator, left, right);
            expect(binaryExpr.type).toBe('BinaryExpression');
            expect(binaryExpr.operator).toBe(operator);
            expect(binaryExpr.left).toBe(left);
            expect(binaryExpr.right).toBe(right);
            expect(binaryExpr.node_id).toBeDefined();
        });
        it('should support all binary operators', () => {
            const left = IRNodeFactory.identifier('a');
            const right = IRNodeFactory.identifier('b');
            const operators = [
                '+', '-', '*', '/', '%', '**',
                '==', '!=', '===', '!==',
                '<', '<=', '>', '>=',
                '<<', '>>', '>>>',
                '&', '|', '^',
                '&&', '||', '??',
                'in', 'instanceof'
            ];
            for (const operator of operators) {
                const expr = IRNodeFactory.binaryExpression(operator, left, right);
                expect(expr.operator).toBe(operator);
            }
        });
    });
    describe('blockStatement', () => {
        it('should create empty block statement', () => {
            const block = IRNodeFactory.blockStatement([]);
            expect(block.type).toBe('BlockStatement');
            expect(block.body).toHaveLength(0);
            expect(block.node_id).toBeDefined();
        });
        it('should create block with statements', () => {
            const statements = [
                { type: 'ExpressionStatement', expression: IRNodeFactory.identifier('x') }
            ];
            const block = IRNodeFactory.blockStatement(statements);
            expect(block.body).toBe(statements);
        });
        it('should include phi nodes when provided', () => {
            const phiNode = IRNodeFactory.phiNode(IRNodeFactory.createVariableName('x'), new Map(), IRNodeFactory.createSSAVersion(1));
            const block = IRNodeFactory.blockStatement([], [phiNode]);
            expect(block.phi_nodes).toHaveLength(1);
            expect(block.phi_nodes?.[0]).toBe(phiNode);
        });
    });
    describe('phiNode', () => {
        it('should create phi node with correct properties', () => {
            const variable = IRNodeFactory.createVariableName('x');
            const operands = new Map();
            const version = IRNodeFactory.createSSAVersion(2);
            const phi = IRNodeFactory.phiNode(variable, operands, version);
            expect(phi.type).toBe('PhiNode');
            expect(phi.variable).toBe(variable);
            expect(phi.operands).toBe(operands);
            expect(phi.target_version).toBe(version);
            expect(phi.node_id).toBeDefined();
        });
    });
    describe('ssaIdentifier', () => {
        it('should create SSA identifier with correct properties', () => {
            const name = IRNodeFactory.createVariableName('x');
            const version = IRNodeFactory.createSSAVersion(3);
            const originalName = 'x';
            const ssaId = IRNodeFactory.ssaIdentifier(name, version, originalName);
            expect(ssaId.type).toBe('SSAIdentifier');
            expect(ssaId.name).toBe(name);
            expect(ssaId.version).toBe(version);
            expect(ssaId.original_name).toBe(originalName);
            expect(ssaId.node_id).toBeDefined();
        });
    });
    describe('program', () => {
        it('should create program with default source type', () => {
            const statements = [
                { type: 'ExpressionStatement', expression: IRNodeFactory.identifier('x') }
            ];
            const program = IRNodeFactory.program(statements);
            expect(program.type).toBe('Program');
            expect(program.body).toBe(statements);
            expect(program.sourceType).toBe('script');
            expect(program.node_id).toBeDefined();
        });
        it('should create module program', () => {
            const program = IRNodeFactory.program([], 'module');
            expect(program.sourceType).toBe('module');
        });
    });
});
describe('Type Guards', () => {
    describe('isExpression', () => {
        it('should return true for expression nodes', () => {
            const identifier = IRNodeFactory.identifier('x');
            const literal = IRNodeFactory.literal(42);
            const binaryExpr = IRNodeFactory.binaryExpression('+', identifier, literal);
            expect(isExpression(identifier)).toBe(true);
            expect(isExpression(literal)).toBe(true);
            expect(isExpression(binaryExpr)).toBe(true);
        });
        it('should return false for statement nodes', () => {
            const block = IRNodeFactory.blockStatement([]);
            expect(isExpression(block)).toBe(false);
        });
    });
    describe('isStatement', () => {
        it('should return true for statement nodes', () => {
            const block = IRNodeFactory.blockStatement([]);
            expect(isStatement(block)).toBe(true);
        });
        it('should return false for expression nodes', () => {
            const identifier = IRNodeFactory.identifier('x');
            expect(isStatement(identifier)).toBe(false);
        });
    });
    describe('isPhiNode', () => {
        it('should return true for phi nodes', () => {
            const phi = IRNodeFactory.phiNode(IRNodeFactory.createVariableName('x'), new Map(), IRNodeFactory.createSSAVersion(1));
            expect(isPhiNode(phi)).toBe(true);
        });
        it('should return false for non-phi nodes', () => {
            const identifier = IRNodeFactory.identifier('x');
            expect(isPhiNode(identifier)).toBe(false);
        });
    });
    describe('isSSAIdentifier', () => {
        it('should return true for SSA identifier nodes', () => {
            const ssaId = IRNodeFactory.ssaIdentifier(IRNodeFactory.createVariableName('x'), IRNodeFactory.createSSAVersion(1), 'x');
            expect(isSSAIdentifier(ssaId)).toBe(true);
        });
        it('should return false for regular identifiers', () => {
            const identifier = IRNodeFactory.identifier('x');
            expect(isSSAIdentifier(identifier)).toBe(false);
        });
    });
});
describe('IRUtils', () => {
    describe('clone', () => {
        it('should create deep copy of node', () => {
            const original = IRNodeFactory.binaryExpression('+', IRNodeFactory.identifier('a'), IRNodeFactory.literal(5));
            const cloned = IRUtils.clone(original);
            expect(cloned).not.toBe(original);
            expect(cloned.type).toBe(original.type);
            expect(cloned.operator).toBe(original.operator);
            expect(cloned.node_id).not.toBe(original.node_id);
        });
        it('should preserve all properties except node_id', () => {
            const metadata = {
                loc: {
                    start: { line: 1, column: 0, index: 0 },
                    end: { line: 1, column: 3, index: 3 }
                },
                scope_id: IRNodeFactory.createScopeId()
            };
            const original = IRNodeFactory.identifier('x', metadata);
            const cloned = IRUtils.clone(original);
            expect(cloned.loc).toEqual(original.loc);
            expect(cloned.scope_id).toBe(original.scope_id);
            expect(cloned.node_id).not.toBe(original.node_id);
        });
    });
    describe('extractIdentifiers', () => {
        it('should find all identifiers in simple expression', () => {
            const expr = IRNodeFactory.binaryExpression('+', IRNodeFactory.identifier('a'), IRNodeFactory.identifier('b'));
            const identifiers = IRUtils.extractIdentifiers(expr);
            expect(identifiers).toHaveLength(2);
            expect(identifiers[0]?.name).toBe('a');
            expect(identifiers[1]?.name).toBe('b');
        });
        it('should find identifiers in nested expressions', () => {
            const expr = IRNodeFactory.binaryExpression('*', IRNodeFactory.binaryExpression('+', IRNodeFactory.identifier('a'), IRNodeFactory.identifier('b')), IRNodeFactory.identifier('c'));
            const identifiers = IRUtils.extractIdentifiers(expr);
            expect(identifiers).toHaveLength(3);
            const names = identifiers.map(id => id.name).sort();
            expect(names).toEqual(['a', 'b', 'c']);
        });
        it('should not find identifiers in literal-only expressions', () => {
            const expr = IRNodeFactory.binaryExpression('+', IRNodeFactory.literal(1), IRNodeFactory.literal(2));
            const identifiers = IRUtils.extractIdentifiers(expr);
            expect(identifiers).toHaveLength(0);
        });
    });
    describe('hasSSAMetadata', () => {
        it('should return true for nodes with SSA version', () => {
            const node = {
                ...IRNodeFactory.identifier('x'),
                ssa_version: IRNodeFactory.createSSAVersion(1)
            };
            expect(IRUtils.hasSSAMetadata(node)).toBe(true);
        });
        it('should return true for nodes with SSA uses', () => {
            const node = {
                ...IRNodeFactory.identifier('x'),
                ssa_uses: new Set([IRNodeFactory.createNodeId()])
            };
            expect(IRUtils.hasSSAMetadata(node)).toBe(true);
        });
        it('should return true for nodes with SSA defs', () => {
            const node = {
                ...IRNodeFactory.identifier('x'),
                ssa_defs: new Set([IRNodeFactory.createVariableName('x')])
            };
            expect(IRUtils.hasSSAMetadata(node)).toBe(true);
        });
        it('should return false for nodes without SSA metadata', () => {
            const node = IRNodeFactory.identifier('x');
            expect(IRUtils.hasSSAMetadata(node)).toBe(false);
        });
    });
});
describe('Branded Types', () => {
    it('should create properly branded types', () => {
        const nodeId = IRNodeFactory.createNodeId();
        const scopeId = IRNodeFactory.createScopeId();
        const shapeId = IRNodeFactory.createShapeId();
        const variableName = IRNodeFactory.createVariableName('test');
        const ssaVersion = IRNodeFactory.createSSAVersion(5);
        // Type checks (these would fail at compile-time if branding isn't working)
        expect(typeof nodeId).toBe('string');
        expect(typeof scopeId).toBe('number');
        expect(typeof shapeId).toBe('number');
        expect(typeof variableName).toBe('string');
        expect(typeof ssaVersion).toBe('number');
    });
});
describe('Node Immutability', () => {
    it('should create readonly nodes', () => {
        const identifier = IRNodeFactory.identifier('x');
        // These should not compile in strict TypeScript
        // identifier.name = 'y';
        // identifier.type = 'Literal';
        expect(identifier.name).toBe('x');
        expect(identifier.type).toBe('Identifier');
    });
    it('should not allow modification of nested properties', () => {
        const expr = IRNodeFactory.binaryExpression('+', IRNodeFactory.identifier('a'), IRNodeFactory.literal(5));
        // These should not compile in strict TypeScript
        // expr.left = IRNodeFactory.identifier('b');
        // expr.operator = '-';
        expect(expr.left.type).toBe('Identifier');
        expect(expr.operator).toBe('+');
    });
});
//# sourceMappingURL=nodes.test.js.map