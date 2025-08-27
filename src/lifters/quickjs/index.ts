/**
 * @fileoverview QuickJS bytecode lifter implementation
 * 
 * Main entry point for QuickJS bytecode analysis and lifting.
 * Integrates parser, converter, and devirtualization components.
 */

import type {
  BytecodeLifter,
  BytecodeFormat,
  BytecodeMetadata,
  BytecodeModule,
  LiftResult,
  ValidationReport,
  ValidationIssue,
  VMDevirtualizer,
} from '../base.js';
import { BYTECODE_FORMATS, BytecodeUtils } from '../base.js';
import type { IRProgram } from '../../ir/nodes.js';

import { QuickJSParser } from './parser.js';
import { QuickJSInstructionConverter } from './converter.js';
import { QuickJSVMDevirtualizer } from './devirt.js';

/**
 * QuickJS bytecode lifter implementation
 */
export class QuickJSLifter implements BytecodeLifter {
  private readonly converter = new QuickJSInstructionConverter();
  private readonly devirtualizer: VMDevirtualizer = new QuickJSVMDevirtualizer();

  get supportedFormats(): readonly BytecodeFormat[] {
    return [BYTECODE_FORMATS.QUICKJS];
  }

  /**
   * Check if this lifter supports the format
   */
  supports(format: BytecodeFormat): boolean {
    return format === BYTECODE_FORMATS.QUICKJS;
  }

  /**
   * Extract metadata without full parsing
   */
  async getMetadata(bytecode: Uint8Array): Promise<LiftResult<BytecodeMetadata>> {
    try {
      // Quick validation
      const format = BytecodeUtils.detectFormat(bytecode);
      if (format !== BYTECODE_FORMATS.QUICKJS) {
        return {
          success: false,
          error: 'Not a QuickJS bytecode file',
        };
      }

      // Parse header only for metadata
      const parser = new QuickJSParser(bytecode);
      const result = await parser.parse();
      
      if (!result.success) {
        return {
          success: false,
          error: (result as { success: false; error: string }).error,
        };
      }

      return {
        success: true,
        data: result.data.metadata,
        warnings: result.warnings,
      };

    } catch (error) {
      return {
        success: false,
        error: `Metadata extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse complete bytecode module
   */
  async parse(bytecode: Uint8Array): Promise<LiftResult<BytecodeModule>> {
    try {
      const parser = new QuickJSParser(bytecode);
      return await parser.parse();

    } catch (error) {
      return {
        success: false,
        error: `Parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Lift bytecode to IR representation
   */
  async lift(bytecode: Uint8Array): Promise<LiftResult<IRProgram>> {
    try {
      // First parse the bytecode module
      const parseResult = await this.parse(bytecode);
      if (!parseResult.success) {
        return {
          success: false,
          error: (parseResult as { success: false; error: string }).error,
        };
      }

      const module = parseResult.data;

      // Check for VM obfuscation
      const vmResult = await this.devirtualizer.detectVMPatterns(bytecode);
      if (vmResult.success && vmResult.data.confidence > 0.6) {
        // High confidence VM detection - attempt devirtualization
        const devirtResult = await this.devirtualizer.devirtualize(bytecode, vmResult.data);
        if (devirtResult.success) {
          return {
            success: true,
            data: devirtResult.data,
            warnings: [
              ...parseResult.warnings,
              'VM devirtualization applied',
              ...devirtResult.warnings,
            ],
          };
        } else {
          // Devirtualization failed - fall back to standard lifting
          console.warn('VM devirtualization failed, falling back to standard lifting:', (devirtResult as { success: false; error: string }).error);
        }
      }

      // Standard bytecode lifting
      if (module.functions.length === 0) {
        return {
          success: false,
          error: 'No functions found in bytecode',
        };
      }

      // Lift the entry point function (typically index 0)
      const entryResult = await this.liftFunction(module, module.entryPointIndex);
      if (!entryResult.success) {
        return entryResult;
      }

      return {
        success: true,
        data: entryResult.data,
        warnings: [
          ...parseResult.warnings,
          ...entryResult.warnings,
        ],
      };

    } catch (error) {
      return {
        success: false,
        error: `Lift failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Lift specific function from module
   */
  async liftFunction(
    module: BytecodeModule,
    functionIndex: number
  ): Promise<LiftResult<IRProgram>> {
    try {
      if (functionIndex >= module.functions.length) {
        return {
          success: false,
          error: `Function index ${functionIndex} out of range`,
        };
      }

      const func = module.functions[functionIndex];
      
      // Decode instructions from bytecode
      const instructions = this.decodeInstructions(func.bytecode);

      // Convert to IR
      const conversionResult = await this.converter.convertToSSA(instructions, module.constants);
      if (!conversionResult.success) {
        return conversionResult;
      }

      return {
        success: true,
        data: conversionResult.data,
        warnings: conversionResult.warnings,
      };

    } catch (error) {
      return {
        success: false,
        error: `Function lift failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate lifted IR against original
   */
  async validate(
    original: BytecodeModule,
    lifted: IRProgram
  ): Promise<LiftResult<ValidationReport>> {
    try {
      // This is a simplified validation - real implementation would need
      // sophisticated semantic equivalence checking
      
      const functionMatches = new Map<string, boolean>();
      let constantMatches = true;
      let controlFlowMatches = true;
      const issues: ValidationIssue[] = [];

      // Validate function count
      const liftedFunctions = lifted.body.filter(stmt => stmt.type === 'FunctionDeclaration');
      if (liftedFunctions.length !== original.functions.length) {
        issues.push({
          type: 'structural',
          severity: 'medium',
          message: `Function count mismatch: original ${original.functions.length}, lifted ${liftedFunctions.length}`,
        });
      }

      // Validate each function
      for (let i = 0; i < Math.min(original.functions.length, liftedFunctions.length); i++) {
        const originalFunc = original.functions[i];
        const liftedFunc = liftedFunctions[i];
        
        const funcName = originalFunc.name || `function_${i}`;
        
        // Basic structural checks
        if (liftedFunc.type === 'FunctionDeclaration') {
          // Check parameter count
          if (liftedFunc.params.length !== originalFunc.parameterCount) {
            issues.push({
              type: 'structural',
              severity: 'high',
              message: `Parameter count mismatch in ${funcName}`,
              location: { function: funcName, instruction: 0 },
            });
            functionMatches.set(funcName, false);
          } else {
            functionMatches.set(funcName, true);
          }
        }
      }

      // Calculate confidence based on issues
      const criticalIssues = issues.filter(i => i.severity === 'critical').length;
      const highIssues = issues.filter(i => i.severity === 'high').length;
      const mediumIssues = issues.filter(i => i.severity === 'medium').length;
      
      const confidence = Math.max(0, 1.0 - 
        (criticalIssues * 0.5) - 
        (highIssues * 0.3) - 
        (mediumIssues * 0.1)
      );

      const report: ValidationReport = {
        isValid: criticalIssues === 0 && highIssues === 0,
        functionMatches,
        constantMatches,
        controlFlowMatches,
        issues,
        confidence,
      };

      return {
        success: true,
        data: report,
        warnings: [],
      };

    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Decode bytecode instructions
   */
  private decodeInstructions(bytecode: Uint8Array) {
    // Import decoder statically to avoid circular dependencies
    const { QuickJSInstructionDecoder } = require('./parser');
    const rawInstructions = QuickJSInstructionDecoder.decode(bytecode);
    
    return rawInstructions.map((raw, index) => ({
      opcode: raw.opcode,
      operands: raw.operands,
      offset: raw.offset,
      size: raw.size,
      mnemonic: `quickjs_${raw.opcode.toString(16)}`,
      stackEffect: this.calculateStackEffect(raw.opcode, raw.operands[0]),
      isJump: this.isJumpInstruction(raw.opcode),
      jumpTargets: this.getJumpTargets(raw.opcode, raw.offset, raw.operands[0]),
    }));
  }

  /**
   * Calculate instruction stack effect
   */
  private calculateStackEffect(opcode: number, operand?: number): number {
    // Import opcode utilities
    const { calculateStackEffect } = require('./opcodes');
    return calculateStackEffect(opcode, operand);
  }

  /**
   * Check if instruction is a jump
   */
  private isJumpInstruction(opcode: number): boolean {
    const { getInstructionInfo } = require('./opcodes');
    const info = getInstructionInfo(opcode);
    return info?.hasJump || false;
  }

  /**
   * Get jump targets for instruction
   */
  private getJumpTargets(opcode: number, offset: number, operand?: number): number[] {
    const { getJumpTargets } = require('./opcodes');
    return getJumpTargets(opcode, offset, operand);
  }
}

// Export factory function
export function createQuickJSLifter(): BytecodeLifter {
  return new QuickJSLifter();
}