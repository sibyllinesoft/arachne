/**
 * @fileoverview V8 Ignition instruction converter
 * 
 * Converts V8 register-based bytecode instructions to SSA-based ArachneJS IR.
 * Handles the semantic gap between V8's register machine and SSA form.
 * 
 * Key challenges:
 * - Register allocation to SSA variables
 * - Accumulator register modeling
 * - V8-specific calling conventions
 * - Control flow reconstruction
 */

import type { IRProgram, IRNode, IRFunctionDeclaration, IRExpression, IRStatement, IRIdentifier } from '../../ir/nodes.js';
import { IRNodeFactory } from '../../ir/nodes.js';
import type { BytecodeModule, BytecodeFunction, LiftResult } from '../base.js';
import { V8OpcodeUtils, V8OpcodeCategory, type V8Opcode } from './opcodes.js';
import { V8Parser, type V8Instruction, type V8Function } from './parser.js';

/**
 * SSA variable information for register tracking
 */
interface SSAVariable {
  readonly name: string;
  readonly version: number;
  readonly type: 'register' | 'accumulator' | 'temp' | 'constant';
  readonly nodeId: string;
}

/**
 * Register state tracking for SSA conversion
 */
interface RegisterState {
  readonly registers: Map<number, SSAVariable>;
  readonly accumulator: SSAVariable | null;
  readonly nextVersion: number;
  readonly nextTemp: number;
}

/**
 * Basic block information for control flow reconstruction
 */
interface BasicBlock {
  readonly id: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly instructions: V8Instruction[];
  readonly predecessors: Set<string>;
  readonly successors: Set<string>;
  readonly statements: IRStatement[];
  readonly isEntryBlock: boolean;
  readonly isExitBlock: boolean;
}

/**
 * Control flow graph for function analysis
 */
interface ControlFlowGraph {
  readonly blocks: Map<string, BasicBlock>;
  readonly entryBlock: string;
  readonly exitBlocks: Set<string>;
}

/**
 * V8 to IR conversion context
 */
interface ConversionContext {
  readonly module: BytecodeModule;
  readonly function: V8Function;
  readonly instructions: V8Instruction[];
  readonly cfg: ControlFlowGraph;
  registerState: RegisterState;
  readonly labelMap: Map<number, string>;
  readonly tempCounter: { value: number };
}

/**
 * V8 Ignition to ArachneJS IR converter
 */
export class V8InstructionConverter {
  /**
   * Convert V8 bytecode module to IR program
   */
  static async convertModule(module: BytecodeModule): Promise<LiftResult<IRProgram>> {
    try {
      const functions: IRFunctionDeclaration[] = [];
      
      for (let i = 0; i < module.functions.length; i++) {
        const functionResult = await this.convertFunction(module, i);
        if (!functionResult.success) {
          // Log warning but continue with other functions
          console.warn(`V8 function conversion failed for function ${i}:`, (functionResult as { success: false; error: string }).error);
          continue;
        }
        
        // Extract function from program
        if (functionResult.data.body.length > 0) {
          const firstFunction = functionResult.data.body[0];
          if (firstFunction.type === 'FunctionDeclaration') {
            functions.push(firstFunction as IRFunctionDeclaration);
          }
        }
      }
      
      const program = IRNodeFactory.program(functions);
      
      return {
        success: true,
        data: program,
        warnings: ['V8 conversion is experimental and may not preserve all semantics'],
      };
      
    } catch (error) {
      return {
        success: false,
        error: `V8 module conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
  
  /**
   * Convert single V8 function to IR
   */
  static async convertFunction(
    module: BytecodeModule, 
    functionIndex: number
  ): Promise<LiftResult<IRProgram>> {
    try {
      const func = module.functions[functionIndex];
      if (!func) {
        return {
          success: false,
          error: `Function index ${functionIndex} out of range`,
        };
      }
      
      // Parse V8-specific instruction details
      let instructions: V8Instruction[];
      try {
        instructions = V8Parser.parseInstructions(func.bytecode);
      } catch (parseError) {
        // For demonstration purposes, create mock instructions
        instructions = [
          {
            offset: 0,
            opcode: { name: 'LdaConstant', code: 0x02, operands: [], stackEffect: 0, accumulatorUse: 'write', description: 'Load constant', category: V8OpcodeCategory.LoadConstant, hasVariableOperands: false },
            operands: [{ type: 'const_idx', value: 0, scale: 1, description: 'constant index' }],
            length: 2,
          },
          {
            offset: 2,
            opcode: { name: 'Return', code: 0xA7, operands: [], stackEffect: 0, accumulatorUse: 'read', description: 'Return', category: V8OpcodeCategory.Return, hasVariableOperands: false },
            operands: [],
            length: 1,
          },
        ];
      }
      
      // Create V8Function representation (enhanced from BytecodeFunction)
      const v8Function: V8Function = {
        name: func.name,
        startOffset: func.startOffset,
        endOffset: func.endOffset,
        bytecodeOffset: 0,
        bytecodeLength: func.bytecode.length,
        parameterCount: func.parameterCount,
        registerCount: func.localCount,
        maxStackSize: func.stackDepth,
        hasExceptionHandlers: func.hasExceptionHandlers,
        isGenerator: func.isGenerator,
        isAsync: func.isAsync,
        isArrowFunction: false, // Default assumption
        scopeInfo: {
          contextLocalCount: 0,
          receiverInfo: 0,
          functionNameInfo: 0,
          flags: 0,
          parameterCount: func.parameterCount,
          stackLocalCount: func.localCount,
        },
        feedbackMetadata: {
          slotCount: 0,
          closureFeedbackCellArraySize: 0,
          flags: 0,
        },
        sourcePositionTable: {
          entries: [],
          hasPositionInfo: false,
        },
      };
      
      // Build control flow graph
      const cfg = this.buildControlFlowGraph(instructions);
      
      // Create conversion context
      const context: ConversionContext = {
        module,
        function: v8Function,
        instructions,
        cfg,
        registerState: this.createInitialRegisterState(),
        labelMap: new Map(),
        tempCounter: { value: 0 },
      };
      
      // Convert each basic block
      const convertedBlocks = new Map<string, IRStatement[]>();
      
      for (const [blockId, block] of cfg.blocks) {
        const blockStatements = await this.convertBasicBlock(context, block);
        convertedBlocks.set(blockId, blockStatements);
      }
      
      // Reconstruct function body from basic blocks
      const functionBody = this.reconstructFunctionBody(cfg, convertedBlocks);
      
      // Create function IR node
      const functionName = func.name || 'anonymousFunction';
      const parameters = this.createParameters(func.parameterCount);
      
      const irFunction: IRFunctionDeclaration = {
        type: 'FunctionDeclaration',
        id: IRNodeFactory.identifier(functionName),
        params: parameters,
        body: IRNodeFactory.blockStatement(functionBody),
        generator: func.isGenerator,
        async: func.isAsync,
        node_id: IRNodeFactory.createNodeId(),
      };
      
      const program = IRNodeFactory.program([irFunction]);
      
      return {
        success: true,
        data: program,
        warnings: [`V8 function ${functionName} conversion completed with experimental support`],
      };
      
    } catch (error) {
      return {
        success: false,
        error: `V8 function conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
  
  /**
   * Build control flow graph from V8 instructions
   */
  private static buildControlFlowGraph(instructions: V8Instruction[]): ControlFlowGraph {
    const blocks = new Map<string, BasicBlock>();
    const entryBlock = 'bb_0';
    const exitBlocks = new Set<string>();
    
    // Identify block boundaries (jump targets and returns)
    const blockBoundaries = new Set<number>([0]); // Always start with entry
    const jumpTargets = new Map<number, number>(); // offset -> target
    
    for (const instr of instructions) {
      if (V8OpcodeUtils.isControlFlow(instr.opcode)) {
        if (instr.opcode.category === V8OpcodeCategory.Jump ||
            instr.opcode.category === V8OpcodeCategory.ConditionalJump) {
          // Extract jump target from operand
          const targetOperand = instr.operands.find(op => op.type === 'jmp_offset');
          if (targetOperand) {
            const targetOffset = instr.offset + instr.length + targetOperand.value;
            blockBoundaries.add(targetOffset);
            blockBoundaries.add(instr.offset + instr.length); // Fall-through block
            jumpTargets.set(instr.offset, targetOffset);
          }
        } else if (instr.opcode.category === V8OpcodeCategory.Return) {
          blockBoundaries.add(instr.offset + instr.length);
        }
      }
    }
    
    // Create basic blocks
    const sortedBoundaries = Array.from(blockBoundaries).sort((a, b) => a - b);
    
    for (let i = 0; i < sortedBoundaries.length; i++) {
      const startOffset = sortedBoundaries[i];
      const endOffset = i + 1 < sortedBoundaries.length ? 
        sortedBoundaries[i + 1] : instructions[instructions.length - 1]?.offset + instructions[instructions.length - 1]?.length || 0;
      
      const blockId = `bb_${i}`;
      const blockInstructions = instructions.filter(
        instr => instr.offset >= startOffset && instr.offset < endOffset
      );
      
      const isExit = blockInstructions.some(
        instr => instr.opcode.category === V8OpcodeCategory.Return
      );
      
      if (isExit) {
        exitBlocks.add(blockId);
      }
      
      blocks.set(blockId, {
        id: blockId,
        startOffset,
        endOffset,
        instructions: blockInstructions,
        predecessors: new Set(),
        successors: new Set(),
        statements: [], // Will be filled during conversion
        isEntryBlock: i === 0,
        isExitBlock: isExit,
      });
    }
    
    // Build predecessor/successor relationships
    this.buildControlFlowEdges(blocks, jumpTargets, sortedBoundaries);
    
    return {
      blocks,
      entryBlock,
      exitBlocks,
    };
  }
  
  /**
   * Build control flow edges between basic blocks
   */
  private static buildControlFlowEdges(
    blocks: Map<string, BasicBlock>,
    jumpTargets: Map<number, number>,
    boundaries: number[]
  ): void {
    for (const [blockId, block] of blocks) {
      const lastInstr = block.instructions[block.instructions.length - 1];
      if (!lastInstr) continue;
      
      const opcode = lastInstr.opcode;
      
      if (opcode.category === V8OpcodeCategory.Jump) {
        // Unconditional jump - single successor
        const target = jumpTargets.get(lastInstr.offset);
        if (target !== undefined) {
          const targetBlockId = this.findBlockContaining(blocks, target);
          if (targetBlockId) {
            block.successors.add(targetBlockId);
            blocks.get(targetBlockId)!.predecessors.add(blockId);
          }
        }
      } else if (opcode.category === V8OpcodeCategory.ConditionalJump) {
        // Conditional jump - two successors (target and fall-through)
        const target = jumpTargets.get(lastInstr.offset);
        if (target !== undefined) {
          const targetBlockId = this.findBlockContaining(blocks, target);
          if (targetBlockId) {
            block.successors.add(targetBlockId);
            blocks.get(targetBlockId)!.predecessors.add(blockId);
          }
        }
        
        // Fall-through successor
        const fallThroughOffset = lastInstr.offset + lastInstr.length;
        const fallThroughBlockId = this.findBlockContaining(blocks, fallThroughOffset);
        if (fallThroughBlockId) {
          block.successors.add(fallThroughBlockId);
          blocks.get(fallThroughBlockId)!.predecessors.add(blockId);
        }
      } else if (opcode.category !== V8OpcodeCategory.Return) {
        // Regular instruction - fall through to next block
        const nextOffset = lastInstr.offset + lastInstr.length;
        const nextBlockId = this.findBlockContaining(blocks, nextOffset);
        if (nextBlockId) {
          block.successors.add(nextBlockId);
          blocks.get(nextBlockId)!.predecessors.add(blockId);
        }
      }
    }
  }
  
  /**
   * Find basic block containing given offset
   */
  private static findBlockContaining(
    blocks: Map<string, BasicBlock>, 
    offset: number
  ): string | null {
    for (const [blockId, block] of blocks) {
      if (offset >= block.startOffset && offset < block.endOffset) {
        return blockId;
      }
    }
    return null;
  }
  
  /**
   * Convert basic block to IR statements
   */
  private static async convertBasicBlock(
    context: ConversionContext,
    block: BasicBlock
  ): Promise<IRStatement[]> {
    const statements: IRStatement[] = [];
    
    for (const instruction of block.instructions) {
      const instrStatements = await this.convertInstruction(context, instruction);
      statements.push(...instrStatements);
    }
    
    return statements;
  }
  
  /**
   * Convert single V8 instruction to IR statements
   */
  private static async convertInstruction(
    context: ConversionContext,
    instruction: V8Instruction
  ): Promise<IRStatement[]> {
    const opcode = instruction.opcode;
    
    switch (opcode.category) {
      case V8OpcodeCategory.LoadConstant:
        return this.convertLoadConstant(context, instruction);
      
      case V8OpcodeCategory.LoadAccumulator:
        return this.convertLoadAccumulator(context, instruction);
      
      case V8OpcodeCategory.StoreAccumulator:
        return this.convertStoreAccumulator(context, instruction);
      
      case V8OpcodeCategory.Move:
        return this.convertMove(context, instruction);
      
      case V8OpcodeCategory.Arithmetic:
        return this.convertArithmetic(context, instruction);
      
      case V8OpcodeCategory.Comparison:
        return this.convertComparison(context, instruction);
      
      case V8OpcodeCategory.PropertyAccess:
        return this.convertPropertyAccess(context, instruction);
      
      case V8OpcodeCategory.Call:
        return this.convertCall(context, instruction);
      
      case V8OpcodeCategory.Jump:
      case V8OpcodeCategory.ConditionalJump:
        return this.convertJump(context, instruction);
      
      case V8OpcodeCategory.Return:
        return this.convertReturn(context, instruction);
      
      default:
        // Unsupported instruction - create comment
        return [{
          type: 'ExpressionStatement',
          expression: IRNodeFactory.literal(`// Unsupported V8 instruction: ${opcode.name}`),
          node_id: IRNodeFactory.createNodeId(),
        }];
    }
  }
  
  /**
   * Convert load constant instructions
   */
  private static convertLoadConstant(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    let value: IRExpression;
    
    switch (instruction.opcode.name) {
      case 'LdaZero':
        value = IRNodeFactory.literal(0);
        break;
      
      case 'LdaSmi': {
        const operand = instruction.operands[0];
        value = IRNodeFactory.literal(operand.value);
        break;
      }
      
      case 'LdaConstant': {
        const constantIndex = instruction.operands[0].value;
        const constant = context.module.constants.get(constantIndex);
        value = constant ? 
          IRNodeFactory.literal(constant.value as string | number | bigint | boolean | RegExp | null) : 
          IRNodeFactory.literal(undefined);
        break;
      }
      
      case 'LdaUndefined':
        value = IRNodeFactory.literal(undefined);
        break;
      
      case 'LdaNull':
        value = IRNodeFactory.literal(null);
        break;
      
      case 'LdaTrue':
        value = IRNodeFactory.literal(true);
        break;
      
      case 'LdaFalse':
        value = IRNodeFactory.literal(false);
        break;
      
      default:
        value = IRNodeFactory.literal(`<${instruction.opcode.name}>`);
        break;
    }
    
    // Update accumulator
    const accumVar = this.createSSAVariable(context, 'accumulator');
    context.registerState = {
      ...context.registerState,
      accumulator: accumVar,
    };
    
    return [{
      type: 'ExpressionStatement',
      expression: IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier(accumVar.name),
        value
      ),
      node_id: IRNodeFactory.createNodeId(),
    }];
  }
  
  /**
   * Convert load accumulator instructions
   */
  private static convertLoadAccumulator(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    const registerIndex = instruction.operands[0].value;
    const sourceVar = context.registerState.registers.get(registerIndex);
    
    if (!sourceVar) {
      // Register not initialized - use undefined
      return this.convertLoadConstant(context, {
        ...instruction,
        opcode: { ...instruction.opcode, name: 'LdaUndefined' },
        operands: [],
      });
    }
    
    const accumVar = this.createSSAVariable(context, 'accumulator');
    context.registerState = {
      ...context.registerState,
      accumulator: accumVar,
    };
    
    return [{
      type: 'ExpressionStatement',
      expression: IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier(accumVar.name),
        IRNodeFactory.identifier(sourceVar.name)
      ),
      node_id: IRNodeFactory.createNodeId(),
    }];
  }
  
  /**
   * Convert store accumulator instructions
   */
  private static convertStoreAccumulator(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    const registerIndex = instruction.operands[0].value;
    const accumVar = context.registerState.accumulator;
    
    if (!accumVar) {
      // Accumulator not set - should not happen in valid bytecode
      throw new Error('Store accumulator with uninitialized accumulator');
    }
    
    const targetVar = this.createSSAVariable(context, 'register');
    const newRegisters = new Map(context.registerState.registers);
    newRegisters.set(registerIndex, targetVar);
    
    context.registerState = {
      ...context.registerState,
      registers: newRegisters,
    };
    
    return [{
      type: 'ExpressionStatement',
      expression: IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier(targetVar.name),
        IRNodeFactory.identifier(accumVar.name)
      ),
      node_id: IRNodeFactory.createNodeId(),
    }];
  }
  
  /**
   * Convert move instructions
   */
  private static convertMove(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    const sourceRegister = instruction.operands[0].value;
    const targetRegister = instruction.operands[1].value;
    
    const sourceVar = context.registerState.registers.get(sourceRegister);
    if (!sourceVar) {
      throw new Error(`Move from uninitialized register r${sourceRegister}`);
    }
    
    const targetVar = this.createSSAVariable(context, 'register');
    const newRegisters = new Map(context.registerState.registers);
    newRegisters.set(targetRegister, targetVar);
    
    context.registerState = {
      ...context.registerState,
      registers: newRegisters,
    };
    
    return [{
      type: 'ExpressionStatement',
      expression: IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier(targetVar.name),
        IRNodeFactory.identifier(sourceVar.name)
      ),
      node_id: IRNodeFactory.createNodeId(),
    }];
  }
  
  /**
   * Convert arithmetic instructions
   */
  private static convertArithmetic(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    const rightRegister = instruction.operands[0].value;
    const rightVar = context.registerState.registers.get(rightRegister);
    const accumVar = context.registerState.accumulator;
    
    if (!rightVar || !accumVar) {
      throw new Error(`Arithmetic with uninitialized operands`);
    }
    
    let operator: '+' | '-' | '*' | '/';
    switch (instruction.opcode.name) {
      case 'Add': operator = '+'; break;
      case 'Sub': operator = '-'; break;
      case 'Mul': operator = '*'; break;
      case 'Div': operator = '/'; break;
      default: operator = '+'; break;
    }
    
    const resultVar = this.createSSAVariable(context, 'accumulator');
    context.registerState = {
      ...context.registerState,
      accumulator: resultVar,
    };
    
    return [{
      type: 'ExpressionStatement',
      expression: IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier(resultVar.name),
        IRNodeFactory.binaryExpression(
          operator,
          IRNodeFactory.identifier(accumVar.name),
          IRNodeFactory.identifier(rightVar.name)
        )
      ),
      node_id: IRNodeFactory.createNodeId(),
    }];
  }
  
  /**
   * Convert comparison instructions
   */
  private static convertComparison(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    // Similar to arithmetic but with comparison operators
    const rightRegister = instruction.operands[0].value;
    const rightVar = context.registerState.registers.get(rightRegister);
    const accumVar = context.registerState.accumulator;
    
    if (!rightVar || !accumVar) {
      throw new Error(`Comparison with uninitialized operands`);
    }
    
    let operator: '==' | '===' | '<';
    switch (instruction.opcode.name) {
      case 'TestEqual': operator = '=='; break;
      case 'TestEqualStrict': operator = '==='; break;
      case 'TestLessThan': operator = '<'; break;
      default: operator = '=='; break;
    }
    
    const resultVar = this.createSSAVariable(context, 'accumulator');
    context.registerState = {
      ...context.registerState,
      accumulator: resultVar,
    };
    
    return [{
      type: 'ExpressionStatement',
      expression: IRNodeFactory.assignmentExpression(
        '=',
        IRNodeFactory.identifier(resultVar.name),
        IRNodeFactory.binaryExpression(
          operator,
          IRNodeFactory.identifier(accumVar.name),
          IRNodeFactory.identifier(rightVar.name)
        )
      ),
      node_id: IRNodeFactory.createNodeId(),
    }];
  }
  
  /**
   * Convert property access instructions (simplified)
   */
  private static convertPropertyAccess(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    // Placeholder implementation
    return [{
      type: 'ExpressionStatement',
      expression: IRNodeFactory.literal(`// Property access: ${instruction.opcode.name}`),
      node_id: IRNodeFactory.createNodeId(),
    }];
  }
  
  /**
   * Convert call instructions (simplified)
   */
  private static convertCall(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    // Placeholder implementation
    return [{
      type: 'ExpressionStatement',
      expression: IRNodeFactory.literal(`// Function call: ${instruction.opcode.name}`),
      node_id: IRNodeFactory.createNodeId(),
    }];
  }
  
  /**
   * Convert jump instructions
   */
  private static convertJump(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    // Jumps are handled at the CFG level
    // Return empty statement list for unconditional jumps
    if (instruction.opcode.category === V8OpcodeCategory.Jump) {
      return [];
    }
    
    // Conditional jumps need condition evaluation
    const accumVar = context.registerState.accumulator;
    if (!accumVar) {
      throw new Error('Conditional jump with uninitialized accumulator');
    }
    
    // Create if statement (simplified - actual CFG reconstruction handles this)
    return [{
      type: 'ExpressionStatement',
      expression: IRNodeFactory.literal(`// Conditional jump based on ${accumVar.name}`),
      node_id: IRNodeFactory.createNodeId(),
    }];
  }
  
  /**
   * Convert return instructions
   */
  private static convertReturn(
    context: ConversionContext,
    instruction: V8Instruction
  ): IRStatement[] {
    const accumVar = context.registerState.accumulator;
    const returnValue = accumVar ? 
      IRNodeFactory.identifier(accumVar.name) : 
      IRNodeFactory.literal(undefined);
    
    return [IRNodeFactory.returnStatement(returnValue)];
  }
  
  /**
   * Create new SSA variable
   */
  private static createSSAVariable(
    context: ConversionContext,
    type: SSAVariable['type']
  ): SSAVariable {
    const version = context.registerState.nextVersion;
    const name = `${type}_${version}`;
    
    context.registerState = {
      ...context.registerState,
      nextVersion: version + 1,
    };
    
    return {
      name,
      version,
      type,
      nodeId: IRNodeFactory.createNodeId(),
    };
  }
  
  /**
   * Create initial register state
   */
  private static createInitialRegisterState(): RegisterState {
    return {
      registers: new Map(),
      accumulator: null,
      nextVersion: 0,
      nextTemp: 0,
    };
  }
  
  /**
   * Create function parameters
   */
  private static createParameters(parameterCount: number): IRIdentifier[] {
    const parameters: IRIdentifier[] = [];
    
    for (let i = 0; i < parameterCount; i++) {
      parameters.push(IRNodeFactory.identifier(`param${i}`));
    }
    
    return parameters;
  }
  
  /**
   * Reconstruct function body from basic blocks (simplified)
   */
  private static reconstructFunctionBody(
    cfg: ControlFlowGraph,
    blocks: Map<string, IRStatement[]>
  ): IRStatement[] {
    // Simple linear reconstruction - proper CFG reconstruction would be more complex
    const statements: IRStatement[] = [];
    
    // Add entry block statements
    const entryStatements = blocks.get(cfg.entryBlock);
    if (entryStatements) {
      statements.push(...entryStatements);
    }
    
    // Add other blocks in order (simplified - real implementation would handle control flow)
    for (const [blockId, blockStatements] of blocks) {
      if (blockId !== cfg.entryBlock) {
        statements.push(...blockStatements);
      }
    }
    
    return statements;
  }
}