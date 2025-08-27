/**
 * @fileoverview Comprehensive tests for resource limitation system (limits.ts)
 * 
 * Tests memory usage monitoring, execution time limits, call depth tracking,
 * loop iteration counting, resource threshold enforcement, and DoS prevention.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ResourceManager,
  ResourceTracker,
  ResourceLimitError,
  ResourceEvent,
  type ResourceUsage,
  type ResourceLimits,
} from '../../src/sandbox/limits.js';

describe('Resource Limitation System (limits.ts)', () => {
  let resourceManager: ResourceManager;
  let tracker: ResourceTracker;

  beforeEach(() => {
    const limits: ResourceLimits = {
      maxMemoryMB: 32,
      maxExecutionTimeMS: 2000,
      maxLoopIterations: 1000,
      maxCallStackDepth: 100,
    };
    
    resourceManager = new ResourceManager(limits);
    tracker = new ResourceTracker();
  });

  afterEach(() => {
    if (resourceManager) {
      resourceManager.cleanup();
    }
    if (tracker) {
      tracker.cleanup();
    }
  });

  describe('ResourceManager', () => {
    describe('Initialization and Configuration', () => {
      it('should initialize with correct limits', () => {
        const limits = resourceManager.getLimits();
        
        expect(limits.maxMemoryMB).toBe(32);
        expect(limits.maxExecutionTimeMS).toBe(2000);
        expect(limits.maxLoopIterations).toBe(1000);
        expect(limits.maxCallStackDepth).toBe(100);
      });

      it('should validate limit values', () => {
        const invalidLimits: Partial<ResourceLimits> = {
          maxMemoryMB: -1,
          maxExecutionTimeMS: 0,
          maxLoopIterations: -100,
        };

        expect(() => {
          new ResourceManager(invalidLimits as ResourceLimits);
        }).toThrow(ResourceLimitError);
      });

      it('should allow updating limits', () => {
        const newLimits: ResourceLimits = {
          maxMemoryMB: 64,
          maxExecutionTimeMS: 5000,
          maxLoopIterations: 2000,
          maxCallStackDepth: 200,
        };

        resourceManager.updateLimits(newLimits);
        
        const limits = resourceManager.getLimits();
        expect(limits.maxMemoryMB).toBe(64);
        expect(limits.maxExecutionTimeMS).toBe(5000);
        expect(limits.maxLoopIterations).toBe(2000);
        expect(limits.maxCallStackDepth).toBe(200);
      });

      it('should emit events when limits are updated', () => {
        const eventSpy = vi.fn();
        resourceManager.on('limits_updated', eventSpy);

        const newLimits: ResourceLimits = {
          maxMemoryMB: 16,
          maxExecutionTimeMS: 1000,
          maxLoopIterations: 500,
          maxCallStackDepth: 50,
        };

        resourceManager.updateLimits(newLimits);
        
        expect(eventSpy).toHaveBeenCalledWith({
          type: 'limits_updated',
          timestamp: expect.any(Number),
          data: newLimits,
        });
      });
    });

    describe('Memory Usage Monitoring', () => {
      it('should track memory allocation', async () => {
        const session = resourceManager.startSession();
        
        // Simulate memory allocation
        session.allocateMemory(5 * 1024 * 1024); // 5MB
        
        const usage = session.getCurrentUsage();
        expect(usage.memoryUsageMB).toBeCloseTo(5, 1);
        expect(usage.memoryUsageMB).toBeLessThan(32); // Within limit
      });

      it('should detect memory limit violations', async () => {
        const session = resourceManager.startSession();
        
        // Try to allocate more than the limit
        expect(() => {
          session.allocateMemory(35 * 1024 * 1024); // 35MB > 32MB limit
        }).toThrow(ResourceLimitError);
      });

      it('should track memory growth over time', async () => {
        const session = resourceManager.startSession();
        
        // Gradually allocate memory
        for (let i = 1; i <= 5; i++) {
          session.allocateMemory(2 * 1024 * 1024); // 2MB each
          
          const usage = session.getCurrentUsage();
          expect(usage.memoryUsageMB).toBeCloseTo(i * 2, 1);
        }
        
        // Should be close to 10MB total
        const finalUsage = session.getCurrentUsage();
        expect(finalUsage.memoryUsageMB).toBeCloseTo(10, 1);
      });

      it('should handle memory deallocation', async () => {
        const session = resourceManager.startSession();
        
        session.allocateMemory(10 * 1024 * 1024); // 10MB
        let usage = session.getCurrentUsage();
        expect(usage.memoryUsageMB).toBeCloseTo(10, 1);
        
        session.deallocateMemory(4 * 1024 * 1024); // Free 4MB
        usage = session.getCurrentUsage();
        expect(usage.memoryUsageMB).toBeCloseTo(6, 1);
      });

      it('should prevent memory deallocation below zero', async () => {
        const session = resourceManager.startSession();
        
        session.allocateMemory(2 * 1024 * 1024); // 2MB
        
        // Try to deallocate more than allocated
        expect(() => {
          session.deallocateMemory(5 * 1024 * 1024);
        }).toThrow(ResourceLimitError);
      });
    });

    describe('Execution Time Monitoring', () => {
      it('should track execution time', async () => {
        const session = resourceManager.startSession();
        
        // Simulate some execution time
        await new Promise(resolve => setTimeout(resolve, 100));
        session.updateExecutionTime();
        
        const usage = session.getCurrentUsage();
        expect(usage.executionTimeMS).toBeGreaterThan(90);
        expect(usage.executionTimeMS).toBeLessThan(200);
      });

      it('should detect execution timeout', async () => {
        // Create session with very short timeout
        const shortTimeoutManager = new ResourceManager({
          maxMemoryMB: 32,
          maxExecutionTimeMS: 50,
          maxLoopIterations: 1000,
          maxCallStackDepth: 100,
        });
        
        const session = shortTimeoutManager.startSession();
        
        // Simulate long execution
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(() => {
          session.checkExecutionTime();
        }).toThrow(ResourceLimitError);
        
        shortTimeoutManager.cleanup();
      });

      it('should allow execution within time limit', async () => {
        const session = resourceManager.startSession();
        
        // Short execution within limit
        await new Promise(resolve => setTimeout(resolve, 10));
        session.updateExecutionTime();
        
        expect(() => {
          session.checkExecutionTime();
        }).not.toThrow();
      });
    });

    describe('Call Stack Depth Monitoring', () => {
      it('should track function call depth', () => {
        const session = resourceManager.startSession();
        
        session.enterFunction('function1');
        expect(session.getCurrentCallDepth()).toBe(1);
        
        session.enterFunction('function2');
        expect(session.getCurrentCallDepth()).toBe(2);
        
        session.exitFunction();
        expect(session.getCurrentCallDepth()).toBe(1);
        
        session.exitFunction();
        expect(session.getCurrentCallDepth()).toBe(0);
      });

      it('should detect stack overflow', () => {
        const session = resourceManager.startSession();
        
        // Exceed the call stack limit
        for (let i = 0; i <= 100; i++) {
          if (i === 100) {
            expect(() => {
              session.enterFunction(`function${i}`);
            }).toThrow(ResourceLimitError);
          } else {
            session.enterFunction(`function${i}`);
          }
        }
      });

      it('should handle unbalanced function calls', () => {
        const session = resourceManager.startSession();
        
        session.enterFunction('function1');
        session.enterFunction('function2');
        
        // Try to exit more functions than entered
        session.exitFunction();
        session.exitFunction();
        
        expect(() => {
          session.exitFunction(); // Should throw
        }).toThrow(ResourceLimitError);
      });

      it('should provide call stack information', () => {
        const session = resourceManager.startSession();
        
        session.enterFunction('main');
        session.enterFunction('helper');
        session.enterFunction('nested');
        
        const callStack = session.getCallStack();
        expect(callStack).toEqual(['main', 'helper', 'nested']);
      });
    });

    describe('Loop Iteration Monitoring', () => {
      it('should track loop iterations', () => {
        const session = resourceManager.startSession();
        
        const loopId = session.enterLoop();
        
        for (let i = 0; i < 100; i++) {
          session.incrementLoopIteration(loopId);
        }
        
        expect(session.getLoopIterations(loopId)).toBe(100);
        session.exitLoop(loopId);
      });

      it('should detect infinite loops', () => {
        const session = resourceManager.startSession();
        
        const loopId = session.enterLoop();
        
        // Simulate infinite loop by exceeding iteration limit
        for (let i = 0; i <= 1000; i++) {
          if (i === 1000) {
            expect(() => {
              session.incrementLoopIteration(loopId);
            }).toThrow(ResourceLimitError);
          } else {
            session.incrementLoopIteration(loopId);
          }
        }
      });

      it('should handle nested loops', () => {
        const session = resourceManager.startSession();
        
        const outerLoop = session.enterLoop();
        const innerLoop = session.enterLoop();
        
        // Outer loop iterations
        for (let i = 0; i < 10; i++) {
          session.incrementLoopIteration(outerLoop);
          
          // Inner loop iterations
          for (let j = 0; j < 5; j++) {
            session.incrementLoopIteration(innerLoop);
          }
        }
        
        expect(session.getLoopIterations(outerLoop)).toBe(10);
        expect(session.getLoopIterations(innerLoop)).toBe(50);
        
        session.exitLoop(innerLoop);
        session.exitLoop(outerLoop);
      });

      it('should reset loop counters after exit', () => {
        const session = resourceManager.startSession();
        
        const loopId = session.enterLoop();
        
        for (let i = 0; i < 50; i++) {
          session.incrementLoopIteration(loopId);
        }
        
        session.exitLoop(loopId);
        
        // Re-enter loop should start fresh
        const newLoopId = session.enterLoop();
        expect(session.getLoopIterations(newLoopId)).toBe(0);
        
        session.exitLoop(newLoopId);
      });
    });

    describe('Resource Usage Reporting', () => {
      it('should provide comprehensive usage statistics', () => {
        const session = resourceManager.startSession();
        
        session.allocateMemory(10 * 1024 * 1024); // 10MB
        session.enterFunction('test');
        const loopId = session.enterLoop();
        session.incrementLoopIteration(loopId, 50);
        
        const usage = session.getCurrentUsage();
        
        expect(usage.memoryUsageMB).toBeCloseTo(10, 1);
        expect(usage.callStackDepth).toBe(1);
        expect(usage.activeLoops).toBe(1);
        expect(usage.totalLoopIterations).toBe(50);
        expect(usage.executionTimeMS).toBeGreaterThan(0);
      });

      it('should track peak resource usage', async () => {
        const session = resourceManager.startSession();
        
        // Allocate and deallocate to test peak tracking
        session.allocateMemory(20 * 1024 * 1024); // 20MB
        session.deallocateMemory(10 * 1024 * 1024); // Down to 10MB
        
        const usage = session.getCurrentUsage();
        const peaks = session.getPeakUsage();
        
        expect(usage.memoryUsageMB).toBeCloseTo(10, 1);
        expect(peaks.peakMemoryMB).toBeCloseTo(20, 1);
      });
    });
  });

  describe('ResourceTracker', () => {
    describe('Event Tracking', () => {
      it('should track resource events', () => {
        const events: ResourceEvent[] = [];
        tracker.on('resource_event', (event) => events.push(event));
        
        tracker.recordMemoryAllocation(1024 * 1024); // 1MB
        tracker.recordFunctionCall('testFunction');
        tracker.recordLoopIteration();
        
        expect(events).toHaveLength(3);
        expect(events[0].type).toBe('memory_allocation');
        expect(events[1].type).toBe('function_call');
        expect(events[2].type).toBe('loop_iteration');
      });

      it('should provide event timestamps', () => {
        const events: ResourceEvent[] = [];
        tracker.on('resource_event', (event) => events.push(event));
        
        const beforeTime = Date.now();
        tracker.recordMemoryAllocation(1024);
        const afterTime = Date.now();
        
        expect(events[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(events[0].timestamp).toBeLessThanOrEqual(afterTime);
      });

      it('should include relevant data in events', () => {
        const events: ResourceEvent[] = [];
        tracker.on('resource_event', (event) => events.push(event));
        
        tracker.recordMemoryAllocation(2 * 1024 * 1024, 'array_creation');
        tracker.recordFunctionCall('recursiveFunction', 5);
        
        const memoryEvent = events.find(e => e.type === 'memory_allocation');
        const functionEvent = events.find(e => e.type === 'function_call');
        
        expect(memoryEvent?.data.bytes).toBe(2 * 1024 * 1024);
        expect(memoryEvent?.data.source).toBe('array_creation');
        expect(functionEvent?.data.functionName).toBe('recursiveFunction');
        expect(functionEvent?.data.depth).toBe(5);
      });
    });

    describe('Statistics Collection', () => {
      it('should collect execution statistics', () => {
        tracker.recordMemoryAllocation(1024 * 1024);
        tracker.recordMemoryAllocation(2 * 1024 * 1024);
        tracker.recordFunctionCall('func1');
        tracker.recordFunctionCall('func2');
        tracker.recordLoopIteration();
        tracker.recordLoopIteration();
        tracker.recordLoopIteration();
        
        const stats = tracker.getStatistics();
        
        expect(stats.totalMemoryAllocated).toBe(3 * 1024 * 1024);
        expect(stats.totalFunctionCalls).toBe(2);
        expect(stats.totalLoopIterations).toBe(3);
        expect(stats.executionEvents).toBe(7);
      });

      it('should track resource usage over time', async () => {
        tracker.recordMemoryAllocation(1024 * 1024);
        await new Promise(resolve => setTimeout(resolve, 10));
        tracker.recordMemoryAllocation(1024 * 1024);
        await new Promise(resolve => setTimeout(resolve, 10));
        tracker.recordMemoryAllocation(1024 * 1024);
        
        const timeline = tracker.getUsageTimeline();
        
        expect(timeline.length).toBe(3);
        expect(timeline[0].cumulativeMemory).toBe(1024 * 1024);
        expect(timeline[1].cumulativeMemory).toBe(2 * 1024 * 1024);
        expect(timeline[2].cumulativeMemory).toBe(3 * 1024 * 1024);
      });
    });

    describe('Anomaly Detection', () => {
      it('should detect memory leaks', () => {
        // Simulate consistent memory growth without deallocation
        for (let i = 0; i < 10; i++) {
          tracker.recordMemoryAllocation(1024 * 1024); // 1MB each
        }
        
        const anomalies = tracker.detectAnomalies();
        const memoryLeak = anomalies.find(a => a.type === 'memory_leak');
        
        expect(memoryLeak).toBeDefined();
        expect(memoryLeak?.severity).toBe('high');
      });

      it('should detect excessive recursion', () => {
        // Simulate deep recursion
        for (let depth = 1; depth <= 150; depth++) {
          tracker.recordFunctionCall(`recursiveFunc`, depth);
        }
        
        const anomalies = tracker.detectAnomalies();
        const recursion = anomalies.find(a => a.type === 'excessive_recursion');
        
        expect(recursion).toBeDefined();
        expect(recursion?.data.maxDepth).toBeGreaterThan(100);
      });

      it('should detect tight loops', () => {
        // Simulate tight loop with many iterations in short time
        const startTime = Date.now();
        for (let i = 0; i < 10000; i++) {
          tracker.recordLoopIteration();
        }
        
        const anomalies = tracker.detectAnomalies();
        const tightLoop = anomalies.find(a => a.type === 'tight_loop');
        
        expect(tightLoop).toBeDefined();
        expect(tightLoop?.data.iterationsPerSecond).toBeGreaterThan(1000);
      });
    });
  });

  describe('Integration and Error Scenarios', () => {
    it('should handle resource manager and tracker integration', () => {
      const session = resourceManager.startSession();
      session.attachTracker(tracker);
      
      const events: ResourceEvent[] = [];
      tracker.on('resource_event', (event) => events.push(event));
      
      session.allocateMemory(5 * 1024 * 1024);
      session.enterFunction('testFunc');
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('memory_allocation');
      expect(events[1].type).toBe('function_call');
    });

    it('should handle cleanup gracefully', () => {
      const session = resourceManager.startSession();
      
      session.allocateMemory(10 * 1024 * 1024);
      session.enterFunction('test');
      const loopId = session.enterLoop();
      
      expect(() => {
        session.cleanup();
      }).not.toThrow();
    });

    it('should handle concurrent sessions', () => {
      const session1 = resourceManager.startSession();
      const session2 = resourceManager.startSession();
      
      session1.allocateMemory(5 * 1024 * 1024);
      session2.allocateMemory(10 * 1024 * 1024);
      
      const usage1 = session1.getCurrentUsage();
      const usage2 = session2.getCurrentUsage();
      
      expect(usage1.memoryUsageMB).toBeCloseTo(5, 1);
      expect(usage2.memoryUsageMB).toBeCloseTo(10, 1);
    });

    it('should recover from resource limit errors', () => {
      const session = resourceManager.startSession();
      
      try {
        session.allocateMemory(50 * 1024 * 1024); // Exceeds 32MB limit
      } catch (error) {
        expect(error).toBeInstanceOf(ResourceLimitError);
      }
      
      // Should still be able to allocate within limit
      expect(() => {
        session.allocateMemory(10 * 1024 * 1024);
      }).not.toThrow();
    });

    it('should provide detailed error information', () => {
      const session = resourceManager.startSession();
      
      try {
        session.allocateMemory(40 * 1024 * 1024);
      } catch (error) {
        expect(error).toBeInstanceOf(ResourceLimitError);
        expect((error as ResourceLimitError).limitType).toBe('memory');
        expect((error as ResourceLimitError).currentValue).toBeGreaterThan(32);
        expect((error as ResourceLimitError).limitValue).toBe(32);
      }
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle high-frequency events efficiently', () => {
      const startTime = performance.now();
      
      // Generate many events quickly
      for (let i = 0; i < 10000; i++) {
        tracker.recordLoopIteration();
      }
      
      const endTime = performance.now();
      
      // Should complete reasonably quickly
      expect(endTime - startTime).toBeLessThan(100);
      
      const stats = tracker.getStatistics();
      expect(stats.totalLoopIterations).toBe(10000);
    });

    it('should optimize memory tracking', () => {
      const session = resourceManager.startSession();
      
      // Many small allocations and deallocations
      for (let i = 0; i < 1000; i++) {
        session.allocateMemory(1024); // 1KB
        if (i % 2 === 0) {
          session.deallocateMemory(1024);
        }
      }
      
      const usage = session.getCurrentUsage();
      expect(usage.memoryUsageMB).toBeCloseTo(0.5, 1); // ~500KB remaining
    });

    it('should limit event history size', () => {
      // Generate more events than history limit
      for (let i = 0; i < 20000; i++) {
        tracker.recordLoopIteration();
      }
      
      const timeline = tracker.getUsageTimeline();
      
      // Should cap history size to prevent memory issues
      expect(timeline.length).toBeLessThanOrEqual(10000);
    });
  });
});