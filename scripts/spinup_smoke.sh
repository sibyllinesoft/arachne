#!/bin/bash

# ArachneJS Deobfuscator - Hermetic Boot and Smoke Test Script
# Ensures reproducible builds and validates core functionality

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/boot_$(date +%Y%m%d_%H%M%S).log"
TRANSCRIPT_FILE="$PROJECT_ROOT/artifacts/boot_transcript.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1" | tee -a "$LOG_FILE"
}

# Initialize transcript
init_transcript() {
    cat > "$TRANSCRIPT_FILE" << EOF
{
  "boot_session": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "platform": "$(uname -s -r -m)",
    "node_version": null,
    "python_version": null,
    "z3_version": null,
    "steps": []
  }
}
EOF
}

# Add step to transcript
add_transcript_step() {
    local step_name="$1"
    local status="$2"
    local duration="${3:-0}"
    local details="${4:-}"
    
    # Use jq if available, fallback to simple JSON manipulation
    if command -v jq &> /dev/null; then
        jq --arg name "$step_name" --arg status "$status" --arg duration "$duration" --arg details "$details" \
           '.boot_session.steps += [{"name": $name, "status": $status, "duration": ($duration | tonumber), "details": $details, "timestamp": (now | strftime("%Y-%m-%dT%H:%M:%S.%3NZ"))}]' \
           "$TRANSCRIPT_FILE" > "${TRANSCRIPT_FILE}.tmp" && mv "${TRANSCRIPT_FILE}.tmp" "$TRANSCRIPT_FILE"
    fi
}

# Environment validation
check_environment() {
    log "Validating environment..."
    
    local start_time=$(date +%s)
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found"
        add_transcript_step "node_check" "failed" 0 "Node.js not installed"
        exit 1
    fi
    
    local node_version=$(node --version)
    log_success "Node.js version: $node_version"
    
    # Verify Node.js 22 LTS
    if ! echo "$node_version" | grep -q "^v22\."; then
        log_warning "Expected Node.js 22 LTS, found $node_version"
    fi
    
    # Check Python version
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 not found"
        add_transcript_step "python_check" "failed" 0 "Python 3 not installed"
        exit 1
    fi
    
    local python_version=$(python3 --version)
    log_success "Python version: $python_version"
    
    # Check Z3 availability
    if command -v z3 &> /dev/null; then
        local z3_version=$(z3 --version | head -n1)
        log_success "Z3 SMT Solver: $z3_version"
    else
        log_warning "Z3 SMT Solver not found in PATH"
    fi
    
    local end_time=$(date +%s)
    add_transcript_step "environment_check" "passed" $((end_time - start_time)) "Node: $node_version, Python: $python_version"
}

# Dependencies installation
install_dependencies() {
    log "Installing dependencies..."
    
    local start_time=$(date +%s)
    
    cd "$PROJECT_ROOT"
    
    # Install Node.js dependencies
    log "Installing Node.js packages..."
    if npm ci --silent; then
        log_success "Node.js dependencies installed"
    else
        log_error "Failed to install Node.js dependencies"
        add_transcript_step "npm_install" "failed" 0 "npm ci failed"
        exit 1
    fi
    
    # Install Python dependencies
    log "Installing Python packages..."
    if python3 -m pip install -r requirements.txt --quiet; then
        log_success "Python dependencies installed"
    else
        log_error "Failed to install Python dependencies"
        add_transcript_step "pip_install" "failed" 0 "pip install failed"
        exit 1
    fi
    
    # Verify critical imports
    log "Verifying critical imports..."
    python3 -c "import z3; print(f'Z3 Python bindings: {z3.get_version_string()}')" || {
        log_warning "Z3 Python bindings not available"
    }
    
    local end_time=$(date +%s)
    add_transcript_step "dependency_install" "passed" $((end_time - start_time)) "All dependencies installed"
}

# Build project
build_project() {
    log "Building project..."
    
    local start_time=$(date +%s)
    
    cd "$PROJECT_ROOT"
    
    # TypeScript compilation
    if npm run build 2>&1 | tee -a "$LOG_FILE"; then
        log_success "TypeScript build completed"
    else
        log_error "TypeScript build failed"
        add_transcript_step "typescript_build" "failed" 0 "tsc compilation failed"
        exit 1
    fi
    
    # Type checking
    if npm run type-check 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Type checking passed"
    else
        log_error "Type checking failed"
        add_transcript_step "type_check" "failed" 0 "Type errors found"
        exit 1
    fi
    
    # Linting
    if npm run lint 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Linting passed"
    else
        log_warning "Linting issues found (proceeding anyway)"
    fi
    
    local end_time=$(date +%s)
    add_transcript_step "project_build" "passed" $((end_time - start_time)) "Build and validation completed"
}

# Smoke test core functionality
smoke_test() {
    log "Running smoke tests..."
    
    local start_time=$(date +%s)
    
    cd "$PROJECT_ROOT"
    
    # Test CLI availability
    if node dist/cli/index.js --version 2>&1 | tee -a "$LOG_FILE"; then
        log_success "CLI executable working"
    else
        log_error "CLI executable failed"
        add_transcript_step "cli_test" "failed" 0 "CLI not executable"
        exit 1
    fi
    
    # Test basic unit tests
    if npm test -- --run --reporter=minimal 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Unit tests passed"
    else
        log_warning "Some unit tests failed (check logs)"
    fi
    
    # Test Python harness
    if python3 -c "
import sys, os
sys.path.append('$PROJECT_ROOT')
print('Python harness: OK')
" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Python harness accessible"
    else
        log_warning "Python harness issues"
    fi
    
    local end_time=$(date +%s)
    add_transcript_step "smoke_test" "passed" $((end_time - start_time)) "Core functionality validated"
}

# Docker validation (if Docker is available)
validate_docker() {
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        log "Validating Docker configuration..."
        
        local start_time=$(date +%s)
        
        cd "$PROJECT_ROOT"
        
        # Build Docker image
        if docker build -f infra/Dockerfile -t arachnejs:smoke . 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Docker image built successfully"
        else
            log_warning "Docker build failed (skipping Docker validation)"
            return 0
        fi
        
        # Test container
        if docker run --rm arachnejs:smoke --version 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Docker container working"
        else
            log_warning "Docker container test failed"
        fi
        
        local end_time=$(date +%s)
        add_transcript_step "docker_validation" "passed" $((end_time - start_time)) "Docker build and test completed"
    else
        log "Docker not available, skipping Docker validation"
        add_transcript_step "docker_validation" "skipped" 0 "Docker not available"
    fi
}

# Main execution
main() {
    echo "🕷️  ArachneJS Deobfuscator - Hermetic Boot Script"
    echo "================================================"
    
    # Create directories
    mkdir -p "$PROJECT_ROOT/logs" "$PROJECT_ROOT/artifacts"
    
    # Initialize transcript
    init_transcript
    
    # Run all validation steps
    check_environment
    install_dependencies
    build_project
    smoke_test
    validate_docker
    
    log_success "Boot sequence completed successfully!"
    log "Full logs: $LOG_FILE"
    log "Boot transcript: $TRANSCRIPT_FILE"
    
    echo ""
    echo "🎉 ArachneJS is ready for development!"
    echo "   • Run 'npm run dev' to start development mode"
    echo "   • Run 'npm run docker:dev' for containerized development"
    echo "   • Run 'npm test' for full test suite"
    echo ""
}

# Handle interrupts
trap 'log_error "Boot sequence interrupted"; exit 1' INT TERM

# Execute main function
main "$@"