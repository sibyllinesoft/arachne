/**
 * @fileoverview V8 Ignition bytecode opcodes and instruction definitions
 * 
 * Defines V8 Ignition opcodes for bytecode parsing and conversion.
 * Based on V8 version 12.x Ignition architecture (register-based VM).
 * 
 * References:
 * - V8 Ignition design document
 * - Bytecode definitions from V8 source (bytecodes.h)
 * - Register allocation and calling conventions
 */

/**
 * V8 Ignition operand types
 */
export enum V8OperandType {
  // Registers
  kRegister = 'reg',
  kRegisterList = 'reg_list',
  kRegisterPair = 'reg_pair',
  
  // Immediate values
  kImmediate = 'imm',
  kUnsignedImmediate = 'uimm',
  kIndex = 'idx',
  kSlot = 'slot',
  
  // Runtime values
  kConstantPoolIndex = 'const_idx',
  kNativeContextIndex = 'native_ctx_idx',
  kIntrinsicIndex = 'intrinsic_idx',
  
  // Control flow
  kJumpTableSize = 'jtbl_size',
  kJumpOffset = 'jmp_offset',
  
  // Flags and counts
  kFlag = 'flag',
  kCount = 'count',
  
  // No operand
  kNone = 'none',
}

/**
 * V8 Ignition operand scale
 */
export enum V8OperandScale {
  kSingle = 1,
  kDouble = 2,
  kQuadruple = 4,
}

/**
 * V8 Ignition operand definition
 */
export interface V8Operand {
  readonly type: V8OperandType;
  readonly scale: V8OperandScale;
  readonly description: string;
}

/**
 * V8 Ignition opcode definition with semantic information
 */
export interface V8Opcode {
  readonly name: string;
  readonly code: number;
  readonly operands: readonly V8Operand[];
  readonly stackEffect: number; // Net stack effect (positive = push, negative = pop)
  readonly accumulatorUse: 'read' | 'write' | 'readwrite' | 'none';
  readonly description: string;
  readonly category: V8OpcodeCategory;
  readonly hasVariableOperands: boolean;
}

/**
 * V8 Ignition opcode categories for analysis
 */
export enum V8OpcodeCategory {
  // Literal and constant loading
  LoadConstant = 'load_constant',
  LoadGlobal = 'load_global',
  
  // Register operations
  Move = 'move',
  LoadAccumulator = 'load_acc',
  StoreAccumulator = 'store_acc',
  
  // Arithmetic and logical operations
  Arithmetic = 'arithmetic',
  Bitwise = 'bitwise',
  Comparison = 'comparison',
  
  // Property access
  PropertyAccess = 'property_access',
  ElementAccess = 'element_access',
  
  // Function calls and returns
  Call = 'call',
  Return = 'return',
  
  // Control flow
  Jump = 'jump',
  ConditionalJump = 'conditional_jump',
  Switch = 'switch',
  
  // Exception handling
  Throw = 'throw',
  Try = 'try',
  
  // Context and scope
  Context = 'context',
  Closure = 'closure',
  
  // Debugging and profiling
  Debug = 'debug',
  Profile = 'profile',
  
  // Stack management
  Stack = 'stack',
  
  // Other/Misc
  Misc = 'misc',
}

/**
 * Helper function to create operand definitions
 */
function operand(
  type: V8OperandType, 
  scale: V8OperandScale = V8OperandScale.kSingle,
  description = ''
): V8Operand {
  return { type, scale, description };
}

/**
 * V8 Ignition opcodes definition (subset of commonly used opcodes)
 * 
 * Note: This is a representative subset. Full V8 has 200+ opcodes.
 * Opcodes are organized by functionality and semantic meaning.
 */
export const V8_OPCODES: ReadonlyMap<number, V8Opcode> = new Map([
  // === Literal and Constant Loading ===
  [0x00, {
    name: 'LdaZero',
    code: 0x00,
    operands: [],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load zero into accumulator',
    category: V8OpcodeCategory.LoadConstant,
    hasVariableOperands: false,
  }],
  
  [0x01, {
    name: 'LdaSmi',
    code: 0x01,
    operands: [operand(V8OperandType.kImmediate, V8OperandScale.kSingle, 'small integer')],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load small integer into accumulator',
    category: V8OpcodeCategory.LoadConstant,
    hasVariableOperands: false,
  }],
  
  [0x02, {
    name: 'LdaConstant',
    code: 0x02,
    operands: [operand(V8OperandType.kConstantPoolIndex, V8OperandScale.kSingle, 'constant index')],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load constant from pool into accumulator',
    category: V8OpcodeCategory.LoadConstant,
    hasVariableOperands: false,
  }],
  
  [0x03, {
    name: 'LdaUndefined',
    code: 0x03,
    operands: [],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load undefined into accumulator',
    category: V8OpcodeCategory.LoadConstant,
    hasVariableOperands: false,
  }],
  
  [0x04, {
    name: 'LdaNull',
    code: 0x04,
    operands: [],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load null into accumulator',
    category: V8OpcodeCategory.LoadConstant,
    hasVariableOperands: false,
  }],
  
  [0x05, {
    name: 'LdaTheHole',
    code: 0x05,
    operands: [],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load the hole value into accumulator',
    category: V8OpcodeCategory.LoadConstant,
    hasVariableOperands: false,
  }],
  
  [0x06, {
    name: 'LdaTrue',
    code: 0x06,
    operands: [],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load true into accumulator',
    category: V8OpcodeCategory.LoadConstant,
    hasVariableOperands: false,
  }],
  
  [0x07, {
    name: 'LdaFalse',
    code: 0x07,
    operands: [],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load false into accumulator',
    category: V8OpcodeCategory.LoadConstant,
    hasVariableOperands: false,
  }],
  
  // === Register Operations ===
  [0x08, {
    name: 'Ldar',
    code: 0x08,
    operands: [operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'source register')],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load register into accumulator',
    category: V8OpcodeCategory.LoadAccumulator,
    hasVariableOperands: false,
  }],
  
  [0x09, {
    name: 'Star',
    code: 0x09,
    operands: [operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'destination register')],
    stackEffect: 0,
    accumulatorUse: 'read',
    description: 'Store accumulator into register',
    category: V8OpcodeCategory.StoreAccumulator,
    hasVariableOperands: false,
  }],
  
  [0x0A, {
    name: 'Mov',
    code: 0x0A,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'source register'),
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'destination register'),
    ],
    stackEffect: 0,
    accumulatorUse: 'none',
    description: 'Move value from one register to another',
    category: V8OpcodeCategory.Move,
    hasVariableOperands: false,
  }],
  
  // === Arithmetic Operations ===
  [0x29, {
    name: 'Add',
    code: 0x29,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'right operand register'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'readwrite',
    description: 'Add register to accumulator',
    category: V8OpcodeCategory.Arithmetic,
    hasVariableOperands: false,
  }],
  
  [0x2A, {
    name: 'Sub',
    code: 0x2A,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'right operand register'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'readwrite',
    description: 'Subtract register from accumulator',
    category: V8OpcodeCategory.Arithmetic,
    hasVariableOperands: false,
  }],
  
  [0x2B, {
    name: 'Mul',
    code: 0x2B,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'right operand register'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'readwrite',
    description: 'Multiply accumulator by register',
    category: V8OpcodeCategory.Arithmetic,
    hasVariableOperands: false,
  }],
  
  [0x2C, {
    name: 'Div',
    code: 0x2C,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'right operand register'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'readwrite',
    description: 'Divide accumulator by register',
    category: V8OpcodeCategory.Arithmetic,
    hasVariableOperands: false,
  }],
  
  // === Comparison Operations ===
  [0x46, {
    name: 'TestEqual',
    code: 0x46,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'register to compare'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'readwrite',
    description: 'Test if accumulator equals register',
    category: V8OpcodeCategory.Comparison,
    hasVariableOperands: false,
  }],
  
  [0x47, {
    name: 'TestEqualStrict',
    code: 0x47,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'register to compare'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'readwrite',
    description: 'Test if accumulator strictly equals register',
    category: V8OpcodeCategory.Comparison,
    hasVariableOperands: false,
  }],
  
  [0x48, {
    name: 'TestLessThan',
    code: 0x48,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'register to compare'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'readwrite',
    description: 'Test if accumulator is less than register',
    category: V8OpcodeCategory.Comparison,
    hasVariableOperands: false,
  }],
  
  // === Property Access ===
  [0x28, {
    name: 'LdaNamedProperty',
    code: 0x28,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'object register'),
      operand(V8OperandType.kConstantPoolIndex, V8OperandScale.kSingle, 'property name'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load named property into accumulator',
    category: V8OpcodeCategory.PropertyAccess,
    hasVariableOperands: false,
  }],
  
  [0x5C, {
    name: 'StaNamedProperty',
    code: 0x5C,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'object register'),
      operand(V8OperandType.kConstantPoolIndex, V8OperandScale.kSingle, 'property name'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'read',
    description: 'Store accumulator into named property',
    category: V8OpcodeCategory.PropertyAccess,
    hasVariableOperands: false,
  }],
  
  // === Function Calls ===
  [0x5F, {
    name: 'Call',
    code: 0x5F,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'function register'),
      operand(V8OperandType.kRegisterList, V8OperandScale.kSingle, 'argument registers'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Call function with arguments',
    category: V8OpcodeCategory.Call,
    hasVariableOperands: true,
  }],
  
  [0x60, {
    name: 'CallWithSpread',
    code: 0x60,
    operands: [
      operand(V8OperandType.kRegister, V8OperandScale.kSingle, 'function register'),
      operand(V8OperandType.kRegisterList, V8OperandScale.kSingle, 'argument registers'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Call function with spread arguments',
    category: V8OpcodeCategory.Call,
    hasVariableOperands: true,
  }],
  
  // === Control Flow ===
  [0x89, {
    name: 'Jump',
    code: 0x89,
    operands: [operand(V8OperandType.kJumpOffset, V8OperandScale.kSingle, 'jump offset')],
    stackEffect: 0,
    accumulatorUse: 'none',
    description: 'Unconditional jump',
    category: V8OpcodeCategory.Jump,
    hasVariableOperands: false,
  }],
  
  [0x8A, {
    name: 'JumpIfTrue',
    code: 0x8A,
    operands: [operand(V8OperandType.kJumpOffset, V8OperandScale.kSingle, 'jump offset')],
    stackEffect: 0,
    accumulatorUse: 'read',
    description: 'Jump if accumulator is true',
    category: V8OpcodeCategory.ConditionalJump,
    hasVariableOperands: false,
  }],
  
  [0x8B, {
    name: 'JumpIfFalse',
    code: 0x8B,
    operands: [operand(V8OperandType.kJumpOffset, V8OperandScale.kSingle, 'jump offset')],
    stackEffect: 0,
    accumulatorUse: 'read',
    description: 'Jump if accumulator is false',
    category: V8OpcodeCategory.ConditionalJump,
    hasVariableOperands: false,
  }],
  
  [0x8C, {
    name: 'JumpIfToBooleanTrue',
    code: 0x8C,
    operands: [operand(V8OperandType.kJumpOffset, V8OperandScale.kSingle, 'jump offset')],
    stackEffect: 0,
    accumulatorUse: 'read',
    description: 'Jump if accumulator converts to true',
    category: V8OpcodeCategory.ConditionalJump,
    hasVariableOperands: false,
  }],
  
  // === Returns ===
  [0xA7, {
    name: 'Return',
    code: 0xA7,
    operands: [],
    stackEffect: 0,
    accumulatorUse: 'read',
    description: 'Return accumulator value',
    category: V8OpcodeCategory.Return,
    hasVariableOperands: false,
  }],
  
  // === Context and Global Operations ===
  [0x0B, {
    name: 'LdaGlobal',
    code: 0x0B,
    operands: [
      operand(V8OperandType.kConstantPoolIndex, V8OperandScale.kSingle, 'global name'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'write',
    description: 'Load global variable into accumulator',
    category: V8OpcodeCategory.LoadGlobal,
    hasVariableOperands: false,
  }],
  
  [0x0C, {
    name: 'StaGlobal',
    code: 0x0C,
    operands: [
      operand(V8OperandType.kConstantPoolIndex, V8OperandScale.kSingle, 'global name'),
      operand(V8OperandType.kSlot, V8OperandScale.kSingle, 'feedback slot'),
    ],
    stackEffect: 0,
    accumulatorUse: 'read',
    description: 'Store accumulator into global variable',
    category: V8OpcodeCategory.LoadGlobal,
    hasVariableOperands: false,
  }],
]);

/**
 * V8 Ignition opcode lookup functions
 */
export class V8OpcodeUtils {
  /**
   * Get opcode definition by code
   */
  static getOpcode(code: number): V8Opcode | undefined {
    return V8_OPCODES.get(code);
  }
  
  /**
   * Get opcode definition by name
   */
  static getOpcodeByName(name: string): V8Opcode | undefined {
    for (const opcode of V8_OPCODES.values()) {
      if (opcode.name === name) {
        return opcode;
      }
    }
    return undefined;
  }
  
  /**
   * Get all opcodes in a category
   */
  static getOpcodesByCategory(category: V8OpcodeCategory): V8Opcode[] {
    return Array.from(V8_OPCODES.values()).filter(op => op.category === category);
  }
  
  /**
   * Check if opcode uses accumulator
   */
  static usesAccumulator(opcode: V8Opcode): boolean {
    return opcode.accumulatorUse !== 'none';
  }
  
  /**
   * Check if opcode reads accumulator
   */
  static readsAccumulator(opcode: V8Opcode): boolean {
    return opcode.accumulatorUse === 'read' || opcode.accumulatorUse === 'readwrite';
  }
  
  /**
   * Check if opcode writes accumulator
   */
  static writesAccumulator(opcode: V8Opcode): boolean {
    return opcode.accumulatorUse === 'write' || opcode.accumulatorUse === 'readwrite';
  }
  
  /**
   * Check if opcode has control flow effects
   */
  static isControlFlow(opcode: V8Opcode): boolean {
    return opcode.category === V8OpcodeCategory.Jump ||
           opcode.category === V8OpcodeCategory.ConditionalJump ||
           opcode.category === V8OpcodeCategory.Switch ||
           opcode.category === V8OpcodeCategory.Return ||
           opcode.category === V8OpcodeCategory.Throw;
  }
  
  /**
   * Check if opcode can throw exceptions
   */
  static canThrow(opcode: V8Opcode): boolean {
    return opcode.category === V8OpcodeCategory.Call ||
           opcode.category === V8OpcodeCategory.PropertyAccess ||
           opcode.category === V8OpcodeCategory.ElementAccess ||
           opcode.category === V8OpcodeCategory.Arithmetic ||
           opcode.category === V8OpcodeCategory.Throw;
  }
  
  /**
   * Get human-readable opcode summary
   */
  static getOpcodeSummary(): string {
    const categories = new Map<V8OpcodeCategory, number>();
    
    for (const opcode of V8_OPCODES.values()) {
      const count = categories.get(opcode.category) || 0;
      categories.set(opcode.category, count + 1);
    }
    
    const lines = [`V8 Ignition Opcodes (${V8_OPCODES.size} total):`];
    for (const [category, count] of categories.entries()) {
      lines.push(`  ${category}: ${count} opcodes`);
    }
    
    return lines.join('\n');
  }
}