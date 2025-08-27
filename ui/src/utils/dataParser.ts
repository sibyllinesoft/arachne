import type { AnalysisData, DataLoader } from '@/types/analysis';

/**
 * Data loader implementation for ArachneJS analysis files
 */
export class AnalysisDataLoader implements DataLoader {
  /**
   * Load analysis data from a file
   */
  async loadFromFile(file: File): Promise<AnalysisData> {
    if (!file.name.endsWith('.json')) {
      throw new Error('Only JSON files are supported');
    }

    const text = await file.text();
    return this.parseAndValidate(text);
  }

  /**
   * Load analysis data from a URL
   */
  async loadFromUrl(url: string): Promise<AnalysisData> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return this.parseAndValidate(text);
  }

  /**
   * Parse and validate JSON data
   */
  private parseAndValidate(jsonText: string): AnalysisData {
    let data: unknown;
    
    try {
      data = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!this.validateData(data)) {
      throw new Error('Invalid analysis data format');
    }

    return data;
  }

  /**
   * Validate that data conforms to AnalysisData interface
   */
  validateData(data: unknown): data is AnalysisData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Check required top-level properties
    const requiredProps = [
      'originalCode',
      'finalCode',
      'passes',
      'cfg',
      'metadata'
    ];

    for (const prop of requiredProps) {
      if (!(prop in obj)) {
        console.error(`Missing required property: ${prop}`);
        return false;
      }
    }

    // Validate types
    if (typeof obj.originalCode !== 'string' || typeof obj.finalCode !== 'string') {
      console.error('originalCode and finalCode must be strings');
      return false;
    }

    if (!Array.isArray(obj.passes)) {
      console.error('passes must be an array');
      return false;
    }

    // Validate metadata
    if (!this.validateMetadata(obj.metadata)) {
      return false;
    }

    // Validate CFG structure
    if (!this.validateCFG(obj.cfg)) {
      return false;
    }

    // Validate passes
    for (let i = 0; i < obj.passes.length; i++) {
      if (!this.validatePassResult(obj.passes[i])) {
        console.error(`Invalid pass result at index ${i}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Validate metadata structure
   */
  private validateMetadata(metadata: unknown): boolean {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    const obj = metadata as Record<string, unknown>;
    const requiredProps = [
      'timestamp',
      'version',
      'inputSize',
      'outputSize',
      'totalPasses',
      'totalExecutionTime',
      'success',
      'errors'
    ];

    for (const prop of requiredProps) {
      if (!(prop in obj)) {
        console.error(`Missing metadata property: ${prop}`);
        return false;
      }
    }

    return typeof obj.timestamp === 'string' &&
           typeof obj.version === 'string' &&
           typeof obj.inputSize === 'number' &&
           typeof obj.outputSize === 'number' &&
           typeof obj.totalPasses === 'number' &&
           typeof obj.totalExecutionTime === 'number' &&
           typeof obj.success === 'boolean' &&
           Array.isArray(obj.errors);
  }

  /**
   * Validate CFG structure
   */
  private validateCFG(cfg: unknown): boolean {
    if (!cfg || typeof cfg !== 'object') {
      return false;
    }

    const obj = cfg as Record<string, unknown>;
    return Array.isArray(obj.nodes) &&
           Array.isArray(obj.edges) &&
           typeof obj.entry === 'string' &&
           typeof obj.exit === 'string';
  }

  /**
   * Validate pass result structure
   */
  private validatePassResult(passResult: unknown): boolean {
    if (!passResult || typeof passResult !== 'object') {
      return false;
    }

    const obj = passResult as Record<string, unknown>;
    const requiredProps = ['name', 'inputIR', 'outputIR', 'metrics', 'codeSnapshot'];

    for (const prop of requiredProps) {
      if (!(prop in obj)) {
        console.error(`Missing pass result property: ${prop}`);
        return false;
      }
    }

    return typeof obj.name === 'string' &&
           Array.isArray(obj.inputIR) &&
           Array.isArray(obj.outputIR) &&
           typeof obj.codeSnapshot === 'string' &&
           this.validatePassMetrics(obj.metrics);
  }

  /**
   * Validate pass metrics structure
   */
  private validatePassMetrics(metrics: unknown): boolean {
    if (!metrics || typeof metrics !== 'object') {
      return false;
    }

    const obj = metrics as Record<string, unknown>;
    const requiredProps = [
      'executionTime',
      'nodesRemoved',
      'nodesAdded',
      'nodesModified',
      'complexity'
    ];

    for (const prop of requiredProps) {
      if (!(prop in obj) || typeof obj[prop] !== 'number') {
        return false;
      }
    }

    return true;
  }
}

/**
 * Utility functions for processing analysis data
 */
export class DataProcessor {
  /**
   * Calculate reduction percentage between original and final code
   */
  static getReductionPercentage(originalSize: number, finalSize: number): number {
    if (originalSize === 0) return 0;
    return Math.round(((originalSize - finalSize) / originalSize) * 100);
  }

  /**
   * Get the most impactful passes based on metrics
   */
  static getMostImpactfulPasses(passes: AnalysisData['passes'], limit = 5) {
    return passes
      .map((pass, index) => ({
        ...pass,
        index,
        impact: pass.metrics.nodesRemoved + pass.metrics.nodesModified
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, limit);
  }

  /**
   * Calculate cumulative metrics across passes
   */
  static getCumulativeMetrics(passes: AnalysisData['passes']) {
    return passes.reduce(
      (acc, pass) => ({
        totalTime: acc.totalTime + pass.metrics.executionTime,
        totalRemoved: acc.totalRemoved + pass.metrics.nodesRemoved,
        totalAdded: acc.totalAdded + pass.metrics.nodesAdded,
        totalModified: acc.totalModified + pass.metrics.nodesModified,
        maxComplexity: Math.max(acc.maxComplexity, pass.metrics.complexity),
      }),
      {
        totalTime: 0,
        totalRemoved: 0,
        totalAdded: 0,
        totalModified: 0,
        maxComplexity: 0,
      }
    );
  }

  /**
   * Extract timeline data for visualization
   */
  static getTimelineData(passes: AnalysisData['passes']) {
    let cumulativeTime = 0;
    return passes.map((pass, index) => {
      cumulativeTime += pass.metrics.executionTime;
      return {
        passIndex: index,
        passName: pass.name,
        executionTime: pass.metrics.executionTime,
        cumulativeTime,
        complexity: pass.metrics.complexity,
        codeSize: pass.codeSnapshot.length,
      };
    });
  }

  /**
   * Generate summary statistics
   */
  static getSummaryStats(data: AnalysisData) {
    const cumulative = this.getCumulativeMetrics(data.passes);
    const reduction = this.getReductionPercentage(
      data.metadata.inputSize,
      data.metadata.outputSize
    );

    return {
      ...cumulative,
      reduction,
      passCount: data.passes.length,
      success: data.metadata.success,
      errorCount: data.metadata.errors.length,
    };
  }
}

/**
 * Export the default data loader instance
 */
export const dataLoader = new AnalysisDataLoader();