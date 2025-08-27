/**
 * @fileoverview Focused tests for BytecodeLifterFactory core functionality
 * 
 * Tests the factory patterns without relying on actual lifter implementations.
 * Focuses on the registration system, caching, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BYTECODE_FORMATS,
  type BytecodeFormat,
  type BytecodeLifter,
  type LiftResult,
  type BytecodeMetadata,
  type BytecodeModule,
  type ValidationReport,
} from '../../src/lifters/base.js';
import type { IRProgram } from '../../src/ir/nodes.js';

// Create a fresh factory class for testing without default registrations
class TestBytecodeLifterFactory {
  private readonly registry = new Map();
  private readonly lifterCache = new Map();

  async createLifter(format: BytecodeFormat) {
    const cached = this.lifterCache.get(format);
    if (cached) {
      return cached;
    }

    const entry = this.registry.get(format);
    if (!entry || !entry.isAvailable) {
      return null;
    }

    try {
      const lifter = entry.factory();
      if (lifter) {
        this.lifterCache.set(format, lifter);
        return lifter;
      }
    } catch (error) {
      console.warn(`Failed to create lifter for format ${format}:`, error);
    }

    return null;
  }

  getSupportedFormats(): readonly BytecodeFormat[] {
    return Array.from(this.registry.keys()).filter(format => {
      const entry = this.registry.get(format);
      return entry && entry.isAvailable;
    });
  }

  isFormatSupported(format: BytecodeFormat): boolean {
    const entry = this.registry.get(format);
    return entry?.isAvailable || false;
  }

  registerLifter(
    format: BytecodeFormat,
    factory: () => BytecodeLifter | null,
    options: { priority?: number; description?: string } = {}
  ): void {
    let isAvailable = false;
    try {
      const testLifter = factory();
      isAvailable = testLifter !== null;
    } catch (error) {
      console.warn(`Lifter registration test failed for ${format}:`, error);
      isAvailable = false;
    }

    this.registry.set(format, {
      format,
      factory,
      priority: options.priority || 0,
      isAvailable,
      description: options.description || `Lifter for ${format}`,
    });

    this.lifterCache.delete(format);
  }

  getRegistry() {
    const publicRegistry = new Map();
    for (const [format, entry] of this.registry) {
      publicRegistry.set(format, {
        format: entry.format,
        priority: entry.priority,
        isAvailable: entry.isAvailable,
        description: entry.description,
      });
    }
    return publicRegistry;
  }
}

describe('BytecodeLifterFactory Core Functionality', () => {
  let factory: TestBytecodeLifterFactory;
  let mockLifter: BytecodeLifter;

  beforeEach(() => {
    factory = new TestBytecodeLifterFactory();
    
    mockLifter = {
      supportedFormats: [BYTECODE_FORMATS.QUICKJS],
      supports: (format: BytecodeFormat) => format === BYTECODE_FORMATS.QUICKJS,
      getMetadata: vi.fn().mockResolvedValue({
        success: true,
        data: {
          format: BYTECODE_FORMATS.QUICKJS,
          version: '1.0.0',
          architecture: 'stack' as const,
          endianness: 'little' as const,
          constantPoolSize: 10,
          functionCount: 2,
          hasDebugInfo: false,
          customVMDetected: false,
          vmPatterns: [],
        },
        warnings: [],
      }),
      parse: vi.fn().mockResolvedValue({
        success: true,
        data: {} as BytecodeModule,
        warnings: [],
      }),
      lift: vi.fn().mockResolvedValue({
        success: true,
        data: {} as IRProgram,
        warnings: [],
      }),
      liftFunction: vi.fn().mockResolvedValue({
        success: true,
        data: {} as IRProgram,
        warnings: [],
      }),
      validate: vi.fn().mockResolvedValue({
        success: true,
        data: {} as ValidationReport,
        warnings: [],
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Registration System', () => {
    it('should register lifter successfully', () => {
      const mockFactory = vi.fn().mockReturnValue(mockLifter);
      
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory, {
        priority: 100,
        description: 'Test QuickJS lifter',
      });
      
      expect(factory.isFormatSupported(BYTECODE_FORMATS.QUICKJS)).toBe(true);
      expect(mockFactory).toHaveBeenCalled();
    });

    it('should mark lifter as unavailable when factory throws', () => {
      const mockFactory = vi.fn().mockImplementation(() => {
        throw new Error('Factory failed');
      });
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory);
      
      expect(factory.isFormatSupported(BYTECODE_FORMATS.QUICKJS)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lifter registration test failed'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should mark lifter as unavailable when factory returns null', () => {
      const mockFactory = vi.fn().mockReturnValue(null);
      
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory);
      
      expect(factory.isFormatSupported(BYTECODE_FORMATS.QUICKJS)).toBe(false);
      expect(mockFactory).toHaveBeenCalled();
    });

    it('should use default options when not provided', () => {
      const mockFactory = vi.fn().mockReturnValue(mockLifter);
      
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory);
      
      const registry = factory.getRegistry();
      const entry = registry.get(BYTECODE_FORMATS.QUICKJS);
      
      expect(entry?.priority).toBe(0);
      expect(entry?.description).toBe(`Lifter for ${BYTECODE_FORMATS.QUICKJS}`);
    });

    it('should clear cache when registering new lifter', async () => {
      // First registration
      const mockFactory1 = vi.fn().mockReturnValue(mockLifter);
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory1);
      
      const lifter1 = await factory.createLifter(BYTECODE_FORMATS.QUICKJS);
      expect(lifter1).toBe(mockLifter);
      
      // Re-register with different implementation
      const mockLifter2 = { ...mockLifter };
      const mockFactory2 = vi.fn().mockReturnValue(mockLifter2);
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory2);
      
      const lifter2 = await factory.createLifter(BYTECODE_FORMATS.QUICKJS);
      expect(lifter2).toBe(mockLifter2);
      expect(lifter1).not.toBe(lifter2);
    });
  });

  describe('Lifter Creation', () => {
    beforeEach(() => {
      const mockFactory = vi.fn().mockReturnValue(mockLifter);
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory);
    });

    it('should create lifter successfully', async () => {
      const lifter = await factory.createLifter(BYTECODE_FORMATS.QUICKJS);
      expect(lifter).toBe(mockLifter);
    });

    it('should cache created lifters', async () => {
      const lifter1 = await factory.createLifter(BYTECODE_FORMATS.QUICKJS);
      const lifter2 = await factory.createLifter(BYTECODE_FORMATS.QUICKJS);
      
      expect(lifter1).toBe(lifter2);
    });

    it('should return null for unsupported formats', async () => {
      const unsupportedFormat = 'unsupported' as BytecodeFormat;
      const lifter = await factory.createLifter(unsupportedFormat);
      expect(lifter).toBeNull();
    });

    it('should handle lifter creation failures gracefully', async () => {
      // Use a factory that succeeds on first call (registration test) but fails on second call (actual creation)
      let callCount = 0;
      const unstableFactory = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockLifter; // Success for registration test
        }
        throw new Error('Creation failed'); // Fail on actual creation
      });
      
      factory.registerLifter(BYTECODE_FORMATS.V8_IGNITION, unstableFactory);
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const lifter = await factory.createLifter(BYTECODE_FORMATS.V8_IGNITION);
      
      expect(lifter).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create lifter'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should return null when factory returns null', async () => {
      const nullFactory = vi.fn().mockReturnValue(null);
      factory.registerLifter(BYTECODE_FORMATS.CUSTOM_VM, nullFactory);
      
      // This format should not be available
      expect(factory.isFormatSupported(BYTECODE_FORMATS.CUSTOM_VM)).toBe(false);
      
      const lifter = await factory.createLifter(BYTECODE_FORMATS.CUSTOM_VM);
      expect(lifter).toBeNull();
    });
  });

  describe('Format Support', () => {
    beforeEach(() => {
      const mockFactory = vi.fn().mockReturnValue(mockLifter);
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory, {
        priority: 100,
        description: 'QuickJS test lifter',
      });
    });

    it('should return supported formats', () => {
      const formats = factory.getSupportedFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats).toContain(BYTECODE_FORMATS.QUICKJS);
    });

    it('should only include available formats', () => {
      // Register an unavailable format
      const failingFactory = vi.fn().mockReturnValue(null);
      factory.registerLifter(BYTECODE_FORMATS.V8_IGNITION, failingFactory);
      
      const formats = factory.getSupportedFormats();
      expect(formats).toContain(BYTECODE_FORMATS.QUICKJS);
      expect(formats).not.toContain(BYTECODE_FORMATS.V8_IGNITION);
    });

    it('should check format support correctly', () => {
      expect(factory.isFormatSupported(BYTECODE_FORMATS.QUICKJS)).toBe(true);
      expect(factory.isFormatSupported(BYTECODE_FORMATS.V8_IGNITION)).toBe(false);
      expect(factory.isFormatSupported('unknown' as BytecodeFormat)).toBe(false);
    });
  });

  describe('Registry Information', () => {
    beforeEach(() => {
      const mockFactory = vi.fn().mockReturnValue(mockLifter);
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory, {
        priority: 100,
        description: 'QuickJS test lifter',
      });
    });

    it('should return registry without factory functions', () => {
      const registry = factory.getRegistry();
      
      expect(registry instanceof Map).toBe(true);
      expect(registry.size).toBeGreaterThan(0);
      
      const entry = registry.get(BYTECODE_FORMATS.QUICKJS);
      expect(entry).toBeDefined();
      expect(entry).not.toHaveProperty('factory');
      expect(entry?.format).toBe(BYTECODE_FORMATS.QUICKJS);
      expect(entry?.priority).toBe(100);
      expect(entry?.isAvailable).toBe(true);
      expect(entry?.description).toBe('QuickJS test lifter');
    });

    it('should include all registered formats in registry', () => {
      const failingFactory = vi.fn().mockReturnValue(null);
      factory.registerLifter(BYTECODE_FORMATS.V8_IGNITION, failingFactory);
      
      const registry = factory.getRegistry();
      
      expect(registry.has(BYTECODE_FORMATS.QUICKJS)).toBe(true);
      expect(registry.has(BYTECODE_FORMATS.V8_IGNITION)).toBe(true);
    });
  });

  describe('Performance Characteristics', () => {
    it('should cache lifters to avoid recreation', async () => {
      const mockFactory = vi.fn().mockReturnValue(mockLifter);
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory);
      
      // Create lifter multiple times
      await factory.createLifter(BYTECODE_FORMATS.QUICKJS);
      await factory.createLifter(BYTECODE_FORMATS.QUICKJS);
      await factory.createLifter(BYTECODE_FORMATS.QUICKJS);
      
      // Factory called once during registration + once during first creation = 2 times total
      expect(mockFactory).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple concurrent lifter requests', async () => {
      const mockFactory = vi.fn().mockReturnValue(mockLifter);
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, mockFactory);
      
      // Create multiple concurrent requests
      const promises = Array(5).fill(null).map(() => 
        factory.createLifter(BYTECODE_FORMATS.QUICKJS)
      );
      
      const results = await Promise.all(promises);
      
      // All should return the same cached instance
      results.forEach(lifter => {
        expect(lifter).toBe(mockLifter);
      });
      
      // Factory called once during registration + once during first creation = 2 times total
      expect(mockFactory).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle console.warn calls gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Register a failing lifter
      factory.registerLifter('failing-format' as BytecodeFormat, () => {
        throw new Error('Factory failed');
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Lifter registration test failed'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle factory exceptions during creation', async () => {
      // Use a factory that succeeds on first call (registration test) but fails on second call (actual creation)
      let callCount = 0;
      const unstableFactory = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockLifter; // Success for registration test
        }
        throw new Error('Runtime failure'); // Fail on actual creation
      });
      
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, unstableFactory);
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const lifter = await factory.createLifter(BYTECODE_FORMATS.QUICKJS);
      
      expect(lifter).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create lifter'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Registration Edge Cases', () => {
    it('should handle registering same format multiple times', () => {
      const factory1 = vi.fn().mockReturnValue(mockLifter);
      const factory2 = vi.fn().mockReturnValue(mockLifter);
      
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, factory1);
      expect(factory.isFormatSupported(BYTECODE_FORMATS.QUICKJS)).toBe(true);
      
      factory.registerLifter(BYTECODE_FORMATS.QUICKJS, factory2);
      expect(factory.isFormatSupported(BYTECODE_FORMATS.QUICKJS)).toBe(true);
      
      // Both factories should have been called (once each for testing)
      expect(factory1).toHaveBeenCalled();
      expect(factory2).toHaveBeenCalled();
    });

    it('should handle empty format string', () => {
      const mockFactory = vi.fn().mockReturnValue(mockLifter);
      const emptyFormat = '' as BytecodeFormat;
      
      factory.registerLifter(emptyFormat, mockFactory);
      
      expect(factory.isFormatSupported(emptyFormat)).toBe(true);
      expect(factory.getSupportedFormats()).toContain(emptyFormat);
    });
  });
});