/**
 * @fileoverview Resource management and limits enforcement for sandbox execution
 * 
 * This module implements strict resource quotas and monitoring to prevent
 * resource exhaustion attacks and ensure predictable execution behavior.
 */

import type { ResourceLimits, MemoryStats, SecurityViolation } from './types.js';

/**
 * Resource usage tracking
 */
interface ResourceUsage {
  memoryUsageMB: number;
  executionTimeMs: number;
  callDepth: number;
  loopIterations: number;
  objectCount: number;
  stringAllocations: number;
  arrayAllocations: number;
}

/**
 * Resource monitoring events
 */
type ResourceEvent = 
  | { type: 'memory_allocated'; amount: number; total: number }
  | { type: 'memory_freed'; amount: number; total: number }
  | { type: 'call_enter'; depth: number; function: string }
  | { type: 'call_exit'; depth: number; function: string }
  | { type: 'loop_iteration'; count: number; location?: string }
  | { type: 'object_created'; objectType: string; size: number }
  | { type: 'gc_triggered'; reason: string };

/**
 * Resource limit violation error
 */
export class ResourceLimitError extends Error {
  constructor(
    message: string,
    public readonly limitType: keyof ResourceLimits,
    public readonly currentUsage: number,
    public readonly limit: number
  ) {
    super(message);
    this.name = 'ResourceLimitError';
  }
}

/**
 * Comprehensive resource manager with real-time monitoring
 */
export class ResourceManager {
  private limits: ResourceLimits;
  private usage: ResourceUsage;
  private startTime: number = 0;
  private events: ResourceEvent[] = [];
  private violationCallbacks: ((violation: SecurityViolation) => void)[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(limits: ResourceLimits) {
    this.limits = { ...limits };
    this.reset();
  }

  /**
   * Reset resource usage counters
   */
  reset(): void {
    this.usage = {
      memoryUsageMB: 0,
      executionTimeMs: 0,
      callDepth: 0,
      loopIterations: 0,
      objectCount: 0,
      stringAllocations: 0,
      arrayAllocations: 0,
    };
    this.startTime = Date.now();
    this.events = [];
  }

  /**
   * Start continuous resource monitoring
   */
  startMonitoring(intervalMs: number = 100): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.updateExecutionTime();
      this.checkLimits();
    }, intervalMs);
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Update current execution time
   */
  private updateExecutionTime(): void {
    this.usage.executionTimeMs = Date.now() - this.startTime;
  }

  /**
   * Check all resource limits and throw if exceeded
   */
  checkLimits(): boolean {
    this.updateExecutionTime();

    // Check execution time limit
    if (this.usage.executionTimeMs > this.limits.maxExecutionTimeMs) {
      const violation: SecurityViolation = {
        type: 'timeout',
        message: `Execution time limit exceeded: ${this.usage.executionTimeMs}ms > ${this.limits.maxExecutionTimeMs}ms`,
        severity: 'critical',
        timestamp: Date.now(),
      };
      this.notifyViolation(violation);
      throw new ResourceLimitError(
        violation.message,
        'maxExecutionTimeMs',
        this.usage.executionTimeMs,
        this.limits.maxExecutionTimeMs
      );
    }

    // Check memory limit
    if (this.usage.memoryUsageMB > this.limits.maxMemoryMB) {
      const violation: SecurityViolation = {
        type: 'memory_limit',
        message: `Memory limit exceeded: ${this.usage.memoryUsageMB}MB > ${this.limits.maxMemoryMB}MB`,
        severity: 'critical',
        timestamp: Date.now(),
      };
      this.notifyViolation(violation);
      throw new ResourceLimitError(
        violation.message,
        'maxMemoryMB',
        this.usage.memoryUsageMB,
        this.limits.maxMemoryMB
      );
    }

    // Check call depth limit
    if (this.usage.callDepth > this.limits.maxCallDepth) {
      const violation: SecurityViolation = {
        type: 'stack_overflow',
        message: `Call depth limit exceeded: ${this.usage.callDepth} > ${this.limits.maxCallDepth}`,
        severity: 'high',
        timestamp: Date.now(),
      };
      this.notifyViolation(violation);
      throw new ResourceLimitError(
        violation.message,
        'maxCallDepth',
        this.usage.callDepth,
        this.limits.maxCallDepth
      );
    }

    // Check loop iterations limit
    if (this.usage.loopIterations > this.limits.maxLoopIterations) {
      const violation: SecurityViolation = {
        type: 'infinite_loop',
        message: `Loop iterations limit exceeded: ${this.usage.loopIterations} > ${this.limits.maxLoopIterations}`,
        severity: 'high',
        timestamp: Date.now(),
      };
      this.notifyViolation(violation);
      throw new ResourceLimitError(
        violation.message,
        'maxLoopIterations',
        this.usage.loopIterations,
        this.limits.maxLoopIterations
      );
    }

    // Check optional limits
    if (this.limits.maxObjectCount && this.usage.objectCount > this.limits.maxObjectCount) {
      const violation: SecurityViolation = {
        type: 'memory_limit',
        message: `Object count limit exceeded: ${this.usage.objectCount} > ${this.limits.maxObjectCount}`,
        severity: 'medium',
        timestamp: Date.now(),
      };
      this.notifyViolation(violation);
      throw new ResourceLimitError(
        violation.message,
        'maxObjectCount',
        this.usage.objectCount,
        this.limits.maxObjectCount
      );
    }

    return true;
  }

  /**
   * Record memory allocation
   */
  recordMemoryAllocation(bytes: number): void {
    const megabytes = bytes / (1024 * 1024);
    this.usage.memoryUsageMB += megabytes;
    
    this.events.push({
      type: 'memory_allocated',
      amount: megabytes,
      total: this.usage.memoryUsageMB,
    });

    // Check limit immediately on allocation
    if (this.usage.memoryUsageMB > this.limits.maxMemoryMB) {
      this.checkLimits();
    }
  }

  /**
   * Record memory deallocation
   */
  recordMemoryDeallocation(bytes: number): void {
    const megabytes = bytes / (1024 * 1024);
    this.usage.memoryUsageMB = Math.max(0, this.usage.memoryUsageMB - megabytes);
    
    this.events.push({
      type: 'memory_freed',
      amount: megabytes,
      total: this.usage.memoryUsageMB,
    });
  }

  /**
   * Record function call entry
   */
  recordCallEnter(functionName: string): void {
    this.usage.callDepth++;
    
    this.events.push({
      type: 'call_enter',
      depth: this.usage.callDepth,
      function: functionName,
    });

    // Check limit immediately on deep calls
    if (this.usage.callDepth > this.limits.maxCallDepth) {
      this.checkLimits();
    }
  }

  /**
   * Record function call exit
   */
  recordCallExit(functionName: string): void {
    this.usage.callDepth = Math.max(0, this.usage.callDepth - 1);
    
    this.events.push({
      type: 'call_exit',
      depth: this.usage.callDepth,
      function: functionName,
    });
  }

  /**
   * Record loop iteration
   */
  recordLoopIteration(location?: string): void {
    this.usage.loopIterations++;
    
    this.events.push({
      type: 'loop_iteration',
      count: this.usage.loopIterations,
      location,
    });

    // Check periodically, not on every iteration for performance
    if (this.usage.loopIterations % 1000 === 0) {
      if (this.usage.loopIterations > this.limits.maxLoopIterations) {
        this.checkLimits();
      }
    }
  }

  /**
   * Record object creation
   */
  recordObjectCreation(objectType: string, estimatedSize: number = 0): void {
    this.usage.objectCount++;
    
    if (objectType === 'string') {
      this.usage.stringAllocations++;
    } else if (objectType === 'array') {
      this.usage.arrayAllocations++;
    }

    this.events.push({
      type: 'object_created',
      objectType: objectType,
      size: estimatedSize,
    });

    // Record memory allocation if size is provided
    if (estimatedSize > 0) {
      this.recordMemoryAllocation(estimatedSize);
    }
  }

  /**
   * Record garbage collection trigger
   */
  recordGCTrigger(reason: string): void {
    this.events.push({
      type: 'gc_triggered',
      reason,
    });
  }

  /**
   * Get current resource usage
   */
  getCurrentUsage(): Readonly<ResourceUsage> {
    this.updateExecutionTime();
    return { ...this.usage };
  }

  /**
   * Get resource limits
   */
  getLimits(): Readonly<ResourceLimits> {
    return { ...this.limits };
  }

  /**
   * Get usage as percentage of limits
   */
  getUsagePercentages(): Record<string, number> {
    this.updateExecutionTime();
    
    return {
      memory: (this.usage.memoryUsageMB / this.limits.maxMemoryMB) * 100,
      executionTime: (this.usage.executionTimeMs / this.limits.maxExecutionTimeMs) * 100,
      callDepth: (this.usage.callDepth / this.limits.maxCallDepth) * 100,
      loopIterations: (this.usage.loopIterations / this.limits.maxLoopIterations) * 100,
      objectCount: this.limits.maxObjectCount ? 
        (this.usage.objectCount / this.limits.maxObjectCount) * 100 : 0,
    };
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): MemoryStats {
    return {
      heapUsageMB: this.usage.memoryUsageMB,
      maxHeapUsageMB: this.limits.maxMemoryMB,
      gcCount: this.events.filter(e => e.type === 'gc_triggered').length,
      peakUsageMB: Math.max(...this.events
        .filter(e => e.type === 'memory_allocated')
        .map(e => (e as any).total)),
      breakdown: {
        objects: this.usage.objectCount - this.usage.stringAllocations - this.usage.arrayAllocations,
        strings: this.usage.stringAllocations,
        arrays: this.usage.arrayAllocations,
        functions: 0, // Would need more detailed tracking
        other: 0,
      },
    };
  }

  /**
   * Get resource events history
   */
  getEvents(): readonly ResourceEvent[] {
    return [...this.events];
  }

  /**
   * Register violation callback
   */
  onViolation(callback: (violation: SecurityViolation) => void): void {
    this.violationCallbacks.push(callback);
  }

  /**
   * Notify all violation callbacks
   */
  private notifyViolation(violation: SecurityViolation): void {
    for (const callback of this.violationCallbacks) {
      try {
        callback(violation);
      } catch (error) {
        // Ignore callback errors to prevent cascading failures
      }
    }
  }

  /**
   * Update resource limits (for dynamic adjustment)
   */
  updateLimits(newLimits: Partial<ResourceLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
  }

  /**
   * Check if resources are near limits (for proactive management)
   */
  isNearLimits(threshold: number = 0.8): boolean {
    const percentages = this.getUsagePercentages();
    const criticalPercentage = threshold * 100;
    
    return percentages.memory > criticalPercentage ||
           percentages.executionTime > criticalPercentage ||
           percentages.callDepth > criticalPercentage ||
           percentages.loopIterations > criticalPercentage;
  }

  /**
   * Generate resource usage report
   */
  generateReport(): {
    usage: ResourceUsage;
    limits: ResourceLimits;
    percentages: Record<string, number>;
    events: readonly ResourceEvent[];
    violations: number;
    recommendations: string[];
  } {
    const percentages = this.getUsagePercentages();
    const violations = this.events.filter(e => 
      percentages.memory > 100 ||
      percentages.executionTime > 100 ||
      percentages.callDepth > 100 ||
      percentages.loopIterations > 100
    ).length;

    const recommendations: string[] = [];
    
    if (percentages.memory > 80) {
      recommendations.push('Consider increasing memory limit or reducing memory usage');
    }
    if (percentages.executionTime > 80) {
      recommendations.push('Consider increasing execution time limit or optimizing code');
    }
    if (percentages.callDepth > 80) {
      recommendations.push('Consider reducing recursion depth or increasing call depth limit');
    }
    if (percentages.loopIterations > 80) {
      recommendations.push('Consider reducing loop complexity or increasing iteration limit');
    }

    return {
      usage: this.getCurrentUsage(),
      limits: this.getLimits(),
      percentages,
      events: this.getEvents(),
      violations,
      recommendations,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopMonitoring();
    this.events = [];
    this.violationCallbacks = [];
  }
}

/**
 * Helper class for tracking resource usage in instrumented code
 */
export class ResourceTracker {
  constructor(private manager: ResourceManager) {}

  /**
   * Wrap a function with resource tracking
   */
  wrapFunction<T extends (...args: any[]) => any>(fn: T, name: string): T {
    const manager = this.manager;
    
    return ((...args: any[]) => {
      manager.recordCallEnter(name);
      try {
        const result = fn(...args);
        manager.recordCallExit(name);
        return result;
      } catch (error) {
        manager.recordCallExit(name);
        throw error;
      }
    }) as T;
  }

  /**
   * Track loop execution
   */
  trackLoop(location: string): (() => void) {
    return () => {
      this.manager.recordLoopIteration(location);
    };
  }

  /**
   * Track object creation
   */
  trackObjectCreation(type: string, size?: number): void {
    this.manager.recordObjectCreation(type, size);
  }
}
