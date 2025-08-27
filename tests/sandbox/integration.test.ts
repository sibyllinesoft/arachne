/**
 * @fileoverview Integration tests for sandbox components
 * 
 * Tests the interaction between sandbox components including tracing,
 * resource management, API stubs, and dynamic code interception.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  QuickJSSandbox,
  ResourceManager,
  ExecutionTracer,
  APIStubs,
  DynamicCodeInterceptor,
  createResearchSandbox,
  analyzeSandboxResult,
  SandboxHealthMonitor,
  type SandboxPolicy,
} from '../../src/sandbox/index.js';

describe('Sandbox Integration Tests', () => {
  let sandbox: QuickJSSandbox;
  let healthMonitor: SandboxHealthMonitor;

  beforeEach(() => {
    healthMonitor = new SandboxHealthMonitor();
  });

  afterEach(async () => {
    if (sandbox) {
      await sandbox.cleanup();
    }
  });

  describe('Component Integration', () => {
    it('should integrate tracer with resource manager', async () => {
      sandbox = createResearchSandbox({
        enableTracing: true,
        maxExecutionTimeMS: 2000,
      });
      await sandbox.initialize();

      const code = `
        function factorial(n) {
          if (n <= 1) return 1;
          return n * factorial(n - 1);
        }
        
        const result = factorial(10);
        console.log('Factorial of 10:', result);
        return result;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(true);
      expect(result.trace.stats.totalFunctionCalls).toBeGreaterThan(10);
      expect(result.memoryStats.heapUsageMB).toBeGreaterThan(0);
      expect(result.sideEffects.some(se => se.type === 'api_call')).toBe(true);
    });

    it('should correlate execution trace with IR metadata', async () => {
      sandbox = createResearchSandbox({ enableTracing: true });
      await sandbox.initialize();

      const code = `
        const obj = { x: 10, y: 20 };
        const sum = obj.x + obj.y;
        return sum;
      `;

      const correlationIds = {
        nodeId: 'node_123' as any,
        scopeId: 456 as any,
        shapeId: 789 as any,
      };

      const result = await sandbox.execute(code, undefined, correlationIds);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.irCorrelation).toEqual(correlationIds);
      expect(result.trace.entries.length).toBeGreaterThan(0);
    });

    it('should handle complex obfuscated code with full tracing', async () => {
      sandbox = createResearchSandbox({
        enableTracing: true,
        maxExecutionTimeMS: 5000,
      });
      await sandbox.initialize();

      const code = `
        // Complex obfuscation simulation
        const lookup = ['charAt', 'fromCharCode', 'split', 'join', 'replace'];
        const data = [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100];
        
        let decoder = '';
        for (let i = 0; i < lookup.length; i++) {
          if (lookup[i] === 'fromCharCode') {
            decoder = lookup[i];
            break;
          }
        }
        
        const result = String[decoder](...data);
        
        // String manipulation
        const processed = result[lookup[2]](' ')[lookup[3]]('')
          [lookup[4]](/l/g, '1')[lookup[4]](/o/g, '0');
        
        return {
          original: result,
          processed: processed,
          method: decoder
        };
      `;

      const result = await sandbox.execute(code);
      const analysis = analyzeSandboxResult(result);
      
      expect(result.success).toBe(true);
      expect(analysis.obfuscationLevel).toBeGreaterThan(20);
      expect(result.trace.constants.size).toBeGreaterThan(0);
      expect(result.trace.stats.totalStringOperations).toBeGreaterThan(0);
      expect(analysis.deobfuscationOpportunities.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Management Integration', () => {
    it('should enforce memory limits across all components', async () => {
      sandbox = createResearchSandbox({
        maxMemoryMB: 8, // Very low limit
        maxExecutionTimeMS: 3000,
      });
      await sandbox.initialize();

      const code = `
        const arrays = [];
        for (let i = 0; i < 1000; i++) {
          arrays.push(new Array(1000).fill('memory test'));
          // Add some tracing overhead
          console.log('Iteration', i);
        }
        return arrays.length;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'memory_limit')).toBe(true);
      expect(result.memoryStats.heapUsageMB).toBeLessThanOrEqual(8);
    });

    it('should track resource usage in health monitoring', async () => {
      sandbox = createResearchSandbox();
      await sandbox.initialize();

      const code1 = `
        const data = new Array(1000).fill('test');
        return data.length;
      `;

      const code2 = `
        let sum = 0;
        for (let i = 0; i < 10000; i++) {
          sum += i;
        }
        return sum;
      `;

      await sandbox.execute(code1);
      const health1 = healthMonitor.recordHealth(sandbox);
      
      await sandbox.execute(code2);
      const health2 = healthMonitor.recordHealth(sandbox);
      
      expect(health1.healthy).toBe(true);
      expect(health2.healthy).toBe(true);
      expect(health1.resourceUsage.memoryUsage.heapUsageMB).toBeGreaterThan(0);
      expect(health2.resourceUsage.executionTime).toBeGreaterThan(0);
    });
  });

  describe('API Stub Integration', () => {
    it('should provide comprehensive DOM stubs for browser code analysis', async () => {
      sandbox = createResearchSandbox();
      await sandbox.initialize();

      const code = `
        // Simulate browser-based obfuscated code
        const elem = document.createElement('div');
        elem.innerHTML = 'test';
        document.body.appendChild(elem);
        
        const selected = document.getElementById('test') || 
          document.querySelector('.test') || 
          document.getElementsByTagName('div')[0];
        
        window.alert('Browser code detected');
        localStorage.setItem('key', 'value');
        const stored = localStorage.getItem('key');
        
        return {
          element: elem.tagName,
          stored: stored,
          location: window.location.href
        };
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(true);
      expect(result.sideEffects.length).toBeGreaterThan(5);
      expect(result.sideEffects.some(se => se.target.includes('document'))).toBe(true);
      expect(result.sideEffects.some(se => se.target.includes('localStorage'))).toBe(true);
      expect(result.sideEffects.some(se => se.target.includes('window'))).toBe(true);
    });

    it('should capture console output for analysis', async () => {
      sandbox = createResearchSandbox();
      await sandbox.initialize();

      const code = `
        console.log('Starting analysis');
        console.warn('Potential issue detected');
        console.error('Critical error occurred');
        console.info('Information message');
        
        const data = { x: 1, y: 2 };
        console.log('Data:', JSON.stringify(data));
        
        return 'console test complete';
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(true);
      const consoleCalls = result.sideEffects.filter(se => se.target.startsWith('console'));
      expect(consoleCalls.length).toBe(5);
      expect(consoleCalls.some(se => se.target === 'console.log')).toBe(true);
      expect(consoleCalls.some(se => se.target === 'console.error')).toBe(true);
    });
  });

  describe('Dynamic Code Interception Integration', () => {
    it('should intercept and analyze nested dynamic code generation', async () => {
      sandbox = createResearchSandbox();
      await sandbox.initialize();

      const code = `
        // Multi-layer dynamic code generation
        const layer1 = 'eval';
        const layer2 = 'return "console.log(\\'nested code\\')"';
        
        const result1 = eval('"' + layer1 + '"');
        const result2 = eval('(function() { ' + layer2 + ' })()');
        const result3 = eval(result2);
        
        // Function constructor usage
        const fn = new Function('x', 'return x * 2');
        const computed = fn(21);
        
        return { result1, result2, computed };
      `;

      const result = await sandbox.execute(code);
      
      const evalCalls = result.sideEffects.filter(se => se.type === 'eval_call');
      const functionCalls = result.sideEffects.filter(se => se.type === 'function_creation');
      
      expect(evalCalls.length).toBeGreaterThan(0);
      expect(functionCalls.length).toBeGreaterThan(0);
      
      const analysis = analyzeSandboxResult(result);
      expect(analysis.executionSummary.dynamicCodeGeneration).toBeGreaterThan(0);
      expect(analysis.obfuscationLevel).toBeGreaterThan(30);
    });

    it('should detect escape attempts in dynamic code', async () => {
      sandbox = createResearchSandbox();
      await sandbox.initialize();

      const code = `
        try {
          // Attempt constructor manipulation
          const escape1 = eval('({}).constructor.constructor');
          
          // Attempt prototype pollution
          eval('Object.prototype.polluted = true');
          
          // Attempt context escape
          const escape2 = new Function('return this.process');
          
          return 'escape attempts made';
        } catch (e) {
          return 'escape attempts blocked: ' + e.message;
        }
      `;

      const result = await sandbox.execute(code);
      
      // Should detect and block escape attempts
      expect(
        result.securityViolations.some(v => 
          v.type === 'code_injection' || 
          v.type === 'prototype_pollution' ||
          v.message.includes('constructor') ||
          v.message.includes('escape')
        )
      ).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent sandbox operations', async () => {
      const sandboxes = await Promise.all([
        (async () => {
          const sb = createResearchSandbox();
          await sb.initialize();
          return sb;
        })(),
        (async () => {
          const sb = createResearchSandbox();
          await sb.initialize();
          return sb;
        })(),
        (async () => {
          const sb = createResearchSandbox();
          await sb.initialize();
          return sb;
        })(),
      ]);

      const codes = [
        'return Math.pow(2, 10);',
        'return [1,2,3].map(x => x * x).reduce((a,b) => a + b);',
        'return new Date().getTime();',
      ];

      const results = await Promise.all(
        sandboxes.map((sb, i) => sb.execute(codes[i]))
      );

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Cleanup
      await Promise.all(sandboxes.map(sb => sb.cleanup()));
    });

    it('should maintain performance under stress', async () => {
      sandbox = createResearchSandbox({
        maxExecutionTimeMS: 10000,
        maxMemoryMB: 128,
      });
      await sandbox.initialize();

      const iterations = 50;
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        const code = `
          const data = new Array(${100 + i}).fill(${i});
          const processed = data.map(x => x * 2).filter(x => x > ${i});
          return processed.length;
        `;
        
        const startTime = Date.now();
        const result = await sandbox.execute(code);
        const duration = Date.now() - startTime;
        
        results.push({ iteration: i, success: result.success, duration });
      }

      const successRate = results.filter(r => r.success).length / results.length;
      const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(averageDuration).toBeLessThan(100); // Average under 100ms
    });
  });

  describe('Error Recovery and Cleanup', () => {
    it('should recover gracefully from sandbox failures', async () => {
      sandbox = createResearchSandbox({
        maxExecutionTimeMS: 500,
        maxMemoryMB: 16,
      });
      await sandbox.initialize();

      // Execute code that will fail
      const badCode = `
        const bomb = 'x';
        for (let i = 0; i < 30; i++) {
          bomb += bomb; // Exponential growth
        }
        return bomb.length;
      `;

      const result1 = await sandbox.execute(badCode);
      expect(result1.success).toBe(false);

      // Sandbox should still work for normal code
      const goodCode = 'return 42;';
      const result2 = await sandbox.execute(goodCode);
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(42);
    });

    it('should properly clean up resources after execution', async () => {
      sandbox = createResearchSandbox();
      await sandbox.initialize();

      const initialHealth = healthMonitor.recordHealth(sandbox);
      
      // Execute multiple operations
      for (let i = 0; i < 10; i++) {
        await sandbox.execute(`
          const data = new Array(1000).fill('test');
          return data.slice(0, 10).join(',');
        `);
      }

      const finalHealth = healthMonitor.recordHealth(sandbox);
      
      // Memory usage should not grow unboundedly
      const memoryGrowth = finalHealth.resourceUsage.memoryUsage.heapUsageMB - 
                          initialHealth.resourceUsage.memoryUsage.heapUsageMB;
      
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth
      expect(finalHealth.healthy).toBe(true);
    });
  });

  describe('Real-world Obfuscation Patterns', () => {
    beforeEach(async () => {
      sandbox = createResearchSandbox({
        enableTracing: true,
        maxExecutionTimeMS: 10000,
      });
      await sandbox.initialize();
    });

    it('should handle webpack-style obfuscated bundles', async () => {
      const code = `
        (function(modules) {
          function __webpack_require__(moduleId) {
            var module = { exports: {} };
            modules[moduleId](module, module.exports, __webpack_require__);
            return module.exports;
          }
          return __webpack_require__(0);
        })([
          function(module, exports) {
            const data = [72, 101, 108, 108, 111];
            const str = data.map(x => String.fromCharCode(x)).join('');
            module.exports = str;
          }
        ]);
      `;

      const result = await sandbox.execute(code);
      const analysis = analyzeSandboxResult(result);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('Hello');
      expect(analysis.obfuscationLevel).toBeGreaterThan(10);
      expect(result.trace.stats.totalFunctionCalls).toBeGreaterThan(0);
    });

    it('should analyze JavaScript packer patterns', async () => {
      const code = `
        // Simulated packed JavaScript pattern
        eval(function(p,a,c,k,e,r){
          e=function(c){
            return(c<62?'':e(parseInt(c/62)))+
            ((c=c%62)>35?String.fromCharCode(c+29):c.toString(36))
          };
          if('0'.replace(0,e)==0){
            while(c--)r[e(c)]=k[c];
            k=[function(e){return r[e]||e}];
            e=function(){return'[0-9a-z]+'};
            c=1
          }
          while(c--)if(k[c])p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c]);
          return p
        }('0 1=\'2\';3.4(1)',5,5,'var|message|Hello|console|log'.split('|'),0,{}))
      `;

      const result = await sandbox.execute(code);
      
      expect(result.sideEffects.some(se => se.type === 'eval_call')).toBe(true);
      
      const analysis = analyzeSandboxResult(result);
      expect(analysis.obfuscationLevel).toBeGreaterThan(50);
      expect(analysis.deobfuscationOpportunities.some(op => 
        op.includes('dynamic') || op.includes('decode')
      )).toBe(true);
    });
  });
});
