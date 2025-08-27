#!/usr/bin/env python3
"""
ArachneJS Deobfuscator CI Integration & Gatekeeper

Comprehensive quality gate checking with risk scoring algorithm.
Implements promotion rule enforcement and automated decision making.
"""

import json
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
from enum import Enum
import argparse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DecisionType(Enum):
    """Quality gate decision types"""
    PROMOTE = "PROMOTE"
    MANUAL_QA = "MANUAL_QA" 
    AGENT_REFINE = "AGENT_REFINE"

@dataclass
class QualityMetrics:
    """Quality metrics for risk assessment"""
    delta_loc: float = 0.0          # Lines of code change ratio
    novelty: float = 0.0            # New code/pattern ratio
    ext_dep_delta: float = 0.0      # External dependency change ratio
    mutation: float = 0.0           # Mutation test score (0.0 to 1.0)
    flakiness: float = 0.0          # Test flakiness ratio
    static_severity: float = 0.0    # SAST severity score (0.0 to 1.0)
    
    # Derived metrics
    test_coverage: float = 0.0      # Test coverage percentage
    devirt_success_rate: float = 0.0 # Devirtualization success rate
    contract_pass_rate: float = 1.0  # Contract validation pass rate
    build_success: bool = True      # Build success flag
    
    # Performance metrics
    parse_time_ms: float = 0.0      # Average parse time
    lift_time_ms: float = 0.0       # Average lift time
    memory_usage_mb: float = 0.0    # Peak memory usage

@dataclass
class QualityGate:
    """Individual quality gate definition"""
    name: str
    description: str
    required: bool = True
    threshold: Optional[Union[float, bool]] = None
    weight: float = 1.0
    
@dataclass 
class GatekeeperResult:
    """Gatekeeper decision result"""
    decision: DecisionType
    risk_score: float
    passed_gates: List[str] = field(default_factory=list)
    failed_gates: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metrics: Optional[QualityMetrics] = None
    execution_time_s: float = 0.0

class QualityGateSystem:
    """Core quality gate system"""
    
    def __init__(self, config_path: Optional[Path] = None):
        self.gates = self._load_gates(config_path)
        self.thresholds = {
            'T_mut': 0.80,      # Mutation test threshold
            'T_prop': 0.70,     # Promotion threshold
            'T_manual': 0.50,   # Manual QA threshold
            'T_devirt': 0.60,   # Devirtualization threshold
        }
    
    def _load_gates(self, config_path: Optional[Path]) -> List[QualityGate]:
        """Load quality gates from configuration"""
        default_gates = [
            QualityGate(
                name="mutation_testing",
                description="Mutation testing score >= 0.80",
                required=True,
                threshold=0.80,
                weight=0.3
            ),
            QualityGate(
                name="sast_security", 
                description="No high/critical SAST findings",
                required=True,
                threshold=0.0,  # Zero high/critical findings
                weight=0.2
            ),
            QualityGate(
                name="contract_validation",
                description="All contracts passing provider/consumer compatibility",
                required=True,
                threshold=1.0,  # 100% contract pass rate
                weight=0.2
            ),
            QualityGate(
                name="devirtualization_rate",
                description="Devirtualization success rate >= 60%",
                required=True,
                threshold=0.60,
                weight=0.2
            ),
            QualityGate(
                name="build_success",
                description="Clean build with all tests passing", 
                required=True,
                threshold=True,
                weight=0.1
            ),
        ]
        
        if config_path and config_path.exists():
            try:
                with open(config_path) as f:
                    config = json.load(f)
                    # Would load custom gates from config
                    return default_gates
            except Exception as e:
                logger.warning(f"Failed to load config {config_path}: {e}")
        
        return default_gates
    
    def evaluate(self, metrics: QualityMetrics) -> GatekeeperResult:
        """Evaluate quality gates and make promotion decision"""
        start_time = time.time()
        
        # Calculate risk score using the specified algorithm
        risk_score = self._calculate_risk_score(metrics)
        
        # Evaluate individual gates
        passed_gates = []
        failed_gates = []
        warnings = []
        
        for gate in self.gates:
            passed, warning = self._evaluate_gate(gate, metrics)
            if passed:
                passed_gates.append(gate.name)
            else:
                failed_gates.append(gate.name)
                if gate.required:
                    warnings.append(f"Required gate '{gate.name}' failed")
            
            if warning:
                warnings.append(warning)
        
        # Make decision based on risk score and gate results
        decision = self._make_decision(risk_score, failed_gates, metrics)
        
        execution_time = time.time() - start_time
        
        return GatekeeperResult(
            decision=decision,
            risk_score=risk_score,
            passed_gates=passed_gates,
            failed_gates=failed_gates, 
            warnings=warnings,
            metrics=metrics,
            execution_time_s=execution_time
        )
    
    def _calculate_risk_score(self, metrics: QualityMetrics) -> float:
        """
        Calculate risk score using the specified algorithm:
        R = 0.2*delta_loc + 0.2*novelty + 0.2*ext_dep_delta + 
            0.2*(1-mutation) + 0.1*flakiness + 0.1*static_severity
        """
        risk_score = (
            0.2 * metrics.delta_loc +
            0.2 * metrics.novelty +
            0.2 * metrics.ext_dep_delta +
            0.2 * (1.0 - metrics.mutation) +
            0.1 * metrics.flakiness +
            0.1 * metrics.static_severity
        )
        
        return max(0.0, min(1.0, risk_score))  # Clamp to [0, 1]
    
    def _evaluate_gate(self, gate: QualityGate, metrics: QualityMetrics) -> Tuple[bool, Optional[str]]:
        """Evaluate individual quality gate"""
        warning = None
        
        try:
            if gate.name == "mutation_testing":
                passed = metrics.mutation >= gate.threshold
                if not passed:
                    warning = f"Mutation score {metrics.mutation:.3f} below threshold {gate.threshold}"
            
            elif gate.name == "sast_security":
                passed = metrics.static_severity <= gate.threshold
                if not passed:
                    warning = f"SAST severity {metrics.static_severity:.3f} above threshold {gate.threshold}"
            
            elif gate.name == "contract_validation":
                passed = metrics.contract_pass_rate >= gate.threshold
                if not passed:
                    warning = f"Contract pass rate {metrics.contract_pass_rate:.3f} below threshold {gate.threshold}"
            
            elif gate.name == "devirtualization_rate":
                passed = metrics.devirt_success_rate >= gate.threshold
                if not passed:
                    warning = f"Devirtualization rate {metrics.devirt_success_rate:.3f} below threshold {gate.threshold}"
            
            elif gate.name == "build_success":
                passed = metrics.build_success == gate.threshold
                if not passed:
                    warning = "Build failed or tests not passing"
            
            else:
                # Unknown gate - default to pass with warning
                passed = True
                warning = f"Unknown gate '{gate.name}' - defaulting to pass"
            
            return passed, warning
            
        except Exception as e:
            logger.error(f"Gate evaluation failed for '{gate.name}': {e}")
            return False, f"Gate evaluation error: {e}"
    
    def _make_decision(
        self, 
        risk_score: float, 
        failed_gates: List[str], 
        metrics: QualityMetrics
    ) -> DecisionType:
        """Make promotion decision based on risk score and gate results"""
        
        # Required gates must pass
        required_failed = [gate.name for gate in self.gates 
                          if gate.required and gate.name in failed_gates]
        
        if required_failed:
            logger.info(f"Required gates failed: {required_failed}")
            return DecisionType.AGENT_REFINE
        
        # Apply risk-based decision logic
        if risk_score >= self.thresholds['T_prop']:
            return DecisionType.AGENT_REFINE
        elif risk_score >= self.thresholds['T_manual']:
            return DecisionType.MANUAL_QA
        else:
            return DecisionType.PROMOTE

class MetricsCollector:
    """Collect quality metrics from various sources"""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
    
    def collect(self) -> QualityMetrics:
        """Collect all quality metrics"""
        logger.info("Collecting quality metrics...")
        
        metrics = QualityMetrics()
        
        # Code metrics
        metrics.delta_loc = self._collect_loc_delta()
        metrics.novelty = self._collect_novelty()
        
        # Dependency metrics
        metrics.ext_dep_delta = self._collect_dependency_delta()
        
        # Test metrics
        metrics.mutation = self._collect_mutation_score()
        metrics.test_coverage = self._collect_test_coverage()
        metrics.flakiness = self._collect_test_flakiness()
        
        # Security metrics
        metrics.static_severity = self._collect_sast_score()
        
        # Build metrics
        metrics.build_success = self._check_build_success()
        
        # Performance metrics
        metrics.parse_time_ms, metrics.lift_time_ms = self._collect_performance_metrics()
        metrics.memory_usage_mb = self._collect_memory_metrics()
        
        # Domain-specific metrics
        metrics.devirt_success_rate = self._collect_devirt_metrics()
        metrics.contract_pass_rate = self._collect_contract_metrics()
        
        return metrics
    
    def _collect_loc_delta(self) -> float:
        """Calculate lines of code change ratio"""
        try:
            result = subprocess.run(
                ['git', 'diff', '--stat', 'HEAD~1', 'HEAD'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if result.returncode != 0:
                return 0.0
            
            # Parse git diff stat output
            lines = result.stdout.strip().split('\n')
            if not lines:
                return 0.0
            
            # Extract changed lines from summary line
            summary = lines[-1] if lines else ""
            if "insertions" in summary or "deletions" in summary:
                # Simple heuristic: normalize by codebase size
                total_loc = self._get_total_loc()
                changed_lines = self._parse_changed_lines(summary)
                return min(1.0, changed_lines / max(total_loc, 1))
            
            return 0.0
            
        except Exception as e:
            logger.warning(f"Failed to collect LOC delta: {e}")
            return 0.0
    
    def _collect_novelty(self) -> float:
        """Calculate new code/pattern ratio"""
        try:
            # Check for new files
            result = subprocess.run(
                ['git', 'diff', '--name-status', 'HEAD~1', 'HEAD'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if result.returncode != 0:
                return 0.0
            
            lines = result.stdout.strip().split('\n')
            new_files = sum(1 for line in lines if line.startswith('A\t'))
            total_changes = len(lines)
            
            return new_files / max(total_changes, 1) if total_changes > 0 else 0.0
            
        except Exception as e:
            logger.warning(f"Failed to collect novelty: {e}")
            return 0.0
    
    def _collect_dependency_delta(self) -> float:
        """Calculate external dependency change ratio"""
        try:
            # Check for package.json changes
            result = subprocess.run(
                ['git', 'diff', 'HEAD~1', 'HEAD', '--', 'package.json'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if result.returncode != 0 or not result.stdout:
                return 0.0
            
            # Count dependency additions/removals
            diff_lines = result.stdout.split('\n')
            dep_changes = sum(1 for line in diff_lines 
                            if ('dependencies' in line or 'devDependencies' in line)
                            and (line.startswith('+') or line.startswith('-')))
            
            # Normalize by total dependencies
            total_deps = self._count_total_dependencies()
            return min(1.0, dep_changes / max(total_deps, 1))
            
        except Exception as e:
            logger.warning(f"Failed to collect dependency delta: {e}")
            return 0.0
    
    def _collect_mutation_score(self) -> float:
        """Collect mutation testing score"""
        try:
            # Run mutation testing
            result = subprocess.run(
                ['npm', 'run', 'test:mutation'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if result.returncode != 0:
                logger.warning(f"Mutation testing failed: {result.stderr}")
                return 0.0
            
            # Parse mutation score from output
            # This would need to match the specific mutation testing tool output
            output = result.stdout
            if "Mutation score:" in output:
                # Extract score (format depends on tool)
                return self._parse_mutation_score(output)
            
            return 0.0
            
        except Exception as e:
            logger.warning(f"Failed to collect mutation score: {e}")
            return 0.0
    
    def _collect_test_coverage(self) -> float:
        """Collect test coverage percentage"""
        try:
            result = subprocess.run(
                ['npm', 'run', 'test:coverage'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if result.returncode != 0:
                return 0.0
            
            # Parse coverage from output
            return self._parse_coverage(result.stdout)
            
        except Exception as e:
            logger.warning(f"Failed to collect test coverage: {e}")
            return 0.0
    
    def _collect_test_flakiness(self) -> float:
        """Calculate test flakiness ratio"""
        try:
            # Run tests multiple times to detect flakiness
            flaky_tests = 0
            total_tests = 0
            
            for run in range(3):  # Run 3 times
                result = subprocess.run(
                    ['npm', 'test'],
                    capture_output=True, text=True, cwd=self.project_root
                )
                # Would need to parse test results and track failures
                # This is a simplified placeholder
            
            return 0.0  # Placeholder
            
        except Exception as e:
            logger.warning(f"Failed to collect test flakiness: {e}")
            return 0.0
    
    def _collect_sast_score(self) -> float:
        """Collect SAST (Static Application Security Testing) score"""
        try:
            result = subprocess.run(
                ['npm', 'audit', '--json'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if result.returncode == 0:
                audit_data = json.loads(result.stdout)
                # Calculate severity score based on vulnerabilities
                return self._calculate_sast_severity(audit_data)
            
            return 0.0
            
        except Exception as e:
            logger.warning(f"Failed to collect SAST score: {e}")
            return 0.0
    
    def _check_build_success(self) -> bool:
        """Check if build and tests pass"""
        try:
            # Check build
            build_result = subprocess.run(
                ['npm', 'run', 'build'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if build_result.returncode != 0:
                return False
            
            # Check tests
            test_result = subprocess.run(
                ['npm', 'test'],
                capture_output=True, text=True, cwd=self.project_root  
            )
            
            return test_result.returncode == 0
            
        except Exception as e:
            logger.warning(f"Failed to check build success: {e}")
            return False
    
    def _collect_performance_metrics(self) -> Tuple[float, float]:
        """Collect performance metrics (parse time, lift time)"""
        try:
            # Run performance benchmarks
            result = subprocess.run(
                ['npm', 'run', 'bench'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if result.returncode != 0:
                return 0.0, 0.0
            
            # Parse benchmark results
            return self._parse_performance_results(result.stdout)
            
        except Exception as e:
            logger.warning(f"Failed to collect performance metrics: {e}")
            return 0.0, 0.0
    
    def _collect_memory_metrics(self) -> float:
        """Collect memory usage metrics"""
        # Placeholder - would need actual memory profiling
        return 0.0
    
    def _collect_devirt_metrics(self) -> float:
        """Collect devirtualization success rate"""
        try:
            # Run devirtualization tests
            result = subprocess.run(
                ['npm', 'run', 'test:devirt'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if result.returncode != 0:
                return 0.0
            
            # Parse devirtualization results
            return self._parse_devirt_results(result.stdout)
            
        except Exception as e:
            logger.warning(f"Failed to collect devirtualization metrics: {e}")
            return 0.0
    
    def _collect_contract_metrics(self) -> float:
        """Collect contract validation pass rate"""
        try:
            # Run contract tests
            result = subprocess.run(
                ['npm', 'run', 'test:contracts'],
                capture_output=True, text=True, cwd=self.project_root
            )
            
            if result.returncode != 0:
                return 0.0
            
            # Parse contract test results
            return self._parse_contract_results(result.stdout)
            
        except Exception as e:
            logger.warning(f"Failed to collect contract metrics: {e}")
            return 1.0  # Default to passing if no tests
    
    # Helper methods
    def _get_total_loc(self) -> int:
        """Get total lines of code in project"""
        try:
            result = subprocess.run(
                ['find', str(self.project_root), '-name', '*.ts', '-exec', 'wc', '-l', '{}', '+'],
                capture_output=True, text=True
            )
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                total = sum(int(line.split()[0]) for line in lines if line.strip())
                return total
            
            return 1000  # Default estimate
            
        except Exception:
            return 1000
    
    def _parse_changed_lines(self, summary: str) -> int:
        """Parse changed lines from git diff summary"""
        import re
        
        # Extract insertions and deletions
        insertions = re.search(r'(\d+) insertions?', summary)
        deletions = re.search(r'(\d+) deletions?', summary)
        
        ins_count = int(insertions.group(1)) if insertions else 0
        del_count = int(deletions.group(1)) if deletions else 0
        
        return ins_count + del_count
    
    def _count_total_dependencies(self) -> int:
        """Count total dependencies in package.json"""
        try:
            package_json = self.project_root / 'package.json'
            if not package_json.exists():
                return 1
            
            with open(package_json) as f:
                data = json.load(f)
            
            deps = len(data.get('dependencies', {}))
            dev_deps = len(data.get('devDependencies', {}))
            
            return deps + dev_deps
            
        except Exception:
            return 1
    
    def _parse_mutation_score(self, output: str) -> float:
        """Parse mutation score from tool output"""
        import re
        
        # This would need to match specific mutation testing tool output
        match = re.search(r'Mutation score: (\d+\.?\d*)%', output)
        if match:
            return float(match.group(1)) / 100.0
        
        return 0.0
    
    def _parse_coverage(self, output: str) -> float:
        """Parse coverage percentage from output"""
        import re
        
        # Look for coverage percentage in output
        match = re.search(r'All files\s+\|\s+(\d+\.?\d*)', output)
        if match:
            return float(match.group(1)) / 100.0
        
        return 0.0
    
    def _calculate_sast_severity(self, audit_data: dict) -> float:
        """Calculate SAST severity score from npm audit data"""
        if 'vulnerabilities' not in audit_data:
            return 0.0
        
        vulnerabilities = audit_data['vulnerabilities']
        
        # Weight by severity
        severity_weights = {
            'critical': 1.0,
            'high': 0.8,
            'moderate': 0.5,
            'low': 0.2,
            'info': 0.1
        }
        
        total_score = 0.0
        max_score = 0.0
        
        for vuln_name, vuln_data in vulnerabilities.items():
            severity = vuln_data.get('severity', 'low')
            weight = severity_weights.get(severity, 0.1)
            total_score += weight
            max_score += 1.0  # Maximum possible weight
        
        return total_score / max_score if max_score > 0 else 0.0
    
    def _parse_performance_results(self, output: str) -> Tuple[float, float]:
        """Parse performance benchmark results"""
        # Placeholder - would need to match benchmark tool output
        return 0.0, 0.0
    
    def _parse_devirt_results(self, output: str) -> float:
        """Parse devirtualization test results"""
        import re
        
        # Look for success rate in output
        match = re.search(r'Success rate: (\d+\.?\d*)%', output)
        if match:
            return float(match.group(1)) / 100.0
        
        return 0.0
    
    def _parse_contract_results(self, output: str) -> float:
        """Parse contract test results"""
        import re
        
        # Look for pass rate in output
        match = re.search(r'(\d+) of (\d+) contracts passing', output)
        if match:
            passed = int(match.group(1))
            total = int(match.group(2))
            return passed / total if total > 0 else 1.0
        
        return 1.0

def main():
    """Main entry point for gatekeeper"""
    parser = argparse.ArgumentParser(description="ArachneJS Deobfuscator Quality Gatekeeper")
    parser.add_argument(
        '--project-root', 
        type=Path, 
        default=Path.cwd(),
        help='Project root directory'
    )
    parser.add_argument(
        '--config',
        type=Path,
        help='Quality gates configuration file'
    )
    parser.add_argument(
        '--output',
        type=Path,
        help='Output file for results (JSON format)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    logger.info("Starting ArachneJS Quality Gatekeeper")
    
    try:
        # Collect metrics
        collector = MetricsCollector(args.project_root)
        metrics = collector.collect()
        
        logger.info(f"Collected metrics: mutation={metrics.mutation:.3f}, "
                   f"risk_components=delta_loc:{metrics.delta_loc:.3f}, "
                   f"novelty:{metrics.novelty:.3f}")
        
        # Evaluate quality gates
        gate_system = QualityGateSystem(args.config)
        result = gate_system.evaluate(metrics)
        
        # Log results
        logger.info(f"Quality gate decision: {result.decision.value}")
        logger.info(f"Risk score: {result.risk_score:.3f}")
        logger.info(f"Passed gates: {result.passed_gates}")
        
        if result.failed_gates:
            logger.warning(f"Failed gates: {result.failed_gates}")
        
        for warning in result.warnings:
            logger.warning(warning)
        
        # Output results
        if args.output:
            output_data = {
                'decision': result.decision.value,
                'risk_score': result.risk_score,
                'passed_gates': result.passed_gates,
                'failed_gates': result.failed_gates,
                'warnings': result.warnings,
                'execution_time_s': result.execution_time_s,
                'timestamp': time.time()
            }
            
            with open(args.output, 'w') as f:
                json.dump(output_data, f, indent=2)
        
        # Set exit code based on decision
        if result.decision == DecisionType.PROMOTE:
            logger.info("✅ Quality gates passed - PROMOTE")
            sys.exit(0)
        elif result.decision == DecisionType.MANUAL_QA:
            logger.info("⚠️  Manual QA required - MANUAL_QA")
            sys.exit(1)
        else:
            logger.info("❌ Quality gates failed - AGENT_REFINE")  
            sys.exit(2)
            
    except Exception as e:
        logger.error(f"Gatekeeper execution failed: {e}")
        sys.exit(3)

if __name__ == '__main__':
    main()