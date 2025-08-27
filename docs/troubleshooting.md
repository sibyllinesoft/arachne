# ArachneJS Troubleshooting Guide

**Solutions for common issues and problems when using ArachneJS.**

## Quick Diagnostics

Run these commands to check your installation:

```bash
# Check installation status
node --version  # Should be 22+
npm --version
node dist/cli/index.js --help  # Should show command help

# Test basic functionality
./run-example.sh

# Check build status
npm run build && echo "Build successful" || echo "Build failed"
```

## Installation Issues

### Node.js Version Problems

**Error:**
```
Error: The engine "node" is incompatible with this module. Expected version "^22.0.0".
```

**Solutions:**

**Option 1: Using NVM (Recommended)**
```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install and use Node 22
nvm install 22
nvm use 22
nvm alias default 22

# Verify
node --version  # Should show v22.x.x
```

**Option 2: Manual Installation**
- **Ubuntu/Debian:** `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -`
- **macOS:** `brew install node@22`
- **Windows:** Download from [nodejs.org](https://nodejs.org/)

### Build Failures

**Error:**
```
npm ERR! Build failed with TypeScript errors
```

**Solution:**
```bash
# Clean rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build

# Check for TypeScript issues
npm run type-check
```

**Error:**
```
Cannot find module '@types/node'
```

**Solution:**
```bash
# Reinstall TypeScript dependencies
npm install --save-dev @types/node typescript
npm run build
```

### Permission Errors

**Error:**
```
Permission denied: ./install.sh
EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solutions:**
```bash
# Make scripts executable
chmod +x install.sh run-example.sh

# Fix npm permissions (Linux/macOS)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Alternative: use npx for one-time runs
npx tsx src/cli/index.ts --help
```

## Runtime Issues

### Command Not Found

**Error:**
```
bash: node: command not found
dist/cli/index.js: No such file or directory
```

**Solutions:**
```bash
# Check if Node.js is installed
which node || echo "Node.js not found - install Node.js 22+"

# Check if project is built
ls -la dist/cli/index.js || npm run build

# Use absolute path if needed
$(which node) dist/cli/index.js --help
```

### Memory Issues

**Error:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

**Solutions:**
```bash
# Increase Node.js heap size
node --max-old-space-size=8192 dist/cli/index.js deobfuscate large-file.js

# Process files in smaller chunks
split -l 1000 large-file.js chunk_
for chunk in chunk_*; do
    node dist/cli/index.js deobfuscate "$chunk" -o "clean_$chunk"
done
cat clean_chunk_* > final-clean.js
rm chunk_* clean_chunk_*

# Use batch processing with limits
node dist/cli/index.js batch-deobfuscate ./files/ --parallel 1 --memory-limit 4096
```

### File Processing Issues

**Error:**
```
SyntaxError: Unexpected token in JSON
Error parsing JavaScript file
```

**Solutions:**
```bash
# Check file encoding
file input.js
head -c 100 input.js | xxd  # Look for BOM or unusual characters

# Try different parsing modes
node dist/cli/index.js deobfuscate input.js --loose-parsing
node dist/cli/index.js deobfuscate input.js --ecma-version 2023

# Validate JavaScript syntax
node -c input.js  # Check if Node can parse it
```

**Error:**
```
File too large: Maximum supported size is 10MB
```

**Solutions:**
```bash
# Split large files
split -b 5M large-file.js part_
for part in part_*; do
    node dist/cli/index.js deobfuscate "$part" -o "clean_$part"
done

# Use streaming mode (if available)
node dist/cli/index.js deobfuscate large-file.js --streaming
```

## Feature-Specific Issues

### Z3 Solver Problems

**Error:**
```
Z3 solver not found. Advanced constraint analysis disabled.
```

**Installation Solutions:**

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install z3
z3 --version  # Verify installation
```

**macOS:**
```bash
brew install z3
z3 --version  # Verify installation
```

**Windows:**
1. Download Z3 from [GitHub releases](https://github.com/Z3Prover/z3/releases)
2. Extract to `C:\z3\`
3. Add `C:\z3\bin` to PATH environment variable
4. Restart terminal and test: `z3 --version`

**Error:**
```
Z3 solver timeout or memory limit exceeded
```

**Solutions:**
```bash
# Increase timeouts
node dist/cli/index.js deobfuscate input.js --enable-z3 --z3-timeout 60000

# Reduce complexity
node dist/cli/index.js deobfuscate input.js --passes constprop,dce --no-z3

# Use simpler analysis first
node dist/cli/index.js deobfuscate input.js --basic-mode
```

### Python Component Issues

**Error:**
```
ModuleNotFoundError: No module named 'z3'
Python script failed to execute
```

**Solutions:**
```bash
# Install Python dependencies
pip install -r requirements.txt

# Use virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# OR: venv\Scripts\activate  # Windows
pip install -r requirements.txt

# Verify Python path
which python3
python3 --version
```

### Docker Issues

**Error:**
```
docker: Cannot connect to the Docker daemon
```

**Solutions:**
```bash
# Start Docker service
sudo systemctl start docker  # Linux
# OR: Start Docker Desktop  # macOS/Windows

# Check Docker status
docker --version
docker ps

# Rebuild container if needed
docker build -f infra/Dockerfile -t arachnejs .
```

**Error:**
```
Error response from daemon: pull access denied
```

**Solutions:**
```bash
# Build locally instead of pulling
docker build -f infra/Dockerfile -t arachnejs .

# Use Docker Compose
docker-compose -f infra/docker-compose.yml up --build
```

## Performance Issues

### Slow Processing

**Symptoms:** Deobfuscation takes unusually long time.

**Diagnostics:**
```bash
# Profile execution
time node dist/cli/index.js deobfuscate input.js -v

# Check file complexity
wc -l input.js  # Line count
grep -o "function\|var\|if" input.js | wc -l  # Complexity indicators
```

**Solutions:**
```bash
# Disable expensive passes
node dist/cli/index.js deobfuscate input.js --passes constprop,dce --no-z3

# Use parallel processing for multiple files
node dist/cli/index.js batch-deobfuscate ./files/ --parallel 4

# Set iteration limits
node dist/cli/index.js deobfuscate input.js --max-iterations 5
```

### High Memory Usage

**Symptoms:** System becomes unresponsive or swaps heavily.

**Solutions:**
```bash
# Monitor memory usage
top -p $(pgrep node)
ps aux | grep node

# Process smaller chunks
split -l 500 input.js chunk_
for chunk in chunk_*; do
    node --max-old-space-size=2048 dist/cli/index.js deobfuscate "$chunk"
done

# Use garbage collection tuning
node --optimize-for-size --gc-interval=100 dist/cli/index.js deobfuscate input.js
```

## Debugging and Diagnostics

### Enable Debug Mode

```bash
# Verbose output
node dist/cli/index.js deobfuscate input.js -v

# Debug logging
DEBUG=* node dist/cli/index.js deobfuscate input.js

# Save debug output
node dist/cli/index.js deobfuscate input.js -v 2>&1 | tee debug.log
```

### Generate Diagnostic Report

```bash
#!/bin/bash
# diagnostic-report.sh

echo "ArachneJS Diagnostic Report"
echo "=========================="
echo "Date: $(date)"
echo "User: $(whoami)"
echo "Working directory: $(pwd)"
echo ""

echo "System Information:"
echo "OS: $(uname -a)"
echo "Node: $(node --version 2>/dev/null || echo 'Not found')"
echo "NPM: $(npm --version 2>/dev/null || echo 'Not found')"
echo "Git: $(git --version 2>/dev/null || echo 'Not found')"
echo "Python: $(python3 --version 2>/dev/null || echo 'Not found')"
echo "Z3: $(z3 --version 2>/dev/null || echo 'Not found')"
echo "Docker: $(docker --version 2>/dev/null || echo 'Not found')"
echo ""

echo "Project Status:"
echo "Directory exists: $([ -d /home/nathan/Projects/arachne ] && echo 'Yes' || echo 'No')"
echo "Built: $([ -f dist/cli/index.js ] && echo 'Yes' || echo 'No')"
echo "Package.json: $([ -f package.json ] && echo 'Yes' || echo 'No')"
echo "Node modules: $([ -d node_modules ] && echo 'Yes' || echo 'No')"
echo ""

echo "Installation test:"
if node dist/cli/index.js --help > /dev/null 2>&1; then
    echo "CLI functional: Yes"
else
    echo "CLI functional: No"
fi

echo "Build test:"
if npm run build > /dev/null 2>&1; then
    echo "Build successful: Yes"
else
    echo "Build successful: No"
fi

echo ""
echo "Last 10 lines of build log:"
npm run build 2>&1 | tail -10
```

### Common Error Patterns

**Pattern:** `Cannot resolve module 'xxx'`
**Solution:** `npm install` or check for missing dependencies

**Pattern:** `TypeError: Cannot read property 'xxx' of undefined`
**Solution:** Check input file format or use `--loose-parsing`

**Pattern:** `Maximum call stack size exceeded`
**Solution:** Reduce complexity or increase stack size: `node --stack-size=2048`

**Pattern:** `EMFILE: too many open files`
**Solution:** Increase file limits: `ulimit -n 4096`

## Getting Help

### Self-Help Resources

1. **Check Documentation:**
   - [User Guide](./user-guide.md)
   - [Examples](./examples.md)
   - [Installation Guide](./installation.md)

2. **Test With Simple Examples:**
```bash
# Create minimal test case
echo "var a = 'test'; console.log(a);" > simple.js
node dist/cli/index.js deobfuscate simple.js
```

3. **Check Similar Issues:**
   - [GitHub Issues](https://github.com/arachnejs/deobfuscator/issues)
   - [GitHub Discussions](https://github.com/arachnejs/deobfuscator/discussions)

### Reporting Issues

When reporting issues, include:

```bash
# Run diagnostic script
./diagnostic-report.sh > diagnostic.txt

# Include:
# 1. Diagnostic report
# 2. Full error message/output
# 3. Input file (if possible to share)
# 4. Command that failed
# 5. Expected vs actual behavior
```

**Good Issue Template:**
```
## Environment
[Paste output of diagnostic-report.sh]

## Problem Description
Brief description of the issue

## Steps to Reproduce
1. Command used: `node dist/cli/index.js ...`
2. Input file characteristics (size, obfuscation type)
3. Expected output
4. Actual output/error

## Additional Context
- Related to specific obfuscation technique?
- Works with other files?
- Workarounds attempted?
```

### Emergency Workarounds

If ArachneJS completely fails:

1. **Use Basic Mode:**
```bash
node dist/cli/index.js deobfuscate input.js --basic-mode --no-advanced-passes
```

2. **Manual String Replacement:**
```bash
# For simple string arrays
sed -i 's/_0x[a-f0-9]\+\[0x[a-f0-9]\+\]/"REPLACED_STRING"/g' input.js
```

3. **Alternative Tools:**
   - Try other deobfuscators as fallback
   - Manual analysis with browser developer tools
   - Static analysis with AST explorers

Remember: ArachneJS is designed to handle complex cases that other tools cannot, so simple workarounds may not be sufficient for advanced obfuscation techniques.