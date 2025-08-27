/**
 * @fileoverview Tests for the IR benchmark system
 */

import { describe, it, expect } from 'vitest';
import { BenchmarkRunner, IRBenchmarkGenerator } from '../../benchmarks/ir/benchmark.js';

describe('IRBenchmarkGenerator', () => {
  let generator: IRBenchmarkGenerator;

  beforeEach(() => {
    generator = new IRBenchmarkGenerator();
  });

  describe('generateLinearProgram', () => {
    it('should generate correct number of statements', () => {
      const program = generator.generateLinearProgram(10);
      
      // Each iteration creates a declaration and an assignment (except first)
      // So for 10 iterations: 10 declarations + 9 assignments = 19 statements
      expect(program).toHaveLength(19);
    });

    it('should create valid IR statements', () => {
      const program = generator.generateLinearProgram(5);
      
      // Check first statement is a variable declaration
      expect(program[0]?.type).toBe('VariableDeclaration');
      expect(program[0]?.kind).toBe('let');
      
      // Check second statement is an assignment
      if (program.length > 1) {
        expect(program[2]?.type).toBe('ExpressionStatement');
        expect(program[2]?.expression?.type).toBe('AssignmentExpression');
      }
    });
  });

  describe('generateNestedControlFlow', () => {
    it('should generate nested if statements', () => {
      const program = generator.generateNestedControlFlow(2, 2);
      
      expect(program).toHaveLength(1);
      expect(program[0]?.type).toBe('IfStatement');
    });

    it('should handle depth 0', () => {
      const program = generator.generateNestedControlFlow(0, 2);
      
      expect(program).toHaveLength(1);
      expect(program[0]?.type).toBe('ExpressionStatement');
    });
  });

  describe('generateNestedLoops', () => {
    it('should generate nested while loops', () => {
      const program = generator.generateNestedLoops(2, 3);
      
      expect(program).toHaveLength(1);
      expect(program[0]?.type).toBe('WhileStatement');
    });
  });

  describe('generateComplexDataFlow', () => {
    it('should generate correct number of declarations and assignments', () => {
      const variableCount = 5;
      const assignmentCount = 10;
      const program = generator.generateComplexDataFlow(variableCount, assignmentCount);
      
      // Should have at least the variable declarations
      expect(program.length).toBeGreaterThanOrEqual(variableCount);
      
      // Check that first statements are variable declarations
      for (let i = 0; i < variableCount; i++) {
        expect(program[i]?.type).toBe('VariableDeclaration');
      }
    });

    it('should create valid variable names', () => {
      const program = generator.generateComplexDataFlow(3, 5);
      
      const firstDecl = program[0] as any;
      expect(firstDecl.declarations[0].id.name).toBe('flow_var_0');
    });
  });
});

describe('BenchmarkRunner', () => {
  let runner: BenchmarkRunner;

  beforeEach(() => {
    runner = new BenchmarkRunner();
  });

  describe('benchmarkCFG', () => {
    it('should run CFG benchmarks without errors', async () => {
      const suite = await runner.benchmarkCFG();
      
      expect(suite.name).toBe('Control Flow Graph Construction');
      expect(suite.results.length).toBeGreaterThan(0);
      expect(suite.totalDuration).toBeGreaterThan(0);
      
      // Check that all results have required properties
      for (const result of suite.results) {
        expect(result.name).toBeDefined();
        expect(result.inputSize).toBeGreaterThan(0);
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(result.memoryUsed).toBeGreaterThanOrEqual(0);
        expect(result.operationsPerSecond).toBeGreaterThan(0);
      }
    });

    it('should show increasing input sizes', async () => {
      const suite = await runner.benchmarkCFG();
      
      const linearResults = suite.results.filter(r => r.name.includes('Linear'));
      expect(linearResults.length).toBeGreaterThan(1);
      
      // Input sizes should be increasing
      for (let i = 1; i < linearResults.length; i++) {
        expect(linearResults[i]!.inputSize).toBeGreaterThan(linearResults[i-1]!.inputSize);
      }
    });
  });

  describe('benchmarkSSA', () => {
    it('should run SSA benchmarks without errors', async () => {
      const suite = await runner.benchmarkSSA();
      
      expect(suite.name).toBe('SSA Form Construction and Destruction');
      expect(suite.results.length).toBeGreaterThan(0);
      expect(suite.totalDuration).toBeGreaterThan(0);
      
      // Should have both construction and destruction benchmarks
      const constructionResults = suite.results.filter(r => r.name.includes('Construction'));
      const destructionResults = suite.results.filter(r => r.name.includes('Destruction'));
      
      expect(constructionResults.length).toBeGreaterThan(0);
      expect(destructionResults.length).toBeGreaterThan(0);
    });
  });

  describe('benchmarkPasses', () => {
    it('should run analysis passes benchmarks without errors', async () => {
      const suite = await runner.benchmarkPasses();
      
      expect(suite.name).toBe('Analysis Passes');
      expect(suite.results.length).toBeGreaterThan(0);
      
      // Should have benchmarks for all three passes
      const constPropResults = suite.results.filter(r => r.name.includes('Constant Propagation'));
      const dceResults = suite.results.filter(r => r.name.includes('Dead Code'));
      const copyPropResults = suite.results.filter(r => r.name.includes('Copy Propagation'));
      
      expect(constPropResults.length).toBeGreaterThan(0);
      expect(dceResults.length).toBeGreaterThan(0);
      expect(copyPropResults.length).toBeGreaterThan(0);
    });
  });

  describe('benchmarkPrinter', () => {
    it('should run printer benchmarks without errors', async () => {
      const suite = await runner.benchmarkPrinter();
      
      expect(suite.name).toBe('IR Printer');
      expect(suite.results.length).toBeGreaterThan(0);
      
      // Should have both regular and sourcemap benchmarks
      const regularResults = suite.results.filter(r => !r.name.includes('SourceMap'));
      const sourcemapResults = suite.results.filter(r => r.name.includes('SourceMap'));
      
      expect(regularResults.length).toBeGreaterThan(0);
      expect(sourcemapResults.length).toBeGreaterThan(0);
    });
  });

  describe('generateReport', () => {
    it('should generate a valid markdown report', async () => {
      // Run a minimal benchmark set
      const runner = new BenchmarkRunner();
      await runner.benchmarkCFG();
      
      const report = runner.generateReport();
      
      expect(report).toContain('# IR System Performance Benchmark Report');
      expect(report).toContain('Control Flow Graph Construction');
      expect(report).toContain('| Benchmark | Input Size | Duration (ms) | Memory (KB) | Ops/sec |');
      expect(report).toContain('## Overall Assessment');
    });
  });

  describe('validatePerformance', () => {
    it('should validate performance metrics', async () => {
      const runner = new BenchmarkRunner();
      await runner.benchmarkCFG();
      
      const validation = runner.validatePerformance();
      
      expect(validation.passed).toBeDefined();
      expect(Array.isArray(validation.issues)).toBe(true);
    });

    it('should detect performance issues', async () => {
      const runner = new BenchmarkRunner();
      
      // Create a mock result with poor performance
      (runner as any).results = [{
        name: 'Test Suite',
        results: [{
          name: 'Slow Operation',
          inputSize: 1000,
          duration: 15000, // 15 seconds - should trigger slow operation warning
          memoryUsed: 200 * 1024 * 1024, // 200MB - should trigger high memory warning
          operationsPerSecond: 50 // Low ops/sec for large input
        }],
        totalDuration: 15000
      }];
      
      const validation = runner.validatePerformance();
      
      expect(validation.passed).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });
});

describe('Integration Tests', () => {
  it('should run a complete benchmark suite', async () => {
    const runner = new BenchmarkRunner();
    
    // Run all benchmarks (but with shorter test to avoid long test times)
    const suites = await runner.runAllBenchmarks();
    
    expect(suites.length).toBe(4); // CFG, SSA, Passes, Printer
    
    // Verify each suite has results
    for (const suite of suites) {
      expect(suite.results.length).toBeGreaterThan(0);
      expect(suite.totalDuration).toBeGreaterThan(0);
    }
    
    // Generate and validate report
    const report = runner.generateReport();
    expect(report).toContain('# IR System Performance Benchmark Report');
    
    const validation = runner.validatePerformance();
    expect(typeof validation.passed).toBe('boolean');
  });
});