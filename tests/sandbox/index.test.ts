/**
 * @fileoverview Comprehensive tests for the main sandbox system (index.ts)
 * 
 * Tests sandbox creation, configuration, policy enforcement, execution context
 * isolation, error handling, and health monitoring capabilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  analyzeSandboxResult,
  createDevelopmentSandbox,
  createProductionSandbox,
  createResearchSandbox,
  SandboxHealthMonitor,
  type SandboxPolicy,
  type SandboxResult,
  type ResourceLimits,
} from '../../src/sandbox/index.js';

describe('Main Sandbox System (index.ts)', () => {
  let sandbox: any;
  let healthMonitor: SandboxHealthMonitor;

  afterEach(async () => {
    if (sandbox) {
      await sandbox.cleanup();
    }
  });

  describe('Sandbox Factory Functions', () => {
    it('should create development sandbox with correct configuration', async () => {
      sandbox = createDevelopmentSandbox();
      
      expect(sandbox).toBeDefined();
      expect(sandbox.mode).toBe('development');
      expect(sandbox.config).toBeDefined();
      expect(sandbox.config.enableTracing).toBe(true);
      expect(sandbox.config.enableDebugging).toBe(true);
    });

    it('should create production sandbox with secure defaults', async () => {
      sandbox = createProductionSandbox();
      
      expect(sandbox).toBeDefined();
      expect(sandbox.mode).toBe('production');
      expect(sandbox.config.enableTracing).toBe(false);
      expect(sandbox.config.enableDebugging).toBe(false);
      expect(sandbox.config.maxExecutionTimeMS).toBeLessThanOrEqual(5000);
      expect(sandbox.config.maxMemoryMB).toBeLessThanOrEqual(64);
    });

    it('should create research sandbox with analysis features', async () => {
      sandbox = createResearchSandbox();
      
      expect(sandbox).toBeDefined();
      expect(sandbox.mode).toBe('research');
      expect(sandbox.config.enableTracing).toBe(true);
      expect(sandbox.config.enableAnalysis).toBe(true);
      expect(sandbox.config.collectExecutionStats).toBe(true);
    });

    it('should accept custom configuration overrides', async () => {
      const customLimits: ResourceLimits = {
        maxMemoryMB: 128,
        maxExecutionTimeMS: 10000,
        maxLoopIterations: 5000,
        maxCallStackDepth: 200,
      };

      sandbox = createProductionSandbox(customLimits);
      
      expect(sandbox.config.maxMemoryMB).toBe(128);
      expect(sandbox.config.maxExecutionTimeMS).toBe(10000);
      expect(sandbox.config.maxLoopIterations).toBe(5000);
      expect(sandbox.config.maxCallStackDepth).toBe(200);
    });

    it('should merge custom options with defaults correctly', async () => {
      const customOptions = {
        maxMemoryMB: 32,
        enableTracing: true,
      };

      sandbox = createProductionSandbox(customOptions);
      
      // Custom values should override defaults
      expect(sandbox.config.maxMemoryMB).toBe(32);
      expect(sandbox.config.enableTracing).toBe(true);
      
      // Other defaults should remain
      expect(sandbox.config.enableDebugging).toBe(false);
      expect(sandbox.config.maxExecutionTimeMS).toBeDefined();
    });
  });

  describe('Sandbox Policy Enforcement', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
    });

    it('should enforce security policy rules', async () => {
      const securePolicy: SandboxPolicy = {
        allowNetworkAccess: false,
        allowFileSystemAccess: false,
        allowEval: false,
        allowDynamicImport: false,
        maxMemoryMB: 16,
        maxExecutionTimeMS: 1000,
      };

      sandbox.setPolicy(securePolicy);
      
      const maliciousCode = `
        fetch('https://evil.com/data');
        eval('console.log("injected")');
        require('fs').readFileSync('/etc/passwd');
      `;

      const result = await sandbox.execute(maliciousCode);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.length).toBeGreaterThan(0);
      expect(result.securityViolations.some(v => v.type === 'network_access')).toBe(true);
      expect(result.securityViolations.some(v => v.type === 'eval_usage')).toBe(true);
      expect(result.securityViolations.some(v => v.type === 'api_access')).toBe(true);
    });

    it('should allow permitted operations under policy', async () => {
      const permissivePolicy: SandboxPolicy = {
        allowNetworkAccess: false,
        allowFileSystemAccess: false,
        allowEval: false,
        allowDynamicImport: false,
        maxMemoryMB: 32,
        maxExecutionTimeMS: 2000,
      };

      sandbox.setPolicy(permissivePolicy);
      
      const safeCode = `
        const numbers = [1, 2, 3, 4, 5];
        const sum = numbers.reduce((a, b) => a + b, 0);
        const average = sum / numbers.length;
        return { sum, average, count: numbers.length };
      `;

      const result = await sandbox.execute(safeCode);
      
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        sum: 15,
        average: 3,
        count: 5
      });
      expect(result.securityViolations.length).toBe(0);
    });

    it('should validate policy configuration', () => {
      const invalidPolicy: Partial<SandboxPolicy> = {
        maxMemoryMB: -1,
        maxExecutionTimeMS: 0,
      };

      expect(() => {
        sandbox.setPolicy(invalidPolicy as SandboxPolicy);
      }).toThrow(/invalid.*policy/i);
    });

    it('should apply default policy when none specified', async () => {
      // Don't set explicit policy
      const result = await sandbox.execute('return "test"');
      
      expect(result.success).toBe(true);
      expect(sandbox.getPolicy()).toBeDefined();
      expect(sandbox.getPolicy().maxMemoryMB).toBeGreaterThan(0);
      expect(sandbox.getPolicy().maxExecutionTimeMS).toBeGreaterThan(0);
    });
  });

  describe('Execution Context Management', () => {
    beforeEach(async () => {
      sandbox = createDevelopmentSandbox();
      await sandbox.initialize();
    });

    it('should provide isolated execution contexts', async () => {
      const code1 = 'globalThis.testValue = "first";';
      const code2 = 'return globalThis.testValue;';

      await sandbox.execute(code1);
      const result2 = await sandbox.execute(code2);

      // Context isolation should prevent persistence
      expect(result2.value).toBeUndefined();
    });

    it('should maintain context within single execution', async () => {
      const code = `
        const localVar = "test value";
        function testFunction() {
          return localVar;
        }
        return testFunction();
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe("test value");
    });

    it('should handle complex object returns', async () => {
      const code = `
        const complexObject = {
          number: 42,
          string: "hello",
          array: [1, 2, 3],
          nested: {
            property: "nested value"
          },
          method: function() { return "method result"; }
        };
        
        return {
          number: complexObject.number,
          string: complexObject.string,
          array: complexObject.array,
          nested: complexObject.nested,
          methodResult: complexObject.method()
        };
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        number: 42,
        string: "hello",
        array: [1, 2, 3],
        nested: { property: "nested value" },
        methodResult: "method result"
      });
    });

    it('should handle async code execution', async () => {
      const code = `
        async function asyncTest() {
          await new Promise(resolve => setTimeout(resolve, 10));
          return "async result";
        }
        
        return asyncTest();
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe("async result");
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
    });

    it('should handle syntax errors gracefully', async () => {
      const malformedCode = 'this is not valid JavaScript syntax !!!';

      const result = await sandbox.execute(malformedCode);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/syntax.*error/i);
      expect(result.executionTimeMs).toBeLessThan(100);
    });

    it('should handle runtime errors without crashing', async () => {
      const errorCode = `
        function throwError() {
          throw new Error("Test runtime error");
        }
        throwError();
      `;

      const result = await sandbox.execute(errorCode);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Test runtime error");
      expect(result.trace).toBeDefined();
    });

    it('should recover from memory exhaustion', async () => {
      const memoryExhaustionCode = `
        const bigArray = [];
        for (let i = 0; i < 1000000; i++) {
          bigArray.push(new Array(1000).fill('x'));
        }
        return bigArray.length;
      `;

      const result = await sandbox.execute(memoryExhaustionCode);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'memory_limit')).toBe(true);
      
      // Sandbox should still be functional after memory error
      const simpleCode = 'return "recovery test"';
      const recoveryResult = await sandbox.execute(simpleCode);
      expect(recoveryResult.success).toBe(true);
    });

    it('should handle infinite loops with timeouts', async () => {
      const infiniteLoopCode = `
        let counter = 0;
        while (true) {
          counter++;
        }
        return counter;
      `;

      const startTime = Date.now();
      const result = await sandbox.execute(infiniteLoopCode);
      const endTime = Date.now();
      
      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(6000); // Should timeout within reasonable time
      expect(
        result.securityViolations.some(v => v.type === 'timeout') ||
        result.securityViolations.some(v => v.type === 'infinite_loop')
      ).toBe(true);
    });

    it('should provide detailed error context', async () => {
      const errorCode = `
        function level1() {
          level2();
        }
        
        function level2() {
          level3();
        }
        
        function level3() {
          throw new Error("Deep error");
        }
        
        level1();
      `;

      const result = await sandbox.execute(errorCode);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Deep error");
      expect(result.trace.entries.length).toBeGreaterThan(0);
      expect(result.trace.entries.some(entry => 
        entry.data.functionName === 'level1' ||
        entry.data.functionName === 'level2' ||
        entry.data.functionName === 'level3'
      )).toBe(true);
    });
  });

  describe('Resource Monitoring and Limits', () => {
    it('should monitor memory usage during execution', async () => {
      sandbox = createProductionSandbox({
        maxMemoryMB: 16,
        trackMemoryUsage: true,
      });
      await sandbox.initialize();

      const memoryIntensiveCode = `
        const arrays = [];
        for (let i = 0; i < 100; i++) {
          arrays.push(new Array(1000).fill('test'));
        }
        return arrays.length;
      `;

      const result = await sandbox.execute(memoryIntensiveCode);
      
      expect(result.memoryStats).toBeDefined();
      expect(result.memoryStats.peakUsageMB).toBeGreaterThan(0);
      expect(result.memoryStats.finalUsageMB).toBeGreaterThan(0);
    });

    it('should track execution time accurately', async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();

      const timedCode = `
        const start = Date.now();
        let sum = 0;
        for (let i = 0; i < 100000; i++) {
          sum += i;
        }
        return sum;
      `;

      const result = await sandbox.execute(timedCode);
      
      expect(result.success).toBe(true);
      expect(result.executionTimeMs).toBeGreaterThan(0);
      expect(result.executionTimeMs).toBeLessThan(1000);
    });

    it('should enforce call stack depth limits', async () => {
      sandbox = createProductionSandbox({
        maxCallStackDepth: 50,
      });
      await sandbox.initialize();

      const deepRecursionCode = `
        function recursiveFunction(depth) {
          if (depth <= 0) return depth;
          return recursiveFunction(depth - 1);
        }
        return recursiveFunction(100);
      `;

      const result = await sandbox.execute(deepRecursionCode);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'stack_overflow')).toBe(true);
    });
  });

  describe('SandboxHealthMonitor', () => {
    beforeEach(() => {
      healthMonitor = new SandboxHealthMonitor();
    });

    it('should initialize with default settings', () => {
      expect(healthMonitor).toBeDefined();
      expect(healthMonitor.getStats().totalExecutions).toBe(0);
      expect(healthMonitor.getStats().successfulExecutions).toBe(0);
      expect(healthMonitor.getStats().failedExecutions).toBe(0);
    });

    it('should track execution statistics', async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
      
      healthMonitor.startTracking(sandbox);

      // Execute successful code
      await sandbox.execute('return "success"');
      
      // Execute failing code
      await sandbox.execute('throw new Error("test error")');

      const stats = healthMonitor.getStats();
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(1);
    });

    it('should detect performance degradation', async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
      
      healthMonitor.startTracking(sandbox);

      // Execute slow code multiple times
      for (let i = 0; i < 5; i++) {
        await sandbox.execute(`
          let sum = 0;
          for (let j = 0; j < 50000; j++) {
            sum += j;
          }
          return sum;
        `);
      }

      const health = healthMonitor.getHealth();
      expect(health.status).toBeDefined();
      expect(health.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should identify security violation patterns', async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
      
      healthMonitor.startTracking(sandbox);

      // Execute code that triggers security violations
      await sandbox.execute('eval("test")');
      await sandbox.execute('new Function("test")');
      await sandbox.execute('fetch("https://example.com")');

      const health = healthMonitor.getHealth();
      expect(health.securityViolationRate).toBeGreaterThan(0);
      expect(health.commonViolationTypes.length).toBeGreaterThan(0);
    });

    it('should generate health reports', () => {
      const report = healthMonitor.generateReport();
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.uptime).toBeDefined();
      expect(report.statistics).toBeDefined();
      expect(report.health).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('Sandbox Result Analysis', () => {
    beforeEach(async () => {
      sandbox = createResearchSandbox();
      await sandbox.initialize();
    });

    it('should analyze simple code execution', () => {
      const mockResult: SandboxResult = {
        success: true,
        value: 42,
        executionTimeMs: 10,
        memoryStats: { peakUsageMB: 2, finalUsageMB: 1 },
        trace: {
          entries: [],
          constants: new Set(['42']),
          decodedStrings: [],
          stats: {
            totalOperations: 5,
            stringOperations: 0,
            arithmeticOperations: 1,
          }
        },
        sideEffects: [],
        securityViolations: [],
        error: null,
      };

      const analysis = analyzeSandboxResult(mockResult);
      
      expect(analysis).toBeDefined();
      expect(analysis.obfuscationLevel).toBe(0);
      expect(analysis.deobfuscationOpportunities).toEqual([]);
      expect(analysis.executionSummary).toBeDefined();
    });

    it('should analyze obfuscated code patterns', () => {
      const mockResult: SandboxResult = {
        success: true,
        value: "decoded",
        executionTimeMs: 50,
        memoryStats: { peakUsageMB: 4, finalUsageMB: 2 },
        trace: {
          entries: [
            {
              timestamp: Date.now(),
              type: 'function_call',
              data: { operation: 'String.fromCharCode', functionName: 'fromCharCode' }
            },
            {
              timestamp: Date.now(),
              type: 'eval_call',
              data: { operation: 'eval', code: 'console.log("test")' }
            }
          ],
          constants: new Set(['72', '101', '108', '108', '111']),
          decodedStrings: ['Hello'],
          stats: {
            totalOperations: 25,
            stringOperations: 15,
            arithmeticOperations: 5,
          }
        },
        sideEffects: [
          { type: 'eval_call', data: { code: 'console.log("test")' } }
        ],
        securityViolations: [],
        error: null,
      };

      const analysis = analyzeSandboxResult(mockResult);
      
      expect(analysis.obfuscationLevel).toBeGreaterThan(20);
      expect(analysis.deobfuscationOpportunities.length).toBeGreaterThan(0);
      expect(analysis.executionSummary.dynamicCodeGeneration).toBe(1);
      expect(analysis.executionSummary.stringOperations).toBe(15);
    });

    it('should identify high-risk patterns', () => {
      const mockResult: SandboxResult = {
        success: false,
        value: null,
        executionTimeMs: 100,
        memoryStats: { peakUsageMB: 8, finalUsageMB: 4 },
        trace: {
          entries: [],
          constants: new Set(),
          decodedStrings: [],
          stats: {
            totalOperations: 100,
            stringOperations: 50,
            arithmeticOperations: 20,
          }
        },
        sideEffects: [
          { type: 'network_request', data: { url: 'https://evil.com' } },
          { type: 'eval_call', data: { code: 'malicious code' } }
        ],
        securityViolations: [
          {
            type: 'network_access',
            severity: 'critical',
            message: 'Attempted network access',
            timestamp: Date.now(),
            context: { url: 'https://evil.com' }
          },
          {
            type: 'eval_usage',
            severity: 'high',
            message: 'Dynamic code execution detected',
            timestamp: Date.now(),
            context: { code: 'malicious code' }
          }
        ],
        error: 'Security violations detected',
      };

      const analysis = analyzeSandboxResult(mockResult);
      
      expect(analysis.riskLevel).toBe('high');
      expect(analysis.securityConcerns.length).toBeGreaterThan(0);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Integration and Cleanup', () => {
    it('should properly initialize and cleanup sandbox', async () => {
      sandbox = createProductionSandbox();
      
      expect(sandbox.isInitialized()).toBe(false);
      
      await sandbox.initialize();
      expect(sandbox.isInitialized()).toBe(true);
      
      await sandbox.cleanup();
      expect(sandbox.isInitialized()).toBe(false);
    });

    it('should handle multiple initialization calls', async () => {
      sandbox = createProductionSandbox();
      
      await sandbox.initialize();
      await sandbox.initialize(); // Should not throw
      
      expect(sandbox.isInitialized()).toBe(true);
    });

    it('should handle cleanup without initialization', async () => {
      sandbox = createProductionSandbox();
      
      // Should not throw
      await expect(sandbox.cleanup()).resolves.not.toThrow();
    });

    it('should prevent execution without initialization', async () => {
      sandbox = createProductionSandbox();
      
      await expect(sandbox.execute('return "test"')).rejects.toThrow(/not.*initialized/i);
    });
  });
});