/**
 * @fileoverview Type definitions for the secure sandbox system
 * 
 * Comprehensive type definitions for sandbox policies, execution results,
 * security violations, and resource management.
 */

import type { NodeId, ScopeId, ShapeId } from '../ir/nodes.js';

/**
 * Sandbox execution policy configuration
 */
export interface SandboxPolicy {
  /** Maximum memory allocation in MB */
  maxMemoryMB: number;
  
  /** Maximum execution time in milliseconds */
  maxExecutionTimeMS: number;
  
  /** Maximum call stack depth */
  maxCallDepth: number;
  
  /** List of allowed API names (allowlist approach) */
  allowedAPIs: string[];
  
  /** Regex patterns for blocked API access */
  blockedPatterns: RegExp[];
  
  /** Enable detailed execution tracing */
  enableTracing: boolean;
  
  /** Maximum loop iterations before timeout */
  maxLoopIterations?: number;
  
  /** Enable network access (should always be false for security) */
  allowNetworkAccess?: boolean;
  
  /** Enable file system access (should be very restricted) */
  allowFileSystemAccess?: boolean;
  
  /** List of allowed file paths for read access */
  allowedFilePaths?: string[];
  
  /** Enable process spawning (should always be false) */
  allowProcessSpawning?: boolean;
  
  /** Custom security rules */
  customSecurityRules?: SecurityRule[];
}

/**
 * Custom security rule definition
 */
export interface SecurityRule {
  /** Rule identifier */
  id: string;
  
  /** Human-readable description */
  description: string;
  
  /** Pattern to match against */
  pattern: RegExp | string;
  
  /** Action to take when rule is triggered */
  action: 'block' | 'warn' | 'log';
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Security violation record
 */
export interface SecurityViolation {
  /** Type of violation */
  type: 'timeout' | 'memory_limit' | 'api_access' | 'file_access' | 'network_access' | 
        'prototype_pollution' | 'code_injection' | 'infinite_loop' | 'stack_overflow' |
        'initialization_failure' | 'custom_rule' | 'eval_usage' | 'function_constructor';
  
  /** Detailed violation message */
  message: string;
  
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Timestamp when violation occurred */
  timestamp: number;
  
  /** Optional context information */
  context?: {
    /** Source code location if available */
    location?: {
      line?: number;
      column?: number;
      source?: string;
    };
    
    /** Call stack at time of violation */
    callStack?: string[];
    
    /** Additional metadata */
    metadata?: Record<string, any>;
  };
  
  /** Associated IR correlation if available */
  irCorrelation?: {
    nodeId?: NodeId;
    scopeId?: ScopeId;
    shapeId?: ShapeId;
  };
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** Current heap usage in MB */
  heapUsageMB: number;
  
  /** Maximum allowed heap usage in MB */
  maxHeapUsageMB: number;
  
  /** Number of garbage collections triggered */
  gcCount: number;
  
  /** Peak memory usage during execution */
  peakUsageMB?: number;
  
  /** Memory allocation breakdown */
  breakdown?: {
    objects: number;
    strings: number;
    arrays: number;
    functions: number;
    other: number;
  };
}

/**
 * Side effect record for API interactions
 */
export interface SideEffect {
  /** Type of side effect */
  type: 'api_call' | 'property_access' | 'global_write' | 'eval_call' | 
        'function_creation' | 'network_attempt' | 'file_attempt' | 'process_attempt';
  
  /** API or operation that was called */
  target: string;
  
  /** Arguments passed to the operation */
  arguments: any[];
  
  /** Result of the operation (if allowed) */
  result?: any;
  
  /** Whether the operation was blocked */
  blocked: boolean;
  
  /** Timestamp of the side effect */
  timestamp: number;
  
  /** Execution context */
  context: {
    /** Call stack at time of effect */
    callStack: string[];
    
    /** IR correlation if available */
    irCorrelation?: {
      nodeId?: NodeId;
      scopeId?: ScopeId;
      shapeId?: ShapeId;
    };
  };
}

/**
 * Execution trace entry
 */
export interface TraceEntry {
  /** Type of trace entry */
  type: 'function_call' | 'variable_access' | 'constant_decode' | 
        'control_flow' | 'string_operation' | 'array_operation' | 'object_operation';
  
  /** Detailed information about the trace */
  data: {
    /** Operation name or identifier */
    operation: string;
    
    /** Input values */
    inputs?: any[];
    
    /** Output values */
    outputs?: any[];
    
    /** Source location if available */
    location?: {
      line: number;
      column: number;
      source?: string;
    };
    
    /** IR correlation */
    irCorrelation?: {
      nodeId?: NodeId;
      scopeId?: ScopeId;
      shapeId?: ShapeId;
    };
    
    /** Execution timing */
    timing?: {
      startTime: number;
      duration: number;
    };
  };
  
  /** Timestamp when trace was recorded */
  timestamp: number;
  
  /** Execution depth level */
  depth: number;
}

/**
 * Complete execution trace
 */
export interface ExecutionTrace {
  /** All trace entries in chronological order */
  entries: TraceEntry[];
  
  /** Constants discovered during execution */
  constants: Map<string, any>;
  
  /** Decoded strings found during execution */
  decodedStrings: string[];
  
  /** Side effects recorded during execution */
  sideEffects: SideEffect[];
  
  /** Memory usage throughout execution */
  memoryUsage: MemoryStats;
  
  /** Execution statistics */
  stats: {
    /** Total function calls */
    totalFunctionCalls: number;
    
    /** Total variable accesses */
    totalVariableAccesses: number;
    
    /** Total string operations */
    totalStringOperations: number;
    
    /** Unique functions called */
    uniqueFunctionsCalled: number;
    
    /** Deepest call stack level */
    maxCallDepth: number;
  };
}

/**
 * Resource usage limits
 */
export interface ResourceLimits {
  /** Memory limit in MB */
  maxMemoryMB: number;
  
  /** Execution time limit in milliseconds */
  maxExecutionTimeMs: number;
  
  /** Maximum call stack depth */
  maxCallDepth: number;
  
  /** Maximum loop iterations */
  maxLoopIterations: number;
  
  /** Maximum number of objects that can be created */
  maxObjectCount?: number;
  
  /** Maximum string length allowed */
  maxStringLength?: number;
  
  /** Maximum array length allowed */
  maxArrayLength?: number;
}

/**
 * Sandbox execution result
 */
export interface SandboxResult {
  /** Whether execution completed successfully */
  success: boolean;
  
  /** Return value from execution (if successful) */
  value?: any;
  
  /** Error message (if unsuccessful) */
  error?: string;
  
  /** Total execution time in milliseconds */
  executionTimeMs: number;
  
  /** Memory usage statistics */
  memoryStats: MemoryStats;
  
  /** Execution trace (if tracing enabled) */
  trace: ExecutionTrace;
  
  /** Security violations detected */
  securityViolations: SecurityViolation[];
  
  /** Side effects recorded */
  sideEffects: SideEffect[];
  
  /** Additional metadata */
  metadata?: {
    /** IR correlation information */
    irCorrelation?: {
      nodeId?: NodeId;
      scopeId?: ScopeId;
      shapeId?: ShapeId;
    };
    
    /** Source code information */
    source?: {
      filename?: string;
      content?: string;
      sourceMap?: string;
    };
    
    /** Performance metrics */
    performance?: {
      compilationTime: number;
      interpretationTime: number;
      gcTime: number;
    };
  };
}

/**
 * Sandbox health status
 */
export interface SandboxHealth {
  /** Whether sandbox is operational */
  healthy: boolean;
  
  /** Health check timestamp */
  timestamp: number;
  
  /** Current resource usage */
  resourceUsage: {
    memoryUsage: MemoryStats;
    executionTime: number;
    activeContexts: number;
  };
  
  /** Recent security violations */
  recentViolations: SecurityViolation[];
  
  /** Performance metrics */
  performance: {
    averageExecutionTime: number;
    successRate: number;
    memoryLeakDetected: boolean;
  };
}

/**
 * Configuration for different sandbox modes
 */
export interface SandboxMode {
  /** Mode identifier */
  name: 'strict' | 'permissive' | 'development' | 'production' | 'research';
  
  /** Description of the mode */
  description: string;
  
  /** Default policy for this mode */
  defaultPolicy: SandboxPolicy;
  
  /** Additional restrictions */
  restrictions: {
    /** Disable dangerous operations */
    disableDangerousOps: boolean;
    
    /** Enable additional monitoring */
    enhancedMonitoring: boolean;
    
    /** Log all operations */
    verboseLogging: boolean;
  };
}

/**
 * Predefined sandbox modes for common use cases
 */
export const SANDBOX_MODES: Record<string, SandboxMode> = {
  production: {
    name: 'production',
    description: 'Maximum security for production malware analysis',
    defaultPolicy: {
      maxMemoryMB: 64,
      maxExecutionTimeMS: 2000,
      maxCallDepth: 50,
      allowedAPIs: [], // No APIs allowed
      blockedPatterns: [/.*/], // Block everything
      enableTracing: true,
      maxLoopIterations: 10000,
      allowNetworkAccess: false,
      allowFileSystemAccess: false,
      allowProcessSpawning: false,
    },
    restrictions: {
      disableDangerousOps: true,
      enhancedMonitoring: true,
      verboseLogging: false,
    },
  },
  
  research: {
    name: 'research',
    description: 'Balanced security for research and analysis',
    defaultPolicy: {
      maxMemoryMB: 128,
      maxExecutionTimeMS: 5000,
      maxCallDepth: 100,
      allowedAPIs: ['console.log', 'JSON.stringify', 'JSON.parse'],
      blockedPatterns: [/^(eval|Function|XMLHttpRequest|fetch|WebSocket)$/],
      enableTracing: true,
      maxLoopIterations: 50000,
      allowNetworkAccess: false,
      allowFileSystemAccess: false,
      allowProcessSpawning: false,
    },
    restrictions: {
      disableDangerousOps: true,
      enhancedMonitoring: true,
      verboseLogging: true,
    },
  },
  
  development: {
    name: 'development',
    description: 'Relaxed security for development and testing',
    defaultPolicy: {
      maxMemoryMB: 256,
      maxExecutionTimeMS: 10000,
      maxCallDepth: 200,
      allowedAPIs: ['console.*', 'JSON.*', 'Math.*', 'Date.*'],
      blockedPatterns: [/^(XMLHttpRequest|fetch|WebSocket|eval)$/],
      enableTracing: true,
      maxLoopIterations: 100000,
      allowNetworkAccess: false,
      allowFileSystemAccess: false,
      allowProcessSpawning: false,
    },
    restrictions: {
      disableDangerousOps: false,
      enhancedMonitoring: false,
      verboseLogging: true,
    },
  },
};
