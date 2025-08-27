# ArachneJS API Reference

**Complete reference for programmatic usage of ArachneJS deobfuscation capabilities.**

## Table of Contents

- [Quick Start](#quick-start)
- [Core Classes](#core-classes)
- [Configuration Options](#configuration-options)
- [Advanced APIs](#advanced-apis)
- [Integration Examples](#integration-examples)

## Quick Start

### Basic Deobfuscation

```typescript
import { DeobfuscatorBase } from './tests/utils/deobfuscator-base.js';

// Create a simple deobfuscator
class MyDeobfuscator extends DeobfuscatorBase {
  constructor() {
    super({
      verbose: true,
      enableConstantFolding: true,
      enableStringArrayDeobfuscation: true
    });
  }
}

// Use the deobfuscator
const deobfuscator = new MyDeobfuscator();
const cleanCode = deobfuscator.deobfuscate(obfuscatedCode);
console.log(cleanCode);
```

### Advanced Configuration

```typescript
import { AdvancedDeobfuscator } from './tests/examples/advanced-deobfuscation.js';

const deobfuscator = new AdvancedDeobfuscator({
  verbose: true,
  enableConstantFolding: true,
  enableStringArrayDeobfuscation: true,
  enableDeadCodeElimination: true,
  enableFunctionInlining: true,
  maxIterations: 10,
  enableZ3Solver: true
});

const result = deobfuscator.deobfuscate(complexObfuscatedCode);
```

## Core Classes

### DeobfuscatorBase

The foundation class for all deobfuscation operations.

```typescript
abstract class DeobfuscatorBase {
  constructor(config?: DeobfuscationConfig);
  
  // Main deobfuscation method
  deobfuscate(code: string): string;
  
  // Utility methods
  static readFile(filePath: string): string;
  static writeFile(filePath: string, content: string): void;
  
  // Analysis methods
  protected parseCode(code: string): any;
  protected applyTransformations(ast: any): void;
  protected generateCode(ast: any): string;
}
```

### Configuration Interface

```typescript
interface DeobfuscationConfig {
  verbose?: boolean;
  enableConstantFolding?: boolean;
  enableStringArrayDeobfuscation?: boolean;
  enableDeadCodeElimination?: boolean;
  enableFunctionInlining?: boolean;
  maxIterations?: number;
  enableZ3Solver?: boolean;
  timeout?: number;
  memoryLimit?: number;
}
```

### Analysis Result

```typescript
interface AnalysisResult {
  success: boolean;
  deobfuscatedCode?: string;
  statistics: DeobfuscationStatistics;
  warnings: string[];
  errors: string[];
}

interface DeobfuscationStatistics {
  originalSize: number;
  deobfuscatedSize: number;
  reductionPercentage: number;
  stringsReplaced: number;
  functionsInlined: number;
  deadCodeRemoved: number;
  processingTime: number;
}
```

## Configuration Options

### Basic Configuration

```typescript
const config: DeobfuscationConfig = {
  // Enable detailed logging
  verbose: true,
  
  // Core transformation passes
  enableConstantFolding: true,
  enableStringArrayDeobfuscation: true,
  enableDeadCodeElimination: false,
  enableFunctionInlining: false,
  
  // Performance limits
  maxIterations: 5,
  timeout: 30000, // 30 seconds
  memoryLimit: 512 // MB
};
```

### Advanced Configuration

```typescript
const advancedConfig: DeobfuscationConfig = {
  verbose: true,
  
  // Enable all transformation passes
  enableConstantFolding: true,
  enableStringArrayDeobfuscation: true,
  enableDeadCodeElimination: true,
  enableFunctionInlining: true,
  
  // Advanced features
  enableZ3Solver: true,
  
  // Higher limits for complex analysis
  maxIterations: 15,
  timeout: 120000, // 2 minutes
  memoryLimit: 2048 // 2GB
};
```

## Advanced APIs

### IR-Based Analysis

```typescript
import { IRProcessor } from './src/ir/index.js';

// Low-level IR analysis
const processor = new IRProcessor();

// Convert JavaScript to IR
const ir = processor.liftFromJavaScript(sourceCode);

// Build analysis structures
const cfg = processor.buildControlFlowGraph(ir);
const ssa = processor.convertToSSA(cfg);

// Apply specific passes
processor.applyConstantPropagation(ssa);
processor.applyDeadCodeElimination(ssa);

// Convert back to JavaScript
const result = processor.lowerToJavaScript(ssa);
```

### Constraint Solving

```typescript
import { Z3Solver } from './src/passes/z3-solver.js';

// Create constraint solver
const solver = new Z3Solver();

// Add constraints
solver.addConstraint('x > 0');
solver.addConstraint('x < 100');
solver.addConstraint('y = x * 2');

// Solve constraints
const model = solver.solve();
if (model) {
  console.log('x =', model.getValue('x'));
  console.log('y =', model.getValue('y'));
}
```

### Sandboxed Execution

```typescript
import { Sandbox } from './src/sandbox/index.js';

// Create sandbox environment
const sandbox = new Sandbox({
  timeout: 30000,
  memoryLimit: 256,
  allowNetworkAccess: false
});

// Execute code safely
const result = await sandbox.execute(suspiciousCode);
console.log('Output:', result.output);
console.log('Trace:', result.trace);
```

### Bytecode Analysis

```typescript
import { QuickJSLifter } from './src/lifters/quickjs/index.js';

// Analyze QuickJS bytecode
const lifter = new QuickJSLifter();
const ir = await lifter.liftBytecode(bytecodeBuffer);

// Convert to JavaScript
const reconstructed = lifter.generateJavaScript(ir);
```

## Pass Management

### Custom Pass Implementation

```typescript
import { Pass } from './src/passes/Pass.js';

class MyCustomPass extends Pass {
  name = 'my-custom-pass';
  
  dependencies(): string[] {
    return ['constant-propagation'];
  }
  
  run(ir: IR): boolean {
    let changed = false;
    
    // Custom analysis logic
    for (const [nodeId, node] of ir.nodes) {
      if (this.canOptimize(node)) {
        this.optimize(node);
        changed = true;
      }
    }
    
    return changed;
  }
  
  private canOptimize(node: IRNode): boolean {
    // Custom optimization detection
    return false;
  }
  
  private optimize(node: IRNode): void {
    // Custom optimization logic
  }
}
```

### Pass Manager Usage

```typescript
import { PassManager } from './src/passes/PassManager.js';

const passManager = new PassManager();

// Register custom pass
passManager.registerPass(new MyCustomPass());

// Run specific passes
const result = passManager.run(ir, [
  'constant-propagation',
  'my-custom-pass',
  'dead-code-elimination'
]);
```

## Integration Examples

### Express.js Web Service

```typescript
import express from 'express';
import { DeobfuscatorBase } from './arachne/tests/utils/deobfuscator-base.js';

const app = express();
app.use(express.json());

class APIDeobfuscator extends DeobfuscatorBase {
  constructor() {
    super({
      verbose: false,
      enableConstantFolding: true,
      enableStringArrayDeobfuscation: true,
      enableDeadCodeElimination: true,
      timeout: 30000
    });
  }
}

app.post('/deobfuscate', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code parameter required' });
    }
    
    const deobfuscator = new APIDeobfuscator();
    const result = deobfuscator.deobfuscate(code);
    
    res.json({
      success: true,
      deobfuscatedCode: result,
      originalSize: code.length,
      deobfuscatedSize: result.length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('ArachneJS API server running on port 3000');
});
```

### Batch Processing

```typescript
import fs from 'fs';
import path from 'path';
import { AdvancedDeobfuscator } from './arachne/tests/examples/advanced-deobfuscation.js';

async function batchDeobfuscate(inputDir: string, outputDir: string) {
  const deobfuscator = new AdvancedDeobfuscator({
    verbose: true,
    enableConstantFolding: true,
    enableStringArrayDeobfuscation: true,
    enableDeadCodeElimination: true,
    enableFunctionInlining: true
  });
  
  const files = fs.readdirSync(inputDir)
    .filter(file => file.endsWith('.js'));
  
  const results = [];
  
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, `clean_${file}`);
    
    try {
      console.log(`Processing: ${file}`);
      
      const obfuscatedCode = fs.readFileSync(inputPath, 'utf8');
      const startTime = Date.now();
      
      const cleanCode = deobfuscator.deobfuscate(obfuscatedCode);
      const endTime = Date.now();
      
      fs.writeFileSync(outputPath, cleanCode);
      
      results.push({
        file,
        success: true,
        originalSize: obfuscatedCode.length,
        cleanSize: cleanCode.length,
        processingTime: endTime - startTime
      });
      
    } catch (error) {
      console.error(`Error processing ${file}: ${error.message}`);
      results.push({
        file,
        success: false,
        error: error.message
      });
    }
  }
  
  // Generate summary report
  const summary = {
    totalFiles: files.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalTimeMs: results.reduce((sum, r) => sum + (r.processingTime || 0), 0),
    results
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'batch-summary.json'), 
    JSON.stringify(summary, null, 2)
  );
  
  return summary;
}

// Usage
batchDeobfuscate('./obfuscated-samples', './clean-output')
  .then(summary => {
    console.log(`Batch processing complete: ${summary.successful}/${summary.totalFiles} successful`);
  })
  .catch(error => {
    console.error('Batch processing failed:', error);
  });
```

### Stream Processing

```typescript
import { Transform } from 'stream';
import { DeobfuscatorBase } from './arachne/tests/utils/deobfuscator-base.js';

class DeobfuscationStream extends Transform {
  private deobfuscator: DeobfuscatorBase;
  
  constructor(options: DeobfuscationConfig = {}) {
    super({ objectMode: true });
    
    this.deobfuscator = new (class extends DeobfuscatorBase {
      constructor() {
        super(options);
      }
    })();
  }
  
  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      const { code, metadata } = chunk;
      const deobfuscatedCode = this.deobfuscator.deobfuscate(code);
      
      this.push({
        originalCode: code,
        deobfuscatedCode,
        metadata,
        stats: {
          originalSize: code.length,
          deobfuscatedSize: deobfuscatedCode.length,
          reductionPercent: ((code.length - deobfuscatedCode.length) / code.length * 100).toFixed(2)
        }
      });
      
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

// Usage
import { pipeline } from 'stream/promises';

async function streamProcess() {
  const deobfuscationStream = new DeobfuscationStream({
    verbose: false,
    enableConstantFolding: true,
    enableStringArrayDeobfuscation: true
  });
  
  await pipeline(
    inputStream,        // Source of obfuscated code
    deobfuscationStream,
    outputStream       // Destination for clean code
  );
}
```

## Error Handling

### Exception Types

```typescript
class DeobfuscationError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'DeobfuscationError';
  }
}

// Usage with try-catch
try {
  const result = deobfuscator.deobfuscate(code);
} catch (error) {
  if (error instanceof DeobfuscationError) {
    console.error(`Deobfuscation failed: ${error.message}`);
    console.error(`Error code: ${error.code}`);
    console.error(`Details:`, error.details);
  }
}
```

### Graceful Degradation

```typescript
function safeDeobfuscate(code: string): { success: boolean; result: string; error?: string } {
  try {
    const deobfuscator = new DeobfuscatorBase({
      verbose: false,
      enableConstantFolding: true,
      enableStringArrayDeobfuscation: true,
      timeout: 30000
    });
    
    const result = deobfuscator.deobfuscate(code);
    return { success: true, result };
    
  } catch (error) {
    // Return original code if deobfuscation fails
    return { 
      success: false, 
      result: code, 
      error: error.message 
    };
  }
}
```

## Performance Monitoring

### Metrics Collection

```typescript
interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsed: number;
  passResults: Map<string, PassMetrics>;
}

interface PassMetrics {
  duration: number;
  nodesProcessed: number;
  transformationsApplied: number;
}

class MetricsCollector {
  private metrics: PerformanceMetrics;
  
  startAnalysis(): void {
    this.metrics = {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      memoryUsed: process.memoryUsage().heapUsed,
      passResults: new Map()
    };
  }
  
  recordPassResult(passName: string, metrics: PassMetrics): void {
    this.metrics.passResults.set(passName, metrics);
  }
  
  endAnalysis(): PerformanceMetrics {
    this.metrics.endTime = Date.now();
    this.metrics.duration = this.metrics.endTime - this.metrics.startTime;
    return this.metrics;
  }
}
```

## Testing Integration

### Unit Testing Helper

```typescript
import { expect } from 'chai';

export function expectSemanticEquivalence(
  original: string, 
  deobfuscated: string
): void {
  // Execute both versions and compare outputs
  const originalOutput = executeJavaScript(original);
  const deobfuscatedOutput = executeJavaScript(deobfuscated);
  
  expect(deobfuscatedOutput).to.deep.equal(originalOutput);
}

// Usage in tests
describe('String Array Deobfuscation', () => {
  it('should preserve program semantics', () => {
    const obfuscated = `
      var arr = ['hello', 'world'];
      console.log(arr[0] + ' ' + arr[1]);
    `;
    
    const deobfuscator = new DeobfuscatorBase({
      enableStringArrayDeobfuscation: true
    });
    
    const result = deobfuscator.deobfuscate(obfuscated);
    
    expectSemanticEquivalence(obfuscated, result);
    expect(result).to.include('hello world');
  });
});
```

---

## Complete Example

Here's a comprehensive example showing multiple API features:

```typescript
import { AdvancedDeobfuscator } from './arachne/tests/examples/advanced-deobfuscation.js';
import { MetricsCollector } from './metrics.js';

async function comprehensiveDeobfuscation(code: string) {
  const metrics = new MetricsCollector();
  metrics.startAnalysis();
  
  try {
    // Create advanced deobfuscator with full configuration
    const deobfuscator = new AdvancedDeobfuscator({
      verbose: true,
      enableConstantFolding: true,
      enableStringArrayDeobfuscation: true,
      enableDeadCodeElimination: true,
      enableFunctionInlining: true,
      enableZ3Solver: true,
      maxIterations: 10,
      timeout: 60000,
      memoryLimit: 1024
    });
    
    // Perform deobfuscation
    const result = deobfuscator.deobfuscate(code);
    
    // Collect final metrics
    const finalMetrics = metrics.endAnalysis();
    
    return {
      success: true,
      originalCode: code,
      deobfuscatedCode: result,
      statistics: {
        originalSize: code.length,
        deobfuscatedSize: result.length,
        reductionPercent: ((code.length - result.length) / code.length * 100).toFixed(2),
        processingTime: finalMetrics.duration,
        memoryUsed: finalMetrics.memoryUsed
      },
      metrics: finalMetrics
    };
    
  } catch (error) {
    const finalMetrics = metrics.endAnalysis();
    
    return {
      success: false,
      error: error.message,
      metrics: finalMetrics
    };
  }
}

// Usage
comprehensiveDeobfuscation(obfuscatedCode)
  .then(result => {
    if (result.success) {
      console.log('Deobfuscation successful!');
      console.log(`Size reduction: ${result.statistics.reductionPercent}%`);
      console.log(`Processing time: ${result.statistics.processingTime}ms`);
    } else {
      console.error('Deobfuscation failed:', result.error);
    }
  });
```

This API reference provides the foundation for integrating ArachneJS into any JavaScript application or service. The modular design allows for fine-grained control over the deobfuscation process while providing sensible defaults for common use cases.