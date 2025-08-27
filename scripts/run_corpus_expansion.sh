#!/bin/bash
# ArachneJS Phase 3.1: Wild Samples Corpus Expansion Pipeline
# 
# This script orchestrates the complete corpus expansion process:
# 1. Sample collection from various sources
# 2. Classification and metadata generation
# 3. Integration with differential testing framework
# 4. Quality validation and reporting

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CORPUS_DIR="$PROJECT_ROOT/tests/corpus/wild_samples"
OUTPUT_DIR="$PROJECT_ROOT/artifacts/wild_sample_reports"
CONFIG_FILE="$PROJECT_ROOT/tests/differential/fixtures/wild_samples.config.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌${NC} $1"
}

# Help function
show_help() {
    cat << EOF
🔬 ArachneJS Phase 3.1: Wild Samples Corpus Expansion Pipeline

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --collect-only          Only run sample collection, skip testing
    --test-only            Only run tests, skip collection
    --synthetic-only       Use only synthetic samples (no external collection)
    --github-token TOKEN   GitHub API token for enhanced collection
    --max-samples N        Maximum samples to collect per source (default: 15)
    --output-dir DIR       Output directory for reports
    --verbose              Enable verbose logging
    --help                 Show this help message

EXAMPLES:
    # Full pipeline with GitHub token
    $0 --github-token \$GITHUB_TOKEN --verbose

    # Collection only
    $0 --collect-only --max-samples 25

    # Testing with existing samples
    $0 --test-only

    # Synthetic samples only (no network access)
    $0 --synthetic-only

ENVIRONMENT VARIABLES:
    GITHUB_TOKEN          GitHub API token (alternative to --github-token)
    PYTHON               Python executable (default: python3)
    NODE                 Node.js executable (default: node)

PREREQUISITES:
    - Python 3.11+ with required packages (see scripts/requirements.txt)
    - Node.js 22+ with TypeScript support
    - Internet access for collection (unless --synthetic-only)

OUTPUT:
    - Collected samples: $CORPUS_DIR/
    - Test reports: $OUTPUT_DIR/
    - Metadata: $CORPUS_DIR/samples_metadata.json

EOF
}

# Parse command line arguments
COLLECT_ONLY=false
TEST_ONLY=false
SYNTHETIC_ONLY=false
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
MAX_SAMPLES=15
VERBOSE=false
OUTPUT_DIR_OVERRIDE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --collect-only)
            COLLECT_ONLY=true
            shift
            ;;
        --test-only)
            TEST_ONLY=true
            shift
            ;;
        --synthetic-only)
            SYNTHETIC_ONLY=true
            shift
            ;;
        --github-token)
            GITHUB_TOKEN="$2"
            shift 2
            ;;
        --max-samples)
            MAX_SAMPLES="$2"
            shift 2
            ;;
        --output-dir)
            OUTPUT_DIR_OVERRIDE="$2"
            shift 2
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
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Override output directory if specified
if [[ -n "$OUTPUT_DIR_OVERRIDE" ]]; then
    OUTPUT_DIR="$OUTPUT_DIR_OVERRIDE"
fi

# Validation
if [[ "$COLLECT_ONLY" == true && "$TEST_ONLY" == true ]]; then
    log_error "Cannot specify both --collect-only and --test-only"
    exit 1
fi

# Environment setup
export GITHUB_TOKEN
export PYTHONPATH="$SCRIPT_DIR:${PYTHONPATH:-}"
PYTHON="${PYTHON:-python3}"
NODE="${NODE:-node}"

# Header
cat << 'EOF'
🔬 ===============================================
   ArachneJS Phase 3.1: Wild Samples Corpus
   Test Corpus Expansion with Real-World Samples
   ===============================================
EOF

log "Starting corpus expansion pipeline..."
log "Project root: $PROJECT_ROOT"
log "Corpus directory: $CORPUS_DIR"
log "Output directory: $OUTPUT_DIR"

# Create directories
mkdir -p "$CORPUS_DIR" "$OUTPUT_DIR"

# Step 1: Check prerequisites
check_prerequisites() {
    log "🔧 Checking prerequisites..."
    
    # Check Python
    if ! command -v "$PYTHON" &> /dev/null; then
        log_error "Python not found. Please install Python 3.11+"
        exit 1
    fi
    
    local python_version=$($PYTHON --version 2>&1 | grep -oP '(?<=Python )\d+\.\d+')
    log "Python version: $python_version"
    
    # Check Node.js
    if ! command -v "$NODE" &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 22+"
        exit 1
    fi
    
    local node_version=$($NODE --version)
    log "Node.js version: $node_version"
    
    # Check Python dependencies (skip for test-only mode)
    if [[ "$TEST_ONLY" != true ]]; then
        if ! $PYTHON -c "import aiohttp, aiofiles, requests" 2>/dev/null; then
            log_warning "Installing Python dependencies..."
            $PYTHON -m pip install -r "$SCRIPT_DIR/requirements.txt" || {
                log_error "Failed to install Python dependencies"
                exit 1
            }
        fi
    else
        log "Skipping Python dependency check in test-only mode"
    fi
    
    log_success "Prerequisites check complete"
}

# Step 2: Collect samples
collect_samples() {
    log "📥 Starting sample collection..."
    
    cd "$SCRIPT_DIR"
    
    local collection_args=""
    if [[ "$SYNTHETIC_ONLY" == true ]]; then
        collection_args="--synthetic-only"
    fi
    
    if [[ "$VERBOSE" == true ]]; then
        collection_args="$collection_args --verbose"
    fi
    
    # Create collection config
    local collection_config=$(cat << EOF
{
    "output_dir": "$CORPUS_DIR",
    "max_samples_per_source": $MAX_SAMPLES,
    "enable_github_collection": $([ "$SYNTHETIC_ONLY" == "false" ] && echo "true" || echo "false"),
    "enable_malwarebazaar_collection": false,
    "enable_academic_collection": true,
    "github_token": "$GITHUB_TOKEN",
    "rate_limit_delay": 2.0
}
EOF
    )
    
    # Run collection with timeout
    timeout 600 $PYTHON "$SCRIPT_DIR/collect_samples.py" $collection_args || {
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log_warning "Sample collection timed out after 10 minutes"
        else
            log_error "Sample collection failed with exit code $exit_code"
            return 1
        fi
    }
    
    # Check results
    local sample_count=$(find "$CORPUS_DIR" -name "wild_sample_*.js" | wc -l)
    log_success "Collection complete: $sample_count samples collected"
    
    if [[ $sample_count -lt 5 ]]; then
        log_warning "Low sample count ($sample_count), consider running with GitHub token"
    fi
}

# Step 3: Run differential tests
run_tests() {
    log "🧪 Starting differential testing..."
    
    cd "$PROJECT_ROOT"
    
    # Check if TypeScript is available
    if ! command -v npx &> /dev/null; then
        log_error "npx not found. Please install Node.js with npm"
        exit 1
    fi
    
    # Build TypeScript if needed
    if [[ ! -f "tests/differential/wild_samples_runner.js" ]]; then
        log "Compiling TypeScript..."
        npx tsc tests/differential/wild_samples_runner.ts --target ES2022 --module commonjs || {
            log_warning "TypeScript compilation failed, attempting direct execution"
        }
    fi
    
    # Run wild samples tests using simple CommonJS version
    local test_cmd="$NODE tests/differential/simple_wild_samples_test.cjs"
    
    if [[ "$VERBOSE" == true ]]; then
        test_cmd="$test_cmd --verbose"
    fi
    
    log "Executing: $test_cmd"
    
    # Run tests with timeout
    timeout 1200 $test_cmd || {
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log_error "Testing timed out after 20 minutes"
            return 1
        elif [[ $exit_code -eq 1 ]]; then
            log_warning "Some tests failed, but continuing with reporting"
        else
            log_error "Testing failed with exit code $exit_code"
            return 1
        fi
    }
    
    log_success "Testing complete"
}

# Step 4: Generate reports
generate_reports() {
    log "📊 Generating reports..."
    
    # Check if reports were generated
    if [[ -f "$OUTPUT_DIR/wild-samples-report.html" ]]; then
        log_success "HTML report generated: $OUTPUT_DIR/wild-samples-report.html"
    fi
    
    if [[ -f "$OUTPUT_DIR/wild-samples-report.json" ]]; then
        log_success "JSON report generated: $OUTPUT_DIR/wild-samples-report.json"
        
        # Extract key metrics from JSON report
        if command -v jq &> /dev/null; then
            local json_report="$OUTPUT_DIR/wild-samples-report.json"
            local total_tests=$(jq -r '.statistics.totalTests' "$json_report" 2>/dev/null || echo "N/A")
            local passed=$(jq -r '.statistics.passed' "$json_report" 2>/dev/null || echo "N/A")
            local robustness=$(jq -r '.statistics.robustnessScore' "$json_report" 2>/dev/null || echo "N/A")
            
            log "📈 Key Metrics:"
            log "   Total Tests: $total_tests"
            log "   Passed: $passed"
            log "   Robustness Score: $robustness"
        fi
    fi
    
    # Generate summary
    cat > "$OUTPUT_DIR/SUMMARY.md" << EOF
# ArachneJS Wild Samples Test Summary

**Generated**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Pipeline Version**: Phase 3.1

## Collection Results

- **Corpus Directory**: $CORPUS_DIR
- **Sample Count**: $(find "$CORPUS_DIR" -name "wild_sample_*.js" | wc -l)
- **Metadata File**: $CORPUS_DIR/samples_metadata.json

## Test Results

- **Configuration**: $CONFIG_FILE
- **Output Directory**: $OUTPUT_DIR
- **Reports Generated**: $(ls -1 "$OUTPUT_DIR"/*.html "$OUTPUT_DIR"/*.json 2>/dev/null | wc -l)

## Next Steps

1. Review HTML report: $OUTPUT_DIR/wild-samples-report.html
2. Analyze failed tests for improvement opportunities
3. Consider adding more diverse samples if robustness < 60%
4. Integrate successful samples into CI/CD pipeline

## Files Generated

\`\`\`
$(find "$OUTPUT_DIR" -type f -name "*.html" -o -name "*.json" -o -name "*.md" | sort)
\`\`\`

---
*Generated by ArachneJS Wild Samples Corpus Expansion Pipeline*
EOF
    
    log_success "Summary generated: $OUTPUT_DIR/SUMMARY.md"
}

# Step 5: Quality assessment
assess_quality() {
    log "🎯 Assessing corpus quality..."
    
    local sample_count=$(find "$CORPUS_DIR" -name "wild_sample_*.js" | wc -l)
    local metadata_exists=false
    
    if [[ -f "$CORPUS_DIR/samples_metadata.json" ]]; then
        metadata_exists=true
        log_success "Metadata file exists"
    else
        log_warning "Metadata file missing"
    fi
    
    # Quality gates
    local quality_issues=0
    
    if [[ $sample_count -lt 10 ]]; then
        log_warning "Sample count below minimum threshold: $sample_count < 10"
        ((quality_issues++))
    else
        log_success "Sample count meets threshold: $sample_count ≥ 10"
    fi
    
    if [[ "$metadata_exists" == false ]]; then
        log_warning "Missing metadata file affects classification"
        ((quality_issues++))
    fi
    
    # Check for test reports
    if [[ -f "$OUTPUT_DIR/wild-samples-report.json" ]]; then
        log_success "Test reports generated successfully"
    else
        log_warning "Test reports missing or incomplete"
        ((quality_issues++))
    fi
    
    # Overall assessment
    if [[ $quality_issues -eq 0 ]]; then
        log_success "🎉 Corpus expansion successful! All quality gates passed."
        return 0
    elif [[ $quality_issues -le 2 ]]; then
        log_warning "⚠️ Corpus expansion completed with minor issues ($quality_issues warnings)"
        return 0
    else
        log_error "❌ Corpus expansion failed quality assessment ($quality_issues issues)"
        return 1
    fi
}

# Main execution
main() {
    local start_time=$(date +%s)
    
    check_prerequisites
    
    if [[ "$TEST_ONLY" != true ]]; then
        collect_samples || {
            log_error "Sample collection failed"
            exit 1
        }
    fi
    
    if [[ "$COLLECT_ONLY" != true ]]; then
        run_tests || {
            log_error "Testing failed"
            exit 1
        }
        generate_reports
    fi
    
    assess_quality || {
        log_error "Quality assessment failed"
        exit 1
    }
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "🎊 Pipeline completed successfully in ${duration}s"
    log "📁 Results saved to: $OUTPUT_DIR"
    
    # Final summary
    cat << EOF

🔬 ===============================================
   ArachneJS Phase 3.1: Pipeline Complete
   ===============================================

📊 SUMMARY:
   • Samples Collected: $(find "$CORPUS_DIR" -name "wild_sample_*.js" | wc -l)
   • Test Reports: $OUTPUT_DIR/wild-samples-report.html
   • Execution Time: ${duration}s

📁 OUTPUT LOCATIONS:
   • Corpus: $CORPUS_DIR
   • Reports: $OUTPUT_DIR
   • Summary: $OUTPUT_DIR/SUMMARY.md

🚀 NEXT STEPS:
   • Review test results in HTML report
   • Integrate successful patterns into CI
   • Consider expanding corpus if needed

===============================================

EOF
}

# Trap for cleanup
trap 'log_error "Pipeline interrupted"; exit 130' INT TERM

# Run main function
main "$@"