/**
 * @fileoverview Enhanced VM devirtualization with micro-emulation
 * 
 * Phase 2.1 Enhancement: Upgrades from pattern-based detection to
 * static emulation-based devirtualization for resilient bytecode lifting.
 * 
 * Key Features:
 * - Static analysis of virtual machine dispatchers
 * - Semantic modeling of virtual opcodes
 * - Micro-emulation engine for bytecode interpretation
 * - Robust IR generation from emulated operations
 * - Resilient to obfuscator variations
 */

import type {
  VMDevirtualizer,
  VMAnalysis,
  VMDispatcher,
  VMDispatchPattern,
  LiftResult,
  BytecodeInstruction,
  ControlFlowGraph,
  BasicBlock,
} from '../base.js';
import type { 
  IRProgram, 
  IRStatement, 
  IRExpression, 
  IRIdentifier,
  IRFunctionDeclaration,
  IRBinaryExpression,
  IRAssignmentExpression,
  IRExpressionStatement,
  IRBlockStatement,
  IRPattern,
  VariableName,
  SSAVersion,
  NodeId
} from '../../ir/nodes.js';
import { IRNodeFactory } from '../../ir/nodes.js';

/**
 * VM pattern signatures for detection
 */
const VM_PATTERNS = {
  // Switch-based dispatch
  SWITCH_DISPATCH: /switch\s*\(\s*([^)]+)\s*\)\s*\{/g,
  
  // Jump table dispatch  
  JUMP_TABLE: /\w+\[\s*([^]]+)\s*\]\s*\(\s*\)/g,
  
  // Computed goto (rare in JS, but can appear in transpiled code)
  COMPUTED_GOTO: /goto\s+\*\s*([^;]+);/g,
  
  // VM stack manipulation
  VM_STACK: /(\w+)\s*\[\s*(\w+)\s*(\+\+|--|\+=|\-=)\s*\]/g,
  
  // Opcode fetching patterns
  OPCODE_FETCH: /(\w+)\s*=\s*([^[]+)\[\s*(\w+)\s*(\+\+)?\s*\]/g,
  
  // Handler calling patterns
  HANDLER_CALL: /(\w+)\s*\(\s*([^)]*)\s*\)/g,
} as const;

/**
 * Enhanced virtual opcode definition with semantic modeling
 */
interface VirtualOpcode {
  readonly opcode: number;
  readonly mnemonic: string;
  readonly operands: readonly OperandType[];
  readonly stackEffect: number;
  readonly semantics: OpcodeSemantics;
  readonly handlerCode: string; // Original handler source
  readonly confidence: number; // Analysis confidence
}

interface OpcodeSemantics {
  readonly type: 'arithmetic' | 'load' | 'store' | 'control' | 'call' | 'stack' | 'logical' | 'comparison';
  readonly registerReads: readonly number[]; // Virtual registers read
  readonly registerWrites: readonly number[]; // Virtual registers written
  readonly stackPops: number;
  readonly stackPushes: number;
  readonly controlFlow: ControlFlowEffect;
  readonly sideEffects: readonly SideEffect[];
}

interface ControlFlowEffect {
  readonly type: 'none' | 'jump' | 'conditional' | 'call' | 'return' | 'throw';
  readonly targetExpression?: string; // For dynamic jumps
  readonly condition?: string; // For conditional jumps
}

type SideEffect = 'memory_read' | 'memory_write' | 'call_external' | 'throw_exception';
type OperandType = 'immediate' | 'register' | 'offset' | 'constant_pool';

/**
 * Enhanced VM state for micro-emulation
 */
interface VMState {
  virtualRegisters: Map<number, unknown>;
  virtualStack: unknown[];
  programCounter: number;
  readonly constants: ReadonlyMap<number, unknown>;
  callStack: number[];
  readonly exceptionHandlers: readonly ExceptionHandler[];
  flags: VMFlags;
}

interface VMFlags {
  zero: boolean;
  carry: boolean;
  overflow: boolean;
  sign: boolean;
}

interface ExceptionHandler {
  readonly startPC: number;
  readonly endPC: number;
  readonly handlerPC: number;
  readonly exceptionType: string;
}

/**
 * Static analyzer for virtual machine dispatcher extraction
 */
class StaticVMAnalyzer {
  private readonly opcodeDefinitions = new Map<number, VirtualOpcode>();
  private readonly handlerAddresses = new Map<number, number>();
  private vmArchitecture: 'register' | 'stack' | 'hybrid' = 'stack';

  /**
   * Analyze dispatcher switch statement and extract opcode semantics
   */
  analyzeDispatcher(dispatcherCode: string): Map<number, VirtualOpcode> {
    const opcodes = new Map<number, VirtualOpcode>();
    
    // Extract switch cases and their handlers
    const switchCases = this.extractSwitchCases(dispatcherCode);
    
    for (const caseInfo of switchCases) {
      const opcodeDefinition = this.analyzeOpcodeHandler(
        caseInfo.opcode,
        caseInfo.handlerCode
      );
      
      if (opcodeDefinition.confidence > 0.6) {
        opcodes.set(caseInfo.opcode, opcodeDefinition);
      }
    }
    
    // Infer VM architecture from opcode patterns
    this.vmArchitecture = this.inferVMArchitecture(opcodes);
    
    return opcodes;
  }

  /**
   * Extract switch cases from dispatcher code
   */
  private extractSwitchCases(code: string): Array<{opcode: number, handlerCode: string}> {
    const cases: Array<{opcode: number, handlerCode: string}> = [];
    
    // Match case statements with their handler code
    const casePattern = /case\s+(\d+|0x[0-9a-fA-F]+)\s*:(.*?)(?=case\s+|default\s*:|\})/g;
    
    let match;
    while ((match = casePattern.exec(code)) !== null) {
      const opcodeStr = match[1];
      const opcode = opcodeStr.startsWith('0x') ? 
        parseInt(opcodeStr, 16) : 
        parseInt(opcodeStr, 10);
      
      const handlerCode = match[2].trim();
      
      if (!isNaN(opcode) && handlerCode) {
        cases.push({ opcode, handlerCode });
      }
    }
    
    return cases;
  }

  /**
   * Analyze individual opcode handler to extract semantics
   */
  private analyzeOpcodeHandler(opcode: number, handlerCode: string): VirtualOpcode {
    const semantics = this.extractSemantics(handlerCode);
    const operands = this.inferOperandTypes(handlerCode);
    const stackEffect = this.calculateStackEffect(handlerCode);
    const mnemonic = this.generateMnemonic(opcode, semantics);
    const confidence = this.calculateConfidence(handlerCode, semantics);
    
    return {
      opcode,
      mnemonic,
      operands,
      stackEffect,
      semantics,
      handlerCode,
      confidence,
    };
  }

  /**
   * Extract semantic information from handler code
   */
  private extractSemantics(handlerCode: string): OpcodeSemantics {
    const registerReads: number[] = [];
    const registerWrites: number[] = [];
    const sideEffects: SideEffect[] = [];
    
    // Detect register access patterns
    const registerReadPattern = /v_?reg\[(\d+)\](?!\s*=)/g;
    const registerWritePattern = /v_?reg\[(\d+)\]\s*=/g;
    
    let match;
    while ((match = registerReadPattern.exec(handlerCode)) !== null) {
      registerReads.push(parseInt(match[1], 10));
    }
    
    while ((match = registerWritePattern.exec(handlerCode)) !== null) {
      registerWrites.push(parseInt(match[1], 10));
    }
    
    // Detect stack operations
    const stackPops = (handlerCode.match(/\.pop\(\)/g) || []).length +
                      (handlerCode.match(/\[--\w+\]/g) || []).length;
    const stackPushes = (handlerCode.match(/\.push\(/g) || []).length +
                        (handlerCode.match(/\[\w+\+\+\]/g) || []).length;
    
    // Detect control flow
    const controlFlow = this.analyzeControlFlow(handlerCode);
    
    // Detect side effects
    if (handlerCode.includes('throw')) {
      sideEffects.push('throw_exception');
    }
    if (handlerCode.includes('call') || handlerCode.includes('invoke')) {
      sideEffects.push('call_external');
    }
    
    // Determine operation type
    const type = this.classifyOperationType(handlerCode, registerReads, registerWrites, controlFlow);
    
    return {
      type,
      registerReads,
      registerWrites,
      stackPops,
      stackPushes,
      controlFlow,
      sideEffects,
    };
  }

  /**
   * Analyze control flow effects in handler
   */
  private analyzeControlFlow(handlerCode: string): ControlFlowEffect {
    // Jump instructions
    if (handlerCode.includes('pc =') || handlerCode.includes('goto')) {
      if (handlerCode.includes('if') || handlerCode.includes('?')) {
        return {
          type: 'conditional',
          condition: this.extractCondition(handlerCode),
        };
      }
      return {
        type: 'jump',
        targetExpression: this.extractJumpTarget(handlerCode),
      };
    }
    
    // Return instructions
    if (handlerCode.includes('return')) {
      return { type: 'return' };
    }
    
    // Call instructions
    if (handlerCode.includes('call') || handlerCode.includes('invoke')) {
      return { type: 'call' };
    }
    
    // Exception handling
    if (handlerCode.includes('throw')) {
      return { type: 'throw' };
    }
    
    return { type: 'none' };
  }

  /**
   * Extract condition from conditional handler
   */
  private extractCondition(handlerCode: string): string {
    const conditionMatch = handlerCode.match(/if\s*\(([^)]+)\)/);
    return conditionMatch?.[1] || 'unknown';
  }

  /**
   * Extract jump target from handler
   */
  private extractJumpTarget(handlerCode: string): string {
    const targetMatch = handlerCode.match(/pc\s*=\s*([^;]+)/);
    return targetMatch?.[1]?.trim() || 'unknown';
  }

  /**
   * Classify operation type based on analysis
   */
  private classifyOperationType(
    handlerCode: string,
    registerReads: number[],
    registerWrites: number[],
    controlFlow: ControlFlowEffect
  ): OpcodeSemantics['type'] {
    if (controlFlow.type !== 'none') {
      return 'control';
    }
    
    if (handlerCode.match(/[+\-*/%]/)) {
      return 'arithmetic';
    }
    
    if (handlerCode.match(/[&|^~]/)) {
      return 'logical';
    }
    
    if (handlerCode.match(/[<>=!]/)) {
      return 'comparison';
    }
    
    if (registerReads.length > 0 && registerWrites.length === 0) {
      return 'load';
    }
    
    if (registerWrites.length > 0 && registerReads.length === 0) {
      return 'store';
    }
    
    if (handlerCode.includes('push') || handlerCode.includes('pop')) {
      return 'stack';
    }
    
    return 'arithmetic'; // Default classification
  }

  /**
   * Infer operand types from handler code
   */
  private inferOperandTypes(handlerCode: string): readonly OperandType[] {
    const operands: OperandType[] = [];
    
    // Check for immediate values
    if (handlerCode.match(/\d+/)) {
      operands.push('immediate');
    }
    
    // Check for register references
    if (handlerCode.match(/v_?reg\[/)) {
      operands.push('register');
    }
    
    // Check for constant pool access
    if (handlerCode.match(/constants?\[/)) {
      operands.push('constant_pool');
    }
    
    return operands;
  }

  /**
   * Calculate stack effect of operation
   */
  private calculateStackEffect(handlerCode: string): number {
    const pushCount = (handlerCode.match(/\.push\(/g) || []).length;
    const popCount = (handlerCode.match(/\.pop\(/g) || []).length;
    
    return pushCount - popCount;
  }

  /**
   * Generate mnemonic for opcode
   */
  private generateMnemonic(opcode: number, semantics: OpcodeSemantics): string {
    const typePrefix = {
      'arithmetic': 'ARITH',
      'load': 'LOAD',
      'store': 'STORE', 
      'control': 'JMP',
      'call': 'CALL',
      'stack': 'STACK',
      'logical': 'LOGIC',
      'comparison': 'CMP',
    };
    
    const prefix = typePrefix[semantics.type] || 'OP';
    return `${prefix}_${opcode.toString(16).toUpperCase().padStart(2, '0')}`;
  }

  /**
   * Calculate confidence in analysis
   */
  private calculateConfidence(handlerCode: string, semantics: OpcodeSemantics): number {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence for clear patterns
    if (semantics.registerReads.length > 0 || semantics.registerWrites.length > 0) {
      confidence += 0.2;
    }
    
    if (semantics.stackPops > 0 || semantics.stackPushes > 0) {
      confidence += 0.2;
    }
    
    if (semantics.controlFlow.type !== 'none') {
      confidence += 0.1;
    }
    
    // Reduce confidence for unclear code
    if (handlerCode.length < 20) {
      confidence -= 0.2;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Infer VM architecture from opcode patterns
   */
  private inferVMArchitecture(opcodes: Map<number, VirtualOpcode>): 'register' | 'stack' | 'hybrid' {
    let registerOps = 0;
    let stackOps = 0;
    
    for (const opcode of Array.from(opcodes.values())) {
      if (opcode.semantics.registerReads.length > 0 || opcode.semantics.registerWrites.length > 0) {
        registerOps++;
      }
      if (opcode.semantics.stackPops > 0 || opcode.semantics.stackPushes > 0) {
        stackOps++;
      }
    }
    
    const total = registerOps + stackOps;
    if (total === 0) return 'stack'; // Default
    
    const registerRatio = registerOps / total;
    
    if (registerRatio > 0.7) return 'register';
    if (registerRatio < 0.3) return 'stack';
    return 'hybrid';
  }

  getVMArchitecture(): 'register' | 'stack' | 'hybrid' {
    return this.vmArchitecture;
  }
}

/**
 * Advanced micro-emulation engine for virtual machine simulation
 */
class MicroEmulator {
  private state: VMState;
  private opcodeDefinitions: Map<number, VirtualOpcode>;
  private traceLog: readonly EmulationStep[] = [];
  private maxSteps: number = 10000; // Prevent infinite loops
  private currentStep: number = 0;

  constructor(
    opcodeDefinitions: Map<number, VirtualOpcode>,
    constants: ReadonlyMap<number, unknown> = new Map(),
    initialRegisters: number = 32
  ) {
    this.opcodeDefinitions = opcodeDefinitions;
    
    // Initialize VM state
    const virtualRegisters = new Map<number, unknown>();
    for (let i = 0; i < initialRegisters; i++) {
      virtualRegisters.set(i, 0);
    }
    
    this.state = {
      virtualRegisters,
      virtualStack: [],
      programCounter: 0,
      constants,
      callStack: [],
      exceptionHandlers: [],
      flags: {
        zero: false,
        carry: false,
        overflow: false,
        sign: false,
      },
    };
  }

  /**
   * Emulate bytecode execution and generate IR
   */
  emulateAndLift(
    bytecode: readonly number[],
    vmAnalysis: VMAnalysis
  ): LiftResult<IRFunctionDeclaration> {
    try {
      this.resetEmulation();
      
      const irStatements: IRStatement[] = [];
      const basicBlocks = new Map<number, BasicBlock>();
      const jumpTargets = new Set<number>();
      
      // First pass: identify jump targets and basic block boundaries
      this.identifyBasicBlocks(bytecode, jumpTargets, basicBlocks);
      
      // Second pass: emulate execution and generate IR
      let pc = 0;
      const visited = new Set<number>();
      const workList = [0]; // Start from entry point
      
      while (workList.length > 0 && this.currentStep < this.maxSteps) {
        pc = workList.pop()!;
        
        if (visited.has(pc) || pc >= bytecode.length) {
          continue;
        }
        
        visited.add(pc);
        const blockStatements = this.emulateBasicBlock(
          bytecode,
          pc,
          jumpTargets,
          basicBlocks
        );
        
        irStatements.push(...blockStatements);
        
        // Add successor blocks to work list
        const successors = this.getSuccessors(pc, bytecode, jumpTargets);
        workList.push(...successors.filter(s => !visited.has(s)));
        
        this.currentStep++;
      }
      
      // Create function declaration from generated statements
      const functionBody = IRNodeFactory.blockStatement(irStatements);
      const functionDecl = IRNodeFactory.functionDeclaration(
        IRNodeFactory.identifier('devirtualized_function'),
        [], // Parameters - would need deeper analysis
        functionBody,
        false, // Not generator
        false  // Not async
      );
      
      return {
        success: true,
        data: functionDecl,
        warnings: this.getEmulationWarnings(),
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Micro-emulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Identify basic blocks and jump targets
   */
  private identifyBasicBlocks(
    bytecode: readonly number[],
    jumpTargets: Set<number>,
    basicBlocks: Map<number, BasicBlock>
  ): void {
    let pc = 0;
    
    // Add entry point as jump target
    jumpTargets.add(0);
    
    while (pc < bytecode.length) {
      const opcode = bytecode[pc];
      const opcodeDefinition = this.opcodeDefinitions.get(opcode);
      
      if (!opcodeDefinition) {
        pc++;
        continue;
      }
      
      // Check for control flow instructions
      if (opcodeDefinition.semantics.controlFlow.type !== 'none') {
        const nextPc = pc + 1;
        
        // Add fall-through target
        if (nextPc < bytecode.length) {
          jumpTargets.add(nextPc);
        }
        
        // Add jump target if determinable
        const jumpTarget = this.extractJumpTarget(bytecode, pc, opcodeDefinition);
        if (jumpTarget !== null && jumpTarget < bytecode.length) {
          jumpTargets.add(jumpTarget);
        }
      }
      
      pc++;
    }
  }

  /**
   * Extract jump target from instruction if possible
   */
  private extractJumpTarget(
    bytecode: readonly number[],
    pc: number,
    opcodeDefinition: VirtualOpcode
  ): number | null {
    // This would need more sophisticated analysis based on operand decoding
    // For now, return null for dynamic jumps
    if (opcodeDefinition.semantics.controlFlow.targetExpression?.match(/\d+/)) {
      return parseInt(opcodeDefinition.semantics.controlFlow.targetExpression, 10);
    }
    
    return null;
  }

  /**
   * Emulate a basic block and generate IR statements
   */
  private emulateBasicBlock(
    bytecode: readonly number[],
    startPc: number,
    jumpTargets: Set<number>,
    basicBlocks: Map<number, BasicBlock>
  ): readonly IRStatement[] {
    const statements: IRStatement[] = [];
    let pc = startPc;
    
    this.state.programCounter = pc;
    
    while (pc < bytecode.length) {
      // Stop at next basic block boundary
      if (pc !== startPc && jumpTargets.has(pc)) {
        break;
      }
      
      const opcode = bytecode[pc];
      const opcodeDefinition = this.opcodeDefinitions.get(opcode);
      
      if (!opcodeDefinition) {
        pc++;
        continue;
      }
      
      // Emulate instruction and generate IR
      const irStatement = this.emulateInstruction(opcodeDefinition, bytecode, pc);
      if (irStatement) {
        statements.push(irStatement);
      }
      
      // Check for control flow
      if (opcodeDefinition.semantics.controlFlow.type !== 'none') {
        break; // End of basic block
      }
      
      pc++;
    }
    
    return statements;
  }

  /**
   * Emulate single instruction and generate IR
   */
  private emulateInstruction(
    opcodeDefinition: VirtualOpcode,
    bytecode: readonly number[],
    pc: number
  ): IRStatement | null {
    const semantics = opcodeDefinition.semantics;
    
    // Apply state changes based on semantics
    this.applySemanticEffects(semantics, bytecode, pc);
    
    // Generate IR based on operation type
    return this.generateIRForOperation(opcodeDefinition, bytecode, pc);
  }

  /**
   * Apply semantic effects to VM state
   */
  private applySemanticEffects(
    semantics: OpcodeSemantics,
    bytecode: readonly number[],
    pc: number
  ): void {
    // Update stack
    for (let i = 0; i < semantics.stackPops; i++) {
      if (this.state.virtualStack.length > 0) {
        this.state.virtualStack.pop();
      }
    }
    
    for (let i = 0; i < semantics.stackPushes; i++) {
      this.state.virtualStack.push(0); // Placeholder value
    }
    
    // Update registers (simplified)
    for (const regWrite of semantics.registerWrites) {
      this.state.virtualRegisters.set(regWrite, 0); // Placeholder
    }
    
    // Update flags for comparison operations
    if (semantics.type === 'comparison') {
      this.state.flags.zero = true; // Simplified
    }
  }

  /**
   * Generate IR statement for operation
   */
  private generateIRForOperation(
    opcodeDefinition: VirtualOpcode,
    bytecode: readonly number[],
    pc: number
  ): IRStatement | null {
    const semantics = opcodeDefinition.semantics;
    
    switch (semantics.type) {
      case 'arithmetic':
        return this.generateArithmeticIR(opcodeDefinition, semantics);
      case 'load':
        return this.generateLoadIR(opcodeDefinition, semantics);
      case 'store':
        return this.generateStoreIR(opcodeDefinition, semantics);
      case 'control':
        return this.generateControlFlowIR(opcodeDefinition, semantics);
      case 'comparison':
        return this.generateComparisonIR(opcodeDefinition, semantics);
      default:
        return this.generateGenericIR(opcodeDefinition, semantics);
    }
  }

  /**
   * Generate IR for arithmetic operations
   */
  private generateArithmeticIR(
    opcodeDefinition: VirtualOpcode,
    semantics: OpcodeSemantics
  ): IRStatement | null {
    if (semantics.registerReads.length >= 2 && semantics.registerWrites.length >= 1) {
      const left = IRNodeFactory.identifier(`v_reg_${semantics.registerReads[0]}`);
      const right = IRNodeFactory.identifier(`v_reg_${semantics.registerReads[1]}`);
      const target = IRNodeFactory.identifier(`v_reg_${semantics.registerWrites[0]}`);
      
      // Infer operator from handler code (simplified)
      const operator = this.inferArithmeticOperator(opcodeDefinition.handlerCode);
      
      const binaryExpr = IRNodeFactory.binaryExpression(operator, left, right);
      const assignment = IRNodeFactory.assignmentExpression('=', target, binaryExpr);
      
      return IRNodeFactory.expressionStatement(assignment);
    }
    
    return null;
  }

  /**
   * Generate IR for load operations
   */
  private generateLoadIR(
    opcodeDefinition: VirtualOpcode,
    semantics: OpcodeSemantics
  ): IRStatement | null {
    if (semantics.registerWrites.length >= 1) {
      const target = IRNodeFactory.identifier(`v_reg_${semantics.registerWrites[0]}`);
      
      // Load from constant or memory (simplified)
      const source = IRNodeFactory.literal(0); // Placeholder
      const assignment = IRNodeFactory.assignmentExpression('=', target, source);
      
      return IRNodeFactory.expressionStatement(assignment);
    }
    
    return null;
  }

  /**
   * Generate IR for store operations
   */
  private generateStoreIR(
    opcodeDefinition: VirtualOpcode,
    semantics: OpcodeSemantics
  ): IRStatement | null {
    if (semantics.registerReads.length >= 1) {
      const source = IRNodeFactory.identifier(`v_reg_${semantics.registerReads[0]}`);
      
      // Store to memory location (simplified)
      const target = IRNodeFactory.identifier('memory');
      const assignment = IRNodeFactory.assignmentExpression('=', target, source);
      
      return IRNodeFactory.expressionStatement(assignment);
    }
    
    return null;
  }

  /**
   * Generate IR for control flow operations
   */
  private generateControlFlowIR(
    opcodeDefinition: VirtualOpcode,
    semantics: OpcodeSemantics
  ): IRStatement | null {
    const controlFlow = semantics.controlFlow;
    
    switch (controlFlow.type) {
      case 'jump': {
        // Unconditional jump - would generate goto or structured control flow
        const label = IRNodeFactory.identifier(`L${controlFlow.targetExpression || 'unknown'}`);
        return IRNodeFactory.breakStatement(label);
      }
      
      case 'conditional': {
        // Conditional jump
        const condition = IRNodeFactory.identifier('condition'); // Simplified
        const jump = IRNodeFactory.breakStatement();
        return IRNodeFactory.ifStatement(condition, jump);
      }
      
      case 'return': {
        const returnValue = semantics.registerReads.length > 0 ?
          IRNodeFactory.identifier(`v_reg_${semantics.registerReads[0]}`) :
          null;
        return IRNodeFactory.returnStatement(returnValue);
      }
      
      default:
        return null;
    }
  }

  /**
   * Generate IR for comparison operations
   */
  private generateComparisonIR(
    opcodeDefinition: VirtualOpcode,
    semantics: OpcodeSemantics
  ): IRStatement | null {
    if (semantics.registerReads.length >= 2) {
      const left = IRNodeFactory.identifier(`v_reg_${semantics.registerReads[0]}`);
      const right = IRNodeFactory.identifier(`v_reg_${semantics.registerReads[1]}`);
      
      // Infer comparison operator
      const operator = this.inferComparisonOperator(opcodeDefinition.handlerCode);
      const comparison = IRNodeFactory.binaryExpression(operator, left, right);
      
      // Store result in flags or register
      if (semantics.registerWrites.length > 0) {
        const target = IRNodeFactory.identifier(`v_reg_${semantics.registerWrites[0]}`);
        const assignment = IRNodeFactory.assignmentExpression('=', target, comparison);
        return IRNodeFactory.expressionStatement(assignment);
      }
    }
    
    return null;
  }

  /**
   * Generate generic IR for unclassified operations
   */
  private generateGenericIR(
    opcodeDefinition: VirtualOpcode,
    semantics: OpcodeSemantics
  ): IRStatement | null {
    // Generate a comment indicating the original opcode
    const comment = `// ${opcodeDefinition.mnemonic}: ${opcodeDefinition.handlerCode.slice(0, 50)}...`;
    return IRNodeFactory.expressionStatement(IRNodeFactory.literal(comment));
  }

  /**
   * Infer arithmetic operator from handler code
   */
  private inferArithmeticOperator(handlerCode: string): IRBinaryExpression['operator'] {
    if (handlerCode.includes(' + ')) return '+';
    if (handlerCode.includes(' - ')) return '-';
    if (handlerCode.includes(' * ')) return '*';
    if (handlerCode.includes(' / ')) return '/';
    if (handlerCode.includes(' % ')) return '%';
    return '+'; // Default
  }

  /**
   * Infer comparison operator from handler code
   */
  private inferComparisonOperator(handlerCode: string): IRBinaryExpression['operator'] {
    if (handlerCode.includes('===')) return '===';
    if (handlerCode.includes('!==')) return '!==';
    if (handlerCode.includes('==')) return '==';
    if (handlerCode.includes('!=')) return '!=';
    if (handlerCode.includes('<=')) return '<=';
    if (handlerCode.includes('>=')) return '>=';
    if (handlerCode.includes(' < ')) return '<';
    if (handlerCode.includes(' > ')) return '>';
    return '==='; // Default
  }

  /**
   * Get successors for basic block
   */
  private getSuccessors(
    pc: number,
    bytecode: readonly number[],
    jumpTargets: Set<number>
  ): readonly number[] {
    const successors: number[] = [];
    
    // Add fall-through successor
    if (pc + 1 < bytecode.length) {
      successors.push(pc + 1);
    }
    
    // Add jump targets (would need more sophisticated analysis)
    // This is simplified for now
    
    return successors;
  }

  /**
   * Reset emulation state
   */
  private resetEmulation(): void {
    this.traceLog = [];
    this.currentStep = 0;
    
    // Reset VM state
    this.state.virtualStack = [];
    this.state.programCounter = 0;
    this.state.callStack = [];
    
    // Reset registers to zero
    for (const [reg] of Array.from(this.state.virtualRegisters)) {
      this.state.virtualRegisters.set(reg, 0);
    }
    
    this.state.flags = {
      zero: false,
      carry: false,
      overflow: false,
      sign: false,
    };
  }

  /**
   * Get emulation warnings
   */
  private getEmulationWarnings(): readonly string[] {
    const warnings: string[] = [];
    
    if (this.currentStep >= this.maxSteps) {
      warnings.push('Emulation stopped due to step limit - possible infinite loop');
    }
    
    if (this.traceLog.length === 0) {
      warnings.push('No emulation trace generated');
    }
    
    return warnings;
  }

  /**
   * Get current VM state (for debugging)
   */
  getState(): Readonly<VMState> {
    return this.state;
  }
}

/**
 * Emulation trace for debugging and analysis
 */
interface EmulationStep {
  readonly pc: number;
  readonly opcode: number;
  readonly mnemonic: string;
  readonly stateBefore: VMState;
  readonly stateAfter: VMState;
  readonly generatedIR: IRStatement | null;
}

/**
 * Enhanced VM devirtualization with micro-emulation
 * 
 * Phase 2.1 Implementation: Combines pattern detection with sophisticated
 * static analysis and micro-emulation for robust bytecode lifting.
 */
export class QuickJSVMDevirtualizer implements VMDevirtualizer {
  private readonly staticAnalyzer = new StaticVMAnalyzer();
  private microEmulator?: MicroEmulator;

  /**
   * Enhanced VM pattern detection with static analysis
   */
  async detectVMPatterns(bytecode: Uint8Array): Promise<LiftResult<VMAnalysis>> {
    try {
      // Convert bytecode to string for analysis
      const code = new TextDecoder('utf-8').decode(bytecode);
      
      // Phase 1: Traditional pattern detection (for compatibility)
      const dispatchers = this.detectDispatchers(code);
      const vmType = this.classifyVMType(dispatchers, code);
      const patterns = this.extractPatterns(code);
      
      // Phase 2: Enhanced static analysis of dispatchers
      let opcodeDefinitions = new Map<number, string>();
      let enhancedConfidence = 0;
      
      if (dispatchers.length > 0) {
        // Extract dispatcher code for each found dispatcher
        for (const dispatcher of dispatchers) {
          const dispatcherCode = this.extractDispatcherCode(code, dispatcher.address);
          
          if (dispatcherCode) {
            // Analyze dispatcher with static analyzer
            const analyzedOpcodes = this.staticAnalyzer.analyzeDispatcher(dispatcherCode);
            
            // Convert to legacy format for compatibility
            for (const [opcode, definition] of Array.from(analyzedOpcodes)) {
              opcodeDefinitions.set(opcode, definition.mnemonic);
            }
            
            // Calculate enhanced confidence based on semantic analysis
            enhancedConfidence = this.calculateEnhancedConfidence(
              analyzedOpcodes,
              dispatchers,
              patterns
            );
            
            // Store opcode definitions for emulation
            this.microEmulator = new MicroEmulator(
              analyzedOpcodes,
              new Map(), // Constants would need deeper analysis
              this.countVirtualRegisters(code)
            );
          }
        }
      }
      
      // Use enhanced confidence if available, otherwise fall back to legacy
      const confidence = enhancedConfidence > 0 ? enhancedConfidence : 
        this.calculateConfidence(dispatchers, opcodeDefinitions, patterns);

      const analysis: VMAnalysis = {
        vmType,
        dispatcherFunctions: dispatchers,
        opcodeTable: opcodeDefinitions,
        virtualRegisters: this.countVirtualRegisters(code),
        stackDepth: this.estimateStackDepth(code),
        hasEncryptedOpcodes: this.detectEncryption(bytecode),
        confidence,
        patterns,
      };

      const warnings: string[] = [];
      if (confidence < 0.5) {
        warnings.push('Low confidence VM detection');
      }
      if (enhancedConfidence === 0) {
        warnings.push('Enhanced static analysis failed, using legacy pattern matching');
      }
      if (this.microEmulator === undefined) {
        warnings.push('Micro-emulation unavailable, devirtualization may be limited');
      }

      return {
        success: true,
        data: analysis,
        warnings,
      };

    } catch (error) {
      return {
        success: false,
        error: `Enhanced VM pattern detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Enhanced VM devirtualization with micro-emulation support
   */
  async devirtualize(
    bytecode: Uint8Array,
    patterns: VMAnalysis
  ): Promise<LiftResult<IRProgram>> {
    try {
      if (patterns.confidence < 0.3) {
        return {
          success: false,
          error: 'VM confidence too low for devirtualization',
        };
      }

      // Try enhanced emulation-based devirtualization first
      if (this.microEmulator && patterns.confidence > 0.6) {
        const emulationResult = await this.emulateAndLift(bytecode, patterns);
        if (emulationResult.success) {
          // Wrap function declaration in program
          const program = IRNodeFactory.program([emulationResult.data]);
          return {
            success: true,
            data: program,
            warnings: [...(emulationResult.warnings || []), 'Generated using micro-emulation'],
          };
        }
        
        // Log emulation failure but continue with fallback
        const errorMsg = (emulationResult as { success: false; error: string }).error;
        console.warn('Micro-emulation failed, falling back to legacy devirtualization:', errorMsg);
      }

      // Fallback to legacy pattern-based devirtualization
      switch (patterns.vmType) {
        case 'switch-dispatch':
          return this.devirtualizeSwitchVM(bytecode, patterns);
          
        case 'jump-table':
          return this.devirtualizeJumpTableVM(bytecode, patterns);
          
        case 'computed-goto':
          return this.devirtualizeComputedGotoVM(bytecode, patterns);
          
        default:
          return this.devirtualizeGenericVM(bytecode, patterns);
      }

    } catch (error) {
      return {
        success: false,
        error: `Enhanced VM devirtualization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Enhanced emulation-based devirtualization (Phase 2.1 core feature)
   */
  async emulateAndLift(
    bytecode: Uint8Array,
    vmAnalysis: VMAnalysis
  ): Promise<LiftResult<IRFunctionDeclaration>> {
    if (!this.microEmulator) {
      return {
        success: false,
        error: 'Micro-emulator not initialized - static analysis may have failed',
      };
    }

    try {
      // Extract virtual bytecode array from source
      const virtualBytecode = this.extractVirtualBytecode(bytecode, vmAnalysis);
      
      if (virtualBytecode.length === 0) {
        return {
          success: false,
          error: 'No virtual bytecode found in source',
        };
      }

      // Use micro-emulator to generate IR
      return this.microEmulator.emulateAndLift(virtualBytecode, vmAnalysis);
      
    } catch (error) {
      return {
        success: false,
        error: `Emulation-based lifting failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get devirtualization confidence score
   */
  getConfidence(analysis: VMAnalysis): number {
    return analysis.confidence;
  }

  /**
   * Detect VM dispatcher functions
   */
  private detectDispatchers(code: string): VMDispatcher[] {
    const dispatchers: VMDispatcher[] = [];
    
    // Look for switch-based dispatchers
    const switchMatches = Array.from(code.matchAll(VM_PATTERNS.SWITCH_DISPATCH));
    for (const match of switchMatches) {
      if (match.index !== undefined) {
        dispatchers.push({
          address: match.index,
          signature: match[0],
          opcodeCount: this.countSwitchCases(code, match.index),
          handlerTable: new Map(),
          stackEffect: new Map(),
        });
      }
    }

    // Look for jump table dispatchers
    const jumpMatches = Array.from(code.matchAll(VM_PATTERNS.JUMP_TABLE));
    for (const match of jumpMatches) {
      if (match.index !== undefined) {
        dispatchers.push({
          address: match.index,
          signature: match[0],
          opcodeCount: this.estimateJumpTableSize(code, match.index),
          handlerTable: new Map(),
          stackEffect: new Map(),
        });
      }
    }

    return dispatchers;
  }

  /**
   * Extract dispatcher code block for static analysis
   */
  private extractDispatcherCode(code: string, dispatcherAddress: number): string | null {
    try {
      // Find the switch statement or dispatcher function
      let startIndex = dispatcherAddress;
      
      // Look for switch statement
      const switchMatch = code.slice(startIndex).match(/switch\s*\([^)]+\)\s*\{/);
      if (switchMatch && switchMatch.index !== undefined) {
        const switchStart = startIndex + switchMatch.index;
        const dispatcherCode = this.extractBlock(code, switchStart);
        return dispatcherCode;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to extract dispatcher code:', error);
      return null;
    }
  }

  /**
   * Extract opcode to handler mapping (enhanced version)
   */
  private extractOpcodeTable(code: string, bytecode: Uint8Array): ReadonlyMap<number, string> {
    const opcodeTable = new Map<number, string>();
    
    // Look for opcode constants or case statements
    const casePattern = /case\s+(\d+|0x[0-9a-fA-F]+)\s*:/g;
    const matches = Array.from(code.matchAll(casePattern));
    
    for (const match of matches) {
      const opcodeStr = match[1];
      const opcode = opcodeStr.startsWith('0x') ? 
        parseInt(opcodeStr, 16) : 
        parseInt(opcodeStr, 10);
      
      if (!isNaN(opcode)) {
        // Extract the code after the case statement for better analysis
        const matchIndex = match.index || 0;
        const afterCase = code.slice(matchIndex + match[0].length, matchIndex + match[0].length + 200);
        
        // Generate a meaningful handler name based on the code content
        let handlerName = `handler_${opcode}`;
        
        // Try to infer operation type from the code
        if (afterCase.includes('push') || afterCase.includes('stack')) {
          handlerName = `stack_op_${opcode}`;
        } else if (afterCase.includes('+') || afterCase.includes('-') || afterCase.includes('*') || afterCase.includes('/')) {
          handlerName = `arith_op_${opcode}`;
        } else if (afterCase.includes('regs[') || afterCase.includes('registers[')) {
          handlerName = `reg_op_${opcode}`;
        } else if (afterCase.includes('return')) {
          handlerName = `return_op_${opcode}`;
        } else if (afterCase.includes('pc') || afterCase.includes('jump')) {
          handlerName = `control_op_${opcode}`;
        }
        
        // Also try original approach as fallback
        const handlerMatch = afterCase.match(/(\w+)\s*\(/);
        if (handlerMatch && handlerMatch[1] !== 'if' && handlerMatch[1] !== 'while') {
          handlerName = handlerMatch[1];
        }
        
        opcodeTable.set(opcode, handlerName);
      }
    }

    return opcodeTable;
  }

  /**
   * Classify VM type based on patterns
   */
  private classifyVMType(dispatchers: VMDispatcher[], code: string): VMAnalysis['vmType'] {
    if (VM_PATTERNS.SWITCH_DISPATCH.test(code)) {
      return 'switch-dispatch';
    }
    
    if (VM_PATTERNS.JUMP_TABLE.test(code)) {
      return 'jump-table';
    }
    
    if (VM_PATTERNS.COMPUTED_GOTO.test(code)) {
      return 'computed-goto';
    }

    if (dispatchers.length > 0) {
      return 'custom';
    }

    return 'unknown';
  }

  /**
   * Extract VM patterns
   */
  private extractPatterns(code: string): readonly VMDispatchPattern[] {
    const patterns: VMDispatchPattern[] = [];
    
    for (const [name, pattern] of Object.entries(VM_PATTERNS)) {
      if (pattern.test(code)) {
        patterns.push(name as VMDispatchPattern);
      }
    }

    return patterns;
  }

  /**
   * Calculate enhanced confidence based on static analysis
   */
  private calculateEnhancedConfidence(
    opcodeDefinitions: Map<number, VirtualOpcode>,
    dispatchers: VMDispatcher[],
    patterns: readonly VMDispatchPattern[]
  ): number {
    if (opcodeDefinitions.size === 0) {
      return 0; // No static analysis succeeded
    }
    
    let score = 0.4; // Base score for successful static analysis
    
    // Boost for number of analyzed opcodes
    if (opcodeDefinitions.size > 5) score += 0.2;
    if (opcodeDefinitions.size > 15) score += 0.1;
    if (opcodeDefinitions.size > 30) score += 0.1;
    
    // Boost for high-confidence opcode definitions
    let highConfidenceOpcodes = 0;
    for (const opcode of Array.from(opcodeDefinitions.values())) {
      if (opcode.confidence > 0.8) {
        highConfidenceOpcodes++;
      }
    }
    
    if (highConfidenceOpcodes > opcodeDefinitions.size * 0.5) {
      score += 0.1;
    }
    
    // VM architecture detection bonus
    const architecture = this.staticAnalyzer.getVMArchitecture();
    if (architecture !== 'stack') { // Non-default architecture detected
      score += 0.05;
    }
    
    // Dispatcher count
    if (dispatchers.length > 0) score += 0.05;
    if (dispatchers.length > 1) score += 0.05;
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate confidence score (legacy method)
   */
  private calculateConfidence(
    dispatchers: VMDispatcher[],
    opcodeTable: ReadonlyMap<number, string>,
    patterns: readonly VMDispatchPattern[]
  ): number {
    let score = 0;
    
    // Dispatcher detection
    if (dispatchers.length > 0) score += 0.3;
    if (dispatchers.length > 1) score += 0.1;
    
    // Opcode table
    if (opcodeTable.size > 5) score += 0.3;
    if (opcodeTable.size > 20) score += 0.1;
    
    // Pattern matches
    score += patterns.length * 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Count virtual registers in code
   */
  private countVirtualRegisters(code: string): number {
    const registerPattern = /v\d+|r\d+|reg\d+/g;
    const matches = Array.from(code.matchAll(registerPattern));
    const uniqueRegisters = new Set(matches.map(m => m[0]));
    return uniqueRegisters.size;
  }

  /**
   * Estimate VM stack depth
   */
  private estimateStackDepth(code: string): number {
    // Look for stack array size or push/pop patterns
    const stackPattern = /stack\s*\[\s*(\d+)\s*\]|new\s+Array\s*\(\s*(\d+)\s*\)/g;
    const matches = Array.from(code.matchAll(stackPattern));
    
    let maxSize = 0;
    for (const match of matches) {
      const size = parseInt(match[1] || match[2] || '0', 10);
      maxSize = Math.max(maxSize, size);
    }
    
    return maxSize || 256; // Default estimate
  }

  /**
   * Detect encrypted opcodes
   */
  private detectEncryption(bytecode: Uint8Array): boolean {
    // Look for XOR patterns or high entropy
    const entropy = this.calculateEntropy(bytecode);
    return entropy > 7.5; // High entropy suggests encryption
  }

  /**
   * Calculate Shannon entropy
   */
  private calculateEntropy(data: Uint8Array): number {
    const frequencies = new Array(256).fill(0);
    
    for (const byte of Array.from(data)) {
      frequencies[byte]++;
    }
    
    let entropy = 0;
    for (const freq of frequencies) {
      if (freq > 0) {
        const probability = freq / data.length;
        entropy -= probability * Math.log2(probability);
      }
    }
    
    return entropy;
  }

  /**
   * Count switch cases
   */
  private countSwitchCases(code: string, startIndex: number): number {
    const switchBlock = this.extractBlock(code, startIndex);
    const caseMatches = switchBlock.match(/case\s+/g);
    return caseMatches?.length || 0;
  }

  /**
   * Estimate jump table size
   */
  private estimateJumpTableSize(code: string, startIndex: number): number {
    // This is a simplified heuristic
    return 32; // Default estimate
  }

  /**
   * Extract code block
   */
  private extractBlock(code: string, startIndex: number): string {
    let braceCount = 0;
    let i = startIndex;
    
    // Find opening brace
    while (i < code.length && code[i] !== '{') {
      i++;
    }
    
    const start = i;
    braceCount = 1;
    i++;
    
    // Find matching closing brace
    while (i < code.length && braceCount > 0) {
      if (code[i] === '{') braceCount++;
      else if (code[i] === '}') braceCount--;
      i++;
    }
    
    return code.slice(start, i);
  }

  /**
   * Extract virtual bytecode array from source
   */
  private extractVirtualBytecode(
    bytecode: Uint8Array,
    vmAnalysis: VMAnalysis
  ): readonly number[] {
    try {
      const code = new TextDecoder('utf-8').decode(bytecode);
      
      // Look for bytecode arrays - common patterns:
      // var bytecode = [1, 2, 3, ...]
      // const ops = new Uint8Array([...])
      
      const patterns = [
        /(?:bytecode|ops|instructions|code)\s*=\s*\[([\d,\s]+)\]/g,
        /new\s+Uint8Array\s*\(\s*\[([\d,\s]+)\]\s*\)/g,
        /\[([\d,\s]{100,})\]/g, // Long numeric arrays
      ];
      
      for (const pattern of patterns) {
        const matches = Array.from(code.matchAll(pattern));
        for (const match of matches) {
          const numbersStr = match[1];
          if (numbersStr) {
            const numbers = numbersStr
              .split(',')
              .map(s => parseInt(s.trim(), 10))
              .filter(n => !isNaN(n) && n >= 0 && n < 256);
            
            if (numbers.length > 10) { // Reasonable threshold
              return numbers;
            }
          }
        }
      }
      
      // Fallback: try to extract from the bytecode itself
      // Look for patterns that might be virtual opcodes
      const fallbackBytecode: number[] = [];
      for (let i = 0; i < Math.min(bytecode.length, 1000); i++) {
        const byte = bytecode[i];
        if (vmAnalysis.opcodeTable.has(byte)) {
          fallbackBytecode.push(byte);
        }
      }
      
      return fallbackBytecode;
      
    } catch (error) {
      console.warn('Failed to extract virtual bytecode:', error);
      return [];
    }
  }

  /**
   * Enhanced switch VM devirtualization with emulation fallback
   */
  private async devirtualizeSwitchVM(
    bytecode: Uint8Array,
    patterns: VMAnalysis
  ): Promise<LiftResult<IRProgram>> {
    try {
      // Try emulation-based approach first if available
      if (this.microEmulator) {
        const emulationResult = await this.emulateAndLift(bytecode, patterns);
        if (emulationResult.success) {
          const program = IRNodeFactory.program([emulationResult.data]);
          return {
            success: true,
            data: program,
            warnings: ['Switch VM devirtualized using micro-emulation'],
          };
        }
      }
      
      // Fallback to legacy pattern-based approach
      const statements: IRStatement[] = [];
      
      // Generate placeholder IR for each recognized opcode
      for (const [opcode, handler] of Array.from(patterns.opcodeTable)) {
        const comment = IRNodeFactory.expressionStatement(
          IRNodeFactory.literal(`// Opcode 0x${opcode.toString(16)}: ${handler}`)
        );
        statements.push(comment);
      }

      const program = IRNodeFactory.program(statements);
      
      return {
        success: true,
        data: program,
        warnings: ['Switch VM devirtualization used legacy pattern matching - IR may be incomplete'],
      };

    } catch (error) {
      return {
        success: false,
        error: `Switch VM devirtualization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Devirtualize jump table VM
   */
  private async devirtualizeJumpTableVM(
    bytecode: Uint8Array,
    patterns: VMAnalysis
  ): Promise<LiftResult<IRProgram>> {
    // Placeholder implementation
    return {
      success: false,
      error: 'Jump table VM devirtualization not implemented',
    };
  }

  /**
   * Devirtualize computed goto VM
   */
  private async devirtualizeComputedGotoVM(
    bytecode: Uint8Array,
    patterns: VMAnalysis
  ): Promise<LiftResult<IRProgram>> {
    // Placeholder implementation
    return {
      success: false,
      error: 'Computed goto VM devirtualization not implemented',
    };
  }

  /**
   * Enhanced generic VM devirtualization
   */
  private async devirtualizeGenericVM(
    bytecode: Uint8Array,
    patterns: VMAnalysis
  ): Promise<LiftResult<IRProgram>> {
    // Try emulation-based approach for unknown VM types
    if (this.microEmulator && patterns.confidence > 0.5) {
      const emulationResult = await this.emulateAndLift(bytecode, patterns);
      if (emulationResult.success) {
        const program = IRNodeFactory.program([emulationResult.data]);
        return {
          success: true,
          data: program,
          warnings: ['Generic VM devirtualized using micro-emulation - results may need validation'],
        };
      }
    }
    
    // Enhanced fallback with partial analysis
    const statements: IRStatement[] = [];
    const code = new TextDecoder('utf-8').decode(bytecode);
    
    // Add analysis comments
    statements.push(
      IRNodeFactory.expressionStatement(
        IRNodeFactory.literal(`// VM Type: ${patterns.vmType}`)
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.literal(`// Virtual Registers: ${patterns.virtualRegisters}`)
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.literal(`// Stack Depth: ${patterns.stackDepth}`)
      ),
      IRNodeFactory.expressionStatement(
        IRNodeFactory.literal(`// Opcodes Detected: ${patterns.opcodeTable.size}`)
      )
    );
    
    // Try to extract any recognizable patterns
    const extractedBytecode = this.extractVirtualBytecode(bytecode, patterns);
    if (extractedBytecode.length > 0) {
      statements.push(
        IRNodeFactory.expressionStatement(
          IRNodeFactory.literal(`// Virtual Bytecode Length: ${extractedBytecode.length}`)
        )
      );
    }
    
    const program = IRNodeFactory.program(statements);
    
    return {
      success: true,
      data: program,
      warnings: [
        'Generic VM devirtualization provided analysis only',
        'Manual intervention may be required for complete devirtualization'
      ],
    };
  }
}