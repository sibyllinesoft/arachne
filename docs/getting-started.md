# Getting Started with ArachneJS

This guide will get you up and running with ArachneJS in just a few minutes.

## Prerequisites

- **Node.js**: 20 LTS or higher (required)
- **Python**: 3.11+ (optional, for advanced constraint solving)
- **Z3 Solver**: (optional, for mathematical obfuscation analysis)

## Quick Installation

### Option 1: Basic Installation (Recommended)

```bash
# Clone the repository
git clone https://github.com/sibyllinesoft/arachne.git
cd arachne

# Install dependencies and build
npm install
npm run build

# Verify installation
node dist/cli/index.js --help
```

### Option 2: Automated Installation

Use the provided installation script for automatic dependency handling:

```bash
# Download and run installer
curl -sSL https://raw.githubusercontent.com/sibyllinesoft/arachne/master/install.sh | bash

# Or download first, then run
wget https://raw.githubusercontent.com/sibyllinesoft/arachne/master/install.sh
chmod +x install.sh
./install.sh
```

The installer will:
- Check system requirements
- Install Node.js dependencies  
- Optionally install Python and Z3 for advanced features
- Verify the installation with test examples

### Option 3: Docker (All Dependencies Included)

```bash
# Pull and run with Docker
docker pull sibyllinesoft/arachne
docker run -v $(pwd):/workspace sibyllinesoft/arachne analyze input.js
```

## Installation Verification

Test your installation with a simple example:

```bash
# Create a test file
echo "var _0x123 = 'Hello'; var _0x456 = 'World'; console.log(_0x123 + ' ' + _0x456);" > test.js

# Run ArachneJS
node dist/cli/index.js analyze test.js -o output.js

# Check the results
cat output.js
```

Expected output: Clean, deobfuscated JavaScript with meaningful variable names.

## Your First Deobfuscation

Let's try a more realistic example with common obfuscation patterns:

```javascript
// Create obfuscated.js
var _0x4f2a=['test','hello','world'];
var _0x1b3c=function(a,b){a=a-0x0;var _0x2e4d=_0x4f2a[a];return _0x2e4d;};
console.log(_0x1b3c(0x1) + ' ' + _0x1b3c(0x2));
```

```bash
# Deobfuscate with verbose output
node dist/cli/index.js analyze obfuscated.js -v -o clean.js

# View the results
cat clean.js
```

## Common Installation Issues

### Node.js Version Issues
```bash
# Check your Node.js version
node --version

# Install Node.js 20 LTS if needed
# Via nvm (recommended):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

### Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Permission Issues (Linux/macOS)
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

### Windows-Specific Setup
```powershell
# Enable execution of scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Install with PowerShell
npm install
npm run build
```

## Next Steps

Once installed, you can:

1. **Read the Usage Guide**: `docs/usage-guide.md` for comprehensive examples
2. **Try Advanced Features**: Constraint solving with `-z` flag  
3. **Integrate with Tools**: See API documentation in `docs/api.md`
4. **Get Help**: Run `node dist/cli/index.js --help` for all options

## Need Help?

- **Command Help**: `node dist/cli/index.js analyze --help`
- **Usage Guide**: See `docs/usage-guide.md` for comprehensive examples
- **Issues**: Report problems at https://github.com/sibyllinesoft/arachne/issues
- **Troubleshooting**: Check the troubleshooting section in `docs/usage-guide.md`

---

**Ready to deobfuscate?** Continue to the [Usage Guide](./usage-guide.md) for comprehensive examples and advanced features.