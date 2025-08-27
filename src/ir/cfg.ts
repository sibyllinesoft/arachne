/**
 * @fileoverview Control Flow Graph (CFG) construction and dominance analysis
 * 
 * This module implements control flow graph construction from IR nodes,
 * dominance analysis for SSA construction, and post-dominance for structuring.
 */

import type {
  IRNode,
  IRStatement,
  IRExpression,
  IRBlockStatement,
  IRIfStatement,
  IRWhileStatement,
  IRForStatement,
  IRSwitchStatement,
  IRTryStatement,
  NodeId
} from './nodes.js';

/**
 * Types of edges in the control flow graph
 */
export enum CFGEdgeType {
  UNCONDITIONAL = 'unconditional',
  TRUE_BRANCH = 'true_branch',
  FALSE_BRANCH = 'false_branch',
  EXCEPTION = 'exception',
  FALLTHROUGH = 'fallthrough'
}

/**
 * Edge in the control flow graph
 */
export interface CFGEdge {
  readonly type: CFGEdgeType;
  readonly from: CFGNode;
  readonly to: CFGNode;
  readonly condition?: IRExpression;
  readonly label?: string;
}

/**
 * Basic block in the control flow graph
 * @deprecated Use CFGNode instead, but exported as BasicBlock for compatibility
 */
export interface CFGNode {
  readonly id: NodeId;
  readonly label?: string;
  readonly instructions: readonly IRStatement[];
  readonly statements: readonly IRStatement[]; // Alias for compatibility
  readonly predecessors: readonly CFGNode[];
  readonly successors: readonly CFGNode[];
  readonly edges_in: readonly CFGEdge[];
  readonly edges_out: readonly CFGEdge[];
  
  // Dominance information
  readonly dominates: ReadonlySet<CFGNode>;
  readonly dominated_by: ReadonlySet<CFGNode>;
  readonly immediate_dominator?: CFGNode;
  readonly dominance_frontier: ReadonlySet<CFGNode>;
  
  // Post-dominance information  
  readonly post_dominates: ReadonlySet<CFGNode>;
  readonly post_dominated_by: ReadonlySet<CFGNode>;
  readonly immediate_post_dominator?: CFGNode;
  readonly post_dominance_frontier: ReadonlySet<CFGNode>;
  
  // Loop information
  readonly loop_depth: number;
  readonly loop_header?: CFGNode;
  readonly back_edges: readonly CFGEdge[];
}

/**
 * Control Flow Graph representation
 */
export interface CFG {
  readonly entry: CFGNode;
  readonly exit: CFGNode;
  readonly nodes: ReadonlyMap<NodeId, CFGNode>;
  readonly edges: readonly CFGEdge[];
  readonly dominance_tree: ReadonlyMap<CFGNode, readonly CFGNode[]>;
  readonly post_dominance_tree: ReadonlyMap<CFGNode, readonly CFGNode[]>;
  
  // Convenience accessors for compatibility
  readonly blocks: ReadonlyMap<NodeId, CFGNode>;
  
  /**
   * Get successor nodes for a given node
   */
  getSuccessors(nodeId: NodeId): CFGNode[];
  
  /**
   * Check if a node is the entry node
   */
  isEntry(nodeId: NodeId): boolean;
}

/**
 * Builder for constructing CFG nodes
 */
class CFGNodeBuilder {
  private static nextId = 0;

  constructor(
    private readonly instructions: readonly IRStatement[] = [],
    private readonly label?: string
  ) {}

  build(): CFGNode {
    const nodeId = `cfg_${CFGNodeBuilder.nextId++}` as NodeId;
    
    return {
      id: nodeId,
      label: this.label,
      instructions: this.instructions,
      statements: this.instructions, // Alias for compatibility
      predecessors: [],
      successors: [],
      edges_in: [],
      edges_out: [],
      dominates: new Set(),
      dominated_by: new Set(),
      dominance_frontier: new Set(),
      post_dominates: new Set(),
      post_dominated_by: new Set(),
      post_dominance_frontier: new Set(),
      loop_depth: 0,
      back_edges: []
    };
  }

  static create(instructions?: readonly IRStatement[], label?: string): CFGNode {
    return new CFGNodeBuilder(instructions, label).build();
  }
}

/**
 * Control Flow Graph Builder
 */
export class CFGBuilder {
  private readonly nodes = new Map<NodeId, CFGNode>();
  private readonly edges: CFGEdge[] = [];
  private readonly labelMap = new Map<string, CFGNode>();

  /**
   * Build CFG from IR statements
   */
  buildFromStatements(statements: readonly IRStatement[]): CFG {
    if (statements.length === 0) {
      const entry = CFGNodeBuilder.create([], 'entry');
      const exit = CFGNodeBuilder.create([], 'exit');
      this.nodes.set(entry.id, entry);
      this.nodes.set(exit.id, exit);
      this.addEdge(entry, exit, CFGEdgeType.UNCONDITIONAL);
      
      return this.finalizeCFG(entry, exit);
    }

    const entry = CFGNodeBuilder.create([], 'entry');
    this.nodes.set(entry.id, entry);

    const exit = CFGNodeBuilder.create([], 'exit');
    this.nodes.set(exit.id, exit);

    const firstBlock = this.buildStatementSequenceWithExit(statements, exit);
    this.addEdge(entry, firstBlock, CFGEdgeType.UNCONDITIONAL);

    // Connect terminal nodes to exit
    this.connectTerminalNodes(exit);

    return this.finalizeCFG(entry, exit);
  }

  /**
   * Build CFG from a sequence of statements with knowledge of the exit node
   */
  private buildStatementSequenceWithExit(statements: readonly IRStatement[], exit: CFGNode): CFGNode {
    if (statements.length === 0) {
      return CFGNodeBuilder.create([], 'empty');
    }

    // Group sequential non-control-flow statements
    const blocks: IRStatement[][] = [];
    let currentBlock: IRStatement[] = [];

    for (const stmt of statements) {
      if (this.isControlFlowStatement(stmt)) {
        // Finish current block if it has statements
        if (currentBlock.length > 0) {
          blocks.push([...currentBlock]);
          currentBlock = [];
        }
        
        // Control flow statements get their own blocks
        blocks.push([stmt]);
      } else {
        currentBlock.push(stmt);
      }
    }

    // Add remaining statements
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }

    // Build CFG nodes for each block
    const blockNodes = blocks.map((block, index) => {
      const node = CFGNodeBuilder.create(block, `block_${index}`);
      this.nodes.set(node.id, node);
      return node;
    });

    // Connect blocks with control flow edges
    let currentNode = blockNodes[0]!;
    
    for (let i = 0; i < blockNodes.length - 1; i++) {
      const node = blockNodes[i]!;
      const nextNode = blockNodes[i + 1]!;
      
      if (node.instructions.length > 0) {
        const lastStmt = node.instructions[node.instructions.length - 1]!;
        this.addControlFlowEdges(node, nextNode, lastStmt);
      } else {
        this.addEdge(node, nextNode, CFGEdgeType.UNCONDITIONAL);
      }
    }

    // Handle control flow for the last block (if it has control flow statements)
    if (blockNodes.length > 0) {
      const lastBlock = blockNodes[blockNodes.length - 1]!;
      if (lastBlock.instructions.length > 0) {
        const lastStmt = lastBlock.instructions[lastBlock.instructions.length - 1]!;
        if (this.isControlFlowStatement(lastStmt)) {
          // For control flow statements in the last block, use the exit node
          this.addControlFlowEdges(lastBlock, exit, lastStmt);
        }
      }
    }

    return currentNode;
  }

  /**
   * Build CFG from a sequence of statements
   */
  private buildStatementSequence(statements: readonly IRStatement[]): CFGNode {
    if (statements.length === 0) {
      return CFGNodeBuilder.create([], 'empty');
    }

    // Group sequential non-control-flow statements
    const blocks: IRStatement[][] = [];
    let currentBlock: IRStatement[] = [];

    for (const stmt of statements) {
      if (this.isControlFlowStatement(stmt)) {
        // Finish current block if it has statements
        if (currentBlock.length > 0) {
          blocks.push([...currentBlock]);
          currentBlock = [];
        }
        
        // Control flow statements get their own blocks
        blocks.push([stmt]);
      } else {
        currentBlock.push(stmt);
      }
    }

    // Add remaining statements
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }

    // Build CFG nodes for each block
    const blockNodes = blocks.map((block, index) => {
      const node = CFGNodeBuilder.create(block, `block_${index}`);
      this.nodes.set(node.id, node);
      return node;
    });

    // Connect blocks with control flow edges
    let currentNode = blockNodes[0]!;
    
    for (let i = 0; i < blockNodes.length - 1; i++) {
      const node = blockNodes[i]!;
      const nextNode = blockNodes[i + 1]!;
      
      if (node.instructions.length > 0) {
        const lastStmt = node.instructions[node.instructions.length - 1]!;
        this.addControlFlowEdges(node, nextNode, lastStmt);
      } else {
        this.addEdge(node, nextNode, CFGEdgeType.UNCONDITIONAL);
      }
    }


    return currentNode;
  }

  /**
   * Check if a statement affects control flow
   */
  private isControlFlowStatement(stmt: IRStatement): boolean {
    return stmt.type === 'IfStatement' ||
           stmt.type === 'WhileStatement' ||
           stmt.type === 'ForStatement' ||
           stmt.type === 'SwitchStatement' ||
           stmt.type === 'TryStatement' ||
           stmt.type === 'ReturnStatement' ||
           stmt.type === 'BreakStatement' ||
           stmt.type === 'ContinueStatement' ||
           stmt.type === 'ThrowStatement';
  }

  /**
   * Add appropriate edges for control flow statements
   */
  private addControlFlowEdges(
    fromNode: CFGNode, 
    nextNode: CFGNode, 
    stmt: IRStatement
  ): void {
    switch (stmt.type) {
      case 'IfStatement':
        this.handleIfStatement(fromNode, nextNode, stmt);
        break;
      case 'WhileStatement':
        this.handleWhileStatement(fromNode, nextNode, stmt);
        break;
      case 'ForStatement':
        this.handleForStatement(fromNode, nextNode, stmt);
        break;
      case 'SwitchStatement':
        this.handleSwitchStatement(fromNode, nextNode, stmt);
        break;
      case 'TryStatement':
        this.handleTryStatement(fromNode, nextNode, stmt);
        break;
      case 'ReturnStatement':
      case 'ThrowStatement':
        // These don't connect to next node
        break;
      case 'BreakStatement':
      case 'ContinueStatement':
        // Handle with loop context
        this.addEdge(fromNode, nextNode, CFGEdgeType.UNCONDITIONAL);
        break;
      default:
        this.addEdge(fromNode, nextNode, CFGEdgeType.UNCONDITIONAL);
    }
  }

  /**
   * Handle if statement control flow
   */
  private handleIfStatement(
    fromNode: CFGNode, 
    nextNode: CFGNode, 
    ifStmt: IRIfStatement
  ): void {
    const thenBlock = this.buildStatementSequence([ifStmt.consequent]);
    const elseBlock = ifStmt.alternate 
      ? this.buildStatementSequence([ifStmt.alternate])
      : nextNode;

    this.addEdge(fromNode, thenBlock, CFGEdgeType.TRUE_BRANCH, ifStmt.test);
    this.addEdge(fromNode, elseBlock, CFGEdgeType.FALSE_BRANCH, ifStmt.test);
    
    // Connect branches to next node
    this.addEdge(thenBlock, nextNode, CFGEdgeType.UNCONDITIONAL);
    if (elseBlock !== nextNode) {
      this.addEdge(elseBlock, nextNode, CFGEdgeType.UNCONDITIONAL);
    }
  }

  /**
   * Handle while statement control flow
   */
  private handleWhileStatement(
    fromNode: CFGNode, 
    nextNode: CFGNode, 
    whileStmt: IRWhileStatement
  ): void {
    const bodyBlock = this.buildStatementSequence([whileStmt.body]);
    
    // Loop: from -> test -> body -> back to test
    this.addEdge(fromNode, fromNode, CFGEdgeType.TRUE_BRANCH, whileStmt.test);
    this.addEdge(fromNode, bodyBlock, CFGEdgeType.TRUE_BRANCH, whileStmt.test);
    this.addEdge(bodyBlock, fromNode, CFGEdgeType.UNCONDITIONAL); // Back edge
    this.addEdge(fromNode, nextNode, CFGEdgeType.FALSE_BRANCH, whileStmt.test);
  }

  /**
   * Handle for statement control flow
   */
  private handleForStatement(
    fromNode: CFGNode, 
    nextNode: CFGNode, 
    forStmt: IRForStatement
  ): void {
    const bodyBlock = this.buildStatementSequence([forStmt.body]);
    
    if (forStmt.test) {
      this.addEdge(fromNode, bodyBlock, CFGEdgeType.TRUE_BRANCH, forStmt.test);
      this.addEdge(fromNode, nextNode, CFGEdgeType.FALSE_BRANCH, forStmt.test);
    } else {
      this.addEdge(fromNode, bodyBlock, CFGEdgeType.UNCONDITIONAL);
    }
    
    // Back edge from body (with update if present)
    this.addEdge(bodyBlock, fromNode, CFGEdgeType.UNCONDITIONAL);
  }

  /**
   * Handle switch statement control flow
   */
  private handleSwitchStatement(
    fromNode: CFGNode, 
    nextNode: CFGNode, 
    switchStmt: IRSwitchStatement
  ): void {
    // Create nodes for each case
    const caseNodes = switchStmt.cases.map((caseStmt, index) => {
      const caseBlock = this.buildStatementSequence(caseStmt.consequent);
      this.nodes.set(caseBlock.id, caseBlock);
      return caseBlock;
    });

    // Add edges from switch to each case
    for (let i = 0; i < switchStmt.cases.length; i++) {
      const caseStmt = switchStmt.cases[i]!;
      const caseNode = caseNodes[i]!;
      
      if (caseStmt.test) {
        // Regular case
        this.addEdge(fromNode, caseNode, CFGEdgeType.TRUE_BRANCH, caseStmt.test);
      } else {
        // Default case
        this.addEdge(fromNode, caseNode, CFGEdgeType.FALLTHROUGH);
      }
    }

    // Connect cases to next node (accounting for fallthrough)
    for (const caseNode of caseNodes) {
      this.addEdge(caseNode, nextNode, CFGEdgeType.UNCONDITIONAL);
    }
  }

  /**
   * Handle try statement control flow
   */
  private handleTryStatement(
    fromNode: CFGNode, 
    nextNode: CFGNode, 
    tryStmt: IRTryStatement
  ): void {
    const tryBlock = this.buildStatementSequence([tryStmt.block]);
    
    this.addEdge(fromNode, tryBlock, CFGEdgeType.UNCONDITIONAL);
    this.addEdge(tryBlock, nextNode, CFGEdgeType.UNCONDITIONAL);

    if (tryStmt.handler) {
      const catchBlock = this.buildStatementSequence([tryStmt.handler.body]);
      this.addEdge(fromNode, catchBlock, CFGEdgeType.EXCEPTION);
      this.addEdge(catchBlock, nextNode, CFGEdgeType.UNCONDITIONAL);
    }

    if (tryStmt.finalizer) {
      const finallyBlock = this.buildStatementSequence([tryStmt.finalizer]);
      this.addEdge(nextNode, finallyBlock, CFGEdgeType.UNCONDITIONAL);
      // Finally block becomes the new next node
    }
  }

  /**
   * Add edge between two nodes
   */
  private addEdge(
    from: CFGNode,
    to: CFGNode,
    type: CFGEdgeType,
    condition?: IRExpression
  ): void {
    const edge: CFGEdge = { type, from, to, condition };
    this.edges.push(edge);
    
    // Update node connections (mutating for building phase)
    (from.successors as CFGNode[]).push(to);
    (from.edges_out as CFGEdge[]).push(edge);
    (to.predecessors as CFGNode[]).push(from);
    (to.edges_in as CFGEdge[]).push(edge);
  }

  /**
   * Connect nodes with no successors to exit
   */
  private connectTerminalNodes(exit: CFGNode): void {
    for (const node of this.nodes.values()) {
      if (node.successors.length === 0 && node !== exit) {
        this.addEdge(node, exit, CFGEdgeType.UNCONDITIONAL);
      }
    }
  }

  /**
   * Finalize CFG with dominance analysis
   */
  private finalizeCFG(entry: CFGNode, exit: CFGNode): CFG {
    const allNodes = new Map(this.nodes);
    allNodes.set(entry.id, entry);
    allNodes.set(exit.id, exit);

    const dominanceTree = this.computeDominance(entry, allNodes);
    const postDominanceTree = this.computePostDominance(exit, allNodes);

    return {
      entry,
      exit,
      nodes: allNodes,
      edges: [...this.edges],
      dominance_tree: dominanceTree,
      post_dominance_tree: postDominanceTree,
      blocks: allNodes, // Alias for compatibility
      getSuccessors: (nodeId: NodeId): CFGNode[] => {
        const node = allNodes.get(nodeId);
        return node ? [...node.successors] : [];
      },
      isEntry: (nodeId: NodeId): boolean => {
        return nodeId === entry.id;
      }
    };
  }

  /**
   * Compute dominance relationships using iterative algorithm
   */
  private computeDominance(
    entry: CFGNode, 
    nodes: ReadonlyMap<NodeId, CFGNode>
  ): ReadonlyMap<CFGNode, readonly CFGNode[]> {
    const dominators = new Map<CFGNode, Set<CFGNode>>();
    const nodeList = Array.from(nodes.values());

    // Initialize: entry dominates only itself, others dominate all nodes
    dominators.set(entry, new Set([entry]));
    for (const node of nodeList) {
      if (node !== entry) {
        dominators.set(node, new Set(nodeList));
      }
    }

    // Iterate until convergence
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const node of nodeList) {
        if (node === entry) continue;
        
        const oldDominators = dominators.get(node)!;
        const newDominators = new Set([node]);
        
        // Intersection of all predecessors' dominators
        if (node.predecessors.length > 0) {
          const firstPredDoms = dominators.get(node.predecessors[0]!)!;
          for (const dom of firstPredDoms) {
            let inAllPreds = true;
            for (let i = 1; i < node.predecessors.length; i++) {
              const predDoms = dominators.get(node.predecessors[i]!)!;
              if (!predDoms.has(dom)) {
                inAllPreds = false;
                break;
              }
            }
            if (inAllPreds) {
              newDominators.add(dom);
            }
          }
        }
        
        dominators.set(node, newDominators);
        
        if (!this.setsEqual(oldDominators, newDominators)) {
          changed = true;
        }
      }
    }

    // Populate dominance relationships on nodes
    for (const node of nodeList) {
      const nodeDominators = dominators.get(node)!;
      
      // Clear existing dominance relationships
      (node as any).dominates = new Set<CFGNode>();
      (node as any).dominated_by = new Set(nodeDominators);
      
      // For each node that this node dominates
      for (const otherNode of nodeList) {
        const otherDominators = dominators.get(otherNode)!;
        if (otherDominators.has(node)) {
          (node as any).dominates.add(otherNode);
        }
      }
    }

    // Build dominance tree
    return this.buildDominanceTree(dominators);
  }

  /**
   * Compute post-dominance relationships
   */
  private computePostDominance(
    exit: CFGNode, 
    nodes: ReadonlyMap<NodeId, CFGNode>
  ): ReadonlyMap<CFGNode, readonly CFGNode[]> {
    const postDominators = new Map<CFGNode, Set<CFGNode>>();
    const nodeList = Array.from(nodes.values());

    // Initialize: exit post-dominates only itself
    postDominators.set(exit, new Set([exit]));
    for (const node of nodeList) {
      if (node !== exit) {
        postDominators.set(node, new Set(nodeList));
      }
    }

    // Iterate until convergence (reverse direction)
    let changed = true;
    while (changed) {
      changed = false;
      
      for (const node of nodeList) {
        if (node === exit) continue;
        
        const oldPostDoms = postDominators.get(node)!;
        const newPostDoms = new Set([node]);
        
        // Intersection of all successors' post-dominators
        if (node.successors.length > 0) {
          const firstSuccDoms = postDominators.get(node.successors[0]!)!;
          for (const dom of firstSuccDoms) {
            let inAllSuccs = true;
            for (let i = 1; i < node.successors.length; i++) {
              const succDoms = postDominators.get(node.successors[i]!)!;
              if (!succDoms.has(dom)) {
                inAllSuccs = false;
                break;
              }
            }
            if (inAllSuccs) {
              newPostDoms.add(dom);
            }
          }
        }
        
        postDominators.set(node, newPostDoms);
        
        if (!this.setsEqual(oldPostDoms, newPostDoms)) {
          changed = true;
        }
      }
    }

    // Populate post-dominance relationships on nodes
    for (const node of nodeList) {
      const nodePostDominators = postDominators.get(node)!;
      
      // Clear existing post-dominance relationships
      (node as any).post_dominates = new Set<CFGNode>();
      (node as any).post_dominated_by = new Set(nodePostDominators);
      
      // For each node that this node post-dominates
      for (const otherNode of nodeList) {
        const otherPostDominators = postDominators.get(otherNode)!;
        if (otherPostDominators.has(node)) {
          (node as any).post_dominates.add(otherNode);
        }
      }
    }

    return this.buildDominanceTree(postDominators);
  }

  /**
   * Build dominance tree from dominator sets
   */
  private buildDominanceTree(
    dominatorSets: Map<CFGNode, Set<CFGNode>>
  ): ReadonlyMap<CFGNode, readonly CFGNode[]> {
    const tree = new Map<CFGNode, CFGNode[]>();
    
    for (const [node, dominators] of dominatorSets) {
      // Find immediate dominator (closest dominator other than self)
      let immDom: CFGNode | undefined;
      let minDomSize = Infinity;
      
      for (const dom of dominators) {
        if (dom === node) continue;
        const domDominators = dominatorSets.get(dom)!;
        if (domDominators.size < minDomSize) {
          minDomSize = domDominators.size;
          immDom = dom;
        }
      }
      
      if (immDom) {
        const children = tree.get(immDom) || [];
        children.push(node);
        tree.set(immDom, children);
      }
    }
    
    // Convert to readonly
    const readonlyTree = new Map<CFGNode, readonly CFGNode[]>();
    for (const [node, children] of tree) {
      readonlyTree.set(node, [...children]);
    }
    
    return readonlyTree;
  }

  /**
   * Utility: check if two sets are equal
   */
  private setsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }
}

/**
 * CFG Analysis utilities
 */
// Export CFGNode as BasicBlock for compatibility
export type BasicBlock = CFGNode;

export class CFGAnalyzer {
  /**
   * Find dominance frontier for each node
   */
  static computeDominanceFrontiers(cfg: CFG): Map<CFGNode, Set<CFGNode>> {
    const frontiers = new Map<CFGNode, Set<CFGNode>>();
    
    for (const node of cfg.nodes.values()) {
      frontiers.set(node, new Set());
    }
    
    for (const node of cfg.nodes.values()) {
      if (node.predecessors.length >= 2) {
        for (const pred of node.predecessors) {
          let runner: CFGNode | null = pred;
          while (runner && !runner.dominates.has(node)) {
            const frontier = frontiers.get(runner)!;
            frontier.add(node);
            runner = runner.immediate_dominator || null;
          }
        }
      }
    }
    
    return frontiers;
  }

  /**
   * Identify natural loops
   */
  static findNaturalLoops(cfg: CFG): Map<CFGEdge, Set<CFGNode>> {
    const loops = new Map<CFGEdge, Set<CFGNode>>();
    
    for (const edge of cfg.edges) {
      if (this.isBackEdge(edge)) {
        const loopNodes = this.findLoopNodes(edge.to, edge.from);
        loops.set(edge, loopNodes);
      }
    }
    
    return loops;
  }

  /**
   * Check if edge is a back edge (target dominates source)
   */
  private static isBackEdge(edge: CFGEdge): boolean {
    return edge.to.dominates.has(edge.from);
  }

  /**
   * Find all nodes in a natural loop
   */
  private static findLoopNodes(header: CFGNode, tail: CFGNode): Set<CFGNode> {
    const loopNodes = new Set<CFGNode>([header]);
    const stack = [tail];
    
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (!loopNodes.has(node)) {
        loopNodes.add(node);
        for (const pred of node.predecessors) {
          if (!loopNodes.has(pred)) {
            stack.push(pred);
          }
        }
      }
    }
    
    return loopNodes;
  }

  /**
   * Compute reverse post-order traversal
   */
  static reversePostOrder(cfg: CFG): CFGNode[] {
    const visited = new Set<CFGNode>();
    const postOrder: CFGNode[] = [];
    
    const dfs = (node: CFGNode): void => {
      if (visited.has(node)) return;
      visited.add(node);
      
      for (const successor of node.successors) {
        dfs(successor);
      }
      
      postOrder.push(node);
    };
    
    dfs(cfg.entry);
    return postOrder.reverse();
  }
}