/**
 * @fileoverview String/Array Decoder Lifting Pass
 * 
 * This pass detects and lifts common string/array decoder patterns used by
 * JavaScript obfuscators. It identifies encoding schemes like Base64, hex,
 * rot13, and custom alphabets, then correlates with sandbox execution traces
 * to validate decoder function identification.
 */

import type {
  IRNode,
  IRExpression,
  IRStatement,
  IRIdentifier,
  IRLiteral,
  IRCallExpression,
  IRFunctionDeclaration,
  IRArrayExpression,
  IRMemberExpression,
  IRVariableDeclaration,
  IRPattern,
  VariableName,
  NodeId
} from '../ir/nodes.js';
import { IRNodeFactory, isExpression } from '../ir/nodes.js';
import { BasePass, type IRState, type PassResult, PassUtils, type PassOptions } from './Pass.js';
import type { SandboxResult, TraceEntry } from '../sandbox/types.js';

/**
 * Decoder function pattern signature
 */
export interface DecoderPattern {
  /** Unique identifier for the decoder pattern */
  readonly signature: string;
  /** Human-readable name */
  readonly name: string;
  /** Pattern detection function */
  readonly detector: (node: IRNode) => DecoderMatchResult | null;
  /** Function to extract decoder parameters */
  readonly extractor: (node: IRNode) => DecoderFunction | null;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** Known obfuscator signatures */
  readonly obfuscatorHints: readonly string[];
}

/**
 * Result of pattern matching against a decoder
 */
export interface DecoderMatchResult {
  readonly pattern: DecoderPattern;
  readonly functionNode: IRFunctionDeclaration;
  readonly parameters: DecoderParameters;
  readonly confidence: number;
}

/**
 * Extracted decoder function information
 */
export interface DecoderFunction {
  readonly functionId: NodeId;
  readonly name: VariableName;
  readonly encodingType: EncodingType;
  readonly parameters: DecoderParameters;
  readonly arrayReference?: ArrayReference;
}

/**
 * Parameters for decoder function
 */
export interface DecoderParameters {
  /** Index parameter (for array-based decoders) */
  readonly indexParam?: VariableName;
  /** String parameter (for string-based decoders) */
  readonly stringParam?: VariableName;
  /** Custom alphabet (for substitution ciphers) */
  readonly alphabet?: string;
  /** Offset/shift value (for Caesar ciphers) */
  readonly offset?: number;
  /** Additional transformation parameters */
  readonly extraParams?: ReadonlyMap<string, unknown>;
}

/**
 * Reference to encoded array/string storage
 */
export interface ArrayReference {
  readonly nodeId: NodeId;
  readonly variableName: VariableName;
  readonly elements: readonly (string | number)[];
  readonly encoding: EncodingType;
}

/**
 * Supported encoding types
 */
export type EncodingType = 
  | 'base64'
  | 'hex'
  | 'rot13'
  | 'caesar'
  | 'atbash'
  | 'custom-alphabet'
  | 'array-lookup'
  | 'xor'
  | 'unicode-escape'
  | 'charcode-array';

/**
 * Decoded string information with correlation
 */
export interface DecodedString {
  readonly originalCall: IRCallExpression;
  readonly decodedValue: string;
  readonly encodingUsed: EncodingType;
  readonly confidence: number;
  readonly sandboxCorrelation?: {
    readonly traceEntry: TraceEntry;
    readonly executionResult: unknown;
  };
}

/**
 * String/Array Decoder Lifting Pass
 * 
 * Detects common obfuscator patterns:
 * - javascript-obfuscator.io string array pattern
 * - Webpack bundle splitter patterns
 * - Custom Base64/hex encoders
 * - ROT13/Caesar cipher variants
 * - Array-based string storage
 */
export class StringDecoderLiftingPass extends BasePass<IRState> {
  readonly name = 'string-decoder-lifting';
  readonly description = 'Detect and lift string/array decoder functions';

  private decoderPatterns: readonly DecoderPattern[] = [];

  private decodedStrings: Map<NodeId, DecodedString> = new Map();
  private identifiedDecoders: Map<VariableName, DecoderFunction> = new Map();
  private sandboxResults?: SandboxResult;

  constructor(options: { sandboxResults?: SandboxResult } & Partial<PassOptions> = {}) {
    super(options);
    this.initializePatterns();
    this.sandboxResults = options.sandboxResults;
  }

  private initializePatterns(): void {
    this.decoderPatterns = [
      this.createJavaScriptObfuscatorPattern(),
      this.createBase64DecoderPattern(),
      this.createHexDecoderPattern(),
      this.createRot13DecoderPattern(),
      this.createArrayLookupPattern(),
      this.createCharCodeArrayPattern(),
      this.createXorDecoderPattern()
    ];
  }

  protected executePass(state: IRState): { state: IRState; changed: boolean } {
    this.decodedStrings.clear();
    this.identifiedDecoders.clear();

    // Phase 1: Identify decoder functions
    const decoderFunctions = this.identifyDecoderFunctions(state);
    
    // Phase 2: Find encoded strings and arrays
    const encodedData = this.findEncodedData(state);
    
    // Phase 3: Correlate with sandbox execution traces
    const correlatedDecoders = this.correlateSandboxTraces(decoderFunctions, encodedData);
    
    // Phase 4: Apply decoder lifting transformations
    const { newNodes, changed } = this.applyDecoderLifting(state, correlatedDecoders);

    if (changed) {
      const newState = PassUtils.updateNodes(state, newNodes);
      return { state: newState, changed: true };
    }

    return { state, changed: false };
  }

  /**
   * Identify potential decoder functions in the IR
   */
  private identifyDecoderFunctions(state: IRState): DecoderMatchResult[] {
    const results: DecoderMatchResult[] = [];

    for (const [nodeId, node] of state.nodes) {
      if (node.type !== 'FunctionDeclaration') continue;
      
      for (const pattern of this.decoderPatterns) {
        const match = pattern.detector(node);
        if (match) {
          results.push(match);
          this.nodesVisited++;
        }
      }
    }

    return results;
  }

  /**
   * Find encoded data structures (arrays, strings)
   */
  private findEncodedData(state: IRState): ArrayReference[] {
    const encodedArrays: ArrayReference[] = [];

    for (const [nodeId, node] of state.nodes) {
      if (node.type === 'VariableDeclaration') {
        const arrayRef = this.analyzeVariableForEncodedArray(node);
        if (arrayRef) {
          encodedArrays.push(arrayRef);
        }
      }
    }

    return encodedArrays;
  }

  /**
   * Correlate decoder functions with sandbox execution traces
   */
  private correlateSandboxTraces(
    decoders: DecoderMatchResult[],
    encodedData: ArrayReference[]
  ): Map<VariableName, DecodedString[]> {
    const correlatedResults = new Map<VariableName, DecodedString[]>();

    if (!this.sandboxResults?.trace) {
      return correlatedResults;
    }

    // Create mapping of function names to decoders
    const decoderMap = new Map<VariableName, DecoderMatchResult>();
    for (const decoder of decoders) {
      if (decoder.functionNode.id) {
        decoderMap.set(decoder.functionNode.id.name as VariableName, decoder);
      }
    }

    // Analyze trace entries for decoder function calls
    for (const entry of this.sandboxResults.trace.entries) {
      if (entry.type === 'function_call' && entry.data.irCorrelation?.nodeId) {
        const nodeId = entry.data.irCorrelation.nodeId;
        const matchingDecoder = decoders.find(d => d.functionNode.node_id === nodeId);
        
        if (matchingDecoder && entry.data.outputs?.[0]) {
          const decodedValue = String(entry.data.outputs[0]);
          if (this.isLikelyDecodedString(decodedValue)) {
            const functionName = matchingDecoder.functionNode.id!.name as VariableName;
            
            // Create decoded string entry with correlation info
            const decodedString: DecodedString = {
              originalCall: this.findOriginalCall(entry, nodeId),
              decodedValue,
              encodingUsed: this.inferEncodingType(entry.data.inputs || [], decodedValue),
              confidence: this.calculateDecodingConfidence(entry, matchingDecoder),
              sandboxCorrelation: {
                traceEntry: entry,
                executionResult: entry.data.outputs?.[0]
              }
            };

            // Add to results
            const existing = correlatedResults.get(functionName) || [];
            correlatedResults.set(functionName, [...existing, decodedString]);
          }
        }
      }
    }

    // Cross-reference with encoded arrays for better correlation
    this.crossReferenceWithArrays(correlatedResults, encodedData);

    return correlatedResults;
  }

  /**
   * Cross-reference decoded strings with encoded arrays
   */
  private crossReferenceWithArrays(
    correlatedResults: Map<VariableName, DecodedString[]>,
    encodedArrays: ArrayReference[]
  ): void {
    for (const [decoderName, decodedStrings] of correlatedResults) {
      for (const decodedString of decodedStrings) {
        // Try to find the source array for this decoded string
        const sourceArray = this.findSourceArray(decodedString, encodedArrays);
        if (sourceArray) {
          // Update the decoded string with array reference
          // This would require making DecodedString mutable or creating a new interface
          this.associateArrayWithDecodedString(decodedString, sourceArray);
        }
      }
    }
  }

  /**
   * Find the original call expression that triggered this decoder
   */
  private findOriginalCall(traceEntry: TraceEntry, nodeId: NodeId): IRCallExpression {
    // This would need to search through the IR to find the call expression
    // For now, create a placeholder call expression
    return {
      type: 'CallExpression',
      id: nodeId,
      callee: {
        type: 'Identifier',
        name: 'decoder_function',
        id: nodeId
      },
      arguments: []
    } as IRCallExpression;
  }

  /**
   * Infer encoding type from arguments and decoded result
   */
  private inferEncodingType(args: unknown[], decodedValue: string): EncodingType {
    if (!args || args.length === 0) {
      return 'array-lookup';
    }

    const firstArg = args[0];
    
    // Check if it's a numeric index (array lookup)
    if (typeof firstArg === 'number') {
      return 'array-lookup';
    }

    // Check if it's a string that looks encoded
    if (typeof firstArg === 'string') {
      if (/^[A-Za-z0-9+/]*={0,2}$/.test(firstArg)) {
        return 'base64';
      }
      if (/^[0-9a-fA-F]+$/.test(firstArg)) {
        return 'hex';
      }
      if (this.looksLikeRot13(firstArg, decodedValue)) {
        return 'rot13';
      }
    }

    return 'array-lookup';
  }

  /**
   * Calculate confidence in the decoding result
   */
  private calculateDecodingConfidence(
    traceEntry: TraceEntry, 
    decoder: DecoderMatchResult
  ): number {
    let confidence = decoder.confidence;

    // Increase confidence if execution succeeded
    const result = traceEntry.data.outputs?.[0];
    if (result) {
      confidence += 0.1;
    }

    // Increase confidence if result looks like readable text
    if (result && typeof result === 'string') {
      if (this.hasReadableContent(result)) {
        confidence += 0.15;
      }
    }

    // Note: TraceEntry doesn't have error field in current interface
    // Could check if outputs is empty or has error indicators

    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * Check if a string looks like ROT13 encoding of another
   */
  private looksLikeRot13(encoded: string, decoded: string): boolean {
    if (encoded.length !== decoded.length) return false;

    let matches = 0;
    for (let i = 0; i < encoded.length; i++) {
      const encodedChar = encoded.charCodeAt(i);
      const decodedChar = decoded.charCodeAt(i);
      
      // Check if characters are ROT13 related
      if (this.isRot13Pair(encodedChar, decodedChar)) {
        matches++;
      }
    }

    return matches / encoded.length > 0.8; // 80% of characters match ROT13 pattern
  }

  /**
   * Check if two characters are ROT13 pairs
   */
  private isRot13Pair(char1: number, char2: number): boolean {
    // ROT13 for letters: A-M <-> N-Z, a-m <-> n-z
    if (char1 >= 65 && char1 <= 90) { // A-Z
      const expected = char1 <= 77 ? char1 + 13 : char1 - 13;
      return char2 === expected;
    }
    if (char1 >= 97 && char1 <= 122) { // a-z
      const expected = char1 <= 109 ? char1 + 13 : char1 - 13;
      return char2 === expected;
    }
    // Non-letters should be unchanged
    return char1 === char2;
  }

  /**
   * Check if string has readable content
   */
  private hasReadableContent(str: string): boolean {
    // Check for common words, reasonable character distribution, etc.
    const words = str.toLowerCase().split(/\s+/);
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
    
    const commonWordCount = words.filter(word => commonWords.includes(word)).length;
    return commonWordCount > 0 || /\b[a-z]{3,}\b/i.test(str);
  }

  /**
   * Find source array for a decoded string
   */
  private findSourceArray(
    decodedString: DecodedString, 
    arrays: ArrayReference[]
  ): ArrayReference | null {
    // Look for arrays with matching encoding type
    for (const array of arrays) {
      if (array.encoding === decodedString.encodingUsed) {
        // Additional checks could be performed here
        return array;
      }
    }
    return null;
  }

  /**
   * Associate an array with a decoded string
   */
  private associateArrayWithDecodedString(
    decodedString: DecodedString, 
    sourceArray: ArrayReference
  ): void {
    // This would update metadata or create extended interface
    // For now, just log the association
    console.debug(`Associated decoded string "${decodedString.decodedValue.substring(0, 20)}..." with array ${sourceArray.variableName}`);
  }

  /**
   * Apply decoder lifting transformations
   */
  private applyDecoderLifting(
    state: IRState,
    correlatedDecoders: Map<VariableName, DecodedString[]>
  ): { newNodes: Map<NodeId, IRNode>; changed: boolean } {
    const newNodes = new Map<NodeId, IRNode>();
    let changed = false;

    for (const [nodeId, node] of state.nodes) {
      if (this.shouldReplaceWithDecodedString(node, correlatedDecoders)) {
        const replacement = this.createReplacementLiteral(node, correlatedDecoders);
        if (replacement) {
          newNodes.set(nodeId, replacement);
          changed = true;
          this.nodesChanged++;
        }
      }
    }

    return { newNodes, changed };
  }

  /**
   * Create javascript-obfuscator.io pattern detector
   */
  private createJavaScriptObfuscatorPattern(): DecoderPattern {
    const pattern: DecoderPattern = {
      signature: 'js-obfuscator-array',
      name: 'JavaScript Obfuscator String Array',
      confidence: 0.95,
      obfuscatorHints: ['javascript-obfuscator'],
      detector: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration' || !node.body) return null;
        
        // Look for characteristic pattern:
        // function _0x1234(index, offset) { return _0x5678[index - offset]; }
        const hasIndexParam = node.params.length >= 1;
        const hasReturnArrayAccess = this.hasArrayAccessReturn(node.body);
        const hasObfuscatedName = /^_0x[a-f0-9]+$/i.test(node.id?.name || '');
        
        if (hasIndexParam && hasReturnArrayAccess && hasObfuscatedName) {
          return {
            pattern,
            functionNode: node,
            parameters: this.extractArrayLookupParams(node),
            confidence: 0.95
          };
        }
        
        return null;
      },
      extractor: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration') return null;
        return {
          functionId: node.id!.name as NodeId,
          name: node.id!.name as VariableName,
          encodingType: 'array-lookup',
          parameters: this.extractArrayLookupParams(node)
        };
      }
    };
    return pattern;
  }

  /**
   * Create Base64 decoder pattern
   */
  private createBase64DecoderPattern(): DecoderPattern {
    const pattern: DecoderPattern = {
      signature: 'base64-decoder',
      name: 'Base64 Decoder Function',
      confidence: 0.90,
      obfuscatorHints: ['base64', 'atob'],
      detector: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration' || !node.body) return null;
        
        // Look for base64 alphabet or atob usage
        const codeStr = this.nodeToString(node);
        const hasBase64Alphabet = /[A-Za-z0-9+/=]{40,}/.test(codeStr);
        const usesAtob = /\batob\b/.test(codeStr);
        const hasCharCodeOps = /charCodeAt|fromCharCode/.test(codeStr);
        
        if (hasBase64Alphabet || (usesAtob && hasCharCodeOps)) {
          return {
            pattern,
            functionNode: node,
            parameters: { stringParam: this.getParameterName(node.params[0]) },
            confidence: 0.90
          };
        }
        
        return null;
      },
      extractor: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration') return null;
        return {
          functionId: node.id!.name as NodeId,
          name: node.id!.name as VariableName,
          encodingType: 'base64',
          parameters: { stringParam: this.getParameterName(node.params[0]) }
        };
      }
    };
    return pattern;
  }

  /**
   * Create hex decoder pattern
   */
  private createHexDecoderPattern(): DecoderPattern {
    const pattern: DecoderPattern = {
      signature: 'hex-decoder',
      name: 'Hex Decoder Function',
      confidence: 0.85,
      obfuscatorHints: ['hex', '\\x'],
      detector: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration' || !node.body) return null;
        
        const codeStr = this.nodeToString(node);
        const hasHexPattern = /\\x[0-9a-f]{2}|0x[0-9a-f]+/i.test(codeStr);
        const hasParseInt16 = /parseInt.*16/.test(codeStr);
        const hasCharCode = /charCodeAt|fromCharCode/.test(codeStr);
        
        if ((hasHexPattern || hasParseInt16) && hasCharCode) {
          return {
            pattern,
            functionNode: node,
            parameters: { stringParam: this.getParameterName(node.params[0]) },
            confidence: 0.85
          };
        }
        
        return null;
      },
      extractor: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration') return null;
        return {
          functionId: node.id!.name as NodeId,
          name: node.id!.name as VariableName,
          encodingType: 'hex',
          parameters: { stringParam: this.getParameterName(node.params[0]) }
        };
      }
    };
    return pattern;
  }

  /**
   * Create ROT13 decoder pattern
   */
  private createRot13DecoderPattern(): DecoderPattern {
    const pattern: DecoderPattern = {
      signature: 'rot13-decoder',
      name: 'ROT13/Caesar Cipher Decoder',
      confidence: 0.80,
      obfuscatorHints: ['rot13', 'caesar'],
      detector: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration' || !node.body) return null;
        
        const codeStr = this.nodeToString(node);
        const hasAlphabet = /[a-zA-Z]{20,}/.test(codeStr);
        const hasCharCodeOps = /charCodeAt|fromCharCode/.test(codeStr);
        const hasModuloOp = /%\s*26|%\s*alphabet/.test(codeStr);
        
        if (hasAlphabet && hasCharCodeOps && hasModuloOp) {
          return {
            pattern,
            functionNode: node,
            parameters: this.extractCaesarParams(node),
            confidence: 0.80
          };
        }
        
        return null;
      },
      extractor: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration') return null;
        return {
          functionId: node.id!.name as NodeId,
          name: node.id!.name as VariableName,
          encodingType: 'rot13',
          parameters: this.extractCaesarParams(node)
        };
      }
    };
    return pattern;
  }

  /**
   * Create array lookup pattern
   */
  private createArrayLookupPattern(): DecoderPattern {
    const pattern: DecoderPattern = {
      signature: 'array-lookup',
      name: 'Array Index Lookup Decoder',
      confidence: 0.75,
      obfuscatorHints: ['array', 'lookup'],
      detector: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration' || !node.body) return null;
        
        const hasArrayAccess = this.hasArrayAccessReturn(node.body);
        const hasIndexParam = node.params.length === 1;
        
        if (hasArrayAccess && hasIndexParam) {
          return {
            pattern,
            functionNode: node,
            parameters: { indexParam: this.getParameterName(node.params[0]) },
            confidence: 0.75
          };
        }
        
        return null;
      },
      extractor: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration') return null;
        return {
          functionId: node.id!.name as NodeId,
          name: node.id!.name as VariableName,
          encodingType: 'array-lookup',
          parameters: { indexParam: this.getParameterName(node.params[0]) }
        };
      }
    };
    return pattern;
  }

  /**
   * Create character code array pattern
   */
  private createCharCodeArrayPattern(): DecoderPattern {
    const pattern: DecoderPattern = {
      signature: 'charcode-array',
      name: 'Character Code Array Decoder',
      confidence: 0.85,
      obfuscatorHints: ['charCode', 'fromCharCode'],
      detector: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration' || !node.body) return null;
        
        const codeStr = this.nodeToString(node);
        const hasFromCharCode = /String\.fromCharCode|fromCharCode/.test(codeStr);
        const hasArrayOps = /\[[^\]]*\]/.test(codeStr);
        const hasApply = /\.apply\s*\(/.test(codeStr);
        
        if (hasFromCharCode && (hasArrayOps || hasApply)) {
          return {
            pattern,
            functionNode: node,
            parameters: { indexParam: this.getParameterName(node.params[0]) },
            confidence: 0.85
          };
        }
        
        return null;
      },
      extractor: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration') return null;
        return {
          functionId: node.id!.name as NodeId,
          name: node.id!.name as VariableName,
          encodingType: 'charcode-array',
          parameters: { indexParam: this.getParameterName(node.params[0]) }
        };
      }
    };
    return pattern;
  }

  /**
   * Create XOR decoder pattern
   */
  private createXorDecoderPattern(): DecoderPattern {
    const pattern: DecoderPattern = {
      signature: 'xor-decoder',
      name: 'XOR Cipher Decoder',
      confidence: 0.70,
      obfuscatorHints: ['xor', '^'],
      detector: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration' || !node.body) return null;
        
        const codeStr = this.nodeToString(node);
        const hasXorOp = /\s+\^\s+|\sxor\s/i.test(codeStr);
        const hasCharCodeOps = /charCodeAt|fromCharCode/.test(codeStr);
        const hasKey = node.params.length >= 2;
        
        if (hasXorOp && hasCharCodeOps && hasKey) {
          return {
            pattern,
            functionNode: node,
            parameters: {
              stringParam: this.getParameterName(node.params[0]),
              extraParams: new Map([['keyParam', this.getParameterName(node.params[1])]])
            },
            confidence: 0.70
          };
        }
        
        return null;
      },
      extractor: (node: IRNode) => {
        if (node.type !== 'FunctionDeclaration') return null;
        return {
          functionId: node.id!.name as NodeId,
          name: node.id!.name as VariableName,
          encodingType: 'xor',
          parameters: {
            stringParam: this.getParameterName(node.params[0]),
            extraParams: new Map([['keyParam', this.getParameterName(node.params[1])]])
          }
        };
      }
    };
    return pattern;
  }

  // Helper methods
  
  /**
   * Safely extract parameter name from IRPattern
   */
  private getParameterName(param: IRPattern | undefined): VariableName | undefined {
    if (!param) return undefined;
    if (param.type === 'Identifier') {
      return param.name as VariableName;
    }
    // For other pattern types, we can't extract a simple name
    return undefined;
  }

  private hasArrayAccessReturn(body: IRStatement): boolean {
    // Simplified check - would need proper AST traversal
    const bodyStr = this.nodeToString(body);
    return /return\s+\w+\s*\[\s*\w+/.test(bodyStr);
  }

  private extractArrayLookupParams(node: IRFunctionDeclaration): DecoderParameters {
    return {
      indexParam: this.getParameterName(node.params[0]),
      extraParams: node.params[1] ? new Map([['offsetParam', this.getParameterName(node.params[1])]]) : undefined
    };
  }

  private extractCaesarParams(node: IRFunctionDeclaration): DecoderParameters {
    const codeStr = this.nodeToString(node);
    const offsetMatch = codeStr.match(/[+-]\s*(\d+)|shift.*?(\d+)/);
    const alphabetMatch = codeStr.match(/['"`]([a-zA-Z]{20,})['"`]/);
    
    return {
      stringParam: this.getParameterName(node.params[0]),
      offset: offsetMatch ? parseInt(offsetMatch[1] || offsetMatch[2], 10) : undefined,
      alphabet: alphabetMatch ? alphabetMatch[1] : undefined
    };
  }

  private analyzeVariableForEncodedArray(node: IRVariableDeclaration): ArrayReference | null {
    // Check if this is a string array that looks encoded
    for (const declarator of node.declarations) {
      if (declarator.init?.type === 'ArrayExpression') {
        const elements = declarator.init.elements;
        if (this.looksLikeEncodedArray(elements) && declarator.id.type === 'Identifier') {
          return {
            nodeId: declarator.id.name as NodeId,
            variableName: declarator.id.name as VariableName,
            elements: elements.map(e => e?.type === 'Literal' ? e.value : null).filter(v => v !== null && (typeof v === 'string' || typeof v === 'number')) as (string | number)[],
            encoding: this.detectArrayEncoding(elements)
          };
        }
      }
    }
    return null;
  }

  private looksLikeEncodedArray(elements: readonly (IRExpression | null)[]): boolean {
    const stringElements = elements.filter(e => e?.type === 'Literal' && typeof e.value === 'string');
    if (stringElements.length < 3) return false;
    
    // Check for patterns that suggest encoding
    const avgLength = stringElements.reduce((sum, e) => 
      sum + (e?.type === 'Literal' ? String(e.value).length : 0), 0) / stringElements.length;
    
    return avgLength > 10; // Encoded strings tend to be longer
  }

  private detectArrayEncoding(elements: readonly (IRExpression | null)[]): EncodingType {
    const samples = elements
      .filter(e => e?.type === 'Literal' && typeof e.value === 'string')
      .slice(0, 5)
      .map(e => String((e as IRLiteral).value));
    
    if (samples.some(s => /^[A-Za-z0-9+/]*={0,2}$/.test(s))) return 'base64';
    if (samples.some(s => /^[0-9a-fA-F]+$/.test(s))) return 'hex';
    if (samples.some(s => /[^\x20-\x7E]/.test(s))) return 'unicode-escape';
    
    return 'array-lookup';
  }

  private nodeToString(node: IRNode): string {
    // Simplified string representation - would use proper printer
    return JSON.stringify(node, null, 0);
  }

  private isLikelyDecodedString(value: string): boolean {
    // Heuristic to check if a string looks like decoded output
    const hasReadableWords = /\b[a-z]{3,}\b/i.test(value);
    const hasNormalChars = /^[\x20-\x7E\s]*$/.test(value);
    const hasReasonableLength = value.length > 2 && value.length < 10000;
    
    return hasReadableWords && hasNormalChars && hasReasonableLength;
  }

  private shouldReplaceWithDecodedString(
    node: IRNode, 
    correlatedDecoders: Map<VariableName, DecodedString[]>
  ): boolean {
    if (node.type !== 'CallExpression') return false;
    
    // Check if this is a call to a known decoder function
    const callee = node.callee;
    if (callee.type === 'Identifier') {
      return correlatedDecoders.has(callee.name as VariableName);
    }
    
    return false;
  }

  private createReplacementLiteral(
    node: IRNode, 
    correlatedDecoders: Map<VariableName, DecodedString[]>
  ): IRLiteral | null {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
      return null;
    }
    
    const decodedStrings = correlatedDecoders.get(node.callee.name as VariableName);
    if (!decodedStrings || decodedStrings.length === 0) {
      return null;
    }
    
    // Find the matching decoded string for this call
    const matching = decodedStrings.find(ds => ds.originalCall.node_id === node.node_id);
    if (!matching) {
      return null;
    }
    
    return IRNodeFactory.literal(matching.decodedValue, 'string');
  }
}