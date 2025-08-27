/**
 * @fileoverview Performance benchmarks for IR system components
 * Tests with large inputs to validate scalability and performance characteristics
 */
import type { IRStatement } from '../../src/ir/nodes.js';
interface BenchmarkResult {
    readonly name: string;
    readonly inputSize: number;
    readonly duration: number;
    readonly memoryUsed: number;
    readonly operationsPerSecond: number;
}
interface BenchmarkSuite {
    readonly name: string;
    readonly results: readonly BenchmarkResult[];
    readonly totalDuration: number;
}
/**
 * Utility class for generating large IR programs for benchmarking
 */
declare class IRBenchmarkGenerator {
    private nodeIdCounter;
    private createNodeId;
    /**
     * Generate a linear sequence of variable assignments
     */
    generateLinearProgram(size: number): IRStatement[];
    /**
     * Generate a nested control flow structure with many branches
     */
    generateNestedControlFlow(depth: number, branchingFactor: number): IRStatement[];
    /**
     * Generate nested loops for performance testing
     */
    generateNestedLoops(loopCount: number, bodySize: number): IRStatement[];
    /**
     * Generate a program with many variables and complex data flow
     */
    generateComplexDataFlow(variableCount: number, assignmentCount: number): IRStatement[];
}
/**
 * Benchmark runner with memory and performance monitoring
 */
declare class BenchmarkRunner {
    private generator;
    private results;
    /**
     * Run a single benchmark with memory monitoring
     */
    private runBenchmark;
    /**
     * Benchmark CFG construction performance
     */
    benchmarkCFG(): Promise<BenchmarkSuite>;
    /**
     * Benchmark SSA construction performance
     */
    benchmarkSSA(): Promise<BenchmarkSuite>;
    /**
     * Benchmark analysis passes performance
     */
    benchmarkPasses(): Promise<BenchmarkSuite>;
    /**
     * Benchmark IR printer performance
     */
    benchmarkPrinter(): Promise<BenchmarkSuite>;
    /**
     * Run all benchmarks and generate report
     */
    runAllBenchmarks(): Promise<BenchmarkSuite[]>;
    /**
     * Generate performance report
     */
    generateReport(): string;
    /**
     * Validate performance against targets
     */
    validatePerformance(): {
        passed: boolean;
        issues: string[];
    };
}
export { BenchmarkRunner, IRBenchmarkGenerator };
export type { BenchmarkResult, BenchmarkSuite };
//# sourceMappingURL=benchmark.d.ts.map