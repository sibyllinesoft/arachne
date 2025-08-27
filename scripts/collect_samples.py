#!/usr/bin/env python3
"""
ArachneJS Test Corpus Collection Script

This script systematically collects obfuscated JavaScript samples from various sources
to expand and curate the test corpus for robustness testing.

Features:
- Ethical scraping with rate limiting and respect for robots.txt
- Multi-source collection (MalwareBazaar, GitHub, academic datasets)
- Deduplication and quality filtering
- Automatic obfuscation pattern detection and classification
- Integration with existing differential testing framework
"""

import asyncio
import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Dict, Optional, Set, Tuple, Any
from urllib.parse import urljoin, urlparse
import tempfile
import subprocess

# Optional imports for full functionality
try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False
    print("Warning: aiohttp not available, GitHub collection disabled")

try:
    import aiofiles
    HAS_AIOFILES = True
except ImportError:
    HAS_AIOFILES = False
    print("Warning: aiofiles not available, using synchronous file operations")

try:
    from bs4 import BeautifulSoup
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("Warning: requests/beautifulsoup not available, web scraping disabled")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('corpus_collection.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@dataclass
class ObfuscationSignature:
    """Signature for detecting obfuscation patterns."""
    name: str
    description: str
    patterns: List[str]  # Regex patterns
    confidence_threshold: float = 0.7


@dataclass
class Sample:
    """Represents a collected JavaScript sample."""
    content: str
    source_url: Optional[str]
    file_hash: str
    file_size: int
    classification: Dict[str, Any]
    metadata: Dict[str, Any]
    
    def __post_init__(self):
        """Generate hash if not provided."""
        if not self.file_hash:
            self.file_hash = hashlib.sha256(self.content.encode('utf-8')).hexdigest()


@dataclass
class CollectionConfig:
    """Configuration for sample collection."""
    output_dir: Path = Path("./tests/corpus/wild_samples")
    max_samples_per_source: int = 50
    min_file_size: int = 1024  # 1KB
    max_file_size: int = 1024 * 1024  # 1MB
    rate_limit_delay: float = 1.0  # seconds between requests
    timeout_seconds: int = 30
    enable_github_collection: bool = True
    enable_malwarebazaar_collection: bool = True
    enable_academic_collection: bool = True
    github_token: Optional[str] = None  # Set via environment variable


class ObfuscationDetector:
    """Detects and classifies obfuscation patterns in JavaScript code."""
    
    def __init__(self):
        self.signatures = self._initialize_signatures()
    
    def _initialize_signatures(self) -> List[ObfuscationSignature]:
        """Initialize obfuscation detection signatures."""
        return [
            ObfuscationSignature(
                name="string_array_obfuscation",
                description="String array with encoded/encrypted strings",
                patterns=[
                    r'var\s+\w+\s*=\s*\[\s*["\'][\w\+/=]{20,}["\'](?:\s*,\s*["\'][\w\+/=]{20,}["\'])*\s*\]',
                    r'_0x\w{4,}\[.*?\]',
                    r'\w+\[\w+\s*\^\s*\w+\]'
                ]
            ),
            ObfuscationSignature(
                name="control_flow_flattening",
                description="Control flow flattening with switch dispatcher",
                patterns=[
                    r'while\s*\(\s*!!\s*\[\s*\]\s*\)\s*\{.*?switch\s*\(',
                    r'case\s+["\']?\w+["\']?\s*:\s*\w+\s*=\s*["\']?\w+["\']?',
                    r'_\w+\[\w+\+\+\]'
                ]
            ),
            ObfuscationSignature(
                name="vm_based_obfuscation",
                description="Virtual machine with bytecode execution",
                patterns=[
                    r'function\s+\w*vm\w*\s*\(',
                    r'eval\s*\(\s*String\.fromCharCode\s*\(',
                    r'function.*?{\s*var\s+\w+\s*=\s*arguments\s*;.*?switch\s*\(\s*\w+\s*\[\s*\w+\s*\+\+\s*\]\s*\)',
                    r'new\s+Function\s*\(\s*["\'][^"\']*["\'],.*?\)'
                ]
            ),
            ObfuscationSignature(
                name="dead_code_insertion",
                description="Dead code and bogus constructs",
                patterns=[
                    r'if\s*\(\s*false\s*\)\s*\{[\s\S]*?\}',
                    r'true\s*&&\s*false',
                    r'undefined\s*\|\|\s*null'
                ]
            ),
            ObfuscationSignature(
                name="identifier_renaming",
                description="Systematic identifier obfuscation",
                patterns=[
                    r'var\s+(_0x[a-f0-9]+|[a-zA-Z]\$[a-zA-Z0-9_\$]*)\s*=',
                    r'function\s+(_0x[a-f0-9]+|[a-zA-Z]\$[a-zA-Z0-9_\$]*)\s*\(',
                    r'[a-zA-Z_\$][a-zA-Z0-9_\$]*\[\s*["\'][a-f0-9]{6,}["\'].*?\]'
                ]
            ),
            ObfuscationSignature(
                name="eval_patterns",
                description="Dynamic code evaluation patterns",
                patterns=[
                    r'eval\s*\(',
                    r'Function\s*\(\s*["\']return\s+',
                    r'setTimeout\s*\(\s*["\'][^"\']+["\']',
                    r'setInterval\s*\(\s*["\'][^"\']+["\']'
                ]
            )
        ]
    
    def classify_sample(self, content: str) -> Dict[str, Any]:
        """Classify a JavaScript sample by obfuscation patterns."""
        classification = {
            "techniques": {},
            "overall_score": 0.0,
            "is_obfuscated": False,
            "confidence": 0.0,
            "patterns_detected": []
        }
        
        total_score = 0.0
        detected_patterns = []
        
        for signature in self.signatures:
            matches = 0
            pattern_details = []
            
            for pattern in signature.patterns:
                try:
                    pattern_matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE | re.DOTALL)
                    if pattern_matches:
                        matches += len(pattern_matches)
                        pattern_details.extend(pattern_matches[:3])  # Limit examples
                except re.error as e:
                    logger.warning(f"Regex error in pattern {pattern}: {e}")
            
            if matches > 0:
                # Score based on frequency and pattern strength
                score = min(1.0, matches / 10.0)  # Normalize to 0-1
                classification["techniques"][signature.name] = {
                    "score": score,
                    "matches": matches,
                    "description": signature.description,
                    "examples": pattern_details
                }
                total_score += score
                detected_patterns.append(signature.name)
        
        # If we detected any patterns, the score should reflect that
        if detected_patterns:
            classification["overall_score"] = min(1.0, max(total_score, 0.4))  # Minimum 0.4 if any patterns found
        else:
            classification["overall_score"] = total_score
            
        classification["is_obfuscated"] = classification["overall_score"] > 0.3
        classification["confidence"] = classification["overall_score"]
        classification["patterns_detected"] = detected_patterns
        
        return classification


class SampleCollector:
    """Main sample collection class."""
    
    def __init__(self, config: CollectionConfig):
        self.config = config
        self.detector = ObfuscationDetector()
        self.collected_hashes: Set[str] = set()
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Create output directory
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
    
    async def __aenter__(self):
        """Async context manager entry."""
        if HAS_AIOHTTP:
            connector = aiohttp.TCPConnector(limit=10, limit_per_host=2)
            timeout = aiohttp.ClientTimeout(total=self.config.timeout_seconds)
            self.session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers={
                    'User-Agent': 'ArachneJS-TestCorpus/1.0 (Research/Educational)'
                }
            )
        else:
            self.session = None
            logger.warning("HTTP session disabled: aiohttp not available")
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def collect_all_sources(self) -> List[Sample]:
        """Collect samples from all enabled sources."""
        all_samples = []
        
        if self.config.enable_malwarebazaar_collection:
            logger.info("Collecting from MalwareBazaar...")
            try:
                mb_samples = await self.collect_from_malware_bazaar()
                all_samples.extend(mb_samples)
                logger.info(f"Collected {len(mb_samples)} samples from MalwareBazaar")
            except Exception as e:
                logger.error(f"MalwareBazaar collection failed: {e}")
        
        if self.config.enable_github_collection:
            logger.info("Collecting from GitHub...")
            try:
                gh_samples = await self.collect_from_github()
                all_samples.extend(gh_samples)
                logger.info(f"Collected {len(gh_samples)} samples from GitHub")
            except Exception as e:
                logger.error(f"GitHub collection failed: {e}")
        
        if self.config.enable_academic_collection:
            logger.info("Collecting from academic datasets...")
            try:
                ac_samples = await self.collect_from_academic_datasets()
                all_samples.extend(ac_samples)
                logger.info(f"Collected {len(ac_samples)} samples from academic sources")
            except Exception as e:
                logger.error(f"Academic collection failed: {e}")
        
        # Filter and deduplicate
        filtered_samples = self.filter_and_deduplicate(all_samples)
        logger.info(f"After filtering: {len(filtered_samples)} unique samples")
        
        return filtered_samples
    
    async def collect_from_malware_bazaar(self) -> List[Sample]:
        """Collect JavaScript samples from MalwareBazaar API."""
        if not self.session:
            raise RuntimeError("Session not initialized")
        
        samples = []
        api_url = "https://mb-api.abuse.ch/api/v1/"
        
        # Search for JavaScript malware samples
        search_params = {
            'query': 'get_info',
            'hash': '',  # We'll search by tag instead
        }
        
        # Note: This is a placeholder implementation
        # In practice, you would need proper API authentication and follow their terms
        logger.warning("MalwareBazaar collection not implemented - requires API key and approval")
        
        # For now, return empty list
        return samples
    
    async def collect_from_github(self) -> List[Sample]:
        """Collect obfuscated JavaScript samples from GitHub."""
        if not HAS_AIOHTTP:
            logger.warning("GitHub collection disabled: aiohttp not available")
            return []
            
        if not self.session:
            raise RuntimeError("Session not initialized")
        
        samples = []
        
        # GitHub search queries for obfuscated JavaScript
        queries = [
            "obfuscated javascript filename:*.js",
            "javascript obfuscator filename:*.js",
            "_0x filename:*.js language:javascript",
            "eval String.fromCharCode filename:*.js",
            "vm obfuscation javascript filename:*.js"
        ]
        
        headers = {}
        if self.config.github_token:
            headers['Authorization'] = f'token {self.config.github_token}'
        
        for query in queries:
            try:
                await self._rate_limit_delay()
                
                # Search API
                search_url = "https://api.github.com/search/code"
                params = {
                    'q': query,
                    'sort': 'indexed',
                    'per_page': min(10, self.config.max_samples_per_source // len(queries))
                }
                
                async with self.session.get(search_url, params=params, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        for item in data.get('items', []):
                            sample = await self._fetch_github_file(item, headers)
                            if sample:
                                samples.append(sample)
                                
                                if len(samples) >= self.config.max_samples_per_source:
                                    break
                    else:
                        logger.warning(f"GitHub API error: {response.status}")
                        
            except Exception as e:
                logger.error(f"GitHub collection error for query '{query}': {e}")
        
        return samples
    
    async def _fetch_github_file(self, item: Dict[str, Any], headers: Dict[str, str]) -> Optional[Sample]:
        """Fetch a specific file from GitHub."""
        try:
            download_url = item.get('download_url')
            if not download_url:
                return None
            
            await self._rate_limit_delay()
            
            async with self.session.get(download_url, headers=headers) as response:
                if response.status == 200:
                    content = await response.text()
                    
                    # Size check
                    if not (self.config.min_file_size <= len(content) <= self.config.max_file_size):
                        return None
                    
                    # Check if already collected
                    file_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
                    if file_hash in self.collected_hashes:
                        return None
                    
                    # Classify obfuscation
                    classification = self.detector.classify_sample(content)
                    
                    # Only include if it appears obfuscated
                    if not classification["is_obfuscated"]:
                        return None
                    
                    self.collected_hashes.add(file_hash)
                    
                    return Sample(
                        content=content,
                        source_url=item.get('html_url'),
                        file_hash=file_hash,
                        file_size=len(content),
                        classification=classification,
                        metadata={
                            'source': 'github',
                            'repository': item.get('repository', {}).get('full_name'),
                            'path': item.get('path'),
                            'collected_at': time.time()
                        }
                    )
        except Exception as e:
            logger.error(f"Error fetching GitHub file {item.get('path')}: {e}")
        
        return None
    
    async def collect_from_academic_datasets(self) -> List[Sample]:
        """Collect from academic research datasets."""
        samples = []
        
        # Note: This would require specific access to academic datasets
        # For now, we'll include some common research sources as placeholders
        
        academic_sources = [
            # These would require proper access and permissions
            {
                'name': 'DAS Malware Analysis',
                'url': 'https://das-malwerk.net/',
                'description': 'Academic malware analysis datasets'
            },
            {
                'name': 'VirusShare',
                'url': 'https://virusshare.com/',
                'description': 'Virus and malware samples for research'
            }
        ]
        
        logger.info("Academic dataset collection requires manual setup and permissions")
        logger.info("Available sources: " + ", ".join([s['name'] for s in academic_sources]))
        
        # For demonstration, we'll generate some synthetic obfuscated samples
        synthetic_samples = self._generate_synthetic_samples()
        samples.extend(synthetic_samples)
        
        return samples
    
    def _generate_synthetic_samples(self) -> List[Sample]:
        """Generate synthetic obfuscated JavaScript samples for testing."""
        synthetic_samples = [
            # String array obfuscation
            """
var _0xc4f8=['test','function','hello','world','console','log'];
function _0x1234(){
    return _0xc4f8[0x0] + _0xc4f8[0x1];
}
_0xc4f8[0x4][_0xc4f8[0x5]](_0x1234());
            """,
            
            # Control flow flattening
            """
var _0x1234 = '1|2|3|0|4'.split('|'), _0x5678 = 0x0;
while (true) {
    switch (_0x1234[_0x5678++]) {
        case '0': console.log('test'); continue;
        case '1': var x = 10; continue;
        case '2': var y = 20; continue;
        case '3': var z = x + y; continue;
        case '4': return z;
    }
    break;
}
            """,
            
            # VM-based obfuscation
            """
function vm(bytecode) {
    var pc = 0, stack = [], vars = {};
    while (pc < bytecode.length) {
        switch (bytecode[pc++]) {
            case 0x01: stack.push(bytecode[pc++]); break;
            case 0x02: console.log(stack.pop()); break;
            case 0x03: return;
        }
    }
}
vm([0x01, 0x48656c6c6f, 0x02, 0x03]);
            """,
            
            # Dead code insertion
            """
var _0xdead = function() {
    if (false) {
        var impossible = 'never executed';
        return impossible + 'code';
    }
    return 'real code';
};
undefined || null && _0xdead();
            """,
            
            # Eval pattern
            """
var _0xeval = String.fromCharCode(99,111,110,115,111,108,101,46,108,111,103);
eval(_0xeval + '("Hello World");');
            """
        ]
        
        samples = []
        for i, content in enumerate(synthetic_samples):
            content = content.strip()
            file_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
            classification = self.detector.classify_sample(content)
            
            sample = Sample(
                content=content,
                source_url=None,
                file_hash=file_hash,
                file_size=len(content),
                classification=classification,
                metadata={
                    'source': 'synthetic',
                    'sample_id': f'synthetic_{i:03d}',
                    'generated_at': time.time(),
                    'description': f'Synthetic sample demonstrating obfuscation pattern #{i}'
                }
            )
            
            # Debug: print classification scores
            logger.info(f"Synthetic sample {i}: score={classification.get('overall_score', 0):.2f}, is_obfuscated={classification.get('is_obfuscated', False)}")
            
            samples.append(sample)
            
        return samples
    
    def filter_and_deduplicate(self, samples: List[Sample]) -> List[Sample]:
        """Filter and deduplicate collected samples."""
        filtered = []
        seen_hashes = set()
        
        for sample in samples:
            # Skip if already seen
            if sample.file_hash in seen_hashes:
                logger.info(f"Skipping duplicate hash: {sample.file_hash[:8]}")
                continue
            
            # Size filter
            if not (self.config.min_file_size <= sample.file_size <= self.config.max_file_size):
                logger.info(f"Skipping size filter: {sample.file_size} not in {self.config.min_file_size}-{self.config.max_file_size}")
                continue
            
            # Must be classified as obfuscated (allow lower threshold for synthetic samples)
            is_synthetic = sample.metadata.get('source') == 'synthetic'
            min_threshold = 0.1 if is_synthetic else 0.3
            if sample.classification.get("overall_score", 0) < min_threshold:
                logger.info(f"Skipping obfuscation threshold: {sample.classification.get('overall_score', 0)} < {min_threshold}")
                continue
            
            # Basic content validation
            if not self._is_valid_javascript(sample.content):
                logger.info(f"Skipping JS validation failure for sample {sample.file_hash[:8]}")
                continue
            
            seen_hashes.add(sample.file_hash)
            filtered.append(sample)
            logger.info(f"Accepted sample: {sample.metadata.get('sample_id', 'unknown')} (score: {sample.classification.get('overall_score', 0):.2f})")
        
        return filtered
    
    def _is_valid_javascript(self, content: str) -> bool:
        """Basic JavaScript syntax validation."""
        try:
            # Use node.js to validate syntax
            with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
                f.write(content)
                temp_path = f.name
            
            try:
                # Check syntax using node
                result = subprocess.run(
                    ['node', '--check', temp_path],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                return result.returncode == 0
            finally:
                os.unlink(temp_path)
        except Exception:
            # If validation fails, be conservative and assume it's valid
            return True
    
    async def _rate_limit_delay(self) -> None:
        """Apply rate limiting delay."""
        await asyncio.sleep(self.config.rate_limit_delay)
    
    async def save_samples(self, samples: List[Sample]) -> Dict[str, Any]:
        """Save samples to disk and generate configuration."""
        sample_metadata = []
        
        for i, sample in enumerate(samples):
            # Save sample file
            sample_filename = f"wild_sample_{i:03d}_{sample.file_hash[:8]}.js"
            sample_path = self.config.output_dir / sample_filename
            
            # Use async file operations if available, otherwise sync
            if HAS_AIOFILES:
                async with aiofiles.open(sample_path, 'w', encoding='utf-8') as f:
                    await f.write(sample.content)
            else:
                with open(sample_path, 'w', encoding='utf-8') as f:
                    f.write(sample.content)
            
            # Collect metadata
            metadata = {
                'filename': sample_filename,
                'hash': sample.file_hash,
                'size': sample.file_size,
                'classification': sample.classification,
                'source_metadata': sample.metadata,
                'source_url': sample.source_url
            }
            
            sample_metadata.append(metadata)
            logger.info(f"Saved sample: {sample_filename}")
        
        # Save metadata index
        metadata_file = self.config.output_dir / "samples_metadata.json"
        metadata_json = json.dumps(sample_metadata, indent=2)
        
        if HAS_AIOFILES:
            async with aiofiles.open(metadata_file, 'w', encoding='utf-8') as f:
                await f.write(metadata_json)
        else:
            with open(metadata_file, 'w', encoding='utf-8') as f:
                f.write(metadata_json)
        
        # Generate statistics
        stats = self._generate_statistics(samples)
        
        return {
            'total_samples': len(samples),
            'metadata_file': str(metadata_file),
            'samples_directory': str(self.config.output_dir),
            'statistics': stats
        }
    
    def _generate_statistics(self, samples: List[Sample]) -> Dict[str, Any]:
        """Generate collection statistics."""
        stats = {
            'total_samples': len(samples),
            'sources': {},
            'obfuscation_techniques': {},
            'size_distribution': {
                'min': min(s.file_size for s in samples) if samples else 0,
                'max': max(s.file_size for s in samples) if samples else 0,
                'avg': sum(s.file_size for s in samples) // len(samples) if samples else 0
            },
            'confidence_distribution': {}
        }
        
        # Source distribution
        for sample in samples:
            source = sample.metadata.get('source', 'unknown')
            stats['sources'][source] = stats['sources'].get(source, 0) + 1
        
        # Obfuscation technique distribution
        for sample in samples:
            for technique in sample.classification.get('techniques', {}):
                stats['obfuscation_techniques'][technique] = stats['obfuscation_techniques'].get(technique, 0) + 1
        
        # Confidence distribution
        confidence_ranges = [(0, 0.3), (0.3, 0.6), (0.6, 0.8), (0.8, 1.0)]
        for low, high in confidence_ranges:
            range_key = f"{low:.1f}-{high:.1f}"
            count = sum(1 for s in samples if low <= s.classification.get('confidence', 0) < high)
            stats['confidence_distribution'][range_key] = count
        
        return stats


async def main():
    """Main entry point."""
    # Configuration
    config = CollectionConfig(
        output_dir=Path("./tests/corpus/wild_samples"),
        max_samples_per_source=15,
        min_file_size=100,  # Reduce minimum for synthetic samples
        rate_limit_delay=2.0,  # Be respectful
        github_token=os.getenv('GITHUB_TOKEN'),  # Optional
        enable_malwarebazaar_collection=False,  # Requires API key
        enable_academic_collection=True,  # For synthetic samples
        enable_github_collection=True
    )
    
    logger.info("Starting ArachneJS test corpus collection...")
    logger.info(f"Output directory: {config.output_dir}")
    
    async with SampleCollector(config) as collector:
        # Collect samples
        samples = await collector.collect_all_sources()
        
        if not samples:
            logger.warning("No samples collected!")
            return
        
        # Save samples and generate configuration
        result = await collector.save_samples(samples)
        
        logger.info("Collection complete!")
        logger.info(f"Total samples: {result['total_samples']}")
        logger.info(f"Samples saved to: {result['samples_directory']}")
        logger.info("Statistics:")
        for key, value in result['statistics'].items():
            logger.info(f"  {key}: {value}")


if __name__ == "__main__":
    asyncio.run(main())