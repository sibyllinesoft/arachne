import React from 'react';
import { 
  Play, 
  SkipForward, 
  SkipBack, 
  Pause, 
  BarChart3, 
  Clock, 
  Trash2, 
  Plus, 
  Edit,
  GitBranch,
  Eye,
  EyeOff,
  SplitSquareHorizontal
} from 'lucide-react';
import type { PassExplorerProps } from '@/types/analysis';

const PassExplorer: React.FC<PassExplorerProps> = ({
  passes,
  selectedPass,
  onPassSelect,
  onCFGToggle,
  onDiffToggle
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playInterval, setPlayInterval] = React.useState<NodeJS.Timeout | null>(null);
  const [showCFG, setShowCFG] = React.useState(false);
  const [showDiff, setShowDiff] = React.useState(false);

  // Auto-play functionality
  const startAutoPlay = () => {
    if (isPlaying) {
      stopAutoPlay();
      return;
    }

    setIsPlaying(true);
    const interval = setInterval(() => {
      onPassSelect((current) => {
        const next = current + 1;
        if (next >= passes.length) {
          stopAutoPlay();
          return current;
        }
        return next;
      });
    }, 2000); // 2 seconds per pass

    setPlayInterval(interval);
  };

  const stopAutoPlay = () => {
    setIsPlaying(false);
    if (playInterval) {
      clearInterval(playInterval);
      setPlayInterval(null);
    }
  };

  // Navigation functions
  const goToFirst = () => {
    stopAutoPlay();
    onPassSelect(0);
  };

  const goToPrevious = () => {
    stopAutoPlay();
    onPassSelect(Math.max(0, selectedPass - 1));
  };

  const goToNext = () => {
    stopAutoPlay();
    onPassSelect(Math.min(passes.length - 1, selectedPass + 1));
  };

  const goToLast = () => {
    stopAutoPlay();
    onPassSelect(passes.length - 1);
  };

  const toggleCFG = () => {
    const newState = !showCFG;
    setShowCFG(newState);
    onCFGToggle(newState);
  };

  const toggleDiff = () => {
    const newState = !showDiff;
    setShowDiff(newState);
    onDiffToggle(newState);
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getPassIcon = (passName: string) => {
    if (passName.toLowerCase().includes('constant')) return '🔢';
    if (passName.toLowerCase().includes('dead')) return '💀';
    if (passName.toLowerCase().includes('copy')) return '📋';
    if (passName.toLowerCase().includes('flatten')) return '📏';
    if (passName.toLowerCase().includes('string')) return '📝';
    if (passName.toLowerCase().includes('rename')) return '🏷️';
    if (passName.toLowerCase().includes('opaque')) return '🌫️';
    if (passName.toLowerCase().includes('control')) return '🔀';
    return '⚙️';
  };

  const currentPass = passes[selectedPass];

  return (
    <div className="flex flex-col h-full bg-white border rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-2">
          <GitBranch className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Pass Explorer</h2>
          <span className="text-sm text-gray-500">
            ({selectedPass + 1} of {passes.length})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* View toggles */}
          <button
            onClick={toggleCFG}
            className={`p-2 rounded-md transition-colors ${
              showCFG 
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Toggle CFG View"
          >
            {showCFG ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleDiff}
            className={`p-2 rounded-md transition-colors ${
              showDiff 
                ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Toggle Diff View"
          >
            <SplitSquareHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-2">
          {/* Navigation controls */}
          <button
            onClick={goToFirst}
            disabled={selectedPass === 0}
            className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="First Pass"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={goToPrevious}
            disabled={selectedPass === 0}
            className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous Pass"
          >
            <SkipBack className="w-4 h-4 rotate-180" />
          </button>

          <button
            onClick={startAutoPlay}
            className={`p-2 rounded-md transition-colors ${
              isPlaying 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'bg-green-100 text-green-600 hover:bg-green-200'
            }`}
            title={isPlaying ? 'Stop Auto-Play' : 'Start Auto-Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={goToNext}
            disabled={selectedPass === passes.length - 1}
            className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next Pass"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={goToLast}
            disabled={selectedPass === passes.length - 1}
            className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Last Pass"
          >
            <SkipForward className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex-1 mx-4">
          <div className="relative">
            <div className="w-full h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                style={{
                  width: `${((selectedPass + 1) / passes.length) * 100}%`
                }}
              />
            </div>
            <div className="absolute top-3 left-0 right-0 flex justify-between text-xs text-gray-500">
              <span>Start</span>
              <span>End</span>
            </div>
          </div>
        </div>
      </div>

      {/* Current pass info */}
      {currentPass && (
        <div className="p-4 border-b bg-blue-50">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getPassIcon(currentPass.name)}</span>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                {currentPass.name}
              </h3>
              <div className="flex items-center space-x-6 mt-2 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(currentPass.metrics.executionTime)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  <span>{formatNumber(currentPass.metrics.nodesRemoved)} removed</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Plus className="w-4 h-4 text-green-500" />
                  <span>{formatNumber(currentPass.metrics.nodesAdded)} added</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Edit className="w-4 h-4 text-blue-500" />
                  <span>{formatNumber(currentPass.metrics.nodesModified)} modified</span>
                </div>
                <div className="flex items-center space-x-1">
                  <BarChart3 className="w-4 h-4" />
                  <span>Complexity: {currentPass.metrics.complexity}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pass list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {passes.map((pass, index) => (
            <button
              key={index}
              onClick={() => onPassSelect(index)}
              className={`w-full p-3 mb-2 rounded-lg text-left transition-all hover:bg-gray-50 ${
                index === selectedPass
                  ? 'bg-blue-100 border-2 border-blue-300 shadow-sm'
                  : 'bg-white border border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getPassIcon(pass.name)}</span>
                  <div>
                    <div className="font-medium text-gray-900">
                      {pass.name}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {formatTime(pass.metrics.executionTime)} • 
                      {pass.metrics.nodesRemoved > 0 && (
                        <span className="text-red-500 ml-1">
                          -{pass.metrics.nodesRemoved}
                        </span>
                      )}
                      {pass.metrics.nodesAdded > 0 && (
                        <span className="text-green-500 ml-1">
                          +{pass.metrics.nodesAdded}
                        </span>
                      )}
                      {pass.metrics.nodesModified > 0 && (
                        <span className="text-blue-500 ml-1">
                          ~{pass.metrics.nodesModified}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Impact indicator */}
                <div className="flex flex-col items-end">
                  <div className="text-xs text-gray-500">Impact</div>
                  <div className="flex space-x-1">
                    {Array.from({ length: 5 }, (_, i) => {
                      const impact = pass.metrics.nodesRemoved + pass.metrics.nodesModified;
                      const maxImpact = Math.max(...passes.map(p => p.metrics.nodesRemoved + p.metrics.nodesModified));
                      const normalizedImpact = maxImpact > 0 ? (impact / maxImpact) * 5 : 0;
                      
                      return (
                        <div
                          key={i}
                          className={`w-1 h-3 rounded ${
                            i < normalizedImpact 
                              ? 'bg-blue-400' 
                              : 'bg-gray-200'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Summary footer */}
      <div className="p-4 border-t bg-gray-50">
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="font-medium text-gray-900">
              {formatNumber(passes.reduce((sum, p) => sum + p.metrics.nodesRemoved, 0))}
            </div>
            <div className="text-gray-500">Total Removed</div>
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {formatNumber(passes.reduce((sum, p) => sum + p.metrics.nodesAdded, 0))}
            </div>
            <div className="text-gray-500">Total Added</div>
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {formatNumber(passes.reduce((sum, p) => sum + p.metrics.nodesModified, 0))}
            </div>
            <div className="text-gray-500">Total Modified</div>
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {formatTime(passes.reduce((sum, p) => sum + p.metrics.executionTime, 0))}
            </div>
            <div className="text-gray-500">Total Time</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PassExplorer;