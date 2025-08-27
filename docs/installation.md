# ArachneJS Installation Guide

**Complete installation instructions for all platforms and use cases.**

## Quick Installation

For most users, the automated installer handles everything:

```bash
# Clone and install
git clone https://github.com/arachnejs/deobfuscator.git
cd arachne
./install.sh

# Test installation  
./run-example.sh
```

## Installation Types

### Basic Installation (Recommended)

Installs core deobfuscation features - perfect for most users:

```bash
./install.sh --basic
```

**Includes:**
- Node.js dependency checking
- Core JavaScript analysis and deobfuscation
- Basic string array and control flow analysis
- Command-line interface
- Example scripts

### Advanced Installation

Includes additional capabilities for complex analysis:

```bash
./install.sh --advanced
```

**Includes everything from Basic plus:**
- Z3 SMT solver for constraint analysis
- Python components for advanced testing
- Symbolic execution capabilities
- Enhanced obfuscation technique coverage

### Research Installation

Full feature set for academic and research use:

```bash
./install.sh --research
```

**Includes everything from Advanced plus:**
- Competitive benchmarking tools
- Property-based testing framework
- Differential testing capabilities
- Performance analysis and metrics
- Extended documentation and examples

## Platform-Specific Instructions

### Ubuntu/Debian Linux

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install -y nodejs npm git

# For advanced features
sudo apt-get install -y z3 python3 python3-pip

# Install ArachneJS
git clone https://github.com/arachnejs/deobfuscator.git
cd arachne
./install.sh --advanced
```

### macOS

```bash
# Using Homebrew (recommended)
brew install node git z3 python3

# Install ArachneJS
git clone https://github.com/arachnejs/deobfuscator.git
cd arachne
./install.sh --advanced
```

### Windows

**Prerequisites:**
1. Install [Node.js 22+](https://nodejs.org/en/download/)
2. Install [Git](https://git-scm.com/download/win)
3. For advanced features: Install [Python 3.11+](https://www.python.org/downloads/windows/)

```cmd
# Using Command Prompt or PowerShell
git clone https://github.com/arachnejs/deobfuscator.git
cd arachne
./install.sh --basic
```

**Note:** Z3 solver installation on Windows requires manual setup. Download from [Z3 Releases](https://github.com/Z3Prover/z3/releases).

## Docker Installation

For consistent environment across platforms:

```bash
# Quick Docker setup
./install.sh --docker

# Or build manually
docker build -f infra/Dockerfile -t arachnejs .
docker run -v $(pwd):/workspace arachnejs deobfuscate input.js
```

## Manual Installation

If the automated installer doesn't work for your setup:

### Step 1: Verify Prerequisites

```bash
# Check Node.js version (requires 22+)
node --version

# Check npm
npm --version

# Check Git
git --version
```

### Step 2: Clone and Install Dependencies

```bash
git clone https://github.com/arachnejs/deobfuscator.git
cd arachne
npm install
```

### Step 3: Build Project

```bash
npm run build
```

### Step 4: Verify Installation

```bash
# Run basic tests
npm test -- --run tests/cli/index.test.ts

# Test CLI
node dist/cli/index.js --help
```

## Advanced Setup

### Z3 Solver Installation

The Z3 SMT solver enables constraint-based analysis for complex obfuscation:

**Ubuntu/Debian:**
```bash
sudo apt-get install z3
```

**macOS:**
```bash
brew install z3
```

**Windows:**
1. Download from [Z3 Releases](https://github.com/Z3Prover/z3/releases)
2. Extract to a directory
3. Add to PATH environment variable

**Verify Installation:**
```bash
z3 --version
```

### Python Components

For advanced testing and research features:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Verify Python integration
python3 scripts/gatekeeper.py --help
```

## Troubleshooting

### Common Issues

**Node.js Version Error:**
```
Error: Node.js version 20.x.x is not supported. Requires 22+.
```

**Solution:**
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# Verify
node --version
```

**Build Failures:**
```
TypeScript compilation errors
```

**Solution:**
```bash
# Clean and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Permission Errors:**
```
Permission denied: ./install.sh
```

**Solution:**
```bash
chmod +x install.sh
chmod +x run-example.sh
```

**Z3 Not Found:**
```
Z3 solver not found in PATH
```

**Solution:**
```bash
# Verify Z3 installation
which z3
z3 --version

# If not installed, follow platform-specific instructions above
```

### Performance Issues

**Memory Issues with Large Files:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=8192 dist/cli/index.js deobfuscate large-file.js
```

**Slow Installation:**
```bash
# Use faster npm registry
npm config set registry https://registry.npmmirror.com/
npm install
```

## Verification

After installation, verify everything works:

```bash
# 1. Basic functionality
./run-example.sh

# 2. CLI help
node dist/cli/index.js --help

# 3. Simple deobfuscation
echo "var _0x123 = 'hello'; console.log(_0x123);" > test.js
node dist/cli/index.js deobfuscate test.js
rm test.js

# 4. Advanced features (if installed)
node dist/cli/index.js --help | grep -i "z3\|constraint"

# 5. Run test suite
npm test
```

Expected output should show successful deobfuscation and test results.

## Environment Configuration

### Development Setup

For contributors and advanced users:

```bash
# Development build with watch mode
npm run build:watch

# Enable verbose logging
export ARACHNE_LOG_LEVEL=debug

# Run with specific passes
node dist/cli/index.js deobfuscate input.js --passes constprop,dce
```

### Production Deployment

For enterprise or production use:

```bash
# Optimized production build
NODE_ENV=production npm run build

# Container deployment
docker build -t arachnejs-prod .
docker run -d --name arachne --restart unless-stopped arachnejs-prod
```

## Next Steps

After successful installation:

1. **Learn the Basics**: Read [User Guide](./user-guide.md)
2. **Try Examples**: Explore [Examples](./examples.md)  
3. **Understand Architecture**: Review [Architecture](./architecture.md)
4. **API Usage**: Check [API Reference](./api.md)

## Support

If installation fails:

1. **Check Prerequisites**: Ensure Node.js 22+, Git, and system requirements
2. **Review Logs**: Installation script provides detailed error messages
3. **GitHub Issues**: Report installation problems with system details
4. **Community**: Join discussions for help and troubleshooting

**System Information to Include in Bug Reports:**
```bash
# Gather system info for bug reports
echo "OS: $(uname -a)"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"
echo "Git: $(git --version)"
echo "Python: $(python3 --version 2>/dev/null || echo 'Not installed')"
echo "Z3: $(z3 --version 2>/dev/null || echo 'Not installed')"
```