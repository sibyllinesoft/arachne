/**
 * @fileoverview Bytecode lifter factory and registry
 * 
 * Central registry for all bytecode lifters with automatic format detection
 * and lifter instantiation. Supports feature flags and graceful degradation.
 */

import type {
  BytecodeLifter,
  BytecodeFormat,
  LifterFactory,
  LiftResult,
} from './base.js';
import { BYTECODE_FORMATS, BytecodeUtils } from './base.js';

// Import lifter implementations
import { createQuickJSLifter } from './quickjs/index.js';
import { createV8Lifter } from './v8/index.js';

/**
 * Lifter registry entry
 */
interface LifterRegistryEntry {
  readonly format: BytecodeFormat;
  readonly factory: () => BytecodeLifter | null;
  readonly priority: number; // Higher priority = preferred
  readonly isAvailable: boolean;
  readonly description: string;
}

/**
 * Main lifter factory implementation
 */
export class BytecodeLifterFactory implements LifterFactory {
  private readonly registry = new Map<BytecodeFormat, LifterRegistryEntry>();
  private readonly lifterCache = new Map<BytecodeFormat, BytecodeLifter>();

  constructor() {
    this.registerDefaultLifters();
  }

  /**
   * Create lifter for specific format
   */
  async createLifter(format: BytecodeFormat): Promise<BytecodeLifter | null> {
    // Check cache first
    const cached = this.lifterCache.get(format);
    if (cached) {
      return cached;
    }

    // Get registry entry
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

  /**
   * Get all supported formats
   */
  getSupportedFormats(): readonly BytecodeFormat[] {
    return Array.from(this.registry.keys()).filter(format => {
      const entry = this.registry.get(format);
      return entry && entry.isAvailable;
    });
  }

  /**
   * Check if format is supported
   */
  isFormatSupported(format: BytecodeFormat): boolean {
    const entry = this.registry.get(format);
    return entry?.isAvailable || false;
  }

  /**
   * Auto-detect format and create appropriate lifter
   */
  async createLifterForBytecode(bytecode: Uint8Array): Promise<LiftResult<{
    lifter: BytecodeLifter;
    format: BytecodeFormat;
  }>> {
    // Try to detect format
    const detectedFormat = BytecodeUtils.detectFormat(bytecode);
    
    if (detectedFormat) {
      const lifter = await this.createLifter(detectedFormat);
      if (lifter) {
        return {
          success: true,
          data: { lifter, format: detectedFormat },
          warnings: [],
        };
      } else {
        return {
          success: false,
          error: `No lifter available for detected format: ${detectedFormat}`,
        };
      }
    }

    // Try all available lifters to find one that can handle the bytecode
    const supportedFormats = this.getSupportedFormats();
    const errors: string[] = [];

    for (const format of supportedFormats) {
      try {
        const lifter = await this.createLifter(format);
        if (lifter) {
          // Test if lifter can handle this bytecode
          const metadataResult = await lifter.getMetadata(bytecode);
          if (metadataResult.success) {
            return {
              success: true,
              data: { lifter, format },
              warnings: [`Format auto-detected as ${format}`],
            };
          } else {
            errors.push(`${format}: ${(metadataResult as { success: false; error: string }).error}`);
          }
        }
      } catch (error) {
        errors.push(`${format}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: false,
      error: `Unable to find suitable lifter. Tried formats: ${supportedFormats.join(', ')}. Errors: ${errors.join('; ')}`,
    };
  }

  /**
   * Register lifter for format
   */
  registerLifter(
    format: BytecodeFormat,
    factory: () => BytecodeLifter | null,
    options: {
      priority?: number;
      description?: string;
    } = {}
  ): void {
    // Test if lifter is available
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

    // Clear cache for this format
    this.lifterCache.delete(format);
  }

  /**
   * Get registry information
   */
  getRegistry(): ReadonlyMap<BytecodeFormat, Omit<LifterRegistryEntry, 'factory'>> {
    const publicRegistry = new Map<BytecodeFormat, Omit<LifterRegistryEntry, 'factory'>>();
    
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

  /**
   * Register default lifters
   */
  private registerDefaultLifters(): void {
    // QuickJS lifter (always available)
    this.registerLifter(
      BYTECODE_FORMATS.QUICKJS,
      createQuickJSLifter,
      {
        priority: 100,
        description: 'QuickJS bytecode lifter with VM devirtualization',
      }
    );

    // V8 lifter (feature-flagged)
    this.registerLifter(
      BYTECODE_FORMATS.V8_IGNITION,
      createV8Lifter,
      {
        priority: 90,
        description: 'V8 Ignition bytecode lifter (experimental, requires --enable-v8)',
      }
    );
  }
}

/**
 * Singleton factory instance
 */
export const lifterFactory = new BytecodeLifterFactory();

/**
 * Convenience function to create lifter for bytecode
 */
export async function createLifterForBytecode(
  bytecode: Uint8Array
): Promise<LiftResult<{
  lifter: BytecodeLifter;
  format: BytecodeFormat;
}>> {
  return lifterFactory.createLifterForBytecode(bytecode);
}

/**
 * Convenience function to lift bytecode with auto-detection
 */
export async function liftBytecode(bytecode: Uint8Array) {
  const lifterResult = await createLifterForBytecode(bytecode);
  
  if (!lifterResult.success) {
    return lifterResult;
  }

  const { lifter } = lifterResult.data;
  const liftResult = await lifter.lift(bytecode);
  
  return {
    ...liftResult,
    warnings: [
      ...(lifterResult.warnings || []),
      ...(liftResult.warnings || []),
    ],
  };
}