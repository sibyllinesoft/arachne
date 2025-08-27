/**
 * @fileoverview Contract-based API validation system
 * 
 * Provides runtime validation of API contracts using JSON Schema.
 * Ensures provider/consumer compatibility and API evolution safety.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Import schema definitions
import lifterSchema from './lifter.schema.json';

/**
 * Contract validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly string[];
  readonly schemaVersion: string;
}

export interface ValidationError {
  readonly path: string;
  readonly message: string;
  readonly expectedType: string;
  readonly actualValue: unknown;
}

/**
 * Contract types for different API surfaces
 */
export enum ContractType {
  LIFTER = 'lifter',
  IR_MODULE = 'ir-module', 
  VM_ANALYSIS = 'vm-analysis',
  VALIDATION_REPORT = 'validation-report',
}

/**
 * Contract validator with schema caching and error formatting
 */
export class ContractValidator {
  private readonly ajv: Ajv;
  private readonly schemas = new Map<ContractType, object>();
  private readonly validators = new Map<ContractType, Ajv.ValidateFunction>();

  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true,
      verbose: true,
      strict: false,
      validateFormats: true,
    });
    addFormats(this.ajv);
    
    // Load schemas
    this.loadSchemas();
  }

  private loadSchemas(): void {
    // Register core schemas
    this.schemas.set(ContractType.LIFTER, lifterSchema);
    
    // Compile validators
    for (const [type, schema] of this.schemas) {
      try {
        const validator = this.ajv.compile(schema);
        this.validators.set(type, validator);
      } catch (error) {
        console.error(`Failed to compile schema for ${type}:`, error);
      }
    }
  }

  /**
   * Validate data against contract schema
   */
  validate(data: unknown, contractType: ContractType): ValidationResult {
    const validator = this.validators.get(contractType);
    if (!validator) {
      return {
        valid: false,
        errors: [{
          path: 'schema',
          message: `No validator found for contract type: ${contractType}`,
          expectedType: 'validator',
          actualValue: contractType,
        }],
        warnings: [],
        schemaVersion: '1.0.0',
      };
    }

    const valid = validator(data);
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!valid && validator.errors) {
      for (const error of validator.errors) {
        errors.push({
          path: error.instancePath || error.schemaPath || 'root',
          message: error.message || 'Unknown validation error',
          expectedType: error.schema?.toString() || 'unknown',
          actualValue: error.data,
        });
      }
    }

    return {
      valid,
      errors,
      warnings,
      schemaVersion: '1.0.0',
    };
  }

  /**
   * Validate BytecodeLifter implementation
   */
  validateLifter(lifter: unknown): ValidationResult {
    const result = this.validate(lifter, ContractType.LIFTER);
    
    // Additional semantic validation
    if (result.valid && lifter && typeof lifter === 'object') {
      const l = lifter as any;
      
      // Check method signatures exist
      const requiredMethods = ['supports', 'getMetadata', 'parse', 'lift'];
      const warnings: string[] = [...result.warnings];
      
      for (const method of requiredMethods) {
        if (typeof l[method] !== 'function') {
          warnings.push(`Method '${method}' should be a function`);
        }
      }
      
      // Check supported formats is not empty
      if (Array.isArray(l.supportedFormats) && l.supportedFormats.length === 0) {
        warnings.push('supportedFormats should not be empty');
      }
      
      return { ...result, warnings };
    }
    
    return result;
  }

  /**
   * Validate VM analysis results
   */
  validateVMAnalysis(analysis: unknown): ValidationResult {
    return this.validate(analysis, ContractType.VM_ANALYSIS);
  }

  /**
   * Validate validation report (meta!)
   */
  validateReport(report: unknown): ValidationResult {
    return this.validate(report, ContractType.VALIDATION_REPORT);
  }

  /**
   * Format validation errors for human reading
   */
  formatErrors(result: ValidationResult): string {
    if (result.valid) {
      return 'Validation passed';
    }

    const lines: string[] = ['Contract validation failed:'];
    
    for (const error of result.errors) {
      lines.push(`  • ${error.path}: ${error.message}`);
      if (error.actualValue !== undefined) {
        lines.push(`    Got: ${JSON.stringify(error.actualValue)}`);
        lines.push(`    Expected: ${error.expectedType}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('', 'Warnings:');
      for (const warning of result.warnings) {
        lines.push(`  ⚠ ${warning}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get schema definition for contract type
   */
  getSchema(contractType: ContractType): object | undefined {
    return this.schemas.get(contractType);
  }

  /**
   * Check if contract validator supports a type
   */
  supports(contractType: ContractType): boolean {
    return this.validators.has(contractType);
  }
}

/**
 * Provider/Consumer contract testing
 */
export interface ContractTest {
  readonly name: string;
  readonly description: string;
  readonly provider: ContractType;
  readonly consumer: ContractType;
  readonly testData: unknown;
  readonly expectedResult: 'pass' | 'fail' | 'warn';
}

export class ContractTestRunner {
  constructor(private readonly validator: ContractValidator) {}

  /**
   * Run provider/consumer compatibility tests
   */
  async runTests(tests: readonly ContractTest[]): Promise<ContractTestResult> {
    const results: ContractTestCaseResult[] = [];
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const test of tests) {
      const result = await this.runTest(test);
      results.push(result);
      
      switch (result.outcome) {
        case 'pass': passed++; break;
        case 'fail': failed++; break;  
        case 'warn': warnings++; break;
      }
    }

    return {
      totalTests: tests.length,
      passed,
      failed,
      warnings,
      results,
      success: failed === 0,
    };
  }

  private async runTest(test: ContractTest): Promise<ContractTestCaseResult> {
    const startTime = Date.now();
    
    try {
      // Validate provider contract
      const providerResult = this.validator.validate(test.testData, test.provider);
      
      // Check expected outcome
      const actualOutcome = this.determineOutcome(providerResult, test.expectedResult);
      const duration = Date.now() - startTime;
      
      return {
        name: test.name,
        description: test.description,
        outcome: actualOutcome,
        duration,
        validationResult: providerResult,
        error: actualOutcome === 'fail' ? 'Contract validation failed' : undefined,
      };
      
    } catch (error) {
      return {
        name: test.name,
        description: test.description, 
        outcome: 'fail',
        duration: Date.now() - startTime,
        validationResult: {
          valid: false,
          errors: [],
          warnings: [],
          schemaVersion: '1.0.0',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private determineOutcome(
    result: ValidationResult, 
    expected: 'pass' | 'fail' | 'warn'
  ): 'pass' | 'fail' | 'warn' {
    if (expected === 'fail') {
      return result.valid ? 'fail' : 'pass';
    }
    
    if (expected === 'warn') {
      return result.warnings.length > 0 ? 'pass' : 'warn';
    }
    
    // Expected 'pass'
    if (!result.valid) return 'fail';
    if (result.warnings.length > 0) return 'warn';
    return 'pass';
  }
}

export interface ContractTestResult {
  readonly totalTests: number;
  readonly passed: number;
  readonly failed: number;
  readonly warnings: number;
  readonly results: readonly ContractTestCaseResult[];
  readonly success: boolean;
}

export interface ContractTestCaseResult {
  readonly name: string;
  readonly description: string;
  readonly outcome: 'pass' | 'fail' | 'warn';
  readonly duration: number;
  readonly validationResult: ValidationResult;
  readonly error?: string;
}

/**
 * Contract evolution checker
 * Ensures API changes don't break existing consumers
 */
export class ContractEvolutionChecker {
  constructor(private readonly validator: ContractValidator) {}

  /**
   * Check if new schema is backward compatible with old schema
   */
  checkBackwardCompatibility(
    oldSchema: object,
    newSchema: object
  ): CompatibilityResult {
    // This is a simplified check - real implementation would need
    // sophisticated schema diff analysis
    const issues: CompatibilityIssue[] = [];
    const warnings: string[] = [];

    // Check for breaking changes
    const oldStr = JSON.stringify(oldSchema, null, 2);
    const newStr = JSON.stringify(newSchema, null, 2);
    
    if (oldStr !== newStr) {
      warnings.push('Schema has changed - manual review recommended');
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings,
      changeType: this.classifyChange(oldSchema, newSchema),
    };
  }

  private classifyChange(oldSchema: object, newSchema: object): ChangeType {
    // Simplified classification
    return 'patch'; // Would need sophisticated analysis
  }
}

export interface CompatibilityResult {
  readonly compatible: boolean;
  readonly issues: readonly CompatibilityIssue[];
  readonly warnings: readonly string[];
  readonly changeType: ChangeType;
}

export interface CompatibilityIssue {
  readonly type: 'breaking' | 'deprecated' | 'warning';
  readonly path: string;
  readonly message: string;
  readonly impact: 'high' | 'medium' | 'low';
}

export type ChangeType = 'major' | 'minor' | 'patch';

// Export singleton instance
export const contractValidator = new ContractValidator();