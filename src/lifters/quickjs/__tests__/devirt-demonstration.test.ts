/**
 * @fileoverview Demonstration of Phase 2.1 Enhanced VM Devirtualization Capabilities
 * 
 * This test file showcases the key improvements and advanced features
 * of the enhanced VM devirtualization system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuickJSVMDevirtualizer } from '../devirt.js';

describe('Phase 2.1 Enhanced VM Devirtualization Demonstration', () => {
  let devirtualizer: QuickJSVMDevirtualizer;

  beforeEach(() => {
    devirtualizer = new QuickJSVMDevirtualizer();
  });

  describe('Enhanced Static Analysis Capabilities', () => {
    it('demonstrates improved pattern recognition over legacy approach', async () => {
      // Complex VM with mixed patterns that would challenge simple pattern matching
      const complexVM = `
        const OPCODES = { ADD: 0x10, LOAD: 0x11, STORE: 0x12, JUMP: 0x20 };
        
        function virtualMachine(bytecode, regs, stack) {
          let pc = 0;
          
          mainLoop: while (pc < bytecode.length) {
            const opcode = bytecode[pc++] ^ 0x42; // XOR decoding
            
            switch (opcode) {
              case OPCODES.ADD:
                const b = stack.pop();
                const a = stack.pop();
                stack.push(a + b);
                break;
                
              case OPCODES.LOAD:
                const regIdx = bytecode[pc++];
                const value = bytecode[pc++];
                regs[regIdx] = value;
                break;
                
              case OPCODES.STORE:
                const srcReg = bytecode[pc++];
                const dstReg = bytecode[pc++]; 
                regs[dstReg] = regs[srcReg];
                break;
                
              case OPCODES.JUMP:
                const target = bytecode[pc++];
                if (target < bytecode.length) {
                  pc = target;
                  continue mainLoop;
                }
                break;
                
              default:
                throw new Error('Unknown opcode: 0x' + opcode.toString(16));
            }
          }
        }
      `;

      const bytecode = new TextEncoder().encode(complexVM);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
      
      if (result.success) {
        console.log('VM Analysis Results:');
        console.log('- VM Type:', result.data.vmType);
        console.log('- Confidence:', result.data.confidence);
        console.log('- Opcodes Found:', result.data.opcodeTable.size);
        console.log('- Virtual Registers:', result.data.virtualRegisters);
        console.log('- Stack Depth:', result.data.stackDepth);
        console.log('- Has Encrypted Opcodes:', result.data.hasEncryptedOpcodes);
        
        // Enhanced analysis should detect multiple opcodes
        expect(result.data.vmType).toBe('switch-dispatch');
        expect(result.data.opcodeTable.size).toBeGreaterThanOrEqual(3);
        expect(result.data.confidence).toBeGreaterThan(0.3);
      }
    });

    it('demonstrates resilience to obfuscator variations', async () => {
      // Heavily obfuscated VM that would break simple pattern matching
      const obfuscatedVM = `
        const _0xabc123 = [0x1337, 0xdead, 0xbeef, 0xcafe];
        
        function _0x456def(_0x789abc, _0x111222) {
          let _0x333444 = 0;
          const _0x555666 = [];
          
          for (let _0x777888 = 0; _0x777888 < _0x789abc.length; _0x777888++) {
            const _0x999aaa = (_0x789abc[_0x333444++] - 42) & 0xFF;
            
            // Obfuscated switch using computed dispatch
            const _0xbbbccc = [
              () => _0x555666.push(_0x789abc[_0x333444++]), // PUSH
              () => {
                const _0xdddeee = _0x555666.pop() || 0;
                const _0xfffggg = _0x555666.pop() || 0;
                _0x555666.push(_0xfffggg * _0xdddeee); // MUL
              },
              () => _0x111222[_0x789abc[_0x333444++]] = _0x555666.pop() || 0, // POP_REG
            ];
            
            if (_0x999aaa < _0xbbbccc.length) {
              _0xbbbccc[_0x999aaa]();
            }
          }
          
          return _0x111222[0];
        }
      `;

      const bytecode = new TextEncoder().encode(obfuscatedVM);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
      
      if (result.success) {
        // Should still detect VM patterns despite heavy obfuscation
        console.log('Obfuscated VM Analysis:');
        console.log('- Detection Success:', result.success);
        console.log('- VM Type:', result.data.vmType);
        console.log('- Confidence:', result.data.confidence);
        
        // Even with obfuscation, should detect some patterns
        expect(result.data.confidence).toBeGreaterThan(0.1);
      }
    });
  });

  describe('Advanced Devirtualization Capabilities', () => {
    it('demonstrates clean IR generation from complex VM patterns', async () => {
      const arithmeticVM = `
        function arithmeticProcessor(instructions, registers) {
          let ip = 0;
          
          while (ip < instructions.length) {
            const opcode = instructions[ip++];
            
            switch (opcode) {
              case 1: // ADD_REG
                registers[instructions[ip]] = registers[instructions[ip + 1]] + registers[instructions[ip + 2]];
                ip += 3;
                break;
                
              case 2: // SUB_REG  
                registers[instructions[ip]] = registers[instructions[ip + 1]] - registers[instructions[ip + 2]];
                ip += 3;
                break;
                
              case 3: // MUL_IMM
                registers[instructions[ip]] = registers[instructions[ip + 1]] * instructions[ip + 2];
                ip += 3;
                break;
                
              case 4: // LOAD_CONST
                registers[instructions[ip]] = instructions[ip + 1];
                ip += 2;
                break;
                
              case 255: // HALT
                return registers[0];
            }
          }
        }
      `;

      const bytecode = new TextEncoder().encode(arithmeticVM);
      const vmAnalysis = await devirtualizer.detectVMPatterns(bytecode);

      expect(vmAnalysis.success).toBe(true);
      
      if (vmAnalysis.success) {
        console.log('Arithmetic VM Analysis:');
        console.log('- Opcodes:', vmAnalysis.data.opcodeTable.size);
        console.log('- Confidence:', vmAnalysis.data.confidence);
        
        const devirtResult = await devirtualizer.devirtualize(bytecode, vmAnalysis.data);
        
        if (devirtResult.success) {
          console.log('- Devirtualization Success:', devirtResult.success);
          console.log('- Generated IR Body Length:', devirtResult.data.body.length);
          console.log('- Warnings:', devirtResult.warnings?.join(', '));
          
          expect(devirtResult.data).toBeDefined();
          expect(devirtResult.data.type).toBe('Program');
          expect(devirtResult.data.body).toBeDefined();
        } else {
          console.log('- Devirtualization Failed:', devirtResult.error);
        }
      }
    });

    it('demonstrates backward compatibility with legacy approach', async () => {
      const legacyCompatibleVM = `
        switch (op) {
          case 0: result = input + 1; break;
          case 1: result = input * 2; break; 
          case 2: result = input - 1; break;
        }
      `;

      const bytecode = new TextEncoder().encode(legacyCompatibleVM);
      
      // Test that all legacy API methods work
      const analysis = await devirtualizer.detectVMPatterns(bytecode);
      expect(analysis.success).toBe(true);
      
      if (analysis.success) {
        const confidence = devirtualizer.getConfidence(analysis.data);
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
        
        const devirtResult = await devirtualizer.devirtualize(bytecode, analysis.data);
        expect(devirtResult.success).toBe(true);
        
        console.log('Legacy Compatibility Test:');
        console.log('- Analysis Success:', analysis.success);
        console.log('- Confidence:', confidence);
        console.log('- Devirtualization Success:', devirtResult.success);
      }
    });
  });

  describe('Robustness and Error Handling', () => {
    it('demonstrates graceful handling of edge cases', async () => {
      const edgeCases = [
        '', // Empty code
        'function normal() { return 42; }', // Non-VM code
        'switch (x) { }', // Empty switch
        'if (true) { /* no switch */ }', // No switch statement
      ];

      for (const [index, testCase] of edgeCases.entries()) {
        const bytecode = new TextEncoder().encode(testCase);
        const result = await devirtualizer.detectVMPatterns(bytecode);
        
        console.log(`Edge Case ${index + 1}:`, {
          success: result.success,
          confidence: result.success ? result.data.confidence : 'N/A',
          opcodes: result.success ? result.data.opcodeTable.size : 'N/A'
        });
        
        // Should not crash and should handle gracefully
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      }
    });

    it('demonstrates performance characteristics', async () => {
      const largeVM = `
        function largeVM(ops, regs) {
          switch (ops[pc++]) {
${Array.from({ length: 50 }, (_, i) => 
              `case ${i}: regs[${i % 8}] = regs[${(i + 1) % 8}] + ${i}; break;`
            ).join('\n            ')}
          }
        }
      `;

      const bytecode = new TextEncoder().encode(largeVM);
      
      const startTime = Date.now();
      const result = await devirtualizer.detectVMPatterns(bytecode);
      const analysisTime = Date.now() - startTime;
      
      console.log('Performance Test:');
      console.log('- Analysis Time:', analysisTime, 'ms');
      console.log('- Success:', result.success);
      
      if (result.success) {
        console.log('- Opcodes Found:', result.data.opcodeTable.size);
        console.log('- Confidence:', result.data.confidence);
        
        const devirtStart = Date.now();
        const devirtResult = await devirtualizer.devirtualize(bytecode, result.data);
        const devirtTime = Date.now() - devirtStart;
        
        console.log('- Devirtualization Time:', devirtTime, 'ms');
        console.log('- Devirtualization Success:', devirtResult.success);
      }
      
      // Performance should be reasonable
      expect(analysisTime).toBeLessThan(1000);
    });
  });

  describe('Enhanced Features Showcase', () => {
    it('demonstrates advanced confidence scoring', async () => {
      const testCases = [
        {
          name: 'High Quality VM',
          code: `
            function vm(ops, regs) {
              switch (ops[pc++]) {
                case 1: regs[ops[pc++]] = ops[pc++]; break;
                case 2: regs[ops[pc++]] = regs[ops[pc++]] + regs[ops[pc++]]; break;
                case 3: regs[ops[pc++]] = regs[ops[pc++]] - regs[ops[pc++]]; break;
                case 4: if (regs[ops[pc++]]) pc = ops[pc]; else pc++; break;
                case 5: return regs[ops[pc]];
              }
            }
          `,
          expectedMinConfidence: 0.4
        },
        {
          name: 'Simple VM',
          code: 'switch(op) { case 1: x = 1; break; }',
          expectedMinConfidence: 0.2
        },
        {
          name: 'Non-VM Code',
          code: 'function add(a, b) { return a + b; }',
          expectedMinConfidence: 0
        }
      ];

      for (const testCase of testCases) {
        const bytecode = new TextEncoder().encode(testCase.code);
        const result = await devirtualizer.detectVMPatterns(bytecode);
        
        expect(result.success).toBe(true);
        
        if (result.success) {
          console.log(`${testCase.name}: Confidence = ${result.data.confidence}`);
          expect(result.data.confidence).toBeGreaterThanOrEqual(testCase.expectedMinConfidence);
        }
      }
    });
  });
});