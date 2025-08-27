# Secure Sandbox System

A production-grade secure sandbox system for safely executing potentially malicious obfuscated JavaScript code. This system provides complete isolation, comprehensive resource monitoring, and detailed execution tracing for dynamic analysis.

## Architecture Overview

The sandbox system consists of several integrated components:

- **QuickJS Engine**: Isolated JavaScript execution environment
- **Resource Manager**: Memory, CPU, and execution time limits
- **Execution Tracer**: Comprehensive execution monitoring and IR correlation
- **API Stubs**: Safe replacements for dangerous browser/Node.js APIs
- **Dynamic Code Interceptor**: Monitoring of eval(), Function constructor, etc.
- **Security Policy Engine**: Configurable security rules and violation detection

## Security Features

### Complete Isolation
- No network access (XMLHttpRequest, fetch, WebSocket blocked)
- No file system access (require, import, fs blocked)
- No process spawning or system calls
- Isolated from host environment variables and global objects

### Resource Protection
- Configurable memory limits (default: 128MB)
- Execution timeout enforcement (default: 5 seconds)
- Call stack depth limits to prevent stack overflow
- Loop iteration limits to prevent infinite loops
- Garbage collection triggers to prevent memory leaks

### Attack Prevention
- Prototype pollution protection
- Constructor manipulation detection and blocking
- Escape attempt monitoring (closure, context, prototype chains)
- ReDoS (Regular Expression DoS) protection
- Memory exhaustion attack prevention

## Quick Start

```typescript
import { createProductionSandbox } from './sandbox/index.js';

// Create a maximum security sandbox
const sandbox = createProductionSandbox();
await sandbox.initialize();

// Execute potentially malicious code safely
const result = await sandbox.execute(`
  const obfuscated = [72, 101, 108, 108, 111];
  const decoded = obfuscated.map(x => String.fromCharCode(x)).join('');
  return decoded;
`);

console.log('Result:', result.value); // "Hello"
console.log('Security violations:', result.securityViolations.length);
console.log('Decoded strings:', result.trace.decodedStrings);

// Clean up resources
await sandbox.cleanup();
```

## Sandbox Modes

### Production Mode (Maximum Security)
```typescript
const sandbox = createProductionSandbox({
  maxMemoryMB: 64,
  maxExecutionTimeMS: 2000,
  allowedAPIs: [], // No APIs allowed
  enableTracing: true,
});
```

### Research Mode (Balanced Security)
```typescript
const sandbox = createResearchSandbox({
  maxMemoryMB: 128,
  maxExecutionTimeMS: 5000,
  allowedAPIs: ['console.log', 'JSON.stringify'],
  enableTracing: true,
});
```

### Development Mode (Relaxed Security)
```typescript
const sandbox = createDevelopmentSandbox({
  maxMemoryMB: 256,
  maxExecutionTimeMS: 10000,
  allowedAPIs: ['console.*', 'JSON.*', 'Math.*'],
  enableTracing: true,
});
```

## Execution Results

The sandbox returns comprehensive execution results:

```typescript
interface SandboxResult {
  success: boolean;              // Execution completed successfully
  value?: any;                   // Return value from code
  error?: string;                // Error message if failed
  executionTimeMs: number;       // Total execution time
  memoryStats: MemoryStats;      // Memory usage information
  trace: ExecutionTrace;         // Detailed execution trace
  securityViolations: SecurityViolation[]; // Security issues detected
  sideEffects: SideEffect[];     // API calls and side effects
}
```

## Security Analysis

Analyze execution results for obfuscation patterns and security issues:

```typescript
import { analyzeSandboxResult } from './sandbox/index.js';

const analysis = analyzeSandboxResult(result);
console.log('Security score:', analysis.securityScore); // 0-100
console.log('Obfuscation level:', analysis.obfuscationLevel); // 0-100
console.log('Deobfuscation opportunities:', analysis.deobfuscationOpportunities);
console.log('Security recommendations:', analysis.securityRecommendations);
```

## Integration with IR System

The sandbox integrates with the ArachneJS IR system for correlation:

```typescript
const result = await sandbox.execute(code, sourceMap, {
  nodeId: 'node_123',
  scopeId: 456,
  shapeId: 789,
});

// Trace entries include IR correlation
result.trace.entries.forEach(entry => {
  if (entry.data.irCorrelation) {
    console.log('Traced execution for IR node:', entry.data.irCorrelation.nodeId);
  }
});
```

## Health Monitoring

Monitor sandbox health and performance:

```typescript
import { SandboxHealthMonitor } from './sandbox/index.js';

const monitor = new SandboxHealthMonitor();

// Record health after each execution
const health = monitor.recordHealth(sandbox);
console.log('Healthy:', health.healthy);
console.log('Memory usage:', health.resourceUsage.memoryUsage.heapUsageMB);

// Get health trends
const trends = monitor.getHealthTrends();
console.log('Performance improving:', trends.improving);
```

## Advanced Configuration

### Custom Security Rules
```typescript
const customPolicy: SandboxPolicy = {
  maxMemoryMB: 128,
  maxExecutionTimeMS: 5000,
  maxCallDepth: 100,
  allowedAPIs: ['console.log'],
  blockedPatterns: [/eval/, /Function/],
  enableTracing: true,
  customSecurityRules: [
    {
      id: 'detect_crypto_mining',
      description: 'Detect cryptocurrency mining patterns',
      pattern: /hashrate|mining|crypto/i,
      action: 'block',
      severity: 'high',
    },
  ],
};

const sandbox = new QuickJSSandbox(customPolicy);
```

### Resource Limits
```typescript
const sandbox = createProductionSandbox({
  maxMemoryMB: 64,           // Memory limit
  maxExecutionTimeMS: 2000,  // Execution timeout
  maxCallDepth: 50,          // Stack depth limit
  maxLoopIterations: 10000,  // Loop iteration limit
});
```

## API Reference

### Core Classes

#### QuickJSSandbox
Main sandbox class providing secure JavaScript execution.

**Methods:**
- `initialize(): Promise<void>` - Initialize the sandbox
- `execute(code, sourceMap?, correlation?): Promise<SandboxResult>` - Execute code
- `cleanup(): Promise<void>` - Clean up resources
- `isHealthy(): boolean` - Check sandbox health
- `getResourceUsage()` - Get current resource usage

#### ResourceManager
Manages memory, CPU, and execution time limits.

**Methods:**
- `checkLimits(): boolean` - Verify resource usage is within limits
- `recordMemoryAllocation(bytes)` - Track memory allocation
- `recordCallEnter(function)` - Track function calls
- `getCurrentUsage()` - Get current resource usage

#### ExecutionTracer
Provides detailed execution tracing and behavior analysis.

**Methods:**
- `recordFunctionCall(info)` - Record function execution
- `recordStringOperation(info)` - Track string manipulations
- `getTrace(): ExecutionTrace` - Get complete execution trace
- `analyzeTracePatterns()` - Analyze trace for obfuscation patterns

#### APIStubs
Provides safe replacements for dangerous APIs.

**Methods:**
- `generateStubsCode(): string` - Generate stub injection code
- `getSideEffects(): SideEffect[]` - Get recorded side effects
- `getViolations(): SecurityViolation[]` - Get security violations

### Utility Functions

#### createProductionSandbox(overrides?)
Create a production-ready sandbox with maximum security.

#### createResearchSandbox(overrides?)
Create a research sandbox with balanced security and functionality.

#### createDevelopmentSandbox(overrides?)
Create a development sandbox with relaxed security for testing.

#### analyzeSandboxResult(result)
Analyze execution results for security and obfuscation patterns.

## Security Considerations

### Threat Model
The sandbox is designed to protect against:
- Malicious obfuscated JavaScript code
- Network-based data exfiltration
- File system access attempts
- Memory exhaustion attacks
- Infinite loop and ReDoS attacks
- Prototype pollution
- Constructor chain manipulation
- Context escape attempts

### Limitations
While comprehensive, the sandbox has some limitations:
- QuickJS may have different behavior than V8/browser engines
- Some advanced JavaScript features may not be supported
- Performance overhead from monitoring and tracing
- Resource limits may prevent legitimate complex operations

### Best Practices
1. Always use the most restrictive security mode possible
2. Monitor resource usage and adjust limits as needed
3. Regularly analyze execution results for patterns
4. Keep the sandbox isolated from production systems
5. Update QuickJS regularly for security patches
6. Log and analyze all security violations

## Testing

The sandbox system includes comprehensive tests:

```bash
# Run security tests
npm test tests/sandbox/security.test.ts

# Run integration tests
npm test tests/sandbox/integration.test.ts

# Run all sandbox tests
npm test tests/sandbox/
```

## Performance

Benchmark results on typical hardware:
- Initialization: ~50-100ms
- Simple code execution: ~1-10ms
- Complex obfuscated code: ~10-100ms
- Memory overhead: ~2-5MB per sandbox instance
- Concurrent sandboxes: Limited by system resources

## Contributing

When contributing to the sandbox system:
1. Maintain security-first approach
2. Add comprehensive tests for new features
3. Document security implications
4. Test with real malware samples safely
5. Ensure backward compatibility

## License

MIT License - see LICENSE file for details.
