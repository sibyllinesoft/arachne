/**
 * @fileoverview Tests for enhanced VM devirtualization with micro-emulation
 * 
 * Phase 2.1 Enhancement Testing: Validates the new emulation-based
 * devirtualization capabilities and static analysis engine.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuickJSVMDevirtualizer } from '../devirt.js';
import type { VMAnalysis } from '../../base.js';

describe('Enhanced VM Devirtualization (Phase 2.1)', () => {
  let devirtualizer: QuickJSVMDevirtualizer;

  beforeEach(() => {
    devirtualizer = new QuickJSVMDevirtualizer();
  });

  describe('Static Analysis Engine', () => {
    it('should detect switch-based VM dispatchers with high confidence', async () => {
      const mockVMCode = `
        function vmDispatcher(bytecode, pc) {
          switch (bytecode[pc]) {
            case 0x01: // LOAD_CONST
              v_reg[bytecode[pc + 1]] = constants[bytecode[pc + 2]];
              return pc + 3;
            case 0x02: // ADD
              v_reg[bytecode[pc + 1]] = v_reg[bytecode[pc + 2]] + v_reg[bytecode[pc + 3]];
              return pc + 4;
            case 0x03: // JUMP
              return bytecode[pc + 1];
            case 0x04: // JUMP_IF_TRUE
              return v_reg[bytecode[pc + 1]] ? bytecode[pc + 2] : pc + 3;
            case 0x05: // RETURN
              return -1;
            default:
              throw new Error('Unknown opcode');
          }
        }
      `;

      const bytecode = new TextEncoder().encode(mockVMCode);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vmType).toBe('switch-dispatch');
        expect(result.data.confidence).toBeGreaterThan(0.6);
        expect(result.data.opcodeTable.size).toBeGreaterThan(0);
        expect(result.data.virtualRegisters).toBeGreaterThan(0);
      }
    });

    it('should extract semantic information from opcode handlers', async () => {
      const complexVMCode = `
        function complexVM(ops, regs, stack) {
          switch (ops[pc++]) {
            case 1: // Stack operations
              stack.push(regs[ops[pc++]]);
              break;
            case 2: // Arithmetic with stack effects
              const b = stack.pop();
              const a = stack.pop();
              stack.push(a * b);
              break;
            case 3: // Register-to-register move
              regs[ops[pc++]] = regs[ops[pc++]];
              break;
            case 4: // Conditional jump with complex condition
              if (regs[ops[pc]] > regs[ops[pc + 1]]) {
                pc = ops[pc + 2];
              } else {
                pc += 3;
              }
              break;
            case 5: // Call with stack manipulation
              stack.push(pc + 2);
              pc = ops[pc + 1];
              break;
          }
        }
      `;

      const bytecode = new TextEncoder().encode(complexVMCode);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence).toBeGreaterThan(0.5);
        expect(result.data.opcodeTable.size).toBeGreaterThan(3);
      }
    });

    it('should handle encrypted or obfuscated opcode patterns', async () => {
      const obfuscatedVM = `
        const _0x1234 = [0x41, 0x42, 0x43, 0x44, 0x45];
        function _0xabcd(_0x5678, _0x9abc) {
          const _0xdef0 = _0x5678[_0x9abc] ^ 0x55;
          switch (_0xdef0) {
            case 0x14: // XOR decoded ADD
              _0x2468[_0x1357] = _0x2468[_0x2468] + _0x2468[_0x3579];
              break;
            case 0x15: // XOR decoded LOAD
              _0x2468[_0x1357] = _0x1234[_0x2468];
              break;
          }
        }
      `;

      const bytecode = new TextEncoder().encode(obfuscatedVM);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hasEncryptedOpcodes).toBe(true);
        expect(result.data.confidence).toBeGreaterThan(0.3);
      }
    });
  });

  describe('Micro-Emulation Engine', () => {
    it('should emulate simple virtual machine execution', async () => {
      const simpleVM = `
        function vm(bytecode) {
          let pc = 0;
          const regs = new Array(16).fill(0);
          
          while (pc < bytecode.length) {
            switch (bytecode[pc++]) {
              case 1: // LOAD_IMM
                regs[bytecode[pc++]] = bytecode[pc++];
                break;
              case 2: // ADD_REG
                const dst = bytecode[pc++];
                const src1 = bytecode[pc++]; 
                const src2 = bytecode[pc++];
                regs[dst] = regs[src1] + regs[src2];
                break;
              case 3: // HALT
                return regs[0];
            }
          }
        }
      `;

      const bytecode = new TextEncoder().encode(simpleVM);
      const vmAnalysis = await devirtualizer.detectVMPatterns(bytecode);

      expect(vmAnalysis.success).toBe(true);
      if (vmAnalysis.success && vmAnalysis.data.confidence > 0.6) {
        const devirtuaResult = await devirtualizer.devirtualize(bytecode, vmAnalysis.data);
        expect(devirtuaResult.success).toBe(true);
        
        if (devirtuaResult.success) {
          expect(devirtuaResult.data.body.length).toBeGreaterThan(0);
          expect(devirtuaResult.warnings).toContain('Generated using micro-emulation');
        }
      }
    });

    it('should generate clean IR from emulated operations', async () => {
      const arithmeticVM = `
        function arithmeticProcessor(code, registers) {
          let ip = 0;
          while (ip < code.length) {
            const op = code[ip++];
            switch (op) {
              case 0x10: // ADD
                registers[code[ip]] = registers[code[ip + 1]] + registers[code[ip + 2]];
                ip += 3;
                break;
              case 0x11: // SUB
                registers[code[ip]] = registers[code[ip + 1]] - registers[code[ip + 2]];
                ip += 3;
                break;
              case 0x12: // MUL
                registers[code[ip]] = registers[code[ip + 1]] * registers[code[ip + 2]];
                ip += 3;
                break;
              case 0x13: // DIV
                registers[code[ip]] = registers[code[ip + 1]] / registers[code[ip + 2]];
                ip += 3;
                break;
              case 0xFF: // HALT
                return registers[0];
            }
          }
        }
      `;

      const bytecode = new TextEncoder().encode(arithmeticVM);
      const vmAnalysis = await devirtualizer.detectVMPatterns(bytecode);

      expect(vmAnalysis.success).toBe(true);
      if (vmAnalysis.success) {
        expect(vmAnalysis.data.vmType).toBe('switch-dispatch');
        expect(vmAnalysis.data.opcodeTable.size).toBeGreaterThan(3);
        
        const result = await devirtualizer.devirtualize(bytecode, vmAnalysis.data);
        expect(result.success).toBe(true);
      }
    });

    it('should handle complex control flow patterns', async () => {
      const controlFlowVM = `
        function controlFlowVM(instructions, regs) {
          let pc = 0;
          const stack = [];
          
          while (pc < instructions.length) {
            switch (instructions[pc++]) {
              case 1: // JUMP
                pc = instructions[pc];
                break;
              case 2: // JUMP_IF_ZERO
                if (regs[instructions[pc]] === 0) {
                  pc = instructions[pc + 1];
                } else {
                  pc += 2;
                }
                break;
              case 3: // CALL
                stack.push(pc + 1);
                pc = instructions[pc];
                break;
              case 4: // RETURN
                pc = stack.pop();
                break;
              case 5: // COMPARE
                const a = regs[instructions[pc++]];
                const b = regs[instructions[pc++]];
                regs[15] = a === b ? 1 : 0; // flags register
                break;
            }
          }
        }
      `;

      const bytecode = new TextEncoder().encode(controlFlowVM);
      const vmAnalysis = await devirtualizer.detectVMPatterns(bytecode);

      expect(vmAnalysis.success).toBe(true);
      if (vmAnalysis.success) {
        expect(vmAnalysis.data.confidence).toBeGreaterThan(0.5);
        
        const result = await devirtualizer.devirtualize(bytecode, vmAnalysis.data);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Resilience to Obfuscator Variations', () => {
    it('should handle renamed variables and functions', async () => {
      const renamedVM = `
        function _0x123abc(_0x456def, _0x789ghi) {
          let _0xabc123 = 0;
          const _0xdef456 = new Array(32).fill(0);
          
          while (_0xabc123 < _0x456def.length) {
            const _0xghi789 = _0x456def[_0xabc123++];
            switch (_0xghi789) {
              case 97: // 'a' obfuscated as ASCII
                _0xdef456[_0x456def[_0xabc123++]] = _0x456def[_0xabc123++];
                break;
              case 98: // 'b'
                _0xdef456[_0x456def[_0xabc123]] = _0xdef456[_0x456def[_0xabc123 + 1]] + _0xdef456[_0x456def[_0xabc123 + 2]];
                _0xabc123 += 3;
                break;
            }
          }
        }
      `;

      const bytecode = new TextEncoder().encode(renamedVM);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence).toBeGreaterThan(0.4);
        expect(result.data.vmType).toBe('switch-dispatch');
      }
    });

    it('should handle different switch statement formats', async () => {
      const weirdSwitchVM = `
        function vm(ops) {
          const op = ops[pc++];
          if (op === 1) {
            // ADD operation
            regs[ops[pc]] = regs[ops[pc + 1]] + regs[ops[pc + 2]];
            pc += 3;
          } else if (op === 2) {
            // LOAD operation  
            regs[ops[pc]] = constants[ops[pc + 1]];
            pc += 2;
          } else {
            switch (op) {
              case 3: regs[ops[pc++]] = regs[ops[pc++]]; break;
              case 4: pc = ops[pc]; break;
              default: throw new Error("Unknown op");
            }
          }
        }
      `;

      const bytecode = new TextEncoder().encode(weirdSwitchVM);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
      if (result.success) {
        // Even with weird control flow, should still detect some patterns
        expect(result.data.confidence).toBeGreaterThan(0.2);
      }
    });
  });

  describe('Integration with Existing System', () => {
    it('should maintain backward compatibility with pattern-based detection', async () => {
      const legacyVM = `
        // Legacy pattern that should still work
        switch (opcode) {
          case 1: stack.push(42); break;
          case 2: stack.pop(); break;
        }
      `;

      const bytecode = new TextEncoder().encode(legacyVM);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
    });

    it('should fall back gracefully when emulation fails', async () => {
      const malformedVM = `
        function broken() {
          switch (invalid syntax {
            case undefined behavior
          }
        }
      `;

      const bytecode = new TextEncoder().encode(malformedVM);
      const vmAnalysis: VMAnalysis = {
        vmType: 'switch-dispatch',
        dispatcherFunctions: [],
        opcodeTable: new Map(),
        virtualRegisters: 0,
        stackDepth: 0,
        hasEncryptedOpcodes: false,
        confidence: 0.8, // High confidence despite malformed code
        patterns: [],
      };

      const result = await devirtualizer.devirtualize(bytecode, vmAnalysis);
      
      // Should not crash and should provide fallback
      expect(result.success).toBe(true);
      if (result.success && result.warnings) {
        expect(result.warnings.some(w => w.includes('legacy'))).toBe(true);
      }
    });
  });

  describe('Performance and Robustness', () => {
    it('should handle large virtual machines efficiently', async () => {
      // Generate a large VM with many opcodes
      let largeVM = 'function largeVM(ops, regs) { switch (ops[pc++]) {';
      for (let i = 0; i < 100; i++) {
        largeVM += `case ${i}: regs[ops[pc++]] = regs[ops[pc++]] + ${i}; break;`;
      }
      largeVM += '}}';

      const bytecode = new TextEncoder().encode(largeVM);
      const start = Date.now();
      const result = await devirtualizer.detectVMPatterns(bytecode);
      const elapsed = Date.now() - start;

      expect(result.success).toBe(true);
      expect(elapsed).toBeLessThan(1000); // Should complete within 1 second
      
      if (result.success) {
        expect(result.data.opcodeTable.size).toBeGreaterThan(50);
      }
    });

    it('should prevent infinite loops in emulation', async () => {
      const infiniteLoopVM = `
        function badVM(ops) {
          let pc = 0;
          while (true) { // Intentional infinite loop
            switch (ops[pc]) {
              case 1: pc = 0; break; // Jump to start
              case 2: pc++; break;
            }
          }
        }
      `;

      const bytecode = new TextEncoder().encode(infiniteLoopVM);
      const vmAnalysis = await devirtualizer.detectVMPatterns(bytecode);

      if (vmAnalysis.success && vmAnalysis.data.confidence > 0.6) {
        const start = Date.now();
        const result = await devirtualizer.devirtualize(bytecode, vmAnalysis.data);
        const elapsed = Date.now() - start;

        // Should timeout gracefully within reasonable time
        expect(elapsed).toBeLessThan(5000);
        
        if (result.success && result.warnings) {
          expect(result.warnings.some(w => w.includes('step limit') || w.includes('infinite loop'))).toBe(true);
        }
      }
    });
  });
});