# ArachneJS User Guide

**Complete guide to using ArachneJS for JavaScript deobfuscation, from basic usage to advanced research applications.**

## Table of Contents

- [Getting Started](#getting-started)
- [Basic Usage](#basic-usage)  
- [Advanced Features](#advanced-features)
- [Command Reference](#command-reference)
- [Programmatic API](#programmatic-api)
- [Troubleshooting](#troubleshooting)
- [Performance Tips](#performance-tips)

## Getting Started

### Quick Installation

For most users, the basic installation provides all necessary features:

```bash
# Clone the repository
git clone https://github.com/arachnejs/deobfuscator.git
cd arachne

# Run automated installer
./install.sh

# Test installation
./run-example.sh
```

### Installation Options

Choose the installation type based on your needs:

```bash
# Basic: Core deobfuscation features
./install.sh --basic

# Advanced: Includes Z3 solver and Python components  
./install.sh --advanced

# Research: Full feature set for academic/research use
./install.sh --research

# Docker: Containerized environment
./install.sh --docker
```

## Basic Usage

### Simple Deobfuscation

The most common use case - cleaning up obfuscated JavaScript files:

```bash
# Basic deobfuscation
node dist/cli/index.js deobfuscate input.js -o output.js

# With progress output
node dist/cli/index.js deobfuscate input.js -v -o output.js

# Multiple files
node dist/cli/index.js batch-deobfuscate ./obfuscated_files/ --output ./clean/
```

### Real-World Example

**Input** (obfuscated.js):
```javascript
var _0x4f2a = ['test', 'hello', 'world', 'function', 'return'];
var _0x1b3c = function(a, b) { return a + b; };
var _0x2d4e = function() { return _0x4f2a[0]; };

function decoder(index) { 
    return _0x4f2a[index]; 
}

var message = decoder(1) + ' ' + decoder(2);
var unused_var = 'never used';
var result = _0x1b3c(5, 3);

console['log'](message);
console['log']('Result:', result);
```

**Command:**
```bash
node dist/cli/index.js deobfuscate obfuscated.js -v -o clean.js
```

**Output** (clean.js):
```javascript
var message = 'hello' + ' ' + 'world';
var result = 8;

console.log(message);
console.log('Result:', result);
```

### Understanding the Process

ArachneJS performs multiple analysis passes:

1. **Parse**: Convert JavaScript to Abstract Syntax Tree (AST)
2. **Lift**: Convert AST to Intermediate Representation (IR)
3. **Analyze**: Build Control Flow Graph (CFG) and Static Single Assignment (SSA)
4. **Transform**: Apply deobfuscation passes
5. **Generate**: Convert back to readable JavaScript

## Advanced Features

### IR Analysis and Visualization

Examine the internal representation for deep analysis:

```bash
# Dump intermediate representation
node dist/cli/index.js analyze input.js --dump-ir

# Generate analysis report
node dist/cli/index.js analyze input.js --report analysis.json

# Visualize control flow (requires UI component)
npm run ui:dev
# Navigate to http://localhost:3000 and load analysis.json
```

### Constraint Solving with Z3

For complex obfuscation that requires symbolic execution:

```bash
# Enable Z3 solver (requires Z3 installation)
node dist/cli/index.js deobfuscate complex.js --enable-z3 -o clean.js

# Symbolic execution with path constraints
node dist/cli/index.js analyze input.js --symbolic-execution --report paths.json
```

### Bytecode Analysis

Analyze JavaScript engines' bytecode directly:

```bash
# QuickJS bytecode analysis
node dist/cli/index.js lift bytecode.bin --format quickjs --analyze

# V8 bytecode (experimental)
node dist/cli/index.js lift v8-bytecode.bin --format v8 --experimental
```

### Sandboxed Execution

Safely execute suspicious code with tracing:

```bash
# Safe execution with timeout
node dist/cli/index.js run suspicious.js --sandbox --timeout 30s

# Execution with comprehensive tracing
node dist/cli/index.js run input.js --sandbox --trace --output trace.json

# Policy enforcement
node dist/cli/index.js run input.js --sandbox --policy strict --trace
```

## Command Reference

### `deobfuscate` - Main deobfuscation command

```bash
node dist/cli/index.js deobfuscate <input> [options]

Options:
  -o, --output <file>     Output file path
  -v, --verbose          Show detailed progress
  --enable-z3            Use Z3 constraint solver
  --passes <list>        Specific passes to run (comma-separated)
  --max-iterations <n>   Maximum optimization iterations
  --preserve-comments    Keep original comments
  --source-maps          Generate source maps
```

**Available passes:**
- `constprop` - Constant propagation
- `copyprop` - Copy propagation  
- `dce` - Dead code elimination
- `decoders` - String array decoders
- `deflatten` - Control flow unflattening
- `opaque` - Opaque predicate removal
- `rename` - Identifier renaming

### `analyze` - Deep analysis and inspection

```bash
node dist/cli/index.js analyze <input> [options]

Options:
  --dump-ir              Output intermediate representation
  --dump-cfg             Output control flow graph
  --dump-ssa             Output SSA form
  --report <file>        Generate analysis report (JSON)
  --metrics             Show deobfuscation metrics
  --symbolic-execution   Enable symbolic execution
  --enable-z3           Use constraint solving
```

### `lift` - Bytecode analysis

```bash
node dist/cli/index.js lift <bytecode> [options]

Options:
  --format <type>        Bytecode format (quickjs, v8)
  --analyze             Perform analysis after lifting
  --output <file>       Save lifted IR
  --experimental        Enable experimental features
```

### `run` - Sandboxed execution

```bash
node dist/cli/index.js run <input> [options]

Options:
  --sandbox             Enable sandboxed execution
  --timeout <duration>  Execution timeout (e.g., 30s, 5m)
  --trace              Enable execution tracing
  --policy <level>     Security policy (permissive, strict)
  --output <file>      Save execution trace
  --memory-limit <mb>  Memory limit for execution
```

### `batch-deobfuscate` - Process multiple files

```bash
node dist/cli/index.js batch-deobfuscate <input-dir> [options]

Options:
  --output <dir>        Output directory
  --pattern <glob>      File pattern (default: "*.js")
  --recursive          Process subdirectories
  --parallel <n>       Number of parallel processes
  --summary            Generate batch summary report
```

## Programmatic API

### Basic Deobfuscation

```typescript
import { DeobfuscatorBase } from './tests/utils/deobfuscator-base.js';

class MyDeobfuscator extends DeobfuscatorBase {
  constructor() {
    super({
      verbose: true,
      enableConstantFolding: true,
      enableStringArrayDeobfuscation: true,
      enableDeadCodeElimination: true
    });
  }
}

const deobfuscator = new MyDeobfuscator();
const cleanCode = deobfuscator.deobfuscate(obfuscatedCode);
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
console.log(`Success: ${result.length > 0}`);
```

### IR Analysis

```typescript
import { IRProcessor } from './src/ir/index.js';

const processor = new IRProcessor();
const ir = processor.liftFromJavaScript(sourceCode);
const cfg = processor.buildControlFlowGraph(ir);
const ssa = processor.convertToSSA(cfg);

// Apply analysis passes
processor.applyConstantPropagation(ssa);
processor.applyDeadCodeElimination(ssa);

const result = processor.lowerToJavaScript(ssa);
```

## Troubleshooting

### Common Issues

#### "Command not found" Error

**Problem:** `node dist/cli/index.js` returns command not found.

**Solution:**
```bash
# Rebuild the project
npm run build

# Check if dist directory exists
ls -la dist/

# If missing, run full build
npm install && npm run build
```

#### TypeScript Compilation Errors

**Problem:** Build fails with TypeScript errors.

**Solution:**
```bash
# Check TypeScript version
npx tsc --version

# Clean and rebuild
npm run clean
npm install
npm run build

# Run with verbose logging
npm run build -- --verbose
```

#### Z3 Solver Not Found

**Problem:** `--enable-z3` flag fails with "Z3 not found".

**Solution:**
```bash
# Install Z3 for your platform
# Ubuntu/Debian:
sudo apt-get install z3

# macOS:
brew install z3

# Windows:
# Download from https://github.com/Z3Prover/z3/releases

# Verify installation
z3 --version
```

#### Memory Issues with Large Files

**Problem:** Process runs out of memory on large JavaScript files.

**Solution:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=8192 dist/cli/index.js deobfuscate large-file.js

# Use batch processing for multiple files
node dist/cli/index.js batch-deobfuscate ./files/ --parallel 2

# Process in chunks
split -l 1000 large-file.js chunk_
for chunk in chunk_*; do
    node dist/cli/index.js deobfuscate "$chunk" -o "clean_$chunk"
done
```

### Debug Mode

Enable verbose logging for detailed diagnostics:

```bash
# Maximum verbosity
node dist/cli/index.js deobfuscate input.js -v --debug --trace-passes

# Save debug output
node dist/cli/index.js deobfuscate input.js -v 2>&1 | tee debug.log

# Test specific passes
node dist/cli/index.js deobfuscate input.js --passes constprop,dce -v
```

## Performance Tips

### Optimizing for Speed

For faster processing on large codebases:

```bash
# Disable expensive passes for speed
node dist/cli/index.js deobfuscate input.js --passes constprop,dce

# Use parallel batch processing
node dist/cli/index.js batch-deobfuscate ./files/ --parallel 4

# Skip Z3 solver for simple obfuscation
node dist/cli/index.js deobfuscate input.js --no-z3
```

### Optimizing for Quality

For maximum deobfuscation quality:

```bash
# Enable all advanced features
node dist/cli/index.js deobfuscate input.js --enable-z3 --max-iterations 20

# Use comprehensive pass pipeline
node dist/cli/index.js deobfuscate input.js --passes all

# Enable symbolic execution
node dist/cli/index.js analyze input.js --symbolic-execution --enable-z3
```

### Memory Management

For memory-efficient processing:

```bash
# Process files individually rather than in batch
for file in *.js; do
    node --max-old-space-size=2048 dist/cli/index.js deobfuscate "$file"
done

# Use streaming for very large files
node dist/cli/index.js deobfuscate huge-file.js --streaming --chunk-size 1MB
```

## Integration Examples

### CI/CD Pipeline

```yaml
# .github/workflows/deobfuscation.yml
name: Automated Deobfuscation
on: [push]

jobs:
  deobfuscate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install ArachneJS
        run: |
          git clone https://github.com/arachnejs/deobfuscator.git
          cd deobfuscator
          ./install.sh --advanced
      
      - name: Deobfuscate suspicious files
        run: |
          cd deobfuscator
          node dist/cli/index.js batch-deobfuscate ../suspicious-js/ --output ../clean/
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: deobfuscated-files
          path: clean/
```

### Security Pipeline Integration

```bash
#!/bin/bash
# security-scan.sh - Integration with security tools

# Deobfuscate suspicious JavaScript
node dist/cli/index.js batch-deobfuscate ./samples/ --output ./clean/

# Generate analysis reports
for file in clean/*.js; do
    node dist/cli/index.js analyze "$file" --report "reports/$(basename "$file" .js).json"
done

# Extract IOCs and indicators
python3 extract-iocs.py reports/*.json > indicators.txt

# Feed to SIEM or threat intelligence platform
curl -X POST -H "Content-Type: application/json" \
     -d @indicators.txt \
     https://siem.example.com/api/indicators
```

---

## Next Steps

- **Examples**: See [examples.md](./examples.md) for real-world use cases
- **Architecture**: Read [architecture.md](./architecture.md) for technical details  
- **API Reference**: Check [api.md](./api.md) for programmatic usage
- **Contributing**: View [../CONTRIBUTING.md](../CONTRIBUTING.md) for development

For additional help:
- [GitHub Issues](https://github.com/arachnejs/deobfuscator/issues)
- [Community Discussions](https://github.com/arachnejs/deobfuscator/discussions)