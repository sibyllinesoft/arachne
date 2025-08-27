#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse, Node } from 'acorn';
import { simple as walkSimple } from 'acorn-walk';

import { IRNode, IRProgram, IRStatement, NodeId, IRNodeFactory } from '../ir/nodes.js';
import { CFG, CFGBuilder } from '../ir/cfg.js';
import { printIR } from '../ir/printer.js';
import { Pass, IRState } from '../passes/Pass.js';
import { ConstantPropagationPass } from '../passes/constprop.js';
import { CopyPropagationPass } from '../passes/copyprop.js';
import { DeadCodeEliminationPass } from '../passes/dce.js';
import { ControlFlowDeflatteningPass } from '../passes/deflatten.js';
import { StructuringPass } from '../passes/structuring.js';
import { IntelligentRenamingPass } from '../passes/rename.js';

// Minimal imports for demonstration
// Note: Full passes disabled due to compilation issues in dependencies

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analysis data structure for JSON export
 */
interface AnalysisData {
  originalCode: string;
  finalCode: string;
  passes: PassResult[];
  cfg: SerializedCFG;
  metadata: AnalysisMetadata;
}

/**
 * Result of a single deobfuscation pass
 */
interface PassResult {
  name: string;
  inputIR: IRNode[];
  outputIR: IRNode[];
  metrics: PassMetrics;
  codeSnapshot: string;
  cfg?: SerializedCFG;
}

/**
 * Metrics collected during pass execution
 */
interface PassMetrics {
  executionTime: number;
  nodesRemoved: number;
  nodesAdded: number;
  nodesModified: number;
  complexity: number;
}

/**
 * Serialized control flow graph data
 */
interface SerializedCFG {
  nodes: Array<{
    id: string;
    type: string;
    statements: IRStatement[];
    predecessors: string[];
    successors: string[];
    dominance: {
      dominators: string[];
      dominanceFrontier: string[];
    };
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
    condition?: string | undefined;
  }>;
  entry: string;
  exit: string;
}

/**
 * Analysis metadata
 */
interface AnalysisMetadata {
  timestamp: string;
  version: string;
  inputSize: number;
  outputSize: number;
  totalPasses: number;
  totalExecutionTime: number;
  success: boolean;
  errors: string[];
}

/**
 * Main deobfuscation pipeline class
 */
class DeobfuscationPipeline {
  private passes: Pass[] = [];
  private results: PassResult[] = [];
  private cfg: CFG | null = null;

  constructor(options: { useOllama?: boolean; ollamaUrl?: string } = {}) {
    this.initializePasses(options);
  }

  private initializePasses(options: { useOllama?: boolean; ollamaUrl?: string } = {}): void {
    // Enhanced deobfuscation pipeline with semantic-aware passes
    // Order optimized for maximum effectiveness: DCE → Structuring → Renaming → DCE
    this.passes = [
      // Phase 1: Initial cleanup and control flow recovery
      new ControlFlowDeflatteningPass(),
      new ConstantPropagationPass(),
      new CopyPropagationPass(),
      new DeadCodeEliminationPass(), // First DCE to clean up constants
      
      // Phase 2: Code structuring - transform low-level patterns to high-level constructs
      new StructuringPass(),
      
      // Phase 3: Intelligent renaming with optional LLM assistance
      new IntelligentRenamingPass({
        useOllama: options.useOllama,
        ollamaUrl: options.ollamaUrl
      }),
      
      // Phase 4: Final cleanup after renaming
      new DeadCodeEliminationPass() // Final DCE to remove any remaining dead code
    ];
  }

  async analyze(code: string): Promise<AnalysisData> {
    const startTime = Date.now();
    const originalCode = code;
    let currentIR = this.parseCodeToIR(code);
    
    // Build initial CFG
    const irState = this.createIRState(currentIR);
    this.cfg = irState.cfg;
    
    const errors: string[] = [];
    let currentCode = originalCode;

    // Execute all passes
    for (const pass of this.passes) {
      try {
        const passStartTime = Date.now();
        const inputIR = [...currentIR];
        
        // Execute the pass
        const irState = this.createIRState(currentIR);
        const result = await pass.run(irState);
        currentIR = Array.from(result.state.nodes.values());
        currentCode = this.irToCode(currentIR);
        
        // Calculate metrics
        const executionTime = Date.now() - passStartTime;
        const metrics: PassMetrics = {
          executionTime,
          nodesRemoved: inputIR.length - currentIR.length,
          nodesAdded: Math.max(0, currentIR.length - inputIR.length),
          nodesModified: this.countModifiedNodes(inputIR, currentIR),
          complexity: this.calculateComplexity(currentIR),
        };

        // Rebuild CFG after pass
        const passIRState = this.createIRState(currentIR);
        const passCFG = passIRState.cfg;

        // Store pass result
        this.results.push({
          name: pass.name,
          inputIR,
          outputIR: [...currentIR],
          metrics,
          codeSnapshot: currentCode,
          cfg: this.serializeCFG(passCFG),
        });

      } catch (error) {
        errors.push(`Error in pass ${pass.name}: ${(error as Error).message}`);
        console.error(chalk.red(`Pass ${pass.name} failed:`, error));
      }
    }

    const totalExecutionTime = Date.now() - startTime;

    return {
      originalCode,
      finalCode: currentCode,
      passes: this.results,
      cfg: this.cfg ? this.serializeCFG(this.cfg) : this.createEmptyCFG(),
      metadata: {
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        inputSize: originalCode.length,
        outputSize: currentCode.length,
        totalPasses: this.passes.length,
        totalExecutionTime,
        success: errors.length === 0,
        errors,
      },
    };
  }

  private parseCodeToIR(code: string): IRNode[] {
    try {
      // Try parsing as module first, then fall back to script
      let ast;
      try {
        ast = parse(code, {
          ecmaVersion: 2023,
          sourceType: 'module',
          allowReturnOutsideFunction: true,
          allowHashBang: true,
        });
      } catch (moduleError) {
        // Fall back to script parsing
        ast = parse(code, {
          ecmaVersion: 2023,
          sourceType: 'script',
          allowReturnOutsideFunction: true,
          allowHashBang: true,
        });
      }

      // Convert AST to IR
      const irStatements = this.convertASTToIR(ast);
      
      // Create IR Program node
      const program = IRNodeFactory.program(irStatements, 'script');
      
      return [program];
    } catch (error) {
      console.error('Error parsing JavaScript code:', error);
      // Return empty program on parse error, but with proper IR structure
      const emptyProgram = IRNodeFactory.program([], 'script');
      return [emptyProgram];
    }
  }

  private convertASTToIR(ast: Node): IRStatement[] {
    const statements: IRStatement[] = [];
    
    if (ast.type === 'Program') {
      const program = ast as any; // Acorn types may differ from our IR types
      
      for (const statement of program.body) {
        const irStatement = this.convertStatementToIR(statement);
        if (irStatement) {
          statements.push(irStatement);
        }
      }
    }
    
    return statements;
  }

  private convertStatementToIR(node: Node): IRStatement | null {
    try {
      switch (node.type) {
        case 'VariableDeclaration': {
          const varDecl = node as any;
          const declarations = varDecl.declarations.map((decl: any) => {
            const id = this.convertPatternToIR(decl.id);
            const init = decl.init ? this.convertExpressionToIR(decl.init) : null;
            return IRNodeFactory.variableDeclarator(id, init);
          });
          return IRNodeFactory.variableDeclaration(declarations, varDecl.kind || 'var');
        }
        
        case 'ExpressionStatement': {
          const exprStmt = node as any;
          const expression = this.convertExpressionToIR(exprStmt.expression);
          if (expression) {
            return IRNodeFactory.expressionStatement(expression);
          }
          break;
        }
        
        case 'FunctionDeclaration': {
          const funcDecl = node as any;
          const id = funcDecl.id ? IRNodeFactory.identifier(funcDecl.id.name) : null;
          const params = funcDecl.params.map((param: any) => this.convertPatternToIR(param));
          const body = this.convertBlockStatementToIR(funcDecl.body);
          return IRNodeFactory.functionDeclaration(
            id, 
            params, 
            body, 
            funcDecl.generator || false, 
            funcDecl.async || false
          );
        }
        
        case 'ReturnStatement': {
          const returnStmt = node as any;
          const argument = returnStmt.argument ? this.convertExpressionToIR(returnStmt.argument) : null;
          return IRNodeFactory.returnStatement(argument);
        }
        
        case 'IfStatement': {
          const ifStmt = node as any;
          const test = this.convertExpressionToIR(ifStmt.test);
          const consequent = this.convertStatementToIR(ifStmt.consequent);
          const alternate = ifStmt.alternate ? this.convertStatementToIR(ifStmt.alternate) : null;
          
          if (test && consequent) {
            return IRNodeFactory.ifStatement(test, consequent, alternate);
          }
          break;
        }
        
        case 'BlockStatement': {
          return this.convertBlockStatementToIR(node as any);
        }
        
        case 'WhileStatement': {
          const whileStmt = node as any;
          const test = this.convertExpressionToIR(whileStmt.test);
          const body = this.convertStatementToIR(whileStmt.body);
          
          if (test && body) {
            return IRNodeFactory.whileStatement(test, body);
          }
          break;
        }
        
        default:
          console.warn(`Unsupported statement type: ${node.type}`);
          break;
      }
    } catch (error) {
      console.error(`Error converting statement ${node.type}:`, error);
    }
    
    return null;
  }

  private convertBlockStatementToIR(node: any): any {
    const statements = [];
    for (const stmt of node.body) {
      const irStmt = this.convertStatementToIR(stmt);
      if (irStmt) {
        statements.push(irStmt);
      }
    }
    return IRNodeFactory.blockStatement(statements);
  }

  private convertExpressionToIR(node: Node): any {
    try {
      switch (node.type) {
        case 'Identifier': {
          const id = node as any;
          return IRNodeFactory.identifier(id.name);
        }
        
        case 'Literal': {
          const lit = node as any;
          return IRNodeFactory.literal(lit.value, lit.raw);
        }
        
        case 'BinaryExpression': {
          const binExpr = node as any;
          const left = this.convertExpressionToIR(binExpr.left);
          const right = this.convertExpressionToIR(binExpr.right);
          
          if (left && right) {
            return IRNodeFactory.binaryExpression(binExpr.operator, left, right);
          }
          break;
        }
        
        case 'UnaryExpression': {
          const unaryExpr = node as any;
          const argument = this.convertExpressionToIR(unaryExpr.argument);
          
          if (argument) {
            return IRNodeFactory.unaryExpression(
              unaryExpr.operator, 
              argument, 
              unaryExpr.prefix !== false
            );
          }
          break;
        }
        
        case 'AssignmentExpression': {
          const assignExpr = node as any;
          const left = this.convertPatternToIR(assignExpr.left);
          const right = this.convertExpressionToIR(assignExpr.right);
          
          if (left && right) {
            return IRNodeFactory.assignmentExpression(assignExpr.operator, left, right);
          }
          break;
        }
        
        case 'UpdateExpression': {
          const updateExpr = node as any;
          const argument = this.convertExpressionToIR(updateExpr.argument);
          
          if (argument) {
            return IRNodeFactory.updateExpression(
              updateExpr.operator, 
              argument, 
              updateExpr.prefix !== false
            );
          }
          break;
        }
        
        case 'CallExpression': {
          const callExpr = node as any;
          const callee = this.convertExpressionToIR(callExpr.callee);
          const args = callExpr.arguments.map((arg: any) => this.convertExpressionToIR(arg)).filter(Boolean);
          
          if (callee) {
            return IRNodeFactory.callExpression(callee, args);
          }
          break;
        }
        
        case 'ArrayExpression': {
          const arrayExpr = node as any;
          const elements = arrayExpr.elements.map((elem: any) => {
            return elem ? this.convertExpressionToIR(elem) : null;
          });
          return IRNodeFactory.arrayExpression(elements);
        }
        
        default:
          console.warn(`Unsupported expression type: ${node.type}`);
          break;
      }
    } catch (error) {
      console.error(`Error converting expression ${node.type}:`, error);
    }
    
    return null;
  }

  private convertPatternToIR(node: Node): any {
    // For now, only handle Identifier patterns
    // TODO: Handle ArrayPattern, ObjectPattern, etc.
    if (node.type === 'Identifier') {
      const id = node as any;
      return IRNodeFactory.identifier(id.name);
    }
    
    console.warn(`Unsupported pattern type: ${node.type}`);
    return null;
  }

  private irToCode(ir: IRNode[]): string {
    try {
      // Use the existing IR printer to convert IR back to JavaScript
      if (ir.length === 0) {
        return '// Empty program';
      }
      
      const program = ir[0] as IRProgram;
      const result = printIR(program);
      
      return result.code;
    } catch (error) {
      console.error('Error converting IR to code:', error);
      return '/* Error converting IR to code */';
    }
  }

  private createIRState(nodes: IRNode[]): IRState {
    // Filter statements from nodes
    const statements = nodes.filter((node): node is IRStatement => 
      node.type === 'ExpressionStatement' || 
      node.type === 'BlockStatement' ||
      node.type === 'IfStatement' ||
      node.type === 'WhileStatement' ||
      node.type === 'ForStatement' ||
      node.type === 'ReturnStatement' ||
      node.type === 'VariableDeclaration'
    );
    
    // Build CFG from statements
    const cfg = new CFGBuilder().buildFromStatements(statements);
    
    // Convert nodes array to Map
    const nodeMap = new Map<NodeId, IRNode>();
    nodes.forEach((node, index) => {
      nodeMap.set(node.node_id || (`node_${index}` as NodeId), node);
    });
    
    return {
      cfg,
      nodes: nodeMap,
      metadata: new Map<string, unknown>()
    };
  }

  private serializeCFG(cfg: CFG): SerializedCFG {
    // Convert CFG to serializable format
    return {
      nodes: Array.from(cfg.nodes.values()).map(node => ({
        id: node.id,
        type: 'basic' as const, // CFGNode doesn't have type property
        statements: [...node.instructions], // Convert readonly to mutable
        predecessors: node.predecessors.map(p => p.id),
        successors: node.successors.map(s => s.id),
        dominance: {
          dominators: [], // Simplified - would need to compute from dominance_tree
          dominanceFrontier: [], // Simplified - would need to compute
        },
      })),
      edges: cfg.edges.map(edge => ({
        from: edge.from.id,
        to: edge.to.id,
        type: edge.type,
        condition: edge.condition?.toString(),
      })),
      entry: cfg.entry.id,
      exit: cfg.exit.id,
    };
  }

  private createEmptyCFG(): SerializedCFG {
    return {
      nodes: [],
      edges: [],
      entry: '',
      exit: '',
    };
  }

  private countModifiedNodes(before: IRNode[], after: IRNode[]): number {
    // Simplified implementation - count differences
    let modified = 0;
    const minLength = Math.min(before.length, after.length);
    
    for (let i = 0; i < minLength; i++) {
      if (JSON.stringify(before[i]) !== JSON.stringify(after[i])) {
        modified++;
      }
    }
    
    return modified;
  }

  private calculateComplexity(ir: IRNode[]): number {
    // Simplified cyclomatic complexity calculation
    let complexity = 1; // Base complexity
    
    for (const node of ir) {
      // Count decision points
      if (node.type === 'IfStatement' || 
          node.type === 'SwitchStatement' || 
          node.type === 'WhileStatement' || 
          node.type === 'ForStatement') {
        complexity++;
      }
    }
    
    return complexity;
  }
}

/**
 * CLI Commands
 */
const program = new Command();

program
  .name('arachnejs')
  .description('Advanced JavaScript deobfuscation tool')
  .version('0.1.0');

program
  .command('analyze')
  .description('Analyze and deobfuscate JavaScript code')
  .argument('<input>', 'Input JavaScript file')
  .option('-o, --output <file>', 'Output deobfuscated file')
  .option('--json-out <file>', 'Export analysis data as JSON')
  .option('-v, --verbose', 'Verbose output')
  .option('--passes <passes>', 'Comma-separated list of passes to run')
  .option('--ollama', 'Enable Ollama LLM integration for intelligent renaming')
  .option('--ollama-url <url>', 'Ollama server URL', 'http://localhost:11434')
  .action(async (input: string, options: any) => {
    const spinner = ora('Analyzing JavaScript file...').start();
    
    try {
      // Read input file
      if (!fs.existsSync(input)) {
        throw new Error(`Input file not found: ${input}`);
      }
      
      const code = fs.readFileSync(input, 'utf-8');
      spinner.text = 'Running deobfuscation pipeline...';
      
      // Create and run pipeline with options
      const pipeline = new DeobfuscationPipeline({
        useOllama: options.ollama,
        ollamaUrl: options.ollamaUrl
      });
      const analysisData = await pipeline.analyze(code);
      
      spinner.succeed('Analysis complete!');
      
      // Save deobfuscated output
      if (options.output) {
        fs.writeFileSync(options.output, analysisData.finalCode, 'utf-8');
        console.log(chalk.green(`✓ Deobfuscated code saved to: ${options.output}`));
      }
      
      // Save JSON analysis data
      if (options.jsonOut) {
        fs.writeFileSync(options.jsonOut, JSON.stringify(analysisData, null, 2), 'utf-8');
        console.log(chalk.green(`✓ Analysis data exported to: ${options.jsonOut}`));
      }
      
      // Display summary
      console.log('\n' + chalk.bold('Analysis Summary:'));
      console.log(`  Original size: ${analysisData.metadata.inputSize} bytes`);
      console.log(`  Final size: ${analysisData.metadata.outputSize} bytes`);
      console.log(`  Passes executed: ${analysisData.metadata.totalPasses}`);
      console.log(`  Total time: ${analysisData.metadata.totalExecutionTime}ms`);
      console.log(`  Success: ${analysisData.metadata.success ? '✓' : '✗'}`);
      
      if (analysisData.metadata.errors.length > 0) {
        console.log('\n' + chalk.yellow('Warnings/Errors:'));
        analysisData.metadata.errors.forEach(error => {
          console.log(`  ${chalk.red('•')} ${error}`);
        });
      }
      
      if (options.verbose) {
        console.log('\n' + chalk.bold('Pass Details:'));
        analysisData.passes.forEach((pass, index) => {
          console.log(`  ${index + 1}. ${pass.name}`);
          console.log(`     Time: ${pass.metrics.executionTime}ms`);
          console.log(`     Nodes: ${pass.metrics.nodesRemoved} removed, ${pass.metrics.nodesAdded} added`);
          console.log(`     Complexity: ${pass.metrics.complexity}`);
        });
      }
      
    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red('Error:', (error as Error).message));
      process.exit(1);
    }
  });

program
  .command('ui')
  .description('Launch the interactive analysis UI')
  .option('-p, --port <port>', 'Port for the UI server', '3000')
  .option('-d, --data <file>', 'Analysis JSON file to load')
  .action(async (options: any) => {
    console.log(chalk.blue('🚀 Starting ArachneJS Interactive UI...'));
    console.log(chalk.gray(`   UI will be available at: http://localhost:${options.port}`));
    console.log(chalk.gray(`   To analyze code: arachnejs analyze <file> --json-out analysis.json`));
    
    if (options.data && fs.existsSync(options.data)) {
      console.log(chalk.green(`   Loading analysis data: ${options.data}`));
    }
    
    // This would launch the UI server - implementation in next phase
    console.log(chalk.yellow('   UI server implementation coming soon...'));
  });

// Error handling
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:', error.message));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:', promise, 'reason:', reason));
  process.exit(1);
});

// Parse CLI arguments
program.parse();

export type { AnalysisData, PassResult, PassMetrics, SerializedCFG, AnalysisMetadata };