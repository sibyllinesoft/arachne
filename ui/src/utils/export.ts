import type { AnalysisData, ExportOptions, ExportResult } from '@/types/analysis';

/**
 * Export utilities for analysis data
 */
export class ExportManager {
  /**
   * Export analysis data in various formats
   */
  static async exportData(
    data: AnalysisData, 
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      switch (options.format) {
        case 'json':
          return this.exportAsJSON(data, options);
        case 'html':
          return this.exportAsHTML(data, options);
        case 'pdf':
          return this.exportAsPDF(data, options);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  /**
   * Export as JSON file
   */
  private static exportAsJSON(data: AnalysisData, options: ExportOptions): ExportResult {
    const exportData = this.filterDataForExport(data, options);
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    return {
      success: true,
      data: blob
    };
  }

  /**
   * Export as HTML report
   */
  private static exportAsHTML(data: AnalysisData, options: ExportOptions): ExportResult {
    const html = this.generateHTMLReport(data, options);
    const blob = new Blob([html], { type: 'text/html' });
    
    return {
      success: true,
      data: blob
    };
  }

  /**
   * Export as PDF (placeholder - would need PDF generation library)
   */
  private static exportAsPDF(data: AnalysisData, options: ExportOptions): ExportResult {
    // This would typically use a library like jsPDF or Puppeteer
    throw new Error('PDF export not yet implemented');
  }

  /**
   * Filter data based on export options
   */
  private static filterDataForExport(data: AnalysisData, options: ExportOptions): Partial<AnalysisData> {
    const result: Partial<AnalysisData> = {
      metadata: data.metadata
    };

    if (options.includeCode) {
      result.originalCode = data.originalCode;
      result.finalCode = data.finalCode;
      result.passes = data.passes;
    }

    if (options.includeCFG && data.cfg) {
      result.cfg = data.cfg;
    }

    if (options.includeMetrics && data.passes) {
      result.passes = data.passes.map(pass => ({
        ...pass,
        // Only include metrics, not full IR data for size optimization
        inputIR: options.includeCode ? pass.inputIR : [],
        outputIR: options.includeCode ? pass.outputIR : [],
      }));
    }

    return result;
  }

  /**
   * Generate HTML report
   */
  private static generateHTMLReport(data: AnalysisData, options: ExportOptions): string {
    const summaryStats = this.calculateSummaryStats(data);
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ArachneJS Analysis Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 10px;
            margin-bottom: 2rem;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #667eea;
        }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            font-size: 0.9rem;
        }
        .pass-list {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .pass-item {
            padding: 1rem;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .pass-item:last-child {
            border-bottom: none;
        }
        .pass-name {
            font-weight: 600;
            color: #333;
        }
        .pass-metrics {
            display: flex;
            gap: 1rem;
            font-size: 0.85rem;
            color: #666;
        }
        .metric {
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        .code-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
        }
        pre {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 1rem;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 0.85rem;
        }
        .section {
            margin-bottom: 3rem;
        }
        h2 {
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 0.5rem;
        }
        @media print {
            body { max-width: none; margin: 0; }
            .header { background: #667eea !important; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ArachneJS Analysis Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Analysis Version: ${data.metadata.version}</p>
    </div>

    <div class="section">
        <h2>Summary Statistics</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${summaryStats.reduction}%</div>
                <div class="stat-label">Size Reduction</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summaryStats.passCount}</div>
                <div class="stat-label">Passes Executed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${(summaryStats.totalTime / 1000).toFixed(2)}s</div>
                <div class="stat-label">Total Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summaryStats.totalRemoved.toLocaleString()}</div>
                <div class="stat-label">Nodes Removed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summaryStats.success ? '✅' : '❌'}</div>
                <div class="stat-label">Success</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Pass Details</h2>
        <div class="pass-list">
            ${data.passes.map((pass, index) => `
                <div class="pass-item">
                    <div>
                        <div class="pass-name">${pass.name}</div>
                        <div class="pass-metrics">
                            <div class="metric">⏱️ ${pass.metrics.executionTime}ms</div>
                            <div class="metric">🗑️ ${pass.metrics.nodesRemoved}</div>
                            <div class="metric">➕ ${pass.metrics.nodesAdded}</div>
                            <div class="metric">✏️ ${pass.metrics.nodesModified}</div>
                            <div class="metric">📊 ${pass.metrics.complexity}</div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>

    ${options.includeCode ? `
        <div class="section">
            <h2>Original Code</h2>
            <div class="code-section">
                <pre><code>${this.escapeHtml(data.originalCode.slice(0, 2000))}${data.originalCode.length > 2000 ? '\n...(truncated)' : ''}</code></pre>
            </div>
        </div>

        <div class="section">
            <h2>Deobfuscated Code</h2>
            <div class="code-section">
                <pre><code>${this.escapeHtml(data.finalCode.slice(0, 2000))}${data.finalCode.length > 2000 ? '\n...(truncated)' : ''}</code></pre>
            </div>
        </div>
    ` : ''}

    ${data.metadata.errors.length > 0 ? `
        <div class="section">
            <h2>Errors & Warnings</h2>
            <div class="code-section">
                ${data.metadata.errors.map(error => `<p style="color: #dc2626;">❌ ${this.escapeHtml(error)}</p>`).join('')}
            </div>
        </div>
    ` : ''}
</body>
</html>`;
  }

  /**
   * Calculate summary statistics
   */
  private static calculateSummaryStats(data: AnalysisData) {
    const reduction = Math.round(((data.metadata.inputSize - data.metadata.outputSize) / data.metadata.inputSize) * 100);
    const totalTime = data.passes.reduce((sum, pass) => sum + pass.metrics.executionTime, 0);
    const totalRemoved = data.passes.reduce((sum, pass) => sum + pass.metrics.nodesRemoved, 0);
    const maxComplexity = Math.max(...data.passes.map(pass => pass.metrics.complexity));

    return {
      reduction: isNaN(reduction) ? 0 : reduction,
      passCount: data.passes.length,
      totalTime,
      totalRemoved,
      maxComplexity,
      success: data.metadata.success
    };
  }

  /**
   * Escape HTML characters
   */
  private static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Download a blob as a file
   */
  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate filename based on analysis metadata
   */
  static generateFilename(data: AnalysisData, format: string): string {
    const timestamp = new Date(data.metadata.timestamp).toISOString().slice(0, 19).replace(/[:.]/g, '-');
    return `arachne-analysis-${timestamp}.${format}`;
  }
}