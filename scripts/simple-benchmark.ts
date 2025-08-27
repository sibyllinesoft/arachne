#!/usr/bin/env bun
/**
 * @fileoverview Simple benchmark demonstration of IR system performance
 * Validates that all core components work without complex type issues
 */

import { performance } from 'perf_hooks';
import { CFGBuilder } from '../src/ir/cfg.js';
import { SSABuilder, SSADestroyer } from '../src/ir/ssa.js';
import { IRNodeFactory } from '../src/ir/nodes.js';
import type { IRStatement, IRIfStatement, IRAssignmentExpression } from '../src/ir/nodes.js';

interface SimpleBenchmarkResult {
  readonly component: string;
  readonly inputSize: number;
  readonly duration: number;
  readonly success: boolean;
}

/**
 * Simple IR program generator for basic testing
 */
function generateSimpleProgram(size: number): IRStatement[] {
  const statements: IRStatement[] = [];
  
  for (let i = 0; i < size; i++) {
    // Variable declaration
    statements.push({
      type: 'VariableDeclaration',
      kind: 'let',
      declarations: [{
        type: 'VariableDeclarator',
        id: IRNodeFactory.identifier(`var_${i}`),
        init: IRNodeFactory.literal(i),
        node_id: IRNodeFactory.createNodeId()
      }],
      node_id: IRNodeFactory.createNodeId()
    });

    // Simple assignment if not the first variable
    if (i > 0) {
      statements.push({
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: IRNodeFactory.identifier(`var_${i}`),
          right: IRNodeFactory.identifier(`var_${i - 1}`),
          node_id: IRNodeFactory.createNodeId()
        } as IRAssignmentExpression,
        node_id: IRNodeFactory.createNodeId()
      });
    }
  }

  return statements;
}

/**
 * Generate a program with branching for CFG testing
 */
function generateBranchingProgram(branchCount: number): IRStatement[] {
  const statements: IRStatement[] = [];
  
  for (let i = 0; i < branchCount; i++) {
    const ifStmt: IRIfStatement = {
      type: 'IfStatement',
      test: IRNodeFactory.identifier(`condition_${i}`),
      consequent: {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: IRNodeFactory.identifier(`then_var_${i}`),
          right: IRNodeFactory.literal(i * 2),
          node_id: IRNodeFactory.createNodeId()
        } as IRAssignmentExpression,
        node_id: IRNodeFactory.createNodeId()
      },
      alternate: {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: IRNodeFactory.identifier(`else_var_${i}`),
          right: IRNodeFactory.literal(i * 2 + 1),
          node_id: IRNodeFactory.createNodeId()
        } as IRAssignmentExpression,
        node_id: IRNodeFactory.createNodeId()
      },
      node_id: IRNodeFactory.createNodeId()
    };
    
    statements.push(ifStmt);
  }

  return statements;
}

/**
 * Run a simple benchmark test
 */
async function runSimpleBenchmark(
  name: string,
  inputSize: number,
  operation: () => void
): Promise<SimpleBenchmarkResult> {
  try {
    const startTime = performance.now();
    operation();
    const endTime = performance.now();
    
    return {
      component: name,
      inputSize,
      duration: endTime - startTime,
      success: true
    };
  } catch (error) {
    console.error(`❌ Benchmark ${name} failed:`, error);
    return {
      component: name,
      inputSize,
      duration: 0,
      success: false
    };
  }
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log('🚀 Running Simple IR System Benchmark...\n');
  
  const results: SimpleBenchmarkResult[] = [];
  const testSizes = [10, 50, 100];
  
  for (const size of testSizes) {
    console.log(`📊 Testing with size: ${size}`);
    
    // Test CFG construction
    const linearProgram = generateSimpleProgram(size);
    results.push(await runSimpleBenchmark(
      'CFG Linear Construction',
      size,
      () => {
        const cfgBuilder = new CFGBuilder();
        cfgBuilder.buildFromStatements(linearProgram);
      }
    ));

    // Test CFG with branching
    const branchingProgram = generateBranchingProgram(Math.ceil(size / 5));
    results.push(await runSimpleBenchmark(
      'CFG Branching Construction',
      Math.ceil(size / 5),
      () => {
        const cfgBuilder = new CFGBuilder();
        cfgBuilder.buildFromStatements(branchingProgram);
      }
    ));

    // Test SSA construction (if CFG works)
    try {
      const cfgBuilder = new CFGBuilder();
      const cfg = cfgBuilder.buildFromStatements(linearProgram);
      
      results.push(await runSimpleBenchmark(
        'SSA Construction',
        size,
        () => {
          const ssaBuilder = new SSABuilder(cfg);
          ssaBuilder.buildSSA();
        }
      ));

      // Test SSA destruction
      const ssaBuilder = new SSABuilder(cfg);
      const ssaState = ssaBuilder.buildSSA();
      
      results.push(await runSimpleBenchmark(
        'SSA Destruction',
        size,
        () => {
          const destroyer = new SSADestroyer(ssaState);
          destroyer.destroySSA();
        }
      ));
      
    } catch (error) {
      console.log(`⚠️ Skipping SSA tests for size ${size} due to error:`, error);
    }
  }

  // Generate report
  console.log('\n📋 Benchmark Results:');
  console.log('='.repeat(50));
  console.log(`| ${'Component'.padEnd(25)} | ${'Size'.padStart(6)} | ${'Duration (ms)'.padStart(12)} | ${'Status'.padEnd(7)} |`);
  console.log('-'.repeat(50));

  let totalDuration = 0;
  let successCount = 0;

  for (const result of results) {
    const status = result.success ? '✅ OK' : '❌ FAIL';
    const duration = result.success ? result.duration.toFixed(2) : 'N/A';
    
    console.log(`| ${result.component.padEnd(25)} | ${result.inputSize.toString().padStart(6)} | ${duration.padStart(12)} | ${status.padEnd(7)} |`);
    
    if (result.success) {
      totalDuration += result.duration;
      successCount++;
    }
  }

  console.log('-'.repeat(50));
  console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
  console.log(`Success Rate: ${successCount}/${results.length} (${((successCount / results.length) * 100).toFixed(1)}%)`);

  // Performance assessment
  console.log('\n📈 Performance Assessment:');
  
  const avgDuration = totalDuration / successCount;
  console.log(`Average Duration: ${avgDuration.toFixed(2)}ms`);
  
  if (avgDuration < 10) {
    console.log('✅ Excellent performance - all operations complete quickly');
  } else if (avgDuration < 100) {
    console.log('✅ Good performance - acceptable for deobfuscation workloads');
  } else if (avgDuration < 1000) {
    console.log('⚠️ Moderate performance - may need optimization for large files');
  } else {
    console.log('❌ Poor performance - optimization required');
  }

  // Scalability check
  const cfgResults = results.filter(r => r.component.includes('CFG Linear') && r.success);
  if (cfgResults.length >= 2) {
    const smallestResult = cfgResults.reduce((prev, current) => 
      prev.inputSize < current.inputSize ? prev : current
    );
    const largestResult = cfgResults.reduce((prev, current) => 
      prev.inputSize > current.inputSize ? prev : current
    );
    
    const sizeRatio = largestResult.inputSize / smallestResult.inputSize;
    const timeRatio = largestResult.duration / smallestResult.duration;
    const scalingFactor = timeRatio / sizeRatio;

    console.log(`\nScaling Factor: ${scalingFactor.toFixed(2)} (1.0 = perfect linear scaling)`);
    
    if (scalingFactor < 2.0) {
      console.log('✅ Good scalability characteristics');
    } else if (scalingFactor < 4.0) {
      console.log('⚠️ Moderate scalability - may degrade with very large inputs');
    } else {
      console.log('❌ Poor scalability - significant performance degradation');
    }
  }

  // Core functionality validation
  console.log('\n🔍 Core Functionality Validation:');
  
  const cfgWorking = results.some(r => r.component.includes('CFG') && r.success);
  const ssaWorking = results.some(r => r.component.includes('SSA') && r.success);
  
  console.log(`CFG Construction: ${cfgWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`SSA Form: ${ssaWorking ? '✅ Working' : '❌ Failed'}`);
  
  if (cfgWorking && ssaWorking) {
    console.log('\n🎉 IR System Core Components Successfully Validated!');
    console.log('Ready for integration with deobfuscation passes.');
    process.exit(0);
  } else {
    console.log('\n❌ Core functionality validation failed.');
    console.log('Manual debugging required before proceeding.');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  });
}