# ArachneJS Usage Guide

Complete guide to using ArachneJS for JavaScript deobfuscation, from basic examples to advanced enterprise integration.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Command Reference](#command-reference)  
- [Real-World Examples](#real-world-examples)
- [Advanced Features](#advanced-features)
- [Integration Examples](#integration-examples)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Basic Usage

### Simple Deobfuscation

```bash
# Basic deobfuscation
node dist/cli/index.js analyze input.js -o output.js

# With verbose output
node dist/cli/index.js analyze input.js -v -o output.js

# Analyze without writing output
node dist/cli/index.js analyze input.js --dry-run
```

### Batch Processing

```bash
# Process multiple files
for file in *.obfuscated.js; do
    node dist/cli/index.js analyze "$file" -o "${file%.obfuscated.js}.clean.js"
done

# Process directory
find ./malware-samples -name "*.js" -exec node dist/cli/index.js analyze {} -o {}.clean \;
```

## Command Reference

### Core Commands

```bash
# Analyze and deobfuscate
node dist/cli/index.js analyze [options] <input>

# Interactive UI (if available)
node dist/cli/index.js ui [options]
```

### Analysis Options

```bash
-o, --output <file>      Output file path
-v, --verbose           Verbose analysis output
-d, --debug             Enable debug mode
-z, --z3                Enable Z3 constraint solving
-p, --passes <list>     Specify optimization passes
-t, --timeout <ms>      Analysis timeout in milliseconds
-m, --max-memory <mb>   Maximum memory usage
--dry-run              Analyze without writing output
--format <type>         Output format (js, json, ast)
```

### Advanced Options

```bash
--enable-sandbox        Enable sandboxed execution
--bytecode-analysis     Enable bytecode lifting analysis  
--property-testing      Enable property-based validation
--metrics              Generate detailed metrics report
--config <file>        Use custom configuration file
```

## Real-World Examples

### 1. String Array Obfuscation

**Input** (common obfuscation pattern):
```javascript
var _0x4f2a=['console','log','Hello','World','join'];
var _0x1b3c=function(_0x4f2a,_0x1b3c){_0x4f2a=_0x4f2a-0x0;var _0x2e4d=_0x4f2a[_0x4f2a];return _0x2e4d;};
_0x1b3c(0x0)[_0x1b3c(0x1)]([_0x1b3c(0x2),_0x1b3c(0x3)][_0x1b3c(0x4)](' '));
```

```bash
node dist/cli/index.js analyze string-array.js -o clean.js
```

**Output**:
```javascript  
console.log(['Hello', 'World'].join(' '));
```

### 2. Control Flow Flattening

**Input** (flattened control flow):
```javascript
function obfuscated() {
    var _0x123 = 0;
    while (true) {
        switch (_0x123) {
            case 0:
                console.log('Start');
                _0x123 = 1;
                break;
            case 1:
                console.log('Middle');
                _0x123 = 2;
                break;  
            case 2:
                console.log('End');
                return;
        }
    }
}
```

```bash
node dist/cli/index.js analyze control-flow.js -v -o clean.js
```

**Output**:
```javascript
function deobfuscated() {
    console.log('Start');
    console.log('Middle');
    console.log('End');
}
```

### 3. VM-Based Obfuscation

For advanced VM-based obfuscation, ArachneJS can analyze bytecode:

```bash
# Enable bytecode analysis for VM-based obfuscation
node dist/cli/index.js analyze vm-obfuscated.js --bytecode-analysis -o clean.js
```

### 4. Mathematical Obfuscation

For constraint-based mathematical obfuscation:

```bash
# Enable Z3 constraint solving
node dist/cli/index.js analyze math-obfuscated.js -z -o clean.js
```

## Advanced Features

### Constraint Solving with Z3

ArachneJS can solve mathematical constraints in obfuscated code:

```javascript
// Input with mathematical constraints
var x = (function(a) { return a * 2 + 3; })(5);
var y = (function(b) { return b - 13; })(x);
console.log(y);
```

```bash
# Use Z3 solver to resolve constraints
node dist/cli/index.js analyze constraints.js -z -v
```

### Property-Based Validation

Ensure deobfuscated code maintains original behavior:

```bash
# Enable property-based testing
node dist/cli/index.js analyze input.js --property-testing -o output.js
```

### Custom Pass Selection

Run specific optimization passes:

```bash
# Run only constant propagation and dead code elimination
node dist/cli/index.js analyze input.js -p "constant-propagation,dead-code-elimination"

# Available passes:
# - control-flow-deflattening
# - constant-propagation  
# - copy-propagation
# - dead-code-elimination
# - code-structuring
# - intelligent-renaming
```

## Integration Examples

### CI/CD Integration

```yaml
# .github/workflows/security-scan.yml
name: Security Analysis
on: [push, pull_request]

jobs:
  deobfuscate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup ArachneJS
        run: |
          npm install -g @sibyllinesoft/arachne
      - name: Analyze JavaScript
        run: |
          find . -name "*.js" -exec arachne analyze {} --metrics \;
```

### SIEM Integration

```bash
# Generate JSON metrics for SIEM ingestion
node dist/cli/index.js analyze suspicious.js --format json --metrics > analysis.json

# Example output structure:
{
  "file": "suspicious.js",
  "obfuscation_techniques": ["string_arrays", "control_flow_flattening"],
  "complexity_score": 8.5,
  "success_rate": 0.95,
  "execution_time_ms": 1250,
  "warnings": ["potential_malware_pattern"]
}
```

### Programmatic API

```javascript
const { ArachneAnalyzer } = require('@sibyllinesoft/arachne');

const analyzer = new ArachneAnalyzer({
    enableZ3: true,
    timeout: 30000,
    maxMemory: 512
});

// Analyze code
const result = await analyzer.analyze(sourceCode);
console.log(result.deobfuscated);
console.log(result.metrics);
```

## Performance Optimization

### Memory Management

```bash
# Limit memory usage for large files
node dist/cli/index.js analyze large-file.js -m 1024 -o clean.js

# Process large files in chunks
split -l 1000 huge-file.js chunk-
for chunk in chunk-*; do
    node dist/cli/index.js analyze "$chunk"
done
```

### Timeout Configuration

```bash
# Set analysis timeout for complex obfuscation
node dist/cli/index.js analyze complex.js -t 60000 -o clean.js
```

### Parallel Processing

```bash
# Process multiple files in parallel
ls *.js | xargs -n 1 -P 4 -I {} node dist/cli/index.js analyze {} -o {}.clean
```

## Troubleshooting

### Common Issues

#### 1. Out of Memory Errors
```bash
# Symptoms: "JavaScript heap out of memory"
# Solution: Increase memory limit
node --max-old-space-size=4096 dist/cli/index.js analyze large-file.js
```

#### 2. Analysis Timeout
```bash
# Symptoms: Analysis stops without completing  
# Solution: Increase timeout or disable complex analysis
node dist/cli/index.js analyze file.js -t 120000 --no-z3
```

#### 3. Unsupported Obfuscation
```bash
# Symptoms: "Unsupported expression type" warnings
# Solution: Enable additional analysis modes
node dist/cli/index.js analyze file.js --bytecode-analysis --enable-sandbox
```

#### 4. Build Issues
```bash
# Clean rebuild
rm -rf node_modules dist
npm install
npm run build
```

#### 5. Permission Errors
```bash
# Fix file permissions
chmod +x dist/cli/index.js

# Fix npm permissions  
sudo chown -R $(whoami) ~/.npm
```

### Debug Mode

Enable debug mode for detailed analysis information:

```bash
node dist/cli/index.js analyze file.js -d -v
```

Debug output includes:
- Pass-by-pass analysis results
- Memory usage statistics  
- Performance timing data
- Error stack traces
- AST transformation details

### Performance Profiling

```bash
# Profile analysis performance
node --prof dist/cli/index.js analyze file.js
node --prof-process isolate-*.log > profile.txt
```

### Getting Help

1. **Command Help**: `node dist/cli/index.js analyze --help`
2. **Verbose Output**: Always use `-v` flag for detailed information
3. **Debug Mode**: Use `-d` flag for troubleshooting
4. **Issue Reporting**: Include debug output when reporting bugs
5. **Community Support**: https://github.com/sibyllinesoft/arachne/discussions

---

## Advanced Configuration

### Custom Configuration File

Create `arachne.config.json`:

```json
{
  "analysis": {
    "timeout": 30000,
    "maxMemory": 1024,
    "enableZ3": true,
    "enableBytecodeAnalysis": false
  },
  "passes": [
    "control-flow-deflattening",
    "constant-propagation", 
    "dead-code-elimination",
    "intelligent-renaming"
  ],
  "output": {
    "format": "js",
    "preserveComments": false,
    "generateMetrics": true
  }
}
```

Use with: `node dist/cli/index.js analyze file.js --config arachne.config.json`

---

**Need more help?** Check the [API documentation](./api.md) for programmatic usage or [report issues](https://github.com/sibyllinesoft/arachne/issues) on GitHub.