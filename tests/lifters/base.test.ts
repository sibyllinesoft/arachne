/**
 * @fileoverview Comprehensive tests for bytecode lifter base classes and utilities
 * 
 * Tests BytecodeUtils utility functions, base lifter abstract classes,
 * error classes, and core interfaces for the lifter system.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  BYTECODE_FORMATS,
  BytecodeUtils,
  BytecodeLifterError,
  VMDevirtualizationError,
  ValidationError,
  type BytecodeFormat,
  type BytecodeMetadata,
  type LiftResult,
  type ValidationReport,
  type ConstantPool,
  type ConstantPoolEntry,
  type BytecodeFunction,
  type BytecodeModule,
  type VMAnalysis,
  type ValidationIssue,
  type BasicBlock,
  type ControlFlowGraph,
  type BytecodeInstruction,
} from '../../src/lifters/base.js';

describe('BYTECODE_FORMATS', () => {
  it('should define all expected format constants', () => {
    expect(BYTECODE_FORMATS.QUICKJS).toBe('quickjs');
    expect(BYTECODE_FORMATS.V8_IGNITION).toBe('v8-ignition');
    expect(BYTECODE_FORMATS.CUSTOM_VM).toBe('custom-vm');
  });

  it('should have proper type branding', () => {
    // TypeScript branded types - runtime check that they're strings
    expect(typeof BYTECODE_FORMATS.QUICKJS).toBe('string');
    expect(typeof BYTECODE_FORMATS.V8_IGNITION).toBe('string');
    expect(typeof BYTECODE_FORMATS.CUSTOM_VM).toBe('string');
  });

  it('should have unique values', () => {
    const formats = Object.values(BYTECODE_FORMATS);
    const uniqueFormats = [...new Set(formats)];
    expect(formats.length).toBe(uniqueFormats.length);
  });
});

describe('BytecodeUtils', () => {
  describe('detectFormat', () => {
    it('should detect QuickJS format from magic bytes', () => {
      // QuickJS magic: 'qjs\0'
      const quickjsBytecode = new Uint8Array([0x71, 0x6a, 0x73, 0x00, ...new Array(100).fill(0)]);
      
      const format = BytecodeUtils.detectFormat(quickjsBytecode);
      expect(format).toBe(BYTECODE_FORMATS.QUICKJS);
    });

    it('should detect V8 Ignition format from magic bytes', () => {
      // V8 magic pattern
      const v8Bytecode = new Uint8Array([0xc0, 0xde, ...new Array(100).fill(0)]);
      
      const format = BytecodeUtils.detectFormat(v8Bytecode);
      expect(format).toBe(BYTECODE_FORMATS.V8_IGNITION);
    });

    it('should return null for unknown format', () => {
      const unknownBytecode = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]);
      
      const format = BytecodeUtils.detectFormat(unknownBytecode);
      expect(format).toBeNull();
    });

    it('should return null for too-short bytecode', () => {
      const shortBytecode = new Uint8Array([0x71, 0x6a]); // Only 2 bytes
      
      const format = BytecodeUtils.detectFormat(shortBytecode);
      expect(format).toBeNull();
    });

    it('should handle empty bytecode gracefully', () => {
      const emptyBytecode = new Uint8Array(0);
      
      const format = BytecodeUtils.detectFormat(emptyBytecode);
      expect(format).toBeNull();
    });

    it('should handle exact 4-byte bytecode', () => {
      const exactBytecode = new Uint8Array([0x71, 0x6a, 0x73, 0x00]); // Exactly QuickJS magic
      
      const format = BytecodeUtils.detectFormat(exactBytecode);
      expect(format).toBe(BYTECODE_FORMATS.QUICKJS);
    });
  });

  describe('readVarInt', () => {
    it('should read simple single-byte VarInt', () => {
      const data = new Uint8Array([0x42, 0x00, 0x00]); // 0x42 (66) with continuation
      
      const result = BytecodeUtils.readVarInt(data, 0);
      
      expect(result.value).toBe(0x42);
      expect(result.nextOffset).toBe(1);
    });

    it('should read multi-byte VarInt', () => {
      // Encode 300 as VarInt: 300 = 0b100101100 -> [0xAC, 0x02]
      const data = new Uint8Array([0xAC, 0x02, 0x00]);
      
      const result = BytecodeUtils.readVarInt(data, 0);
      
      expect(result.value).toBe(300);
      expect(result.nextOffset).toBe(2);
    });

    it('should read VarInt from specific offset', () => {
      const data = new Uint8Array([0xFF, 0xFF, 0x42, 0x00]);
      
      const result = BytecodeUtils.readVarInt(data, 2);
      
      expect(result.value).toBe(0x42);
      expect(result.nextOffset).toBe(3);
    });

    it('should handle maximum 32-bit VarInt', () => {
      // VarInt encoding: each byte has 7 data bits + 1 continuation bit
      // 0xFF, 0xFF, 0xFF, 0x0F encodes a 28-bit number
      const data = new Uint8Array([0xFF, 0xFF, 0xFF, 0x0F]); 
      
      const result = BytecodeUtils.readVarInt(data, 0);
      
      // VarInt decoding: (0x7F << 0) | (0x7F << 7) | (0x7F << 14) | (0x0F << 21) = 33554431
      expect(result.value).toBe(33554431);
      expect(result.nextOffset).toBe(4);
    });

    it('should throw error for VarInt too long', () => {
      // VarInt that would exceed 32 bits
      const data = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
      
      expect(() => {
        BytecodeUtils.readVarInt(data, 0);
      }).toThrow('VarInt too long');
    });

    it('should handle end-of-data gracefully', () => {
      const data = new Uint8Array([0xFF]); // Incomplete VarInt
      
      const result = BytecodeUtils.readVarInt(data, 0);
      
      // Should stop at end of data
      expect(result.nextOffset).toBe(1);
    });
  });

  describe('readString', () => {
    it('should read simple string with length prefix', () => {
      // String "hello" with length 5
      const helloBytes = new TextEncoder().encode('hello');
      const data = new Uint8Array([0x05, ...helloBytes, 0x00]);
      
      const result = BytecodeUtils.readString(data, 0);
      
      expect(result.value).toBe('hello');
      expect(result.nextOffset).toBe(6);
    });

    it('should read empty string', () => {
      const data = new Uint8Array([0x00, 0xFF]); // Length 0
      
      const result = BytecodeUtils.readString(data, 0);
      
      expect(result.value).toBe('');
      expect(result.nextOffset).toBe(1);
    });

    it('should read UTF-8 string correctly', () => {
      // String "café" in UTF-8
      const cafeBytes = new TextEncoder().encode('café');
      const data = new Uint8Array([cafeBytes.length, ...cafeBytes]);
      
      const result = BytecodeUtils.readString(data, 0);
      
      expect(result.value).toBe('café');
      expect(result.nextOffset).toBe(1 + cafeBytes.length);
    });

    it('should handle string with VarInt length', () => {
      // Long string that needs multi-byte length encoding
      const longString = 'a'.repeat(200);
      const stringBytes = new TextEncoder().encode(longString);
      
      // Manually encode 200 as VarInt: [0xC8, 0x01]
      const data = new Uint8Array([0xC8, 0x01, ...stringBytes]);
      
      const result = BytecodeUtils.readString(data, 0);
      
      expect(result.value).toBe(longString);
      expect(result.nextOffset).toBe(2 + stringBytes.length);
    });

    it('should read string from specific offset', () => {
      const helloBytes = new TextEncoder().encode('test');
      const data = new Uint8Array([0xFF, 0xFF, 0x04, ...helloBytes]);
      
      const result = BytecodeUtils.readString(data, 2);
      
      expect(result.value).toBe('test');
      expect(result.nextOffset).toBe(7);
    });
  });

  describe('getInstructionSize', () => {
    it('should return correct size for QuickJS instructions', () => {
      // Small opcode (< 0x80)
      expect(BytecodeUtils.getInstructionSize(0x10, BYTECODE_FORMATS.QUICKJS)).toBe(1);
      
      // Medium opcode (< 0x8000)
      expect(BytecodeUtils.getInstructionSize(0x100, BYTECODE_FORMATS.QUICKJS)).toBe(2);
      
      // Large opcode
      expect(BytecodeUtils.getInstructionSize(0x10000, BYTECODE_FORMATS.QUICKJS)).toBe(4);
    });

    it('should return correct size for V8 Ignition instructions', () => {
      // Different V8 opcode ranges
      expect(BytecodeUtils.getInstructionSize(0x10, BYTECODE_FORMATS.V8_IGNITION)).toBe(1);
      expect(BytecodeUtils.getInstructionSize(0x85, BYTECODE_FORMATS.V8_IGNITION)).toBe(2);
      expect(BytecodeUtils.getInstructionSize(0x95, BYTECODE_FORMATS.V8_IGNITION)).toBe(3);
      expect(BytecodeUtils.getInstructionSize(0xA5, BYTECODE_FORMATS.V8_IGNITION)).toBe(4);
    });

    it('should return default size for unknown formats', () => {
      const unknownFormat = 'unknown-format' as BytecodeFormat;
      expect(BytecodeUtils.getInstructionSize(0x10, unknownFormat)).toBe(1);
    });

    it('should handle edge case opcodes correctly', () => {
      // Test boundary conditions
      expect(BytecodeUtils.getInstructionSize(0x7F, BYTECODE_FORMATS.QUICKJS)).toBe(1);
      expect(BytecodeUtils.getInstructionSize(0x80, BYTECODE_FORMATS.QUICKJS)).toBe(2);
      expect(BytecodeUtils.getInstructionSize(0x7FFF, BYTECODE_FORMATS.QUICKJS)).toBe(2);
      expect(BytecodeUtils.getInstructionSize(0x8000, BYTECODE_FORMATS.QUICKJS)).toBe(4);
    });
  });

  describe('private QuickJS instruction size helpers', () => {
    it('should categorize QuickJS opcodes correctly', () => {
      // These test the private methods through the public interface
      expect(BytecodeUtils.getInstructionSize(0x50, BYTECODE_FORMATS.QUICKJS)).toBe(1);
      expect(BytecodeUtils.getInstructionSize(0x7F, BYTECODE_FORMATS.QUICKJS)).toBe(1);
      expect(BytecodeUtils.getInstructionSize(0x80, BYTECODE_FORMATS.QUICKJS)).toBe(2);
      expect(BytecodeUtils.getInstructionSize(0x7FFF, BYTECODE_FORMATS.QUICKJS)).toBe(2);
      expect(BytecodeUtils.getInstructionSize(0x8000, BYTECODE_FORMATS.QUICKJS)).toBe(4);
    });
  });

  describe('private V8 Ignition instruction size helpers', () => {
    it('should categorize V8 opcodes correctly', () => {
      // Test V8 opcode masking and categorization
      expect(BytecodeUtils.getInstructionSize(0x7F, BYTECODE_FORMATS.V8_IGNITION)).toBe(1);
      expect(BytecodeUtils.getInstructionSize(0x80, BYTECODE_FORMATS.V8_IGNITION)).toBe(2); // 0x80 -> size 2
      expect(BytecodeUtils.getInstructionSize(0x85, BYTECODE_FORMATS.V8_IGNITION)).toBe(2); // 0x85 -> size 2
      expect(BytecodeUtils.getInstructionSize(0x95, BYTECODE_FORMATS.V8_IGNITION)).toBe(3); // 0x95 -> size 3
      expect(BytecodeUtils.getInstructionSize(0xA5, BYTECODE_FORMATS.V8_IGNITION)).toBe(4); // 0xA5 -> size 4
    });
  });
});

describe('Error classes', () => {
  describe('BytecodeLifterError', () => {
    it('should create error with format and message', () => {
      const format = BYTECODE_FORMATS.QUICKJS;
      const message = 'Test error message';
      
      const error = new BytecodeLifterError(message, format);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('BytecodeLifterError');
      expect(error.message).toBe(message);
      expect(error.format).toBe(format);
      expect(error.cause).toBeUndefined();
    });

    it('should include cause when provided', () => {
      const format = BYTECODE_FORMATS.V8_IGNITION;
      const message = 'Wrapper error';
      const cause = new Error('Original error');
      
      const error = new BytecodeLifterError(message, format, cause);
      
      expect(error.cause).toBe(cause);
    });

    it('should preserve error properties', () => {
      const error = new BytecodeLifterError('test', BYTECODE_FORMATS.QUICKJS);
      
      expect(error.stack).toBeDefined();
      expect(error.toString()).toContain('BytecodeLifterError: test');
    });
  });

  describe('VMDevirtualizationError', () => {
    it('should create error with VM type and confidence', () => {
      const vmType = 'switch-dispatch';
      const confidence = 0.75;
      const message = 'VM devirtualization failed';
      
      const error = new VMDevirtualizationError(message, vmType, confidence);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('VMDevirtualizationError');
      expect(error.message).toBe(message);
      expect(error.vmType).toBe(vmType);
      expect(error.confidence).toBe(confidence);
    });

    it('should include cause when provided', () => {
      const cause = new Error('Original VM error');
      const error = new VMDevirtualizationError('VM error', 'custom', 0.5, cause);
      
      expect(error.cause).toBe(cause);
    });

    it('should handle various VM types', () => {
      const vmTypes = ['switch-dispatch', 'jump-table', 'computed-goto', 'custom', 'unknown'];
      
      vmTypes.forEach(vmType => {
        const error = new VMDevirtualizationError('test', vmType, 0.8);
        expect(error.vmType).toBe(vmType);
      });
    });

    it('should handle confidence edge cases', () => {
      // Test confidence bounds
      const error1 = new VMDevirtualizationError('test', 'custom', 0.0);
      const error2 = new VMDevirtualizationError('test', 'custom', 1.0);
      
      expect(error1.confidence).toBe(0.0);
      expect(error2.confidence).toBe(1.0);
    });
  });

  describe('ValidationError', () => {
    let mockReport: ValidationReport;

    beforeEach(() => {
      mockReport = {
        isValid: false,
        functionMatches: new Map([['func1', true], ['func2', false]]),
        constantMatches: true,
        controlFlowMatches: false,
        issues: [
          {
            type: 'semantic',
            severity: 'high',
            message: 'Semantic issue found',
            location: { function: 'func2', instruction: 10 },
            suggestion: 'Fix the semantic issue',
          }
        ],
        confidence: 0.6,
      };
    });

    it('should create error with validation report', () => {
      const message = 'Validation failed';
      
      const error = new ValidationError(message, mockReport);
      
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe(message);
      expect(error.report).toBe(mockReport);
      expect(error.cause).toBeUndefined();
    });

    it('should include cause when provided', () => {
      const cause = new Error('Original validation error');
      const error = new ValidationError('Validation failed', mockReport, cause);
      
      expect(error.cause).toBe(cause);
    });

    it('should preserve validation report properties', () => {
      const error = new ValidationError('test', mockReport);
      
      expect(error.report.isValid).toBe(false);
      expect(error.report.functionMatches.get('func1')).toBe(true);
      expect(error.report.functionMatches.get('func2')).toBe(false);
      expect(error.report.issues.length).toBe(1);
      expect(error.report.confidence).toBe(0.6);
    });

    it('should handle validation reports with different issue types', () => {
      const issueTypes: Array<ValidationIssue['type']> = ['semantic', 'structural', 'performance', 'warning'];
      const severities: Array<ValidationIssue['severity']> = ['low', 'medium', 'high', 'critical'];
      
      issueTypes.forEach(type => {
        severities.forEach(severity => {
          const report: ValidationReport = {
            isValid: false,
            functionMatches: new Map(),
            constantMatches: true,
            controlFlowMatches: true,
            issues: [{
              type,
              severity,
              message: `${type} ${severity} issue`,
            }],
            confidence: 0.5,
          };
          
          const error = new ValidationError('test', report);
          expect(error.report.issues[0].type).toBe(type);
          expect(error.report.issues[0].severity).toBe(severity);
        });
      });
    });
  });
});

describe('Type interfaces validation', () => {
  describe('LiftResult type', () => {
    it('should handle successful results', () => {
      const successResult: LiftResult<string> = {
        success: true,
        data: 'test data',
        warnings: ['warning 1', 'warning 2'],
      };
      
      expect(successResult.success).toBe(true);
      if (successResult.success) {
        expect(successResult.data).toBe('test data');
        expect(successResult.warnings).toHaveLength(2);
      }
    });

    it('should handle failure results', () => {
      const failureResult: LiftResult<string> = {
        success: false,
        error: 'Operation failed',
        partialData: { partial: 'data' },
        warnings: ['warning during failure'],
      };
      
      expect(failureResult.success).toBe(false);
      if (!failureResult.success) {
        expect(failureResult.error).toBe('Operation failed');
        expect(failureResult.partialData).toEqual({ partial: 'data' });
      }
    });

    it('should handle minimal failure result', () => {
      const minimalFailure: LiftResult<string> = {
        success: false,
        error: 'Simple error',
      };
      
      expect(minimalFailure.success).toBe(false);
      if (!minimalFailure.success) {
        expect(minimalFailure.error).toBe('Simple error');
        expect(minimalFailure.partialData).toBeUndefined();
        expect(minimalFailure.warnings).toBeUndefined();
      }
    });
  });

  describe('BytecodeMetadata interface', () => {
    it('should validate complete metadata structure', () => {
      const metadata: BytecodeMetadata = {
        format: BYTECODE_FORMATS.QUICKJS,
        version: '1.0.0',
        architecture: 'stack',
        endianness: 'little',
        constantPoolSize: 42,
        functionCount: 5,
        hasDebugInfo: true,
        compressionType: 'lz4',
        customVMDetected: false,
        vmPatterns: [],
      };
      
      expect(metadata.format).toBe(BYTECODE_FORMATS.QUICKJS);
      expect(metadata.architecture).toBe('stack');
      expect(metadata.endianness).toBe('little');
      expect(metadata.constantPoolSize).toBe(42);
      expect(metadata.functionCount).toBe(5);
      expect(metadata.hasDebugInfo).toBe(true);
      expect(metadata.compressionType).toBe('lz4');
      expect(metadata.customVMDetected).toBe(false);
    });

    it('should handle minimal metadata', () => {
      const minimalMetadata: BytecodeMetadata = {
        format: BYTECODE_FORMATS.V8_IGNITION,
        version: '0.1.0',
        architecture: 'register',
        endianness: 'big',
        constantPoolSize: 0,
        functionCount: 1,
        hasDebugInfo: false,
        customVMDetected: false,
        vmPatterns: [],
      };
      
      expect(minimalMetadata.compressionType).toBeUndefined();
      expect(minimalMetadata.vmPatterns).toHaveLength(0);
    });
  });

  describe('ConstantPool interface', () => {
    let mockConstantPool: ConstantPool;

    beforeEach(() => {
      const entries: ConstantPoolEntry[] = [
        { index: 0, type: 'string', value: 'hello', size: 5 },
        { index: 1, type: 'number', value: 42.5, size: 8 },
        { index: 2, type: 'boolean', value: true, size: 1 },
        { index: 3, type: 'null', value: null, size: 0 },
      ];

      mockConstantPool = {
        entries: entries,
        totalSize: entries.reduce((sum, entry) => sum + entry.size, 0),
        get: (index: number) => entries[index],
        getString: (index: number) => {
          const entry = entries[index];
          return entry?.type === 'string' ? entry.value as string : undefined;
        },
        getNumber: (index: number) => {
          const entry = entries[index];
          return entry?.type === 'number' ? entry.value as number : undefined;
        },
      };
    });

    it('should provide correct constant pool operations', () => {
      expect(mockConstantPool.entries).toHaveLength(4);
      expect(mockConstantPool.totalSize).toBe(14);
      
      // Test get method
      const stringEntry = mockConstantPool.get(0);
      expect(stringEntry?.type).toBe('string');
      expect(stringEntry?.value).toBe('hello');
      
      // Test getString method
      expect(mockConstantPool.getString(0)).toBe('hello');
      expect(mockConstantPool.getString(1)).toBeUndefined(); // Not a string
      
      // Test getNumber method
      expect(mockConstantPool.getNumber(1)).toBe(42.5);
      expect(mockConstantPool.getNumber(0)).toBeUndefined(); // Not a number
    });

    it('should handle out-of-bounds access gracefully', () => {
      expect(mockConstantPool.get(999)).toBeUndefined();
      expect(mockConstantPool.getString(999)).toBeUndefined();
      expect(mockConstantPool.getNumber(999)).toBeUndefined();
    });

    it('should handle all constant types', () => {
      const types: ConstantPoolEntry['type'][] = [
        'number', 'string', 'boolean', 'null', 'undefined', 'object', 'function'
      ];
      
      types.forEach(type => {
        const entry: ConstantPoolEntry = {
          index: 0,
          type,
          value: type === 'null' ? null : type === 'undefined' ? undefined : `${type}_value`,
          size: 1,
        };
        
        expect(entry.type).toBe(type);
      });
    });
  });

  describe('BytecodeFunction interface', () => {
    it('should validate complete function structure', () => {
      const func: BytecodeFunction = {
        name: 'testFunction',
        startOffset: 100,
        endOffset: 200,
        parameterCount: 3,
        localCount: 5,
        stackDepth: 8,
        hasExceptionHandlers: true,
        isGenerator: false,
        isAsync: true,
        bytecode: new Uint8Array([0x01, 0x02, 0x03]),
        debugInfo: {
          lineNumbers: [1, 2, 3, 4],
          columnNumbers: [0, 5, 10, 15],
          sourceFile: 'test.js',
        },
      };
      
      expect(func.name).toBe('testFunction');
      expect(func.parameterCount).toBe(3);
      expect(func.localCount).toBe(5);
      expect(func.stackDepth).toBe(8);
      expect(func.isAsync).toBe(true);
      expect(func.isGenerator).toBe(false);
      expect(func.debugInfo?.sourceFile).toBe('test.js');
    });

    it('should handle anonymous functions', () => {
      const anonFunc: BytecodeFunction = {
        name: null,
        startOffset: 0,
        endOffset: 50,
        parameterCount: 0,
        localCount: 1,
        stackDepth: 2,
        hasExceptionHandlers: false,
        isGenerator: false,
        isAsync: false,
        bytecode: new Uint8Array([0x42]),
      };
      
      expect(anonFunc.name).toBeNull();
      expect(anonFunc.debugInfo).toBeUndefined();
    });
  });

  describe('BytecodeModule interface', () => {
    it('should validate complete module structure', () => {
      const mockMetadata: BytecodeMetadata = {
        format: BYTECODE_FORMATS.QUICKJS,
        version: '1.0.0',
        architecture: 'stack',
        endianness: 'little',
        constantPoolSize: 10,
        functionCount: 2,
        hasDebugInfo: false,
        customVMDetected: false,
        vmPatterns: [],
      };

      const mockConstants: ConstantPool = {
        entries: [{ index: 0, type: 'string', value: 'test', size: 4 }],
        totalSize: 4,
        get: () => undefined,
        getString: () => undefined,
        getNumber: () => undefined,
      };

      const mockFunctions: BytecodeFunction[] = [
        {
          name: 'main',
          startOffset: 0,
          endOffset: 100,
          parameterCount: 0,
          localCount: 2,
          stackDepth: 4,
          hasExceptionHandlers: false,
          isGenerator: false,
          isAsync: false,
          bytecode: new Uint8Array([0x01, 0x02]),
        }
      ];

      const module: BytecodeModule = {
        metadata: mockMetadata,
        constants: mockConstants,
        functions: mockFunctions,
        entryPointIndex: 0,
        rawBytecode: new Uint8Array([0x71, 0x6a, 0x73, 0x00]),
      };
      
      expect(module.metadata.format).toBe(BYTECODE_FORMATS.QUICKJS);
      expect(module.functions).toHaveLength(1);
      expect(module.entryPointIndex).toBe(0);
      expect(module.rawBytecode).toHaveLength(4);
    });
  });

  describe('VMAnalysis interface', () => {
    it('should validate VM analysis structure', () => {
      const analysis: VMAnalysis = {
        vmType: 'switch-dispatch',
        dispatcherFunctions: [{
          address: 0x1000,
          signature: 'vm_dispatch',
          opcodeCount: 50,
          handlerTable: new Map([[1, 0x2000], [2, 0x3000]]),
          stackEffect: new Map([[1, -1], [2, 0]]),
        }],
        opcodeTable: new Map([[1, 'LOAD'], [2, 'STORE']]),
        virtualRegisters: 8,
        stackDepth: 16,
        hasEncryptedOpcodes: false,
        confidence: 0.85,
        patterns: [],
      };
      
      expect(analysis.vmType).toBe('switch-dispatch');
      expect(analysis.confidence).toBe(0.85);
      expect(analysis.dispatcherFunctions).toHaveLength(1);
      expect(analysis.opcodeTable.get(1)).toBe('LOAD');
    });

    it('should handle all VM types', () => {
      const vmTypes: VMAnalysis['vmType'][] = [
        'switch-dispatch', 'jump-table', 'computed-goto', 'custom', 'unknown'
      ];
      
      vmTypes.forEach(vmType => {
        const analysis: VMAnalysis = {
          vmType,
          dispatcherFunctions: [],
          opcodeTable: new Map(),
          virtualRegisters: 0,
          stackDepth: 0,
          hasEncryptedOpcodes: false,
          confidence: 0.5,
          patterns: [],
        };
        
        expect(analysis.vmType).toBe(vmType);
      });
    });
  });

  describe('BasicBlock and ControlFlowGraph', () => {
    it('should validate basic block structure', () => {
      const mockInstructions: BytecodeInstruction[] = [
        {
          opcode: 0x01,
          operands: [1, 2],
          offset: 0,
          size: 3,
          mnemonic: 'LOAD',
          stackEffect: 1,
          isJump: false,
          jumpTargets: [],
        }
      ];

      const block: BasicBlock = {
        id: 1,
        startOffset: 0,
        endOffset: 10,
        instructions: mockInstructions,
        predecessors: [0],
        successors: [2, 3],
        dominatedBy: [0],
        dominates: [2],
      };
      
      expect(block.id).toBe(1);
      expect(block.instructions).toHaveLength(1);
      expect(block.successors).toEqual([2, 3]);
    });

    it('should validate control flow graph structure', () => {
      const cfg: ControlFlowGraph = {
        basicBlocks: new Map([[1, {} as BasicBlock]]),
        entryBlock: 1,
        exitBlocks: [5],
        edges: new Map([[1, [2, 3]]]),
      };
      
      expect(cfg.entryBlock).toBe(1);
      expect(cfg.exitBlocks).toEqual([5]);
      expect(cfg.edges.get(1)).toEqual([2, 3]);
    });
  });
});