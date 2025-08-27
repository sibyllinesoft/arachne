/**
 * @fileoverview Tests for String/Array Decoder Lifting Pass
 * 
 * Tests the detection and lifting of common string/array decoder patterns
 * used by JavaScript obfuscators, including correlation with sandbox
 * execution traces and encoding type inference.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { 
  StringDecoderLiftingPass, 
  type DecoderPattern,
  type DecodedString,
  type EncodingType 
} from '../../src/passes/decoders.js';
import { IRNodeFactory } from '../../src/ir/nodes.js';
import type { IRState } from '../../src/passes/Pass.js';
import type { SandboxResult, TraceEntry } from '../../src/sandbox/types.js';

describe('StringDecoderLiftingPass', () => {
  let pass: StringDecoderLiftingPass;
  let mockState: IRState;
  let mockSandboxResults: SandboxResult;

  beforeEach(() => {
    pass = new StringDecoderLiftingPass();
    mockState = createMockIRState();
    mockSandboxResults = createMockSandboxResults();
  });

  describe('Pattern Detection', () => {
    test('should detect javascript-obfuscator.io array pattern', () => {
      const functionNode = IRNodeFactory.functionDeclaration(
        IRNodeFactory.identifier('_0x1234'),
        [
          IRNodeFactory.identifier('index'),
          IRNodeFactory.identifier('offset')
        ],
        IRNodeFactory.blockStatement([
          IRNodeFactory.returnStatement(
            {
              type: 'MemberExpression' as const,
              object: IRNodeFactory.identifier('_0x5678'),
              property: IRNodeFactory.binaryExpression(
                '-',
                IRNodeFactory.identifier('index'),
                IRNodeFactory.identifier('offset')
              ),
              computed: true,
              node_id: IRNodeFactory.createNodeId()
            }
          )
        ])
      );

      const patterns = pass['createJavaScriptObfuscatorPattern']();
      const result = patterns.detector(functionNode);

      expect(result).toBeTruthy();
      expect(result?.pattern.signature).toBe('js-obfuscator-array');
      expect(result?.confidence).toBeGreaterThan(0.9);
    });

    test('should detect base64 decoder pattern', () => {
      const functionNode = IRNodeFactory.functionDeclaration(
        IRNodeFactory.identifier('decode'),
        [IRNodeFactory.identifier('str')],
        IRNodeFactory.blockStatement([
          IRNodeFactory.returnStatement(
            IRNodeFactory.callExpression(
              IRNodeFactory.identifier('atob'),
              [IRNodeFactory.identifier('str')]
            )
          )
        ])
      );

      const patterns = pass['createBase64DecoderPattern']();
      const result = patterns.detector(functionNode);

      expect(result).toBeTruthy();
      expect(result?.pattern.signature).toBe('base64-decoder');
    });

    test('should detect ROT13 decoder pattern', () => {
      const functionNode = createMockRot13Function();
      const patterns = pass['createRot13DecoderPattern']();
      const result = patterns.detector(functionNode);

      expect(result).toBeTruthy();
      expect(result?.pattern.signature).toBe('rot13-decoder');
    });
  });

  describe('Encoding Type Inference', () => {
    test('should correctly infer base64 encoding', () => {
      const encodingType = pass['inferEncodingType'](
        ['SGVsbG8gV29ybGQ='],
        'Hello World'
      );
      expect(encodingType).toBe('base64');
    });

    test('should correctly infer hex encoding', () => {
      const encodingType = pass['inferEncodingType'](
        ['48656c6c6f20576f726c64'],
        'Hello World'
      );
      expect(encodingType).toBe('hex');
    });

    test('should correctly infer ROT13 encoding', () => {
      const encodingType = pass['inferEncodingType'](
        ['Uryyb Jbeyq'],
        'Hello World'
      );
      expect(encodingType).toBe('rot13');
    });

    test('should default to array-lookup for numeric indices', () => {
      const encodingType = pass['inferEncodingType'](
        [42],
        'Some String'
      );
      expect(encodingType).toBe('array-lookup');
    });
  });

  describe('Sandbox Correlation', () => {
    test('should correlate decoder function calls with sandbox traces', () => {
      const pass = new StringDecoderLiftingPass({ 
        sandboxResults: mockSandboxResults 
      });

      const decoders = [createMockDecoderResult()];
      const encodedData = [createMockArrayReference()];
      
      const correlatedResults = pass['correlateSandboxTraces'](decoders, encodedData);
      
      expect(correlatedResults.size).toBeGreaterThan(0);
      const results = correlatedResults.get('_0x1234');
      expect(results).toBeDefined();
      expect(results![0].decodedValue).toBe('Hello World');
      expect(results![0].confidence).toBeGreaterThan(0.8);
    });

    test('should calculate confidence based on execution success', () => {
      const mockEntry: TraceEntry = {
        type: 'function_call',
        timestamp: 1000,
        arguments: ['SGVsbG8gV29ybGQ='],
        result: 'Hello World',
        metadata: { irCorrelation: { nodeId: 'node1' } }
      };

      const mockDecoder = createMockDecoderResult();
      const confidence = pass['calculateDecodingConfidence'](mockEntry, mockDecoder);
      
      expect(confidence).toBeGreaterThan(0.9);
    });

    test('should reduce confidence on execution errors', () => {
      const mockEntry: TraceEntry = {
        type: 'function_call',
        timestamp: 1000,
        arguments: ['invalid'],
        error: new Error('Decoding failed'),
        metadata: { irCorrelation: { nodeId: 'node1' } }
      };

      const mockDecoder = createMockDecoderResult();
      const confidence = pass['calculateDecodingConfidence'](mockEntry, mockDecoder);
      
      expect(confidence).toBeLessThan(0.7);
    });
  });

  describe('ROT13 Detection', () => {
    test('should correctly identify ROT13 character pairs', () => {
      // A (65) -> N (78)
      expect(pass['isRot13Pair'](65, 78)).toBe(true);
      // N (78) -> A (65)
      expect(pass['isRot13Pair'](78, 65)).toBe(true);
      // a (97) -> n (110)
      expect(pass['isRot13Pair'](97, 110)).toBe(true);
      // Non-letters should be unchanged
      expect(pass['isRot13Pair'](32, 32)).toBe(true); // space
      expect(pass['isRot13Pair'](48, 48)).toBe(true); // '0'
    });

    test('should detect ROT13 encoded strings', () => {
      const encoded = 'Uryyb Jbeyq';
      const decoded = 'Hello World';
      
      expect(pass['looksLikeRot13'](encoded, decoded)).toBe(true);
    });

    test('should reject non-ROT13 string pairs', () => {
      const encoded = 'Random Text';
      const decoded = 'Other Text';
      
      expect(pass['looksLikeRot13'](encoded, decoded)).toBe(false);
    });
  });

  describe('Content Analysis', () => {
    test('should identify readable content', () => {
      expect(pass['hasReadableContent']('Hello World')).toBe(true);
      expect(pass['hasReadableContent']('The quick brown fox')).toBe(true);
      expect(pass['hasReadableContent']('console log debug')).toBe(true);
    });

    test('should reject non-readable content', () => {
      expect(pass['hasReadableContent']('xkj2k3j4k5j')).toBe(false);
      expect(pass['hasReadableContent']('!!!@@@###')).toBe(false);
    });

    test('should detect likely decoded strings', () => {
      expect(pass['isLikelyDecodedString']('Hello World')).toBe(true);
      expect(pass['isLikelyDecodedString']('function test()')).toBe(true);
      expect(pass['isLikelyDecodedString']('')).toBe(false);
      expect(pass['isLikelyDecodedString']('x'.repeat(20000))).toBe(false);
    });
  });

  describe('Array Reference Analysis', () => {
    test('should detect encoded arrays', () => {
      const arrayExpr = IRNodeFactory.arrayExpression([
        IRNodeFactory.literal('SGVsbG8gV29ybGQ=', 'string'),
        IRNodeFactory.literal('VGVzdCBTdHJpbmc=', 'string'),
        IRNodeFactory.literal('QW5vdGhlciBUZXN0', 'string')
      ]);

      expect(pass['looksLikeEncodedArray'](arrayExpr.elements)).toBe(true);
    });

    test('should reject non-encoded arrays', () => {
      const arrayExpr = IRNodeFactory.arrayExpression([
        IRNodeFactory.literal('a', 'string'),
        IRNodeFactory.literal('b', 'string'),
        IRNodeFactory.literal('c', 'string')
      ]);

      expect(pass['looksLikeEncodedArray'](arrayExpr.elements)).toBe(false);
    });

    test('should detect various encoding types in arrays', () => {
      // Base64 array
      const base64Elements = [
        IRNodeFactory.literal('SGVsbG8=', 'string')
      ];
      expect(pass['detectArrayEncoding'](base64Elements)).toBe('base64');

      // Hex array
      const hexElements = [
        IRNodeFactory.literal('48656c6c6f', 'string')
      ];
      expect(pass['detectArrayEncoding'](hexElements)).toBe('hex');

      // Unicode escape array
      const unicodeElements = [
        IRNodeFactory.literal('\u0048\u0065\u006c\u006c\u006f', 'string')
      ];
      expect(pass['detectArrayEncoding'](unicodeElements)).toBe('unicode-escape');
    });
  });

  describe('Integration Tests', () => {
    test('should perform full decoder lifting pipeline', async () => {
      const pass = new StringDecoderLiftingPass({ 
        sandboxResults: mockSandboxResults 
      });

      const state = createMockIRStateWithDecoders();
      const result = pass.execute(state);

      expect(result.changed).toBe(true);
      expect(result.state.nodes.size).toBeGreaterThan(0);
      
      // Verify that some call expressions were replaced with literals
      let foundReplacement = false;
      for (const [nodeId, node] of result.state.nodes) {
        if (node.type === 'Literal' && typeof node.value === 'string') {
          foundReplacement = true;
          break;
        }
      }
      expect(foundReplacement).toBe(true);
    });

    test('should handle missing sandbox results gracefully', () => {
      const pass = new StringDecoderLiftingPass();
      const state = createMockIRStateWithDecoders();
      
      expect(() => pass.execute(state)).not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should handle large numbers of decoder patterns efficiently', () => {
      const state = createLargeIRStateWithDecoders(1000);
      const startTime = performance.now();
      
      const result = pass.execute(state);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (5 seconds for 1000 patterns)
      expect(executionTime).toBeLessThan(5000);
      expect(result.changed).toBe(true);
    });
  });
});

// Helper functions for creating mock objects

function createMockIRState(): IRState {
  return {
    nodes: new Map([
      ['node1', IRNodeFactory.literal('test')],
      ['node2', IRNodeFactory.identifier('variable')]
    ]),
    cfg: null,
    ssa: null
  };
}

function createMockSandboxResults(): SandboxResult {
  return {
    success: true,
    trace: {
      entries: [
        {
          type: 'function_call',
          timestamp: 1000,
          arguments: ['SGVsbG8gV29ybGQ='],
          result: 'Hello World',
          metadata: { 
            irCorrelation: { nodeId: 'node1' } 
          }
        }
      ],
      metadata: {
        totalCalls: 1,
        executionTime: 100,
        memoryUsage: 1024
      }
    },
    result: undefined,
    error: undefined,
    executionTime: 100
  };
}

function createMockDecoderResult() {
  return {
    pattern: {
      signature: 'js-obfuscator-array',
      name: 'JavaScript Obfuscator String Array',
      detector: () => null,
      extractor: () => null,
      confidence: 0.95,
      obfuscatorHints: ['javascript-obfuscator']
    },
    functionNode: IRNodeFactory.functionDeclaration(
      IRNodeFactory.identifier('_0x1234'),
      [],
      IRNodeFactory.blockStatement([])
    ),
    parameters: {},
    confidence: 0.95
  };
}

function createMockArrayReference() {
  return {
    nodeId: 'array1' as any,
    variableName: '_0x5678' as any,
    elements: ['SGVsbG8gV29ybGQ=', 'VGVzdCBTdHJpbmc='],
    encoding: 'base64' as EncodingType
  };
}

function createMockRot13Function() {
  return IRNodeFactory.functionDeclaration(
    IRNodeFactory.identifier('rot13'),
    [IRNodeFactory.identifier('str')],
    IRNodeFactory.blockStatement([
      IRNodeFactory.returnStatement(
        IRNodeFactory.callExpression(
          {
            type: 'MemberExpression' as const,
            object: IRNodeFactory.identifier('str'),
            property: IRNodeFactory.identifier('replace'),
            computed: false,
            node_id: IRNodeFactory.createNodeId()
          },
          [
            IRNodeFactory.literal('/[a-zA-Z]/g', 'string'),
            IRNodeFactory.createArrowFunctionExpression(
              [IRNodeFactory.identifier('c')],
              IRNodeFactory.callExpression(
                { type: "MemberExpression", object: 
                  IRNodeFactory.identifier('String'),
                  IRNodeFactory.identifier('fromCharCode'),
                  false
                ),
                [
                  IRNodeFactory.conditionalExpression(
                    IRNodeFactory.binaryExpression(
                      '<=',
                      IRNodeFactory.callExpression(
                        { type: "MemberExpression", object: 
                          IRNodeFactory.identifier('c'),
                          IRNodeFactory.identifier('charCodeAt'),
                          false
                        ),
                        [IRNodeFactory.literal(0, 'number')]
                      ),
                      IRNodeFactory.literal(109, 'number')
                    ),
                    IRNodeFactory.binaryExpression(
                      '+',
                      IRNodeFactory.callExpression(
                        { type: "MemberExpression", object: 
                          IRNodeFactory.identifier('c'),
                          IRNodeFactory.identifier('charCodeAt'),
                          false
                        ),
                        [IRNodeFactory.literal(0, 'number')]
                      ),
                      IRNodeFactory.literal(13, 'number')
                    ),
                    IRNodeFactory.binaryExpression(
                      '-',
                      IRNodeFactory.callExpression(
                        { type: "MemberExpression", object: 
                          IRNodeFactory.identifier('c'),
                          IRNodeFactory.identifier('charCodeAt'),
                          false
                        ),
                        [IRNodeFactory.literal(0, 'number')]
                      ),
                      IRNodeFactory.literal(13, 'number')
                    )
                  )
                ]
              )
            )
          ]
        )
      )
    ])
  );
}

function createMockIRStateWithDecoders(): IRState {
  const nodes = new Map();
  
  // Add a decoder function
  nodes.set('decoder1', createMockRot13Function());
  
  // Add a call to the decoder function
  nodes.set('call1', IRNodeFactory.callExpression(
    IRNodeFactory.identifier('rot13'),
    [IRNodeFactory.literal('Uryyb Jbeyq', 'string')]
  ));

  // Add an encoded string array
  nodes.set('array1', IRNodeFactory.variableDeclaration([
    IRNodeFactory.variableDeclarator(
      IRNodeFactory.identifier('_0x5678'),
      IRNodeFactory.arrayExpression([
        IRNodeFactory.literal('SGVsbG8gV29ybGQ=', 'string'),
        IRNodeFactory.literal('VGVzdCBTdHJpbmc=', 'string')
      ])
    )
  ]));

  return {
    nodes,
    cfg: null,
    ssa: null
  };
}

function createLargeIRStateWithDecoders(count: number): IRState {
  const nodes = new Map();
  
  for (let i = 0; i < count; i++) {
    const functionName = `_0x${i.toString(16).padStart(4, '0')}`;
    const arrayName = `_0x${(i + 1000).toString(16).padStart(4, '0')}`;
    
    // Add decoder function
    nodes.set(`decoder${i}`, IRNodeFactory.functionDeclaration(
      IRNodeFactory.identifier(functionName),
      [IRNodeFactory.identifier('index')],
      IRNodeFactory.blockStatement([
        IRNodeFactory.returnStatement(
          { type: "MemberExpression", object: 
            IRNodeFactory.identifier(arrayName),
            IRNodeFactory.identifier('index'),
            true
          )
        )
      ])
    ));
    
    // Add call expression
    nodes.set(`call${i}`, IRNodeFactory.callExpression(
      IRNodeFactory.identifier(functionName),
      [IRNodeFactory.literal(i % 10, 'number')]
    ));
  }
  
  return {
    nodes,
    cfg: null,
    ssa: null
  };
}