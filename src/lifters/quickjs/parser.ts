/**
 * @fileoverview QuickJS bytecode format parser
 * 
 * Parses .qbc files and extracts bytecode structure, constant pools,
 * function definitions, and debug information.
 */

import { BytecodeUtils } from '../base.js';
import type { 
  BytecodeModule, 
  BytecodeMetadata, 
  BytecodeFunction,
  ConstantPool,
  ConstantPoolEntry,
  LiftResult,
  BytecodeFormat,
} from '../base.js';
import { BYTECODE_FORMATS } from '../base.js';
import { QuickJSOpcode, getInstructionInfo, calculateStackEffect } from './opcodes.js';

/**
 * QuickJS bytecode file structure
 * Based on QuickJS source analysis
 */
interface QuickJSHeader {
  readonly magic: number;        // 'qjs\0' = 0x0073_6a71
  readonly version: number;      // Bytecode version
  readonly flags: number;        // Compilation flags  
  readonly stringCount: number;  // Number of strings in atom table
  readonly objectCount: number;  // Number of objects/functions
}

interface QuickJSAtom {
  readonly index: number;
  readonly value: string;
}

interface QuickJSConstant {
  readonly type: number;
  readonly value: unknown;
  readonly size: number;
}

interface QuickJSObjectDef {
  readonly tag: number;          // Object type tag
  readonly size: number;         // Size in bytes
  readonly data: Uint8Array;     // Object data
}

interface QuickJSFunctionDef {
  readonly flags: number;         // Function flags
  readonly nameAtom: number;      // Name atom index  
  readonly argCount: number;      // Parameter count
  readonly varCount: number;      // Local variable count
  readonly definedArgCount: number; // Defined parameters
  readonly stackSize: number;     // Maximum stack size
  readonly closureVarCount: number; // Closure variables
  readonly cPoolCount: number;    // Constant pool entries
  readonly bytecodeOffset: number; // Offset to bytecode
  readonly bytecodeSize: number;  // Bytecode length
  readonly hasDebugInfo: boolean; // Has debug information
  readonly lineInfoOffset?: number; // Line number info offset
}

/**
 * QuickJS bytecode parser implementation
 */
export class QuickJSParser {
  private data: Uint8Array;
  private offset: number = 0;
  private atoms: QuickJSAtom[] = [];
  private constants: QuickJSConstant[] = [];

  constructor(data: Uint8Array) {
    this.data = data;
  }

  /**
   * Parse complete QuickJS bytecode file
   */
  async parse(): Promise<LiftResult<BytecodeModule>> {
    try {
      this.offset = 0;
      
      // Parse header
      const header = this.parseHeader();
      if (!header) {
        return {
          success: false,
          error: 'Invalid QuickJS bytecode header'
        };
      }

      // Parse atoms table
      const atomsResult = this.parseAtoms(header.stringCount);
      if (!atomsResult.success) {
        return {
          success: false,
          error: (atomsResult as { success: false; error: string }).error,
        };
      }

      // Parse constant pool
      const constantsResult = this.parseConstants();
      if (!constantsResult.success) {
        return {
          success: false,
          error: (constantsResult as { success: false; error: string }).error,
        };
      }

      // Parse object/function definitions
      const functionsResult = this.parseFunctions(header.objectCount);
      if (!functionsResult.success) {
        return {
          success: false,
          error: (functionsResult as { success: false; error: string }).error,
        };
      }

      // Build metadata
      const metadata: BytecodeMetadata = {
        format: BYTECODE_FORMATS.QUICKJS,
        version: header.version.toString(),
        architecture: 'stack',
        endianness: 'little',
        constantPoolSize: this.constants.length,
        functionCount: functionsResult.data.length,
        hasDebugInfo: functionsResult.data.some(f => f.hasExceptionHandlers),
        customVMDetected: false,
        vmPatterns: [],
      };

      // Create constant pool
      const constantPool = new QuickJSConstantPool(this.constants);

      return {
        success: true,
        data: {
          metadata,
          constants: constantPool,
          functions: functionsResult.data,
          entryPointIndex: 0, // Main function is typically first
          rawBytecode: this.data,
        },
        warnings: [],
      };

    } catch (error) {
      return {
        success: false,
        error: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse bytecode header
   */
  private parseHeader(): QuickJSHeader | null {
    if (this.data.length < 20) return null;

    const magic = this.readU32();
    if (magic !== 0x0073_6a71) return null; // 'qjs\0'

    const version = this.readU32();
    const flags = this.readU32();  
    const stringCount = this.readU32();
    const objectCount = this.readU32();

    return {
      magic,
      version,
      flags,
      stringCount,
      objectCount,
    };
  }

  /**
   * Parse atoms table (strings/identifiers)
   */
  private parseAtoms(count: number): LiftResult<QuickJSAtom[]> {
    const atoms: QuickJSAtom[] = [];

    try {
      for (let i = 0; i < count; i++) {
        const length = this.readVarInt();
        const bytes = this.data.slice(this.offset, this.offset + length);
        const value = new TextDecoder('utf-8').decode(bytes);
        this.offset += length;

        atoms.push({
          index: i,
          value,
        });
      }

      this.atoms = atoms;
      return {
        success: true,
        data: atoms,
        warnings: [],
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse atoms: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse constant pool
   */
  private parseConstants(): LiftResult<QuickJSConstant[]> {
    const constants: QuickJSConstant[] = [];

    try {
      // Constants are embedded in function definitions in QuickJS
      // This is a placeholder - real implementation would need to
      // parse each function's constant pool
      
      this.constants = constants;
      return {
        success: true,
        data: constants,
        warnings: ['Constant pool parsing not fully implemented'],
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse constants: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse function definitions  
   */
  private parseFunctions(count: number): LiftResult<BytecodeFunction[]> {
    const functions: BytecodeFunction[] = [];

    try {
      for (let i = 0; i < count; i++) {
        const functionDef = this.parseFunctionDef();
        if (!functionDef) {
          return {
            success: false,
            error: `Failed to parse function ${i}`,
          };
        }

        // Extract bytecode
        const savedOffset = this.offset;
        this.offset = functionDef.bytecodeOffset;
        const bytecode = this.data.slice(this.offset, this.offset + functionDef.bytecodeSize);
        this.offset = savedOffset;

        // Get function name
        const name = functionDef.nameAtom < this.atoms.length ? 
          this.atoms[functionDef.nameAtom].value : null;

        const func: BytecodeFunction = {
          name,
          startOffset: functionDef.bytecodeOffset,
          endOffset: functionDef.bytecodeOffset + functionDef.bytecodeSize,
          parameterCount: functionDef.argCount,
          localCount: functionDef.varCount,
          stackDepth: functionDef.stackSize,
          hasExceptionHandlers: functionDef.hasDebugInfo,
          isGenerator: (functionDef.flags & 0x01) !== 0,
          isAsync: (functionDef.flags & 0x02) !== 0,
          bytecode,
          debugInfo: functionDef.hasDebugInfo ? {
            lineNumbers: [], // Would need to parse line info
          } : undefined,
        };

        functions.push(func);
      }

      return {
        success: true,
        data: functions,
        warnings: [],
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse functions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse single function definition
   */
  private parseFunctionDef(): QuickJSFunctionDef | null {
    try {
      const flags = this.readU32();
      const nameAtom = this.readVarInt();
      const argCount = this.readVarInt();
      const varCount = this.readVarInt();
      const definedArgCount = this.readVarInt();
      const stackSize = this.readVarInt();
      const closureVarCount = this.readVarInt();
      const cPoolCount = this.readVarInt();
      const bytecodeSize = this.readVarInt();
      
      // Current offset is where bytecode starts
      const bytecodeOffset = this.offset;
      
      // Skip bytecode for now
      this.offset += bytecodeSize;
      
      // Check for debug info
      const hasDebugInfo = (flags & 0x80) !== 0;
      let lineInfoOffset: number | undefined;
      
      if (hasDebugInfo) {
        lineInfoOffset = this.offset;
        // Skip debug info - would need full parsing
        const debugSize = this.readVarInt();
        this.offset += debugSize;
      }

      return {
        flags,
        nameAtom,
        argCount,
        varCount,
        definedArgCount,
        stackSize,
        closureVarCount,
        cPoolCount,
        bytecodeOffset,
        bytecodeSize,
        hasDebugInfo,
        lineInfoOffset,
      };

    } catch (error) {
      console.error('Parse function def error:', error);
      return null;
    }
  }

  /**
   * Read 32-bit little-endian integer
   */
  private readU32(): number {
    if (this.offset + 4 > this.data.length) {
      throw new Error('Unexpected end of data');
    }
    
    const value = this.data[this.offset] |
                 (this.data[this.offset + 1] << 8) |
                 (this.data[this.offset + 2] << 16) |
                 (this.data[this.offset + 3] << 24);
    
    this.offset += 4;
    return value >>> 0; // Convert to unsigned
  }

  /**
   * Read variable-length integer
   */
  private readVarInt(): number {
    const result = BytecodeUtils.readVarInt(this.data, this.offset);
    this.offset = result.nextOffset;
    return result.value;
  }

  /**
   * Read string with length prefix
   */
  private readString(): string {
    const result = BytecodeUtils.readString(this.data, this.offset);
    this.offset = result.nextOffset;
    return result.value;
  }
}

/**
 * QuickJS constant pool implementation
 */
class QuickJSConstantPool implements ConstantPool {
  private readonly constantsMap = new Map<number, ConstantPoolEntry>();

  constructor(constants: readonly QuickJSConstant[]) {
    let totalSize = 0;
    
    for (let i = 0; i < constants.length; i++) {
      const constant = constants[i];
      const entry: ConstantPoolEntry = {
        index: i,
        type: this.mapConstantType(constant.type),
        value: constant.value,
        size: constant.size,
      };
      
      this.constantsMap.set(i, entry);
      totalSize += constant.size;
    }
  }

  get entries(): readonly ConstantPoolEntry[] {
    return Array.from(this.constantsMap.values());
  }

  get totalSize(): number {
    return Array.from(this.constantsMap.values())
      .reduce((sum, entry) => sum + entry.size, 0);
  }

  get(index: number): ConstantPoolEntry | undefined {
    return this.constantsMap.get(index);
  }

  getString(index: number): string | undefined {
    const entry = this.get(index);
    return entry?.type === 'string' ? entry.value as string : undefined;
  }

  getNumber(index: number): number | undefined {
    const entry = this.get(index);
    return entry?.type === 'number' ? entry.value as number : undefined;
  }

  private mapConstantType(quickjsType: number): ConstantPoolEntry['type'] {
    // Map QuickJS constant types to our generic types
    switch (quickjsType) {
      case 0: return 'undefined';
      case 1: return 'null';
      case 2: return 'boolean';
      case 3: return 'number';
      case 4: return 'string';
      case 5: return 'object';
      case 6: return 'function';
      default: return 'object';
    }
  }
}

/**
 * Instruction decoder for QuickJS bytecode
 */
export class QuickJSInstructionDecoder {
  /**
   * Decode instruction stream from bytecode
   */
  static decode(bytecode: Uint8Array): Array<{
    opcode: QuickJSOpcode;
    operands: number[];
    offset: number;
    size: number;
  }> {
    const instructions = [];
    let offset = 0;

    while (offset < bytecode.length) {
      const opcode = bytecode[offset] as QuickJSOpcode;
      const info = getInstructionInfo(opcode);
      
      if (!info) {
        // Unknown opcode - skip
        offset++;
        continue;
      }

      const operands: number[] = [];
      let instructionSize = 1; // Base size for opcode

      // Decode operands based on instruction info
      for (let i = 0; i < info.operandCount; i++) {
        const operandType = info.operandTypes[i];
        
        switch (operandType) {
          case 'immediate':
          case 'const_pool':
          case 'local_var':
          case 'atom':
          case 'count': {
            // Most operands are variable-length integers
            const result = BytecodeUtils.readVarInt(bytecode, offset + instructionSize);
            operands.push(result.value);
            instructionSize = result.nextOffset - offset;
            break;
          }
          
          case 'offset': {
            // Jump offsets are signed integers
            const result = BytecodeUtils.readVarInt(bytecode, offset + instructionSize);
            const signedOffset = result.value;
            // Convert to signed if needed (implementation detail)
            operands.push(signedOffset);
            instructionSize = result.nextOffset - offset;
            break;
          }
        }
      }

      instructions.push({
        opcode,
        operands,
        offset,
        size: instructionSize,
      });

      offset += instructionSize;
    }

    return instructions;
  }
}