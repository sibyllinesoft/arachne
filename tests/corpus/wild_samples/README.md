# Wild Samples Test Corpus

This directory contains real-world obfuscated JavaScript samples collected from various sources to test ArachneJS deobfuscation robustness.

## Overview

The wild samples corpus is part of **Phase 3.1: Expand and Curate Test Corpus** of the ArachneJS enhancement project. It provides diverse, real-world obfuscated samples to improve robustness and prevent regressions.

## Structure

```
wild_samples/
├── README.md                    # This file
├── samples_metadata.json       # Sample classification and metadata
├── wild_sample_000_*.js        # Collected JavaScript samples
├── wild_sample_001_*.js        # Named by: wild_sample_{index}_{hash}.js
└── ...
```

## Sample Collection

Samples are collected using the automated collection script:

```bash
# Install dependencies
cd scripts/
pip install -r requirements.txt

# Run collection (requires Python 3.11+)
python collect_samples.py

# Collection with GitHub API token for better rate limits
export GITHUB_TOKEN="your_github_token"
python collect_samples.py
```

### Collection Sources

1. **GitHub Repositories**
   - Public repositories containing obfuscated JavaScript
   - Search queries targeting common obfuscation patterns
   - Rate-limited and respectful scraping

2. **Academic Datasets** 
   - Research datasets (requires manual setup)
   - Synthetic samples for testing

3. **MalwareBazaar** (disabled by default)
   - Requires API key and approval
   - Malicious JavaScript samples for robustness testing

### Ethical Considerations

- **Rate Limiting**: 2-second delays between requests
- **robots.txt Compliance**: Respects website policies
- **Educational Use**: Research and testing purposes only
- **No Redistribution**: Samples are for testing only

## Sample Classification

Each sample is automatically classified by obfuscation techniques:

### Detected Techniques

- **String Array Obfuscation**: Encoded string arrays with indirect access
- **Control Flow Flattening**: Switch-based dispatcher patterns
- **VM-Based Obfuscation**: Virtual machine with custom bytecode
- **Dead Code Insertion**: Unreachable code and bogus constructs
- **Identifier Renaming**: Systematic variable/function renaming
- **Eval Patterns**: Dynamic code generation and evaluation

### Classification Metadata

```json
{
  "filename": "wild_sample_001_a1b2c3d4.js",
  "hash": "sha256_hash_of_content",
  "size": 15432,
  "classification": {
    "techniques": {
      "string_array_obfuscation": {
        "score": 0.85,
        "matches": 12,
        "description": "String array with encoded/encrypted strings"
      }
    },
    "overall_score": 0.78,
    "is_obfuscated": true,
    "confidence": 0.85,
    "patterns_detected": ["string_array_obfuscation", "identifier_renaming"]
  },
  "source_metadata": {
    "source": "github",
    "repository": "user/repo",
    "collected_at": 1704067200
  }
}
```

## Integration with Testing

### Differential Testing

Wild samples integrate with the existing differential testing framework:

```bash
# Run wild samples tests
cd tests/differential/
npx tsx wild_samples_runner.ts --config=fixtures/wild_samples.config.json

# Run with existing framework
npx tsx runner.ts --config=fixtures/wild_samples.config.json --tags=wild
```

### Test Configuration

The `wild_samples.config.json` defines:

- **Test Cases**: Individual sample configurations
- **Quality Gates**: Minimum success rates and diversity requirements
- **Difficulty Levels**: Timeout and memory limits by complexity
- **Validation Criteria**: Semantic and performance requirements

### Quality Gates

- **Minimum Samples**: 10+ diverse samples required
- **Diversity Threshold**: 70%+ technique coverage
- **Success Rate**: 60%+ samples should parse and lift successfully
- **Optimization Gains**: Average 20%+ code size reduction expected

## Usage Examples

### Running Wild Samples Tests

```bash
# Collect new samples
python scripts/collect_samples.py

# Run robustness tests
npx tsx tests/differential/wild_samples_runner.ts

# Generate HTML report
# Reports saved to: ./artifacts/wild_sample_reports/
```

### Adding Manual Samples

```bash
# Place JavaScript file in wild_samples/
cp my_obfuscated.js tests/corpus/wild_samples/manual_sample_001.js

# Update metadata (optional - will be auto-generated)
# Edit samples_metadata.json to add classification info
```

### Custom Classification

```python
# In collect_samples.py, customize ObfuscationDetector signatures:

signatures = [
    ObfuscationSignature(
        name="custom_pattern",
        description="My custom obfuscation technique", 
        patterns=[r'custom_regex_pattern']
    )
]
```

## Performance Expectations

### Sample Collection Performance

- **GitHub API**: ~50 samples in 2-3 minutes (with token)
- **Synthetic Generation**: Instant for testing
- **Classification**: ~100ms per sample average

### Testing Performance

- **Parse Time**: <150ms per sample (medium difficulty)
- **Lift Time**: <300ms per sample (medium difficulty)
- **Memory Usage**: <25MB per sample (medium difficulty)

### Success Rate Targets

- **Easy Samples**: 95%+ success rate
- **Medium Samples**: 85%+ success rate  
- **Hard Samples**: 70%+ success rate
- **Very Hard Samples**: 50%+ success rate

## Troubleshooting

### Collection Issues

```bash
# Rate limited by GitHub
export GITHUB_TOKEN="your_token"  # Increases rate limit

# Network connectivity issues
python collect_samples.py --enable-github-collection=false

# Syntax validation failures
# Ensure Node.js is installed and accessible
node --version
```

### Testing Issues

```bash
# Missing sample files
# Check if collection completed successfully
ls -la tests/corpus/wild_samples/

# Performance issues
# Reduce timeout or memory limits in config
# Edit wild_samples.config.json difficulty levels

# Classification accuracy
# Review and tune ObfuscationDetector signatures
# Adjust confidence thresholds in config
```

### Memory Usage

```bash
# Monitor memory during collection
python collect_samples.py &
ps aux | grep python

# Reduce batch size if memory issues
# Edit CollectionConfig.max_samples_per_source
```

## Security Considerations

⚠️ **Important Security Notes**:

1. **Malicious Code**: Samples may contain malicious JavaScript
2. **Sandbox Execution**: Never execute samples outside controlled environment
3. **Network Isolation**: Run collection in isolated network environment
4. **File Permissions**: Samples are stored with restricted permissions
5. **Content Review**: Manual review recommended for critical applications

## Contributing

### Adding New Obfuscation Patterns

1. **Update Detection Signatures**:
   ```python
   # In collect_samples.py
   new_signature = ObfuscationSignature(
       name="new_technique",
       description="Description of technique",
       patterns=["regex1", "regex2"]
   )
   ```

2. **Add Test Configuration**:
   ```json
   // In wild_samples.config.json
   {
     "name": "new_technique_test",
     "classification": {
       "primary_technique": "new_technique"
     }
   }
   ```

3. **Update Documentation**:
   - Add technique description to this README
   - Update classification metadata examples

### Improving Collection Coverage

1. **New Sources**: Add collection methods for new repositories/datasets
2. **Better Filtering**: Improve quality filtering and deduplication
3. **Enhanced Classification**: More sophisticated pattern detection
4. **Performance**: Optimize collection and processing speeds

## Monitoring and Metrics

### Collection Metrics

- **Total Samples Collected**: Target 50+ diverse samples
- **Source Distribution**: Balanced across multiple sources  
- **Technique Coverage**: All major obfuscation types represented
- **Quality Score**: Average confidence >70%

### Test Metrics

- **Robustness Score**: Overall success rate across all samples
- **Diversity Score**: Coverage of different obfuscation techniques
- **Performance Metrics**: Average parse/lift times and memory usage
- **Regression Detection**: Comparison with historical baselines

## Future Enhancements

### Planned Improvements

1. **Machine Learning Classification**: Neural network-based pattern detection
2. **Dynamic Analysis**: Runtime behavior classification
3. **Automated Golden Files**: Generate expected outputs for samples
4. **Continuous Collection**: Automated periodic sample collection
5. **Advanced Metrics**: Code complexity and obfuscation strength scoring

### Research Integration

- **Academic Collaboration**: Integration with research datasets
- **Benchmark Suites**: Comparison with academic deobfuscation tools
- **Publication**: Research papers on obfuscation pattern analysis
- **Open Source**: Community-contributed sample collection

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Contact**: ArachneJS Development Team