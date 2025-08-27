/**
 * @fileoverview Differential testing framework for bytecode lifters
 * 
 * Compares outputs between different analysis paths, manages golden files,
 * validates semantic equivalence, and detects performance regressions.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import type {
  BytecodeLifter,
  BytecodeModule,
  ValidationReport,
  LiftResult,
} from '../../src/lifters/base.js';
import type { IRProgram, IRNode } from '../../src/ir/nodes.js';
import { IRNodeFactory } from '../../src/ir/nodes.js';

/**
 * Test case definition
 */
export interface DifferentialTestCase {
  readonly name: string;
  readonly description: string;
  readonly bytecodeFile: string;
  readonly expectedFormat: string;
  readonly timeout: number;
  readonly tags: readonly string[];
  readonly goldenFile?: string;
  readonly performanceBaseline?: PerformanceBaseline;
}

/**
 * Performance baseline metrics
 */
export interface PerformanceBaseline {
  readonly parseTimeMs: number;
  readonly liftTimeMs: number;
  readonly memoryUsageMB: number;
  readonly irNodeCount: number;
  readonly timestamp: string;
}

/**
 * Test execution result
 */
export interface TestResult {
  readonly testCase: DifferentialTestCase;
  readonly success: boolean;
  readonly error?: string;
  readonly parseResult?: LiftResult<BytecodeModule>;
  readonly liftResult?: LiftResult<IRProgram>;
  readonly validationResult?: LiftResult<ValidationReport>;
  readonly performance: PerformanceMetrics;
  readonly goldenMatch: boolean;
  readonly semanticEquivalence: number; // 0.0 to 1.0
  readonly regressionDetected: boolean;
}

export interface PerformanceMetrics {
  readonly parseTimeMs: number;
  readonly liftTimeMs: number;
  readonly validationTimeMs: number;
  readonly totalTimeMs: number;
  readonly peakMemoryMB: number;
  readonly irNodeCount: number;
}

/**
 * Golden file management
 */
export interface GoldenFile {
  readonly testName: string;
  readonly irProgram: IRProgram;
  readonly metadata: {
    readonly timestamp: string;
    readonly lifterVersion: string;
    readonly hash: string;
  };
}

/**
 * Semantic equivalence checker
 */
class SemanticEquivalenceChecker {
  /**
   * Compare two IR programs for semantic equivalence
   */
  compare(program1: IRProgram, program2: IRProgram): number {
    try {
      // Structural comparison
      const structuralScore = this.compareStructure(program1, program2);
      
      // Control flow comparison
      const controlFlowScore = this.compareControlFlow(program1, program2);
      
      // Data flow comparison
      const dataFlowScore = this.compareDataFlow(program1, program2);
      
      // Weighted average
      return (structuralScore * 0.4 + controlFlowScore * 0.3 + dataFlowScore * 0.3);
      
    } catch (error) {
      console.warn('Semantic equivalence check failed:', error);
      return 0.0;
    }
  }

  private compareStructure(program1: IRProgram, program2: IRProgram): number {
    // Compare basic structure (function count, statement types, etc.)
    if (program1.body.length !== program2.body.length) {
      return 0.5; // Partial match
    }

    let matches = 0;
    const total = program1.body.length;

    for (let i = 0; i < total; i++) {
      const stmt1 = program1.body[i];
      const stmt2 = program2.body[i];
      
      if (stmt1.type === stmt2.type) {
        matches++;
      }
    }

    return total > 0 ? matches / total : 1.0;
  }

  private compareControlFlow(program1: IRProgram, program2: IRProgram): number {
    // Compare control flow patterns
    const cfg1 = this.extractControlFlowPattern(program1);
    const cfg2 = this.extractControlFlowPattern(program2);
    
    return this.comparePatterns(cfg1, cfg2);
  }

  private compareDataFlow(program1: IRProgram, program2: IRProgram): number {
    // Compare data flow patterns
    const df1 = this.extractDataFlowPattern(program1);
    const df2 = this.extractDataFlowPattern(program2);
    
    return this.comparePatterns(df1, df2);
  }

  private extractControlFlowPattern(program: IRProgram): string[] {
    const patterns: string[] = [];
    
    const visit = (node: IRNode) => {
      switch (node.type) {
        case 'IfStatement':
          patterns.push('if');
          break;
        case 'WhileStatement':
          patterns.push('while');
          break;
        case 'ForStatement':
          patterns.push('for');
          break;
        case 'SwitchStatement':
          patterns.push('switch');
          break;
        case 'ReturnStatement':
          patterns.push('return');
          break;
        case 'ThrowStatement':
          patterns.push('throw');
          break;
        case 'TryStatement':
          patterns.push('try');
          break;
      }

      // Visit children based on type
      this.visitChildren(node, visit);
    };

    for (const stmt of program.body) {
      visit(stmt);
    }

    return patterns;
  }

  private extractDataFlowPattern(program: IRProgram): string[] {
    const patterns: string[] = [];
    
    const visit = (node: IRNode) => {
      switch (node.type) {
        case 'VariableDeclaration':
          patterns.push(`var:${(node as any).kind}`);
          break;
        case 'AssignmentExpression':
          patterns.push(`assign:${(node as any).operator}`);
          break;
        case 'BinaryExpression':
          patterns.push(`binary:${(node as any).operator}`);
          break;
        case 'UnaryExpression':
          patterns.push(`unary:${(node as any).operator}`);
          break;
        case 'CallExpression':
          patterns.push('call');
          break;
        case 'MemberExpression':
          patterns.push('member');
          break;
      }

      this.visitChildren(node, visit);
    };

    for (const stmt of program.body) {
      visit(stmt);
    }

    return patterns;
  }

  private visitChildren(node: IRNode, visitor: (node: IRNode) => void): void {
    // Simplified visitor - would need full implementation for all node types
    switch (node.type) {
      case 'BlockStatement':
        for (const stmt of (node as any).body) {
          visitor(stmt);
        }
        break;
      case 'IfStatement':
        visitor((node as any).test);
        visitor((node as any).consequent);
        if ((node as any).alternate) {
          visitor((node as any).alternate);
        }
        break;
      // Add more cases as needed
    }
  }

  private comparePatterns(patterns1: string[], patterns2: string[]): number {
    if (patterns1.length === 0 && patterns2.length === 0) {
      return 1.0;
    }
    
    if (patterns1.length === 0 || patterns2.length === 0) {
      return 0.0;
    }

    // Simple string similarity
    const set1 = new Set(patterns1);
    const set2 = new Set(patterns2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
}

/**
 * Main differential testing framework
 */
export class DifferentialTestFramework {
  private readonly goldenDir: string;
  private readonly equivalenceChecker = new SemanticEquivalenceChecker();

  constructor(goldenDir: string = './tests/differential/golden') {
    this.goldenDir = goldenDir;
  }

  /**
   * Run differential tests
   */
  async runTests(
    testCases: readonly DifferentialTestCase[],
    lifter: BytecodeLifter
  ): Promise<DifferentialTestSuite> {
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;
    let regressions = 0;

    for (const testCase of testCases) {
      try {
        const result = await this.runSingleTest(testCase, lifter);
        results.push(result);
        
        if (result.success) {
          passed++;
        } else {
          failed++;
        }
        
        if (result.regressionDetected) {
          regressions++;
        }
        
      } catch (error) {
        const failedResult: TestResult = {
          testCase,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          performance: {
            parseTimeMs: 0,
            liftTimeMs: 0,
            validationTimeMs: 0,
            totalTimeMs: 0,
            peakMemoryMB: 0,
            irNodeCount: 0,
          },
          goldenMatch: false,
          semanticEquivalence: 0.0,
          regressionDetected: false,
        };
        
        results.push(failedResult);
        failed++;
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
   * Run single test case
   */
  private async runSingleTest(
    testCase: DifferentialTestCase,
    lifter: BytecodeLifter
  ): Promise<TestResult> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      // Load bytecode file
      const bytecode = await fs.readFile(testCase.bytecodeFile);
      
      // Parse phase
      const parseStart = Date.now();
      const parseResult = await lifter.parse(bytecode);
      const parseEnd = Date.now();
      
      if (!parseResult.success) {
        throw new Error(`Parse failed: ${parseResult.error}`);
      }

      // Lift phase
      const liftStart = Date.now();
      const liftResult = await lifter.lift(bytecode);
      const liftEnd = Date.now();
      
      if (!liftResult.success) {
        throw new Error(`Lift failed: ${liftResult.error}`);
      }

      // Validation phase
      const validationStart = Date.now();
      const validationResult = await lifter.validate(parseResult.data, liftResult.data);
      const validationEnd = Date.now();

      // Performance metrics
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      const performance: PerformanceMetrics = {
        parseTimeMs: parseEnd - parseStart,
        liftTimeMs: liftEnd - liftStart,
        validationTimeMs: validationEnd - validationStart,
        totalTimeMs: endTime - startTime,
        peakMemoryMB: Math.max(0, endMemory - startMemory) / 1024 / 1024,
        irNodeCount: this.countIRNodes(liftResult.data),
      };

      // Golden file comparison
      const goldenMatch = await this.compareWithGolden(testCase, liftResult.data);
      
      // Semantic equivalence (if golden exists)
      let semanticEquivalence = 1.0;
      if (testCase.goldenFile) {
        const golden = await this.loadGolden(testCase.goldenFile);
        if (golden) {
          semanticEquivalence = this.equivalenceChecker.compare(liftResult.data, golden.irProgram);
        }
      }

      // Regression detection
      const regressionDetected = await this.detectRegression(testCase, performance);

      return {
        testCase,
        success: true,
        parseResult,
        liftResult,
        validationResult: validationResult.success ? validationResult : undefined,
        performance,
        goldenMatch,
        semanticEquivalence,
        regressionDetected,
      };

    } catch (error) {
      return {
        testCase,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        performance: {
          parseTimeMs: 0,
          liftTimeMs: 0,
          validationTimeMs: 0,
          totalTimeMs: Date.now() - startTime,
          peakMemoryMB: 0,
          irNodeCount: 0,
        },
        goldenMatch: false,
        semanticEquivalence: 0.0,
        regressionDetected: false,
      };
    }
  }

  /**
   * Compare with golden file
   */
  private async compareWithGolden(testCase: DifferentialTestCase, actual: IRProgram): boolean {
    if (!testCase.goldenFile) {
      return true; // No golden file to compare
    }

    try {
      const golden = await this.loadGolden(testCase.goldenFile);
      if (!golden) {
        return false;
      }

      // Hash-based comparison for exact match
      const actualHash = this.hashIRProgram(actual);
      const expectedHash = golden.metadata.hash;
      
      return actualHash === expectedHash;
      
    } catch (error) {
      console.warn(`Golden file comparison failed for ${testCase.name}:`, error);
      return false;
    }
  }

  /**
   * Load golden file
   */
  private async loadGolden(goldenFile: string): Promise<GoldenFile | null> {
    try {
      const goldenPath = join(this.goldenDir, goldenFile);
      const content = await fs.readFile(goldenPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Save golden file
   */
  async saveGolden(testCase: DifferentialTestCase, irProgram: IRProgram): Promise<void> {
    if (!testCase.goldenFile) {
      return;
    }

    const goldenFile: GoldenFile = {
      testName: testCase.name,
      irProgram,
      metadata: {
        timestamp: new Date().toISOString(),
        lifterVersion: '1.0.0', // Would read from package.json
        hash: this.hashIRProgram(irProgram),
      },
    };

    const goldenPath = join(this.goldenDir, testCase.goldenFile);
    await fs.mkdir(dirname(goldenPath), { recursive: true });
    await fs.writeFile(goldenPath, JSON.stringify(goldenFile, null, 2));
  }

  /**
   * Detect performance regression
   */
  private async detectRegression(
    testCase: DifferentialTestCase,
    current: PerformanceMetrics
  ): Promise<boolean> {
    if (!testCase.performanceBaseline) {
      return false;
    }

    const baseline = testCase.performanceBaseline;
    const REGRESSION_THRESHOLD = 1.2; // 20% slower is a regression
    
    const parseRegression = current.parseTimeMs > baseline.parseTimeMs * REGRESSION_THRESHOLD;
    const liftRegression = current.liftTimeMs > baseline.liftTimeMs * REGRESSION_THRESHOLD;
    const memoryRegression = current.peakMemoryMB > baseline.memoryUsageMB * REGRESSION_THRESHOLD;
    
    return parseRegression || liftRegression || memoryRegression;
  }

  /**
   * Hash IR program for comparison
   */
  private hashIRProgram(program: IRProgram): string {
    // Create a stable hash by serializing without node IDs
    const normalized = this.normalizeIRProgram(program);
    const serialized = JSON.stringify(normalized);
    return createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Normalize IR program for hashing
   */
  private normalizeIRProgram(program: IRProgram): any {
    // Remove node_id fields for stable comparison
    const normalize = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(normalize);
      }
      
      if (obj && typeof obj === 'object') {
        const normalized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key !== 'node_id') {
            normalized[key] = normalize(value);
          }
        }
        return normalized;
      }
      
      return obj;
    };

    return normalize(program);
  }

  /**
   * Count IR nodes for metrics
   */
  private countIRNodes(program: IRProgram): number {
    let count = 0;
    
    const visit = (node: any) => {
      if (node && typeof node === 'object') {
        if (node.type) {
          count++;
        }
        
        for (const value of Object.values(node)) {
          if (Array.isArray(value)) {
            value.forEach(visit);
          } else if (value && typeof value === 'object') {
            visit(value);
          }
        }
      }
    };

    visit(program);
    return count;
  }
}

/**
 * Test suite result
 */
export interface DifferentialTestSuite {
  readonly totalTests: number;
  readonly passed: number;
  readonly failed: number;
  readonly regressions: number;
  readonly results: readonly TestResult[];
  readonly overallSuccess: boolean;
}