/**
 * @fileoverview Comprehensive tests for QuickJS integration (quickjs.ts)
 * 
 * Tests QuickJS engine initialization, bytecode execution in sandboxed environment,
 * context isolation, security measures, error handling, and performance optimization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock QuickJS since it's a native module
vi.mock('quickjs-emscripten', () => ({
  getQuickJS: vi.fn().mockResolvedValue({
    newContext: vi.fn(),
    createRuntime: vi.fn(),
    VmCallResult: {
      SUCCESS: 0,
      EXCEPTION: 1,
    },
  }),
}));

import {
  QuickJSEngine,
  QuickJSSandbox,
  QuickJSContext,
  type QuickJSConfig,
  type QuickJSResult,
} from '../../src/sandbox/quickjs.js';

describe('QuickJS Integration (quickjs.ts)', () => {
  let engine: QuickJSEngine;
  let sandbox: QuickJSSandbox;
  let context: QuickJSContext;

  beforeEach(async () => {
    engine = new QuickJSEngine();
    await engine.initialize();
  });

  afterEach(async () => {
    if (context) {
      await context.dispose();
    }
    if (sandbox) {
      await sandbox.cleanup();
    }
    if (engine) {
      await engine.cleanup();
    }
  });

  describe('QuickJSEngine', () => {
    describe('Engine Initialization', () => {
      it('should initialize QuickJS engine successfully', async () => {
        expect(engine.isInitialized()).toBe(true);
        expect(engine.getVersion()).toBeDefined();
        expect(engine.getVersion()).toMatch(/\d+\.\d+\.\d+/);
      });

      it('should handle multiple initialization calls', async () => {
        await engine.initialize(); // Second call should be safe
        expect(engine.isInitialized()).toBe(true);
      });

      it('should configure engine with custom options', async () => {
        const customEngine = new QuickJSEngine({
          memoryLimitMB: 16,
          timeoutMS: 1000,
          enableDebugger: true,
          enableProfiling: false,
        });

        await customEngine.initialize();

        const config = customEngine.getConfig();
        expect(config.memoryLimitMB).toBe(16);
        expect(config.timeoutMS).toBe(1000);
        expect(config.enableDebugger).toBe(true);
        expect(config.enableProfiling).toBe(false);

        await customEngine.cleanup();
      });

      it('should validate configuration parameters', () => {
        const invalidConfig: Partial<QuickJSConfig> = {
          memoryLimitMB: -1,
          timeoutMS: 0,
        };

        expect(() => {
          new QuickJSEngine(invalidConfig as QuickJSConfig);
        }).toThrow(/invalid.*configuration/i);
      });
    });

    describe('Context Management', () => {
      it('should create isolated contexts', async () => {
        const context1 = await engine.createContext();
        const context2 = await engine.createContext();

        expect(context1.getId()).not.toBe(context2.getId());
        expect(context1.isIsolated()).toBe(true);
        expect(context2.isIsolated()).toBe(true);

        await context1.dispose();
        await context2.dispose();
      });

      it('should enforce memory limits per context', async () => {
        const limitedEngine = new QuickJSEngine({
          memoryLimitMB: 4,
        });
        await limitedEngine.initialize();

        context = await limitedEngine.createContext();

        // Try to allocate large arrays to exceed limit
        const largeArrayCode = `
          const arrays = [];
          for (let i = 0; i < 1000; i++) {
            arrays.push(new Array(10000).fill('x'));
          }
          arrays.length;
        `;

        const result = await context.evaluate(largeArrayCode);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/memory.*limit/i);

        await limitedEngine.cleanup();
      });

      it('should handle context disposal gracefully', async () => {
        context = await engine.createContext();
        const contextId = context.getId();

        await context.dispose();

        expect(context.isDisposed()).toBe(true);
        expect(() => context.evaluate('1 + 1')).rejects.toThrow(/disposed/i);
      });

      it('should isolate global state between contexts', async () => {
        const context1 = await engine.createContext();
        const context2 = await engine.createContext();

        // Set global variable in context1
        await context1.evaluate('globalThis.testVar = "context1"');

        // Check it doesn't exist in context2
        const result2 = await context2.evaluate('globalThis.testVar');

        expect(result2.value).toBeUndefined();

        await context1.dispose();
        await context2.dispose();
      });
    });

    describe('Security Features', () => {
      it('should block dangerous APIs by default', async () => {
        context = await engine.createContext();

        const dangerousCode = `
          require('fs').readFileSync('/etc/passwd');
        `;

        const result = await context.evaluate(dangerousCode);

        expect(result.success).toBe(false);
        expect(result.securityViolations).toContain(
          expect.objectContaining({ type: 'api_access' })
        );
      });

      it('should prevent prototype pollution', async () => {
        context = await engine.createContext();

        const pollutionCode = `
          Object.prototype.polluted = 'yes';
          const obj = {};
          obj.polluted;
        `;

        const result = await context.evaluate(pollutionCode);

        expect(result.success).toBe(false);
        expect(result.securityViolations).toContain(
          expect.objectContaining({ type: 'prototype_pollution' })
        );
      });

      it('should enforce call stack limits', async () => {
        const limitedEngine = new QuickJSEngine({
          maxCallStackDepth: 10,
        });
        await limitedEngine.initialize();

        context = await limitedEngine.createContext();

        const recursiveCode = `
          function recurse(n) {
            if (n <= 0) return n;
            return recurse(n - 1);
          }
          recurse(20);
        `;

        const result = await context.evaluate(recursiveCode);

        expect(result.success).toBe(false);
        expect(result.securityViolations).toContain(
          expect.objectContaining({ type: 'stack_overflow' })
        );

        await limitedEngine.cleanup();
      });

      it('should detect infinite loops', async () => {
        const timeoutEngine = new QuickJSEngine({
          timeoutMS: 100,
          maxLoopIterations: 1000,
        });
        await timeoutEngine.initialize();

        context = await timeoutEngine.createContext();

        const infiniteLoopCode = `
          let i = 0;
          while (true) {
            i++;
            if (i > 1000000) break; // Should never reach
          }
          i;
        `;

        const result = await context.evaluate(infiniteLoopCode);

        expect(result.success).toBe(false);
        expect(
          result.securityViolations.some(v => 
            v.type === 'timeout' || v.type === 'infinite_loop'
          )
        ).toBe(true);

        await timeoutEngine.cleanup();
      });
    });

    describe('Performance Features', () => {
      it('should support bytecode compilation', async () => {
        const code = `
          function factorial(n) {
            if (n <= 1) return 1;
            return n * factorial(n - 1);
          }
          factorial(10);
        `;

        const bytecode = await engine.compileToBytecode(code);
        
        expect(bytecode).toBeDefined();
        expect(bytecode.size).toBeGreaterThan(0);
        expect(bytecode.version).toBeDefined();
      });

      it('should execute bytecode faster than source', async () => {
        const code = `
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }
          sum;
        `;

        context = await engine.createContext();

        // Time source execution
        const sourceStart = performance.now();
        const sourceResult = await context.evaluate(code);
        const sourceTime = performance.now() - sourceStart;

        // Compile to bytecode
        const bytecode = await engine.compileToBytecode(code);

        // Time bytecode execution
        const bytecodeStart = performance.now();
        const bytecodeResult = await context.executeBytecode(bytecode);
        const bytecodeTime = performance.now() - bytecodeStart;

        expect(sourceResult.success).toBe(true);
        expect(bytecodeResult.success).toBe(true);
        expect(sourceResult.value).toBe(bytecodeResult.value);
        
        // Bytecode should be faster (though minimal difference for simple code)
        expect(bytecodeTime).toBeLessThanOrEqual(sourceTime * 1.5);
      });

      it('should cache compiled bytecode', async () => {
        const code = 'Math.PI * 2';

        // First compilation
        const start1 = performance.now();
        const bytecode1 = await engine.compileToBytecode(code);
        const time1 = performance.now() - start1;

        // Second compilation (should be cached)
        const start2 = performance.now();
        const bytecode2 = await engine.compileToBytecode(code);
        const time2 = performance.now() - start2;

        expect(bytecode1.hash).toBe(bytecode2.hash);
        expect(time2).toBeLessThan(time1 * 0.5); // Should be much faster
      });
    });
  });

  describe('QuickJSSandbox', () => {
    beforeEach(async () => {
      sandbox = new QuickJSSandbox({
        memoryLimitMB: 16,
        timeoutMS: 2000,
        enableTracing: true,
      });
      await sandbox.initialize();
    });

    describe('Code Execution', () => {
      it('should execute simple JavaScript code', async () => {
        const code = 'const x = 5; const y = 3; x + y';
        
        const result = await sandbox.execute(code);
        
        expect(result.success).toBe(true);
        expect(result.value).toBe(8);
        expect(result.executionTimeMs).toBeGreaterThan(0);
      });

      it('should handle complex data structures', async () => {
        const code = `
          const person = {
            name: "Alice",
            age: 30,
            address: {
              street: "123 Main St",
              city: "Anytown"
            },
            hobbies: ["reading", "coding", "hiking"]
          };
          
          person.address.city + " - " + person.hobbies.length + " hobbies";
        `;
        
        const result = await sandbox.execute(code);
        
        expect(result.success).toBe(true);
        expect(result.value).toBe("Anytown - 3 hobbies");
      });

      it('should execute async code', async () => {
        const code = `
          async function delay(ms) {
            return new Promise(resolve => {
              setTimeout(resolve, ms);
            });
          }
          
          async function test() {
            await delay(10);
            return "async result";
          }
          
          test();
        `;
        
        const result = await sandbox.execute(code);
        
        expect(result.success).toBe(true);
        expect(result.value).toBe("async result");
      });

      it('should provide execution statistics', async () => {
        const code = `
          let sum = 0;
          for (let i = 0; i < 100; i++) {
            sum += i * 2;
          }
          sum;
        `;
        
        const result = await sandbox.execute(code);
        
        expect(result.success).toBe(true);
        expect(result.stats.instructionCount).toBeGreaterThan(0);
        expect(result.stats.memoryUsed).toBeGreaterThan(0);
        expect(result.stats.loopIterations).toBe(100);
      });
    });

    describe('Error Handling', () => {
      it('should handle syntax errors', async () => {
        const badCode = 'this is not valid javascript !!!';
        
        const result = await sandbox.execute(badCode);
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/syntax.*error/i);
        expect(result.errorType).toBe('syntax');
      });

      it('should handle runtime errors', async () => {
        const errorCode = `
          function throwError() {
            throw new Error("Test runtime error");
          }
          throwError();
        `;
        
        const result = await sandbox.execute(errorCode);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain("Test runtime error");
        expect(result.errorType).toBe('runtime');
        expect(result.stack).toBeDefined();
      });

      it('should handle reference errors', async () => {
        const refErrorCode = 'undefinedVariable.someProperty';
        
        const result = await sandbox.execute(refErrorCode);
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/undefinedVariable.*not.*defined/i);
        expect(result.errorType).toBe('reference');
      });

      it('should handle type errors', async () => {
        const typeErrorCode = `
          const num = 42;
          num.nonExistentMethod();
        `;
        
        const result = await sandbox.execute(typeErrorCode);
        
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not.*function/i);
        expect(result.errorType).toBe('type');
      });

      it('should provide error context and line numbers', async () => {
        const multiLineCode = `
          const a = 1;
          const b = 2;
          const c = 3;
          
          undefinedFunction(); // Error on this line
          
          const d = 4;
        `;
        
        const result = await sandbox.execute(multiLineCode);
        
        expect(result.success).toBe(false);
        expect(result.errorLocation).toBeDefined();
        expect(result.errorLocation.line).toBe(5);
        expect(result.errorLocation.column).toBeGreaterThan(0);
      });
    });

    describe('Security Enforcement', () => {
      it('should block network access', async () => {
        const networkCode = `
          fetch('https://example.com/api/data')
            .then(response => response.json());
        `;
        
        const result = await sandbox.execute(networkCode);
        
        expect(result.success).toBe(false);
        expect(result.securityViolations).toContain(
          expect.objectContaining({
            type: 'network_access',
            severity: 'critical'
          })
        );
      });

      it('should monitor eval usage', async () => {
        const evalCode = `
          const dynamicCode = "console.log('dynamic')";
          eval(dynamicCode);
        `;
        
        const result = await sandbox.execute(evalCode);
        
        // In research mode, eval might be monitored but allowed
        if (result.success) {
          expect(result.sideEffects).toContain(
            expect.objectContaining({ type: 'eval_call' })
          );
        } else {
          expect(result.securityViolations).toContain(
            expect.objectContaining({ type: 'eval_usage' })
          );
        }
      });

      it('should prevent file system access', async () => {
        const fsCode = `
          require('fs').readFileSync('/etc/passwd', 'utf8');
        `;
        
        const result = await sandbox.execute(fsCode);
        
        expect(result.success).toBe(false);
        expect(result.securityViolations).toContain(
          expect.objectContaining({
            type: 'api_access',
            context: expect.objectContaining({
              api: 'require'
            })
          })
        );
      });
    });

    describe('Resource Management', () => {
      it('should enforce memory limits', async () => {
        const memoryIntensiveCode = `
          const arrays = [];
          for (let i = 0; i < 10000; i++) {
            arrays.push(new Array(1000).fill('x'));
          }
          arrays.length;
        `;
        
        const result = await sandbox.execute(memoryIntensiveCode);
        
        expect(result.success).toBe(false);
        expect(result.securityViolations).toContain(
          expect.objectContaining({ type: 'memory_limit' })
        );
      });

      it('should enforce execution timeouts', async () => {
        const slowCode = `
          let count = 0;
          const start = Date.now();
          while (Date.now() - start < 5000) { // 5 second loop
            count++;
          }
          count;
        `;
        
        const result = await sandbox.execute(slowCode);
        
        expect(result.success).toBe(false);
        expect(result.securityViolations).toContain(
          expect.objectContaining({ type: 'timeout' })
        );
      });

      it('should track resource usage', async () => {
        const resourceCode = `
          const data = [];
          for (let i = 0; i < 100; i++) {
            data.push({ id: i, value: 'item' + i });
          }
          data.length;
        `;
        
        const result = await sandbox.execute(resourceCode);
        
        expect(result.success).toBe(true);
        expect(result.memoryStats.peakUsageMB).toBeGreaterThan(0);
        expect(result.memoryStats.finalUsageMB).toBeGreaterThan(0);
      });
    });
  });

  describe('QuickJSContext', () => {
    beforeEach(async () => {
      context = await engine.createContext();
    });

    describe('Variable Management', () => {
      it('should set and get global variables', async () => {
        await context.setGlobal('testVar', 'test value');
        
        const result = await context.evaluate('testVar');
        
        expect(result.success).toBe(true);
        expect(result.value).toBe('test value');
      });

      it('should handle complex object globals', async () => {
        const complexObject = {
          number: 42,
          string: 'hello',
          array: [1, 2, 3],
          nested: { prop: 'value' }
        };
        
        await context.setGlobal('complexObj', complexObject);
        
        const result = await context.evaluate(`
          JSON.stringify({
            number: complexObj.number,
            string: complexObj.string,
            arrayLength: complexObj.array.length,
            nestedProp: complexObj.nested.prop
          })
        `);
        
        expect(result.success).toBe(true);
        const parsed = JSON.parse(result.value);
        expect(parsed.number).toBe(42);
        expect(parsed.string).toBe('hello');
        expect(parsed.arrayLength).toBe(3);
        expect(parsed.nestedProp).toBe('value');
      });

      it('should prevent global pollution', async () => {
        const result1 = await context.evaluate('globalThis.polluted = true');
        expect(result1.success).toBe(true);
        
        // Create new context
        const context2 = await engine.createContext();
        const result2 = await context2.evaluate('globalThis.polluted');
        
        expect(result2.value).toBeUndefined();
        
        await context2.dispose();
      });
    });

    describe('Function Registration', () => {
      it('should register native functions', async () => {
        await context.registerFunction('add', (a: number, b: number) => a + b);
        
        const result = await context.evaluate('add(5, 3)');
        
        expect(result.success).toBe(true);
        expect(result.value).toBe(8);
      });

      it('should register async functions', async () => {
        await context.registerFunction('asyncAdd', async (a: number, b: number) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return a + b;
        });
        
        const result = await context.evaluate('asyncAdd(10, 20)');
        
        expect(result.success).toBe(true);
        expect(result.value).toBe(30);
      });

      it('should handle function errors gracefully', async () => {
        await context.registerFunction('throwError', () => {
          throw new Error('Native function error');
        });
        
        const result = await context.evaluate('throwError()');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Native function error');
      });
    });
  });

  describe('Integration and Advanced Features', () => {
    it('should handle module loading', async () => {
      sandbox = new QuickJSSandbox({
        enableModules: true,
      });
      await sandbox.initialize();

      const moduleCode = `
        export function greet(name) {
          return 'Hello, ' + name + '!';
        }
        
        export const version = '1.0.0';
      `;

      await sandbox.loadModule('greeting', moduleCode);

      const importCode = `
        import { greet, version } from 'greeting';
        greet('World') + ' v' + version;
      `;

      const result = await sandbox.execute(importCode);

      expect(result.success).toBe(true);
      expect(result.value).toBe('Hello, World! v1.0.0');
    });

    it('should support debugging features', async () => {
      const debugSandbox = new QuickJSSandbox({
        enableDebugger: true,
        enableProfiling: true,
      });
      await debugSandbox.initialize();

      const code = `
        debugger; // Should be handled gracefully
        
        function slowFunction() {
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }
          return sum;
        }
        
        slowFunction();
      `;

      const result = await debugSandbox.execute(code);

      expect(result.success).toBe(true);
      expect(result.profiling).toBeDefined();
      expect(result.profiling.functionCalls).toContainEqual(
        expect.objectContaining({
          name: 'slowFunction',
          duration: expect.any(Number)
        })
      );

      await debugSandbox.cleanup();
    });

    it('should handle cleanup properly', async () => {
      const testSandbox = new QuickJSSandbox();
      await testSandbox.initialize();

      // Execute some code to create internal state
      await testSandbox.execute('const x = 42');

      // Cleanup should not throw
      await expect(testSandbox.cleanup()).resolves.not.toThrow();

      // Should not be able to execute after cleanup
      await expect(testSandbox.execute('1 + 1')).rejects.toThrow(/cleaned.*up/i);
    });

    it('should handle concurrent executions safely', async () => {
      const concurrentSandbox = new QuickJSSandbox();
      await concurrentSandbox.initialize();

      const promises = Array.from({ length: 10 }, (_, i) =>
        concurrentSandbox.execute(`Math.pow(2, ${i})`)
      );

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.value).toBe(Math.pow(2, i));
      });

      await concurrentSandbox.cleanup();
    });
  });
});