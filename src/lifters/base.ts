/**
 * @fileoverview Base interfaces for bytecode lifting system
 * 
 * This module defines the core interfaces and types used by all bytecode lifters.
 * Provides a contract-based architecture for pluggable bytecode format support.
 */

import type { IRProgram } from '../ir/nodes.js';

// Branded types for type safety
export type BytecodeFormat = string & { readonly __brand: 'BytecodeFormat' };
export type VMDispatchPattern = string & { readonly __brand: 'VMDispatchPattern' };

/**
 * Supported bytecode formats
 */
export const BYTECODE_FORMATS = {
  QUICKJS: 'quickjs' as BytecodeFormat,
  V8_IGNITION: 'v8-ignition' as BytecodeFormat,
  CUSTOM_VM: 'custom-vm' as BytecodeFormat,
} as const;

/**
 * Bytecode metadata extracted during parsing
 */
export interface BytecodeMetadata {
  readonly format: BytecodeFormat;
  readonly version: string;
  readonly architecture: 'stack' | 'register';
  readonly endianness: 'little' | 'big';
  readonly constantPoolSize: number;
  readonly functionCount: number;
  readonly hasDebugInfo: boolean;
  readonly compressionType?: 'none' | 'lz4' | 'gzip';
  readonly customVMDetected: boolean;
  readonly vmPatterns: readonly VMDispatchPattern[];
}

/**
 * Constant pool entry types
 */
export interface ConstantPoolEntry {
  readonly index: number;
  readonly type: 'number' | 'string' | 'boolean' | 'null' | 'undefined' | 'object' | 'function';
  readonly value: unknown;
  readonly size: number;
}

export interface ConstantPool {
  readonly entries: readonly ConstantPoolEntry[];
  readonly totalSize: number;
  
  get(index: number): ConstantPoolEntry | undefined;
  getString(index: number): string | undefined;
  getNumber(index: number): number | undefined;
}

/**
 * Function metadata from bytecode
 */
export interface BytecodeFunction {
  readonly name: string | null;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly parameterCount: number;
  readonly localCount: number;
  readonly stackDepth: number;
  readonly hasExceptionHandlers: boolean;
  readonly isGenerator: boolean;
  readonly isAsync: boolean;
  readonly bytecode: Uint8Array;
  readonly debugInfo?: {
    readonly lineNumbers: readonly number[];
    readonly columnNumbers?: readonly number[];
    readonly sourceFile?: string;
  };
}

/**
 * Complete bytecode module representation
 */
export interface BytecodeModule {
  readonly metadata: BytecodeMetadata;
  readonly constants: ConstantPool;
  readonly functions: readonly BytecodeFunction[];
  readonly entryPointIndex: number;
  readonly rawBytecode: Uint8Array;
}

/**
 * Result type for lifting operations
 */
export type LiftResult<T> = 
  | { success: true; data: T; warnings: readonly string[] }
  | { success: false; error: string; partialData?: Partial<T>; warnings?: readonly string[] };

/**
 * Core bytecode lifter interface
 * 
 * All bytecode format implementations must conform to this contract.
 * Supports contract-based validation for API compatibility.
 */
export interface BytecodeLifter {
  /**
   * Get the bytecode formats supported by this lifter
   */
  readonly supportedFormats: readonly BytecodeFormat[];
  
  /**
   * Check if this lifter can handle the given bytecode format
   */
  supports(format: BytecodeFormat): boolean;
  
  /**
   * Parse bytecode and extract metadata without full lifting
   * Useful for format detection and preliminary analysis
   */
  getMetadata(bytecode: Uint8Array): Promise<LiftResult<BytecodeMetadata>>;
  
  /**
   * Parse complete bytecode module structure
   */
  parse(bytecode: Uint8Array): Promise<LiftResult<BytecodeModule>>;
  
  /**
   * Lift bytecode to IR representation
   * This is the main entry point for bytecode -> IR conversion
   */
  lift(bytecode: Uint8Array): Promise<LiftResult<IRProgram>>;
  
  /**
   * Lift a specific function from bytecode module
   * Useful for incremental or targeted analysis
   */
  liftFunction(
    module: BytecodeModule, 
    functionIndex: number
  ): Promise<LiftResult<IRProgram>>;
  
  /**
   * Validate that lifted IR is semantically equivalent to original bytecode
   * Used by differential testing framework
   */
  validate(
    original: BytecodeModule,
    lifted: IRProgram
  ): Promise<LiftResult<ValidationReport>>;
}

/**
 * Validation report for differential testing
 */
export interface ValidationReport {
  readonly isValid: boolean;
  readonly functionMatches: ReadonlyMap<string, boolean>;
  readonly constantMatches: boolean;
  readonly controlFlowMatches: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly confidence: number; // 0.0 to 1.0
}

export interface ValidationIssue {
  readonly type: 'semantic' | 'structural' | 'performance' | 'warning';
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly message: string;
  readonly location?: {
    readonly function: string;
    readonly instruction: number;
  };
  readonly suggestion?: string;
}

/**
 * VM devirtualization capabilities
 */
export interface VMDevirtualizer {
  /**
   * Detect virtual machine patterns in bytecode
   */
  detectVMPatterns(bytecode: Uint8Array): Promise<LiftResult<VMAnalysis>>;
  
  /**
   * Attempt to devirtualize VM bytecode to standard IR
   */
  devirtualize(
    bytecode: Uint8Array,
    patterns: VMAnalysis
  ): Promise<LiftResult<IRProgram>>;
  
  /**
   * Get devirtualization confidence score
   */
  getConfidence(analysis: VMAnalysis): number;
}

export interface VMAnalysis {
  readonly vmType: 'switch-dispatch' | 'jump-table' | 'computed-goto' | 'custom' | 'unknown';
  readonly dispatcherFunctions: readonly VMDispatcher[];
  readonly opcodeTable: ReadonlyMap<number, string>;
  readonly virtualRegisters: number;
  readonly stackDepth: number;
  readonly hasEncryptedOpcodes: boolean;
  readonly confidence: number;
  readonly patterns: readonly VMDispatchPattern[];
}

export interface VMDispatcher {
  readonly address: number;
  readonly signature: string;
  readonly opcodeCount: number;
  readonly handlerTable: ReadonlyMap<number, number>; // opcode -> handler address
  readonly stackEffect: ReadonlyMap<number, number>; // opcode -> stack delta
}

/**
 * Stack machine simulation for bytecode conversion
 */
export interface StackMachine {
  readonly stack: readonly unknown[];
  readonly stackPointer: number;
  readonly maxStackDepth: number;
  
  push(value: unknown): void;
  pop(): unknown | undefined;
  peek(): unknown | undefined;
  getDepth(): number;
  clear(): void;
  clone(): StackMachine;
  simulate(instruction: any): void;
}

/**
 * Instruction converter for stack-to-SSA transformation
 */
export interface InstructionConverter {
  /**
   * Convert a sequence of stack-based instructions to SSA-form IR
   */
  convertToSSA(
    instructions: readonly BytecodeInstruction[],
    constants: ConstantPool
  ): Promise<LiftResult<IRProgram>>;
  
  /**
   * Get control flow graph for instruction sequence
   */
  buildCFG(instructions: readonly BytecodeInstruction[]): ControlFlowGraph;
}

export interface BytecodeInstruction {
  readonly opcode: number;
  readonly operands: readonly number[];
  readonly offset: number;
  readonly size: number;
  readonly mnemonic?: string;
  readonly stackEffect: number;
  readonly isJump: boolean;
  readonly jumpTargets: readonly number[];
}

export interface ControlFlowGraph {
  readonly basicBlocks: ReadonlyMap<number, BasicBlock>;
  readonly entryBlock: number;
  readonly exitBlocks: readonly number[];
  readonly edges: ReadonlyMap<number, readonly number[]>;
}

export interface BasicBlock {
  readonly id: number;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly instructions: readonly BytecodeInstruction[];
  readonly predecessors: readonly number[];
  readonly successors: readonly number[];
  readonly dominatedBy: readonly number[];
  readonly dominates: readonly number[];
}

/**
 * Error types for bytecode lifting operations
 */
export class BytecodeLifterError extends Error {
  public override readonly cause?: Error;
  public readonly format: BytecodeFormat;
  
  constructor(
    message: string,
    format: BytecodeFormat,
    cause?: Error
  ) {
    super(message);
    this.name = 'BytecodeLifterError';
    this.format = format;
    this.cause = cause;
  }
}

export class VMDevirtualizationError extends Error {
  public override readonly cause?: Error;
  public readonly vmType: string;
  public readonly confidence: number;
  
  constructor(
    message: string,
    vmType: string,
    confidence: number,
    cause?: Error
  ) {
    super(message);
    this.name = 'VMDevirtualizationError';
    this.vmType = vmType;
    this.confidence = confidence;
    this.cause = cause;
  }
}

export class ValidationError extends Error {
  public override readonly cause?: Error;
  public readonly report: ValidationReport;
  
  constructor(
    message: string,
    report: ValidationReport,
    cause?: Error
  ) {
    super(message);
    this.name = 'ValidationError';
    this.report = report;
    this.cause = cause;
  }
}

/**
 * Factory for creating lifter instances
 */
export interface LifterFactory {
  createLifter(format: BytecodeFormat): Promise<BytecodeLifter | null>;
  getSupportedFormats(): readonly BytecodeFormat[];
  isFormatSupported(format: BytecodeFormat): boolean;
}

/**
 * Utility functions for bytecode analysis
 */
export class BytecodeUtils {
  /**
   * Detect bytecode format from magic bytes
   */
  static detectFormat(bytecode: Uint8Array): BytecodeFormat | null {
    // QuickJS bytecode starts with specific magic
    if (bytecode.length >= 4) {
      const magic = Array.from(bytecode.slice(0, 4));
      
      // QuickJS magic: 'qjs\0'
      if (magic.every((b, i) => b === [0x71, 0x6a, 0x73, 0x00][i])) {
        return BYTECODE_FORMATS.QUICKJS;
      }
      
      // V8 Ignition has different magic patterns (version dependent)
      if (magic[0] === 0xc0 && magic[1] === 0xde) {
        return BYTECODE_FORMATS.V8_IGNITION;
      }
    }
    
    return null;
  }
  
  /**
   * Read variable-length integer from bytecode
   */
  static readVarInt(data: Uint8Array, offset: number): { value: number; nextOffset: number } {
    let value = 0;
    let shift = 0;
    let currentOffset = offset;
    
    while (currentOffset < data.length) {
      const byte = data[currentOffset++];
      if (byte !== undefined) {
        value |= (byte & 0x7f) << shift;
        
        if ((byte & 0x80) === 0) {
          break;
        }
        
        shift += 7;
        if (shift >= 32) {
          throw new Error('VarInt too long');
        }
      }
    }
    
    return { value, nextOffset: currentOffset };
  }
  
  /**
   * Read string from bytecode with length prefix
   */
  static readString(data: Uint8Array, offset: number): { value: string; nextOffset: number } {
    const lengthResult = this.readVarInt(data, offset);
    const stringBytes = data.slice(lengthResult.nextOffset, lengthResult.nextOffset + lengthResult.value);
    const value = new TextDecoder('utf-8').decode(stringBytes);
    
    return {
      value,
      nextOffset: lengthResult.nextOffset + lengthResult.value,
    };
  }
  
  /**
   * Calculate instruction size for different architectures
   */
  static getInstructionSize(opcode: number, format: BytecodeFormat): number {
    switch (format) {
      case BYTECODE_FORMATS.QUICKJS:
        // QuickJS instructions are variable length
        return this.getQuickJSInstructionSize(opcode);
      case BYTECODE_FORMATS.V8_IGNITION:
        // V8 Ignition has mostly fixed-size instructions
        return this.getIgnitionInstructionSize(opcode);
      default:
        return 1; // Conservative default
    }
  }
  
  private static getQuickJSInstructionSize(opcode: number): number {
    // Simplified - would need full QuickJS opcode table
    if (opcode < 0x80) return 1;
    if (opcode < 0x8000) return 2;
    return 4;
  }
  
  private static getIgnitionInstructionSize(opcode: number): number {
    // V8 Ignition instruction sizes
    const bytecode = opcode & 0xff;
    if (bytecode < 0x80) return 1;
    if (bytecode < 0x90) return 2;
    if (bytecode < 0xa0) return 3;
    return 4;
  }
}