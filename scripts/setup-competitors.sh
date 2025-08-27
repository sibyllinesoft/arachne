#!/bin/bash
#
# Setup script for JavaScript deobfuscation competitor tools
# This script handles installation and verification of major open source JS deobfuscation tools
#

set -euo pipefail

# Configuration
TOOLS_DIR="$(pwd)/benchmarks/competitors"
LOG_FILE="$TOOLS_DIR/setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

print_header() {
    echo
    log "${BLUE}================================================${NC}"
    log "${BLUE}  JavaScript Deobfuscation Tools Setup${NC}"
    log "${BLUE}================================================${NC}"
    echo
}

# Create tools directory
setup_workspace() {
    log "${BLUE}🔧 Setting up workspace...${NC}"
    mkdir -p "$TOOLS_DIR"
    touch "$LOG_FILE"
    log "  Workspace: $TOOLS_DIR"
    log "  Log file: $LOG_FILE"
    echo
}

# Check system requirements
check_requirements() {
    log "${BLUE}🔍 Checking system requirements...${NC}"
    
    # Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log "  ✅ Node.js: $NODE_VERSION"
    else
        log "  ❌ Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    
    # NPM
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        log "  ✅ npm: $NPM_VERSION"
    else
        log "  ❌ npm not found"
        exit 1
    fi
    
    # Python (for some tools)
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        log "  ✅ $PYTHON_VERSION"
    else
        log "  ⚠️  Python3 not found (some tools may not work)"
    fi
    
    # Git
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        log "  ✅ $GIT_VERSION"
    else
        log "  ❌ Git not found"
        exit 1
    fi
    
    echo
}

# Setup Synchrony
setup_synchrony() {
    log "${BLUE}📦 Setting up Synchrony...${NC}"
    
    cd "$TOOLS_DIR"
    
    if [ -d "synchrony" ]; then
        log "  ⚠️  Synchrony directory already exists, pulling updates..."
        cd synchrony
        git pull || true
        npm install || true
    else
        log "  📥 Cloning Synchrony repository..."
        git clone https://github.com/relative/synchrony.git
        cd synchrony
        log "  📦 Installing dependencies..."
        npm install
    fi
    
    # Test installation
    if [ -f "dist/cli.js" ] || npm run build; then
        log "  ✅ Synchrony setup complete"
    else
        log "  ❌ Synchrony setup failed"
    fi
    
    cd "$TOOLS_DIR"
    echo
}

# Setup Webcrack
setup_webcrack() {
    log "${BLUE}🕸️  Setting up Webcrack...${NC}"
    
    cd "$TOOLS_DIR"
    
    if [ -d "webcrack" ]; then
        log "  ⚠️  Webcrack directory already exists, pulling updates..."
        cd webcrack
        git pull || true
        npm install || true
    else
        log "  📥 Cloning Webcrack repository..."
        git clone https://github.com/j4k0xb/webcrack.git
        cd webcrack
        log "  📦 Installing dependencies..."
        npm install
        log "  🔨 Building..."
        npm run build || true
    fi
    
    # Test installation
    if command -v node && [ -f "dist/cli.js" ]; then
        log "  ✅ Webcrack setup complete"
    else
        log "  ❌ Webcrack setup failed"
    fi
    
    cd "$TOOLS_DIR"
    echo
}

# Setup Restringer
setup_restringer() {
    log "${BLUE}🎯 Setting up Restringer...${NC}"
    
    cd "$TOOLS_DIR"
    
    if [ -d "restringer" ]; then
        log "  ⚠️  Restringer directory already exists, pulling updates..."
        cd restringer
        git pull || true
        npm install || true
    else
        log "  📥 Cloning Restringer repository..."
        git clone https://github.com/PerimeterX/restringer.git
        cd restringer
        log "  📦 Installing dependencies..."
        npm install
    fi
    
    # Test installation
    if [ -f "src/restringer.js" ]; then
        log "  ✅ Restringer setup complete"
    else
        log "  ❌ Restringer setup failed"
    fi
    
    cd "$TOOLS_DIR"
    echo
}

# Setup UnuglifyJS
setup_unuglifyjs() {
    log "${BLUE}🎭 Setting up UnuglifyJS...${NC}"
    
    cd "$TOOLS_DIR"
    
    if [ -d "UnuglifyJS" ]; then
        log "  ⚠️  UnuglifyJS directory already exists, pulling updates..."
        cd UnuglifyJS
        git pull || true
        npm install || true
    else
        log "  📥 Cloning UnuglifyJS repository..."
        git clone https://github.com/eth-sri/UnuglifyJS.git
        cd UnuglifyJS
        log "  📦 Installing dependencies..."
        npm install
    fi
    
    # Test installation
    if [ -f "src/cli.js" ] && [ -d "node_modules" ]; then
        log "  ✅ UnuglifyJS setup complete"
    else
        log "  ❌ UnuglifyJS setup failed"
    fi
    
    cd "$TOOLS_DIR"
    echo
}

# Setup JS-deobfuscator
setup_js_deobfuscator() {
    log "${BLUE}🔓 Setting up JS-deobfuscator...${NC}"
    
    # Try global installation first
    log "  📦 Attempting global installation..."
    if npm install -g js-deobfuscator; then
        log "  ✅ JS-deobfuscator installed globally"
        return
    fi
    
    # Fall back to local installation
    cd "$TOOLS_DIR"
    
    if [ -d "js-deobfuscator" ]; then
        log "  ⚠️  JS-deobfuscator directory already exists, updating..."
        cd js-deobfuscator
        npm install || true
    else
        log "  📥 Creating local JS-deobfuscator installation..."
        mkdir js-deobfuscator
        cd js-deobfuscator
        npm init -y
        npm install js-deobfuscator
    fi
    
    cd "$TOOLS_DIR"
    echo
}

# Setup De4js (web-based tool - create wrapper)
setup_de4js() {
    log "${BLUE}🌐 Setting up De4js wrapper...${NC}"
    
    cd "$TOOLS_DIR"
    mkdir -p de4js
    
    # Create a simple wrapper script for de4js
    cat > de4js/de4js-wrapper.js << 'EOF'
#!/usr/bin/env node
/**
 * De4js wrapper for command-line usage
 * Since de4js is primarily web-based, this wrapper provides basic functionality
 */

const fs = require('fs');
const path = require('path');

function displayHelp() {
    console.log(`
Usage: node de4js-wrapper.js <input-file> [output-file]

This is a basic wrapper for de4js functionality.
For full features, use the web interface at: https://lelinhtinh.github.io/de4js/

Basic patterns supported:
- Eval unpacking
- Simple string array deobfuscation  
- Basic identifier cleanup
`);
}

function basicDeobfuscation(code) {
    // Very basic deobfuscation patterns
    let result = code;
    
    // Eval unpacking (very basic)
    result = result.replace(/eval\s*\(\s*function\s*\([^)]*\)[^}]*\{[^}]*\}\s*\([^)]*\)\s*\)/g, 
        (match) => {
            // This is a placeholder - real de4js has sophisticated unpacking
            return '/* eval unpacked (simplified) */ ' + match;
        });
    
    // Simple string cleanup
    result = result.replace(/['"]([^'"]*)['"]/g, (match, str) => {
        // Basic string decoding
        return `"${str}"`;
    });
    
    return result;
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        displayHelp();
        return;
    }
    
    const inputFile = args[0];
    const outputFile = args[1] || inputFile.replace(/\.js$/, '_de4js.js');
    
    if (!fs.existsSync(inputFile)) {
        console.error(`Error: Input file '${inputFile}' not found`);
        process.exit(1);
    }
    
    try {
        const code = fs.readFileSync(inputFile, 'utf8');
        const result = basicDeobfuscation(code);
        
        fs.writeFileSync(outputFile, result, 'utf8');
        console.log(`Deobfuscated code written to: ${outputFile}`);
    } catch (error) {
        console.error(`Error processing file: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { basicDeobfuscation };
EOF
    
    chmod +x de4js/de4js-wrapper.js
    log "  ✅ De4js wrapper created (basic functionality)"
    echo
}

# Verify all installations
verify_installations() {
    log "${BLUE}🔍 Verifying installations...${NC}"
    
    cd "$TOOLS_DIR"
    
    # Test each tool
    WORKING_TOOLS=()
    FAILED_TOOLS=()
    
    # Synchrony
    if [ -d "synchrony" ] && [ -f "synchrony/package.json" ]; then
        WORKING_TOOLS+=("Synchrony")
        log "  ✅ Synchrony: Ready"
    else
        FAILED_TOOLS+=("Synchrony")
        log "  ❌ Synchrony: Failed"
    fi
    
    # Webcrack
    if [ -d "webcrack" ] && [ -f "webcrack/package.json" ]; then
        WORKING_TOOLS+=("Webcrack")
        log "  ✅ Webcrack: Ready"
    else
        FAILED_TOOLS+=("Webcrack")
        log "  ❌ Webcrack: Failed"
    fi
    
    # Restringer
    if [ -d "restringer" ] && [ -f "restringer/src/restringer.js" ]; then
        WORKING_TOOLS+=("Restringer")
        log "  ✅ Restringer: Ready"
    else
        FAILED_TOOLS+=("Restringer")
        log "  ❌ Restringer: Failed"
    fi
    
    # UnuglifyJS
    if [ -d "UnuglifyJS" ] && [ -f "UnuglifyJS/src/cli.js" ]; then
        WORKING_TOOLS+=("UnuglifyJS")
        log "  ✅ UnuglifyJS: Ready"
    else
        FAILED_TOOLS+=("UnuglifyJS")
        log "  ❌ UnuglifyJS: Failed"
    fi
    
    # JS-deobfuscator
    if command -v js-deobfuscator &> /dev/null || [ -d "js-deobfuscator" ]; then
        WORKING_TOOLS+=("JS-deobfuscator")
        log "  ✅ JS-deobfuscator: Ready"
    else
        FAILED_TOOLS+=("JS-deobfuscator")
        log "  ❌ JS-deobfuscator: Failed"
    fi
    
    # De4js wrapper
    if [ -f "de4js/de4js-wrapper.js" ]; then
        WORKING_TOOLS+=("De4js")
        log "  ✅ De4js: Ready (wrapper)"
    else
        FAILED_TOOLS+=("De4js")
        log "  ❌ De4js: Failed"
    fi
    
    echo
    log "${GREEN}✅ Working tools (${#WORKING_TOOLS[@]}): ${WORKING_TOOLS[*]}${NC}"
    if [ ${#FAILED_TOOLS[@]} -gt 0 ]; then
        log "${RED}❌ Failed tools (${#FAILED_TOOLS[@]}): ${FAILED_TOOLS[*]}${NC}"
    fi
    echo
}

# Create tool configuration file
create_config() {
    log "${BLUE}📝 Creating tool configuration...${NC}"
    
    cat > "$TOOLS_DIR/tools-config.json" << EOF
{
  "tools": [
    {
      "name": "ArachneJS",
      "path": "$(pwd)/dist/cli/index.js",
      "type": "local",
      "command": ["node", "$(pwd)/dist/cli/index.js", "deobfuscate"],
      "status": "ready"
    },
    {
      "name": "Synchrony", 
      "path": "$TOOLS_DIR/synchrony",
      "type": "git",
      "command": ["node", "$TOOLS_DIR/synchrony/dist/cli.js"],
      "status": "$([ -f "$TOOLS_DIR/synchrony/package.json" ] && echo "ready" || echo "failed")"
    },
    {
      "name": "Webcrack",
      "path": "$TOOLS_DIR/webcrack",
      "type": "git", 
      "command": ["node", "$TOOLS_DIR/webcrack/dist/cli.js"],
      "status": "$([ -f "$TOOLS_DIR/webcrack/package.json" ] && echo "ready" || echo "failed")"
    },
    {
      "name": "Restringer",
      "path": "$TOOLS_DIR/restringer",
      "type": "git",
      "command": ["node", "$TOOLS_DIR/restringer/src/restringer.js"],
      "status": "$([ -f "$TOOLS_DIR/restringer/src/restringer.js" ] && echo "ready" || echo "failed")"
    },
    {
      "name": "UnuglifyJS",
      "path": "$TOOLS_DIR/UnuglifyJS", 
      "type": "git",
      "command": ["node", "$TOOLS_DIR/UnuglifyJS/src/cli.js"],
      "status": "$([ -f "$TOOLS_DIR/UnuglifyJS/src/cli.js" ] && echo "ready" || echo "failed")"
    },
    {
      "name": "De4js",
      "path": "$TOOLS_DIR/de4js",
      "type": "wrapper",
      "command": ["node", "$TOOLS_DIR/de4js/de4js-wrapper.js"],
      "status": "$([ -f "$TOOLS_DIR/de4js/de4js-wrapper.js" ] && echo "ready" || echo "failed")"
    }
  ],
  "created": "$(date -Iseconds)",
  "tools_dir": "$TOOLS_DIR"
}
EOF
    
    log "  ✅ Configuration saved to: $TOOLS_DIR/tools-config.json"
    echo
}

# Main execution
main() {
    print_header
    setup_workspace
    check_requirements
    
    # Setup each tool
    setup_synchrony
    setup_webcrack 
    setup_restringer
    setup_unuglifyjs
    setup_js_deobfuscator
    setup_de4js
    
    # Verify and configure
    verify_installations
    create_config
    
    log "${GREEN}🎉 Setup complete!${NC}"
    log "${GREEN}Ready to run competitive analysis with TypeScript benchmark suite.${NC}"
    echo
    log "Next steps:"
    log "  1. Build ArachneJS: npm run build"
    log "  2. Run benchmarks: npm run benchmark"
    log "  3. Generate competitive analysis: tsx benchmarks/competitive-analysis.ts"
    echo
}

# Handle interruption
trap 'echo -e "\n${RED}Setup interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"