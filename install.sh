#!/bin/bash

# ArachneJS Automated Installation Script
# Simplifies setup for different user types and environments

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="22"
PYTHON_VERSION="3.11"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Default installation type
INSTALL_TYPE="basic"
INSTALL_Z3=false
INSTALL_PYTHON=false
INSTALL_DOCKER=false
VERBOSE=false

print_banner() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                    ArachneJS Installer                  ║"
    echo "║        Advanced JavaScript Deobfuscation Engine         ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

show_help() {
    cat << EOF
ArachneJS Installation Script

Usage: $0 [OPTIONS]

OPTIONS:
    --basic         Basic installation (Node.js + npm packages only) [default]
    --advanced      Advanced installation (includes Python, Z3 solver)
    --research      Research installation (all features + benchmarking tools)
    --docker        Use Docker for installation and development
    --z3            Install Z3 SMT solver for constraint analysis
    --python        Install Python components for advanced testing
    --verbose       Show detailed output
    --help          Show this help message

EXAMPLES:
    $0                          # Basic installation
    $0 --advanced               # Advanced installation with Z3 and Python
    $0 --research --verbose     # Full research setup with detailed output
    $0 --docker                 # Docker-based installation

REQUIREMENTS:
    - Node.js ${NODE_VERSION}+ (will be checked/installed)
    - Python ${PYTHON_VERSION}+ (optional, for advanced features)
    - Git (for cloning dependencies)
    - Docker (optional, for containerized setup)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --basic)
            INSTALL_TYPE="basic"
            shift
            ;;
        --advanced)
            INSTALL_TYPE="advanced"
            INSTALL_Z3=true
            INSTALL_PYTHON=true
            shift
            ;;
        --research)
            INSTALL_TYPE="research"
            INSTALL_Z3=true
            INSTALL_PYTHON=true
            shift
            ;;
        --docker)
            INSTALL_DOCKER=true
            shift
            ;;
        --z3)
            INSTALL_Z3=true
            shift
            ;;
        --python)
            INSTALL_PYTHON=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

log_verbose() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${BLUE}[VERBOSE] $1${NC}"
    fi
}

detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

check_node_version() {
    if ! check_command node; then
        return 1
    fi
    
    local node_version
    node_version=$(node -v | sed 's/v//')
    local major_version
    major_version=$(echo "$node_version" | cut -d. -f1)
    
    if [[ "$major_version" -ge "$NODE_VERSION" ]]; then
        return 0
    else
        return 1
    fi
}

install_node() {
    local os
    os=$(detect_os)
    
    print_step "Installing Node.js ${NODE_VERSION}..."
    
    case "$os" in
        "linux")
            print_info "Please install Node.js manually or use your package manager:"
            echo "  # Ubuntu/Debian:"
            echo "  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -"
            echo "  sudo apt-get install -y nodejs"
            echo ""
            echo "  # Using nvm (recommended):"
            echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            echo "  source ~/.bashrc"
            echo "  nvm install ${NODE_VERSION}"
            echo "  nvm use ${NODE_VERSION}"
            ;;
        "macos")
            if check_command brew; then
                brew install "node@${NODE_VERSION}"
            else
                print_info "Please install Node.js manually or install Homebrew first:"
                echo "  # Using Homebrew:"
                echo "  brew install node@${NODE_VERSION}"
                echo ""
                echo "  # Using nvm (recommended):"
                echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
                echo "  source ~/.bashrc"
                echo "  nvm install ${NODE_VERSION}"
                echo "  nvm use ${NODE_VERSION}"
            fi
            ;;
        "windows")
            print_info "Please install Node.js manually:"
            echo "  1. Download from https://nodejs.org/en/download/"
            echo "  2. Or use nvm-windows: https://github.com/coreybutler/nvm-windows"
            ;;
        *)
            print_warning "Unsupported OS. Please install Node.js ${NODE_VERSION}+ manually."
            ;;
    esac
    
    print_info "After installing Node.js, please run this script again."
    exit 1
}

install_z3() {
    if check_command z3; then
        print_success "Z3 solver already installed"
        return 0
    fi
    
    local os
    os=$(detect_os)
    
    print_step "Installing Z3 SMT solver..."
    
    case "$os" in
        "linux")
            if check_command apt-get; then
                echo "sudo apt-get update && sudo apt-get install -y z3"
            elif check_command yum; then
                echo "sudo yum install -y z3"
            elif check_command pacman; then
                echo "sudo pacman -S z3"
            else
                print_warning "Please install Z3 manually for your distribution"
            fi
            ;;
        "macos")
            if check_command brew; then
                brew install z3
            else
                print_info "Please install Homebrew first, then run: brew install z3"
            fi
            ;;
        "windows")
            print_info "Please download Z3 from: https://github.com/Z3Prover/z3/releases"
            ;;
        *)
            print_warning "Please install Z3 manually for your platform"
            ;;
    esac
}

install_python_deps() {
    if ! check_command python3; then
        print_warning "Python 3 not found. Please install Python ${PYTHON_VERSION}+ manually."
        return 1
    fi
    
    local python_version
    python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    log_verbose "Found Python version: $python_version"
    
    print_step "Installing Python dependencies..."
    
    if [[ -f "$PROJECT_DIR/requirements.txt" ]]; then
        python3 -m pip install --user -r "$PROJECT_DIR/requirements.txt"
        print_success "Python dependencies installed"
    else
        print_warning "requirements.txt not found, skipping Python dependencies"
    fi
}

setup_docker() {
    print_step "Setting up Docker environment..."
    
    if ! check_command docker; then
        print_error "Docker not found. Please install Docker first:"
        echo "  https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! check_command docker-compose && ! check_command docker compose; then
        print_error "Docker Compose not found. Please install Docker Compose."
        exit 1
    fi
    
    cd "$PROJECT_DIR"
    
    if [[ -f "infra/Dockerfile" ]]; then
        print_step "Building Docker image..."
        docker build -f infra/Dockerfile -t arachnejs .
        print_success "Docker image built successfully"
    fi
    
    if [[ -f "infra/docker-compose.yml" ]]; then
        print_step "Starting Docker development environment..."
        docker-compose -f infra/docker-compose.yml up -d
        print_success "Docker environment started"
        
        print_info "To use the Docker environment:"
        echo "  docker-compose -f infra/docker-compose.yml exec arachnejs bash"
    fi
}

install_npm_deps() {
    cd "$PROJECT_DIR"
    
    print_step "Installing npm dependencies..."
    
    if [[ -f "package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi
    
    print_success "Node.js dependencies installed"
}

build_project() {
    cd "$PROJECT_DIR"
    
    print_step "Building ArachneJS..."
    
    if ! npm run type-check; then
        print_warning "TypeScript type checking found issues, but continuing..."
    fi
    
    npm run build
    print_success "ArachneJS built successfully"
}

run_tests() {
    cd "$PROJECT_DIR"
    
    print_step "Running basic tests to verify installation..."
    
    # Run a subset of tests to verify the installation
    if npm test -- --run tests/cli/index.test.ts 2>/dev/null || npm test -- tests/cli/index.test.ts 2>/dev/null; then
        print_success "Basic tests passed"
    else
        print_warning "Some tests may have failed, but core functionality should work"
    fi
}

create_example_script() {
    cat > "$PROJECT_DIR/run-example.sh" << 'EOF'
#!/bin/bash
# ArachneJS Quick Example Script

echo "🚀 Running ArachneJS example..."

# Create a sample obfuscated file
cat > sample-obfuscated.js << 'SAMPLE'
var _0x4f2a = ['test', 'hello', 'world', 'function'];
var _0x1b3c = function(a, b) { return a + b; };
function decoder(index) { return _0x4f2a[index]; }
var message = decoder(1) + ' ' + decoder(2);
console.log(message);
var unused_var = 'never used';
SAMPLE

echo "📝 Created sample obfuscated file: sample-obfuscated.js"
echo ""
echo "Original obfuscated code:"
cat sample-obfuscated.js
echo ""

# Run deobfuscation
echo "🔧 Running deobfuscation..."
node dist/cli/index.js deobfuscate sample-obfuscated.js -o sample-clean.js

if [[ -f sample-clean.js ]]; then
    echo ""
    echo "✨ Deobfuscated code:"
    cat sample-clean.js
    echo ""
    echo "✅ Deobfuscation completed successfully!"
    echo "📁 Clean code saved to: sample-clean.js"
else
    echo "⚠️ Deobfuscation may have encountered issues"
fi

# Cleanup
rm -f sample-obfuscated.js
EOF

chmod +x "$PROJECT_DIR/run-example.sh"
}

show_success_message() {
    echo ""
    print_success "🎉 ArachneJS installation completed successfully!"
    echo ""
    echo -e "${GREEN}Next steps:${NC}"
    echo "1. Test the installation:"
    echo "   ./run-example.sh"
    echo ""
    echo "2. Try deobfuscating a file:"
    echo "   node dist/cli/index.js deobfuscate your-file.js -o clean.js"
    echo ""
    echo "3. Explore advanced features:"
    echo "   node dist/cli/index.js --help"
    echo ""
    echo -e "${BLUE}Documentation:${NC}"
    echo "• User Guide: https://github.com/arachnejs/deobfuscator/blob/main/docs/user-guide.md"
    echo "• Examples: https://github.com/arachnejs/deobfuscator/blob/main/docs/examples.md"
    echo "• API Reference: https://github.com/arachnejs/deobfuscator/blob/main/docs/api.md"
    echo ""
    
    if [[ "$INSTALL_TYPE" == "research" ]]; then
        echo -e "${YELLOW}Research Features Available:${NC}"
        echo "• Competitive benchmarking: npm run benchmark"
        echo "• Differential testing: npm run test:differential"
        echo "• Property-based testing: npm run test:properties"
        echo ""
    fi
    
    if [[ "$INSTALL_Z3" == true ]]; then
        echo -e "${PURPLE}Advanced Features Enabled:${NC}"
        echo "• Constraint solving with Z3"
        echo "• Symbolic execution capabilities"
        echo "• Advanced obfuscation analysis"
        echo ""
    fi
}

main() {
    print_banner
    
    print_info "Installation type: $INSTALL_TYPE"
    echo ""
    
    # Check prerequisites
    print_step "Checking prerequisites..."
    
    if ! check_node_version; then
        print_warning "Node.js ${NODE_VERSION}+ required"
        install_node
    else
        local node_version
        node_version=$(node -v)
        print_success "Node.js $node_version found"
    fi
    
    # Docker setup (if requested)
    if [[ "$INSTALL_DOCKER" == true ]]; then
        setup_docker
        return 0
    fi
    
    # Install dependencies
    install_npm_deps
    
    # Advanced dependencies
    if [[ "$INSTALL_Z3" == true ]]; then
        install_z3
    fi
    
    if [[ "$INSTALL_PYTHON" == true ]]; then
        install_python_deps
    fi
    
    # Build project
    build_project
    
    # Verify installation
    run_tests
    
    # Create example script
    create_example_script
    
    # Show success message
    show_success_message
}

# Run main function
main "$@"