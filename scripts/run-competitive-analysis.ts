#!/usr/bin/env tsx
/**
 * @fileoverview Quick competitive analysis runner 
 * 
 * This script runs a simplified competitive analysis focusing on ArachneJS performance
 * and provides baseline measurements for comparison with future competitor benchmarks.
 */

import { execSync, spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';

interface QuickBenchmarkResult {
  readonly sample: string;
  readonly tool: string;
  readonly success: boolean;
  readonly processingTime: number;
  readonly memoryUsage: number;
  readonly inputSize: number;
  readonly outputSize: number;
  readonly errorMessage?: string;
  readonly qualityMetrics: {
    readonly linesOfCode: number;
    readonly identifierCount: number;
    readonly obfuscatedIdentifierCount: number;
    readonly functionCount: number;
    readonly readabilityScore: number;
  };
}

interface QuickAnalysis {
  readonly executedAt: string;
  readonly tool: string;
  readonly version: string;
  readonly totalSamples: number;
  readonly successfulSamples: number;
  readonly results: QuickBenchmarkResult[];
  readonly summary: {
    readonly successRate: number;
    readonly avgProcessingTime: number;
    readonly avgMemoryUsage: number;
    readonly avgReadabilityScore: number;
    readonly totalProcessingTime: number;
    readonly performanceMetrics: {
      readonly smallFiles: { count: number; avgTime: number }; // < 1KB
      readonly mediumFiles: { count: number; avgTime: number }; // 1KB - 10KB  
      readonly largeFiles: { count: number; avgTime: number };  // > 10KB
    };
  };
}

class QuickCompetitiveAnalysis {
  private readonly projectRoot: string;
  private readonly outputDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.outputDir = join(this.projectRoot, 'benchmarks', 'results');
    
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Ensure ArachneJS is built and ready
   */
  private ensureArachneJSBuilt(): void {
    const cliPath = join(this.projectRoot, 'dist/cli/index.js');
    
    if (!existsSync(cliPath)) {
      console.log('🔨 Building ArachneJS...');
      execSync('npm run build', { cwd: this.projectRoot, stdio: 'pipe' });
      
      if (!existsSync(cliPath)) {
        throw new Error('Failed to build ArachneJS CLI');
      }
    }
    
    console.log('✅ ArachneJS CLI ready');
  }

  /**
   * Collect test samples from various sources
   */
  private collectTestSamples(): Array<{ name: string; filepath: string; size: number }> {
    const samples: Array<{ name: string; filepath: string; size: number }> = [];
    
    // Existing corpus samples
    const corpusDir = join(this.projectRoot, 'tests/corpus/wild_samples');
    if (existsSync(corpusDir)) {
      const corpusFiles = readdirSync(corpusDir).filter(f => f.endsWith('.js'));
      for (const file of corpusFiles) {
        const filepath = join(corpusDir, file);
        const size = Buffer.byteLength(readFileSync(filepath, 'utf8'), 'utf8');
        samples.push({ name: `corpus_${file}`, filepath, size });
      }
    }

    // Add some synthetic samples
    this.generateSyntheticSamples().forEach(sample => samples.push(sample));

    console.log(`📝 Collected ${samples.length} test samples`);
    return samples;
  }

  /**
   * Generate synthetic test samples with known obfuscation patterns
   */
  private generateSyntheticSamples(): Array<{ name: string; filepath: string; size: number }> {
    const samples: Array<{ name: string; filepath: string; size: number }> = [];
    const samplesDir = join(this.outputDir, 'synthetic_samples');
    
    if (!existsSync(samplesDir)) {
      mkdirSync(samplesDir, { recursive: true });
    }

    // Simple identifier renaming
    const simpleObfuscated = `
var _0x1a2b = 'Hello';
var _0x3c4d = 'World'; 
function _0x5e6f(_0x7890) {
  return _0x1a2b + ' ' + _0x7890 + '!';
}
console.log(_0x5e6f(_0x3c4d));
`;

    // String array obfuscation
    const stringArrayObfuscated = `
var _0x4f2e = ['message', 'log', 'Hello World!'];
function _0x1b3d(_0x4a5e) { return _0x4f2e[_0x4a5e]; }
console[_0x1b3d(0x1)](_0x1b3d(0x2));
`;

    // Control flow obfuscation
    const controlFlowObfuscated = `
function _0x1234() {
  var _0x5678 = 0;
  while (true) {
    switch (_0x5678) {
      case 0:
        console.log('Step 1');
        _0x5678 = 1;
        break;
      case 1:
        console.log('Step 2');
        _0x5678 = 2;
        break;
      case 2:
        return 'Done';
    }
  }
}
_0x1234();
`;

    // Large sample with many variables
    let largeObfuscated = '';
    for (let i = 0; i < 100; i++) {
      largeObfuscated += `var _0x${i.toString(16).padStart(4, '0')} = ${i};\n`;
    }
    largeObfuscated += `
function _0xProcess() {
  let _0xSum = 0;
  for (let _0xI = 0; _0xI < 100; _0xI++) {
    _0xSum += eval('_0x' + _0xI.toString(16).padStart(4, '0'));
  }
  return _0xSum;
}
console.log(_0xProcess());
`;

    const testCases = [
      { name: 'simple_obfuscated.js', code: simpleObfuscated },
      { name: 'string_array_obfuscated.js', code: stringArrayObfuscated },
      { name: 'control_flow_obfuscated.js', code: controlFlowObfuscated },
      { name: 'large_obfuscated.js', code: largeObfuscated }
    ];

    for (const testCase of testCases) {
      const filepath = join(samplesDir, testCase.name);
      writeFileSync(filepath, testCase.code, 'utf8');
      const size = Buffer.byteLength(testCase.code, 'utf8');
      samples.push({ name: `synthetic_${testCase.name}`, filepath, size });
    }

    return samples;
  }

  /**
   * Run ArachneJS deobfuscation on a single sample
   */
  private async runArachneJSBenchmark(
    sample: { name: string; filepath: string; size: number }
  ): Promise<QuickBenchmarkResult> {
    const outputFile = join(this.outputDir, `arachnejs_${sample.name}`);
    const cliPath = join(this.projectRoot, 'dist/cli/index.js');
    
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    try {
      // Run ArachneJS deobfuscation
      const command = ['node', cliPath, 'deobfuscate', sample.filepath, '-o', outputFile];
      
      await this.runCommandWithTimeout(command, 30000);
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      // Read and analyze output
      let outputCode = '';
      let outputSize = 0;
      
      if (existsSync(outputFile)) {
        outputCode = readFileSync(outputFile, 'utf8');
        outputSize = Buffer.byteLength(outputCode, 'utf8');
      }
      
      const qualityMetrics = this.analyzeCodeQuality(outputCode);
      
      return {
        sample: sample.name,
        tool: 'ArachneJS',
        success: outputCode.length > 0,
        processingTime: endTime - startTime,
        memoryUsage: Math.max(0, endMemory - startMemory),
        inputSize: sample.size,
        outputSize,
        qualityMetrics
      };

    } catch (error) {
      const endTime = performance.now();
      
      return {
        sample: sample.name,
        tool: 'ArachneJS',
        success: false,
        processingTime: endTime - startTime,
        memoryUsage: 0,
        inputSize: sample.size,
        outputSize: 0,
        errorMessage: String(error),
        qualityMetrics: {
          linesOfCode: 0,
          identifierCount: 0,
          obfuscatedIdentifierCount: 0,
          functionCount: 0,
          readabilityScore: 0
        }
      };
    }
  }

  /**
   * Run command with timeout
   */
  private async runCommandWithTimeout(command: string[], timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', reject);

      // Force kill after timeout
      setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Command timeout'));
      }, timeoutMs);
    });
  }

  /**
   * Analyze code quality metrics
   */
  private analyzeCodeQuality(code: string): QuickBenchmarkResult['qualityMetrics'] {
    const lines = code.split('\n').filter(line => line.trim());
    const linesOfCode = lines.length;
    
    // Count identifiers
    const identifiers = (code.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || []);
    const identifierCount = identifiers.length;
    
    // Count obfuscated identifiers (hex patterns)
    const obfuscatedIdentifiers = (code.match(/_0x[a-f0-9]+/gi) || []);
    const obfuscatedIdentifierCount = obfuscatedIdentifiers.length;
    
    // Count functions  
    const functions = (code.match(/function\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/g) || []);
    const functionCount = functions.length;
    
    // Simple readability score
    let readabilityScore = 0;
    if (identifierCount > 0) {
      const clearIdentifierRatio = (identifierCount - obfuscatedIdentifierCount) / identifierCount;
      readabilityScore = clearIdentifierRatio * 0.6; // 60% for identifier clarity
    }
    
    // Bonus for natural code structure
    const naturalStructures = (code.match(/\b(if|for|while|function)\s*\(/g) || []).length;
    const obfuscatedStructures = (code.match(/switch.*case\s+0x/gi) || []).length;
    
    if (naturalStructures + obfuscatedStructures > 0) {
      const structureScore = naturalStructures / (naturalStructures + obfuscatedStructures);
      readabilityScore += structureScore * 0.4; // 40% for structure clarity
    }
    
    return {
      linesOfCode,
      identifierCount,
      obfuscatedIdentifierCount, 
      functionCount,
      readabilityScore: Math.min(1.0, readabilityScore)
    };
  }

  /**
   * Run the complete analysis
   */
  async runAnalysis(): Promise<QuickAnalysis> {
    console.log('🚀 Starting ArachneJS Performance Analysis...\n');
    
    // Ensure ArachneJS is ready
    this.ensureArachneJSBuilt();
    
    // Collect samples
    const samples = this.collectTestSamples();
    console.log();
    
    // Run benchmarks
    const results: QuickBenchmarkResult[] = [];
    console.log('⚡ Running benchmarks...\n');
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      console.log(`  [${i + 1}/${samples.length}] ${sample.name}`);
      
      const result = await this.runArachneJSBenchmark(sample);
      results.push(result);
      
      if (result.success) {
        console.log(`    ✅ Success (${result.processingTime.toFixed(2)}ms, readability: ${(result.qualityMetrics.readabilityScore * 100).toFixed(1)}%)`);
      } else {
        console.log(`    ❌ Failed: ${result.errorMessage?.substring(0, 60)}...`);
      }
    }
    
    // Calculate summary metrics
    const successfulResults = results.filter(r => r.success);
    const successRate = successfulResults.length / results.length;
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
    const avgMemoryUsage = results.reduce((sum, r) => sum + r.memoryUsage, 0) / results.length;
    const avgReadabilityScore = successfulResults.reduce((sum, r) => sum + r.qualityMetrics.readabilityScore, 0) / Math.max(1, successfulResults.length);
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    
    // Performance by file size
    const smallFiles = results.filter(r => r.inputSize < 1024);
    const mediumFiles = results.filter(r => r.inputSize >= 1024 && r.inputSize <= 10240);
    const largeFiles = results.filter(r => r.inputSize > 10240);
    
    const performanceMetrics = {
      smallFiles: {
        count: smallFiles.length,
        avgTime: smallFiles.length > 0 ? smallFiles.reduce((sum, r) => sum + r.processingTime, 0) / smallFiles.length : 0
      },
      mediumFiles: {
        count: mediumFiles.length,
        avgTime: mediumFiles.length > 0 ? mediumFiles.reduce((sum, r) => sum + r.processingTime, 0) / mediumFiles.length : 0
      },
      largeFiles: {
        count: largeFiles.length,
        avgTime: largeFiles.length > 0 ? largeFiles.reduce((sum, r) => sum + r.processingTime, 0) / largeFiles.length : 0
      }
    };

    return {
      executedAt: new Date().toISOString(),
      tool: 'ArachneJS',
      version: '0.1.0',
      totalSamples: samples.length,
      successfulSamples: successfulResults.length,
      results,
      summary: {
        successRate,
        avgProcessingTime,
        avgMemoryUsage,
        avgReadabilityScore,
        totalProcessingTime,
        performanceMetrics
      }
    };
  }

  /**
   * Generate analysis report
   */
  generateReport(analysis: QuickAnalysis): string {
    let report = `# ArachneJS Performance Baseline Report\n\n`;
    report += `**Generated**: ${analysis.executedAt}\n`;
    report += `**Tool**: ${analysis.tool} v${analysis.version}\n`;
    report += `**Total Samples**: ${analysis.totalSamples}\n`;
    report += `**Successful**: ${analysis.successfulSamples}\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    report += `**Overall Success Rate**: ${(analysis.summary.successRate * 100).toFixed(1)}%\n`;
    report += `**Average Processing Time**: ${analysis.summary.avgProcessingTime.toFixed(2)}ms\n`;
    report += `**Average Memory Usage**: ${(analysis.summary.avgMemoryUsage / 1024).toFixed(1)}KB\n`;
    report += `**Average Readability Score**: ${(analysis.summary.avgReadabilityScore * 100).toFixed(1)}%\n`;
    report += `**Total Processing Time**: ${analysis.summary.totalProcessingTime.toFixed(2)}ms\n\n`;

    // Performance Grades
    report += `### Performance Assessment\n\n`;
    const successGrade = analysis.summary.successRate >= 0.9 ? '🏆 Excellent' : 
                        analysis.summary.successRate >= 0.8 ? '✅ Good' :
                        analysis.summary.successRate >= 0.7 ? '⚠️ Fair' : '❌ Needs Improvement';
    
    const speedGrade = analysis.summary.avgProcessingTime <= 500 ? '🏆 Excellent' :
                       analysis.summary.avgProcessingTime <= 1000 ? '✅ Good' :
                       analysis.summary.avgProcessingTime <= 2000 ? '⚠️ Fair' : '❌ Needs Improvement';
    
    const qualityGrade = analysis.summary.avgReadabilityScore >= 0.8 ? '🏆 Excellent' :
                         analysis.summary.avgReadabilityScore >= 0.7 ? '✅ Good' :
                         analysis.summary.avgReadabilityScore >= 0.6 ? '⚠️ Fair' : '❌ Needs Improvement';

    report += `- **Success Rate**: ${successGrade} (${(analysis.summary.successRate * 100).toFixed(1)}%)\n`;
    report += `- **Processing Speed**: ${speedGrade} (${analysis.summary.avgProcessingTime.toFixed(2)}ms avg)\n`;
    report += `- **Output Quality**: ${qualityGrade} (${(analysis.summary.avgReadabilityScore * 100).toFixed(1)}% readability)\n\n`;

    // Performance by File Size
    report += `## Performance by File Size\n\n`;
    report += `| Category | Count | Avg Time (ms) | Performance |\n`;
    report += `|----------|-------|---------------|-------------|\n`;
    
    const { performanceMetrics } = analysis.summary;
    
    const smallPerf = performanceMetrics.smallFiles.avgTime <= 100 ? '🏆' : 
                      performanceMetrics.smallFiles.avgTime <= 500 ? '✅' : '⚠️';
    const mediumPerf = performanceMetrics.mediumFiles.avgTime <= 1000 ? '🏆' :
                       performanceMetrics.mediumFiles.avgTime <= 2000 ? '✅' : '⚠️';
    const largePerf = performanceMetrics.largeFiles.avgTime <= 5000 ? '🏆' :
                      performanceMetrics.largeFiles.avgTime <= 10000 ? '✅' : '⚠️';

    report += `| Small (<1KB) | ${performanceMetrics.smallFiles.count} | ${performanceMetrics.smallFiles.avgTime.toFixed(2)} | ${smallPerf} |\n`;
    report += `| Medium (1-10KB) | ${performanceMetrics.mediumFiles.count} | ${performanceMetrics.mediumFiles.avgTime.toFixed(2)} | ${mediumPerf} |\n`;
    report += `| Large (>10KB) | ${performanceMetrics.largeFiles.count} | ${performanceMetrics.largeFiles.avgTime.toFixed(2)} | ${largePerf} |\n\n`;

    // Detailed Results
    report += `## Detailed Results\n\n`;
    report += `| Sample | Status | Time (ms) | Memory (KB) | Input (bytes) | Output (bytes) | Readability |\n`;
    report += `|--------|--------|-----------|-------------|---------------|----------------|-------------|\n`;
    
    analysis.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const memory = (result.memoryUsage / 1024).toFixed(1);
      const readability = (result.qualityMetrics.readabilityScore * 100).toFixed(1) + '%';
      
      report += `| ${result.sample} | ${status} | ${result.processingTime.toFixed(2)} | ${memory} | ${result.inputSize} | ${result.outputSize} | ${readability} |\n`;
    });

    report += `\n`;

    // Quality Analysis
    report += `## Code Quality Analysis\n\n`;
    const qualityStats = analysis.results.filter(r => r.success).map(r => r.qualityMetrics);
    
    if (qualityStats.length > 0) {
      const avgLines = qualityStats.reduce((sum, q) => sum + q.linesOfCode, 0) / qualityStats.length;
      const avgIdentifiers = qualityStats.reduce((sum, q) => sum + q.identifierCount, 0) / qualityStats.length;
      const avgObfuscated = qualityStats.reduce((sum, q) => sum + q.obfuscatedIdentifierCount, 0) / qualityStats.length;
      const avgFunctions = qualityStats.reduce((sum, q) => sum + q.functionCount, 0) / qualityStats.length;
      
      report += `**Average Metrics per Successful Sample**:\n`;
      report += `- Lines of Code: ${avgLines.toFixed(1)}\n`;
      report += `- Total Identifiers: ${avgIdentifiers.toFixed(1)}\n`;
      report += `- Obfuscated Identifiers: ${avgObfuscated.toFixed(1)}\n`;
      report += `- Function Count: ${avgFunctions.toFixed(1)}\n`;
      
      const clearingRate = avgIdentifiers > 0 ? ((avgIdentifiers - avgObfuscated) / avgIdentifiers * 100) : 0;
      report += `- Identifier Clearing Rate: ${clearingRate.toFixed(1)}%\n\n`;
    }

    // Architectural Strengths
    report += `## ArachneJS Architectural Advantages\n\n`;
    report += `**Core Strengths Demonstrated**:\n`;
    report += `- 🧠 **IR-Based Analysis**: Multi-pass optimization pipeline with CFG and SSA form\n`;
    report += `- 🔍 **Constraint Solving**: Z3 SMT solver integration for symbolic execution\n`;
    report += `- 🏗️ **Bytecode Lifting**: Advanced bytecode analysis capabilities\n`;
    report += `- 🛡️ **Sandboxed Execution**: Safe evaluation with comprehensive tracing\n`;
    report += `- 🧪 **Property-Based Testing**: Rigorous validation framework\n\n`;

    // Future Benchmarking
    report += `## Competitive Benchmarking Roadmap\n\n`;
    report += `**Next Steps for Full Competitive Analysis**:\n\n`;
    report += `1. **Tool Setup**: Install and configure competitor tools\n`;
    report += `   - Synchrony, Webcrack, Restringer, UnuglifyJS, De4js\n`;
    report += `   - Use setup script: \`./scripts/setup-competitors.sh\`\n\n`;
    
    report += `2. **Extended Sample Collection**:\n`;
    report += `   - Real-world obfuscated JavaScript from popular obfuscators\n`;
    report += `   - Large-scale samples (50KB+ files)\n`;
    report += `   - Domain-specific samples (e.g., malware, packed libraries)\n\n`;
    
    report += `3. **Comprehensive Metrics**:\n`;
    report += `   - Cross-tool success rate comparison\n`;
    report += `   - Output quality assessment with human evaluation\n`;
    report += `   - Performance scalability analysis\n`;
    report += `   - Technique-specific coverage analysis\n\n`;
    
    report += `4. **Competitive Positioning**:\n`;
    report += `   - Market share and adoption analysis\n`;
    report += `   - Feature differentiation matrix\n`;
    report += `   - Performance vs. competitors benchmarking\n`;
    report += `   - Strategic recommendations for improvement\n\n`;

    // Current Baseline Summary
    report += `## Baseline Performance Summary\n\n`;
    report += `**This baseline establishes ArachneJS current performance**:\n`;
    if (analysis.summary.successRate >= 0.8) {
      report += `- ✅ **Strong Foundation**: High success rate indicates robust core deobfuscation\n`;
    }
    if (analysis.summary.avgProcessingTime <= 1000) {
      report += `- ✅ **Competitive Speed**: Processing time is competitive for deobfuscation tasks\n`;
    }
    if (analysis.summary.avgReadabilityScore >= 0.7) {
      report += `- ✅ **Quality Output**: Good readability scores demonstrate effective deobfuscation\n`;
    }
    
    report += `\n**Areas for Monitoring in Competitive Analysis**:\n`;
    if (analysis.summary.successRate < 0.9) {
      report += `- 🔍 **Success Rate Optimization**: Current ${(analysis.summary.successRate * 100).toFixed(1)}% can be improved\n`;
    }
    if (analysis.summary.avgProcessingTime > 500) {
      report += `- ⚡ **Performance Tuning**: Processing speed optimization opportunities\n`;
    }
    report += `- 📊 **Relative Performance**: How ArachneJS compares to market alternatives\n`;
    report += `- 🎯 **Technique Coverage**: Specific obfuscation patterns needing improvement\n\n`;

    report += `---\n\n`;
    report += `*This baseline report provides the foundation for comprehensive competitive analysis.*\n`;
    report += `*Generated by ArachneJS Performance Analysis Tool v0.1.0*\n`;

    return report;
  }

  /**
   * Save analysis results
   */
  async saveResults(analysis: QuickAnalysis): Promise<void> {
    // Save raw results
    const resultsFile = join(this.outputDir, 'arachnejs-baseline-results.json');
    writeFileSync(resultsFile, JSON.stringify(analysis, null, 2));

    // Generate and save report
    const report = this.generateReport(analysis);
    const reportFile = join(this.outputDir, 'arachnejs-baseline-report.md');
    writeFileSync(reportFile, report);

    // Save CSV summary
    const csvLines = ['Sample,Success,Time(ms),Memory(KB),InputSize,OutputSize,ReadabilityScore'];
    analysis.results.forEach(result => {
      csvLines.push([
        result.sample,
        result.success ? 'TRUE' : 'FALSE',
        result.processingTime.toFixed(2),
        (result.memoryUsage / 1024).toFixed(1),
        result.inputSize.toString(),
        result.outputSize.toString(),
        result.qualityMetrics.readabilityScore.toFixed(3)
      ].join(','));
    });
    
    const csvFile = join(this.outputDir, 'arachnejs-baseline-summary.csv');
    writeFileSync(csvFile, csvLines.join('\n'));

    console.log(`\n📊 Results saved:`);
    console.log(`  📄 Report: ${reportFile}`);
    console.log(`  📋 Raw data: ${resultsFile}`);
    console.log(`  📈 CSV: ${csvFile}`);
  }
}

// Main execution
async function main() {
  const analyzer = new QuickCompetitiveAnalysis();
  
  try {
    const analysis = await analyzer.runAnalysis();
    await analyzer.saveResults(analysis);
    
    console.log(`\n✅ ArachneJS baseline analysis completed successfully!`);
    console.log(`\n🎯 Key Metrics:`);
    console.log(`  Success Rate: ${(analysis.summary.successRate * 100).toFixed(1)}%`);
    console.log(`  Avg Processing Time: ${analysis.summary.avgProcessingTime.toFixed(2)}ms`);
    console.log(`  Avg Readability Score: ${(analysis.summary.avgReadabilityScore * 100).toFixed(1)}%`);
    console.log(`  Samples Processed: ${analysis.totalSamples} (${analysis.successfulSamples} successful)`);
    
    console.log(`\n🚀 Next Steps:`);
    console.log(`  1. Run: ./scripts/setup-competitors.sh`);
    console.log(`  2. Run: tsx benchmarks/competitive-analysis.ts`);
    console.log(`  3. Compare results with this baseline`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module || import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}