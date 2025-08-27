/**
 * @fileoverview Comprehensive tests for API stubs and mocking system (stubs.ts)
 * 
 * Tests mock API implementations, stub creation and management, API behavior simulation,
 * security-safe mock responses, and stub validation/testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  APIStubs,
  MockBrowser,
  MockNode,
  SafeConsole,
  StubRegistry,
  type StubConfig,
  type MockResponse,
  type APIStubOptions,
} from '../../src/sandbox/stubs.js';

describe('API Stubs and Mocking System (stubs.ts)', () => {
  let stubs: APIStubs;
  let stubRegistry: StubRegistry;

  beforeEach(() => {
    stubs = new APIStubs({
      enableNetworkStubs: true,
      enableConsoleStubs: true,
      enableTimerStubs: true,
      logStubCalls: true,
    });
    stubRegistry = new StubRegistry();
  });

  afterEach(() => {
    if (stubs) {
      stubs.cleanup();
    }
    if (stubRegistry) {
      stubRegistry.cleanup();
    }
  });

  describe('APIStubs', () => {
    describe('Stub Configuration', () => {
      it('should initialize with default stub configuration', () => {
        expect(stubs.isEnabled('console')).toBe(true);
        expect(stubs.isEnabled('setTimeout')).toBe(true);
        expect(stubs.isEnabled('fetch')).toBe(true);
        expect(stubs.isEnabled('XMLHttpRequest')).toBe(true);
      });

      it('should allow selective stub enabling/disabling', () => {
        stubs.disable('console');
        stubs.enable('WebSocket');

        expect(stubs.isEnabled('console')).toBe(false);
        expect(stubs.isEnabled('WebSocket')).toBe(true);
      });

      it('should validate stub configurations', () => {
        const invalidConfig = {
          enableNetworkStubs: true,
          networkBehavior: 'invalid_behavior' as any,
        };

        expect(() => {
          new APIStubs(invalidConfig);
        }).toThrow(/invalid.*configuration/i);
      });

      it('should provide stub statistics', () => {
        stubs.call('console', 'log', ['test message']);
        stubs.call('fetch', 'GET', ['https://example.com']);
        stubs.call('setTimeout', 'set', [() => {}, 1000]);

        const stats = stubs.getStatistics();
        
        expect(stats.totalCalls).toBe(3);
        expect(stats.stubsUsed).toContain('console');
        expect(stats.stubsUsed).toContain('fetch');
        expect(stats.stubsUsed).toContain('setTimeout');
      });
    });

    describe('Console API Stubs', () => {
      it('should stub console.log calls', () => {
        const result = stubs.call('console', 'log', ['Hello', 'World', 42]);
        
        expect(result.stubbed).toBe(true);
        expect(result.returnValue).toBeUndefined();
        
        const logs = stubs.getConsoleLogs();
        expect(logs).toHaveLength(1);
        expect(logs[0].level).toBe('log');
        expect(logs[0].args).toEqual(['Hello', 'World', 42]);
      });

      it('should stub console error methods', () => {
        stubs.call('console', 'error', ['Error message']);
        stubs.call('console', 'warn', ['Warning message']);
        
        const logs = stubs.getConsoleLogs();
        
        expect(logs).toHaveLength(2);
        expect(logs[0].level).toBe('error');
        expect(logs[1].level).toBe('warn');
      });

      it('should handle console.trace calls', () => {
        const result = stubs.call('console', 'trace', ['Trace message']);
        
        expect(result.stubbed).toBe(true);
        
        const logs = stubs.getConsoleLogs();
        expect(logs[0].level).toBe('trace');
        expect(logs[0].stackTrace).toBeDefined();
      });

      it('should safely format complex objects', () => {
        const complexObject = {
          str: 'text',
          num: 42,
          arr: [1, 2, 3],
          nested: { prop: 'value' },
          circular: null as any,
        };
        complexObject.circular = complexObject; // Create circular reference

        const result = stubs.call('console', 'log', [complexObject]);
        
        expect(result.stubbed).toBe(true);
        
        const logs = stubs.getConsoleLogs();
        expect(logs[0].formattedOutput).toContain('str');
        expect(logs[0].formattedOutput).toContain('circular');
        expect(logs[0].formattedOutput).not.toContain('[object Object]'); // Should format properly
      });
    });

    describe('Network API Stubs', () => {
      it('should stub fetch calls', () => {
        const mockResponse = {
          status: 200,
          statusText: 'OK',
          body: JSON.stringify({ message: 'Success' }),
          headers: { 'Content-Type': 'application/json' },
        };

        stubs.setNetworkResponse('https://api.example.com/data', mockResponse);
        
        const result = stubs.call('fetch', 'request', ['https://api.example.com/data']);
        
        expect(result.stubbed).toBe(true);
        expect(result.returnValue).toEqual(
          expect.objectContaining({
            status: 200,
            ok: true,
            json: expect.any(Function),
            text: expect.any(Function),
          })
        );
      });

      it('should stub XMLHttpRequest', () => {
        const mockResponse = {
          status: 201,
          statusText: 'Created',
          responseText: 'Resource created',
        };

        stubs.setNetworkResponse('https://api.example.com/create', mockResponse);
        
        const xhrStub = stubs.createXMLHttpRequestStub();
        
        expect(xhrStub.open).toBeDefined();
        expect(xhrStub.send).toBeDefined();
        expect(xhrStub.setRequestHeader).toBeDefined();
        
        // Simulate XHR usage
        xhrStub.open('POST', 'https://api.example.com/create');
        xhrStub.setRequestHeader('Content-Type', 'application/json');
        xhrStub.send('{"data": "test"}');
        
        expect(xhrStub.readyState).toBe(4);
        expect(xhrStub.status).toBe(201);
        expect(xhrStub.responseText).toBe('Resource created');
      });

      it('should simulate network errors', () => {
        stubs.setNetworkError('https://api.example.com/error', new Error('Network timeout'));
        
        const result = stubs.call('fetch', 'request', ['https://api.example.com/error']);
        
        expect(result.stubbed).toBe(true);
        expect(result.error).toBeDefined();
        expect(result.error.message).toBe('Network timeout');
      });

      it('should handle WebSocket stubs', () => {
        const wsStub = stubs.createWebSocketStub('wss://echo.websocket.org');
        
        expect(wsStub.send).toBeDefined();
        expect(wsStub.close).toBeDefined();
        expect(wsStub.readyState).toBe(0); // CONNECTING
        
        // Simulate connection
        wsStub.onopen({ target: wsStub });
        expect(wsStub.readyState).toBe(1); // OPEN
        
        // Simulate message
        const messageHandler = vi.fn();
        wsStub.onmessage = messageHandler;
        wsStub._receiveMessage('test message');
        
        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({ data: 'test message' })
        );
      });

      it('should track network request statistics', () => {
        stubs.call('fetch', 'request', ['https://api1.example.com']);
        stubs.call('fetch', 'request', ['https://api2.example.com']);
        stubs.call('XMLHttpRequest', 'request', ['https://api3.example.com']);
        
        const networkStats = stubs.getNetworkStatistics();
        
        expect(networkStats.totalRequests).toBe(3);
        expect(networkStats.methodCounts.GET).toBe(3); // Default method
        expect(networkStats.domains).toContain('api1.example.com');
        expect(networkStats.domains).toContain('api2.example.com');
        expect(networkStats.domains).toContain('api3.example.com');
      });
    });

    describe('Timer API Stubs', () => {
      it('should stub setTimeout calls', () => {
        const callback = vi.fn();
        
        const result = stubs.call('setTimeout', 'set', [callback, 1000]);
        
        expect(result.stubbed).toBe(true);
        expect(result.returnValue).toEqual(expect.any(Number)); // Timer ID
        
        // Fast-forward time
        stubs.advanceTimers(1000);
        
        expect(callback).toHaveBeenCalled();
      });

      it('should stub setInterval calls', () => {
        const callback = vi.fn();
        
        const result = stubs.call('setInterval', 'set', [callback, 500]);
        const timerId = result.returnValue;
        
        expect(result.stubbed).toBe(true);
        expect(timerId).toEqual(expect.any(Number));
        
        // Advance time multiple intervals
        stubs.advanceTimers(1500); // 3 intervals
        
        expect(callback).toHaveBeenCalledTimes(3);
        
        // Clear interval
        stubs.call('clearInterval', 'clear', [timerId]);
        stubs.advanceTimers(500);
        
        expect(callback).toHaveBeenCalledTimes(3); // Should not increase
      });

      it('should handle timer clearing', () => {
        const callback = vi.fn();
        
        const timeoutResult = stubs.call('setTimeout', 'set', [callback, 1000]);
        const timerId = timeoutResult.returnValue;
        
        // Clear before execution
        stubs.call('clearTimeout', 'clear', [timerId]);
        stubs.advanceTimers(1000);
        
        expect(callback).not.toHaveBeenCalled();
      });

      it('should support manual time control', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();
        
        stubs.call('setTimeout', 'set', [callback1, 100]);
        stubs.call('setTimeout', 'set', [callback2, 200]);
        
        // Advance time step by step
        stubs.advanceTimers(50);
        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();
        
        stubs.advanceTimers(50);
        expect(callback1).toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();
        
        stubs.advanceTimers(100);
        expect(callback2).toHaveBeenCalled();
      });

      it('should provide timer statistics', () => {
        stubs.call('setTimeout', 'set', [() => {}, 100]);
        stubs.call('setTimeout', 'set', [() => {}, 200]);
        stubs.call('setInterval', 'set', [() => {}, 50]);
        
        const timerStats = stubs.getTimerStatistics();
        
        expect(timerStats.activeTimeouts).toBe(2);
        expect(timerStats.activeIntervals).toBe(1);
        expect(timerStats.totalScheduled).toBe(3);
      });
    });

    describe('Custom Stub Creation', () => {
      it('should allow registering custom stubs', () => {
        const customStub = {
          name: 'localStorage',
          methods: {
            getItem: (key: string) => `mock_${key}`,
            setItem: (key: string, value: string) => void 0,
            removeItem: (key: string) => void 0,
            clear: () => void 0,
          },
          properties: {
            length: 0,
          },
        };

        stubs.registerStub(customStub);
        
        const getResult = stubs.call('localStorage', 'getItem', ['testKey']);
        
        expect(getResult.stubbed).toBe(true);
        expect(getResult.returnValue).toBe('mock_testKey');
      });

      it('should support stub inheritance and overrides', () => {
        const baseStub = {
          name: 'baseAPI',
          methods: {
            method1: () => 'base_result',
            method2: () => 'base_result2',
          },
        };

        const extendedStub = {
          name: 'baseAPI',
          extends: 'baseAPI',
          methods: {
            method1: () => 'extended_result', // Override
            method3: () => 'extended_result3', // New method
          },
        };

        stubs.registerStub(baseStub);
        stubs.registerStub(extendedStub);
        
        expect(stubs.call('baseAPI', 'method1', []).returnValue).toBe('extended_result');
        expect(stubs.call('baseAPI', 'method2', []).returnValue).toBe('base_result2');
        expect(stubs.call('baseAPI', 'method3', []).returnValue).toBe('extended_result3');
      });

      it('should validate stub configurations', () => {
        const invalidStub = {
          name: 'invalid',
          methods: null as any,
        };

        expect(() => {
          stubs.registerStub(invalidStub);
        }).toThrow(/invalid.*stub/i);
      });
    });
  });

  describe('MockBrowser', () => {
    let mockBrowser: MockBrowser;

    beforeEach(() => {
      mockBrowser = new MockBrowser({
        userAgent: 'Mozilla/5.0 (Mock Browser)',
        location: 'https://example.com/test',
        viewport: { width: 1920, height: 1080 },
      });
    });

    afterEach(() => {
      mockBrowser.cleanup();
    });

    describe('Window and Document APIs', () => {
      it('should provide mock window object', () => {
        const window = mockBrowser.getWindow();
        
        expect(window.location.href).toBe('https://example.com/test');
        expect(window.navigator.userAgent).toBe('Mozilla/5.0 (Mock Browser)');
        expect(window.innerWidth).toBe(1920);
        expect(window.innerHeight).toBe(1080);
      });

      it('should provide mock document object', () => {
        const document = mockBrowser.getDocument();
        
        expect(document.createElement).toBeDefined();
        expect(document.getElementById).toBeDefined();
        expect(document.querySelectorAll).toBeDefined();
      });

      it('should simulate DOM operations', () => {
        const document = mockBrowser.getDocument();
        
        const div = document.createElement('div');
        div.id = 'test-element';
        div.textContent = 'Hello World';
        
        document.body.appendChild(div);
        
        const found = document.getElementById('test-element');
        expect(found).toBe(div);
        expect(found.textContent).toBe('Hello World');
      });

      it('should handle event listeners', () => {
        const window = mockBrowser.getWindow();
        const listener = vi.fn();
        
        window.addEventListener('test-event', listener);
        
        // Simulate event
        const event = new Event('test-event');
        window.dispatchEvent(event);
        
        expect(listener).toHaveBeenCalledWith(event);
      });

      it('should mock local and session storage', () => {
        const window = mockBrowser.getWindow();
        
        window.localStorage.setItem('test-key', 'test-value');
        expect(window.localStorage.getItem('test-key')).toBe('test-value');
        expect(window.localStorage.length).toBe(1);
        
        window.sessionStorage.setItem('session-key', 'session-value');
        expect(window.sessionStorage.getItem('session-key')).toBe('session-value');
      });
    });

    describe('Navigation and History', () => {
      it('should simulate navigation', () => {
        const window = mockBrowser.getWindow();
        
        window.location.href = 'https://example.com/new-page';
        
        expect(window.location.pathname).toBe('/new-page');
        expect(window.location.origin).toBe('https://example.com');
      });

      it('should maintain history stack', () => {
        const window = mockBrowser.getWindow();
        
        window.history.pushState({}, 'Page 1', '/page1');
        window.history.pushState({}, 'Page 2', '/page2');
        
        expect(window.location.pathname).toBe('/page2');
        expect(window.history.length).toBe(3); // Initial + 2 pushes
        
        window.history.back();
        expect(window.location.pathname).toBe('/page1');
      });
    });

    describe('Browser-Specific APIs', () => {
      it('should mock geolocation API', async () => {
        const window = mockBrowser.getWindow();
        
        const position = await new Promise((resolve, reject) => {
          window.navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        
        expect(position.coords.latitude).toBeDefined();
        expect(position.coords.longitude).toBeDefined();
      });

      it('should mock clipboard API', async () => {
        const window = mockBrowser.getWindow();
        
        await window.navigator.clipboard.writeText('test clipboard content');
        const text = await window.navigator.clipboard.readText();
        
        expect(text).toBe('test clipboard content');
      });

      it('should mock media queries', () => {
        const window = mockBrowser.getWindow();
        
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        
        expect(mediaQuery.matches).toBe(false); // 1920px viewport
        
        // Change viewport
        mockBrowser.setViewport(600, 800);
        
        expect(mediaQuery.matches).toBe(true);
      });
    });
  });

  describe('MockNode', () => {
    let mockNode: MockNode;

    beforeEach(() => {
      mockNode = new MockNode({
        version: 'v18.17.0',
        platform: 'linux',
        arch: 'x64',
      });
    });

    afterEach(() => {
      mockNode.cleanup();
    });

    describe('Process and Environment', () => {
      it('should provide mock process object', () => {
        const process = mockNode.getProcess();
        
        expect(process.version).toBe('v18.17.0');
        expect(process.platform).toBe('linux');
        expect(process.arch).toBe('x64');
        expect(process.env).toBeDefined();
      });

      it('should handle process events', () => {
        const process = mockNode.getProcess();
        const listener = vi.fn();
        
        process.on('exit', listener);
        process.emit('exit', 0);
        
        expect(listener).toHaveBeenCalledWith(0);
      });

      it('should mock environment variables', () => {
        const process = mockNode.getProcess();
        
        process.env.TEST_VAR = 'test_value';
        expect(process.env.TEST_VAR).toBe('test_value');
      });
    });

    describe('Module System', () => {
      it('should mock require function', () => {
        const mockFs = {
          readFileSync: vi.fn().mockReturnValue('file content'),
          writeFileSync: vi.fn(),
        };

        mockNode.mockModule('fs', mockFs);
        
        const requireFunc = mockNode.getRequire();
        const fs = requireFunc('fs');
        
        expect(fs.readFileSync).toBe(mockFs.readFileSync);
        expect(fs.writeFileSync).toBe(mockFs.writeFileSync);
      });

      it('should handle built-in modules', () => {
        const requireFunc = mockNode.getRequire();
        
        const path = requireFunc('path');
        expect(path.join('/a', 'b', 'c')).toBe('/a/b/c');
        
        const crypto = requireFunc('crypto');
        expect(crypto.randomBytes).toBeDefined();
      });

      it('should support ES modules', async () => {
        const mockModule = { default: { test: 'value' } };
        mockNode.mockModule('test-module', mockModule);
        
        const dynamicImport = mockNode.getDynamicImport();
        const imported = await dynamicImport('test-module');
        
        expect(imported.default.test).toBe('value');
      });
    });

    describe('File System Operations', () => {
      it('should provide safe file system mock', () => {
        const fs = mockNode.getFileSystem();
        
        expect(() => fs.readFileSync('/etc/passwd')).toThrow(/access.*denied/i);
        expect(() => fs.writeFileSync('/tmp/safe-file', 'content')).not.toThrow();
      });

      it('should simulate file operations', () => {
        const fs = mockNode.getFileSystem();
        
        fs.writeFileSync('/tmp/test.txt', 'test content');
        const content = fs.readFileSync('/tmp/test.txt', 'utf8');
        
        expect(content).toBe('test content');
      });

      it('should handle async file operations', async () => {
        const fs = mockNode.getFileSystem();
        
        await new Promise<void>((resolve, reject) => {
          fs.writeFile('/tmp/async-test.txt', 'async content', (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        const content = await new Promise<string>((resolve, reject) => {
          fs.readFile('/tmp/async-test.txt', 'utf8', (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        
        expect(content).toBe('async content');
      });
    });
  });

  describe('SafeConsole', () => {
    let safeConsole: SafeConsole;

    beforeEach(() => {
      safeConsole = new SafeConsole({
        maxLogLength: 1000,
        preventCircular: true,
        enableStackTraces: true,
      });
    });

    describe('Safe Logging', () => {
      it('should handle circular references', () => {
        const circular: any = { name: 'test' };
        circular.self = circular;
        
        const output = safeConsole.formatValue(circular);
        
        expect(output).toContain('name');
        expect(output).toContain('[Circular]');
        expect(output).not.toThrow;
      });

      it('should limit output length', () => {
        const longString = 'a'.repeat(2000);
        
        const output = safeConsole.formatValue(longString);
        
        expect(output.length).toBeLessThanOrEqual(1000 + 20); // Account for truncation marker
        expect(output).toContain('...[truncated]');
      });

      it('should format different data types safely', () => {
        const testCases = [
          undefined,
          null,
          42,
          'string',
          true,
          Symbol('test'),
          BigInt(123),
          new Date('2023-01-01'),
          /regex/gi,
          new Error('test error'),
          () => 'function',
        ];
        
        testCases.forEach(value => {
          expect(() => safeConsole.formatValue(value)).not.toThrow();
        });
      });

      it('should provide stack traces when enabled', () => {
        const trace = safeConsole.getStackTrace();
        
        expect(trace).toBeDefined();
        expect(trace.length).toBeGreaterThan(0);
        expect(trace[0]).toMatch(/at.*test.*\.ts/);
      });
    });
  });

  describe('StubRegistry', () => {
    describe('Stub Management', () => {
      it('should register and retrieve stubs', () => {
        const testStub: StubConfig = {
          name: 'testAPI',
          methods: {
            testMethod: () => 'test result',
          },
          description: 'Test API stub',
        };

        stubRegistry.register(testStub);
        
        const retrieved = stubRegistry.get('testAPI');
        expect(retrieved).toBe(testStub);
        
        const allStubs = stubRegistry.getAll();
        expect(allStubs).toContain(testStub);
      });

      it('should prevent duplicate registrations', () => {
        const stub1: StubConfig = { name: 'duplicate', methods: {} };
        const stub2: StubConfig = { name: 'duplicate', methods: {} };

        stubRegistry.register(stub1);
        
        expect(() => {
          stubRegistry.register(stub2);
        }).toThrow(/already.*registered/i);
      });

      it('should support stub categories', () => {
        const browserStub: StubConfig = {
          name: 'window',
          category: 'browser',
          methods: {},
        };
        
        const nodeStub: StubConfig = {
          name: 'process',
          category: 'node',
          methods: {},
        };

        stubRegistry.register(browserStub);
        stubRegistry.register(nodeStub);
        
        const browserStubs = stubRegistry.getByCategory('browser');
        const nodeStubs = stubRegistry.getByCategory('node');
        
        expect(browserStubs).toContain(browserStub);
        expect(nodeStubs).toContain(nodeStub);
      });

      it('should validate stub configurations on registration', () => {
        const invalidStubs = [
          { name: '', methods: {} }, // Empty name
          { methods: {} }, // Missing name
          { name: 'test' }, // Missing methods
          { name: 'test', methods: null }, // Invalid methods
        ];

        invalidStubs.forEach(stub => {
          expect(() => {
            stubRegistry.register(stub as StubConfig);
          }).toThrow(/invalid.*stub/i);
        });
      });
    });

    describe('Stub Resolution', () => {
      it('should resolve stub methods correctly', () => {
        const stub: StubConfig = {
          name: 'math',
          methods: {
            add: (a: number, b: number) => a + b,
            multiply: (a: number, b: number) => a * b,
          },
        };

        stubRegistry.register(stub);
        
        const addMethod = stubRegistry.resolveMethod('math', 'add');
        const multiplyMethod = stubRegistry.resolveMethod('math', 'multiply');
        
        expect(addMethod(5, 3)).toBe(8);
        expect(multiplyMethod(4, 7)).toBe(28);
      });

      it('should handle missing stubs gracefully', () => {
        const method = stubRegistry.resolveMethod('nonexistent', 'method');
        
        expect(method).toBeNull();
      });

      it('should provide stub metadata', () => {
        const stub: StubConfig = {
          name: 'testStub',
          methods: { test: () => {} },
          description: 'Test stub description',
          version: '1.0.0',
          author: 'Test Author',
        };

        stubRegistry.register(stub);
        
        const metadata = stubRegistry.getMetadata('testStub');
        
        expect(metadata.description).toBe('Test stub description');
        expect(metadata.version).toBe('1.0.0');
        expect(metadata.author).toBe('Test Author');
      });
    });
  });

  describe('Integration and Advanced Features', () => {
    it('should support chained stub interactions', () => {
      const mockAPI = stubs.createChainableStub('chainAPI')
        .method('getData', () => ({ data: 'test' }))
        .method('processData', (data: any) => ({ processed: data.data }))
        .method('saveData', (data: any) => ({ saved: true, id: 123 }));

      const getData = stubs.call('chainAPI', 'getData', []);
      const processedData = stubs.call('chainAPI', 'processData', [getData.returnValue]);
      const savedData = stubs.call('chainAPI', 'saveData', [processedData.returnValue]);

      expect(getData.returnValue).toEqual({ data: 'test' });
      expect(processedData.returnValue).toEqual({ processed: 'test' });
      expect(savedData.returnValue).toEqual({ saved: true, id: 123 });
    });

    it('should handle asynchronous stub operations', async () => {
      const asyncStub: StubConfig = {
        name: 'asyncAPI',
        methods: {
          fetchData: async (url: string) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return { url, data: 'async result' };
          },
        },
      };

      stubRegistry.register(asyncStub);
      stubs.registerStub(asyncStub);

      const result = await stubs.call('asyncAPI', 'fetchData', ['https://api.example.com']);

      expect(result.stubbed).toBe(true);
      expect(result.returnValue).toEqual({
        url: 'https://api.example.com',
        data: 'async result',
      });
    });

    it('should provide comprehensive stub analytics', () => {
      // Make various stub calls
      stubs.call('console', 'log', ['message 1']);
      stubs.call('console', 'error', ['error 1']);
      stubs.call('fetch', 'request', ['https://api1.com']);
      stubs.call('fetch', 'request', ['https://api2.com']);
      stubs.call('setTimeout', 'set', [() => {}, 1000]);

      const analytics = stubs.getAnalytics();

      expect(analytics.totalCalls).toBe(5);
      expect(analytics.stubUsageRanking[0].name).toBe('fetch');
      expect(analytics.stubUsageRanking[0].calls).toBe(2);
      expect(analytics.categories.browser).toBeGreaterThan(0);
      expect(analytics.categories.network).toBeGreaterThan(0);
    });

    it('should support stub behavior modification', () => {
      const dynamicStub: StubConfig = {
        name: 'dynamicAPI',
        methods: {
          getValue: () => 'initial value',
        },
      };

      stubs.registerStub(dynamicStub);

      const initial = stubs.call('dynamicAPI', 'getValue', []);
      expect(initial.returnValue).toBe('initial value');

      // Modify behavior
      stubs.modifyStubBehavior('dynamicAPI', 'getValue', () => 'modified value');

      const modified = stubs.call('dynamicAPI', 'getValue', []);
      expect(modified.returnValue).toBe('modified value');
    });

    it('should handle cleanup properly', () => {
      stubs.call('console', 'log', ['test']);
      stubs.call('setTimeout', 'set', [() => {}, 1000]);

      expect(stubs.getStatistics().totalCalls).toBe(2);

      stubs.cleanup();

      expect(stubs.getStatistics().totalCalls).toBe(0);
      expect(stubs.getConsoleLogs()).toHaveLength(0);
      expect(stubs.getTimerStatistics().activeTimeouts).toBe(0);
    });
  });
});