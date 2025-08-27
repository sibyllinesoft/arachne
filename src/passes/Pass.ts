/**
 * @fileoverview Base Pass interface and pass management framework
 * 
 * This module defines the core Pass interface and provides utilities for
 * managing analysis and transformation passes in the deobfuscation pipeline.
 */

import type { IRNode, NodeId } from '../ir/nodes.js';
import type { CFG } from '../ir/cfg.js';
import type { SSAState } from '../ir/ssa.js';

/**
 * Analysis state that passes operate on
 */
export interface IRState {
  readonly cfg: CFG;
  readonly ssa?: SSAState;
  readonly nodes: ReadonlyMap<NodeId, IRNode>;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Pass execution result
 */
export interface PassResult<T extends IRState = IRState> {
  readonly state: T;
  readonly changed: boolean;
  readonly metrics: PassMetrics;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Pass execution metrics
 */
export interface PassMetrics {
  readonly execution_time_ms: number;
  readonly nodes_visited: number;
  readonly nodes_changed: number;
  readonly memory_usage_mb: number;
  readonly iterations?: number;
}

/**
 * Pass configuration options
 */
export interface PassOptions {
  readonly enabled: boolean;
  readonly max_iterations: number;
  readonly timeout_ms: number;
  readonly debug: boolean;
  readonly metrics_collection: boolean;
}

/**
 * Default pass options
 */
export const defaultPassOptions: PassOptions = {
  enabled: true,
  max_iterations: 1,
  timeout_ms: 30000, // 30 seconds
  debug: false,
  metrics_collection: true
};

/**
 * Base interface for all passes
 */
export interface Pass<T extends IRState = IRState> {
  readonly name: string;
  readonly description: string;
  readonly dependencies: readonly string[];
  readonly options: PassOptions;
  
  /**
   * Main pass execution method
   */
  run(state: T): Promise<PassResult<T>>;
  
  /**
   * Check if pass can run on given state
   */
  canRun(state: T): boolean;
  
  /**
   * Cleanup resources after pass execution
   */
  cleanup?(): void;
}

/**
 * Abstract base class for passes with common functionality
 */
export abstract class BasePass<T extends IRState = IRState> implements Pass<T> {
  abstract readonly name: string;
  abstract readonly description: string;
  readonly dependencies: readonly string[] = [];
  readonly options: PassOptions;
  
  protected startTime = 0;
  protected nodesVisited = 0;
  protected nodesChanged = 0;
  protected warnings: string[] = [];
  protected errors: string[] = [];

  constructor(options: Partial<PassOptions> = {}) {
    this.options = { ...defaultPassOptions, ...options };
  }

  /**
   * Optional cleanup method - can be overridden by subclasses
   */
  cleanup?(): void;

  /**
   * Main execution template method
   */
  async run(state: T): Promise<PassResult<T>> {
    if (!this.canRun(state)) {
      throw new Error(`Pass ${this.name} cannot run on current state`);
    }

    this.resetMetrics();
    this.startTime = performance.now();

    try {
      const result = await this.executePass(state);
      const metrics = this.collectMetrics();
      
      return {
        state: result.state,
        changed: result.changed,
        metrics,
        warnings: [...this.warnings],
        errors: [...this.errors]
      };
    } catch (error) {
      this.errors.push(`Pass execution failed: ${error instanceof Error ? error.message : String(error)}`);
      
      const metrics = this.collectMetrics();
      return {
        state,
        changed: false,
        metrics,
        warnings: [...this.warnings],
        errors: [...this.errors]
      };
    } finally {
      this.cleanup?.();
    }
  }

  /**
   * Template method for pass-specific execution
   */
  protected abstract executePass(state: T): Promise<{ state: T; changed: boolean }> | { state: T; changed: boolean };

  /**
   * Default implementation - passes can override
   */
  canRun(state: T): boolean {
    return true;
  }

  /**
   * Reset metrics for new execution
   */
  protected resetMetrics(): void {
    this.nodesVisited = 0;
    this.nodesChanged = 0;
    this.warnings = [];
    this.errors = [];
  }

  /**
   * Collect execution metrics
   */
  protected collectMetrics(): PassMetrics {
    const executionTime = performance.now() - this.startTime;
    const memoryUsage = this.estimateMemoryUsage();
    
    return {
      execution_time_ms: executionTime,
      nodes_visited: this.nodesVisited,
      nodes_changed: this.nodesChanged,
      memory_usage_mb: memoryUsage
    };
  }

  /**
   * Estimate memory usage (simplified)
   */
  protected estimateMemoryUsage(): number {
    // Simplified memory estimation
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Helper: Record node visit
   */
  protected visitNode(): void {
    this.nodesVisited++;
  }

  /**
   * Helper: Record node change
   */
  protected changeNode(): void {
    this.nodesChanged++;
  }

  /**
   * Helper: Add warning
   */
  protected warn(message: string): void {
    this.warnings.push(message);
  }

  /**
   * Helper: Add error
   */
  protected error(message: string): void {
    this.errors.push(message);
  }
}

/**
 * Pass manager for orchestrating multiple passes
 */
export class PassManager {
  private readonly passes = new Map<string, Pass>();
  private readonly passOrder: string[] = [];

  /**
   * Register a pass
   */
  addPass(pass: Pass): void {
    if (this.passes.has(pass.name)) {
      throw new Error(`Pass ${pass.name} is already registered`);
    }

    this.passes.set(pass.name, pass);
    this.updatePassOrder();
  }

  /**
   * Remove a pass
   */
  removePass(name: string): boolean {
    const removed = this.passes.delete(name);
    if (removed) {
      this.updatePassOrder();
    }
    return removed;
  }

  /**
   * Get a pass by name
   */
  getPass(name: string): Pass | undefined {
    return this.passes.get(name);
  }

  /**
   * Run all passes in dependency order
   */
  async runPipeline(initialState: IRState): Promise<PipelineResult> {
    const results: PassResult[] = [];
    let currentState = initialState;
    let totalChanges = 0;

    for (const passName of this.passOrder) {
      const pass = this.passes.get(passName)!;
      
      if (!pass.options.enabled) {
        continue;
      }

      try {
        const result = await pass.run(currentState);
        results.push(result);
        currentState = result.state;
        
        if (result.changed) {
          totalChanges++;
        }

        // Stop on errors if configured
        if (result.errors.length > 0) {
          console.warn(`Pass ${pass.name} completed with errors:`, result.errors);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          state: currentState,
          changed: false,
          metrics: {
            execution_time_ms: 0,
            nodes_visited: 0,
            nodes_changed: 0,
            memory_usage_mb: 0
          },
          warnings: [],
          errors: [`Pass ${pass.name} failed: ${errorMessage}`]
        });
      }
    }

    return {
      final_state: currentState,
      pass_results: results,
      total_changes: totalChanges,
      total_execution_time: results.reduce((sum, r) => sum + r.metrics.execution_time_ms, 0)
    };
  }

  /**
   * Run specific passes in order
   */
  async runPasses(state: IRState, passNames: readonly string[]): Promise<PipelineResult> {
    const results: PassResult[] = [];
    let currentState = state;
    let totalChanges = 0;

    for (const passName of passNames) {
      const pass = this.passes.get(passName);
      if (!pass) {
        throw new Error(`Pass ${passName} not found`);
      }

      if (!pass.options.enabled) {
        continue;
      }

      const result = await pass.run(currentState);
      results.push(result);
      currentState = result.state;
      
      if (result.changed) {
        totalChanges++;
      }
    }

    return {
      final_state: currentState,
      pass_results: results,
      total_changes: totalChanges,
      total_execution_time: results.reduce((sum, r) => sum + r.metrics.execution_time_ms, 0)
    };
  }

  /**
   * Update pass execution order based on dependencies
   */
  private updatePassOrder(): void {
    this.passOrder.length = 0;
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (passName: string): void => {
      if (visiting.has(passName)) {
        throw new Error(`Circular dependency detected involving pass ${passName}`);
      }
      
      if (visited.has(passName)) {
        return;
      }

      visiting.add(passName);
      const pass = this.passes.get(passName);
      
      if (pass) {
        for (const dependency of pass.dependencies) {
          if (this.passes.has(dependency)) {
            visit(dependency);
          } else {
            throw new Error(`Pass ${passName} depends on unknown pass ${dependency}`);
          }
        }
      }

      visiting.delete(passName);
      visited.add(passName);
      this.passOrder.push(passName);
    };

    for (const passName of this.passes.keys()) {
      visit(passName);
    }
  }
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  readonly final_state: IRState;
  readonly pass_results: readonly PassResult[];
  readonly total_changes: number;
  readonly total_execution_time: number;
}

/**
 * Utility functions for pass development
 */
export class PassUtils {
  /**
   * Create a deep copy of IR state
   */
  static cloneState(state: IRState): IRState {
    return {
      cfg: state.cfg, // CFG is immutable
      ssa: state.ssa, // SSA state is immutable
      nodes: new Map(state.nodes),
      metadata: new Map(state.metadata)
    };
  }

  /**
   * Update nodes in state
   */
  static updateNodes(state: IRState, updates: Map<NodeId, IRNode>): IRState {
    const newNodes = new Map(state.nodes);
    for (const [id, node] of updates) {
      newNodes.set(id, node);
    }
    
    return {
      ...state,
      nodes: newNodes
    };
  }

  /**
   * Check if two states are equivalent
   */
  static statesEqual(state1: IRState, state2: IRState): boolean {
    if (state1.nodes.size !== state2.nodes.size) {
      return false;
    }

    for (const [id, node1] of state1.nodes) {
      const node2 = state2.nodes.get(id);
      if (!node2 || !this.nodesEqual(node1, node2)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Deep equality check for IR nodes
   */
  private static nodesEqual(node1: IRNode, node2: IRNode): boolean {
    return JSON.stringify(node1) === JSON.stringify(node2);
  }
}