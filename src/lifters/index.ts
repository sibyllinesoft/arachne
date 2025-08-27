/**
 * @fileoverview Bytecode lifters module entry point
 * 
 * Exports all bytecode lifting functionality including lifters, factory,
 * and utility functions for Phase 5 integration.
 */

// Base interfaces and types
export type {
  BytecodeLifter,
  BytecodeFormat,
  BytecodeMetadata,
  BytecodeModule,
  BytecodeFunction,
  ConstantPool,
  ConstantPoolEntry,
  LiftResult,
  ValidationReport,
  ValidationIssue,
  VMDevirtualizer,
  VMAnalysis,
  VMDispatcher,
  VMDispatchPattern,
  StackMachine,
  InstructionConverter,
  BasicBlock,
  ControlFlowGraph,
  BytecodeInstruction,
  LifterFactory,
} from './base.js';

export {
  BYTECODE_FORMATS,
  BytecodeUtils,
  BytecodeLifterError,
  VMDevirtualizationError,
  ValidationError,
} from './base.js';

// Factory and registry
export {
  BytecodeLifterFactory,
  lifterFactory,
  createLifterForBytecode,
  liftBytecode,
} from './factory.js';

// QuickJS lifter
export {
  QuickJSLifter,
  createQuickJSLifter,
} from './quickjs/index.js';

// V8 lifter (feature-flagged)
export {
  V8IgnitionLifter,
  createV8Lifter,
} from './v8/index.js';

// QuickJS-specific exports
export {
  QuickJSOpcode,
  getInstructionInfo,
  getInstructionName,
  canInstructionThrow,
  hasSideEffects,
  calculateStackEffect,
  getJumpTargets,
} from './quickjs/opcodes.js';

export {
  QuickJSParser,
  QuickJSInstructionDecoder,
} from './quickjs/parser.js';

export {
  QuickJSInstructionConverter,
} from './quickjs/converter.js';

export {
  QuickJSVMDevirtualizer,
} from './quickjs/devirt.js';

// Convenience functions for common operations
export async function detectBytecodeFormat(bytecode: Uint8Array): Promise<any | null> {
  const { BytecodeUtils } = await import('./base.js');
  return BytecodeUtils.detectFormat(bytecode);
}

export async function getSupportedFormats(): Promise<readonly any[]> {
  const { lifterFactory } = await import('./factory.js');
  return lifterFactory.getSupportedFormats();
}

export async function isFormatSupported(format: any): Promise<boolean> {
  const { lifterFactory } = await import('./factory.js');
  return lifterFactory.isFormatSupported(format);
}

/**
 * High-level API for lifting bytecode with full pipeline
 */
export async function liftBytecodeWithValidation(bytecode: Uint8Array) {
  // Auto-detect and create lifter
  const { createLifterForBytecode } = await import('./factory.js');
  const lifterResult = await createLifterForBytecode(bytecode);
  if (!lifterResult.success) {
    return lifterResult;
  }

  const { lifter, format } = lifterResult.data;
  
  // Parse bytecode module
  const parseResult = await lifter.parse(bytecode);
  if (!parseResult.success) {
    return parseResult;
  }

  // Lift to IR
  const liftResult = await lifter.lift(bytecode);
  if (!liftResult.success) {
    return liftResult;
  }

  // Validate result
  const validationResult = await lifter.validate(parseResult.data, liftResult.data);
  
  return {
    success: true,
    data: {
      format,
      module: parseResult.data,
      ir: liftResult.data,
      validation: validationResult.success ? validationResult.data : null,
    },
    warnings: [
      ...(lifterResult.warnings || []),
      ...(parseResult.warnings || []),
      ...(liftResult.warnings || []),
      ...(validationResult.warnings || []),
    ],
  };
}

/**
 * Batch lifting for multiple bytecode files
 */
export async function liftMultipleBytecode(
  bytecodeFiles: Array<{ name: string; data: Uint8Array }>
): Promise<Array<{
  name: string;
  result: any;
}>> {
  const results = [];
  const { liftBytecode } = await import('./factory.js');
  
  for (const file of bytecodeFiles) {
    try {
      const result = await liftBytecode(file.data);
      results.push({
        name: file.name,
        result,
      });
    } catch (error) {
      results.push({
        name: file.name,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
  
  return results;
}

/**
 * Get lifter information and capabilities
 */
export async function getLifterInfo(): Promise<{
  supportedFormats: readonly any[];
  registry: ReadonlyMap<any, any>;
  capabilities: {
    vmDevirtualization: boolean;
    differentialTesting: boolean;
    contractValidation: boolean;
  };
}> {
  const { lifterFactory } = await import('./factory.js');
  const supportedFormats = lifterFactory.getSupportedFormats();
  const registry = lifterFactory.getRegistry();
  
  return {
    supportedFormats,
    registry,
    capabilities: {
      vmDevirtualization: true,  // QuickJS lifter supports VM devirtualization
      differentialTesting: true, // Framework supports differential testing
      contractValidation: true,  // Contract validation system available
    },
  };
}