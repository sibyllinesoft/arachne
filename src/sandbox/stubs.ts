/**
 * @fileoverview API stubs and side-effect monitoring for sandbox security
 * 
 * This module provides comprehensive stubs for dangerous APIs, DOM/BOM mocking,
 * and detailed logging of all side-effect attempts with call stack capture.
 */

import type { SideEffect, SecurityViolation } from './types.js';

/**
 * Configuration for API stubbing
 */
interface StubConfig {
  /** Whether to allow the API call (log only) or block it */
  action: 'allow' | 'block' | 'stub';
  
  /** Custom stub implementation */
  implementation?: (...args: any[]) => any;
  
  /** Whether to log the API call */
  logCall: boolean;
  
  /** Security risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  /** Description of why this API is restricted */
  reason: string;
}

/**
 * Stub implementation result
 */
interface StubResult {
  allowed: boolean;
  result?: any;
  sideEffect: SideEffect;
  violation?: SecurityViolation;
}

/**
 * Comprehensive API stubbing system
 */
export class APIStubs {
  private allowedAPIs: string[];
  private blockedPatterns: RegExp[];
  private sideEffects: SideEffect[] = [];
  private violations: SecurityViolation[] = [];
  private stubConfigs: Map<string, StubConfig> = new Map();
  private callCounts: Map<string, number> = new Map();

  constructor(allowedAPIs: string[], blockedPatterns: RegExp[]) {
    this.allowedAPIs = allowedAPIs;
    this.blockedPatterns = blockedPatterns;
    this.initializeDefaultStubs();
  }

  /**
   * Initialize default API stub configurations
   */
  private initializeDefaultStubs(): void {
    // Network-related APIs - Critical security risk
    this.stubConfigs.set('XMLHttpRequest', {
      action: 'block',
      logCall: true,
      riskLevel: 'critical',
      reason: 'Network access prohibited in sandbox',
    });

    this.stubConfigs.set('fetch', {
      action: 'block',
      logCall: true,
      riskLevel: 'critical',
      reason: 'Network access prohibited in sandbox',
    });

    this.stubConfigs.set('WebSocket', {
      action: 'block',
      logCall: true,
      riskLevel: 'critical',
      reason: 'WebSocket connections prohibited in sandbox',
    });

    this.stubConfigs.set('EventSource', {
      action: 'block',
      logCall: true,
      riskLevel: 'critical',
      reason: 'Server-sent events prohibited in sandbox',
    });

    // Code execution APIs - Critical security risk
    this.stubConfigs.set('eval', {
      action: 'stub',
      implementation: this.createEvalStub(),
      logCall: true,
      riskLevel: 'critical',
      reason: 'Dynamic code execution monitored for analysis',
    });

    this.stubConfigs.set('Function', {
      action: 'stub',
      implementation: this.createFunctionStub(),
      logCall: true,
      riskLevel: 'critical',
      reason: 'Function constructor monitored for analysis',
    });

    // Timer APIs - Medium risk (can be used for timing attacks)
    this.stubConfigs.set('setTimeout', {
      action: 'stub',
      implementation: this.createTimerStub('setTimeout'),
      logCall: true,
      riskLevel: 'medium',
      reason: 'Timers controlled to prevent timing-based exploits',
    });

    this.stubConfigs.set('setInterval', {
      action: 'stub',
      implementation: this.createTimerStub('setInterval'),
      logCall: true,
      riskLevel: 'medium',
      reason: 'Intervals controlled to prevent timing-based exploits',
    });

    // File system APIs - High security risk
    this.stubConfigs.set('require', {
      action: 'block',
      logCall: true,
      riskLevel: 'critical',
      reason: 'Module loading prohibited in sandbox',
    });

    this.stubConfigs.set('import', {
      action: 'block',
      logCall: true,
      riskLevel: 'critical',
      reason: 'Dynamic imports prohibited in sandbox',
    });

    // Process APIs - Critical security risk
    this.stubConfigs.set('process', {
      action: 'block',
      logCall: true,
      riskLevel: 'critical',
      reason: 'Process access prohibited in sandbox',
    });

    // Storage APIs - Medium risk
    this.stubConfigs.set('localStorage', {
      action: 'stub',
      implementation: this.createStorageStub('localStorage') as any,
      logCall: true,
      riskLevel: 'medium',
      reason: 'Storage access stubbed for safety',
    });

    this.stubConfigs.set('sessionStorage', {
      action: 'stub',
      implementation: this.createStorageStub('sessionStorage') as any,
      logCall: true,
      riskLevel: 'medium',
      reason: 'Storage access stubbed for safety',
    });

    // DOM manipulation - Medium risk (for browser code analysis)
    this.stubConfigs.set('document', {
      action: 'stub',
      implementation: this.createDocumentStub() as any,
      logCall: true,
      riskLevel: 'medium',
      reason: 'DOM access stubbed for browser code analysis',
    });

    this.stubConfigs.set('window', {
      action: 'stub',
      implementation: this.createWindowStub() as any,
      logCall: true,
      riskLevel: 'medium',
      reason: 'Window object stubbed for browser code analysis',
    });

    // Console - Low risk (often allowed for debugging)
    this.stubConfigs.set('console', {
      action: 'stub',
      implementation: this.createConsoleStub() as any,
      logCall: true,
      riskLevel: 'low',
      reason: 'Console output captured for analysis',
    });
  }

  /**
   * Generate comprehensive API stubs code for injection
   */
  generateStubsCode(): string {
    return `
      (function() {
        'use strict';
        
        // Store original functions before stubbing
        const __original_functions = {};
        
        // Helper function to create call stack
        function getCallStack() {
          try {
            throw new Error();
          } catch (e) {
            return e.stack ? e.stack.split('\\n').slice(2, 10) : ['<unknown>'];
          }
        }
        
        // Helper function to log side effects
        function logSideEffect(type, target, args, result, blocked) {
          if (typeof __sandbox_trace === 'function') {
            __sandbox_trace('side_effect', {
              type: type,
              target: target,
              arguments: Array.from(args || []),
              result: result,
              blocked: blocked,
              timestamp: Date.now(),
              callStack: getCallStack()
            });
          }
        }
        
        // Network API Stubs
        ${this.generateNetworkStubs()}
        
        // Code Execution Stubs
        ${this.generateCodeExecutionStubs()}
        
        // Timer Stubs
        ${this.generateTimerStubs()}
        
        // Storage Stubs
        ${this.generateStorageStubs()}
        
        // DOM/BOM Stubs
        ${this.generateDOMStubs()}
        
        // Console Stub
        ${this.generateConsoleStub()}
        
        // Generic API interceptor
        ${this.generateGenericInterceptor()}
        
      })();
    `;
  }

  /**
   * Generate network API stubs
   */
  private generateNetworkStubs(): string {
    return `
      // XMLHttpRequest stub
      globalThis.XMLHttpRequest = function() {
        logSideEffect('network_attempt', 'XMLHttpRequest', arguments, null, true);
        throw new Error('XMLHttpRequest blocked by sandbox security policy');
      };
      
      // Fetch API stub
      globalThis.fetch = function() {
        logSideEffect('network_attempt', 'fetch', arguments, null, true);
        return Promise.reject(new Error('Fetch blocked by sandbox security policy'));
      };
      
      // WebSocket stub
      globalThis.WebSocket = function() {
        logSideEffect('network_attempt', 'WebSocket', arguments, null, true);
        throw new Error('WebSocket blocked by sandbox security policy');
      };
      
      // EventSource stub
      globalThis.EventSource = function() {
        logSideEffect('network_attempt', 'EventSource', arguments, null, true);
        throw new Error('EventSource blocked by sandbox security policy');
      };
    `;
  }

  /**
   * Generate code execution stubs
   */
  private generateCodeExecutionStubs(): string {
    return `
      // Store original eval and Function
      __original_functions.eval = globalThis.eval;
      __original_functions.Function = globalThis.Function;
      
      // Eval stub with monitoring
      globalThis.eval = function(code) {
        logSideEffect('eval_call', 'eval', [code], null, false);
        
        if (typeof __sandbox_trace === 'function') {
          __sandbox_trace('dynamic_code', {
            type: 'eval',
            code: code,
            callStack: getCallStack()
          });
        }
        
        // Execute with original eval (monitored)
        try {
          const result = __original_functions.eval.call(this, code);
          logSideEffect('eval_call', 'eval', [code], result, false);
          return result;
        } catch (error) {
          logSideEffect('eval_call', 'eval', [code], { error: error.message }, false);
          throw error;
        }
      };
      
      // Function constructor stub with monitoring
      globalThis.Function = function() {
        const args = Array.from(arguments);
        logSideEffect('function_creation', 'Function', args, null, false);
        
        if (typeof __sandbox_trace === 'function') {
          __sandbox_trace('dynamic_code', {
            type: 'Function',
            args: args,
            callStack: getCallStack()
          });
        }
        
        // Execute with original Function (monitored)
        try {
          const result = __original_functions.Function.apply(this, args);
          logSideEffect('function_creation', 'Function', args, '<function>', false);
          return result;
        } catch (error) {
          logSideEffect('function_creation', 'Function', args, { error: error.message }, false);
          throw error;
        }
      };
    `;
  }

  /**
   * Generate timer stubs
   */
  private generateTimerStubs(): string {
    return `
      // Store original timer functions
      __original_functions.setTimeout = globalThis.setTimeout || function(){};
      __original_functions.setInterval = globalThis.setInterval || function(){};
      __original_functions.clearTimeout = globalThis.clearTimeout || function(){};
      __original_functions.clearInterval = globalThis.clearInterval || function(){};
      
      let __timer_id = 1;
      const __active_timers = new Map();
      
      globalThis.setTimeout = function(callback, delay) {
        logSideEffect('api_call', 'setTimeout', [typeof callback, delay], null, false);
        
        const timerId = __timer_id++;
        const timeoutId = __original_functions.setTimeout(() => {
          __active_timers.delete(timerId);
          try {
            if (typeof callback === 'function') {
              callback();
            } else if (typeof callback === 'string') {
              // Block string-based setTimeout (eval equivalent)
              logSideEffect('eval_call', 'setTimeout', [callback], null, true);
              throw new Error('String-based setTimeout blocked by sandbox');
            }
          } catch (error) {
            logSideEffect('api_call', 'setTimeout', [typeof callback, delay], { error: error.message }, false);
          }
        }, Math.min(delay || 0, 1000)); // Limit delay to 1 second max
        
        __active_timers.set(timerId, timeoutId);
        return timerId;
      };
      
      globalThis.setInterval = function(callback, delay) {
        logSideEffect('api_call', 'setInterval', [typeof callback, delay], null, false);
        
        if (typeof callback === 'string') {
          logSideEffect('eval_call', 'setInterval', [callback], null, true);
          throw new Error('String-based setInterval blocked by sandbox');
        }
        
        const timerId = __timer_id++;
        const intervalId = __original_functions.setInterval(() => {
          try {
            callback();
          } catch (error) {
            logSideEffect('api_call', 'setInterval', [typeof callback, delay], { error: error.message }, false);
          }
        }, Math.min(delay || 0, 100)); // Limit interval to 100ms max
        
        __active_timers.set(timerId, intervalId);
        return timerId;
      };
      
      globalThis.clearTimeout = function(id) {
        const actualId = __active_timers.get(id);
        if (actualId) {
          __original_functions.clearTimeout(actualId);
          __active_timers.delete(id);
        }
      };
      
      globalThis.clearInterval = function(id) {
        const actualId = __active_timers.get(id);
        if (actualId) {
          __original_functions.clearInterval(actualId);
          __active_timers.delete(id);
        }
      };
    `;
  }

  /**
   * Generate storage stubs
   */
  private generateStorageStubs(): string {
    return `
      // Storage stubs
      const createStorageStub = (name) => ({
        length: 0,
        key: function(index) {
          logSideEffect('api_call', name + '.key', [index], null, false);
          return null;
        },
        getItem: function(key) {
          logSideEffect('api_call', name + '.getItem', [key], null, false);
          return null;
        },
        setItem: function(key, value) {
          logSideEffect('api_call', name + '.setItem', [key, value], null, false);
          // Silently ignore - no actual storage
        },
        removeItem: function(key) {
          logSideEffect('api_call', name + '.removeItem', [key], null, false);
          // Silently ignore - no actual storage
        },
        clear: function() {
          logSideEffect('api_call', name + '.clear', [], null, false);
          // Silently ignore - no actual storage
        }
      });
      
      globalThis.localStorage = createStorageStub('localStorage');
      globalThis.sessionStorage = createStorageStub('sessionStorage');
    `;
  }

  /**
   * Generate DOM/BOM stubs
   */
  private generateDOMStubs(): string {
    return `
      // Basic document stub
      globalThis.document = {
        createElement: function(tagName) {
          logSideEffect('api_call', 'document.createElement', [tagName], null, false);
          return {
            tagName: tagName.toUpperCase(),
            innerHTML: '',
            innerText: '',
            style: {},
            appendChild: function() { logSideEffect('api_call', 'element.appendChild', arguments, null, false); },
            removeChild: function() { logSideEffect('api_call', 'element.removeChild', arguments, null, false); },
            getAttribute: function() { logSideEffect('api_call', 'element.getAttribute', arguments, null, false); return null; },
            setAttribute: function() { logSideEffect('api_call', 'element.setAttribute', arguments, null, false); },
          };
        },
        getElementById: function(id) {
          logSideEffect('api_call', 'document.getElementById', [id], null, false);
          return null;
        },
        getElementsByTagName: function(tagName) {
          logSideEffect('api_call', 'document.getElementsByTagName', [tagName], null, false);
          return [];
        },
        getElementsByClassName: function(className) {
          logSideEffect('api_call', 'document.getElementsByClassName', [className], null, false);
          return [];
        },
        querySelector: function(selector) {
          logSideEffect('api_call', 'document.querySelector', [selector], null, false);
          return null;
        },
        querySelectorAll: function(selector) {
          logSideEffect('api_call', 'document.querySelectorAll', [selector], null, false);
          return [];
        },
        addEventListener: function() {
          logSideEffect('api_call', 'document.addEventListener', arguments, null, false);
        },
        removeEventListener: function() {
          logSideEffect('api_call', 'document.removeEventListener', arguments, null, false);
        },
        body: {
          appendChild: function() { logSideEffect('api_call', 'document.body.appendChild', arguments, null, false); },
          removeChild: function() { logSideEffect('api_call', 'document.body.removeChild', arguments, null, false); },
          innerHTML: '',
          style: {}
        },
        head: {
          appendChild: function() { logSideEffect('api_call', 'document.head.appendChild', arguments, null, false); },
          removeChild: function() { logSideEffect('api_call', 'document.head.removeChild', arguments, null, false); },
        }
      };
      
      // Basic window stub
      globalThis.window = globalThis.window || {
        location: {
          href: 'about:blank',
          hostname: 'sandbox',
          pathname: '/',
          search: '',
          hash: ''
        },
        navigator: {
          userAgent: 'SandboxEnvironment/1.0',
          language: 'en-US',
          languages: ['en-US'],
          platform: 'Sandbox'
        },
        screen: {
          width: 1920,
          height: 1080,
          colorDepth: 24
        },
        innerWidth: 1920,
        innerHeight: 1080,
        alert: function(message) {
          logSideEffect('api_call', 'window.alert', [message], null, false);
        },
        confirm: function(message) {
          logSideEffect('api_call', 'window.confirm', [message], null, false);
          return false;
        },
        prompt: function(message) {
          logSideEffect('api_call', 'window.prompt', [message], null, false);
          return null;
        },
        open: function() {
          logSideEffect('api_call', 'window.open', arguments, null, true);
          throw new Error('window.open blocked by sandbox security policy');
        },
        close: function() {
          logSideEffect('api_call', 'window.close', arguments, null, true);
        },
        addEventListener: function() {
          logSideEffect('api_call', 'window.addEventListener', arguments, null, false);
        },
        removeEventListener: function() {
          logSideEffect('api_call', 'window.removeEventListener', arguments, null, false);
        }
      };
    `;
  }

  /**
   * Generate console stub
   */
  private generateConsoleStub(): string {
    return `
      // Console stub that captures all output
      const __console_output = [];
      
      globalThis.console = {
        log: function() {
          const args = Array.from(arguments);
          __console_output.push({ type: 'log', args: args, timestamp: Date.now() });
          logSideEffect('api_call', 'console.log', args, null, false);
        },
        error: function() {
          const args = Array.from(arguments);
          __console_output.push({ type: 'error', args: args, timestamp: Date.now() });
          logSideEffect('api_call', 'console.error', args, null, false);
        },
        warn: function() {
          const args = Array.from(arguments);
          __console_output.push({ type: 'warn', args: args, timestamp: Date.now() });
          logSideEffect('api_call', 'console.warn', args, null, false);
        },
        info: function() {
          const args = Array.from(arguments);
          __console_output.push({ type: 'info', args: args, timestamp: Date.now() });
          logSideEffect('api_call', 'console.info', args, null, false);
        },
        debug: function() {
          const args = Array.from(arguments);
          __console_output.push({ type: 'debug', args: args, timestamp: Date.now() });
          logSideEffect('api_call', 'console.debug', args, null, false);
        },
        trace: function() {
          const args = Array.from(arguments);
          const stack = getCallStack();
          __console_output.push({ type: 'trace', args: args, stack: stack, timestamp: Date.now() });
          logSideEffect('api_call', 'console.trace', args, null, false);
        },
        clear: function() {
          __console_output.length = 0;
          logSideEffect('api_call', 'console.clear', [], null, false);
        },
        getOutput: function() {
          return [...__console_output];
        }
      };
    `;
  }

  /**
   * Generate generic API interceptor
   */
  private generateGenericInterceptor(): string {
    return `
      // Generic property access monitor
      const monitoredGlobals = ['process', 'require', 'module', 'exports', '__dirname', '__filename'];
      
      monitoredGlobals.forEach(name => {
        Object.defineProperty(globalThis, name, {
          get: function() {
            logSideEffect('property_access', name, [], undefined, true);
            throw new Error(\`Access to \${name} blocked by sandbox security policy\`);
          },
          set: function() {
            logSideEffect('property_access', name, arguments, undefined, true);
            throw new Error(\`Modification of \${name} blocked by sandbox security policy\`);
          },
          configurable: false,
          enumerable: false
        });
      });
    `;
  }

  /**
   * Create eval stub implementation
   */
  private createEvalStub() {
    return (code: string) => {
      this.recordSideEffect({
        type: 'eval_call',
        target: 'eval',
        arguments: [code],
        blocked: false,
        timestamp: Date.now(),
        context: {
          callStack: this.getCallStack(),
        },
      });
      
      // In a real implementation, this would be handled by QuickJS
      throw new Error('eval() not available in this context');
    };
  }

  /**
   * Create Function constructor stub
   */
  private createFunctionStub() {
    return (...args: any[]) => {
      this.recordSideEffect({
        type: 'function_creation',
        target: 'Function',
        arguments: args,
        blocked: false,
        timestamp: Date.now(),
        context: {
          callStack: this.getCallStack(),
        },
      });
      
      // In a real implementation, this would be handled by QuickJS
      throw new Error('Function constructor not available in this context');
    };
  }

  /**
   * Create timer stub implementation
   */
  private createTimerStub(type: 'setTimeout' | 'setInterval') {
    return (callback: any, delay: number) => {
      this.recordSideEffect({
        type: 'api_call',
        target: type,
        arguments: [typeof callback, delay],
        blocked: false,
        timestamp: Date.now(),
        context: {
          callStack: this.getCallStack(),
        },
      });
      
      // Return a fake timer ID
      return Math.random() * 1000000 | 0;
    };
  }

  /**
   * Create storage stub implementation
   */
  private createStorageStub(name: string) {
    const stub = {
      length: 0,
      getItem: (key: string) => {
        this.recordSideEffect({
          type: 'api_call',
          target: `${name}.getItem`,
          arguments: [key],
          result: null,
          blocked: false,
          timestamp: Date.now(),
          context: { callStack: this.getCallStack() },
        });
        return null;
      },
      setItem: (key: string, value: string) => {
        this.recordSideEffect({
          type: 'api_call',
          target: `${name}.setItem`,
          arguments: [key, value],
          blocked: false,
          timestamp: Date.now(),
          context: { callStack: this.getCallStack() },
        });
      },
      removeItem: (key: string) => {
        this.recordSideEffect({
          type: 'api_call',
          target: `${name}.removeItem`,
          arguments: [key],
          blocked: false,
          timestamp: Date.now(),
          context: { callStack: this.getCallStack() },
        });
      },
      clear: () => {
        this.recordSideEffect({
          type: 'api_call',
          target: `${name}.clear`,
          arguments: [],
          blocked: false,
          timestamp: Date.now(),
          context: { callStack: this.getCallStack() },
        });
      },
      key: (index: number) => {
        this.recordSideEffect({
          type: 'api_call',
          target: `${name}.key`,
          arguments: [index],
          result: null,
          blocked: false,
          timestamp: Date.now(),
          context: { callStack: this.getCallStack() },
        });
        return null;
      },
    };
    
    return stub;
  }

  /**
   * Create document stub implementation
   */
  private createDocumentStub() {
    return {
      createElement: (tagName: string) => ({
        tagName: tagName.toUpperCase(),
        innerHTML: '',
        innerText: '',
        style: {},
      }),
      getElementById: () => null,
      getElementsByTagName: () => [],
      querySelector: () => null,
      querySelectorAll: () => [],
      body: { appendChild: () => {}, innerHTML: '', style: {} },
      head: { appendChild: () => {} },
    };
  }

  /**
   * Create window stub implementation
   */
  private createWindowStub() {
    return {
      location: { href: 'about:blank', hostname: 'sandbox' },
      navigator: { userAgent: 'SandboxEnvironment/1.0' },
      alert: () => {},
      confirm: () => false,
      prompt: () => null,
    };
  }

  /**
   * Create console stub implementation
   */
  private createConsoleStub() {
    const output: any[] = [];
    
    return {
      log: (...args: any[]) => {
        output.push({ type: 'log', args, timestamp: Date.now() });
        this.recordSideEffect({
          type: 'api_call',
          target: 'console.log',
          arguments: args,
          blocked: false,
          timestamp: Date.now(),
          context: { callStack: this.getCallStack() },
        });
      },
      error: (...args: any[]) => {
        output.push({ type: 'error', args, timestamp: Date.now() });
      },
      warn: (...args: any[]) => {
        output.push({ type: 'warn', args, timestamp: Date.now() });
      },
      info: (...args: any[]) => {
        output.push({ type: 'info', args, timestamp: Date.now() });
      },
      getOutput: () => [...output],
    };
  }

  /**
   * Record a side effect
   */
  private recordSideEffect(sideEffect: SideEffect): void {
    this.sideEffects.push(sideEffect);
    
    // Increment call count
    const count = this.callCounts.get(sideEffect.target) || 0;
    this.callCounts.set(sideEffect.target, count + 1);
    
    // Check for violations based on patterns
    this.checkForViolations(sideEffect);
  }

  /**
   * Check for security violations
   */
  private checkForViolations(sideEffect: SideEffect): void {
    // Check blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(sideEffect.target)) {
        this.violations.push({
          type: 'api_access',
          message: `Blocked API access: ${sideEffect.target}`,
          severity: 'high',
          timestamp: sideEffect.timestamp,
          context: {
            callStack: sideEffect.context.callStack,
            metadata: { sideEffect },
          },
        });
        return;
      }
    }
    
    // Check for suspicious patterns
    const callCount = this.callCounts.get(sideEffect.target) || 0;
    if (callCount > 100) {
      this.violations.push({
        type: 'api_access',
        message: `Excessive API calls: ${sideEffect.target} called ${callCount} times`,
        severity: 'medium',
        timestamp: sideEffect.timestamp,
      });
    }
  }

  /**
   * Get call stack (simplified for stub environment)
   */
  private getCallStack(): string[] {
    try {
      throw new Error();
    } catch (e: any) {
      return e.stack ? e.stack.split('\n').slice(2, 10) : ['<unknown>'];
    }
  }

  /**
   * Get recorded side effects
   */
  getSideEffects(): SideEffect[] {
    return [...this.sideEffects];
  }

  /**
   * Get security violations
   */
  getViolations(): SecurityViolation[] {
    return [...this.violations];
  }

  /**
   * Get API call statistics
   */
  getCallStatistics(): Map<string, number> {
    return new Map(this.callCounts);
  }

  /**
   * Reset all recorded data
   */
  reset(): void {
    this.sideEffects = [];
    this.violations = [];
    this.callCounts.clear();
  }
}
