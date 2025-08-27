#!/usr/bin/env node
/**
 * @fileoverview Differential test runner for Phase 5 integration
 * 
 * Comprehensive test runner that validates bytecode lifting functionality,
 * VM devirtualization, and contract compliance across all supported formats.
 */

import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { performance } from 'perf_hooks';

import { DifferentialTestFramework } from './framework.js';
import type { DifferentialTestCase, DifferentialTestSuite } from './framework.js';
import { lifterFactory } from '../../src/lifters/index.js';
import { contractValidator } from '../../contracts/validator.js';

/**
 * Test configuration
 */
interface TestRunConfiguration {
  readonly configFile: string;
  readonly outputDir: string;
  readonly updateGolden: boolean;
  readonly verbose: boolean;
  readonly filterTags: readonly string[];
  readonly enableV8: boolean;
  readonly parallelExecution: boolean;
  readonly maxConcurrency: number;
}

/**
 * Test execution statistics
 */
interface TestStatistics {
  readonly totalTests: number;
  readonly passed: number;
  readonly failed: number;
  readonly regressions: number;
  readonly vmDevirtualizationTests: number;
  readonly vmDevirtualizationSuccesses: number;
  readonly contractValidationTests: number;
  readonly contractValidationSuccesses: number;
  readonly executionTimeMs: number;
  readonly averageTestTimeMs: number;
  readonly peakMemoryUsageMB: number;
}

/**
 * Main test runner class
 */
class Phase5TestRunner {
  private config: TestRunConfiguration;
  private framework: DifferentialTestFramework;
  private startTime: number = 0;
  private peakMemoryUsage: number = 0;

  constructor(config: TestRunConfiguration) {
    this.config = config;
    this.framework = new DifferentialTestFramework(
      join(this.config.outputDir, 'golden')
    );
  }

  /**
   * Run all differential tests
   */
  async run(): Promise<TestStatistics> {
    console.log('🚀 Starting ArachneJS Phase 5 Differential Testing');
    console.log(`Configuration: ${this.config.configFile}`);
    
    this.startTime = performance.now();
    
    try {
      // Load test configuration
      const testCases = await this.loadTestCases();
      console.log(`📋 Loaded ${testCases.length} test cases`);

      // Filter test cases by tags
      const filteredTests = this.filterTestCases(testCases);
      console.log(`🔍 Running ${filteredTests.length} tests (filtered by tags: [${this.config.filterTags.join(', ')}])`);

      // Check environment setup
      await this.validateEnvironment();

      // Run contract validation tests
      const contractResults = await this.runContractTests();
      console.log(`📄 Contract validation: ${contractResults.passed}/${contractResults.total} passed`);

      // Run differential tests
      const testResults = await this.runDifferentialTests(filteredTests);
      console.log(`🧪 Differential tests: ${testResults.passed}/${testResults.totalTests} passed`);

      // Generate statistics
      const statistics = this.generateStatistics(testResults, contractResults);

      // Generate reports
      await this.generateReports(testResults, contractResults, statistics);

      // Print summary
      this.printSummary(statistics);

      return statistics;

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    }
  }

  /**
   * Load test cases from configuration
   */
  private async loadTestCases(): Promise<DifferentialTestCase[]> {
    try {
      const configPath = resolve(this.config.configFile);
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      return config.testCases.map((testCase: any) => ({
        ...testCase,
        bytecodeFile: resolve(join(configPath, '..', testCase.bytecodeFile)),
      }));

    } catch (error) {
      throw new Error(`Failed to load test configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Filter test cases by tags
   */
  private filterTestCases(testCases: DifferentialTestCase[]): DifferentialTestCase[] {
    if (this.config.filterTags.length === 0) {
      return testCases;
    }

    return testCases.filter(testCase => 
      this.config.filterTags.some(tag => testCase.tags.includes(tag))
    );
  }

  /**
   * Validate test environment
   */
  private async validateEnvironment(): Promise<void> {
    console.log('🔧 Validating test environment...');

    // Check lifter availability
    const supportedFormats = lifterFactory.getSupportedFormats();
    console.log(`   Supported formats: ${supportedFormats.join(', ')}`);

    // Check V8 availability if needed
    if (this.config.enableV8) {
      const v8Lifter = await lifterFactory.createLifter('v8-ignition' as any);
      if (v8Lifter) {
        console.log('   ✅ V8 lifter enabled and available');
      } else {
        console.warn('   ⚠️  V8 lifter requested but not available');
      }
    }

    // Check output directory
    await fs.mkdir(this.config.outputDir, { recursive: true });
    console.log(`   Output directory: ${this.config.outputDir}`);

    console.log('✅ Environment validation complete');
  }

  /**
   * Run contract validation tests
   */
  private async runContractTests(): Promise<{ passed: number; total: number; results: any[] }> {
    console.log('📄 Running contract validation tests...');

    const results = [];
    let passed = 0;

    // Test QuickJS lifter contract
    try {
      const quickJSLifter = await lifterFactory.createLifter('quickjs' as any);
      if (quickJSLifter) {
        const validation = contractValidator.validateLifter(quickJSLifter);
        results.push({
          name: 'QuickJS Lifter Contract',
          result: validation,
        });
        
        if (validation.valid) {
          passed++;
        }
      }
    } catch (error) {
      results.push({
        name: 'QuickJS Lifter Contract',
        result: { valid: false, error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    // Test V8 lifter contract (if enabled)
    if (this.config.enableV8) {
      try {
        const v8Lifter = await lifterFactory.createLifter('v8-ignition' as any);
        if (v8Lifter) {
          const validation = contractValidator.validateLifter(v8Lifter);
          results.push({
            name: 'V8 Lifter Contract',
            result: validation,
          });
          
          if (validation.valid) {
            passed++;
          }
        }
      } catch (error) {
        results.push({
          name: 'V8 Lifter Contract', 
          result: { valid: false, error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }
    }

    return { passed, total: results.length, results };
  }

  /**
   * Run differential tests
   */
  private async runDifferentialTests(testCases: DifferentialTestCase[]): Promise<DifferentialTestSuite> {
    console.log('🧪 Running differential tests...');

    const results = [];
    let passed = 0;
    let failed = 0;
    let regressions = 0;

    for (const testCase of testCases) {
      console.log(`   Running: ${testCase.name}`);
      
      try {
        // Track memory usage
        const initialMemory = process.memoryUsage().heapUsed;

        // Get appropriate lifter
        const lifter = await lifterFactory.createLifter(testCase.expectedFormat as any);
        if (!lifter) {
          console.warn(`   ⚠️  No lifter available for format: ${testCase.expectedFormat}`);
          failed++;
          continue;
        }

        // Run test using framework
        const testResults = await this.framework.runTests([testCase], lifter);
        const result = testResults.results[0];

        results.push(result);

        if (result.success) {
          passed++;
          console.log(`   ✅ ${testCase.name} - PASSED`);
          
          if (result.regressionDetected) {
            regressions++;
            console.warn(`   ⚠️  Performance regression detected`);
          }
        } else {
          failed++;
          console.error(`   ❌ ${testCase.name} - FAILED: ${result.error}`);
        }

        // Track peak memory
        const currentMemory = process.memoryUsage().heapUsed;
        this.peakMemoryUsage = Math.max(this.peakMemoryUsage, currentMemory - initialMemory);

      } catch (error) {
        failed++;
        console.error(`   💥 ${testCase.name} - ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      totalTests: testCases.length,
      passed,
      failed,
      regressions,
      results,
      overallSuccess: failed === 0 && regressions === 0,
    };
  }

  /**
   * Generate test statistics
   */
  private generateStatistics(
    testResults: DifferentialTestSuite,
    contractResults: { passed: number; total: number; results: any[] }
  ): TestStatistics {
    const executionTime = performance.now() - this.startTime;
    
    // Count VM devirtualization tests
    let vmDevirtualizationTests = 0;
    let vmDevirtualizationSuccesses = 0;

    for (const result of testResults.results) {
      if (result.testCase.tags.includes('vm-obfuscation') || 
          result.testCase.tags.includes('devirtualization')) {
        vmDevirtualizationTests++;
        if (result.success) {
          vmDevirtualizationSuccesses++;
        }
      }
    }

    return {
      totalTests: testResults.totalTests,
      passed: testResults.passed,
      failed: testResults.failed,
      regressions: testResults.regressions,
      vmDevirtualizationTests,
      vmDevirtualizationSuccesses,
      contractValidationTests: contractResults.total,
      contractValidationSuccesses: contractResults.passed,
      executionTimeMs: executionTime,
      averageTestTimeMs: testResults.totalTests > 0 ? executionTime / testResults.totalTests : 0,
      peakMemoryUsageMB: this.peakMemoryUsage / 1024 / 1024,
    };
  }

  /**
   * Generate test reports
   */
  private async generateReports(
    testResults: DifferentialTestSuite,
    contractResults: any,
    statistics: TestStatistics
  ): Promise<void> {
    console.log('📊 Generating test reports...');

    // JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      phase: 'Phase 5 - Bytecode Lifting & CI Integration',
      statistics,
      testResults: testResults.results.map(result => ({
        name: result.testCase.name,
        success: result.success,
        error: result.error,
        performance: result.performance,
        goldenMatch: result.goldenMatch,
        semanticEquivalence: result.semanticEquivalence,
        regressionDetected: result.regressionDetected,
      })),
      contractResults: contractResults.results,
    };

    const reportPath = join(this.config.outputDir, 'test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(jsonReport, null, 2));

    // HTML report (simplified)
    const htmlReport = this.generateHtmlReport(jsonReport);
    const htmlPath = join(this.config.outputDir, 'test-report.html');
    await fs.writeFile(htmlPath, htmlReport);

    console.log(`   📄 JSON report: ${reportPath}`);
    console.log(`   🌐 HTML report: ${htmlPath}`);
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(jsonReport: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>ArachneJS Phase 5 Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 5px; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat { background: #f5f5f5; padding: 15px; border-radius: 5px; flex: 1; text-align: center; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .test-pass { background-color: #e8f5e8; }
        .test-fail { background-color: #ffeaea; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ArachneJS Deobfuscator - Phase 5 Test Report</h1>
        <p>Bytecode Lifting & CI Integration</p>
        <p>Generated: ${jsonReport.timestamp}</p>
    </div>

    <div class="stats">
        <div class="stat">
            <h3>Total Tests</h3>
            <div style="font-size: 2em;">${jsonReport.statistics.totalTests}</div>
        </div>
        <div class="stat">
            <h3 class="success">Passed</h3>
            <div style="font-size: 2em; color: #4CAF50;">${jsonReport.statistics.passed}</div>
        </div>
        <div class="stat">
            <h3 class="error">Failed</h3>
            <div style="font-size: 2em; color: #f44336;">${jsonReport.statistics.failed}</div>
        </div>
        <div class="stat">
            <h3 class="warning">Regressions</h3>
            <div style="font-size: 2em; color: #ff9800;">${jsonReport.statistics.regressions}</div>
        </div>
    </div>

    <div class="stats">
        <div class="stat">
            <h3>VM Devirtualization</h3>
            <div>${jsonReport.statistics.vmDevirtualizationSuccesses}/${jsonReport.statistics.vmDevirtualizationTests} 
            (${Math.round(jsonReport.statistics.vmDevirtualizationSuccesses / Math.max(jsonReport.statistics.vmDevirtualizationTests, 1) * 100)}%)</div>
        </div>
        <div class="stat">
            <h3>Contract Validation</h3>
            <div>${jsonReport.statistics.contractValidationSuccesses}/${jsonReport.statistics.contractValidationTests}</div>
        </div>
        <div class="stat">
            <h3>Execution Time</h3>
            <div>${Math.round(jsonReport.statistics.executionTimeMs)}ms</div>
        </div>
        <div class="stat">
            <h3>Peak Memory</h3>
            <div>${Math.round(jsonReport.statistics.peakMemoryUsageMB)}MB</div>
        </div>
    </div>

    <h2>Test Results</h2>
    <table>
        <tr>
            <th>Test Name</th>
            <th>Status</th>
            <th>Parse Time</th>
            <th>Lift Time</th>
            <th>Semantic Equivalence</th>
            <th>Golden Match</th>
        </tr>
        ${jsonReport.testResults.map((result: any) => `
        <tr class="${result.success ? 'test-pass' : 'test-fail'}">
            <td>${result.name}</td>
            <td>${result.success ? '✅ PASS' : '❌ FAIL'}</td>
            <td>${result.performance?.parseTimeMs || 0}ms</td>
            <td>${result.performance?.liftTimeMs || 0}ms</td>
            <td>${Math.round((result.semanticEquivalence || 0) * 100)}%</td>
            <td>${result.goldenMatch ? '✅' : '❌'}</td>
        </tr>
        `).join('')}
    </table>

    <pre style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
${JSON.stringify(jsonReport, null, 2)}
    </pre>
</body>
</html>
    `.trim();
  }

  /**
   * Print test summary
   */
  private printSummary(statistics: TestStatistics): void {
    console.log('\n🎯 TEST EXECUTION SUMMARY');
    console.log('=' .repeat(50));
    console.log(`📊 Total Tests: ${statistics.totalTests}`);
    console.log(`✅ Passed: ${statistics.passed}`);
    console.log(`❌ Failed: ${statistics.failed}`);
    console.log(`⚠️  Regressions: ${statistics.regressions}`);
    console.log('');
    console.log(`🤖 VM Devirtualization: ${statistics.vmDevirtualizationSuccesses}/${statistics.vmDevirtualizationTests} (${Math.round(statistics.vmDevirtualizationSuccesses / Math.max(statistics.vmDevirtualizationTests, 1) * 100)}%)`);
    console.log(`📄 Contract Validation: ${statistics.contractValidationSuccesses}/${statistics.contractValidationTests}`);
    console.log('');
    console.log(`⏱️  Execution Time: ${Math.round(statistics.executionTimeMs)}ms`);
    console.log(`📈 Peak Memory: ${Math.round(statistics.peakMemoryUsageMB)}MB`);
    console.log('');

    // Success criteria check
    const success = statistics.failed === 0 && statistics.regressions === 0;
    const vmSuccess = statistics.vmDevirtualizationTests === 0 || 
      (statistics.vmDevirtualizationSuccesses / statistics.vmDevirtualizationTests) >= 0.6;
    const contractSuccess = statistics.contractValidationSuccesses === statistics.contractValidationTests;

    if (success && vmSuccess && contractSuccess) {
      console.log('🎉 ALL TESTS PASSED - Phase 5 implementation successful!');
    } else {
      console.log('💥 Some tests failed - Phase 5 requires attention');
      if (!vmSuccess) {
        console.log('   🔍 VM devirtualization success rate below 60% threshold');
      }
      if (!contractSuccess) {
        console.log('   📋 Contract validation failures detected');
      }
    }
    console.log('=' .repeat(50));
  }
}

/**
 * Command line interface
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  const config: TestRunConfiguration = {
    configFile: args.find(arg => arg.startsWith('--config='))?.split('=')[1] || './tests/differential/fixtures/sample-test.config.json',
    outputDir: args.find(arg => arg.startsWith('--output='))?.split('=')[1] || './tests/differential/output',
    updateGolden: args.includes('--update-golden'),
    verbose: args.includes('--verbose'),
    filterTags: args.find(arg => arg.startsWith('--tags='))?.split('=')[1]?.split(',') || [],
    enableV8: args.includes('--enable-v8'),
    parallelExecution: args.includes('--parallel'),
    maxConcurrency: parseInt(args.find(arg => arg.startsWith('--concurrency='))?.split('=')[1] || '4'),
  };

  if (args.includes('--help')) {
    console.log(`
ArachneJS Phase 5 Differential Test Runner

Usage: node runner.js [options]

Options:
  --config=<file>     Test configuration file (default: ./tests/differential/fixtures/sample-test.config.json)
  --output=<dir>      Output directory for reports (default: ./tests/differential/output)
  --update-golden     Update golden files with current results
  --verbose           Enable verbose logging
  --tags=<list>       Comma-separated list of tags to filter tests
  --enable-v8         Enable V8 lifter tests (requires --enable-v8 flag)
  --parallel          Enable parallel test execution
  --concurrency=<n>   Maximum concurrent tests (default: 4)
  --help              Show this help message

Examples:
  node runner.js --config=./my-tests.json --verbose
  node runner.js --tags=quickjs,basic --enable-v8
  node runner.js --update-golden --output=./results
    `);
    return;
  }

  try {
    const runner = new Phase5TestRunner(config);
    const statistics = await runner.run();
    
    // Exit with error code if tests failed
    if (statistics.failed > 0 || statistics.regressions > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Test runner failed:', error);
    process.exit(2);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { Phase5TestRunner };