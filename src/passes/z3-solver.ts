/**
 * @fileoverview Z3 SMT Solver Integration
 * 
 * This module provides a production-ready interface to the Z3 SMT solver
 * for use in opaque predicate analysis and constraint solving. It supports
 * both Node.js native bindings and WebAssembly backends with timeout
 * handling and resource management.
 */

import { init, Context, Solver, Sort, Expr, Bool } from 'z3-solver';
import type { 
  SMTSolver, 
  SMTExpression, 
  SMTModel, 
  SatResult,
  SMTOperator 
} from './opaque.js';
import type { VariableName } from '../ir/nodes.js';

/**
 * Z3 context wrapper for resource management
 */
interface Z3Context {
  context: Context;
  solver: Solver;
  variables: Map<VariableName, Expr>;
  intSort: Sort;
  boolSort: Sort;
  bvSort: Sort;
}

/**
 * Z3-based SMT solver implementation
 * 
 * Features:
 * - Automatic context and resource management
 * - Support for integer, boolean, and bitvector theories
 * - Timeout handling with graceful degradation
 * - Constraint push/pop for backtracking
 * - Model extraction for satisfying assignments
 */
export class Z3SMTSolver implements SMTSolver {
  private z3Context: Z3Context | null = null;
  private timeoutMs: number = 30000; // 30 second default
  private constraints: SMTExpression[] = [];
  private assertionStack: number = 0;

  /**
   * Initialize Z3 context and solver
   */
  async initialize(): Promise<void> {
    try {
      const { Context } = await init();
      const context = Context('main');
      const solver = new context.Solver();
      
      this.z3Context = {
        context,
        solver,
        variables: new Map(),
        intSort: context.Int.sort(),
        boolSort: context.Bool.sort(),
        bvSort: context.BitVec.sort(32) // 32-bit bitvectors by default
      };

      // Set solver timeout
      solver.set('timeout', this.timeoutMs);
      
    } catch (error) {
      throw new Error(`Failed to initialize Z3 solver: ${error}`);
    }
  }

  /**
   * Add constraint to the solver context
   */
  addConstraint(expr: SMTExpression): void {
    if (!this.z3Context) {
      throw new Error('Z3 solver not initialized');
    }

    this.constraints.push(expr);
    const z3Expr = this.convertToZ3Expression(expr);
    this.z3Context.solver.add(z3Expr as any);
  }

  /**
   * Check satisfiability of current constraints
   */
  async checkSat(): Promise<SatResult> {
    if (!this.z3Context) {
      throw new Error('Z3 solver not initialized');
    }

    try {
      const result = await this.z3Context.solver.check();
      
      switch (result) {
        case 'sat':
          return 'sat';
        case 'unsat':
          return 'unsat';
        case 'unknown':
          return 'unknown';
        default:
          return 'unknown';
      }
    } catch (error) {
      if (error instanceof Error && error.message?.includes('timeout')) {
        return 'timeout';
      }
      throw error;
    }
  }

  /**
   * Get satisfying model if SAT
   */
  async getModel(): Promise<SMTModel | null> {
    if (!this.z3Context) {
      throw new Error('Z3 solver not initialized');
    }

    try {
      const satResult = await this.checkSat();
      if (satResult !== 'sat') {
        return null;
      }

      const model = this.z3Context.solver.model();
      const assignments = new Map<VariableName, number | boolean | bigint>();

      // Extract variable assignments from model
      for (const [varName, z3Var] of this.z3Context.variables) {
        const value = model.eval(z3Var);
        
        if (value.sort.name() === 'Int') {
          assignments.set(varName, parseInt(value.toString(), 10));
        } else if (value.sort.name() === 'Bool') {
          assignments.set(varName, value.toString() === 'true');
        } else if (String(value.sort.name()).startsWith('BitVec')) {
          assignments.set(varName, BigInt(value.toString()));
        }
      }

      return {
        assignments,
        isValid: true
      };
    } catch (error) {
      console.warn(`Failed to extract model: ${error}`);
      return null;
    }
  }

  /**
   * Set timeout for solver operations
   */
  setTimeout(ms: number): void {
    this.timeoutMs = ms;
    if (this.z3Context) {
      this.z3Context.solver.set('timeout', ms);
    }
  }

  /**
   * Reset solver to empty state
   */
  reset(): void {
    if (this.z3Context) {
      this.z3Context.solver.reset();
      this.z3Context.variables.clear();
    }
    this.constraints = [];
    this.assertionStack = 0;
  }

  /**
   * Push new assertion frame
   */
  push(): void {
    if (this.z3Context) {
      this.z3Context.solver.push();
      this.assertionStack++;
    }
  }

  /**
   * Pop assertion frame
   */
  pop(): void {
    if (this.z3Context && this.assertionStack > 0) {
      this.z3Context.solver.pop();
      this.assertionStack--;
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.z3Context) {
      // Z3 context cleanup is handled automatically by the library
      this.z3Context = null;
    }
    this.constraints = [];
    this.assertionStack = 0;
  }

  /**
   * Convert SMT expression to Z3 expression
   */
  private convertToZ3Expression(expr: SMTExpression): Expr {
    if (!this.z3Context) {
      throw new Error('Z3 context not available');
    }

    const { context } = this.z3Context;

    switch (expr.type) {
      case 'constant':
        if (typeof expr.value === 'number') {
          return context.Int.val(expr.value);
        } else if (typeof expr.value === 'boolean') {
          return expr.value ? context.Bool.val(true) : context.Bool.val(false);
        } else if (typeof expr.value === 'bigint') {
          return context.BitVec.val(Number(expr.value), 32);
        }
        throw new Error(`Unsupported constant type: ${typeof expr.value}`);

      case 'variable':
        return this.getOrCreateZ3Variable(expr.variable!, expr.bitwidth);

      case 'binary_op':
        return this.convertBinaryOperation(expr);

      case 'unary_op':
        return this.convertUnaryOperation(expr);

      case 'comparison':
      case 'logical':
        return this.convertBinaryOperation(expr);

      default:
        throw new Error(`Unsupported SMT expression type: ${expr.type}`);
    }
  }

  /**
   * Get or create Z3 variable
   */
  private getOrCreateZ3Variable(name: VariableName, bitwidth?: number): Expr {
    if (!this.z3Context) {
      throw new Error('Z3 context not available');
    }

    if (this.z3Context.variables.has(name)) {
      return this.z3Context.variables.get(name)!;
    }

    const { context } = this.z3Context;
    let variable: Expr;

    if (bitwidth && bitwidth > 0) {
      variable = context.BitVec.const(name, bitwidth);
    } else {
      // Default to integer variables
      variable = context.Int.const(name);
    }

    this.z3Context.variables.set(name, variable);
    return variable;
  }

  /**
   * Convert binary operation to Z3 expression
   */
  private convertBinaryOperation(expr: SMTExpression): Expr {
    if (!this.z3Context || !expr.operands || expr.operands.length !== 2) {
      throw new Error('Invalid binary operation');
    }

    const left = this.convertToZ3Expression(expr.operands[0]);
    const right = this.convertToZ3Expression(expr.operands[1]);
    const { context } = this.z3Context;

    switch (expr.operator) {
      // Arithmetic
      case 'add': return (left as any).add(right);
      case 'sub': return (left as any).sub(right);
      case 'mul': return (left as any).mul(right);
      case 'div': return (left as any).div(right);
      case 'mod': return (left as any).mod(right);

      // Bitwise
      case 'bvand': return (left as any).and(right);
      case 'bvor': return (left as any).or(right);
      case 'bvxor': return (left as any).xor(right);
      case 'bvshl': return (left as any).shl(right);
      case 'bvlshr': return (left as any).lshr(right);

      // Comparison
      case 'eq': return (left as any).eq(right);
      case 'ne': return (left as any).neq(right);
      case 'lt': return (left as any).lt(right);
      case 'le': return (left as any).le(right);
      case 'gt': return (left as any).gt(right);
      case 'ge': return (left as any).ge(right);

      // Logical
      case 'and': return (context as any).And(left, right);
      case 'or': return (context as any).Or(left, right);
      case 'implies': return (context as any).Implies(left, right);

      // Bitvector unsigned comparison
      case 'bvult': return (left as any).ult(right);
      case 'bvule': return (left as any).ule(right);
      case 'bvugt': return (left as any).ugt(right);
      case 'bvuge': return (left as any).uge(right);

      default:
        throw new Error(`Unsupported binary operator: ${expr.operator}`);
    }
  }

  /**
   * Convert unary operation to Z3 expression
   */
  private convertUnaryOperation(expr: SMTExpression): Expr {
    if (!this.z3Context || !expr.operands || expr.operands.length !== 1) {
      throw new Error('Invalid unary operation');
    }

    const operand = this.convertToZ3Expression(expr.operands[0]);
    const { context } = this.z3Context;

    switch (expr.operator) {
      case 'not': return (context as any).Not(operand);
      case 'bvnot': return (operand as any).not();
      case 'bvneg': return (operand as any).neg();
      default:
        throw new Error(`Unsupported unary operator: ${expr.operator}`);
    }
  }
}

/**
 * Factory function to create and initialize Z3 solver
 */
export async function createZ3Solver(timeoutMs: number = 30000): Promise<SMTSolver> {
  const solver = new Z3SMTSolver();
  solver.setTimeout(timeoutMs);
  await solver.initialize();
  return solver;
}

/**
 * Utility function to check if Z3 is available
 */
export async function isZ3Available(): Promise<boolean> {
  try {
    await init();
    return true;
  } catch (error) {
    console.warn('Z3 solver not available:', error);
    return false;
  }
}

/**
 * Create solver with fallback to mock implementation
 */
export async function createSolverWithFallback(timeoutMs: number = 30000): Promise<SMTSolver> {
  try {
    return await createZ3Solver(timeoutMs);
  } catch (error) {
    console.warn('Falling back to mock SMT solver:', error);
    const { MockSMTSolver } = await import('./opaque.js');
    return new MockSMTSolver();
  }
}