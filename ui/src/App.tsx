import React, { useState, useCallback } from 'react';
import { Upload, FileText, Activity, Download, Settings, Info } from 'lucide-react';
import CFGVisualization from './components/CFGVisualization';
import CodeViewer from './components/CodeViewer';
import DiffViewer from './components/DiffViewer';
import PassExplorer from './components/PassExplorer';
import { dataLoader, DataProcessor } from './utils/dataParser';
import { ExportManager } from './utils/export';
import type { 
  AnalysisData, 
  PassExplorerState, 
  VisualizationSettings 
} from './types/analysis';

const App: React.FC = () => {
  // Main application state
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'passes' | 'cfg' | 'diff'>('overview');
  
  // Pass explorer state
  const [passState, setPassState] = useState<PassExplorerState>({
    selectedPass: 0,
    showCFG: false,
    showDiff: false,
    diffMode: 'side-by-side'
  });

  // Visualization settings
  const [vizSettings, setVizSettings] = useState<VisualizationSettings>({
    layout: 'hierarchical',
    showDominance: false,
    showLabels: true,
    nodeSize: 20,
    edgeWidth: 2,
    animationSpeed: 1000
  });

  // File upload handler
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const data = await dataLoader.loadFromFile(file);
      setAnalysisData(data);
      setPassState(prev => ({ ...prev, selectedPass: 0 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Pass selection handler
  const handlePassSelect = useCallback((passIndex: number | ((current: number) => number)) => {
    setPassState(prev => ({
      ...prev,
      selectedPass: typeof passIndex === 'function' ? passIndex(prev.selectedPass) : passIndex
    }));
  }, []);

  // View toggle handlers
  const handleCFGToggle = useCallback((show: boolean) => {
    setPassState(prev => ({ ...prev, showCFG: show }));
  }, []);

  const handleDiffToggle = useCallback((show: boolean) => {
    setPassState(prev => ({ ...prev, showDiff: show }));
  }, []);

  // Export handler
  const handleExport = useCallback(async () => {
    if (!analysisData) return;

    try {
      const result = await ExportManager.exportData(analysisData, {
        format: 'html',
        includeCode: true,
        includeCFG: true,
        includeMetrics: true
      });

      if (result.success && result.data) {
        const filename = ExportManager.generateFilename(analysisData, 'html');
        ExportManager.downloadBlob(result.data, filename);
      } else {
        console.error('Export failed:', result.error);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  }, [analysisData]);

  // Get current pass data
  const currentPass = analysisData?.passes[passState.selectedPass];
  const previousPass = passState.selectedPass > 0 ? analysisData?.passes[passState.selectedPass - 1] : null;

  // Get summary statistics
  const summaryStats = analysisData ? DataProcessor.getSummaryStats(analysisData) : null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  ArachneJS Interactive Analysis
                </h1>
                <p className="text-sm text-gray-500">
                  JavaScript Deobfuscation Visualization
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* File upload */}
              <label className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>Load Analysis</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {analysisData && (
                <button 
                  onClick={handleExport}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <div className="text-red-600">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-red-800 font-medium">Error Loading Analysis</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!analysisData && !loading && !error && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-900 mb-2">
              No Analysis Data Loaded
            </h2>
            <p className="text-gray-500 mb-6">
              Upload a JSON analysis file from ArachneJS CLI to get started
            </p>
            <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto text-left">
              <h3 className="font-medium text-gray-900 mb-2">Quick Start:</h3>
              <ol className="text-sm text-gray-600 space-y-1">
                <li>1. Run ArachneJS analysis:</li>
                <li className="font-mono text-xs bg-gray-100 px-2 py-1 rounded ml-4">
                  arachnejs analyze input.js --json-out analysis.json
                </li>
                <li>2. Upload the analysis.json file above</li>
                <li>3. Explore the interactive visualization</li>
              </ol>
            </div>
          </div>
        )}

        {analysisData && (
          <>
            {/* Summary stats */}
            {summaryStats && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">
                    {summaryStats.reduction}%
                  </div>
                  <div className="text-sm text-gray-600">Size Reduction</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-2xl font-bold text-green-600">
                    {summaryStats.passCount}
                  </div>
                  <div className="text-sm text-gray-600">Passes Executed</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-2xl font-bold text-purple-600">
                    {(summaryStats.totalTime / 1000).toFixed(2)}s
                  </div>
                  <div className="text-sm text-gray-600">Total Time</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-2xl font-bold text-red-600">
                    {summaryStats.totalRemoved.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Nodes Removed</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-2xl font-bold text-orange-600">
                    {summaryStats.maxComplexity}
                  </div>
                  <div className="text-sm text-gray-600">Max Complexity</div>
                </div>
              </div>
            )}

            {/* Main interface */}
            <div className="grid grid-cols-12 gap-6">
              {/* Pass explorer sidebar */}
              <div className="col-span-12 lg:col-span-4">
                <PassExplorer
                  passes={analysisData.passes}
                  selectedPass={passState.selectedPass}
                  onPassSelect={handlePassSelect}
                  onCFGToggle={handleCFGToggle}
                  onDiffToggle={handleDiffToggle}
                />
              </div>

              {/* Main content area */}
              <div className="col-span-12 lg:col-span-8">
                {/* Tab navigation */}
                <div className="flex space-x-1 mb-4">
                  {[
                    { id: 'overview', label: 'Overview', icon: FileText },
                    { id: 'passes', label: 'Pass Details', icon: Activity },
                    { id: 'cfg', label: 'Control Flow', icon: Settings },
                    { id: 'diff', label: 'Code Diff', icon: FileText },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id as any)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-colors ${
                        activeTab === id
                          ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="bg-white rounded-lg shadow-sm border min-h-[600px]">
                  {activeTab === 'overview' && (
                    <div className="p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Analysis Overview
                      </h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Original Code</h4>
                          <div className="h-48 bg-gray-50 rounded border overflow-hidden">
                            <CodeViewer 
                              code={analysisData.originalCode.slice(0, 1000) + (analysisData.originalCode.length > 1000 ? '...' : '')}
                              readOnly
                            />
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Final Code</h4>
                          <div className="h-48 bg-gray-50 rounded border overflow-hidden">
                            <CodeViewer 
                              code={analysisData.finalCode.slice(0, 1000) + (analysisData.finalCode.length > 1000 ? '...' : '')}
                              readOnly
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6">
                        <h4 className="font-medium text-gray-700 mb-3">Metadata</h4>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                          <div><strong>Version:</strong> {analysisData.metadata.version}</div>
                          <div><strong>Timestamp:</strong> {new Date(analysisData.metadata.timestamp).toLocaleString()}</div>
                          <div><strong>Success:</strong> {analysisData.metadata.success ? '✅' : '❌'}</div>
                          {analysisData.metadata.errors.length > 0 && (
                            <div>
                              <strong>Errors:</strong>
                              <ul className="mt-1 ml-4 list-disc">
                                {analysisData.metadata.errors.map((error, index) => (
                                  <li key={index} className="text-red-600">{error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'cfg' && currentPass?.cfg && (
                    <div className="h-full">
                      <CFGVisualization
                        cfg={currentPass.cfg}
                        settings={vizSettings}
                        onNodeClick={(nodeId) => console.log('Clicked node:', nodeId)}
                      />
                    </div>
                  )}

                  {activeTab === 'diff' && currentPass && (
                    <div className="h-full">
                      <DiffViewer
                        originalCode={previousPass?.codeSnapshot || analysisData.originalCode}
                        modifiedCode={currentPass.codeSnapshot}
                        mode={passState.diffMode}
                      />
                    </div>
                  )}

                  {activeTab === 'passes' && currentPass && (
                    <div className="p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {currentPass.name} Details
                      </h3>
                      
                      {/* Pass metrics */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="text-lg font-semibold text-blue-600">
                            {currentPass.metrics.executionTime}ms
                          </div>
                          <div className="text-sm text-blue-800">Execution Time</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3">
                          <div className="text-lg font-semibold text-red-600">
                            {currentPass.metrics.nodesRemoved}
                          </div>
                          <div className="text-sm text-red-800">Nodes Removed</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-lg font-semibold text-green-600">
                            {currentPass.metrics.nodesAdded}
                          </div>
                          <div className="text-sm text-green-800">Nodes Added</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3">
                          <div className="text-lg font-semibold text-purple-600">
                            {currentPass.metrics.complexity}
                          </div>
                          <div className="text-sm text-purple-800">Complexity</div>
                        </div>
                      </div>

                      {/* Code snapshot */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Code After Pass</h4>
                        <div className="h-96 bg-gray-50 rounded border overflow-hidden">
                          <CodeViewer 
                            code={currentPass.codeSnapshot}
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;