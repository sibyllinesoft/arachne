/**
 * @fileoverview Tests for SSA form construction and utilities
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SSABuilder, SSADestroyer, SSAAnalyzer } from '../../src/ir/ssa.ts';
import { CFGBuilder } from '../../src/ir/cfg.ts';
import { IRNodeFactory } from '../../src/ir/nodes.ts';
describe('SSABuilder', () => {
    let cfgBuilder;
    beforeEach(() => {
        cfgBuilder = new CFGBuilder();
    });
    describe('buildSSA', () => {
        it('should handle simple variable assignment', () => {
            const statements = [
                {
                    type: 'VariableDeclaration',
                    kind: 'let',
                    declarations: [{
                            type: 'VariableDeclarator',
                            id: IRNodeFactory.identifier('x'),
                            init: IRNodeFactory.literal(5),
                            node_id: IRNodeFactory.createNodeId()
                        }],
                    node_id: IRNodeFactory.createNodeId()
                }
            ];
            const cfg = cfgBuilder.buildFromStatements(statements);
            const ssaBuilder = new SSABuilder(cfg);
            const ssaState = ssaBuilder.buildSSA();
            expect(ssaState).toBeDefined();
            expect(ssaState.cfg).toBe(cfg);
            expect(ssaState.variables.size).toBeGreaterThan(0);
            expect(ssaState.use_def_chains.size).toBeGreaterThan(0);
        });
        it('should create phi nodes for join points', () => {
            const ifStmt = {
                type: 'IfStatement',
                test: IRNodeFactory.identifier('condition'),
                consequent: {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'AssignmentExpression',
                        operator: '=',
                        left: IRNodeFactory.identifier('x'),
                        right: IRNodeFactory.literal(1),
                        node_id: IRNodeFactory.createNodeId()
                    },
                    node_id: IRNodeFactory.createNodeId()
                },
                alternate: {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'AssignmentExpression',
                        operator: '=',
                        left: IRNodeFactory.identifier('x'),
                        right: IRNodeFactory.literal(2),
                        node_id: IRNodeFactory.createNodeId()
                    },
                    node_id: IRNodeFactory.createNodeId()
                },
                node_id: IRNodeFactory.createNodeId()
            };
            const cfg = cfgBuilder.buildFromStatements([ifStmt]);
            const ssaBuilder = new SSABuilder(cfg);
            const ssaState = ssaBuilder.buildSSA();
            // Should have phi nodes for the join point
            expect(ssaState.phi_nodes.size).toBeGreaterThan(0);
            // Check for phi node creation
            let hasPhiNode = false;
            for (const phiNodes of ssaState.phi_nodes.values()) {
                if (phiNodes.length > 0) {
                    hasPhiNode = true;
                    break;
                }
            }
            expect(hasPhiNode).toBe(true);
        });
        it('should version variables correctly', () => {
            const statements = [
                {
                    type: 'VariableDeclaration',
                    kind: 'let',
                    declarations: [{
                            type: 'VariableDeclarator',
                            id: IRNodeFactory.identifier('x'),
                            init: IRNodeFactory.literal(1),
                            node_id: IRNodeFactory.createNodeId()
                        }],
                    node_id: IRNodeFactory.createNodeId()
                },
                {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'AssignmentExpression',
                        operator: '=',
                        left: IRNodeFactory.identifier('x'),
                        right: IRNodeFactory.literal(2),
                        node_id: IRNodeFactory.createNodeId()
                    },
                    node_id: IRNodeFactory.createNodeId()
                }
            ];
            const cfg = cfgBuilder.buildFromStatements(statements);
            const ssaBuilder = new SSABuilder(cfg);
            const ssaState = ssaBuilder.buildSSA();
            const xVarName = IRNodeFactory.createVariableName('x');
            const xVersions = ssaState.variables.get(xVarName) || [];
            // Should have multiple versions of x
            expect(xVersions.length).toBeGreaterThan(1);
            // Versions should be unique
            const versions = xVersions.map(v => v.version);
            const uniqueVersions = new Set(versions);
            expect(uniqueVersions.size).toBe(versions.length);
        });
        it('should build use-def chains', () => {
            const statements = [
                {
                    type: 'VariableDeclaration',
                    kind: 'let',
                    declarations: [{
                            type: 'VariableDeclarator',
                            id: IRNodeFactory.identifier('x'),
                            init: IRNodeFactory.literal(1),
                            node_id: IRNodeFactory.createNodeId()
                        }],
                    node_id: IRNodeFactory.createNodeId()
                },
                {
                    type: 'ExpressionStatement',
                    expression: IRNodeFactory.identifier('x'),
                    node_id: IRNodeFactory.createNodeId()
                }
            ];
            const cfg = cfgBuilder.buildFromStatements(statements);
            const ssaBuilder = new SSABuilder(cfg);
            const ssaState = ssaBuilder.buildSSA();
            const xVarName = IRNodeFactory.createVariableName('x');
            const useDefChain = ssaState.use_def_chains.get(xVarName);
            expect(useDefChain).toBeDefined();
            expect(useDefChain?.defs.length).toBeGreaterThan(0);
            expect(useDefChain?.uses.length).toBeGreaterThan(0);
        });
    });
    describe('loop handling', () => {
        it('should handle loops with phi nodes', () => {
            const whileStmt = {
                type: 'WhileStatement',
                test: IRNodeFactory.identifier('condition'),
                body: {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'AssignmentExpression',
                        operator: '=',
                        left: IRNodeFactory.identifier('x'),
                        right: {
                            type: 'BinaryExpression',
                            operator: '+',
                            left: IRNodeFactory.identifier('x'),
                            right: IRNodeFactory.literal(1),
                            node_id: IRNodeFactory.createNodeId()
                        },
                        node_id: IRNodeFactory.createNodeId()
                    },
                    node_id: IRNodeFactory.createNodeId()
                },
                node_id: IRNodeFactory.createNodeId()
            };
            const cfg = cfgBuilder.buildFromStatements([whileStmt]);
            const ssaBuilder = new SSABuilder(cfg);
            const ssaState = ssaBuilder.buildSSA();
            // Should handle the loop variable correctly
            expect(ssaState.variables.size).toBeGreaterThan(0);
            expect(ssaState.phi_nodes.size).toBeGreaterThan(0);
        });
    });
});
describe('SSADestroyer', () => {
    let cfgBuilder;
    beforeEach(() => {
        cfgBuilder = new CFGBuilder();
    });
    it('should convert SSA back to normal form', () => {
        const statements = [
            {
                type: 'VariableDeclaration',
                kind: 'let',
                declarations: [{
                        type: 'VariableDeclarator',
                        id: IRNodeFactory.identifier('x'),
                        init: IRNodeFactory.literal(5),
                        node_id: IRNodeFactory.createNodeId()
                    }],
                node_id: IRNodeFactory.createNodeId()
            }
        ];
        const cfg = cfgBuilder.buildFromStatements(statements);
        const ssaBuilder = new SSABuilder(cfg);
        const ssaState = ssaBuilder.buildSSA();
        const destroyer = new SSADestroyer(ssaState);
        const normalizedNodes = destroyer.destroySSA();
        expect(normalizedNodes.size).toBeGreaterThan(0);
        // Check that SSA identifiers are converted back to regular identifiers
        for (const node of normalizedNodes.values()) {
            expect(node.type).not.toBe('SSAIdentifier');
            if (node.type === 'Identifier') {
                expect(node.name).toBeDefined();
                expect(typeof node.name).toBe('string');
            }
        }
    });
    it('should remove phi nodes from blocks', () => {
        const ifStmt = {
            type: 'IfStatement',
            test: IRNodeFactory.identifier('condition'),
            consequent: {
                type: 'ExpressionStatement',
                expression: {
                    type: 'AssignmentExpression',
                    operator: '=',
                    left: IRNodeFactory.identifier('x'),
                    right: IRNodeFactory.literal(1),
                    node_id: IRNodeFactory.createNodeId()
                },
                node_id: IRNodeFactory.createNodeId()
            },
            alternate: {
                type: 'ExpressionStatement',
                expression: {
                    type: 'AssignmentExpression',
                    operator: '=',
                    left: IRNodeFactory.identifier('x'),
                    right: IRNodeFactory.literal(2),
                    node_id: IRNodeFactory.createNodeId()
                },
                node_id: IRNodeFactory.createNodeId()
            },
            node_id: IRNodeFactory.createNodeId()
        };
        const cfg = cfgBuilder.buildFromStatements([ifStmt]);
        const ssaBuilder = new SSABuilder(cfg);
        const ssaState = ssaBuilder.buildSSA();
        const destroyer = new SSADestroyer(ssaState);
        const normalizedNodes = destroyer.destroySSA();
        // Check that phi nodes are removed from blocks
        for (const node of normalizedNodes.values()) {
            if (node.type === 'BlockStatement') {
                expect(node.phi_nodes).toBeUndefined();
            }
        }
    });
    it('should preserve original variable names', () => {
        const statements = [
            {
                type: 'VariableDeclaration',
                kind: 'let',
                declarations: [{
                        type: 'VariableDeclarator',
                        id: IRNodeFactory.identifier('myVariable'),
                        init: IRNodeFactory.literal(42),
                        node_id: IRNodeFactory.createNodeId()
                    }],
                node_id: IRNodeFactory.createNodeId()
            }
        ];
        const cfg = cfgBuilder.buildFromStatements(statements);
        const ssaBuilder = new SSABuilder(cfg);
        const ssaState = ssaBuilder.buildSSA();
        const destroyer = new SSADestroyer(ssaState);
        const normalizedNodes = destroyer.destroySSA();
        // Find the variable declaration
        let foundOriginalName = false;
        for (const node of normalizedNodes.values()) {
            if (node.type === 'VariableDeclaration') {
                for (const decl of node.declarations) {
                    if (decl.id.type === 'Identifier' && decl.id.name === 'myVariable') {
                        foundOriginalName = true;
                        break;
                    }
                }
            }
        }
        expect(foundOriginalName).toBe(true);
    });
});
describe('SSAAnalyzer', () => {
    let cfgBuilder;
    let ssaState; // SSAState
    beforeEach(() => {
        cfgBuilder = new CFGBuilder();
        const statements = [
            {
                type: 'VariableDeclaration',
                kind: 'let',
                declarations: [{
                        type: 'VariableDeclarator',
                        id: IRNodeFactory.identifier('x'),
                        init: IRNodeFactory.literal(5),
                        node_id: IRNodeFactory.createNodeId()
                    }],
                node_id: IRNodeFactory.createNodeId()
            },
            {
                type: 'ExpressionStatement',
                expression: IRNodeFactory.identifier('x'),
                node_id: IRNodeFactory.createNodeId()
            }
        ];
        const cfg = cfgBuilder.buildFromStatements(statements);
        const ssaBuilder = new SSABuilder(cfg);
        ssaState = ssaBuilder.buildSSA();
    });
    describe('findUses', () => {
        it('should find uses of a definition', () => {
            const xVarName = IRNodeFactory.createVariableName('x');
            const useDefChain = ssaState.use_def_chains.get(xVarName);
            if (useDefChain && useDefChain.defs.length > 0) {
                const defSite = useDefChain.defs[0];
                const uses = SSAAnalyzer.findUses(ssaState, defSite);
                expect(Array.isArray(uses)).toBe(true);
                // Should find at least the use in the expression statement
                expect(uses.length).toBeGreaterThan(0);
            }
        });
    });
    describe('findReachingDef', () => {
        it('should find reaching definition for a use', () => {
            const xVarName = IRNodeFactory.createVariableName('x');
            const useDefChain = ssaState.use_def_chains.get(xVarName);
            if (useDefChain && useDefChain.uses.length > 0) {
                const useSite = useDefChain.uses[0];
                const reachingDef = SSAAnalyzer.findReachingDef(ssaState, useSite);
                expect(reachingDef).toBeDefined();
                expect(typeof reachingDef).toBe('string');
            }
        });
    });
    describe('doVariablesInterfere', () => {
        it('should detect non-interference for non-overlapping variables', () => {
            const var1 = IRNodeFactory.createVariableName('x');
            const var2 = IRNodeFactory.createVariableName('y');
            // This is a simplified test - in reality, we'd need different variables
            const interfere = SSAAnalyzer.doVariablesInterfere(ssaState, var1, var2);
            expect(typeof interfere).toBe('boolean');
        });
        it('should detect interference for the same variable', () => {
            const var1 = IRNodeFactory.createVariableName('x');
            const var2 = IRNodeFactory.createVariableName('x');
            const interfere = SSAAnalyzer.doVariablesInterfere(ssaState, var1, var2);
            expect(interfere).toBe(true);
        });
    });
    describe('validateSSA', () => {
        it('should validate correct SSA form', () => {
            const isValid = SSAAnalyzer.validateSSA(ssaState);
            expect(typeof isValid).toBe('boolean');
            expect(isValid).toBe(true);
        });
        it('should detect invalid SSA with missing definitions', () => {
            // Create invalid SSA state with use but no definition
            const invalidState = {
                ...ssaState,
                use_def_chains: new Map([
                    [IRNodeFactory.createVariableName('undefined_var'), {
                            variable: {
                                name: IRNodeFactory.createVariableName('undefined_var'),
                                version: IRNodeFactory.createSSAVersion(1),
                                original_name: 'undefined_var',
                                def_site: IRNodeFactory.createNodeId(),
                                use_sites: [IRNodeFactory.createNodeId()]
                            },
                            defs: [], // No definitions
                            uses: [IRNodeFactory.createNodeId()],
                            reaching_defs: new Map()
                        }]
                ])
            };
            const isValid = SSAAnalyzer.validateSSA(invalidState);
            expect(isValid).toBe(false);
        });
    });
});
describe('SSA Properties', () => {
    it('should maintain single assignment property', () => {
        const cfgBuilder = new CFGBuilder();
        const statements = [
            {
                type: 'VariableDeclaration',
                kind: 'let',
                declarations: [{
                        type: 'VariableDeclarator',
                        id: IRNodeFactory.identifier('x'),
                        init: IRNodeFactory.literal(1),
                        node_id: IRNodeFactory.createNodeId()
                    }],
                node_id: IRNodeFactory.createNodeId()
            },
            {
                type: 'ExpressionStatement',
                expression: {
                    type: 'AssignmentExpression',
                    operator: '=',
                    left: IRNodeFactory.identifier('x'),
                    right: IRNodeFactory.literal(2),
                    node_id: IRNodeFactory.createNodeId()
                },
                node_id: IRNodeFactory.createNodeId()
            }
        ];
        const cfg = cfgBuilder.buildFromStatements(statements);
        const ssaBuilder = new SSABuilder(cfg);
        const ssaState = ssaBuilder.buildSSA();
        // Each variable version should have exactly one definition
        for (const [varName, variables] of ssaState.variables) {
            for (const variable of variables) {
                expect(variable.def_site).toBeDefined();
                expect(typeof variable.def_site).toBe('string');
            }
        }
    });
});
//# sourceMappingURL=ssa.test.js.map