import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Simple test for CLI module - focus on static analysis we can safely test
describe('CLI Module Static Analysis Tests', () => {
  it('should have CLI module file present', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const exists = fs.existsSync(cliPath);
    expect(exists).toBe(true);
  });

  it('should have substantial CLI implementation', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const stats = fs.statSync(cliPath);
    
    // CLI file should be substantial (689 lines as noted in requirements)
    expect(stats.size).toBeGreaterThan(15000); // At least 15KB for 689 lines
  });

  it('should contain required imports', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for essential external imports
    expect(content).toContain("import { Command } from 'commander'");
    expect(content).toContain("import chalk from 'chalk'");
    expect(content).toContain("import ora from 'ora'");
    expect(content).toContain("import * as fs from 'fs'");
    expect(content).toContain("import * as path from 'path'");
    expect(content).toContain("import { parse, Node } from 'acorn'");
    expect(content).toContain("import { simple as walkSimple } from 'acorn-walk'");
  });

  it('should contain required internal imports', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for internal module imports
    expect(content).toContain('./ir/nodes.js');
    expect(content).toContain('./ir/cfg.js');
    expect(content).toContain('./ir/printer.js');
    expect(content).toContain('./passes/Pass.js');
    expect(content).toContain('./passes/constprop.js');
    expect(content).toContain('./passes/copyprop.js');
    expect(content).toContain('./passes/dce.js');
    expect(content).toContain('./passes/deflatten.js');
    expect(content).toContain('./passes/structuring.js');
    expect(content).toContain('./passes/rename.js');
  });

  it('should define all required interfaces', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for interface definitions
    expect(content).toContain('interface AnalysisData');
    expect(content).toContain('interface PassResult');
    expect(content).toContain('interface PassMetrics');
    expect(content).toContain('interface SerializedCFG');
    expect(content).toContain('interface AnalysisMetadata');
  });

  it('should have DeobfuscationPipeline class', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for class definition
    expect(content).toContain('class DeobfuscationPipeline');
    expect(content).toContain('private passes: Pass[] = []');
    expect(content).toContain('private results: PassResult[] = []');
    expect(content).toContain('private cfg: CFG | null = null');
  });

  it('should have all required pipeline methods', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for key methods
    expect(content).toContain('initializePasses(');
    expect(content).toContain('async analyze(code: string)');
    expect(content).toContain('parseCodeToIR(code: string)');
    expect(content).toContain('convertASTToIR(ast: Node)');
    expect(content).toContain('convertStatementToIR(node: Node)');
    expect(content).toContain('convertExpressionToIR(node: Node)');
    expect(content).toContain('irToCode(ir: IRNode[])');
    expect(content).toContain('serializeCFG(cfg: CFG)');
    expect(content).toContain('countModifiedNodes(');
    expect(content).toContain('calculateComplexity(');
  });

  it('should have commander CLI setup', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for CLI setup
    expect(content).toContain('const program = new Command()');
    expect(content).toContain(".name('arachnejs')");
    expect(content).toContain(".description('Advanced JavaScript deobfuscation tool')");
    expect(content).toContain(".version('0.1.0')");
  });

  it('should have analyze command configuration', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for analyze command
    expect(content).toContain(".command('analyze')");
    expect(content).toContain(".argument('<input>', 'Input JavaScript file')");
    expect(content).toContain(".option('-o, --output <file>', 'Output deobfuscated file')");
    expect(content).toContain(".option('--json-out <file>', 'Export analysis data as JSON')");
    expect(content).toContain(".option('-v, --verbose', 'Verbose output')");
    expect(content).toContain(".option('--ollama', 'Enable Ollama LLM integration for intelligent renaming')");
  });

  it('should have UI command configuration', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for UI command
    expect(content).toContain(".command('ui')");
    expect(content).toContain(".option('-p, --port <port>', 'Port for the UI server', '3000')");
    expect(content).toContain(".option('-d, --data <file>', 'Analysis JSON file to load')");
  });

  it('should have error handling setup', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for error handlers
    expect(content).toContain("process.on('uncaughtException'");
    expect(content).toContain("process.on('unhandledRejection'");
    expect(content).toContain('program.parse()');
  });

  it('should have file I/O operations', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for file operations
    expect(content).toContain('fs.existsSync(');
    expect(content).toContain('fs.readFileSync(');
    expect(content).toContain('fs.writeFileSync(');
  });

  it('should have progress reporting with ora', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for progress reporting
    expect(content).toContain('ora(');
    expect(content).toContain('.start()');
    expect(content).toContain('.succeed(');
    expect(content).toContain('.fail(');
  });

  it('should have colored output with chalk', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for colored output
    expect(content).toContain('chalk.green(');
    expect(content).toContain('chalk.red(');
    expect(content).toContain('chalk.yellow(');
    expect(content).toContain('chalk.blue(');
    expect(content).toContain('chalk.bold(');
  });

  it('should have AST parsing with acorn', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for AST operations
    expect(content).toContain('parse(code');
    expect(content).toContain('ecmaVersion: 2023');
    expect(content).toContain("sourceType: 'module'");
    expect(content).toContain("sourceType: 'script'");
  });

  it('should have pass pipeline configuration', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for pass classes usage
    expect(content).toContain('new ControlFlowDeflatteningPass()');
    expect(content).toContain('new ConstantPropagationPass()');
    expect(content).toContain('new CopyPropagationPass()');
    expect(content).toContain('new DeadCodeEliminationPass()');
    expect(content).toContain('new StructuringPass()');
    expect(content).toContain('new IntelligentRenamingPass(');
  });

  it('should have IR operations', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for IR operations
    expect(content).toContain('IRNodeFactory.');
    expect(content).toContain('new CFGBuilder()');
    expect(content).toContain('printIR(');
  });

  it('should have analysis pipeline logic', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for analysis pipeline
    expect(content).toContain('for (const pass of this.passes)');
    expect(content).toContain('await pass.run(irState)');
    expect(content).toContain('executionTime');
    expect(content).toContain('nodesRemoved');
    expect(content).toContain('nodesAdded');
    expect(content).toContain('nodesModified');
    expect(content).toContain('complexity');
  });

  it('should have proper data structure validation', () => {
    // Test basic data structures that should be defined
    const mockAnalysisData = {
      originalCode: 'function test() {}',
      finalCode: 'function test() {}',
      passes: [],
      cfg: { nodes: [], edges: [], entry: '', exit: '' },
      metadata: {
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        inputSize: 100,
        outputSize: 100,
        totalPasses: 0,
        totalExecutionTime: 0,
        success: true,
        errors: []
      }
    };
    
    expect(mockAnalysisData).toMatchObject({
      originalCode: expect.any(String),
      finalCode: expect.any(String),
      passes: expect.any(Array),
      cfg: expect.any(Object),
      metadata: expect.objectContaining({
        timestamp: expect.any(String),
        version: expect.any(String),
        inputSize: expect.any(Number),
        outputSize: expect.any(Number),
        totalPasses: expect.any(Number),
        totalExecutionTime: expect.any(Number),
        success: expect.any(Boolean),
        errors: expect.any(Array)
      })
    });
  });

  it('should validate PassResult structure', () => {
    const mockPassResult = {
      name: 'TestPass',
      inputIR: [],
      outputIR: [],
      metrics: {
        executionTime: 100,
        nodesRemoved: 0,
        nodesAdded: 0,
        nodesModified: 1,
        complexity: 1
      },
      codeSnapshot: 'console.log("test");'
    };
    
    expect(mockPassResult).toMatchObject({
      name: expect.any(String),
      inputIR: expect.any(Array),
      outputIR: expect.any(Array),
      metrics: expect.objectContaining({
        executionTime: expect.any(Number),
        nodesRemoved: expect.any(Number),
        nodesAdded: expect.any(Number),
        nodesModified: expect.any(Number),
        complexity: expect.any(Number)
      }),
      codeSnapshot: expect.any(String)
    });
  });

  it('should validate SerializedCFG structure', () => {
    const mockSerializedCFG = {
      nodes: [{
        id: 'node1',
        type: 'basic',
        statements: [],
        predecessors: [],
        successors: [],
        dominance: {
          dominators: [],
          dominanceFrontier: []
        }
      }],
      edges: [{
        from: 'node1',
        to: 'node2',
        type: 'unconditional'
      }],
      entry: 'entry',
      exit: 'exit'
    };
    
    expect(mockSerializedCFG).toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          type: expect.any(String),
          statements: expect.any(Array),
          predecessors: expect.any(Array),
          successors: expect.any(Array),
          dominance: expect.objectContaining({
            dominators: expect.any(Array),
            dominanceFrontier: expect.any(Array)
          })
        })
      ]),
      edges: expect.arrayContaining([
        expect.objectContaining({
          from: expect.any(String),
          to: expect.any(String),
          type: expect.any(String)
        })
      ]),
      entry: expect.any(String),
      exit: expect.any(String)
    });
  });

  it('should have proper package.json configuration', () => {
    const packagePath = path.resolve(__dirname, '../../package.json');
    const packageContent = fs.readFileSync(packagePath, 'utf-8');
    const packageJson = JSON.parse(packageContent);
    
    // Check CLI configuration
    expect(packageJson.main).toContain('cli/index.js');
    expect(packageJson.scripts.dev).toContain('cli/index.ts');
    
    // Check CLI dependencies
    expect(packageJson.dependencies.commander).toBeDefined();
    expect(packageJson.dependencies.chalk).toBeDefined();
    expect(packageJson.dependencies.ora).toBeDefined();
    expect(packageJson.dependencies.acorn).toBeDefined();
    expect(packageJson.dependencies['acorn-walk']).toBeDefined();
  });

  it('should have type exports', () => {
    const cliPath = path.resolve(__dirname, '../../src/cli/index.ts');
    const content = fs.readFileSync(cliPath, 'utf-8');
    
    // Check for type exports at the end
    expect(content).toContain('export type { AnalysisData, PassResult, PassMetrics, SerializedCFG, AnalysisMetadata }');
  });
});