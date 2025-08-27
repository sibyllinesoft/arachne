/**
 * @fileoverview Dynamic code interception and monitoring system
 * 
 * This module provides comprehensive interception of dynamic code generation
 * including eval(), Function constructor, and indirect eval patterns.
 * Designed to capture and analyze all dynamic code execution attempts.
 */

import type { NodeId, ScopeId, ShapeId } from '../ir/nodes.js';
import type { SideEffect, SecurityViolation, TraceEntry } from './types.js';

/**
 * Dynamic code information
 */
interface DynamicCodeInfo {
  /** Type of dynamic code generation */
  type: 'eval' | 'function_constructor' | 'indirect_eval' | 'timeout_string' | 'interval_string';
  
  /** Source code being executed */
  code: string;
  
  /** Arguments provided (for Function constructor) */
  arguments?: string[];
  
  /** Call site information */
  callSite: {
    file?: string;
    line?: number;
    column?: number;
    function?: string;
  };
  
  /** Call stack at time of interception */
  callStack: string[];
  
  /** Timestamp of interception */
  timestamp: number;
  
  /** IR correlation if available */
  irCorrelation?: {
    nodeId?: NodeId;
    scopeId?: ScopeId;
    shapeId?: ShapeId;
  };
}

/**
 * Code analysis result
 */
interface CodeAnalysis {
  /** Estimated risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  /** Detected patterns */
  patterns: string[];
  
  /** Suspicious indicators */
  indicators: {
    hasObfuscation: boolean;
    hasEncoding: boolean;
    hasEvasion: boolean;
    hasNetworkAccess: boolean;
    hasFileAccess: boolean;
    hasCodeInjection: boolean;
  };
  
  /** Confidence in analysis (0-1) */
  confidence: number;
  
  /** Recommended action */
  action: 'allow' | 'warn' | 'block';
}

/**
 * Escape attempt detection
 */
interface EscapeAttempt {
  /** Type of escape attempt */
  type: 'constructor_manipulation' | 'prototype_pollution' | 'context_escape' | 'closure_escape';
  
  /** Description of the attempt */
  description: string;
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Whether the attempt was blocked */
  blocked: boolean;
  
  /** Evidence of the attempt */
  evidence: string;
}

/**
 * Dynamic code interceptor with comprehensive monitoring
 */
export class DynamicCodeInterceptor {
  private interceptedCode: DynamicCodeInfo[] = [];
  private violations: SecurityViolation[] = [];
  private escapeAttempts: EscapeAttempt[] = [];
  private codeAnalyses: Map<string, CodeAnalysis> = new Map();
  private enabled = true;
  private allowExecution = false; // Default to blocking execution
  private maxCodeLength = 50000; // Prevent memory exhaustion
  private maxInterceptions = 1000; // Prevent DoS

  constructor(
    private options: {
      allowExecution?: boolean;
      maxCodeLength?: number;
      maxInterceptions?: number;
      enableAnalysis?: boolean;
    } = {}
  ) {
    this.allowExecution = options.allowExecution ?? false;
    this.maxCodeLength = options.maxCodeLength ?? 50000;
    this.maxInterceptions = options.maxInterceptions ?? 1000;
  }

  /**
   * Generate interception code for injection into sandbox
   */
  generateInterceptionCode(): string {
    return `
      (function() {
        'use strict';
        
        // Store original functions to prevent tampering
        const __original = {
          eval: globalThis.eval,
          Function: globalThis.Function,
          setTimeout: globalThis.setTimeout,
          setInterval: globalThis.setInterval,
          Object_defineProperty: Object.defineProperty,
          Object_getPrototypeOf: Object.getPrototypeOf,
          Object_setPrototypeOf: Object.setPrototypeOf
        };
        
        // Statistics tracking
        let __interception_count = 0;
        const __intercepted_calls = [];
        
        // Helper to get call stack
        function __getCallStack() {
          try {
            throw new Error();
          } catch (e) {
            return e.stack ? e.stack.split('\\n').slice(3, 15) : ['<unknown>'];
          }
        }
        
        // Helper to analyze code for threats
        function __analyzeCode(code) {
          const analysis = {
            riskLevel: 'low',
            patterns: [],
            indicators: {
              hasObfuscation: false,
              hasEncoding: false,
              hasEvasion: false,
              hasNetworkAccess: false,
              hasFileAccess: false,
              hasCodeInjection: false
            },
            confidence: 0.5,
            action: 'allow'
          };
          
          // Check for obfuscation patterns
          if (code.match(/\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\\\[0-7]{3}/)) {
            analysis.patterns.push('hex_unicode_encoding');
            analysis.indicators.hasEncoding = true;
            analysis.riskLevel = 'medium';
          }
          
          if (code.match(/[a-zA-Z_$][a-zA-Z0-9_$]*\\['\\d+'\\]/)) {
            analysis.patterns.push('array_bracket_notation');
            analysis.indicators.hasObfuscation = true;
          }
          
          // Check for evasion techniques
          if (code.match(/(constructor|prototype|__proto__|valueOf|toString)\\s*\\[|\\.\\.*(constructor|prototype)/)) {
            analysis.patterns.push('constructor_manipulation');
            analysis.indicators.hasEvasion = true;
            analysis.riskLevel = 'high';
          }
          
          // Check for network access attempts
          if (code.match(/(XMLHttpRequest|fetch|WebSocket|EventSource|navigator\\.sendBeacon)/)) {
            analysis.patterns.push('network_access');
            analysis.indicators.hasNetworkAccess = true;
            analysis.riskLevel = 'critical';
          }
          
          // Check for file access attempts
          if (code.match(/(require|import|fs|readFile|writeFile|__dirname|__filename)/)) {
            analysis.patterns.push('file_access');
            analysis.indicators.hasFileAccess = true;
            analysis.riskLevel = 'critical';
          }
          
          // Check for nested dynamic code generation
          if (code.match(/(eval|Function|setTimeout|setInterval)\\s*\\(/)) {
            analysis.patterns.push('nested_dynamic_code');
            analysis.indicators.hasCodeInjection = true;
            analysis.riskLevel = 'high';
          }
          
          // Check for common exploit patterns
          if (code.match(/(document\\.cookie|location\\.href|window\\.open|alert\\s*\\()/)) {
            analysis.patterns.push('browser_exploit');
            analysis.riskLevel = 'high';
          }
          
          // Adjust action based on risk level
          if (analysis.riskLevel === 'critical') {
            analysis.action = 'block';
            analysis.confidence = 0.9;
          } else if (analysis.riskLevel === 'high') {
            analysis.action = 'warn';
            analysis.confidence = 0.8;
          }
          
          return analysis;
        }
        
        // Helper to record interception
        function __recordInterception(type, code, args, callStack, analysis) {
          __interception_count++;
          
          const record = {
            type: type,
            code: code,
            arguments: args || [],
            callStack: callStack,
            timestamp: Date.now(),
            analysis: analysis,
            count: __interception_count
          };
          
          __intercepted_calls.push(record);
          
          // Report to sandbox tracer
          if (typeof __sandbox_trace === 'function') {
            __sandbox_trace('dynamic_code_intercept', record);
          }
          
          // Check for DoS protection
          if (__interception_count > ${this.maxInterceptions}) {
            throw new Error('Maximum dynamic code interceptions exceeded - possible DoS attack');
          }
          
          return record;
        }
        
        // Eval interception
        globalThis.eval = function(code) {
          const callStack = __getCallStack();
          
          // Validate input
          if (typeof code !== 'string') {
            __recordInterception('eval', String(code), [], callStack, { riskLevel: 'low', action: 'allow' });
            return __original.eval.call(this, code);
          }
          
          // Check code length
          if (code.length > ${this.maxCodeLength}) {
            const error = new Error('Code length exceeds maximum allowed size');
            __recordInterception('eval', code.substring(0, 200) + '...', [], callStack, { riskLevel: 'critical', action: 'block' });
            throw error;
          }
          
          // Analyze the code
          const analysis = __analyzeCode(code);
          const record = __recordInterception('eval', code, [], callStack, analysis);
          
          // Decision based on analysis
          if (analysis.action === 'block') {
            throw new Error(\`eval() blocked: \${analysis.patterns.join(', ')}\`);
          }
          
          if (!${this.allowExecution}) {
            throw new Error('eval() execution disabled in sandbox for security');
          }
          
          // Execute with monitoring
          try {
            const result = __original.eval.call(this, code);
            record.result = typeof result;
            return result;
          } catch (error) {
            record.error = error.message;
            throw error;
          }
        };
        
        // Function constructor interception
        globalThis.Function = function() {
          const args = Array.from(arguments);
          const callStack = __getCallStack();
          
          // Extract code from arguments
          const code = args.length > 0 ? args[args.length - 1] : '';
          const parameters = args.slice(0, -1);
          
          // Check code length
          if (code.length > ${this.maxCodeLength}) {
            const error = new Error('Function code length exceeds maximum allowed size');
            __recordInterception('function_constructor', code.substring(0, 200) + '...', parameters, callStack, { riskLevel: 'critical', action: 'block' });
            throw error;
          }
          
          // Analyze the code
          const analysis = __analyzeCode(code);
          const record = __recordInterception('function_constructor', code, parameters, callStack, analysis);
          
          // Decision based on analysis
          if (analysis.action === 'block') {
            throw new Error(\`Function() blocked: \${analysis.patterns.join(', ')}\`);
          }
          
          if (!${this.allowExecution}) {
            throw new Error('Function constructor execution disabled in sandbox for security');
          }
          
          // Execute with monitoring
          try {
            const result = __original.Function.apply(this, args);
            record.result = 'function';
            return result;
          } catch (error) {
            record.error = error.message;
            throw error;
          }
        };
        
        // setTimeout interception (for string-based code execution)
        globalThis.setTimeout = function(callback, delay) {
          const callStack = __getCallStack();
          
          // Check for string-based code execution
          if (typeof callback === 'string') {
            const analysis = __analyzeCode(callback);
            const record = __recordInterception('timeout_string', callback, [delay], callStack, analysis);
            
            if (analysis.action === 'block' || !${this.allowExecution}) {
              throw new Error('String-based setTimeout blocked for security');
            }
            
            // Convert to eval for consistent monitoring
            return __original.setTimeout(() => {
              try {
                __original.eval(callback);
              } catch (error) {
                record.error = error.message;
              }
            }, delay);
          }
          
          // Normal function callback - pass through
          return __original.setTimeout.call(this, callback, delay);
        };
        
        // setInterval interception (for string-based code execution)
        globalThis.setInterval = function(callback, delay) {
          const callStack = __getCallStack();
          
          // Check for string-based code execution
          if (typeof callback === 'string') {
            const analysis = __analyzeCode(callback);
            const record = __recordInterception('interval_string', callback, [delay], callStack, analysis);
            
            if (analysis.action === 'block' || !${this.allowExecution}) {
              throw new Error('String-based setInterval blocked for security');
            }
            
            // Convert to eval for consistent monitoring
            return __original.setInterval(() => {
              try {
                __original.eval(callback);
              } catch (error) {
                record.error = error.message;
              }
            }, delay);
          }
          
          // Normal function callback - pass through
          return __original.setInterval.call(this, callback, delay);
        };
        
        // Protect against constructor manipulation
        const __protectConstructor = (obj, name) => {
          try {
            const constructor = obj.constructor;
            Object.defineProperty(obj, 'constructor', {
              get: function() {
                if (typeof __sandbox_trace === 'function') {
                  __sandbox_trace('escape_attempt', {
                    type: 'constructor_access',
                    target: name,
                    callStack: __getCallStack()
                  });
                }
                return constructor;
              },
              set: function(value) {
                if (typeof __sandbox_trace === 'function') {
                  __sandbox_trace('escape_attempt', {
                    type: 'constructor_modification',
                    target: name,
                    callStack: __getCallStack()
                  });
                }
                throw new Error(\`Modification of \${name}.constructor blocked for security\`);
              },
              configurable: false
            });
          } catch (e) {
            // Ignore if already protected
          }
        };
        
        // Protect critical objects
        __protectConstructor(Object.prototype, 'Object.prototype');
        __protectConstructor(Array.prototype, 'Array.prototype');
        __protectConstructor(Function.prototype, 'Function.prototype');
        __protectConstructor(String.prototype, 'String.prototype');
        __protectConstructor(Number.prototype, 'Number.prototype');
        __protectConstructor(Boolean.prototype, 'Boolean.prototype');
        
        // Monitor prototype chain manipulation
        Object.setPrototypeOf = function(obj, prototype) {
          if (typeof __sandbox_trace === 'function') {
            __sandbox_trace('escape_attempt', {
              type: 'prototype_manipulation',
              callStack: __getCallStack()
            });
          }
          throw new Error('Prototype manipulation blocked for security');
        };
        
        // Monitor property descriptor manipulation
        Object.defineProperty = function(obj, prop, descriptor) {
          // Allow normal property definitions but monitor critical ones
          const criticalProps = ['constructor', '__proto__', 'prototype', 'valueOf', 'toString'];
          
          if (criticalProps.includes(prop)) {
            if (typeof __sandbox_trace === 'function') {
              __sandbox_trace('escape_attempt', {
                type: 'critical_property_modification',
                property: prop,
                callStack: __getCallStack()
              });
            }
            throw new Error(\`Modification of critical property '\${prop}' blocked for security\`);
          }
          
          return __original.Object_defineProperty.call(this, obj, prop, descriptor);
        };
        
        // Expose interception data for analysis
        globalThis.__getInterceptionData = function() {
          return {
            count: __interception_count,
            calls: __intercepted_calls.slice(), // Copy to prevent tampering
            enabled: true
          };
        };
        
        // Initialize protection
        if (typeof __sandbox_trace === 'function') {
          __sandbox_trace('interception_initialized', {
            timestamp: Date.now(),
            allowExecution: ${this.allowExecution},
            maxCodeLength: ${this.maxCodeLength},
            maxInterceptions: ${this.maxInterceptions}
          });
        }
        
      })();
    `;
  }

  /**
   * Process intercepted code from sandbox
   */
  processInterception(
    type: 'eval' | 'function_constructor' | 'timeout_string' | 'interval_string',
    code: string,
    args: any[] = [],
    callStack: string[] = [],
    analysis?: CodeAnalysis
  ): void {
    if (!this.enabled) return;
    
    const info: DynamicCodeInfo = {
      type,
      code,
      arguments: args,
      callSite: this.parseCallSite(callStack[0] || ''),
      callStack,
      timestamp: Date.now(),
    };
    
    this.interceptedCode.push(info);
    
    // Perform analysis if not provided
    if (!analysis) {
      analysis = this.analyzeCode(code);
    }
    
    this.codeAnalyses.set(this.getCodeKey(info), analysis);
    
    // Check for violations
    if (analysis.action === 'block') {
      this.violations.push({
        type: 'code_injection',
        message: `Blocked dynamic code execution: ${analysis.patterns.join(', ')}`,
        severity: analysis.riskLevel as 'low' | 'medium' | 'high' | 'critical',
        timestamp: info.timestamp,
        context: {
          callStack: info.callStack,
          metadata: { code: code.substring(0, 200), analysis },
        },
      });
    }
    
    // Detect escape attempts
    this.detectEscapeAttempts(info, analysis);
  }

  /**
   * Analyze code for security threats
   */
  analyzeCode(code: string): CodeAnalysis {
    const analysis: CodeAnalysis = {
      riskLevel: 'low',
      patterns: [],
      indicators: {
        hasObfuscation: false,
        hasEncoding: false,
        hasEvasion: false,
        hasNetworkAccess: false,
        hasFileAccess: false,
        hasCodeInjection: false,
      },
      confidence: 0.5,
      action: 'allow',
    };
    
    // Pattern detection with scoring
    let riskScore = 0;
    
    // Encoding patterns (hex, unicode, base64)
    if (/\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\[0-7]{3}/.test(code)) {
      analysis.patterns.push('hex_unicode_encoding');
      analysis.indicators.hasEncoding = true;
      riskScore += 20;
    }
    
    if (/(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/.test(code) && code.length > 20) {
      analysis.patterns.push('base64_encoding');
      analysis.indicators.hasEncoding = true;
      riskScore += 15;
    }
    
    // Obfuscation patterns
    if (/[a-zA-Z_$][a-zA-Z0-9_$]*\['\d+'\]/.test(code)) {
      analysis.patterns.push('array_bracket_notation');
      analysis.indicators.hasObfuscation = true;
      riskScore += 10;
    }
    
    if (/(\w+)\[\1\['\w+'\]\]/.test(code)) {
      analysis.patterns.push('self_referential_obfuscation');
      analysis.indicators.hasObfuscation = true;
      riskScore += 25;
    }
    
    // Evasion techniques
    if (/(constructor|prototype|__proto__|valueOf|toString)\s*\[|\.\.*(constructor|prototype)/.test(code)) {
      analysis.patterns.push('constructor_manipulation');
      analysis.indicators.hasEvasion = true;
      riskScore += 30;
    }
    
    if (/Function\(.*\)\(\)|\.call\(/.test(code)) {
      analysis.patterns.push('function_call_evasion');
      analysis.indicators.hasEvasion = true;
      riskScore += 20;
    }
    
    // Network access attempts
    if (/(XMLHttpRequest|fetch|WebSocket|EventSource|navigator\.sendBeacon)/.test(code)) {
      analysis.patterns.push('network_access');
      analysis.indicators.hasNetworkAccess = true;
      riskScore += 40;
    }
    
    // File system access
    if (/(require|import|fs|readFile|writeFile|__dirname|__filename)/.test(code)) {
      analysis.patterns.push('file_access');
      analysis.indicators.hasFileAccess = true;
      riskScore += 40;
    }
    
    // Code injection patterns
    if (/(eval|Function|setTimeout|setInterval)\s*\(/.test(code)) {
      analysis.patterns.push('nested_dynamic_code');
      analysis.indicators.hasCodeInjection = true;
      riskScore += 25;
    }
    
    // Browser-specific exploitation
    if (/(document\.cookie|location\.href|window\.open|alert\s*\()/.test(code)) {
      analysis.patterns.push('browser_exploit');
      riskScore += 30;
    }
    
    // Calculate risk level based on score
    if (riskScore >= 40) {
      analysis.riskLevel = 'critical';
      analysis.action = 'block';
      analysis.confidence = 0.9;
    } else if (riskScore >= 25) {
      analysis.riskLevel = 'high';
      analysis.action = 'warn';
      analysis.confidence = 0.8;
    } else if (riskScore >= 15) {
      analysis.riskLevel = 'medium';
      analysis.action = 'warn';
      analysis.confidence = 0.7;
    } else {
      analysis.riskLevel = 'low';
      analysis.action = 'allow';
      analysis.confidence = 0.6;
    }
    
    return analysis;
  }

  /**
   * Detect sandbox escape attempts
   */
  private detectEscapeAttempts(info: DynamicCodeInfo, analysis: CodeAnalysis): void {
    const code = info.code;
    
    // Constructor manipulation attempts
    if (/constructor.*constructor|\[.*constructor.*\]/.test(code)) {
      this.escapeAttempts.push({
        type: 'constructor_manipulation',
        description: 'Attempt to manipulate constructor chain',
        severity: 'critical',
        blocked: true,
        evidence: code.substring(0, 200),
      });
    }
    
    // Prototype pollution attempts
    if (/__proto__|Object\.prototype|Array\.prototype/.test(code)) {
      this.escapeAttempts.push({
        type: 'prototype_pollution',
        description: 'Attempt to pollute prototype chain',
        severity: 'high',
        blocked: true,
        evidence: code.substring(0, 200),
      });
    }
    
    // Context escape attempts
    if (/(this|globalThis|window|self|global).*constructor/.test(code)) {
      this.escapeAttempts.push({
        type: 'context_escape',
        description: 'Attempt to escape execution context',
        severity: 'high',
        blocked: true,
        evidence: code.substring(0, 200),
      });
    }
    
    // Closure escape attempts
    if (/arguments\.callee|caller|callee/.test(code)) {
      this.escapeAttempts.push({
        type: 'closure_escape',
        description: 'Attempt to escape closure boundaries',
        severity: 'medium',
        blocked: true,
        evidence: code.substring(0, 200),
      });
    }
  }

  /**
   * Parse call site information from stack trace
   */
  private parseCallSite(stackLine: string): DynamicCodeInfo['callSite'] {
    // Simple regex to extract file:line:column from stack trace
    const match = stackLine.match(/(\S+):(\d+):(\d+)/);
    
    return {
      file: match?.[1],
      line: match ? parseInt(match[2], 10) : undefined,
      column: match ? parseInt(match[3], 10) : undefined,
      function: stackLine.split(' ')[0] || undefined,
    };
  }

  /**
   * Generate unique key for code identification
   */
  private getCodeKey(info: DynamicCodeInfo): string {
    const hash = this.simpleHash(info.code);
    return `${info.type}_${hash}_${info.timestamp}`;
  }

  /**
   * Simple hash function for code deduplication
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get all intercepted dynamic code
   */
  getInterceptedCode(): DynamicCodeInfo[] {
    return [...this.interceptedCode];
  }

  /**
   * Get security violations
   */
  getViolations(): SecurityViolation[] {
    return [...this.violations];
  }

  /**
   * Get escape attempts
   */
  getEscapeAttempts(): EscapeAttempt[] {
    return [...this.escapeAttempts];
  }

  /**
   * Get code analyses
   */
  getCodeAnalyses(): Map<string, CodeAnalysis> {
    return new Map(this.codeAnalyses);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalInterceptions: number;
    byType: Record<string, number>;
    riskDistribution: Record<string, number>;
    escapeAttempts: number;
    violations: number;
  } {
    const byType: Record<string, number> = {};
    const riskDistribution: Record<string, number> = {};
    
    this.interceptedCode.forEach(info => {
      byType[info.type] = (byType[info.type] || 0) + 1;
    });
    
    this.codeAnalyses.forEach(analysis => {
      riskDistribution[analysis.riskLevel] = (riskDistribution[analysis.riskLevel] || 0) + 1;
    });
    
    return {
      totalInterceptions: this.interceptedCode.length,
      byType,
      riskDistribution,
      escapeAttempts: this.escapeAttempts.length,
      violations: this.violations.length,
    };
  }

  /**
   * Reset interceptor state
   */
  reset(): void {
    this.interceptedCode = [];
    this.violations = [];
    this.escapeAttempts = [];
    this.codeAnalyses.clear();
  }

  /**
   * Enable/disable interception
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Configure execution allowance
   */
  setAllowExecution(allow: boolean): void {
    this.allowExecution = allow;
  }
}
