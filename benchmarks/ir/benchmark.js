/**
 * @fileoverview Performance benchmarks for IR system components
 * Tests with large inputs to validate scalability and performance characteristics
 */
import { performance } from 'perf_hooks';
import { CFGBuilder } from '../../src/ir/cfg.ts';
import { SSABuilder, SSADestroyer } from '../../src/ir/ssa.ts';
import { IRNodeFactory } from '../../src/ir/nodes.ts';
import { IRPrinter } from '../../src/ir/printer.ts';
import { ConstantPropagationPass } from '../../src/passes/constprop.ts';
import { DeadCodeEliminationPass } from '../../src/passes/dce.ts';
import { CopyPropagationPass } from '../../src/passes/copyprop.ts';
/**
 * Utility class for generating large IR programs for benchmarking
 */
class IRBenchmarkGenerator {
    nodeIdCounter = 0;
    createNodeId() {
        return `benchmark_node_${++this.nodeIdCounter}`;
    }
    /**
     * Generate a linear sequence of variable assignments
     */
    generateLinearProgram(size) {
        const statements = [];
        for (let i = 0; i < size; i++) {
            statements.push({
                type: 'VariableDeclaration',
                kind: 'let',
                declarations: [{
                        type: 'VariableDeclarator',
                        id: IRNodeFactory.identifier(`var_${i}`),
                        init: IRNodeFactory.literal(i),
                        node_id: this.createNodeId()
                    }],
                node_id: this.createNodeId()
            });
            // Add some assignments to create use-def relationships
            if (i > 0) {
                statements.push({
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'AssignmentExpression',
                        operator: '=',
                        left: IRNodeFactory.identifier(`var_${i}`),
                        right: IRNodeFactory.identifier(`var_${i - 1}`),
                        node_id: this.createNodeId()
                    },
                    node_id: this.createNodeId()
                });
            }
        }
        return statements;
    }
    /**
     * Generate a nested control flow structure with many branches
     */
    generateNestedControlFlow(depth, branchingFactor) {
        const statements = [];
        const createNestedIf = (currentDepth) => {
            if (currentDepth === 0) {
                return {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'AssignmentExpression',
                        operator: '=',
                        left: IRNodeFactory.identifier(`leaf_${this.nodeIdCounter}`),
                        right: IRNodeFactory.literal(currentDepth),
                        node_id: this.createNodeId()
                    },
                    node_id: this.createNodeId()
                };
            }
            const consequentStatements = [];
            const alternateStatements = [];
            for (let i = 0; i < branchingFactor; i++) {
                consequentStatements.push(createNestedIf(currentDepth - 1));
                alternateStatements.push(createNestedIf(currentDepth - 1));
            }
            return {
                type: 'IfStatement',
                test: IRNodeFactory.identifier(`condition_${currentDepth}`),
                consequent: {
                    type: 'BlockStatement',
                    body: consequentStatements,
                    node_id: this.createNodeId()
                },
                alternate: {
                    type: 'BlockStatement',
                    body: alternateStatements,
                    node_id: this.createNodeId()
                },
                node_id: this.createNodeId()
            };
        };
        statements.push(createNestedIf(depth));
        return statements;
    }
    /**
     * Generate nested loops for performance testing
     */
    generateNestedLoops(loopCount, bodySize) {
        const statements = [];
        const createNestedLoop = (remaining) => {
            const loopBody = [];
            if (remaining > 1) {
                loopBody.push(createNestedLoop(remaining - 1));
            }
            else {
                // Add body statements
                for (let i = 0; i < bodySize; i++) {
                    loopBody.push({
                        type: 'ExpressionStatement',
                        expression: {
                            type: 'AssignmentExpression',
                            operator: '=',
                            left: IRNodeFactory.identifier(`loop_var_${i}`),
                            right: {
                                type: 'BinaryExpression',
                                operator: '+',
                                left: IRNodeFactory.identifier(`loop_var_${i}`),
                                right: IRNodeFactory.literal(1),
                                node_id: this.createNodeId()
                            },
                            node_id: this.createNodeId()
                        },
                        node_id: this.createNodeId()
                    });
                }
            }
            return {
                type: 'WhileStatement',
                test: IRNodeFactory.identifier(`condition_${remaining}`),
                body: {
                    type: 'BlockStatement',
                    body: loopBody,
                    node_id: this.createNodeId()
                },
                node_id: this.createNodeId()
            };
        };
        statements.push(createNestedLoop(loopCount));
        return statements;
    }
    /**
     * Generate a program with many variables and complex data flow
     */
    generateComplexDataFlow(variableCount, assignmentCount) {
        const statements = [];
        // Declare variables
        for (let i = 0; i < variableCount; i++) {
            statements.push({
                type: 'VariableDeclaration',
                kind: 'let',
                declarations: [{
                        type: 'VariableDeclarator',
                        id: IRNodeFactory.identifier(`flow_var_${i}`),
                        init: IRNodeFactory.literal(i),
                        node_id: this.createNodeId()
                    }],
                node_id: this.createNodeId()
            });
        }
        // Create complex assignment patterns
        for (let i = 0; i < assignmentCount; i++) {
            const sourceVar = Math.floor(Math.random() * variableCount);
            const targetVar = Math.floor(Math.random() * variableCount);
            if (sourceVar !== targetVar) {
                statements.push({
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'AssignmentExpression',
                        operator: '=',
                        left: IRNodeFactory.identifier(`flow_var_${targetVar}`),
                        right: {
                            type: 'BinaryExpression',
                            operator: '+',
                            left: IRNodeFactory.identifier(`flow_var_${sourceVar}`),
                            right: IRNodeFactory.literal(i),
                            node_id: this.createNodeId()
                        },
                        node_id: this.createNodeId()
                    },
                    node_id: this.createNodeId()
                });
            }
        }
        return statements;
    }
}
/**
 * Benchmark runner with memory and performance monitoring
 */
class BenchmarkRunner {
    generator = new IRBenchmarkGenerator();
    results = [];
    /**
     * Run a single benchmark with memory monitoring
     */
    async runBenchmark(name, inputSize, operation) {
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        const memoryBefore = process.memoryUsage().heapUsed;
        const startTime = performance.now();
        operation();
        const endTime = performance.now();
        const memoryAfter = process.memoryUsage().heapUsed;
        const duration = endTime - startTime;
        const memoryUsed = Math.max(0, memoryAfter - memoryBefore);
        const operationsPerSecond = (inputSize / duration) * 1000;
        return {
            name,
            inputSize,
            duration,
            memoryUsed,
            operationsPerSecond
        };
    }
    /**
     * Benchmark CFG construction performance
     */
    async benchmarkCFG() {
        const results = [];
        const cfgBuilder = new CFGBuilder();
        const testSizes = [100, 500, 1000, 2000, 5000];
        for (const size of testSizes) {
            // Linear program
            const linearProgram = this.generator.generateLinearProgram(size);
            results.push(await this.runBenchmark(`CFG Linear (${size} statements)`, size, () => cfgBuilder.buildFromStatements(linearProgram)));
            // Nested control flow
            const nestedProgram = this.generator.generateNestedControlFlow(Math.ceil(Math.log2(size)), Math.min(4, Math.ceil(size / 50)));
            results.push(await this.runBenchmark(`CFG Nested (depth ${Math.ceil(Math.log2(size))})`, nestedProgram.length, () => cfgBuilder.buildFromStatements(nestedProgram)));
        }
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        return {
            name: 'Control Flow Graph Construction',
            results,
            totalDuration
        };
    }
    /**
     * Benchmark SSA construction performance
     */
    async benchmarkSSA() {
        const results = [];
        const cfgBuilder = new CFGBuilder();
        const testSizes = [100, 500, 1000, 2000];
        for (const size of testSizes) {
            // Test with complex data flow
            const dataFlowProgram = this.generator.generateComplexDataFlow(Math.ceil(size / 10), size);
            const cfg = cfgBuilder.buildFromStatements(dataFlowProgram);
            results.push(await this.runBenchmark(`SSA Construction (${size} assignments)`, size, () => {
                const ssaBuilder = new SSABuilder(cfg);
                ssaBuilder.buildSSA();
            }));
            // Test SSA destruction
            const ssaBuilder = new SSABuilder(cfg);
            const ssaState = ssaBuilder.buildSSA();
            results.push(await this.runBenchmark(`SSA Destruction (${size} assignments)`, size, () => {
                const destroyer = new SSADestroyer(ssaState);
                destroyer.destroySSA();
            }));
        }
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        return {
            name: 'SSA Form Construction and Destruction',
            results,
            totalDuration
        };
    }
    /**
     * Benchmark analysis passes performance
     */
    async benchmarkPasses() {
        const results = [];
        const cfgBuilder = new CFGBuilder();
        const testSizes = [100, 500, 1000, 2000];
        for (const size of testSizes) {
            const program = this.generator.generateComplexDataFlow(Math.ceil(size / 10), size);
            const cfg = cfgBuilder.buildFromStatements(program);
            const ssaBuilder = new SSABuilder(cfg);
            const ssaState = ssaBuilder.buildSSA();
            // Constant Propagation
            results.push(await this.runBenchmark(`Constant Propagation (${size} assignments)`, size, () => {
                const constProp = new ConstantPropagationPass();
                constProp.run(ssaState);
            }));
            // Dead Code Elimination
            results.push(await this.runBenchmark(`Dead Code Elimination (${size} assignments)`, size, () => {
                const dce = new DeadCodeEliminationPass();
                dce.run(ssaState);
            }));
            // Copy Propagation
            results.push(await this.runBenchmark(`Copy Propagation (${size} assignments)`, size, () => {
                const copyProp = new CopyPropagationPass();
                copyProp.run(ssaState);
            }));
        }
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        return {
            name: 'Analysis Passes',
            results,
            totalDuration
        };
    }
    /**
     * Benchmark IR printer performance
     */
    async benchmarkPrinter() {
        const results = [];
        const cfgBuilder = new CFGBuilder();
        const printer = new IRPrinter({
            indent: '  ',
            generateSourceMap: false,
            minify: false
        });
        const testSizes = [100, 500, 1000, 2000, 5000];
        for (const size of testSizes) {
            const program = this.generator.generateLinearProgram(size);
            const cfg = cfgBuilder.buildFromStatements(program);
            results.push(await this.runBenchmark(`IR Printer (${size} statements)`, size, () => {
                for (const node of cfg.nodes.values()) {
                    for (const stmt of node.instructions) {
                        printer.print(stmt);
                    }
                }
            }));
            // Test with source map generation
            const printerWithSourceMap = new IRPrinter({
                indent: '  ',
                generateSourceMap: true,
                minify: false
            });
            results.push(await this.runBenchmark(`IR Printer with SourceMap (${size} statements)`, size, () => {
                for (const node of cfg.nodes.values()) {
                    for (const stmt of node.instructions) {
                        printerWithSourceMap.print(stmt);
                    }
                }
            }));
        }
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        return {
            name: 'IR Printer',
            results,
            totalDuration
        };
    }
    /**
     * Run all benchmarks and generate report
     */
    async runAllBenchmarks() {
        console.log('🚀 Starting IR System Performance Benchmarks...\n');
        const suites = [
            await this.benchmarkCFG(),
            await this.benchmarkSSA(),
            await this.benchmarkPasses(),
            await this.benchmarkPrinter()
        ];
        this.results = suites;
        return suites;
    }
    /**
     * Generate performance report
     */
    generateReport() {
        let report = '# IR System Performance Benchmark Report\n\n';
        const totalDuration = this.results.reduce((sum, suite) => sum + suite.totalDuration, 0);
        report += `**Total Benchmark Duration:** ${totalDuration.toFixed(2)}ms\n\n`;
        for (const suite of this.results) {
            report += `## ${suite.name}\n\n`;
            report += `**Suite Duration:** ${suite.totalDuration.toFixed(2)}ms\n\n`;
            report += '| Benchmark | Input Size | Duration (ms) | Memory (KB) | Ops/sec |\n';
            report += '|-----------|------------|---------------|-------------|----------|\n';
            for (const result of suite.results) {
                const memoryKB = (result.memoryUsed / 1024).toFixed(1);
                const opsPerSec = result.operationsPerSecond.toFixed(0);
                report += `| ${result.name} | ${result.inputSize} | ${result.duration.toFixed(2)} | ${memoryKB} | ${opsPerSec} |\n`;
            }
            report += '\n';
            // Performance analysis
            report += '### Performance Analysis\n\n';
            const avgDuration = suite.results.reduce((sum, r) => sum + r.duration, 0) / suite.results.length;
            const avgMemory = suite.results.reduce((sum, r) => sum + r.memoryUsed, 0) / suite.results.length;
            const avgOpsPerSec = suite.results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / suite.results.length;
            report += `- **Average Duration:** ${avgDuration.toFixed(2)}ms\n`;
            report += `- **Average Memory Usage:** ${(avgMemory / 1024).toFixed(1)}KB\n`;
            report += `- **Average Operations/sec:** ${avgOpsPerSec.toFixed(0)}\n\n`;
            // Scalability analysis
            const linearResults = suite.results.filter(r => r.name.includes('Linear') || r.name.includes('statements'));
            if (linearResults.length >= 2) {
                const firstResult = linearResults[0];
                const lastResult = linearResults[linearResults.length - 1];
                const sizeRatio = lastResult.inputSize / firstResult.inputSize;
                const timeRatio = lastResult.duration / firstResult.duration;
                const scalabilityFactor = timeRatio / sizeRatio;
                report += `**Scalability Factor:** ${scalabilityFactor.toFixed(2)} (1.0 = linear scaling)\n`;
                if (scalabilityFactor < 1.5) {
                    report += '✅ **Excellent scalability** - sub-linear performance\n';
                }
                else if (scalabilityFactor < 2.0) {
                    report += '✅ **Good scalability** - near-linear performance\n';
                }
                else if (scalabilityFactor < 3.0) {
                    report += '⚠️ **Acceptable scalability** - slightly super-linear\n';
                }
                else {
                    report += '❌ **Poor scalability** - significant performance degradation\n';
                }
            }
            report += '\n';
        }
        // Overall assessment
        report += '## Overall Assessment\n\n';
        const totalMemory = this.results.reduce((sum, suite) => sum + suite.results.reduce((suiteSum, r) => suiteSum + r.memoryUsed, 0), 0);
        report += `- **Total Memory Usage:** ${(totalMemory / 1024 / 1024).toFixed(1)}MB across all benchmarks\n`;
        const slowestBenchmark = this.results
            .flatMap(suite => suite.results)
            .reduce((slowest, current) => current.duration > slowest.duration ? current : slowest);
        const fastestBenchmark = this.results
            .flatMap(suite => suite.results)
            .reduce((fastest, current) => current.operationsPerSecond > fastest.operationsPerSecond ? current : fastest);
        report += `- **Slowest Operation:** ${slowestBenchmark.name} (${slowestBenchmark.duration.toFixed(2)}ms)\n`;
        report += `- **Fastest Operation:** ${fastestBenchmark.name} (${fastestBenchmark.operationsPerSecond.toFixed(0)} ops/sec)\n\n`;
        // Performance targets
        report += '## Performance Targets Assessment\n\n';
        const cfgResults = this.results.find(s => s.name.includes('Control Flow'))?.results || [];
        const largestCFG = cfgResults.reduce((largest, current) => current.inputSize > largest.inputSize ? current : largest, cfgResults[0] || { inputSize: 0, duration: Infinity });
        if (largestCFG.inputSize >= 1000 && largestCFG.duration < 1000) {
            report += '✅ **CFG Construction:** Can handle 1000+ statements in <1s\n';
        }
        else {
            report += '❌ **CFG Construction:** Performance target not met\n';
        }
        const ssaResults = this.results.find(s => s.name.includes('SSA'))?.results || [];
        const largestSSA = ssaResults.reduce((largest, current) => current.inputSize > largest.inputSize ? current : largest, ssaResults[0] || { inputSize: 0, duration: Infinity });
        if (largestSSA.inputSize >= 1000 && largestSSA.duration < 2000) {
            report += '✅ **SSA Construction:** Can handle 1000+ assignments in <2s\n';
        }
        else {
            report += '❌ **SSA Construction:** Performance target not met\n';
        }
        report += '\n---\n\n';
        report += `*Generated on ${new Date().toISOString()}*\n`;
        return report;
    }
    /**
     * Validate performance against targets
     */
    validatePerformance() {
        const issues = [];
        // Check for performance regressions
        const allResults = this.results.flatMap(suite => suite.results);
        // Memory usage should be reasonable (< 100MB total)
        const totalMemory = allResults.reduce((sum, r) => sum + r.memoryUsed, 0);
        if (totalMemory > 100 * 1024 * 1024) {
            issues.push(`High memory usage: ${(totalMemory / 1024 / 1024).toFixed(1)}MB`);
        }
        // No single operation should take more than 10 seconds
        const slowOperations = allResults.filter(r => r.duration > 10000);
        if (slowOperations.length > 0) {
            issues.push(`Slow operations detected: ${slowOperations.map(r => r.name).join(', ')}`);
        }
        // Operations per second should be reasonable for largest inputs
        const largeInputResults = allResults.filter(r => r.inputSize >= 1000);
        const slowOpsPerSec = largeInputResults.filter(r => r.operationsPerSecond < 100);
        if (slowOpsPerSec.length > 0) {
            issues.push(`Low throughput for large inputs: ${slowOpsPerSec.map(r => r.name).join(', ')}`);
        }
        return {
            passed: issues.length === 0,
            issues
        };
    }
}
// Export for use in tests and CLI
export { BenchmarkRunner, IRBenchmarkGenerator };
// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
    async function main() {
        const runner = new BenchmarkRunner();
        try {
            await runner.runAllBenchmarks();
            const report = runner.generateReport();
            const validation = runner.validatePerformance();
            console.log(report);
            if (validation.passed) {
                console.log('✅ All performance targets met!');
                process.exit(0);
            }
            else {
                console.log('❌ Performance issues detected:');
                validation.issues.forEach(issue => console.log(`  - ${issue}`));
                process.exit(1);
            }
        }
        catch (error) {
            console.error('❌ Benchmark failed:', error);
            process.exit(1);
        }
    }
    main().catch(console.error);
}
//# sourceMappingURL=benchmark.js.map