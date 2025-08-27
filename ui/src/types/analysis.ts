/**
 * Analysis data structure from ArachneJS CLI
 */
export interface AnalysisData {
  originalCode: string;
  finalCode: string;
  passes: PassResult[];
  cfg: SerializedCFG;
  metadata: AnalysisMetadata;
}

/**
 * Result of a single deobfuscation pass
 */
export interface PassResult {
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
export interface PassMetrics {
  executionTime: number;
  nodesRemoved: number;
  nodesAdded: number;
  nodesModified: number;
  complexity: number;
}

/**
 * Serialized control flow graph data
 */
export interface SerializedCFG {
  nodes: CFGNodeData[];
  edges: CFGEdgeData[];
  entry: string;
  exit: string;
}

/**
 * Control flow graph node data
 */
export interface CFGNodeData {
  id: string;
  type: string;
  statements: IRNode[];
  predecessors: string[];
  successors: string[];
  dominance: {
    dominators: string[];
    dominanceFrontier: string[];
  };
}

/**
 * Control flow graph edge data
 */
export interface CFGEdgeData {
  from: string;
  to: string;
  type: string;
  condition?: string;
}

/**
 * Analysis metadata
 */
export interface AnalysisMetadata {
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
 * IR Node structure (simplified for UI)
 */
export interface IRNode {
  type: string;
  id: string;
  body?: IRNode[];
  expression?: IRNode;
  declarations?: IRNode[];
  init?: IRNode;
  test?: IRNode;
  update?: IRNode;
  left?: IRNode;
  right?: IRNode;
  callee?: IRNode;
  arguments?: IRNode[];
  name?: string;
  value?: string | number | boolean | null;
  raw?: string;
  [key: string]: unknown;
}

/**
 * Diff visualization data
 */
export interface CodeDiff {
  added: boolean;
  removed: boolean;
  value: string;
  lineNumber?: number;
}

/**
 * UI state for pass exploration
 */
export interface PassExplorerState {
  selectedPass: number;
  showCFG: boolean;
  showDiff: boolean;
  diffMode: 'side-by-side' | 'unified';
  highlightedNode?: string;
}

/**
 * Visualization settings
 */
export interface VisualizationSettings {
  layout: 'hierarchical' | 'force' | 'circular';
  showDominance: boolean;
  showLabels: boolean;
  nodeSize: number;
  edgeWidth: number;
  animationSpeed: number;
}

/**
 * UI component props types
 */
export interface CFGVisualizationProps {
  cfg: SerializedCFG;
  settings: VisualizationSettings;
  onNodeClick?: (nodeId: string) => void;
  highlightedNode?: string;
}

export interface CodeViewerProps {
  code: string;
  language?: string;
  readOnly?: boolean;
  highlightedLines?: number[];
  onLineClick?: (lineNumber: number) => void;
}

export interface DiffViewerProps {
  originalCode: string;
  modifiedCode: string;
  mode: 'side-by-side' | 'unified';
  language?: string;
}

export interface PassExplorerProps {
  passes: PassResult[];
  selectedPass: number;
  onPassSelect: (passIndex: number) => void;
  onCFGToggle: (show: boolean) => void;
  onDiffToggle: (show: boolean) => void;
}

/**
 * Data loading and parsing utilities
 */
export interface DataLoader {
  loadFromFile: (file: File) => Promise<AnalysisData>;
  loadFromUrl: (url: string) => Promise<AnalysisData>;
  validateData: (data: unknown) => data is AnalysisData;
}

/**
 * Export utilities
 */
export interface ExportOptions {
  format: 'json' | 'html' | 'pdf';
  includeCode: boolean;
  includeCFG: boolean;
  includeMetrics: boolean;
}

export interface ExportResult {
  success: boolean;
  data?: Blob;
  error?: string;
}