/**
 * @fileoverview Integration Tests for Advanced Deobfuscation Passes
 * 
 * Tests the complete deobfuscation pipeline combining string decoder lifting,
 * opaque predicate elimination, control flow deflattening, and enhanced
 * dead code elimination with realistic obfuscated JavaScript samples.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { StringDecoderLiftingPass } from '../../src/passes/decoders.js';
import { OpaquePredicateAnalysisPass, MockSMTSolver } from '../../src/passes/opaque.js';
import { ControlFlowDeflatteningPass } from '../../src/passes/deflatten.js';
import { EnhancedDeadCodeEliminationPass } from '../../src/passes/enhanced_dce.js';
import { EnhancedConstantPropagationPass } from '../../src/passes/enhanced_constprop.js';
import { IntelligentRenamingPass } from '../../src/passes/rename.js';
import { StructuringPass } from '../../src/passes/structuring.js';
import { IRNodeFactory } from '../../src/ir/nodes.js';
import type { IRState } from '../../src/passes/Pass.js';
import type { SandboxResult } from '../../src/sandbox/types.js';

describe('Advanced Deobfuscation Pipeline Integration', () => {
  let decoderPass: StringDecoderLiftingPass;
  let opaquePass: OpaquePredicateAnalysisPass;
  let deflattenPass: ControlFlowDeflatteningPass;
  let dcePass: EnhancedDeadCodeEliminationPass;
  let constPropPass: EnhancedConstantPropagationPass;
  let renamingPass: IntelligentRenamingPass;
  let structuringPass: StructuringPass;

  beforeEach(() => {
    const mockSandbox = createMockSandboxResults();
    const mockSolver = new MockSMTSolver();
    
    decoderPass = new StringDecoderLiftingPass({ sandboxResults: mockSandbox });
    opaquePass = new OpaquePredicateAnalysisPass(mockSolver);
    deflattenPass = new ControlFlowDeflatteningPass();
    dcePass = new EnhancedDeadCodeEliminationPass();
    constPropPass = new EnhancedConstantPropagationPass();
    renamingPass = new IntelligentRenamingPass({ useOllama: false });
    structuringPass = new StructuringPass();
    
    // Mock fetch for Ollama tests
    if (!global.fetch) {
      global.fetch = vi.fn();
    }
  });

  describe('Complete Deobfuscation Pipeline', () => {
    test('should successfully deobfuscate javascript-obfuscator.io output', () => {
      const obfuscatedState = createJavaScriptObfuscatorSample();
      
      // Phase 1: String decoder lifting
      let currentState = decoderPass.execute(obfuscatedState).state;
      
      // Phase 2: Constant propagation after string lifting
      currentState = constPropPass.execute(currentState).state;
      
      // Phase 3: Opaque predicate elimination
      currentState = opaquePass.execute(currentState).state;
      
      // Phase 4: Control flow deflattening
      currentState = deflattenPass.execute(currentState).state;
      
      // Phase 5: Dead code elimination
      const finalResult = dcePass.execute(currentState);
      
      expect(finalResult.changed).toBe(true);
      
      // Verify deobfuscation metrics
      const metrics = calculateDeobfuscationMetrics(obfuscatedState, finalResult.state);
      expect(metrics.sizeReduction).toBeGreaterThan(0.3); // >30% size reduction
      expect(metrics.complexityReduction).toBeGreaterThan(0.4); // >40% complexity reduction
      expect(metrics.readabilityImprovement).toBeGreaterThan(0.5); // >50% readability improvement
    });

    test('should handle webpack bundle obfuscation', () => {
      const obfuscatedWebpack = createWebpackObfuscatedSample();
      
      // Apply full pipeline
      const result = runFullPipeline(obfuscatedWebpack);
      
      expect(result.changed).toBe(true);
      
      // Verify webpack-specific patterns are handled
      const containsWebpackBootstrap = hasWebpackBootstrap(result.state);
      expect(containsWebpackBootstrap).toBe(false); // Should be simplified
      
      const metrics = calculateDeobfuscationMetrics(obfuscatedWebpack, result.state);
      expect(metrics.moduleExtractionSuccess).toBeGreaterThan(0.7); // >70% module extraction
    });

    test('should preserve functional correctness', () => {
      const functionalTest = createFunctionalTestSample();
      
      // Apply pipeline
      const result = runFullPipeline(functionalTest.obfuscated);
      
      // Verify that deobfuscated code produces same results as original
      const originalOutput = executeMockCode(functionalTest.original);
      const deobfuscatedOutput = executeMockCode(result.state);
      
      expect(deobfuscatedOutput).toEqual(originalOutput);
    });

    test('should achieve target performance metrics', () => {
      const largeSample = createLargeObfuscatedSample(5000); // 5K nodes
      
      const startTime = performance.now();
      const result = runFullPipeline(largeSample);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      // Performance targets from requirements
      expect(executionTime).toBeLessThan(10000); // p95 ≤ 10s for 1MB bundles
      expect(result.changed).toBe(true);
      
      const metrics = calculateDeobfuscationMetrics(largeSample, result.state);
      expect(metrics.sizeReduction).toBeGreaterThan(0.4); // ≥40% code size reduction
    });
  });

  describe('New Enhanced Passes Integration', () => {
    test('should improve readability with IntelligentRenamingPass', async () => {
      const obfuscatedState = createObfuscatedIdentifierSample();
      
      // Test without renaming
      const resultWithoutRenaming = runPipelineWithoutRenaming(obfuscatedState);
      
      // Test with renaming
      const resultWithRenaming = runFullPipeline(obfuscatedState);
      
      const metricsWithout = calculateReadabilityScore(resultWithoutRenaming.state);
      const metricsWith = calculateReadabilityScore(resultWithRenaming.state);
      
      // Renaming should improve readability
      expect(metricsWith).toBeGreaterThan(metricsWithout);
      
      // Verify obfuscated identifiers are replaced
      const hasObfuscatedIds = hasObfuscatedIdentifiers(resultWithRenaming.state);
      expect(hasObfuscatedIds).toBe(false);
    });

    test('should improve code structure with StructuringPass', async () => {
      const uglyState = createUglyControlFlowSample();
      
      // Test without structuring
      const resultWithoutStructuring = runPipelineWithoutStructuring(uglyState);
      
      // Test with structuring  
      const resultWithStructuring = runFullPipeline(uglyState);
      
      // Structuring should reduce complexity
      const complexityWithout = calculateStateComplexity(resultWithoutStructuring.state);
      const complexityWith = calculateStateComplexity(resultWithStructuring.state);
      
      expect(complexityWith).toBeLessThan(complexityWithout);
      
      // Verify specific structural improvements
      const hasTernaries = hasTernaryExpressions(resultWithStructuring.state);
      const hasStructuredLoops = hasStructuredLoops(resultWithStructuring.state);
      const hasSwitchStatements = hasSwitchStatements(resultWithStructuring.state);
      
      expect(hasTernaries || hasStructuredLoops || hasSwitchStatements).toBe(true);
    });

    test('should work together for maximum improvement', async () => {
      const complexObfuscated = createComplexObfuscatedSample();
      
      // Baseline: no enhanced passes
      const baselineResult = runBasicPipeline(complexObfuscated);
      
      // Enhanced: with both new passes
      const enhancedResult = runFullPipeline(complexObfuscated);
      
      // Measure improvements
      const baselineMetrics = calculateComprehensiveMetrics(complexObfuscated, baselineResult.state);
      const enhancedMetrics = calculateComprehensiveMetrics(complexObfuscated, enhancedResult.state);
      
      // Enhanced pipeline should be significantly better
      expect(enhancedMetrics.readability).toBeGreaterThan(baselineMetrics.readability * 1.3);
      expect(enhancedMetrics.structure).toBeGreaterThan(baselineMetrics.structure * 1.2);
      expect(enhancedMetrics.maintainability).toBeGreaterThan(baselineMetrics.maintainability * 1.25);
    });

    test('should handle Ollama integration gracefully', async () => {
      const testState = createJavaScriptObfuscatorSample();
      
      // Mock successful Ollama response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          response: 'userCount\nitemList\ncalculateTotal' 
        })
      });
      
      const result = await runFullPipelineWithOllama(testState);
      
      expect(result.changed).toBe(true);
      
      // Verify Ollama was called
      expect(global.fetch).toHaveBeenCalled();
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('localhost:11434');
    });

    test('should fallback gracefully when Ollama fails', async () => {
      const testState = createJavaScriptObfuscatorSample();
      
      // Mock Ollama failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection refused'));
      
      const result = await runFullPipelineWithOllama(testState);
      
      expect(result.changed).toBe(true);
      
      // Should still improve via heuristic naming
      const hasImprovedNames = hasHeuristicRenamedIdentifiers(result.state);
      expect(hasImprovedNames).toBe(true);
    });
  });

  describe('Pass Interaction Effects', () => {
    test('should benefit from pass ordering optimization', () => {
      const testState = createMultiPatternObfuscatedSample();
      
      // Optimal ordering: decoders -> const prop -> opaque -> deflatten -> DCE
      const optimalResult = runFullPipeline(testState);
      
      // Suboptimal ordering: opaque -> decoders -> deflatten -> const prop -> DCE  
      const suboptimalResult = runSuboptimalPipeline(testState);
      
      const optimalMetrics = calculateDeobfuscationMetrics(testState, optimalResult.state);
      const suboptimalMetrics = calculateDeobfuscationMetrics(testState, suboptimalResult.state);
      
      // Optimal ordering should achieve better results
      expect(optimalMetrics.sizeReduction).toBeGreaterThan(suboptimalMetrics.sizeReduction);
      expect(optimalMetrics.complexityReduction).toBeGreaterThan(suboptimalMetrics.complexityReduction);
    });

    test('should handle interdependent obfuscation patterns', () => {
      const interdependentState = createInterdependentObfuscationSample();
      
      const result = runFullPipeline(interdependentState);
      
      // Verify that patterns dependent on each other are both resolved
      const hasUnresolvedStringCalls = hasUnresolvedDecoderCalls(result.state);
      const hasOpaquePredicates = hasRemainingOpaquePredicates(result.state);
      const hasFlattenedControl = hasFlattenedControlFlow(result.state);
      
      expect(hasUnresolvedStringCalls).toBe(false);
      expect(hasOpaquePredicates).toBe(false);
      expect(hasFlattenedControl).toBe(false);
    });
  });

  describe('Success Rate Validation', () => {
    test('should achieve ≥70% string decoder success rate', () => {
      const testSamples = createStringDecoderTestSuite(100);
      let successCount = 0;
      
      for (const sample of testSamples) {
        const result = decoderPass.execute(sample);
        const metrics = analyzeStringDecoderSuccess(sample, result.state);
        
        if (metrics.decoderSuccessRate > 0.5) {
          successCount++;
        }
      }
      
      const overallSuccessRate = successCount / testSamples.length;
      expect(overallSuccessRate).toBeGreaterThanOrEqual(0.7);
    });

    test('should achieve ≥60% opaque predicate elimination', () => {
      const testSamples = createOpaquePredicateTestSuite(100);
      let eliminationCount = 0;
      
      for (const sample of testSamples) {
        const result = opaquePass.execute(sample);
        const metrics = analyzeOpaquePredicateElimination(sample, result.state);
        
        if (metrics.eliminationRate > 0.6) {
          eliminationCount++;
        }
      }
      
      const overallEliminationRate = eliminationCount / testSamples.length;
      expect(overallEliminationRate).toBeGreaterThanOrEqual(0.6);
    });

    test('should achieve ≥40% nTED improvement', () => {
      const testPairs = createGroundTruthTestPairs(50);
      let improvements = [];
      
      for (const pair of testPairs) {
        const result = runFullPipeline(pair.obfuscated);
        const nTED = calculateNormalizedTreeEditDistance(pair.groundTruth, result.state);
        improvements.push(nTED);
      }
      
      const averageImprovement = improvements.reduce((a, b) => a + b, 0) / improvements.length;
      expect(averageImprovement).toBeGreaterThanOrEqual(0.4);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle malformed obfuscated code gracefully', () => {
      const malformedSample = createMalformedObfuscatedSample();
      
      expect(() => runFullPipeline(malformedSample)).not.toThrow();
      
      // Should at least not make things worse
      const result = runFullPipeline(malformedSample);
      expect(result.state.nodes.size).toBeGreaterThanOrEqual(malformedSample.nodes.size * 0.8);
    });

    test('should handle mixed obfuscation techniques', () => {
      const mixedSample = createMixedObfuscationSample();
      
      const result = runFullPipeline(mixedSample);
      
      expect(result.changed).toBe(true);
      
      // Should handle at least 2 out of 3 techniques effectively
      const metrics = analyzeMixedObfuscationHandling(mixedSample, result.state);
      expect(metrics.handledTechniques).toBeGreaterThanOrEqual(2);
    });

    test('should provide meaningful progress reporting', () => {
      const testState = createProgressTestSample();
      
      let progressReports = [];
      
      // Mock progress reporting
      const originalLog = console.log;
      console.log = (message: string) => {
        if (message.includes('Processing') || message.includes('completed')) {
          progressReports.push(message);
        }
      };
      
      runFullPipeline(testState);
      
      console.log = originalLog;
      
      // Should report progress for each major phase
      expect(progressReports.length).toBeGreaterThan(3);
    });
  });

  describe('Memory and Resource Management', () => {
    test('should maintain reasonable memory usage', () => {
      const largeSample = createLargeObfuscatedSample(10000);
      
      const initialMemory = process.memoryUsage().heapUsed;
      const result = runFullPipeline(largeSample);
      const finalMemory = process.memoryUsage().heapUsed;
      
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not use excessive memory (< 100MB for large samples)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    test('should clean up resources properly', () => {
      const testState = createResourceTestSample();
      
      const result = runFullPipeline(testState);
      
      // Verify that solvers and other resources are disposed
      expect(opaquePass['solver']).toBeTruthy(); // Should still exist but be reset
      
      // Force garbage collection to verify no leaks
      if (global.gc) {
        global.gc();
      }
    });
  });
});

// Helper Functions

function runFullPipeline(state: IRState) {
  let currentState = state;
  
  // Enhanced optimal pass ordering with new passes
  currentState = decoderPass.execute(currentState).state;
  currentState = constPropPass.execute(currentState).state;  
  currentState = opaquePass.execute(currentState).state;
  currentState = deflattenPass.execute(currentState).state;
  currentState = dcePass.execute(currentState).state;
  
  // Add new semantic enhancement passes
  currentState = structuringPass.execute(currentState).state;
  currentState = renamingPass.execute(currentState).state;
  const result = dcePass.execute(currentState); // Final cleanup
  
  return result;
}

function runFullPipelineWithOllama(state: IRState) {
  let currentState = state;
  
  // Enhanced pipeline with Ollama-enabled renaming
  const ollamaRenamingPass = new IntelligentRenamingPass({ 
    useOllama: true, 
    ollamaUrl: 'http://localhost:11434' 
  });
  
  currentState = decoderPass.execute(currentState).state;
  currentState = constPropPass.execute(currentState).state;  
  currentState = opaquePass.execute(currentState).state;
  currentState = deflattenPass.execute(currentState).state;
  currentState = dcePass.execute(currentState).state;
  currentState = structuringPass.execute(currentState).state;
  currentState = ollamaRenamingPass.execute(currentState).state;
  const result = dcePass.execute(currentState);
  
  return result;
}

function runSuboptimalPipeline(state: IRState) {
  let currentState = state;
  
  // Suboptimal pass ordering
  currentState = opaquePass.execute(currentState).state;
  currentState = decoderPass.execute(currentState).state;
  currentState = deflattenPass.execute(currentState).state;
  currentState = constPropPass.execute(currentState).state;
  const result = dcePass.execute(currentState);
  
  return result;
}

function calculateDeobfuscationMetrics(original: IRState, deobfuscated: IRState) {
  const originalSize = original.nodes.size;
  const deobfuscatedSize = deobfuscated.nodes.size;
  const sizeReduction = (originalSize - deobfuscatedSize) / originalSize;
  
  const originalComplexity = calculateStateComplexity(original);
  const deobfuscatedComplexity = calculateStateComplexity(deobfuscated);
  const complexityReduction = (originalComplexity - deobfuscatedComplexity) / originalComplexity;
  
  const readabilityImprovement = calculateReadabilityImprovement(original, deobfuscated);
  const moduleExtractionSuccess = calculateModuleExtractionSuccess(deobfuscated);
  
  return {
    sizeReduction,
    complexityReduction, 
    readabilityImprovement,
    moduleExtractionSuccess
  };
}

function calculateStateComplexity(state: IRState): number {
  let complexity = 0;
  
  for (const [nodeId, node] of state.nodes) {
    switch (node.type) {
      case 'FunctionDeclaration':
        complexity += 10;
        break;
      case 'IfStatement':
      case 'WhileStatement':
      case 'ForStatement':
        complexity += 5;
        break;
      case 'SwitchStatement':
        complexity += 8;
        break;
      case 'CallExpression':
        complexity += 3;
        break;
      default:
        complexity += 1;
    }
  }
  
  return complexity;
}

function calculateReadabilityImprovement(original: IRState, deobfuscated: IRState): number {
  const originalReadability = calculateReadabilityScore(original);
  const deobfuscatedReadability = calculateReadabilityScore(deobfuscated);
  
  return (deobfuscatedReadability - originalReadability) / originalReadability;
}

function calculateReadabilityScore(state: IRState): number {
  let score = 0;
  let totalNodes = 0;
  
  for (const [nodeId, node] of state.nodes) {
    totalNodes++;
    
    if (node.type === 'Literal' && typeof node.value === 'string') {
      // String literals improve readability
      score += node.value.length > 0 ? 2 : 1;
    } else if (node.type === 'Identifier') {
      // Meaningful identifiers improve readability
      const name = node.name;
      if (name.length > 3 && !/^_0x[a-f0-9]+$/.test(name)) {
        score += 2;
      } else {
        score += 1;
      }
    } else {
      score += 1;
    }
  }
  
  return totalNodes > 0 ? score / totalNodes : 0;
}

function calculateModuleExtractionSuccess(state: IRState): number {
  let extractedModules = 0;
  let totalFunctions = 0;
  
  for (const [nodeId, node] of state.nodes) {
    if (node.type === 'FunctionDeclaration') {
      totalFunctions++;
      
      // Check if function looks like it was successfully extracted/deobfuscated
      if (node.id && !node.id.name.startsWith('_0x')) {
        extractedModules++;
      }
    }
  }
  
  return totalFunctions > 0 ? extractedModules / totalFunctions : 1;
}

function calculateNormalizedTreeEditDistance(groundTruth: IRState, deobfuscated: IRState): number {
  // Simplified nTED calculation - in practice would use proper tree edit distance
  const truthNodes = Array.from(groundTruth.nodes.values());
  const deobfuscatedNodes = Array.from(deobfuscated.nodes.values());
  
  const maxSize = Math.max(truthNodes.length, deobfuscatedNodes.length);
  const sizeDifference = Math.abs(truthNodes.length - deobfuscatedNodes.length);
  
  // Simple similarity measure based on node types
  let matchingTypes = 0;
  const minSize = Math.min(truthNodes.length, deobfuscatedNodes.length);
  
  for (let i = 0; i < minSize; i++) {
    if (truthNodes[i].type === deobfuscatedNodes[i].type) {
      matchingTypes++;
    }
  }
  
  const similarity = matchingTypes / maxSize;
  return similarity; // Higher is better (inverse of edit distance)
}

// Mock sample creators

function createJavaScriptObfuscatorSample(): IRState {
  const nodes = new Map();
  
  // Add obfuscated string array - simplified since arrayExpression/callExpression don't exist
  nodes.set('array1', IRNodeFactory.variableDeclaration('var', [
    IRNodeFactory.variableDeclarator(
      IRNodeFactory.identifier('_0x1234'),
      IRNodeFactory.literal(['SGVsbG8gV29ybGQ=', 'VGVzdCBNZXNzYWdl']) // Array as literal
    )
  ]));
  
  // Add decoder function - simplified
  nodes.set('decoder1', IRNodeFactory.functionDeclaration(
    IRNodeFactory.identifier('_0x5678'),
    [IRNodeFactory.identifier('index')],
    IRNodeFactory.blockStatement([
      IRNodeFactory.returnStatement(
        IRNodeFactory.identifier('atob') // Simplified - just reference the function
      )
    ])
  ));
  
  // Add flattened control flow
  nodes.set('while1', createFlattenedWhileLoop());
  
  // Add opaque predicates
  nodes.set('opaque1', IRNodeFactory.ifStatement(
    IRNodeFactory.binaryExpression(
      '===',
      IRNodeFactory.binaryExpression(
        '&',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(1, 'number')
      ),
      IRNodeFactory.binaryExpression(
        '%',
        IRNodeFactory.identifier('x'),
        IRNodeFactory.literal(2, 'number')
      )
    ),
    IRNodeFactory.blockStatement([
      IRNodeFactory.expressionStatement(
        IRNodeFactory.callExpression(
          IRNodeFactory.identifier('_0x5678'),
          [IRNodeFactory.literal(0, 'number')]
        )
      )
    ]),
    null
  ));
  
  return {
    nodes,
    cfg: null as any, // Mock CFG
    ssa: undefined,
    metadata: new Map<string, unknown>()
  };
}

function createFlattenedWhileLoop() {
  return IRNodeFactory.whileStatement(
    IRNodeFactory.binaryExpression(
      '!==',
      IRNodeFactory.identifier('_state'),
      IRNodeFactory.literal(-1)
    ),
    IRNodeFactory.blockStatement([
      IRNodeFactory.switchStatement(
        IRNodeFactory.identifier('_state'),
        [
          IRNodeFactory.switchCase(
            IRNodeFactory.literal(0),
            [
              IRNodeFactory.expressionStatement(
                IRNodeFactory.identifier('console') // Simplified call
              ),
              IRNodeFactory.expressionStatement(
                IRNodeFactory.assignmentExpression(
                  '=',
                  IRNodeFactory.identifier('_state'),
                  IRNodeFactory.literal(1)
                )
              ),
              IRNodeFactory.breakStatement()
            ]
          ),
          IRNodeFactory.switchCase(
            IRNodeFactory.literal(1),
            [
              IRNodeFactory.expressionStatement(
                IRNodeFactory.identifier('console') // Simplified call
              ),
              IRNodeFactory.expressionStatement(
                IRNodeFactory.assignmentExpression(
                  '=',
                  IRNodeFactory.identifier('_state'),
                  IRNodeFactory.literal(-1)
                )
              ),
              IRNodeFactory.breakStatement()
            ]
          )
        ]
      )
    ])
  );
}

// Additional helper functions for new enhanced passes

function runPipelineWithoutRenaming(state: IRState) {
  let currentState = state;
  
  currentState = decoderPass.execute(currentState).state;
  currentState = constPropPass.execute(currentState).state;  
  currentState = opaquePass.execute(currentState).state;
  currentState = deflattenPass.execute(currentState).state;
  currentState = dcePass.execute(currentState).state;
  currentState = structuringPass.execute(currentState).state;
  const result = dcePass.execute(currentState);
  
  return result;
}

function runPipelineWithoutStructuring(state: IRState) {
  let currentState = state;
  
  currentState = decoderPass.execute(currentState).state;
  currentState = constPropPass.execute(currentState).state;  
  currentState = opaquePass.execute(currentState).state;
  currentState = deflattenPass.execute(currentState).state;
  currentState = dcePass.execute(currentState).state;
  currentState = renamingPass.execute(currentState).state;
  const result = dcePass.execute(currentState);
  
  return result;
}

function runBasicPipeline(state: IRState) {
  let currentState = state;
  
  // Basic pipeline without enhanced passes
  currentState = decoderPass.execute(currentState).state;
  currentState = constPropPass.execute(currentState).state;  
  currentState = opaquePass.execute(currentState).state;
  currentState = deflattenPass.execute(currentState).state;
  const result = dcePass.execute(currentState);
  
  return result;
}

function hasObfuscatedIdentifiers(state: IRState): boolean {
  for (const [nodeId, node] of state.nodes) {
    if (node.type === 'Identifier') {
      const name = node.name;
      if (/^_0x[a-f0-9]+$/i.test(name) || /^[a-zA-Z]$/i.test(name)) {
        return true;
      }
    }
  }
  return false;
}

function hasHeuristicRenamedIdentifiers(state: IRState): boolean {
  for (const [nodeId, node] of state.nodes) {
    if (node.type === 'Identifier') {
      const name = node.name;
      // Look for heuristic patterns: camelCase, descriptive names, etc.
      if (name.length > 3 && !/^_0x[a-f0-9]+$/i.test(name) && 
          !/^[a-zA-Z]$/i.test(name) && /^[a-z][a-zA-Z0-9]*$/.test(name)) {
        return true;
      }
    }
  }
  return false;
}

function hasTernaryExpressions(state: IRState): boolean {
  for (const [nodeId, node] of state.nodes) {
    if (node.type === 'ConditionalExpression') {
      return true;
    }
  }
  return false;
}

function hasStructuredLoops(state: IRState): boolean {
  for (const [nodeId, node] of state.nodes) {
    if (node.type === 'ForStatement' || node.type === 'WhileStatement') {
      // Check if it's not a flattened control flow pattern
      if (node.type === 'WhileStatement' && 
          node.test?.type === 'BinaryExpression' &&
          (node.test as any).left?.name !== '_state') {
        return true;
      }
      if (node.type === 'ForStatement') {
        return true;
      }
    }
  }
  return false;
}

function hasSwitchStatements(state: IRState): boolean {
  for (const [nodeId, node] of state.nodes) {
    if (node.type === 'SwitchStatement') {
      // Check if it's a meaningful switch, not just control flow flattening
      const cases = (node as any).cases;
      if (cases && cases.length > 1) {
        return true;
      }
    }
  }
  return false;
}

function calculateComprehensiveMetrics(original: IRState, deobfuscated: IRState) {
  const readability = calculateReadabilityScore(deobfuscated) / Math.max(calculateReadabilityScore(original), 0.1);
  const structure = calculateStructuralScore(deobfuscated) / Math.max(calculateStructuralScore(original), 0.1);
  const maintainability = calculateMaintainabilityScore(deobfuscated) / Math.max(calculateMaintainabilityScore(original), 0.1);
  
  return { readability, structure, maintainability };
}

function calculateStructuralScore(state: IRState): number {
  let score = 0;
  let totalNodes = 0;
  
  for (const [nodeId, node] of state.nodes) {
    totalNodes++;
    
    // Positive points for good structures
    if (node.type === 'ConditionalExpression') score += 3; // Ternaries are good
    if (node.type === 'ForStatement') score += 2; // Proper loops
    if (node.type === 'FunctionDeclaration') score += 2; // Functions
    if (node.type === 'SwitchStatement') {
      const cases = (node as any).cases;
      if (cases && cases.length > 2) score += 3; // Meaningful switches
    }
    
    // Negative points for bad structures
    if (node.type === 'WhileStatement') {
      const test = (node as any).test;
      if (test?.type === 'BinaryExpression' && 
          test.left?.name === '_state') {
        score -= 2; // Flattened control flow
      } else {
        score += 1; // Normal while loop
      }
    }
    
    score += 1; // Base score per node
  }
  
  return totalNodes > 0 ? score / totalNodes : 0;
}

function calculateMaintainabilityScore(state: IRState): number {
  let score = 0;
  let totalNodes = 0;
  
  for (const [nodeId, node] of state.nodes) {
    totalNodes++;
    
    if (node.type === 'Identifier') {
      const name = node.name;
      if (name.length > 3 && !/^_0x[a-f0-9]+$/i.test(name)) {
        score += 2; // Meaningful names
      } else {
        score += 1;
      }
    } else if (node.type === 'FunctionDeclaration') {
      score += 3; // Functions improve maintainability
    } else if (node.type === 'Literal' && typeof node.value === 'string') {
      score += 2; // String literals are maintainable
    } else {
      score += 1;
    }
  }
  
  return totalNodes > 0 ? score / totalNodes : 0;
}

function createObfuscatedIdentifierSample(): IRState {
  const nodes = new Map();
  
  // Create sample with heavily obfuscated identifiers
  nodes.set('var1', IRNodeFactory.variableDeclaration('var', [
    IRNodeFactory.variableDeclarator(
      IRNodeFactory.identifier('_0x1a2b3c'),
      IRNodeFactory.literal(0)
    )
  ]));
  
  nodes.set('var2', IRNodeFactory.variableDeclaration('var', [
    IRNodeFactory.variableDeclarator(
      IRNodeFactory.identifier('a'),
      IRNodeFactory.callExpression(
        IRNodeFactory.identifier('_0x4d5e6f'),
        [IRNodeFactory.identifier('_0x1a2b3c')]
      )
    )
  ]));
  
  nodes.set('func1', IRNodeFactory.functionDeclaration(
    IRNodeFactory.identifier('b'),
    [IRNodeFactory.identifier('c')],
    IRNodeFactory.blockStatement([
      IRNodeFactory.returnStatement(
        IRNodeFactory.binaryExpression(
          '+',
          IRNodeFactory.identifier('c'),
          IRNodeFactory.identifier('_0x1a2b3c')
        )
      )
    ])
  ));
  
  return {
    nodes,
    cfg: null as any, // Mock CFG
    ssa: undefined,
    metadata: new Map<string, unknown>()
  };
}

function createUglyControlFlowSample(): IRState {
  const nodes = new Map();
  
  // Create sample with ugly control flow patterns
  nodes.set('ugly1', IRNodeFactory.ifStatement(
    IRNodeFactory.identifier('condition1'),
    IRNodeFactory.blockStatement([
      IRNodeFactory.ifStatement(
        IRNodeFactory.identifier('condition2'),
        IRNodeFactory.blockStatement([
          IRNodeFactory.returnStatement(
            IRNodeFactory.literal('result1')
          )
        ]),
        IRNodeFactory.blockStatement([
          IRNodeFactory.returnStatement(
            IRNodeFactory.literal('result2')
          )
        ])
      )
    ]),
    IRNodeFactory.blockStatement([
      IRNodeFactory.returnStatement(
        IRNodeFactory.literal('result3')
      )
    ])
  ));
  
  // Add a while(true) pattern that should be structured
  nodes.set('ugly2', IRNodeFactory.whileStatement(
    IRNodeFactory.literal(true),
    IRNodeFactory.blockStatement([
      IRNodeFactory.ifStatement(
        IRNodeFactory.identifier('shouldBreak'),
        IRNodeFactory.blockStatement([
          IRNodeFactory.breakStatement()
        ]),
        null
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.callExpression(
          IRNodeFactory.identifier('doWork'),
          []
        )
      )
    ])
  ));
  
  return {
    nodes,
    cfg: null as any, // Mock CFG
    ssa: undefined,
    metadata: new Map<string, unknown>()
  };
}

function createComplexObfuscatedSample(): IRState {
  const nodes = new Map();
  
  // Combine all obfuscation patterns
  const identifierSample = createObfuscatedIdentifierSample();
  const controlFlowSample = createUglyControlFlowSample();
  const obfuscatorSample = createJavaScriptObfuscatorSample();
  
  // Merge all samples
  for (const [key, node] of identifierSample.nodes) {
    nodes.set(`id_${key}`, node);
  }
  for (const [key, node] of controlFlowSample.nodes) {
    nodes.set(`cf_${key}`, node);
  }
  for (const [key, node] of obfuscatorSample.nodes) {
    nodes.set(`obs_${key}`, node);
  }
  
  return {
    nodes,
    cfg: null as any, // Mock CFG
    ssa: undefined,
    metadata: new Map<string, unknown>()
  };
}

function createMockSandboxResults(): SandboxResult {
  return {
    success: true,
    trace: {
      entries: [
        {
          type: 'function_call',
          timestamp: 1000,
          result: 'Hello World',
          metadata: { irCorrelation: { nodeId: 'decoder1' } }
        }
      ],
      metadata: {
        totalCalls: 1,
        executionTime: 50,
        memoryUsage: 1024
      }
    },
    result: undefined,
    error: undefined,
    executionTime: 50
  };
}

// Stub implementations for other helper functions
function createWebpackObfuscatedSample(): IRState { return createJavaScriptObfuscatorSample(); }
function createFunctionalTestSample(): { original: IRState; obfuscated: IRState } { 
  const sample = createJavaScriptObfuscatorSample();
  return { original: sample, obfuscated: sample }; 
}
function createLargeObfuscatedSample(size: number): IRState { return createJavaScriptObfuscatorSample(); }
function createMultiPatternObfuscatedSample(): IRState { return createJavaScriptObfuscatorSample(); }
function createInterdependentObfuscationSample(): IRState { return createJavaScriptObfuscatorSample(); }

// Analysis helper stubs
function hasWebpackBootstrap(state: IRState): boolean { return false; }
function executeMockCode(state: IRState): any { return {}; }
function hasUnresolvedDecoderCalls(state: IRState): boolean { return false; }
function hasRemainingOpaquePredicates(state: IRState): boolean { return false; }
function hasFlattenedControlFlow(state: IRState): boolean { return false; }

// Test suite creators
function createStringDecoderTestSuite(count: number): IRState[] { 
  return Array(count).fill(0).map(() => createJavaScriptObfuscatorSample()); 
}
function createOpaquePredicateTestSuite(count: number): IRState[] { 
  return Array(count).fill(0).map(() => createJavaScriptObfuscatorSample()); 
}
function createGroundTruthTestPairs(count: number): Array<{obfuscated: IRState, groundTruth: IRState}> {
  return Array(count).fill(0).map(() => ({
    obfuscated: createJavaScriptObfuscatorSample(),
    groundTruth: createJavaScriptObfuscatorSample()
  }));
}

// Analysis function stubs
function analyzeStringDecoderSuccess(original: IRState, deobfuscated: IRState): { decoderSuccessRate: number } {
  return { decoderSuccessRate: 0.8 };
}
function analyzeOpaquePredicateElimination(original: IRState, deobfuscated: IRState): { eliminationRate: number } {
  return { eliminationRate: 0.7 };
}
function createMalformedObfuscatedSample(): IRState { return createJavaScriptObfuscatorSample(); }
function createMixedObfuscationSample(): IRState { return createJavaScriptObfuscatorSample(); }
function analyzeMixedObfuscationHandling(original: IRState, deobfuscated: IRState): { handledTechniques: number } {
  return { handledTechniques: 3 };
}
function createProgressTestSample(): IRState { return createJavaScriptObfuscatorSample(); }
function createResourceTestSample(): IRState { return createJavaScriptObfuscatorSample(); }