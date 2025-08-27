/**
 * @fileoverview Comprehensive competitive benchmark suite for JavaScript deobfuscation tools
 * 
 * Benchmarks ArachneJS against major open source competitors:
 * - Synchrony (relative/synchrony)
 * - Webcrack (j4k0xb/webcrack) 
 * - Restringer (PerimeterX/restringer)
 * - UnuglifyJS (eth-sri/UnuglifyJS)
 * - De4js (lelinhtinh/de4js)
 * - JS-deobfuscator
 * 
 * Evaluation dimensions:
 * - Processing time and memory usage
 * - Deobfuscation success rate
 * - Output code quality and readability
 * - Handling of different obfuscation techniques
 * - Scalability with file size and complexity
 */

import { spawn, execSync } from 'child_process';
import { existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { performance } from 'perf_hooks';
import { promisify } from 'util';
import * as crypto from 'crypto';

interface DeobfuscationTool {
  readonly name: string;
  readonly repository: string;
  readonly version: string;
  readonly installation: string[];
  readonly command: (inputFile: string, outputFile: string) => string[];
  readonly supportsCLI: boolean;
  readonly requiresNodeModules: boolean;
}

interface TestSample {
  readonly name: string;
  readonly filepath: string;
  readonly size: number;
  readonly hash: string;
  readonly obfuscationTechniques: string[];
  readonly complexity: 'simple' | 'medium' | 'complex' | 'extreme';
  readonly expectedPatterns: string[];
}

interface BenchmarkResult {
  readonly tool: string;
  readonly sample: string;
  readonly success: boolean;
  readonly processingTime: number; // milliseconds
  readonly memoryUsage: number; // bytes
  readonly outputSize: number; // bytes
  readonly errorMessage?: string;
  readonly qualityMetrics: {
    readonly identifierRecovery: number; // 0-1 score
    readonly controlFlowClarity: number; // 0-1 score  
    readonly stringDecoding: number; // 0-1 score
    readonly deadCodeRemoval: number; // 0-1 score
    readonly overallReadability: number; // 0-1 score
  };
  readonly techniqueCoverage: Record<string, boolean>; // which obfuscation techniques were handled
}

interface CompetitiveAnalysis {
  readonly executedAt: string;
  readonly tools: DeobfuscationTool[];
  readonly samples: TestSample[];
  readonly results: BenchmarkResult[];
  readonly summary: {
    readonly toolRankings: Array<{
      readonly tool: string;
      readonly overallScore: number;
      readonly successRate: number;
      readonly avgProcessingTime: number;
      readonly avgQualityScore: number;
    }>;
    readonly techniqueAnalysis: Record<string, {
      readonly toolsSucceeded: string[];
      readonly avgSuccessRate: number;
      readonly bestTool: string;
    }>;
    readonly scalabilityAnalysis: Array<{
      readonly tool: string;
      readonly scalabilityFactor: number; // time complexity factor
      readonly memoryEfficiency: number;
    }>;
  };
}

/**
 * JavaScript obfuscation sample generator for comprehensive testing
 */
class ObfuscationSampleGenerator {
  private readonly outputDir: string;

  constructor(outputDir: string = join(process.cwd(), 'benchmarks', 'samples')) {
    this.outputDir = outputDir;
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate samples using popular obfuscators
   */
  async generateSamples(): Promise<TestSample[]> {
    const samples: TestSample[] = [];

    // Simple baseline samples
    samples.push(...await this.generateSimpleSamples());
    
    // JavaScript-obfuscator.io samples (most common)
    samples.push(...await this.generateObfuscatorIOSamples());
    
    // UglifyJS/Terser minified samples
    samples.push(...await this.generateMinifiedSamples());
    
    // Custom obfuscation techniques
    samples.push(...await this.generateCustomObfuscatedSamples());
    
    // Large file stress tests
    samples.push(...await this.generateLargeFileSamples());

    return samples;
  }

  private async generateSimpleSamples(): Promise<TestSample[]> {
    const samples: TestSample[] = [];
    
    const simpleCode = `
function greet(name) {
  console.log("Hello, " + name + "!");
  return name.toUpperCase();
}

const users = ["Alice", "Bob", "Charlie"];
users.forEach(user => greet(user));
`;

    // Variable renaming only
    const renamedCode = simpleCode
      .replace(/greet/g, '_0x1a2b')
      .replace(/name/g, '_0x3c4d')
      .replace(/users/g, '_0x5e6f')
      .replace(/user/g, '_0x7890');
    
    samples.push(await this.createSample('simple_renamed', renamedCode, ['identifier_renaming'], 'simple'));

    return samples;
  }

  private async generateObfuscatorIOSamples(): Promise<TestSample[]> {
    const samples: TestSample[] = [];
    
    // This would ideally use the actual javascript-obfuscator package
    // For now, creating representative samples manually
    
    const baseCode = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].price > 0) {
      total += items[i].price * (items[i].quantity || 1);
    }
  }
  return total;
}
`;

    // String array obfuscation pattern
    const stringArrayObfuscated = `
var _0x4f2e = ['price', 'quantity', 'length'];
function _0x1b3d(_0x4a5e, _0x2c7f) { return _0x4f2e[_0x4a5e - 0x1b3]; }
function calculateTotal(_0x3d8a) {
  let _0x5f1c = 0;
  for (let _0x6e2b = 0; _0x6e2b < _0x3d8a[_0x1b3d('0x0')]; _0x6e2b++) {
    if (_0x3d8a[_0x6e2b][_0x1b3d('0x1')] > 0) {
      _0x5f1c += _0x3d8a[_0x6e2b][_0x1b3d('0x1')] * (_0x3d8a[_0x6e2b][_0x1b3d('0x2')] || 1);
    }
  }
  return _0x5f1c;
}
`;

    samples.push(await this.createSample('string_array_obfuscated', stringArrayObfuscated, 
      ['string_array_obfuscation', 'identifier_renaming'], 'medium'));

    // Control flow flattening pattern
    const controlFlowObfuscated = `
function calculateTotal(_0x1a2b) {
  var _0x3c4d = {'state': 0x0};
  while (true) {
    switch (_0x3c4d.state) {
      case 0x0:
        let _0x5e6f = 0;
        _0x3c4d.state = 0x1;
        break;
      case 0x1:
        if (_0x7890 < _0x1a2b.length) {
          _0x3c4d.state = 0x2;
        } else {
          _0x3c4d.state = 0x4;
        }
        break;
      case 0x2:
        if (_0x1a2b[_0x7890].price > 0) {
          _0x5e6f += _0x1a2b[_0x7890].price * (_0x1a2b[_0x7890].quantity || 1);
        }
        _0x3c4d.state = 0x3;
        break;
      case 0x3:
        _0x7890++;
        _0x3c4d.state = 0x1;
        break;
      case 0x4:
        return _0x5e6f;
    }
  }
}
`;

    samples.push(await this.createSample('control_flow_flattened', controlFlowObfuscated, 
      ['control_flow_flattening', 'identifier_renaming'], 'complex'));

    return samples;
  }

  private async generateMinifiedSamples(): Promise<TestSample[]> {
    const samples: TestSample[] = [];
    
    const minifiedCode = `
function a(b){let c=0;for(let d=0;d<b.length;d++)b[d].e>0&&(c+=b[d].e*(b[d].f||1));return c}const g=["h","i","j"];g.forEach(k=>console.log("Hello, "+k+"!"));
`;

    samples.push(await this.createSample('minified_terser', minifiedCode, ['minification'], 'simple'));

    return samples;
  }

  private async generateCustomObfuscatedSamples(): Promise<TestSample[]> {
    const samples: TestSample[] = [];
    
    // Dead code insertion
    const deadCodeSample = `
function calculateTotal(items) {
  if (false) {
    var impossiblePath = 'never executed';
    return impossiblePath + 'unreachable';
  }
  
  let total = 0;
  undefined || null || (() => { throw new Error('fake error'); })();
  
  for (let i = 0; i < items.length; i++) {
    false && console.log('debug message');
    
    if (items[i].price > 0) {
      total += items[i].price * (items[i].quantity || 1);
    }
    
    void 0, true && false;
  }
  
  return total;
}
`;

    samples.push(await this.createSample('dead_code_inserted', deadCodeSample, 
      ['dead_code_insertion'], 'medium'));

    // Eval-based obfuscation
    const evalSample = `
eval(function(p,a,c,k,e,d){e=function(c){return c};if(!''.replace(/^/,String)){while(c--){d[c]=k[c]||c}k=[function(e){return d[e]}];e=function(){return'\\\\w+'};c=1};while(c--){if(k[c]){p=p.replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c])}}return p}('3 4(5){6 7=0;8(6 9=0;9<5.10;9++){11(5[9].12>0){7+=5[9].12*(5[9].13||1)}}14 7}',15,15,'||||calculateTotal|items|let|total|for|i|length|if|price|quantity|return'.split('|'),0,{}))
`;

    samples.push(await this.createSample('eval_packed', evalSample, 
      ['eval_patterns', 'packer_obfuscation'], 'complex'));

    return samples;
  }

  private async generateLargeFileSamples(): Promise<TestSample[]> {
    const samples: TestSample[] = [];
    
    // Generate a large obfuscated file (10KB+)
    let largeCode = `
var _0xStrings = [
${Array.from({ length: 500 }, (_, i) => `  "string_${i}",`).join('\n')}
];

function _0xDecrypt(index) {
  return _0xStrings[index];
}

`;

    // Add many obfuscated functions
    for (let i = 0; i < 100; i++) {
      largeCode += `
function _0xFunc${i}(_0xArg1, _0xArg2) {
  var _0x1 = _0xDecrypt(${i % 500});
  var _0x2 = _0xArg1 + _0xArg2;
  if (_0x2 > ${i}) {
    return _0x1 + _0x2.toString();
  } else {
    return _0xFunc${(i + 1) % 100}(_0x2, ${i});
  }
}
`;
    }

    samples.push(await this.createSample('large_string_array', largeCode, 
      ['string_array_obfuscation', 'identifier_renaming'], 'extreme'));

    return samples;
  }

  private async createSample(
    name: string, 
    code: string, 
    techniques: string[], 
    complexity: TestSample['complexity']
  ): Promise<TestSample> {
    const filename = `${name}.js`;
    const filepath = join(this.outputDir, filename);
    
    writeFileSync(filepath, code, 'utf8');
    
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const size = Buffer.byteLength(code, 'utf8');
    
    // Expected patterns that should be present after deobfuscation
    const expectedPatterns = [
      'function calculateTotal', 
      'items.length',
      'price',
      'quantity'
    ];

    return {
      name: filename,
      filepath,
      size,
      hash,
      obfuscationTechniques: techniques,
      complexity,
      expectedPatterns
    };
  }
}

/**
 * Competitive benchmarking framework for JavaScript deobfuscation tools
 */
export class CompetitiveBenchmark {
  private readonly tools: DeobfuscationTool[] = [];
  private readonly workDir: string;
  private readonly sampleGenerator: ObfuscationSampleGenerator;

  constructor(workDir: string = join(process.cwd(), 'benchmarks', 'competitive')) {
    this.workDir = workDir;
    if (!existsSync(this.workDir)) {
      mkdirSync(this.workDir, { recursive: true });
    }
    
    this.sampleGenerator = new ObfuscationSampleGenerator(
      join(this.workDir, 'samples')
    );
    
    this.initializeTools();
  }

  private initializeTools(): void {
    // Define major competitor tools
    this.tools.push(
      {
        name: 'ArachneJS',
        repository: 'local',
        version: '0.1.0',
        installation: ['npm install'], // Already installed
        command: (input, output) => [
          'node', 
          join(process.cwd(), 'dist/cli/index.js'), 
          'deobfuscate', 
          input, 
          '-o', 
          output
        ],
        supportsCLI: true,
        requiresNodeModules: false
      },
      {
        name: 'Synchrony',
        repository: 'https://github.com/relative/synchrony',
        version: 'latest',
        installation: ['npm install -g @relative/synchrony'],
        command: (input, output) => [
          'npx', 
          'synchrony', 
          input, 
          '-o', 
          output
        ],
        supportsCLI: true,
        requiresNodeModules: true
      },
      {
        name: 'Webcrack',
        repository: 'https://github.com/j4k0xb/webcrack',
        version: 'latest', 
        installation: ['npm install -g webcrack'],
        command: (input, output) => [
          'npx',
          'webcrack',
          input,
          '--output',
          output
        ],
        supportsCLI: true,
        requiresNodeModules: true
      },
      {
        name: 'Restringer',
        repository: 'https://github.com/PerimeterX/restringer',
        version: 'latest',
        installation: ['npm install -g restringer'],
        command: (input, output) => [
          'npx',
          'restringer',
          input,
          '-o',
          output
        ],
        supportsCLI: true,
        requiresNodeModules: true
      },
      {
        name: 'UnuglifyJS',
        repository: 'https://github.com/eth-sri/UnuglifyJS',
        version: 'latest',
        installation: [
          'git clone https://github.com/eth-sri/UnuglifyJS.git',
          'cd UnuglifyJS && npm install'
        ],
        command: (input, output) => [
          'node',
          'path/to/UnuglifyJS/src/cli.js',
          input,
          output
        ],
        supportsCLI: true,
        requiresNodeModules: true
      }
    );
  }

  /**
   * Setup competitor tools (installation and verification)
   */
  async setupTools(): Promise<{ installed: string[]; failed: string[] }> {
    const installed: string[] = [];
    const failed: string[] = [];

    console.log('🔧 Setting up competitor tools...');

    for (const tool of this.tools) {
      console.log(`\n  Installing ${tool.name}...`);
      
      try {
        if (tool.name === 'ArachneJS') {
          // ArachneJS is local - just verify it's built
          if (existsSync(join(process.cwd(), 'dist/cli/index.js'))) {
            installed.push(tool.name);
            console.log(`    ✅ ${tool.name} already available`);
          } else {
            console.log(`    Building ${tool.name}...`);
            execSync('npm run build', { cwd: process.cwd(), stdio: 'pipe' });
            installed.push(tool.name);
            console.log(`    ✅ ${tool.name} built successfully`);
          }
          continue;
        }

        // Try installing the tool
        for (const command of tool.installation) {
          try {
            execSync(command, { stdio: 'pipe', timeout: 120000 });
          } catch (error) {
            // Some installs might fail but tool might still be available
            console.log(`    ⚠️  Installation command failed: ${command}`);
          }
        }

        // Verify the tool works
        const testCommand = tool.command('--version', '').slice(0, -2); // Remove input/output args
        testCommand.push('--help'); // Use help instead of version
        
        try {
          execSync(testCommand.join(' '), { stdio: 'pipe', timeout: 10000 });
          installed.push(tool.name);
          console.log(`    ✅ ${tool.name} installed and verified`);
        } catch (error) {
          failed.push(tool.name);
          console.log(`    ❌ ${tool.name} verification failed`);
        }
        
      } catch (error) {
        failed.push(tool.name);
        console.log(`    ❌ ${tool.name} installation failed: ${error}`);
      }
    }

    return { installed, failed };
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarks(): Promise<CompetitiveAnalysis> {
    console.log('🚀 Starting competitive benchmark suite...\n');

    // Generate test samples
    console.log('📝 Generating test samples...');
    const samples = await this.sampleGenerator.generateSamples();
    
    // Add existing corpus samples
    const corpusDir = join(process.cwd(), 'tests/corpus/wild_samples');
    if (existsSync(corpusDir)) {
      const corpusFiles = readdirSync(corpusDir).filter(f => f.endsWith('.js'));
      for (const file of corpusFiles) {
        const filepath = join(corpusDir, file);
        const code = readFileSync(filepath, 'utf8');
        const hash = crypto.createHash('sha256').update(code).digest('hex');
        
        samples.push({
          name: file,
          filepath,
          size: Buffer.byteLength(code, 'utf8'),
          hash,
          obfuscationTechniques: ['mixed'], // From existing corpus
          complexity: 'medium',
          expectedPatterns: []
        });
      }
    }

    console.log(`  Generated ${samples.length} test samples\n`);

    // Setup tools
    const { installed, failed } = await this.setupTools();
    console.log(`\n✅ ${installed.length} tools ready, ${failed.length} failed setup\n`);

    const availableTools = this.tools.filter(t => installed.includes(t.name));
    const results: BenchmarkResult[] = [];

    // Run benchmarks for each tool × sample combination
    let totalTests = availableTools.length * samples.length;
    let currentTest = 0;

    for (const tool of availableTools) {
      console.log(`\n🔍 Testing ${tool.name}...\n`);
      
      for (const sample of samples) {
        currentTest++;
        console.log(`  [${currentTest}/${totalTests}] ${sample.name}`);
        
        const result = await this.runSingleBenchmark(tool, sample);
        results.push(result);
        
        // Log immediate result
        if (result.success) {
          console.log(`    ✅ Success (${result.processingTime.toFixed(2)}ms, quality: ${(result.qualityMetrics.overallReadability * 100).toFixed(1)}%)`);
        } else {
          console.log(`    ❌ Failed: ${result.errorMessage?.substring(0, 60)}...`);
        }
      }
    }

    // Generate analysis
    const analysis = this.analyzeResults(availableTools, samples, results);
    
    console.log('\n📊 Benchmark completed! Generating analysis report...');
    
    return analysis;
  }

  private async runSingleBenchmark(tool: DeobfuscationTool, sample: TestSample): Promise<BenchmarkResult> {
    const outputFile = join(this.workDir, 'output', `${tool.name}_${sample.name}`);
    const outputDir = dirname(outputFile);
    
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    try {
      const command = tool.command(sample.filepath, outputFile);
      
      // Run deobfuscation with timeout
      await this.runCommandWithTimeout(command, 30000); // 30 second timeout
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      // Read output and analyze quality
      let outputCode = '';
      let outputSize = 0;
      
      if (existsSync(outputFile)) {
        outputCode = readFileSync(outputFile, 'utf8');
        outputSize = Buffer.byteLength(outputCode, 'utf8');
      }
      
      const qualityMetrics = this.assessOutputQuality(outputCode, sample);
      const techniqueCoverage = this.assessTechniqueCoverage(outputCode, sample);

      return {
        tool: tool.name,
        sample: sample.name,
        success: outputCode.length > 0,
        processingTime: endTime - startTime,
        memoryUsage: Math.max(0, endMemory - startMemory),
        outputSize,
        qualityMetrics,
        techniqueCoverage
      };

    } catch (error) {
      const endTime = performance.now();
      
      return {
        tool: tool.name,
        sample: sample.name,
        success: false,
        processingTime: endTime - startTime,
        memoryUsage: 0,
        outputSize: 0,
        errorMessage: String(error),
        qualityMetrics: {
          identifierRecovery: 0,
          controlFlowClarity: 0,
          stringDecoding: 0,
          deadCodeRemoval: 0,
          overallReadability: 0
        },
        techniqueCoverage: {}
      };
    }
  }

  private async runCommandWithTimeout(command: string[], timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        stdio: 'pipe',
        timeout: timeoutMs
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
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
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
   * Assess the quality of deobfuscated output
   */
  private assessOutputQuality(output: string, sample: TestSample): BenchmarkResult['qualityMetrics'] {
    // Identifier recovery - check for meaningful variable names
    const identifierRecovery = this.assessIdentifierRecovery(output);
    
    // Control flow clarity - check for natural control structures
    const controlFlowClarity = this.assessControlFlowClarity(output);
    
    // String decoding - check if string arrays/encoding was resolved
    const stringDecoding = this.assessStringDecoding(output);
    
    // Dead code removal - check if dead code was eliminated
    const deadCodeRemoval = this.assessDeadCodeRemoval(output);
    
    // Overall readability score
    const overallReadability = (identifierRecovery + controlFlowClarity + stringDecoding + deadCodeRemoval) / 4;

    return {
      identifierRecovery,
      controlFlowClarity,
      stringDecoding,
      deadCodeRemoval,
      overallReadability
    };
  }

  private assessIdentifierRecovery(output: string): number {
    // Count meaningful vs obfuscated identifiers
    const meaningfulNames = (output.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [])
      .filter(name => !name.match(/^_0x[a-f0-9]+$/i) && name.length > 2);
    
    const obfuscatedNames = (output.match(/_0x[a-f0-9]+/gi) || []).length;
    const totalIdentifiers = meaningfulNames.length + obfuscatedNames;
    
    return totalIdentifiers > 0 ? meaningfulNames.length / totalIdentifiers : 0;
  }

  private assessControlFlowClarity(output: string): number {
    // Check for natural control flow vs obfuscated patterns
    const naturalPatterns = [
      /\bif\s*\([^)]*\)\s*{/g,
      /\bfor\s*\([^)]*;[^)]*;[^)]*\)\s*{/g,
      /\bwhile\s*\([^)]*\)\s*{/g,
      /\bfunction\s+\w+\s*\([^)]*\)\s*{/g
    ];
    
    const obfuscatedPatterns = [
      /switch\s*\([^)]*\)\s*{[^}]*case\s+0x[0-9a-f]+/gi,
      /while\s*\(true\)\s*{[^}]*switch/gi
    ];
    
    const naturalCount = naturalPatterns.reduce((sum, pattern) => 
      sum + (output.match(pattern) || []).length, 0);
    const obfuscatedCount = obfuscatedPatterns.reduce((sum, pattern) => 
      sum + (output.match(pattern) || []).length, 0);
    
    const totalStructures = naturalCount + obfuscatedCount;
    return totalStructures > 0 ? naturalCount / totalStructures : 0.5;
  }

  private assessStringDecoding(output: string): number {
    // Check if string arrays and encoding was resolved
    const stringArrays = (output.match(/_0x[a-f0-9]+\[0x[a-f0-9]+\]/gi) || []).length;
    const encodedStrings = (output.match(/\\x[0-9a-f]{2}/gi) || []).length;
    const totalStrings = (output.match(/"[^"]*"/g) || []).length;
    
    if (totalStrings === 0) return 0.5;
    
    const obfuscatedStrings = stringArrays + encodedStrings;
    return Math.max(0, 1 - (obfuscatedStrings / totalStrings));
  }

  private assessDeadCodeRemoval(output: string): number {
    // Check for common dead code patterns
    const deadCodePatterns = [
      /if\s*\(\s*false\s*\)/gi,
      /undefined\s*\|\|\s*null/gi,
      /void\s+0/gi,
      /!\!''/gi
    ];
    
    const deadCodeCount = deadCodePatterns.reduce((sum, pattern) => 
      sum + (output.match(pattern) || []).length, 0);
    
    // Lower score if dead code remains
    return Math.max(0, 1 - (deadCodeCount * 0.1));
  }

  private assessTechniqueCoverage(output: string, sample: TestSample): Record<string, boolean> {
    const coverage: Record<string, boolean> = {};
    
    for (const technique of sample.obfuscationTechniques) {
      switch (technique) {
        case 'string_array_obfuscation':
          coverage[technique] = !(output.match(/_0x[a-f0-9]+\[/gi) || []).length;
          break;
        case 'identifier_renaming':
          coverage[technique] = !(output.match(/_0x[a-f0-9]+/gi) || []).length;
          break;
        case 'control_flow_flattening':
          coverage[technique] = !(output.match(/switch.*case\s+0x/gi) || []).length;
          break;
        case 'dead_code_insertion':
          coverage[technique] = !(output.match(/if\s*\(\s*false\s*\)/gi) || []).length;
          break;
        case 'eval_patterns':
          coverage[technique] = !(output.match(/eval\s*\(/gi) || []).length;
          break;
        default:
          coverage[technique] = false;
      }
    }
    
    return coverage;
  }

  /**
   * Analyze benchmark results and generate insights
   */
  private analyzeResults(
    tools: DeobfuscationTool[], 
    samples: TestSample[], 
    results: BenchmarkResult[]
  ): CompetitiveAnalysis {
    
    // Calculate tool rankings
    const toolStats = new Map<string, {
      successes: number;
      totalTime: number;
      totalQuality: number;
      count: number;
    }>();

    for (const result of results) {
      if (!toolStats.has(result.tool)) {
        toolStats.set(result.tool, { successes: 0, totalTime: 0, totalQuality: 0, count: 0 });
      }
      
      const stats = toolStats.get(result.tool)!;
      if (result.success) stats.successes++;
      stats.totalTime += result.processingTime;
      stats.totalQuality += result.qualityMetrics.overallReadability;
      stats.count++;
    }

    const toolRankings = Array.from(toolStats.entries()).map(([tool, stats]) => ({
      tool,
      overallScore: (stats.successes / stats.count) * 0.5 + (stats.totalQuality / stats.count) * 0.5,
      successRate: stats.successes / stats.count,
      avgProcessingTime: stats.totalTime / stats.count,
      avgQualityScore: stats.totalQuality / stats.count
    })).sort((a, b) => b.overallScore - a.overallScore);

    // Analyze technique coverage
    const techniqueAnalysis: Record<string, {
      toolsSucceeded: string[];
      avgSuccessRate: number;
      bestTool: string;
    }> = {};

    const allTechniques = new Set(samples.flatMap(s => s.obfuscationTechniques));
    
    for (const technique of allTechniques) {
      const relevantResults = results.filter(r => {
        const sample = samples.find(s => s.name === r.sample);
        return sample?.obfuscationTechniques.includes(technique);
      });

      const toolSuccess = new Map<string, number>();
      const toolTotal = new Map<string, number>();

      for (const result of relevantResults) {
        toolTotal.set(result.tool, (toolTotal.get(result.tool) || 0) + 1);
        if (result.techniqueCoverage[technique]) {
          toolSuccess.set(result.tool, (toolSuccess.get(result.tool) || 0) + 1);
        }
      }

      const toolSuccessRates = Array.from(toolTotal.entries()).map(([tool, total]) => ({
        tool,
        rate: (toolSuccess.get(tool) || 0) / total
      }));

      techniqueAnalysis[technique] = {
        toolsSucceeded: toolSuccessRates.filter(t => t.rate > 0.5).map(t => t.tool),
        avgSuccessRate: toolSuccessRates.reduce((sum, t) => sum + t.rate, 0) / toolSuccessRates.length,
        bestTool: toolSuccessRates.reduce((best, current) => 
          current.rate > best.rate ? current : best
        ).tool
      };
    }

    // Scalability analysis
    const scalabilityAnalysis = toolRankings.map(tool => {
      const toolResults = results.filter(r => r.tool === tool.tool && r.success);
      
      if (toolResults.length < 2) {
        return {
          tool: tool.tool,
          scalabilityFactor: 1.0,
          memoryEfficiency: 1.0
        };
      }

      // Sort by input size
      toolResults.sort((a, b) => {
        const sampleA = samples.find(s => s.name === a.sample);
        const sampleB = samples.find(s => s.name === b.sample);
        return (sampleA?.size || 0) - (sampleB?.size || 0);
      });

      const smallest = toolResults[0];
      const largest = toolResults[toolResults.length - 1];
      const smallestSample = samples.find(s => s.name === smallest.sample);
      const largestSample = samples.find(s => s.name === largest.sample);

      const sizeRatio = (largestSample?.size || 1) / (smallestSample?.size || 1);
      const timeRatio = largest.processingTime / smallest.processingTime;
      const scalabilityFactor = timeRatio / Math.max(sizeRatio, 1);

      const avgMemoryUsage = toolResults.reduce((sum, r) => sum + r.memoryUsage, 0) / toolResults.length;
      const memoryEfficiency = 1 / (avgMemoryUsage / 1024 / 1024 + 1); // Normalize by MB

      return {
        tool: tool.tool,
        scalabilityFactor,
        memoryEfficiency
      };
    });

    return {
      executedAt: new Date().toISOString(),
      tools,
      samples,
      results,
      summary: {
        toolRankings,
        techniqueAnalysis,
        scalabilityAnalysis
      }
    };
  }

  /**
   * Generate comprehensive competitive analysis report
   */
  generateReport(analysis: CompetitiveAnalysis): string {
    let report = `# JavaScript Deobfuscation Tools - Competitive Analysis\n\n`;
    report += `**Generated**: ${analysis.executedAt}\n`;
    report += `**Tools Tested**: ${analysis.tools.length}\n`;
    report += `**Test Samples**: ${analysis.samples.length}\n`;
    report += `**Total Benchmarks**: ${analysis.results.length}\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    const topTool = analysis.summary.toolRankings[0];
    report += `**Best Overall Tool**: ${topTool.tool} (Score: ${(topTool.overallScore * 100).toFixed(1)}%)\n`;
    report += `- Success Rate: ${(topTool.successRate * 100).toFixed(1)}%\n`;
    report += `- Avg Processing Time: ${topTool.avgProcessingTime.toFixed(2)}ms\n`;
    report += `- Avg Quality Score: ${(topTool.avgQualityScore * 100).toFixed(1)}%\n\n`;

    // Tool Rankings
    report += `## Tool Rankings\n\n`;
    report += `| Rank | Tool | Overall Score | Success Rate | Avg Time (ms) | Quality Score |\n`;
    report += `|------|------|---------------|--------------|---------------|---------------|\n`;
    
    analysis.summary.toolRankings.forEach((tool, index) => {
      report += `| ${index + 1} | ${tool.tool} | ${(tool.overallScore * 100).toFixed(1)}% | ${(tool.successRate * 100).toFixed(1)}% | ${tool.avgProcessingTime.toFixed(2)} | ${(tool.avgQualityScore * 100).toFixed(1)}% |\n`;
    });

    report += `\n`;

    // ArachneJS Position Analysis
    const arachneRanking = analysis.summary.toolRankings.find(t => t.tool === 'ArachneJS');
    if (arachneRanking) {
      const arachneRank = analysis.summary.toolRankings.indexOf(arachneRanking) + 1;
      report += `### ArachneJS Competitive Position\n\n`;
      report += `**Current Ranking**: #${arachneRank} out of ${analysis.summary.toolRankings.length} tools\n\n`;
      
      if (arachneRank === 1) {
        report += `🏆 **Market Leader** - ArachneJS outperforms all competitors\n\n`;
        report += `**Key Advantages**:\n`;
        report += `- Highest overall deobfuscation success rate\n`;
        report += `- Superior output quality and readability\n`;
        report += `- Advanced IR-based analysis capabilities\n\n`;
      } else if (arachneRank <= 3) {
        report += `🥈 **Strong Competitor** - ArachneJS is among the top performers\n\n`;
        const topTool = analysis.summary.toolRankings[0];
        const scoreDiff = ((topTool.overallScore - arachneRanking.overallScore) * 100).toFixed(1);
        report += `**Gap to Leader**: ${scoreDiff}% behind ${topTool.tool}\n\n`;
      } else {
        report += `⚠️  **Development Needed** - ArachneJS has room for improvement\n\n`;
        const topTool = analysis.summary.toolRankings[0];
        const scoreDiff = ((topTool.overallScore - arachneRanking.overallScore) * 100).toFixed(1);
        report += `**Performance Gap**: ${scoreDiff}% behind market leader ${topTool.tool}\n\n`;
      }

      // Strengths and weaknesses analysis
      report += `**Strengths**:\n`;
      if (arachneRanking.successRate >= topTool.successRate * 0.9) {
        report += `- ✅ Competitive success rate (${(arachneRanking.successRate * 100).toFixed(1)}%)\n`;
      }
      if (arachneRanking.avgQualityScore >= topTool.avgQualityScore * 0.9) {
        report += `- ✅ High-quality output (${(arachneRanking.avgQualityScore * 100).toFixed(1)}%)\n`;
      }
      if (arachneRanking.avgProcessingTime <= topTool.avgProcessingTime * 1.1) {
        report += `- ✅ Competitive processing speed (${arachneRanking.avgProcessingTime.toFixed(2)}ms)\n`;
      }

      report += `\n**Areas for Improvement**:\n`;
      if (arachneRanking.successRate < topTool.successRate * 0.9) {
        report += `- ❌ Success rate needs improvement (${((topTool.successRate - arachneRanking.successRate) * 100).toFixed(1)}% gap)\n`;
      }
      if (arachneRanking.avgQualityScore < topTool.avgQualityScore * 0.9) {
        report += `- ❌ Output quality needs enhancement (${((topTool.avgQualityScore - arachneRanking.avgQualityScore) * 100).toFixed(1)}% gap)\n`;
      }
      if (arachneRanking.avgProcessingTime > topTool.avgProcessingTime * 1.1) {
        report += `- ❌ Processing speed needs optimization (${(arachneRanking.avgProcessingTime - topTool.avgProcessingTime).toFixed(2)}ms slower)\n`;
      }
      
      report += `\n`;
    }

    // Technique Analysis
    report += `## Obfuscation Technique Coverage\n\n`;
    report += `| Technique | Best Tool | Success Rate | Tools Succeeded |\n`;
    report += `|-----------|-----------|--------------|------------------|\n`;
    
    Object.entries(analysis.summary.techniqueAnalysis).forEach(([technique, data]) => {
      report += `| ${technique} | ${data.bestTool} | ${(data.avgSuccessRate * 100).toFixed(1)}% | ${data.toolsSucceeded.join(', ')} |\n`;
    });

    report += `\n`;

    // Scalability Analysis
    report += `## Scalability Analysis\n\n`;
    report += `| Tool | Scalability Factor | Memory Efficiency |\n`;
    report += `|------|-------------------|-------------------|\n`;
    
    analysis.summary.scalabilityAnalysis.forEach(tool => {
      const scalabilityGrade = tool.scalabilityFactor < 1.5 ? '✅' : tool.scalabilityFactor < 2.0 ? '⚠️' : '❌';
      report += `| ${tool.tool} | ${scalabilityGrade} ${tool.scalabilityFactor.toFixed(2)} | ${(tool.memoryEfficiency * 100).toFixed(1)}% |\n`;
    });

    report += `\n**Scalability Factor Interpretation**:\n`;
    report += `- < 1.5: ✅ Excellent (sub-linear scaling)\n`;
    report += `- 1.5-2.0: ⚠️ Good (linear scaling)\n`;
    report += `- > 2.0: ❌ Poor (super-linear scaling)\n\n`;

    // Detailed Results
    report += `## Detailed Results\n\n`;
    
    // Group results by tool
    const resultsByTool = new Map<string, BenchmarkResult[]>();
    analysis.results.forEach(result => {
      if (!resultsByTool.has(result.tool)) {
        resultsByTool.set(result.tool, []);
      }
      resultsByTool.get(result.tool)!.push(result);
    });

    resultsByTool.forEach((results, tool) => {
      report += `### ${tool}\n\n`;
      report += `| Sample | Status | Time (ms) | Quality | Techniques Handled |\n`;
      report += `|--------|--------|-----------|---------|--------------------|\n`;
      
      results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const quality = (result.qualityMetrics.overallReadability * 100).toFixed(1) + '%';
        const techniques = Object.entries(result.techniqueCoverage)
          .filter(([_, handled]) => handled)
          .map(([technique, _]) => technique)
          .join(', ') || 'None';
        
        report += `| ${result.sample} | ${status} | ${result.processingTime.toFixed(2)} | ${quality} | ${techniques} |\n`;
      });
      
      report += `\n`;
    });

    // Recommendations
    report += `## Strategic Recommendations\n\n`;
    
    if (arachneRanking) {
      const arachneRank = analysis.summary.toolRankings.indexOf(arachneRanking) + 1;
      
      if (arachneRank === 1) {
        report += `### Market Leadership Strategy\n`;
        report += `- **Maintain Advantage**: Continue investing in IR-based analysis and advanced optimization\n`;
        report += `- **Expand Coverage**: Add support for emerging obfuscation techniques\n`;
        report += `- **Performance Tuning**: Optimize for even faster processing on large files\n`;
        report += `- **Ecosystem**: Build integrations and developer tools around ArachneJS\n\n`;
      } else {
        report += `### Competitive Improvement Strategy\n`;
        const topTool = analysis.summary.toolRankings[0];
        
        report += `**Priority 1 - Address Core Gaps**:\n`;
        if (arachneRanking.successRate < topTool.successRate) {
          report += `- Improve success rate by ${((topTool.successRate - arachneRanking.successRate) * 100).toFixed(1)}%\n`;
        }
        if (arachneRanking.avgQualityScore < topTool.avgQualityScore) {
          report += `- Enhance output quality by ${((topTool.avgQualityScore - arachneRanking.avgQualityScore) * 100).toFixed(1)}%\n`;
        }

        report += `\n**Priority 2 - Leverage Unique Advantages**:\n`;
        report += `- Emphasize sophisticated IR analysis capabilities\n`;
        report += `- Highlight constraint solving and symbolic execution features\n`;
        report += `- Showcase comprehensive testing and validation framework\n\n`;

        report += `**Priority 3 - Technique-Specific Improvements**:\n`;
        Object.entries(analysis.summary.techniqueAnalysis).forEach(([technique, data]) => {
          if (!data.toolsSucceeded.includes('ArachneJS') && data.avgSuccessRate > 0.5) {
            report += `- Add support for ${technique} (currently handled by: ${data.toolsSucceeded.join(', ')})\n`;
          }
        });
        
        report += `\n`;
      }
    }

    // Technical Analysis
    report += `## Technical Analysis\n\n`;
    report += `### Architecture Comparison\n\n`;
    report += `**ArachneJS Unique Advantages**:\n`;
    report += `- 🧠 **IR-Based Analysis**: Multi-pass optimization pipeline with CFG and SSA\n`;
    report += `- 🔍 **Constraint Solving**: Z3 SMT solver integration for symbolic execution\n`;
    report += `- 🏗️ **Bytecode Lifting**: QuickJS/V8 bytecode analysis capabilities\n`;
    report += `- 🛡️ **Sandboxed Execution**: Safe evaluation with policy enforcement\n`;
    report += `- 🧪 **Property-Based Testing**: Comprehensive validation framework\n\n`;

    report += `**Competitor Approaches**:\n`;
    report += `- **Synchrony/Webcrack**: Pattern-based transformations with heuristics\n`;
    report += `- **Restringer**: Abstract syntax tree transformations\n`;
    report += `- **UnuglifyJS**: Statistical analysis and machine learning\n`;
    report += `- **De4js**: Web-based pattern matching and unpacking\n\n`;

    // Future Outlook
    report += `## Future Outlook\n\n`;
    report += `### Emerging Trends\n`;
    report += `- **LLM Integration**: GPT-4 and specialized models showing promise for deobfuscation\n`;
    report += `- **WebAssembly**: Growing need for WASM deobfuscation capabilities\n`;
    report += `- **AI-Generated Obfuscation**: More sophisticated obfuscation requiring advanced analysis\n`;
    report += `- **Real-Time Processing**: Demand for faster deobfuscation in security tools\n\n`;

    report += `### ArachneJS Positioning\n`;
    if (arachneRanking && analysis.summary.toolRankings.indexOf(arachneRanking) === 0) {
      report += `- **Strong Foundation**: Current market leadership provides excellent base for future development\n`;
      report += `- **Technical Innovation**: IR-based approach positions well for handling advanced obfuscation\n`;
      report += `- **Research Integration**: Academic-quality analysis framework enables cutting-edge features\n`;
    } else {
      report += `- **Architectural Potential**: IR-based approach has significant untapped potential\n`;
      report += `- **Need for Optimization**: Current performance gaps require focused development effort\n`;
      report += `- **Differentiation Strategy**: Unique technical approach provides clear differentiation path\n`;
    }

    report += `\n---\n\n`;
    report += `*This analysis was generated using ${analysis.results.length} benchmarks across ${analysis.tools.length} tools and ${analysis.samples.length} test samples.*\n`;
    report += `*For detailed methodology and raw results, see the accompanying data files.*\n`;

    return report;
  }

  /**
   * Save analysis results and report
   */
  async saveResults(analysis: CompetitiveAnalysis, outputDir: string = this.workDir): Promise<void> {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Save raw results as JSON
    const resultsFile = join(outputDir, 'competitive-analysis-results.json');
    writeFileSync(resultsFile, JSON.stringify(analysis, null, 2));

    // Generate and save report
    const report = this.generateReport(analysis);
    const reportFile = join(outputDir, 'competitive-analysis-report.md');
    writeFileSync(reportFile, report);

    // Save summary CSV for spreadsheet analysis
    const csvLines = ['Tool,Success Rate,Avg Time (ms),Quality Score,Overall Score'];
    analysis.summary.toolRankings.forEach(tool => {
      csvLines.push([
        tool.tool,
        (tool.successRate * 100).toFixed(1),
        tool.avgProcessingTime.toFixed(2),
        (tool.avgQualityScore * 100).toFixed(1),
        (tool.overallScore * 100).toFixed(1)
      ].join(','));
    });
    
    const csvFile = join(outputDir, 'competitive-analysis-summary.csv');
    writeFileSync(csvFile, csvLines.join('\n'));

    console.log(`\n📊 Analysis saved to:`);
    console.log(`  📄 Report: ${reportFile}`);
    console.log(`  📋 Raw data: ${resultsFile}`);
    console.log(`  📈 CSV summary: ${csvFile}`);
  }
}

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  async function main() {
    const benchmark = new CompetitiveBenchmark();
    
    try {
      console.log('🚀 Starting JavaScript Deobfuscation Competitive Analysis...\n');
      
      const analysis = await benchmark.runBenchmarks();
      await benchmark.saveResults(analysis);
      
      console.log('\n✅ Competitive analysis completed successfully!');
      
      // Show key findings
      const arachneRanking = analysis.summary.toolRankings.find(t => t.tool === 'ArachneJS');
      if (arachneRanking) {
        const rank = analysis.summary.toolRankings.indexOf(arachneRanking) + 1;
        const topTool = analysis.summary.toolRankings[0];
        
        console.log(`\n🎯 Key Findings:`);
        console.log(`  ArachneJS Rank: #${rank} out of ${analysis.summary.toolRankings.length} tools`);
        console.log(`  Success Rate: ${(arachneRanking.successRate * 100).toFixed(1)}%`);
        console.log(`  Quality Score: ${(arachneRanking.avgQualityScore * 100).toFixed(1)}%`);
        
        if (rank === 1) {
          console.log(`  🏆 ArachneJS is the top performer!`);
        } else {
          const gap = ((topTool.overallScore - arachneRanking.overallScore) * 100).toFixed(1);
          console.log(`  📈 Gap to leader (${topTool.tool}): ${gap}%`);
        }
      }
      
    } catch (error) {
      console.error('❌ Competitive analysis failed:', error);
      process.exit(1);
    }
  }

  main().catch(console.error);
}