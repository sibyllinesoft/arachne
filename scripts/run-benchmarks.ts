#!/usr/bin/env bun
/**
 * @fileoverview CLI script to run IR system performance benchmarks
 */

import { BenchmarkRunner } from '../benchmarks/ir/benchmark.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface CLIOptions {
  readonly output?: string;
  readonly format: 'console' | 'markdown' | 'json';
  readonly suites: string[];
  readonly verbose: boolean;
}

function parseArgs(args: string[]): CLIOptions {
  const options: Partial<CLIOptions> = {
    format: 'console',
    suites: ['all'],
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      const format = args[++i];
      if (format === 'console' || format === 'markdown' || format === 'json') {
        options.format = format;
      } else {
        console.error(`Invalid format: ${format}. Use 'console', 'markdown', or 'json'.`);
        process.exit(1);
      }
    } else if (arg === '--suites' || arg === '-s') {
      options.suites = args[++i]?.split(',') || ['all'];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options as CLIOptions;
}

function printHelp(): void {
  console.log(`
ArachneJS IR System Benchmark Runner

Usage: bun run scripts/run-benchmarks.ts [options]

Options:
  -o, --output <file>     Save results to file
  -f, --format <format>   Output format: console, markdown, json (default: console)
  -s, --suites <suites>   Comma-separated list of suites to run: cfg,ssa,passes,printer (default: all)
  -v, --verbose           Enable verbose output
  -h, --help              Show this help message

Examples:
  bun run scripts/run-benchmarks.ts
  bun run scripts/run-benchmarks.ts --format markdown --output benchmark-report.md
  bun run scripts/run-benchmarks.ts --suites cfg,ssa --verbose
  bun run scripts/run-benchmarks.ts --format json --output results.json
`);
}

async function runSelectedSuites(runner: BenchmarkRunner, suites: string[]) {
  const results = [];

  if (suites.includes('all') || suites.includes('cfg')) {
    console.log('⚡ Running CFG benchmarks...');
    results.push(await runner.benchmarkCFG());
  }

  if (suites.includes('all') || suites.includes('ssa')) {
    console.log('⚡ Running SSA benchmarks...');
    results.push(await runner.benchmarkSSA());
  }

  if (suites.includes('all') || suites.includes('passes')) {
    console.log('⚡ Running analysis passes benchmarks...');
    results.push(await runner.benchmarkPasses());
  }

  if (suites.includes('all') || suites.includes('printer')) {
    console.log('⚡ Running printer benchmarks...');
    results.push(await runner.benchmarkPrinter());
  }

  return results;
}

function formatResults(results: any[], format: string, verbose: boolean): string {
  const runner = new BenchmarkRunner();
  // Set results on runner for report generation
  (runner as any).results = results;

  switch (format) {
    case 'markdown':
      return runner.generateReport();
    
    case 'json':
      const jsonResults = {
        timestamp: new Date().toISOString(),
        suites: results,
        summary: {
          totalDuration: results.reduce((sum, suite) => sum + suite.totalDuration, 0),
          totalBenchmarks: results.reduce((sum, suite) => sum + suite.results.length, 0)
        },
        validation: runner.validatePerformance()
      };
      return JSON.stringify(jsonResults, null, 2);
    
    case 'console':
    default:
      let output = '🚀 IR System Performance Benchmarks Results\n\n';
      
      for (const suite of results) {
        output += `\n📊 ${suite.name}\n`;
        output += `${'='.repeat(suite.name.length + 4)}\n`;
        output += `Duration: ${suite.totalDuration.toFixed(2)}ms\n`;
        output += `Benchmarks: ${suite.results.length}\n\n`;

        if (verbose) {
          for (const result of suite.results) {
            output += `  • ${result.name}\n`;
            output += `    Input Size: ${result.inputSize}\n`;
            output += `    Duration: ${result.duration.toFixed(2)}ms\n`;
            output += `    Memory: ${(result.memoryUsed / 1024).toFixed(1)}KB\n`;
            output += `    Ops/sec: ${result.operationsPerSecond.toFixed(0)}\n\n`;
          }
        } else {
          // Show summary statistics
          const avgDuration = suite.results.reduce((sum: number, r: any) => sum + r.duration, 0) / suite.results.length;
          const avgMemory = suite.results.reduce((sum: number, r: any) => sum + r.memoryUsed, 0) / suite.results.length;
          const maxOpsPerSec = Math.max(...suite.results.map((r: any) => r.operationsPerSecond));

          output += `  Average Duration: ${avgDuration.toFixed(2)}ms\n`;
          output += `  Average Memory: ${(avgMemory / 1024).toFixed(1)}KB\n`;
          output += `  Max Throughput: ${maxOpsPerSec.toFixed(0)} ops/sec\n\n`;
        }
      }

      // Performance validation
      const validation = runner.validatePerformance();
      output += '\n📈 Performance Validation\n';
      output += '========================\n';
      
      if (validation.passed) {
        output += '✅ All performance targets met!\n';
      } else {
        output += '❌ Performance issues detected:\n';
        for (const issue of validation.issues) {
          output += `  - ${issue}\n`;
        }
      }

      const totalDuration = results.reduce((sum, suite) => sum + suite.totalDuration, 0);
      const totalBenchmarks = results.reduce((sum, suite) => sum + suite.results.length, 0);
      
      output += `\n📋 Summary\n`;
      output += `==========\n`;
      output += `Total Duration: ${totalDuration.toFixed(2)}ms\n`;
      output += `Total Benchmarks: ${totalBenchmarks}\n`;
      output += `Average per Benchmark: ${(totalDuration / totalBenchmarks).toFixed(2)}ms\n`;

      return output;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  console.log('🚀 Starting ArachneJS IR System Benchmarks...\n');
  
  if (options.verbose) {
    console.log('Configuration:', JSON.stringify(options, null, 2), '\n');
  }

  const runner = new BenchmarkRunner();
  
  try {
    const results = await runSelectedSuites(runner, options.suites);
    
    if (results.length === 0) {
      console.error('❌ No benchmark suites were run. Check your --suites option.');
      process.exit(1);
    }

    const formatted = formatResults(results, options.format, options.verbose);

    if (options.output) {
      const outputPath = join(process.cwd(), options.output);
      writeFileSync(outputPath, formatted, 'utf8');
      console.log(`✅ Results saved to ${outputPath}`);
    } else {
      console.log(formatted);
    }

    // Exit with error code if performance validation failed
    const validation = (runner as any).validatePerformance();
    process.exit(validation.passed ? 0 : 1);

  } catch (error) {
    console.error('❌ Benchmark execution failed:');
    console.error(error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

export { parseArgs, runSelectedSuites, formatResults };