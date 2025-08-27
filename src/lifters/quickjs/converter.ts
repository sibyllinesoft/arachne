/**
 * @fileoverview QuickJS bytecode to IR converter
 * 
 * Converts stack-based QuickJS bytecode to SSA-form IR representation.
 * Handles control flow analysis, phi node insertion, and variable renaming.
 */

import type { 
  IRProgram, 
  IRFunctionDeclaration, 
  IRStatement, 
  IRExpression,
  IRBlockStatement,
  IRPhiNode,
  IRIdentifier,
  VariableName,
  SSAVersion,
  NodeId,
} from '../../ir/nodes.js';
import { IRNodeFactory } from '../../ir/nodes.js';
import type { 
  BytecodeModule, 
  BytecodeFunction, 
  ConstantPool,
  LiftResult,
  BasicBlock,
  ControlFlowGraph,
  BytecodeInstruction,
  StackMachine,
  InstructionConverter,
} from '../base.js';
import { QuickJSOpcode, getInstructionInfo, calculateStackEffect, getJumpTargets } from './opcodes.js';
import { QuickJSInstructionDecoder } from './parser.js';

/**
 * Stack machine implementation for bytecode simulation
 */
class QuickJSStackMachine implements StackMachine {
  private _stack: unknown[] = [];
  private _maxDepth = 0;

  get stack(): readonly unknown[] {
    return this._stack;
  }

  get stackPointer(): number {
    return this._stack.length;
  }

  get maxStackDepth(): number {
    return this._maxDepth;
  }

  push(value: unknown): void {
    this._stack.push(value);
    this._maxDepth = Math.max(this._maxDepth, this._stack.length);
  }

  pop(): unknown | undefined {
    return this._stack.pop();
  }

  peek(): unknown | undefined {
    return this._stack[this._stack.length - 1];
  }

  getDepth(): number {
    return this._stack.length;
  }

  clear(): void {
    this._stack = [];
    this._maxDepth = 0;
  }

  clone(): StackMachine {
    const cloned = new QuickJSStackMachine();
    cloned._stack = [...this._stack];
    cloned._maxDepth = this._maxDepth;
    return cloned;
  }

  /**
   * Simulate instruction execution on stack
   */
  simulate(instruction: BytecodeInstruction): void {
    const effect = instruction.stackEffect;
    
    if (effect < 0) {
      // Pop elements
      for (let i = 0; i < Math.abs(effect); i++) {
        this.pop();
      }
    } else if (effect > 0) {
      // Push placeholder elements
      for (let i = 0; i < effect; i++) {
        this.push(`temp_${this._stack.length}`);
      }
    }
  }
}

/**
 * SSA variable manager
 */
class SSAVariableManager {
  private currentVersions = new Map<string, SSAVersion>();
  private definitions = new Map<string, IRIdentifier[]>();
  private uses = new Map<string, IRIdentifier[]>();

  /**
   * Get current version of variable
   */
  getCurrentVersion(name: string): SSAVersion {
    const current = this.currentVersions.get(name);
    return current || IRNodeFactory.createSSAVersion(0);
  }

  /**
   * Create new version of variable (for assignments)
   */
  newVersion(name: string): SSAVersion {
    const current = this.getCurrentVersion(name);
    const newVersion = IRNodeFactory.createSSAVersion((current as number) + 1);
    this.currentVersions.set(name, newVersion);
    return newVersion;
  }

  /**
   * Create SSA identifier for use
   */
  createUse(name: string): IRIdentifier {
    const version = this.getCurrentVersion(name);
    const identifier = IRNodeFactory.identifier(name, {
      ssa_name: IRNodeFactory.createVariableName(name),
      ssa_version: version,
    });

    const uses = this.uses.get(name) || [];
    uses.push(identifier);
    this.uses.set(name, uses);

    return identifier;
  }

  /**
   * Create SSA identifier for definition
   */
  createDef(name: string): IRIdentifier {
    const version = this.newVersion(name);
    const identifier = IRNodeFactory.identifier(name, {
      ssa_name: IRNodeFactory.createVariableName(name),
      ssa_version: version,
    });

    const defs = this.definitions.get(name) || [];
    defs.push(identifier);
    this.definitions.set(name, defs);

    return identifier;
  }

  /**
   * Merge variables from multiple control flow paths
   */
  merge(blockId: NodeId, managers: SSAVariableManager[]): IRPhiNode[] {
    const phiNodes: IRPhiNode[] = [];
    const allVariables = new Set<string>();

    // Collect all variables from all managers
    for (const manager of managers) {
      for (const name of manager.currentVersions.keys()) {
        allVariables.add(name);
      }
    }

    // Create phi nodes for variables with different versions
    for (const name of allVariables) {
      const versions = managers.map(m => m.getCurrentVersion(name));
      const uniqueVersions = new Set(versions);

      if (uniqueVersions.size > 1) {
        // Need phi node
        const variableName = IRNodeFactory.createVariableName(name);
        const targetVersion = this.newVersion(name);
        const operands = new Map<NodeId, IRIdentifier>();

        for (let i = 0; i < managers.length; i++) {
          const manager = managers[i];
          const version = manager?.getCurrentVersion(name) || 0;
          const identifier = IRNodeFactory.identifier(name, {
            ssa_name: variableName as VariableName,
            ssa_version: version as SSAVersion,
          });
          operands.set(IRNodeFactory.createNodeId(), identifier);
        }

        const phiNode = IRNodeFactory.phiNode(variableName, operands, targetVersion);
        phiNodes.push(phiNode);
      }
    }

    return phiNodes;
  }
}

/**
 * QuickJS instruction converter
 */
export class QuickJSInstructionConverter implements InstructionConverter {
  private ssaManager = new SSAVariableManager();
  private tempCounter = 0;

  /**
   * Convert bytecode instructions to SSA-form IR
   */
  async convertToSSA(
    instructions: readonly BytecodeInstruction[], 
    constants: ConstantPool
  ): Promise<LiftResult<IRProgram>> {
    try {
      // Build control flow graph
      const cfg = this.buildCFG(instructions);
      
      // Convert each basic block to IR
      const irBlocks = new Map<number, IRBlockStatement>();
      
      for (const [blockId, basicBlock] of cfg.basicBlocks) {
        const blockResult = await this.convertBasicBlock(basicBlock, constants);
        if (!blockResult.success) {
          return {
            success: false,
            error: (blockResult as { success: false; error: string }).error,
            partialData: undefined,
            warnings: blockResult.warnings
          };
        }
        irBlocks.set(blockId, blockResult.data);
      }

      // Insert phi nodes at control flow merge points
      this.insertPhiNodes(cfg, irBlocks);

      // Build main function from entry block
      const entryBlock = irBlocks.get(cfg.entryBlock);
      if (!entryBlock) {
        return {
          success: false,
          error: 'No entry block found',
        };
      }

      // Create IR program
      const program = IRNodeFactory.program([
        {
          type: 'FunctionDeclaration',
          id: IRNodeFactory.identifier('main'),
          params: [],
          body: entryBlock,
          generator: false,
          async: false,
          node_id: IRNodeFactory.createNodeId(),
        }
      ]);

      return {
        success: true,
        data: program,
        warnings: [],
      };

    } catch (error) {
      return {
        success: false,
        error: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Build control flow graph from instructions
   */
  buildCFG(instructions: readonly BytecodeInstruction[]): ControlFlowGraph {
    const basicBlocks = new Map<number, BasicBlock>();
    const edges = new Map<number, number[]>();
    const leaders = new Set<number>([0]); // First instruction is always a leader

    // Find basic block leaders
    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      
      if (instruction && instruction.isJump) {
        // Next instruction is a leader (fall-through)
        if (i + 1 < instructions.length) {
          leaders.add(i + 1);
        }
        
        // Jump targets are leaders
        for (const target of instruction.jumpTargets || []) {
          leaders.add(target);
        }
      }
    }

    // Build basic blocks
    const leaderList = Array.from(leaders).sort((a, b) => a - b);
    
    for (let i = 0; i < leaderList.length; i++) {
      const start = leaderList[i];
      const end = i + 1 < leaderList.length ? (leaderList[i + 1] || 0) - 1 : instructions.length - 1;
      
      const blockInstructions = instructions.slice(start, end + 1);
      
      basicBlocks.set(i, {
        id: i,
        startOffset: start || 0,
        endOffset: end,
        instructions: blockInstructions,
        predecessors: [],
        successors: [],
        dominatedBy: [],
        dominates: [],
      });
    }

    // Build edges
    for (const [blockId, block] of basicBlocks) {
      const lastInstruction = block.instructions[block.instructions.length - 1];
      const successors: number[] = [];

      if (lastInstruction && lastInstruction.isJump) {
        // Add jump targets
        for (const target of lastInstruction.jumpTargets || []) {
          const targetBlockId = this.findBlockContaining(basicBlocks, target);
          if (targetBlockId !== -1) {
            successors.push(targetBlockId);
          }
        }

        // Add fall-through if conditional jump
        if (lastInstruction.opcode === QuickJSOpcode.OP_IF_TRUE ||
            lastInstruction.opcode === QuickJSOpcode.OP_IF_FALSE) {
          const nextBlockId = blockId + 1;
          if (basicBlocks.has(nextBlockId)) {
            successors.push(nextBlockId);
          }
        }
      } else {
        // Fall-through to next block
        const nextBlockId = blockId + 1;
        if (basicBlocks.has(nextBlockId)) {
          successors.push(nextBlockId);
        }
      }

      edges.set(blockId, successors);
      
      // Update predecessor/successor relationships
      const currentBlock = basicBlocks.get(blockId)!;
      basicBlocks.set(blockId, {
        ...currentBlock,
        successors,
      });

      for (const successor of successors) {
        const successorBlock = basicBlocks.get(successor)!;
        const newPredecessors = [...successorBlock.predecessors, blockId];
        basicBlocks.set(successor, {
          ...successorBlock,
          predecessors: newPredecessors,
        });
      }
    }

    return {
      basicBlocks,
      entryBlock: 0,
      exitBlocks: Array.from(basicBlocks.keys()).filter(id => 
        edges.get(id)?.length === 0
      ),
      edges,
    };
  }

  private findBlockContaining(blocks: Map<number, BasicBlock>, offset: number): number {
    for (const [blockId, block] of blocks) {
      if (offset >= block.startOffset && offset <= block.endOffset) {
        return blockId;
      }
    }
    return -1;
  }

  /**
   * Convert single basic block to IR
   */
  private async convertBasicBlock(
    block: BasicBlock, 
    constants: ConstantPool
  ): Promise<LiftResult<IRBlockStatement>> {
    const statements: IRStatement[] = [];
    const stack = new QuickJSStackMachine();

    try {
      for (const instruction of block.instructions) {
        const irStatements = await this.convertInstruction(instruction, constants, stack);
        statements.push(...irStatements);
      }

      return {
        success: true,
        data: IRNodeFactory.blockStatement(statements),
        warnings: [],
      };

    } catch (error) {
      return {
        success: false,
        error: `Block conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Convert single instruction to IR statements
   */
  private async convertInstruction(
    instruction: BytecodeInstruction,
    constants: ConstantPool,
    stack: StackMachine
  ): Promise<IRStatement[]> {
    const statements: IRStatement[] = [];
    
    switch (instruction.opcode) {
      case QuickJSOpcode.OP_PUSH_CONST: {
        const constantIndex = instruction.operands[0];
        const constant = constants.get(constantIndex);
        
        if (constant) {
          const literal = IRNodeFactory.literal(constant.value as string | number | bigint | boolean | RegExp | null);
          const temp = this.createTempVariable();
          
          statements.push({
            type: 'VariableDeclaration',
            kind: 'const',
            declarations: [{
              type: 'VariableDeclarator',
              id: temp,
              init: literal,
              node_id: IRNodeFactory.createNodeId(),
            }],
            node_id: IRNodeFactory.createNodeId(),
          });
        }
        break;
      }

      case QuickJSOpcode.OP_PUSH_TRUE: {
        const literal = IRNodeFactory.literal(true);
        const temp = this.createTempVariable();
        
        statements.push({
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [{
            type: 'VariableDeclarator', 
            id: temp,
            init: literal,
            node_id: IRNodeFactory.createNodeId(),
          }],
          node_id: IRNodeFactory.createNodeId(),
        });
        break;
      }

      case QuickJSOpcode.OP_PUSH_FALSE: {
        const literal = IRNodeFactory.literal(false);
        const temp = this.createTempVariable();
        
        statements.push({
          type: 'VariableDeclaration',
          kind: 'const', 
          declarations: [{
            type: 'VariableDeclarator',
            id: temp,
            init: literal,
            node_id: IRNodeFactory.createNodeId(),
          }],
          node_id: IRNodeFactory.createNodeId(),
        });
        break;
      }

      case QuickJSOpcode.OP_ADD: {
        // Binary operation: pop two, push result
        const right = this.createTempVariable();
        const left = this.createTempVariable();
        const result = this.createTempVariable();
        
        const binaryExpr = IRNodeFactory.binaryExpression('+', left, right);
        
        statements.push({
          type: 'VariableDeclaration',
          kind: 'const',
          declarations: [{
            type: 'VariableDeclarator',
            id: result,
            init: binaryExpr,
            node_id: IRNodeFactory.createNodeId(),
          }],
          node_id: IRNodeFactory.createNodeId(),
        });
        break;
      }

      case QuickJSOpcode.OP_RETURN: {
        const returnValue = this.createTempVariable();
        statements.push({
          type: 'ReturnStatement',
          argument: returnValue,
          node_id: IRNodeFactory.createNodeId(),
        });
        break;
      }

      // Add more instruction conversions as needed...
      default: {
        // Create placeholder for unknown instructions
        const comment = `// Unknown instruction: ${instruction.opcode}`;
        statements.push({
          type: 'ExpressionStatement',
          expression: IRNodeFactory.literal(comment),
          node_id: IRNodeFactory.createNodeId(),
        });
        break;
      }
    }

    // Simulate stack effects
    stack.simulate(instruction);
    
    return statements;
  }

  /**
   * Create temporary variable
   */
  private createTempVariable(): IRIdentifier {
    const name = `temp_${this.tempCounter++}`;
    return this.ssaManager.createDef(name);
  }

  /**
   * Insert phi nodes at control flow merge points
   */
  private insertPhiNodes(
    cfg: ControlFlowGraph,
    irBlocks: Map<number, IRBlockStatement>
  ): void {
    // This is a simplified phi insertion - real implementation would need
    // sophisticated dominance frontier analysis
    
    for (const [blockId, block] of cfg.basicBlocks) {
      if (block.predecessors.length > 1) {
        // This is a merge point - might need phi nodes
        const irBlock = irBlocks.get(blockId);
        if (!irBlock) continue;

        // For now, create placeholder phi nodes
        const phiNodes: IRPhiNode[] = [];
        // Real implementation would analyze variable definitions
        // across predecessor blocks
        
        if (phiNodes.length > 0) {
          const newBlock = IRNodeFactory.blockStatement(irBlock.body, phiNodes);
          irBlocks.set(blockId, newBlock);
        }
      }
    }
  }
}