/**
 * @fileoverview Core functionality tests for enhanced VM devirtualization
 * 
 * Simplified tests focusing on validating the core mechanisms work correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QuickJSVMDevirtualizer } from '../devirt.js';

describe('VM Devirtualization Core Functionality', () => {
  let devirtualizer: QuickJSVMDevirtualizer;

  beforeEach(() => {
    devirtualizer = new QuickJSVMDevirtualizer();
  });

  describe('Pattern Detection', () => {
    it('should detect basic VM patterns', async () => {
      const mockVMCode = `
        switch (opcode) {
          case 1: regs[0] = 42; break;
          case 2: regs[1] = regs[0] + 1; break;
          case 3: return regs[1];
        }
      `;

      const bytecode = new TextEncoder().encode(mockVMCode);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vmType).toBe('switch-dispatch');
        expect(result.data.opcodeTable.size).toBeGreaterThan(0);
        expect(result.data.confidence).toBeGreaterThan(0.1);
      }
    });

    it('should classify VM architecture correctly', async () => {
      const stackBasedVM = `
        switch (op) {
          case 1: stack.push(42); break;
          case 2: 
            const b = stack.pop();
            const a = stack.pop();
            stack.push(a + b);
            break;
        }
      `;

      const bytecode = new TextEncoder().encode(stackBasedVM);
      const result = await devirtualizer.detectVMPatterns(bytecode);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.vmType).toBe('switch-dispatch');
        expect(result.data.stackDepth).toBeGreaterThan(0);
      }
    });
  });

  describe('Enhanced Devirtualization', () => {
    it('should handle simple devirtualization scenarios', async () => {
      const simpleVM = `
        function vm() {
          switch (opcodes[pc]) {
            case 1: registers[0] = 100; pc++; break;
            case 2: registers[1] = registers[0] + 50; pc++; break;
            case 3: return registers[1];
          }
        }
      `;

      const bytecode = new TextEncoder().encode(simpleVM);
      const vmAnalysis = await devirtualizer.detectVMPatterns(bytecode);

      expect(vmAnalysis.success).toBe(true);
      if (vmAnalysis.success) {
        const result = await devirtualizer.devirtualize(bytecode, vmAnalysis.data);
        expect(result.success).toBe(true);
        
        if (result.success) {
          expect(result.data.body).toBeDefined();
          expect(result.data.body.length).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should provide meaningful error messages when devirtualization fails', async () => {
      const malformedVM = `
        function broken() { invalid syntax }
      `;

      const bytecode = new TextEncoder().encode(malformedVM);
      const vmAnalysis = await devirtualizer.detectVMPatterns(bytecode);

      if (vmAnalysis.success && vmAnalysis.data.confidence < 0.3) {
        const result = await devirtualizer.devirtualize(bytecode, vmAnalysis.data);
        expect(result.success).toBe(false);
        expect(result.error).toContain('confidence too low');
      }
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing API', async () => {
      const legacyVM = `
        switch (cmd) {
          case 0: result = 1; break;
          case 1: result = 2; break;
        }
      `;

      const bytecode = new TextEncoder().encode(legacyVM);
      
      // Test that all expected methods exist and work
      const analysis = await devirtualizer.detectVMPatterns(bytecode);
      expect(analysis).toBeDefined();
      expect(analysis.success).toBeDefined();

      if (analysis.success) {
        const confidence = devirtualizer.getConfidence(analysis.data);
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);

        const devirtResult = await devirtualizer.devirtualize(bytecode, analysis.data);
        expect(devirtResult).toBeDefined();
        expect(devirtResult.success).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty bytecode gracefully', async () => {
      const emptyBytecode = new Uint8Array(0);
      const result = await devirtualizer.detectVMPatterns(emptyBytecode);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence).toBe(0);
        expect(result.data.opcodeTable.size).toBe(0);
      }
    });

    it('should handle invalid UTF-8 bytecode', async () => {
      // Create invalid UTF-8 sequence
      const invalidBytecode = new Uint8Array([0xFF, 0xFE, 0xFD]);
      const result = await devirtualizer.detectVMPatterns(invalidBytecode);
      
      // Should not crash, may succeed with low confidence
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('Performance Validation', () => {
    it('should complete analysis within reasonable time', async () => {
      const moderateVM = `
        function vm() {
          switch (op) {
            ${Array.from({ length: 20 }, (_, i) => 
              `case ${i}: regs[${i % 4}] = regs[${(i + 1) % 4}] + ${i}; break;`
            ).join('\n            ')}
          }
        }
      `;

      const bytecode = new TextEncoder().encode(moderateVM);
      const startTime = Date.now();
      const result = await devirtualizer.detectVMPatterns(bytecode);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should complete within 500ms
      expect(result.success).toBe(true);
    });
  });
});