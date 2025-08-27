/**
 * @fileoverview Comprehensive tests for DeobfuscatorBase shared utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeobfuscatorBase, type DeobfuscationConfig, type DeobfuscationStats } from './deobfuscator-base.ts';
import * as fs from 'fs';
import * as path from 'path';

// Mock file system operations
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('path', () => ({
  dirname: vi.fn(),
}));

describe('DeobfuscatorBase', () => {
  let deobfuscator: DeobfuscatorBase;
  let consoleLogSpy: any;

  beforeEach(() => {
    deobfuscator = new DeobfuscatorBase();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const deob = new DeobfuscatorBase();
      const stats = deob.getStats();
      
      expect(stats.stringArraysFound).toBe(0);
      expect(stats.functionsInlined).toBe(0);
      expect(stats.constantsFolded).toBe(0);
      expect(stats.deadCodeRemoved).toBe(0);
      expect(stats.variablesRenamed).toBe(0);
    });

    it('should accept custom config', () => {
      const config: DeobfuscationConfig = {
        verbose: true,
        enableConstantFolding: false,
        enableFunctionInlining: false,
        enableDeadCodeElimination: false,
        enableStringArrayDeobfuscation: false,
      };

      const deob = new DeobfuscatorBase(config);
      
      // Test that config is applied by checking if verbose logging occurs
      const testCode = 'const x = 1;';
      deob.deobfuscate(testCode);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('deobfuscate', () => {
    it('should handle simple JavaScript code', () => {
      const code = 'const x = 42;';
      const result = deobfuscator.deobfuscate(code);
      
      expect(result).toContain('42');
    });

    it('should handle string array obfuscation', () => {
      const code = `
        const _0x1234 = ['hello', 'world'];
        const message = _0x1234(0);
      `;
      
      const result = deobfuscator.deobfuscate(code);
      
      // Should detect the string array
      const stats = deobfuscator.getStats();
      expect(stats.stringArraysFound).toBeGreaterThan(0);
    });

    it('should handle constant folding', () => {
      const code = `
        const SECRET = 'password';
        const value = SECRET;
      `;
      
      const result = deobfuscator.deobfuscate(code);
      
      // Should detect and fold constants
      const stats = deobfuscator.getStats();
      expect(stats.constantsFolded).toBeGreaterThan(0);
    });

    it('should throw error on invalid JavaScript', () => {
      const invalidCode = 'const x = ';
      
      expect(() => {
        deobfuscator.deobfuscate(invalidCode);
      }).toThrow('Failed to parse JavaScript');
    });
  });

  describe('parseJavaScript', () => {
    it('should parse valid JavaScript', () => {
      const code = 'function test() { return 42; }';
      const ast = (deobfuscator as any).parseJavaScript(code);
      
      expect(ast).toBeDefined();
      expect(ast.type).toBe('Program');
    });

    it('should throw error on invalid syntax', () => {
      const invalidCode = 'function {';
      
      expect(() => {
        (deobfuscator as any).parseJavaScript(invalidCode);
      }).toThrow('Failed to parse JavaScript');
    });
  });

  describe('analyzeObfuscationPatterns', () => {
    it('should detect string arrays', () => {
      const code = `
        const _0xabc = ['test', 'value'];
        const _0xdef = ['another', 'array'];
      `;
      const ast = (deobfuscator as any).parseJavaScript(code);
      (deobfuscator as any).analyzeObfuscationPatterns(ast);
      
      const stats = deobfuscator.getStats();
      expect(stats.stringArraysFound).toBe(2);
    });

    it('should detect functions', () => {
      const code = `
        function testFunc() { return 1; }
        function anotherFunc() { return 2; }
      `;
      const ast = (deobfuscator as any).parseJavaScript(code);
      (deobfuscator as any).analyzeObfuscationPatterns(ast);
      
      // Functions should be stored internally
      expect((deobfuscator as any).functions.has('testFunc')).toBe(true);
      expect((deobfuscator as any).functions.has('anotherFunc')).toBe(true);
    });

    it('should detect constants', () => {
      const code = `
        const NUM = 42;
        const STR = 'hello';
        const BOOL = true;
      `;
      const ast = (deobfuscator as any).parseJavaScript(code);
      (deobfuscator as any).analyzeObfuscationPatterns(ast);
      
      // Constants should be stored internally
      expect((deobfuscator as any).constants.has('NUM')).toBe(true);
      expect((deobfuscator as any).constants.has('STR')).toBe(true);
      expect((deobfuscator as any).constants.has('BOOL')).toBe(true);
    });
  });

  describe('transformStringArrayAccess', () => {
    it('should transform string array calls', () => {
      const code = `
        const _0x1234 = ['hello', 'world'];
        const message = _0x1234[0];
      `;
      const ast = (deobfuscator as any).parseJavaScript(code);
      
      // First analyze to detect string arrays
      (deobfuscator as any).analyzeObfuscationPatterns(ast);
      
      // Then transform array access patterns
      (deobfuscator as any).transformStringArrayAccess(ast);
      
      const stats = deobfuscator.getStats();
      expect(stats.stringArraysFound).toBe(1);
    });
  });

  describe('generateJavaScript', () => {
    it('should generate JavaScript from AST', () => {
      const code = 'const x = 42;';
      const ast = (deobfuscator as any).parseJavaScript(code);
      const result = (deobfuscator as any).generateJavaScript(ast);
      
      expect(result).toContain('const x = 42');
    });

    it('should handle generation errors', () => {
      const invalidAst = { type: 'Invalid' };
      
      expect(() => {
        (deobfuscator as any).generateJavaScript(invalidAst);
      }).toThrow('Failed to generate JavaScript');
    });
  });

  describe('isObfuscatedName', () => {
    it('should detect hex-style obfuscated names', () => {
      expect(DeobfuscatorBase.isObfuscatedName('_0x1234')).toBe(true);
      expect(DeobfuscatorBase.isObfuscatedName('_0xABCD')).toBe(true);
      expect(DeobfuscatorBase.isObfuscatedName('_0xabcd')).toBe(true);
    });

    it('should detect dollar-style obfuscated names', () => {
      expect(DeobfuscatorBase.isObfuscatedName('_$abc')).toBe(true);
      expect(DeobfuscatorBase.isObfuscatedName('_$123')).toBe(true);
    });

    it('should detect single letter names', () => {
      expect(DeobfuscatorBase.isObfuscatedName('x')).toBe(true);
      expect(DeobfuscatorBase.isObfuscatedName('A')).toBe(true);
    });

    it('should detect short names', () => {
      expect(DeobfuscatorBase.isObfuscatedName('ab')).toBe(true);
      expect(DeobfuscatorBase.isObfuscatedName('x1')).toBe(true);
    });

    it('should detect hex patterns', () => {
      expect(DeobfuscatorBase.isObfuscatedName('hex_123abc')).toBe(true);
      expect(DeobfuscatorBase.isObfuscatedName('test_123abc')).toBe(true);
    });

    it('should not flag normal variable names', () => {
      expect(DeobfuscatorBase.isObfuscatedName('normalVariableName')).toBe(false);
      expect(DeobfuscatorBase.isObfuscatedName('getUserData')).toBe(false);
      expect(DeobfuscatorBase.isObfuscatedName('config')).toBe(false);
      expect(DeobfuscatorBase.isObfuscatedName('message')).toBe(false);
    });
  });

  describe('static file operations', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('readFile', () => {
      it('should read file successfully', () => {
        const mockContent = 'file content';
        vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

        const result = DeobfuscatorBase.readFile('test.js');

        expect(fs.readFileSync).toHaveBeenCalledWith('test.js', 'utf8');
        expect(result).toBe(mockContent);
      });

      it('should throw error on read failure', () => {
        vi.mocked(fs.readFileSync).mockImplementation(() => {
          throw new Error('File not found');
        });

        expect(() => {
          DeobfuscatorBase.readFile('nonexistent.js');
        }).toThrow('Failed to read file nonexistent.js: File not found');
      });
    });

    describe('writeFile', () => {
      it('should write file successfully', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(path.dirname).mockReturnValue('/path/to');

        DeobfuscatorBase.writeFile('test.js', 'content');

        expect(fs.writeFileSync).toHaveBeenCalledWith('test.js', 'content', 'utf8');
      });

      it('should create directory if it does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        vi.mocked(path.dirname).mockReturnValue('/path/to');

        DeobfuscatorBase.writeFile('/path/to/test.js', 'content');

        expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to', { recursive: true });
        expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/test.js', 'content', 'utf8');
      });

      it('should throw error on write failure', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(path.dirname).mockReturnValue('/path/to');
        vi.mocked(fs.writeFileSync).mockImplementation(() => {
          throw new Error('Permission denied');
        });

        expect(() => {
          DeobfuscatorBase.writeFile('test.js', 'content');
        }).toThrow('Failed to write file test.js: Permission denied');
      });
    });
  });

  describe('walkAST', () => {
    it('should visit all nodes in AST', () => {
      const ast = (deobfuscator as any).parseJavaScript('const x = 1; const y = 2;');
      const visitedTypes: string[] = [];
      
      (deobfuscator as any).walkAST(ast, (node: any) => {
        visitedTypes.push(node.type);
      });
      
      expect(visitedTypes).toContain('Program');
      expect(visitedTypes).toContain('VariableDeclaration');
      expect(visitedTypes).toContain('VariableDeclarator');
      expect(visitedTypes).toContain('Identifier');
      expect(visitedTypes).toContain('Literal');
    });

    it('should handle arrays in AST', () => {
      const ast = (deobfuscator as any).parseJavaScript('function test() { return [1, 2, 3]; }');
      const visitedTypes: string[] = [];
      
      (deobfuscator as any).walkAST(ast, (node: any) => {
        visitedTypes.push(node.type);
      });
      
      expect(visitedTypes).toContain('ArrayExpression');
    });
  });

  describe('stats and logging', () => {
    it('should track statistics correctly', () => {
      const initialStats = deobfuscator.getStats();
      expect(initialStats).toEqual({
        stringArraysFound: 0,
        functionsInlined: 0,
        constantsFolded: 0,
        deadCodeRemoved: 0,
        variablesRenamed: 0,
      });
    });

    it('should not log in non-verbose mode', () => {
      const deob = new DeobfuscatorBase({ verbose: false });
      (deob as any).log('test message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log in verbose mode', () => {
      const deob = new DeobfuscatorBase({ verbose: true });
      (deob as any).log('test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith('test message');
    });

    it('should print stats in verbose mode', () => {
      const deob = new DeobfuscatorBase({ verbose: true });
      (deob as any).printStats();
      
      expect(consoleLogSpy).toHaveBeenCalledWith('\n📊 Deobfuscation Statistics:');
      expect(consoleLogSpy).toHaveBeenCalledWith('   String arrays found: 0');
      expect(consoleLogSpy).toHaveBeenCalledWith('   Constants folded: 0');
    });
  });

  describe('edge cases', () => {
    it('should handle empty code', () => {
      const result = deobfuscator.deobfuscate('');
      expect(result).toBe('');
    });

    it('should handle code with only comments', () => {
      const code = '// This is just a comment\n/* And a block comment */';
      const result = deobfuscator.deobfuscate(code);
      expect(result).toBeDefined();
    });

    it('should handle nested string arrays', () => {
      const code = `
        const outer = [['inner', 'array'], 'normal'];
        const nested = outer[0][0];
      `;
      const result = deobfuscator.deobfuscate(code);
      expect(result).toBeDefined();
    });

    it('should handle function expressions', () => {
      const code = `
        const func = function() { return 42; };
        const arrow = () => 'test';
      `;
      const result = deobfuscator.deobfuscate(code);
      expect(result).toBeDefined();
    });
  });

  describe('config options', () => {
    it('should respect enableConstantFolding flag', () => {
      const deob = new DeobfuscatorBase({ enableConstantFolding: false });
      const code = 'const X = 42; const Y = X;';
      
      deob.deobfuscate(code);
      const stats = deob.getStats();
      
      // Should not fold constants when disabled
      expect(stats.constantsFolded).toBe(0);
    });

    it('should respect enableStringArrayDeobfuscation flag', () => {
      const deob = new DeobfuscatorBase({ enableStringArrayDeobfuscation: false });
      const code = `const _0x1234 = ['hello']; const msg = _0x1234[0];`;
      
      deob.deobfuscate(code);
      const stats = deob.getStats();
      
      // Should not detect string arrays when disabled
      expect(stats.stringArraysFound).toBe(0);
    });
  });
});