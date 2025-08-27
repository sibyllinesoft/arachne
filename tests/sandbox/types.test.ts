/**
 * @fileoverview Tests for sandbox type definitions
 */

import { describe, it, expect } from 'vitest';
import type { 
  SandboxPolicy, 
  SecurityRule, 
  SecurityViolation 
} from '../../src/sandbox/types.ts';

describe('Sandbox Types', () => {
  describe('SandboxPolicy', () => {
    it('should create valid sandbox policy', () => {
      const policy: SandboxPolicy = {
        maxMemoryMB: 100,
        maxExecutionTimeMS: 5000,
        maxCallDepth: 100,
        allowedAPIs: ['console.log', 'Math.random'],
        blockedPatterns: [/eval/, /Function/],
        enableTracing: true,
        maxLoopIterations: 10000,
        allowNetworkAccess: false,
        allowFileSystemAccess: false,
        allowedFilePaths: [],
        allowProcessSpawning: false,
        customSecurityRules: []
      };

      expect(policy.maxMemoryMB).toBe(100);
      expect(policy.maxExecutionTimeMS).toBe(5000);
      expect(policy.maxCallDepth).toBe(100);
      expect(policy.allowedAPIs).toHaveLength(2);
      expect(policy.blockedPatterns).toHaveLength(2);
      expect(policy.enableTracing).toBe(true);
      expect(policy.maxLoopIterations).toBe(10000);
      expect(policy.allowNetworkAccess).toBe(false);
      expect(policy.allowFileSystemAccess).toBe(false);
      expect(policy.allowProcessSpawning).toBe(false);
    });

    it('should create minimal sandbox policy', () => {
      const policy: SandboxPolicy = {
        maxMemoryMB: 50,
        maxExecutionTimeMS: 1000,
        maxCallDepth: 50,
        allowedAPIs: [],
        blockedPatterns: [],
        enableTracing: false
      };

      expect(policy.maxMemoryMB).toBe(50);
      expect(policy.allowedAPIs).toHaveLength(0);
      expect(policy.blockedPatterns).toHaveLength(0);
      expect(policy.enableTracing).toBe(false);
    });

    it('should create secure sandbox policy', () => {
      const policy: SandboxPolicy = {
        maxMemoryMB: 10,
        maxExecutionTimeMS: 500,
        maxCallDepth: 10,
        allowedAPIs: [], // No APIs allowed
        blockedPatterns: [/.*/, /eval/, /Function/, /require/, /import/],
        enableTracing: true,
        maxLoopIterations: 100,
        allowNetworkAccess: false,
        allowFileSystemAccess: false,
        allowProcessSpawning: false
      };

      expect(policy.maxMemoryMB).toBe(10);
      expect(policy.allowedAPIs).toHaveLength(0);
      expect(policy.blockedPatterns).toHaveLength(5);
      expect(policy.allowNetworkAccess).toBe(false);
      expect(policy.allowFileSystemAccess).toBe(false);
      expect(policy.allowProcessSpawning).toBe(false);
    });
  });

  describe('SecurityRule', () => {
    it('should create security rule with regex pattern', () => {
      const rule: SecurityRule = {
        id: 'block-eval',
        description: 'Block eval usage',
        pattern: /eval\s*\(/,
        action: 'block',
        severity: 'high'
      };

      expect(rule.id).toBe('block-eval');
      expect(rule.description).toBe('Block eval usage');
      expect(rule.pattern).toBeInstanceOf(RegExp);
      expect(rule.action).toBe('block');
      expect(rule.severity).toBe('high');
    });

    it('should create security rule with string pattern', () => {
      const rule: SecurityRule = {
        id: 'warn-setTimeout',
        description: 'Warn on setTimeout usage',
        pattern: 'setTimeout',
        action: 'warn',
        severity: 'medium'
      };

      expect(rule.pattern).toBe('setTimeout');
      expect(rule.action).toBe('warn');
      expect(rule.severity).toBe('medium');
    });

    it('should create critical security rule', () => {
      const rule: SecurityRule = {
        id: 'block-process',
        description: 'Block process access',
        pattern: /process\./,
        action: 'block',
        severity: 'critical'
      };

      expect(rule.severity).toBe('critical');
      expect(rule.action).toBe('block');
    });

    it('should create log-only security rule', () => {
      const rule: SecurityRule = {
        id: 'log-console',
        description: 'Log console usage',
        pattern: 'console',
        action: 'log',
        severity: 'low'
      };

      expect(rule.action).toBe('log');
      expect(rule.severity).toBe('low');
    });
  });

  describe('SecurityViolation', () => {
    it('should create timeout violation', () => {
      const violation: SecurityViolation = {
        type: 'timeout',
        message: 'Execution exceeded maximum time limit',
        severity: 'high',
        timestamp: Date.now()
      };

      expect(violation.type).toBe('timeout');
      expect(violation.message).toContain('time limit');
      expect(violation.severity).toBe('high');
      expect(typeof violation.timestamp).toBe('number');
    });

    it('should create memory limit violation', () => {
      const violation: SecurityViolation = {
        type: 'memory_limit',
        message: 'Memory usage exceeded 100MB limit',
        severity: 'critical',
        timestamp: Date.now()
      };

      expect(violation.type).toBe('memory_limit');
      expect(violation.severity).toBe('critical');
    });

    it('should create API access violation', () => {
      const violation: SecurityViolation = {
        type: 'api_access',
        message: 'Attempt to access blocked API: require',
        severity: 'high',
        timestamp: Date.now()
      };

      expect(violation.type).toBe('api_access');
      expect(violation.message).toContain('require');
    });

    it('should create violation with context', () => {
      const violation: SecurityViolation = {
        type: 'code_injection',
        message: 'Detected eval usage',
        severity: 'critical',
        timestamp: Date.now(),
        context: {
          location: {
            line: 42,
            column: 15,
            source: 'evil.js'
          },
          callStack: [
            'at maliciousFunction (evil.js:42:15)',
            'at main (app.js:10:3)'
          ]
        }
      };

      expect(violation.context).toBeDefined();
      expect(violation.context?.location?.line).toBe(42);
      expect(violation.context?.location?.column).toBe(15);
      expect(violation.context?.location?.source).toBe('evil.js');
      expect(violation.context?.callStack).toHaveLength(2);
    });

    it('should create prototype pollution violation', () => {
      const violation: SecurityViolation = {
        type: 'prototype_pollution',
        message: 'Attempt to modify Object.prototype',
        severity: 'critical',
        timestamp: Date.now()
      };

      expect(violation.type).toBe('prototype_pollution');
      expect(violation.severity).toBe('critical');
    });

    it('should create infinite loop violation', () => {
      const violation: SecurityViolation = {
        type: 'infinite_loop',
        message: 'Loop exceeded maximum iterations (10000)',
        severity: 'medium',
        timestamp: Date.now()
      };

      expect(violation.type).toBe('infinite_loop');
      expect(violation.message).toContain('10000');
    });

    it('should create stack overflow violation', () => {
      const violation: SecurityViolation = {
        type: 'stack_overflow',
        message: 'Call stack exceeded maximum depth (100)',
        severity: 'high',
        timestamp: Date.now()
      };

      expect(violation.type).toBe('stack_overflow');
      expect(violation.severity).toBe('high');
    });

    it('should create eval usage violation', () => {
      const violation: SecurityViolation = {
        type: 'eval_usage',
        message: 'Direct eval() usage detected',
        severity: 'critical',
        timestamp: Date.now()
      };

      expect(violation.type).toBe('eval_usage');
      expect(violation.severity).toBe('critical');
    });

    it('should create function constructor violation', () => {
      const violation: SecurityViolation = {
        type: 'function_constructor',
        message: 'Function constructor usage detected',
        severity: 'high',
        timestamp: Date.now()
      };

      expect(violation.type).toBe('function_constructor');
      expect(violation.severity).toBe('high');
    });
  });

  describe('Type Validation', () => {
    it('should validate violation types', () => {
      const validTypes = [
        'timeout', 'memory_limit', 'api_access', 'file_access', 'network_access',
        'prototype_pollution', 'code_injection', 'infinite_loop', 'stack_overflow',
        'initialization_failure', 'custom_rule', 'eval_usage', 'function_constructor'
      ];

      validTypes.forEach(type => {
        const violation: SecurityViolation = {
          type: type as any,
          message: `Test ${type}`,
          severity: 'medium',
          timestamp: Date.now()
        };
        expect(violation.type).toBe(type);
      });
    });

    it('should validate severity levels', () => {
      const severityLevels = ['low', 'medium', 'high', 'critical'] as const;

      severityLevels.forEach(severity => {
        const violation: SecurityViolation = {
          type: 'timeout',
          message: 'Test message',
          severity,
          timestamp: Date.now()
        };
        expect(violation.severity).toBe(severity);

        const rule: SecurityRule = {
          id: 'test-rule',
          description: 'Test description',
          pattern: 'test',
          action: 'warn',
          severity
        };
        expect(rule.severity).toBe(severity);
      });
    });

    it('should validate security rule actions', () => {
      const actions = ['block', 'warn', 'log'] as const;

      actions.forEach(action => {
        const rule: SecurityRule = {
          id: 'test-rule',
          description: 'Test description',
          pattern: 'test',
          action,
          severity: 'medium'
        };
        expect(rule.action).toBe(action);
      });
    });
  });

  describe('Complex Policy Scenarios', () => {
    it('should create development sandbox policy', () => {
      const devPolicy: SandboxPolicy = {
        maxMemoryMB: 500,
        maxExecutionTimeMS: 30000,
        maxCallDepth: 500,
        allowedAPIs: [
          'console.log', 'console.error', 'console.warn',
          'Math.*', 'String.*', 'Array.*', 'Object.*'
        ],
        blockedPatterns: [/eval/, /Function\s*\(/, /require/, /import\s*\(/],
        enableTracing: true,
        maxLoopIterations: 100000,
        allowNetworkAccess: false,
        allowFileSystemAccess: false,
        customSecurityRules: [
          {
            id: 'dev-warn-timeout',
            description: 'Warn on potential timeout issues',
            pattern: /while\s*\(\s*true/,
            action: 'warn',
            severity: 'medium'
          }
        ]
      };

      expect(devPolicy.maxMemoryMB).toBe(500);
      expect(devPolicy.allowedAPIs).toHaveLength(7);
      expect(devPolicy.customSecurityRules).toHaveLength(1);
      expect(devPolicy.customSecurityRules?.[0]?.id).toBe('dev-warn-timeout');
    });

    it('should create production sandbox policy', () => {
      const prodPolicy: SandboxPolicy = {
        maxMemoryMB: 50,
        maxExecutionTimeMS: 5000,
        maxCallDepth: 50,
        allowedAPIs: [], // Minimal allowlist
        blockedPatterns: [
          /eval/, /Function/, /require/, /import/, /process/, /global/,
          /console/, /setTimeout/, /setInterval/, /XMLHttpRequest/, /fetch/
        ],
        enableTracing: false, // Performance in prod
        maxLoopIterations: 1000,
        allowNetworkAccess: false,
        allowFileSystemAccess: false,
        allowProcessSpawning: false,
        customSecurityRules: [
          {
            id: 'prod-block-all-dynamic',
            description: 'Block all dynamic code execution',
            pattern: /(eval|Function|setTimeout|setInterval)/,
            action: 'block',
            severity: 'critical'
          }
        ]
      };

      expect(prodPolicy.maxMemoryMB).toBe(50);
      expect(prodPolicy.enableTracing).toBe(false);
      expect(prodPolicy.blockedPatterns).toHaveLength(11);
      expect(prodPolicy.customSecurityRules?.[0]?.severity).toBe('critical');
    });
  });
});