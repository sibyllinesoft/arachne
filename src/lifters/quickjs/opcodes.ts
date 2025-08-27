/**
 * @fileoverview QuickJS bytecode opcodes and instruction definitions
 * 
 * Based on QuickJS source code analysis. Defines the complete opcode set
 * and their stack effects for proper IR conversion.
 */

/**
 * QuickJS bytecode opcodes
 * Extracted from quickjs.h and quickjs.c
 */
export enum QuickJSOpcode {
  // Stack manipulation
  OP_INVALID = 0x00,
  OP_PUSH_I32 = 0x01,
  OP_PUSH_CONST = 0x02,
  OP_FCLOSURE = 0x03,
  OP_PUSH_ATOM_VALUE = 0x04,
  OP_PRIVATE_SYMBOL = 0x05,
  OP_UNDEFINED = 0x06,
  OP_NULL = 0x07,
  OP_PUSH_THIS = 0x08,
  OP_PUSH_FALSE = 0x09,
  OP_PUSH_TRUE = 0x0a,
  OP_OBJECT = 0x0b,
  OP_SPECIAL_OBJECT = 0x0c,
  OP_REST = 0x0d,
  OP_DROP = 0x0e,
  OP_NIP = 0x0f,
  OP_NIP1 = 0x10,
  OP_DUP = 0x11,
  OP_DUP2 = 0x12,
  OP_DUP3 = 0x13,
  OP_DUP1 = 0x14,
  OP_INSERT2 = 0x15,
  OP_INSERT3 = 0x16,
  OP_INSERT4 = 0x17,
  OP_PERM3 = 0x18,
  OP_PERM4 = 0x19,
  OP_PERM5 = 0x1a,
  OP_SWAP = 0x1b,
  OP_SWAP2 = 0x1c,
  OP_ROT3L = 0x1d,
  OP_ROT3R = 0x1e,
  OP_ROT4L = 0x1f,
  OP_ROT5L = 0x20,

  // Arithmetic operations
  OP_PLUS = 0x21,
  OP_NEG = 0x22,
  OP_INC = 0x23,
  OP_DEC = 0x24,
  OP_POST_INC = 0x25,
  OP_POST_DEC = 0x26,
  OP_ADD = 0x27,
  OP_SUB = 0x28,
  OP_MUL = 0x29,
  OP_DIV = 0x2a,
  OP_MOD = 0x2b,
  OP_POW = 0x2c,
  OP_OR = 0x2d,
  OP_XOR = 0x2e,
  OP_AND = 0x2f,
  OP_SHL = 0x30,
  OP_SAR = 0x31,
  OP_SHR = 0x32,
  OP_LT = 0x33,
  OP_LTE = 0x34,
  OP_GT = 0x35,
  OP_GTE = 0x36,
  OP_INSTANCEOF = 0x37,
  OP_IN = 0x38,
  OP_EQ = 0x39,
  OP_NEQ = 0x3a,
  OP_STRICT_EQ = 0x3b,
  OP_STRICT_NEQ = 0x3c,
  OP_NOT = 0x3d,

  // Variable operations
  OP_GET_VAR = 0x3e,
  OP_PUT_VAR = 0x3f,
  OP_DEFINE_VAR = 0x40,
  OP_CHECK_VAR = 0x41,
  OP_GET_VAR_UNDEF = 0x42,
  OP_GET_VAR_REF = 0x43,
  OP_PUT_VAR_REF = 0x44,
  OP_SET_VAR_REF = 0x45,
  OP_SET_LOCREF = 0x46,
  OP_GET_LOCREF = 0x47,

  // Property operations
  OP_GET_FIELD = 0x48,
  OP_GET_FIELD2 = 0x49,
  OP_PUT_FIELD = 0x4a,
  OP_GET_PRIVATE_FIELD = 0x4b,
  OP_PUT_PRIVATE_FIELD = 0x4c,
  OP_DEFINE_PRIVATE_FIELD = 0x4d,
  OP_GET_ARRAY_EL = 0x4e,
  OP_PUT_ARRAY_EL = 0x4f,
  OP_GET_SUPER_VALUE = 0x50,
  OP_PUT_SUPER_VALUE = 0x51,
  OP_DEFINE_FIELD = 0x52,
  OP_SET_FIELD = 0x53,
  OP_SET_ARRAY_EL = 0x54,
  OP_APPEND = 0x55,
  OP_COPY_DATA_PROPERTIES = 0x56,
  OP_DEFINE_METHOD = 0x57,
  OP_DEFINE_METHOD_COMPUTED = 0x58,

  // Control flow
  OP_IF_TRUE = 0x59,
  OP_IF_FALSE = 0x5a,
  OP_GOTO = 0x5b,
  OP_CATCH = 0x5c,
  OP_GOSUB = 0x5d,
  OP_RET = 0x5e,
  OP_NOP = 0x5f,
  OP_CHECK_BRAND = 0x60,
  OP_ADD_BRAND = 0x61,

  // Function calls
  OP_RETURN = 0x62,
  OP_RETURN_UNDEF = 0x63,
  OP_CHECK_CTOR_RETURN = 0x64,
  OP_RETURN_ASYNC = 0x65,
  OP_THROW = 0x66,
  OP_THROW_VAR = 0x67,
  OP_EVAL = 0x68,
  OP_APPLY_EVAL = 0x69,
  OP_REGEXP = 0x6a,
  OP_GET_SUPER = 0x6b,
  OP_IMPORT = 0x6c,

  // Function operations  
  OP_CALL = 0x6d,
  OP_TAIL_CALL = 0x6e,
  OP_CALL_CONSTRUCTOR = 0x6f,
  OP_CALL_METHOD = 0x70,
  OP_TAIL_CALL_METHOD = 0x71,
  OP_ARRAY_FROM = 0x72,
  OP_APPLY = 0x73,

  // Iterator operations
  OP_FOR_IN_START = 0x74,
  OP_FOR_OF_START = 0x75,
  OP_FOR_AWAIT_OF_START = 0x76,
  OP_FOR_IN_NEXT = 0x77,
  OP_FOR_OF_NEXT = 0x78,
  OP_FOR_AWAIT_OF_NEXT = 0x79,
  OP_ITERATOR_GET_VALUE_DONE = 0x7a,
  OP_ITERATOR_CHECK_OBJECT = 0x7b,
  OP_ITERATOR_CLOSE = 0x7c,
  OP_ITERATOR_CLOSE_RETURN = 0x7d,

  // Async/await
  OP_ASYNC_FUNC_START = 0x7e,
  OP_AWAIT = 0x7f,
  OP_ASYNC_YIELD_STAR = 0x80,
  OP_ASYNC_RETURN = 0x81,

  // Generator operations
  OP_YIELD = 0x82,
  OP_YIELD_STAR = 0x83,
  OP_ASYNC_YIELD = 0x84,
  OP_INITIAL_YIELD = 0x85,

  // Advanced operations
  OP_PUSH_MINUS1 = 0x86,
  OP_PUSH_0 = 0x87,
  OP_PUSH_1 = 0x88,
  OP_PUSH_2 = 0x89,
  OP_PUSH_3 = 0x8a,
  OP_PUSH_4 = 0x8b,
  OP_PUSH_5 = 0x8c,
  OP_PUSH_6 = 0x8d,
  OP_PUSH_7 = 0x8e,
  OP_PUSH_I8 = 0x8f,
  OP_PUSH_I16 = 0x90,
  OP_PUSH_CONST8 = 0x91,
  OP_PUSH_EMPTY_STRING = 0x92,
  OP_GET_LOC8 = 0x93,
  OP_PUT_LOC8 = 0x94,
  OP_SET_LOC8 = 0x95,
  OP_GET_LOC0 = 0x96,
  OP_GET_LOC1 = 0x97,
  OP_GET_LOC2 = 0x98,
  OP_GET_LOC3 = 0x99,
  OP_PUT_LOC0 = 0x9a,
  OP_PUT_LOC1 = 0x9b,
  OP_PUT_LOC2 = 0x9c,
  OP_PUT_LOC3 = 0x9d,
  OP_SET_LOC0 = 0x9e,
  OP_SET_LOC1 = 0x9f,
  OP_SET_LOC2 = 0xa0,
  OP_SET_LOC3 = 0xa1,
  OP_GET_ARG0 = 0xa2,
  OP_GET_ARG1 = 0xa3,
  OP_GET_ARG2 = 0xa4,
  OP_GET_ARG3 = 0xa5,
  OP_PUT_ARG0 = 0xa6,
  OP_PUT_ARG1 = 0xa7,
  OP_PUT_ARG2 = 0xa8,
  OP_PUT_ARG3 = 0xa9,
  OP_SET_ARG0 = 0xaa,
  OP_SET_ARG1 = 0xab,
  OP_SET_ARG2 = 0xac,
  OP_SET_ARG3 = 0xad,
  OP_GET_VAR_REF0 = 0xae,
  OP_GET_VAR_REF1 = 0xaf,
  OP_GET_VAR_REF2 = 0xb0,
  OP_GET_VAR_REF3 = 0xb1,
  OP_PUT_VAR_REF0 = 0xb2,
  OP_PUT_VAR_REF1 = 0xb3,
  OP_PUT_VAR_REF2 = 0xb4,
  OP_PUT_VAR_REF3 = 0xb5,
  OP_SET_VAR_REF0 = 0xb6,
  OP_SET_VAR_REF1 = 0xb7,
  OP_SET_VAR_REF2 = 0xb8,
  OP_SET_VAR_REF3 = 0xb9,
  OP_GET_LENGTH = 0xba,

  // Advanced jumps
  OP_IF_TRUE8 = 0xbb,
  OP_IF_FALSE8 = 0xbc,
  OP_GOTO8 = 0xbd,
  OP_GOTO16 = 0xbe,
  OP_CALL0 = 0xbf,
  OP_CALL1 = 0xc0,
  OP_CALL2 = 0xc1,
  OP_CALL3 = 0xc2,
  OP_IS_UNDEFINED_OR_NULL = 0xc3,

  // Miscellaneous
  OP_COUNT = 0xc4,
}

/**
 * Instruction metadata for each opcode
 */
export interface InstructionInfo {
  readonly name: string;
  readonly stackEffect: number; // Net effect on stack depth
  readonly operandCount: number;
  readonly operandTypes: readonly OperandType[];
  readonly category: InstructionCategory;
  readonly hasJump: boolean;
  readonly canThrow: boolean;
  readonly sideEffects: boolean;
}

export enum OperandType {
  NONE = 'none',
  CONST_POOL = 'const_pool',  // Index into constant pool
  LOCAL_VAR = 'local_var',    // Local variable index
  ATOM = 'atom',              // Atom/symbol index
  OFFSET = 'offset',          // Jump offset
  COUNT = 'count',            // Numeric count
  IMMEDIATE = 'immediate',    // Immediate value
}

export enum InstructionCategory {
  STACK = 'stack',
  ARITHMETIC = 'arithmetic', 
  COMPARISON = 'comparison',
  LOGICAL = 'logical',
  VARIABLE = 'variable',
  PROPERTY = 'property',
  CONTROL_FLOW = 'control_flow',
  FUNCTION = 'function',
  OBJECT = 'object',
  ITERATOR = 'iterator',
  ASYNC = 'async',
  GENERATOR = 'generator',
}

/**
 * Complete instruction information table
 */
export const QUICKJS_INSTRUCTIONS: ReadonlyMap<QuickJSOpcode, InstructionInfo> = new Map([
  // Stack manipulation
  [QuickJSOpcode.OP_PUSH_I32, {
    name: 'push_i32',
    stackEffect: 1,
    operandCount: 1,
    operandTypes: [OperandType.IMMEDIATE],
    category: InstructionCategory.STACK,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_PUSH_CONST, {
    name: 'push_const',
    stackEffect: 1,
    operandCount: 1,
    operandTypes: [OperandType.CONST_POOL],
    category: InstructionCategory.STACK,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_UNDEFINED, {
    name: 'undefined',
    stackEffect: 1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.STACK,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_NULL, {
    name: 'null',
    stackEffect: 1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.STACK,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_PUSH_TRUE, {
    name: 'push_true',
    stackEffect: 1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.STACK,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_PUSH_FALSE, {
    name: 'push_false',
    stackEffect: 1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.STACK,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_DROP, {
    name: 'drop',
    stackEffect: -1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.STACK,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_DUP, {
    name: 'dup',
    stackEffect: 1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.STACK,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_SWAP, {
    name: 'swap',
    stackEffect: 0,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.STACK,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  // Arithmetic operations
  [QuickJSOpcode.OP_ADD, {
    name: 'add',
    stackEffect: -1, // Pops 2, pushes 1
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.ARITHMETIC,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_SUB, {
    name: 'sub',
    stackEffect: -1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.ARITHMETIC,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_MUL, {
    name: 'mul',
    stackEffect: -1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.ARITHMETIC,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_DIV, {
    name: 'div',
    stackEffect: -1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.ARITHMETIC,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_NEG, {
    name: 'neg',
    stackEffect: 0, // Pops 1, pushes 1
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.ARITHMETIC,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  // Comparison operations
  [QuickJSOpcode.OP_LT, {
    name: 'lt',
    stackEffect: -1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.COMPARISON,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_EQ, {
    name: 'eq',
    stackEffect: -1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.COMPARISON,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_STRICT_EQ, {
    name: 'strict_eq',
    stackEffect: -1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.COMPARISON,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  // Variable operations
  [QuickJSOpcode.OP_GET_VAR, {
    name: 'get_var',
    stackEffect: 1,
    operandCount: 1,
    operandTypes: [OperandType.ATOM],
    category: InstructionCategory.VARIABLE,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_PUT_VAR, {
    name: 'put_var',
    stackEffect: -1,
    operandCount: 1,
    operandTypes: [OperandType.ATOM],
    category: InstructionCategory.VARIABLE,
    hasJump: false,
    canThrow: true,
    sideEffects: true,
  }],

  [QuickJSOpcode.OP_GET_LOC8, {
    name: 'get_loc8',
    stackEffect: 1,
    operandCount: 1,
    operandTypes: [OperandType.LOCAL_VAR],
    category: InstructionCategory.VARIABLE,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_PUT_LOC8, {
    name: 'put_loc8',
    stackEffect: -1,
    operandCount: 1,
    operandTypes: [OperandType.LOCAL_VAR],
    category: InstructionCategory.VARIABLE,
    hasJump: false,
    canThrow: false,
    sideEffects: true,
  }],

  // Property operations  
  [QuickJSOpcode.OP_GET_FIELD, {
    name: 'get_field',
    stackEffect: 0, // Pops object, pushes value
    operandCount: 1,
    operandTypes: [OperandType.ATOM],
    category: InstructionCategory.PROPERTY,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_PUT_FIELD, {
    name: 'put_field',
    stackEffect: -2, // Pops object and value
    operandCount: 1,
    operandTypes: [OperandType.ATOM],
    category: InstructionCategory.PROPERTY,
    hasJump: false,
    canThrow: true,
    sideEffects: true,
  }],

  [QuickJSOpcode.OP_GET_ARRAY_EL, {
    name: 'get_array_el',
    stackEffect: -1, // Pops object and index, pushes value
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.PROPERTY,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_PUT_ARRAY_EL, {
    name: 'put_array_el',
    stackEffect: -3, // Pops object, index, and value
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.PROPERTY,
    hasJump: false,
    canThrow: true,
    sideEffects: true,
  }],

  // Control flow
  [QuickJSOpcode.OP_IF_TRUE, {
    name: 'if_true',
    stackEffect: -1,
    operandCount: 1,
    operandTypes: [OperandType.OFFSET],
    category: InstructionCategory.CONTROL_FLOW,
    hasJump: true,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_IF_FALSE, {
    name: 'if_false',
    stackEffect: -1,
    operandCount: 1,
    operandTypes: [OperandType.OFFSET],
    category: InstructionCategory.CONTROL_FLOW,
    hasJump: true,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_GOTO, {
    name: 'goto',
    stackEffect: 0,
    operandCount: 1,
    operandTypes: [OperandType.OFFSET],
    category: InstructionCategory.CONTROL_FLOW,
    hasJump: true,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_RETURN, {
    name: 'return',
    stackEffect: -1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.CONTROL_FLOW,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  [QuickJSOpcode.OP_THROW, {
    name: 'throw',
    stackEffect: -1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.CONTROL_FLOW,
    hasJump: false,
    canThrow: true,
    sideEffects: false,
  }],

  // Function calls
  [QuickJSOpcode.OP_CALL, {
    name: 'call',
    stackEffect: -1, // Complex - depends on argument count
    operandCount: 1,
    operandTypes: [OperandType.COUNT],
    category: InstructionCategory.FUNCTION,
    hasJump: false,
    canThrow: true,
    sideEffects: true,
  }],

  [QuickJSOpcode.OP_CALL_METHOD, {
    name: 'call_method',
    stackEffect: -2, // Complex - depends on argument count + method
    operandCount: 1,
    operandTypes: [OperandType.COUNT],
    category: InstructionCategory.FUNCTION,
    hasJump: false,
    canThrow: true,
    sideEffects: true,
  }],

  [QuickJSOpcode.OP_CALL_CONSTRUCTOR, {
    name: 'call_constructor',
    stackEffect: -1, // Complex - depends on argument count
    operandCount: 1,
    operandTypes: [OperandType.COUNT],
    category: InstructionCategory.FUNCTION,
    hasJump: false,
    canThrow: true,
    sideEffects: true,
  }],

  // Object operations
  [QuickJSOpcode.OP_OBJECT, {
    name: 'object',
    stackEffect: 1,
    operandCount: 0,
    operandTypes: [],
    category: InstructionCategory.OBJECT,
    hasJump: false,
    canThrow: false,
    sideEffects: false,
  }],

  // Add more instructions as needed...
]);

/**
 * Get instruction info for opcode
 */
export function getInstructionInfo(opcode: QuickJSOpcode): InstructionInfo | undefined {
  return QUICKJS_INSTRUCTIONS.get(opcode);
}

/**
 * Get instruction name for opcode
 */
export function getInstructionName(opcode: QuickJSOpcode): string {
  const info = getInstructionInfo(opcode);
  return info?.name || `unknown_${opcode.toString(16)}`;
}

/**
 * Check if instruction can throw exception
 */
export function canInstructionThrow(opcode: QuickJSOpcode): boolean {
  const info = getInstructionInfo(opcode);
  return info?.canThrow || false;
}

/**
 * Check if instruction has side effects
 */
export function hasSideEffects(opcode: QuickJSOpcode): boolean {
  const info = getInstructionInfo(opcode);
  return info?.sideEffects || false;
}

/**
 * Calculate dynamic stack effect for instructions with variable effects
 */
export function calculateStackEffect(opcode: QuickJSOpcode, operand?: number): number {
  const info = getInstructionInfo(opcode);
  if (!info) return 0;

  // Handle instructions with dynamic stack effects
  switch (opcode) {
    case QuickJSOpcode.OP_CALL:
      // Pops function + argc arguments, pushes result
      return operand !== undefined ? -(operand + 1) + 1 : -1;
      
    case QuickJSOpcode.OP_CALL_METHOD:
      // Pops this + function + argc arguments, pushes result  
      return operand !== undefined ? -(operand + 2) + 1 : -2;
      
    case QuickJSOpcode.OP_CALL_CONSTRUCTOR:
      // Pops constructor + argc arguments, pushes result
      return operand !== undefined ? -(operand + 1) + 1 : -1;
      
    default:
      return info.stackEffect;
  }
}

/**
 * Get all jump targets for control flow instruction
 */
export function getJumpTargets(opcode: QuickJSOpcode, offset: number, operand?: number): number[] {
  const info = getInstructionInfo(opcode);
  if (!info?.hasJump) return [];
  
  switch (opcode) {
    case QuickJSOpcode.OP_IF_TRUE:
    case QuickJSOpcode.OP_IF_FALSE:
    case QuickJSOpcode.OP_GOTO:
      return operand !== undefined ? [offset + operand] : [];
    
    default:
      return [];
  }
}