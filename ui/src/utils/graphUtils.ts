import * as d3 from 'd3';
import type { SerializedCFG, CFGNodeData, CFGEdgeData } from '@/types/analysis';

/**
 * Node layout data for D3 visualization
 */
export interface LayoutNode extends CFGNodeData {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
}

/**
 * Edge layout data for D3 visualization
 */
export interface LayoutEdge extends CFGEdgeData {
  source: LayoutNode | string | number;
  target: LayoutNode | string | number;
  index?: number;
}

/**
 * Layout configuration options
 */
export interface LayoutOptions {
  width: number;
  height: number;
  nodeRadius: number;
  linkDistance: number;
  linkStrength: number;
  chargeStrength: number;
  centerForce: number;
}

/**
 * Graph layout utilities for CFG visualization
 */
export class GraphLayoutEngine {
  private nodes: LayoutNode[] = [];
  private edges: LayoutEdge[] = [];
  private simulation: d3.Simulation<LayoutNode, LayoutEdge> | null = null;

  /**
   * Initialize layout with CFG data
   */
  initialize(cfg: SerializedCFG, options: LayoutOptions): void {
    this.nodes = cfg.nodes.map(node => ({ ...node }));
    this.edges = cfg.edges.map(edge => ({ ...edge }));

    // Create force simulation
    this.simulation = d3.forceSimulation<LayoutNode>(this.nodes)
      .force('link', d3.forceLink<LayoutNode, LayoutEdge>(this.edges)
        .id((d: LayoutNode) => d.id)
        .distance(options.linkDistance)
        .strength(options.linkStrength))
      .force('charge', d3.forceManyBody()
        .strength(options.chargeStrength))
      .force('center', d3.forceCenter(options.width / 2, options.height / 2)
        .strength(options.centerForce))
      .force('collision', d3.forceCollide(options.nodeRadius + 5));
  }

  /**
   * Get hierarchical layout positions
   */
  getHierarchicalLayout(cfg: SerializedCFG, options: LayoutOptions): {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
  } {
    const nodes: LayoutNode[] = cfg.nodes.map(node => ({ ...node }));
    const edges: LayoutEdge[] = cfg.edges.map(edge => ({ ...edge }));

    // Build adjacency information
    const nodeMap = new Map<string, LayoutNode>();
    nodes.forEach(node => nodeMap.set(node.id, node));

    // Calculate levels using BFS from entry node
    const levels = this.calculateLevels(cfg);
    const levelGroups = this.groupByLevel(nodes, levels);

    // Position nodes in levels
    levelGroups.forEach((levelNodes, level) => {
      const y = (level + 1) * (options.height / (levelGroups.size + 1));
      const xSpacing = options.width / (levelNodes.length + 1);

      levelNodes.forEach((node, index) => {
        node.x = (index + 1) * xSpacing;
        node.y = y;
        node.fx = node.x; // Fix positions
        node.fy = node.y;
      });
    });

    return { nodes, edges };
  }

  /**
   * Get force-directed layout simulation
   */
  getForceLayout(cfg: SerializedCFG, options: LayoutOptions): {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
    simulation: d3.Simulation<LayoutNode, LayoutEdge>;
  } {
    this.initialize(cfg, options);
    
    if (!this.simulation) {
      throw new Error('Simulation not initialized');
    }

    return {
      nodes: this.nodes,
      edges: this.edges,
      simulation: this.simulation
    };
  }

  /**
   * Get circular layout positions
   */
  getCircularLayout(cfg: SerializedCFG, options: LayoutOptions): {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
  } {
    const nodes: LayoutNode[] = cfg.nodes.map(node => ({ ...node }));
    const edges: LayoutEdge[] = cfg.edges.map(edge => ({ ...edge }));

    const centerX = options.width / 2;
    const centerY = options.height / 2;
    const radius = Math.min(options.width, options.height) / 3;

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      node.x = centerX + radius * Math.cos(angle);
      node.y = centerY + radius * Math.sin(angle);
      node.fx = node.x;
      node.fy = node.y;
    });

    return { nodes, edges };
  }

  /**
   * Calculate node levels for hierarchical layout
   */
  private calculateLevels(cfg: SerializedCFG): Map<string, number> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; level: number }> = [];

    // Start from entry node
    if (cfg.entry) {
      queue.push({ nodeId: cfg.entry, level: 0 });
      levels.set(cfg.entry, 0);
    }

    // BFS to assign levels
    while (queue.length > 0) {
      const { nodeId, level } = queue.shift()!;
      
      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);

      // Find successors
      const successors = cfg.edges
        .filter(edge => edge.from === nodeId)
        .map(edge => edge.to);

      for (const successor of successors) {
        if (!levels.has(successor) || levels.get(successor)! < level + 1) {
          levels.set(successor, level + 1);
          queue.push({ nodeId: successor, level: level + 1 });
        }
      }
    }

    return levels;
  }

  /**
   * Group nodes by level
   */
  private groupByLevel(
    nodes: LayoutNode[],
    levels: Map<string, number>
  ): Map<number, LayoutNode[]> {
    const groups = new Map<number, LayoutNode[]>();

    for (const node of nodes) {
      const level = levels.get(node.id) ?? 0;
      if (!groups.has(level)) {
        groups.set(level, []);
      }
      groups.get(level)!.push(node);
    }

    return groups;
  }

  /**
   * Calculate graph metrics
   */
  static getGraphMetrics(cfg: SerializedCFG): {
    nodeCount: number;
    edgeCount: number;
    density: number;
    avgDegree: number;
    maxDepth: number;
  } {
    const nodeCount = cfg.nodes.length;
    const edgeCount = cfg.edges.length;
    
    // Calculate density
    const maxEdges = nodeCount * (nodeCount - 1);
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;

    // Calculate average degree
    const degrees = cfg.nodes.map(node => 
      node.predecessors.length + node.successors.length
    );
    const avgDegree = degrees.length > 0 
      ? degrees.reduce((sum, degree) => sum + degree, 0) / degrees.length 
      : 0;

    // Calculate max depth (longest path from entry)
    const maxDepth = this.calculateMaxDepth(cfg);

    return {
      nodeCount,
      edgeCount,
      density,
      avgDegree,
      maxDepth
    };
  }

  /**
   * Calculate maximum depth from entry node
   */
  private static calculateMaxDepth(cfg: SerializedCFG): number {
    if (!cfg.entry || cfg.nodes.length === 0) {
      return 0;
    }

    const visited = new Set<string>();
    const depths = new Map<string, number>();
    
    const dfs = (nodeId: string, depth: number): number => {
      if (visited.has(nodeId)) {
        return depths.get(nodeId) ?? depth;
      }
      
      visited.add(nodeId);
      depths.set(nodeId, depth);
      
      const successors = cfg.edges
        .filter(edge => edge.from === nodeId)
        .map(edge => edge.to);
      
      let maxChildDepth = depth;
      for (const successor of successors) {
        const childDepth = dfs(successor, depth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
      
      return maxChildDepth;
    };

    return dfs(cfg.entry, 0);
  }

  /**
   * Find shortest path between two nodes
   */
  static findShortestPath(
    cfg: SerializedCFG,
    from: string,
    to: string
  ): string[] | null {
    if (from === to) {
      return [from];
    }

    const queue: Array<{ node: string; path: string[] }> = [
      { node: from, path: [from] }
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      
      if (visited.has(node)) {
        continue;
      }
      visited.add(node);

      if (node === to) {
        return path;
      }

      // Add successors to queue
      const successors = cfg.edges
        .filter(edge => edge.from === node)
        .map(edge => edge.to);

      for (const successor of successors) {
        if (!visited.has(successor)) {
          queue.push({
            node: successor,
            path: [...path, successor]
          });
        }
      }
    }

    return null; // No path found
  }

  /**
   * Cleanup simulation resources
   */
  cleanup(): void {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    this.nodes = [];
    this.edges = [];
  }
}

/**
 * Utility functions for graph operations
 */
export const GraphUtils = {
  /**
   * Check if a node is a branch point (has multiple successors)
   */
  isBranchPoint: (node: CFGNodeData): boolean => {
    return node.successors.length > 1;
  },

  /**
   * Check if a node is a merge point (has multiple predecessors)
   */
  isMergePoint: (node: CFGNodeData): boolean => {
    return node.predecessors.length > 1;
  },

  /**
   * Get node color based on type and properties
   */
  getNodeColor: (node: CFGNodeData): string => {
    if (node.type === 'entry') return '#4ade80'; // Green
    if (node.type === 'exit') return '#f87171'; // Red
    if (GraphUtils.isBranchPoint(node)) return '#fbbf24'; // Yellow
    if (GraphUtils.isMergePoint(node)) return '#a78bfa'; // Purple
    return '#60a5fa'; // Blue (default)
  },

  /**
   * Get edge color based on type
   */
  getEdgeColor: (edge: CFGEdgeData): string => {
    switch (edge.type) {
      case 'true': return '#4ade80';
      case 'false': return '#f87171';
      case 'exception': return '#f97316';
      default: return '#6b7280';
    }
  },

  /**
   * Format node label for display
   */
  formatNodeLabel: (node: CFGNodeData): string => {
    if (node.type === 'entry') return 'Entry';
    if (node.type === 'exit') return 'Exit';
    
    const stmtCount = node.statements.length;
    if (stmtCount === 0) return `Block ${node.id}`;
    if (stmtCount === 1) return `${node.statements[0]?.type || 'Statement'}`;
    return `Block (${stmtCount} stmts)`;
  }
};