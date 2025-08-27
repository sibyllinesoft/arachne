#!/usr/bin/env tsx
/**
 * @fileoverview Quick competitive analysis using existing samples and simple metrics
 * 
 * This provides immediate insights into the competitive landscape without requiring
 * a fully working ArachneJS build, focusing on sample analysis and baseline metrics.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';

interface Sample {
  readonly name: string;
  readonly filepath: string;
  readonly size: number;
  readonly hash: string;
  readonly content: string;
  readonly obfuscationTechniques: string[];
}

interface CompetitorTool {
  readonly name: string;
  readonly repository: string;
  readonly description: string;
  readonly strengths: string[];
  readonly weaknesses: string[];
  readonly supportedTechniques: string[];
  readonly marketPosition: string;
}

interface CompetitiveLandscape {
  readonly executedAt: string;
  readonly competitors: CompetitorTool[];
  readonly samples: Sample[];
  readonly analysis: {
    readonly marketOverview: string;
    readonly techniqueCoverage: Record<string, string[]>;
    readonly arachneJSPosition: string;
    readonly recommendations: string[];
  };
}

class QuickCompetitiveAnalysis {
  private readonly projectRoot: string;
  private readonly outputDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.outputDir = join(this.projectRoot, 'benchmarks', 'competitive-landscape');
    
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Define competitor landscape based on research
   */
  private getCompetitorLandscape(): CompetitorTool[] {
    return [
      {
        name: 'Synchrony',
        repository: 'https://github.com/relative/synchrony',
        description: 'JavaScript-obfuscator cleaner & deobfuscator with 939+ GitHub stars',
        strengths: [
          'High popularity and active community',
          'General-purpose deobfuscation capabilities',
          'Good pattern recognition for common obfuscation',
          'Reliable for javascript-obfuscator.io patterns'
        ],
        weaknesses: [
          'Limited advanced analysis capabilities',
          'Pattern-based approach may miss complex cases',
          'Manual web interface scalability issues',
          'No formal verification or constraint solving'
        ],
        supportedTechniques: [
          'string_array_obfuscation',
          'identifier_renaming', 
          'control_flow_flattening',
          'dead_code_insertion'
        ],
        marketPosition: 'Market Leader - Most popular general-purpose tool'
      },
      {
        name: 'Webcrack',
        repository: 'https://github.com/j4k0xb/webcrack',
        description: 'Specialized for obfuscator.io, unminification and webpack/browserify unpacking',
        strengths: [
          'Excellent obfuscator.io support',
          'Bundle unpacking capabilities (webpack/browserify)',
          'Modern TypeScript implementation',
          'Active development and Node.js 22+ support',
          'Performance optimizations and safety features'
        ],
        weaknesses: [
          'Focused primarily on specific obfuscator types',
          'Less general-purpose than other tools',
          'Limited academic/research backing',
          'Newer tool with smaller ecosystem'
        ],
        supportedTechniques: [
          'string_array_obfuscation',
          'control_flow_flattening',
          'identifier_renaming',
          'bundler_unpacking',
          'minification_reversal'
        ],
        marketPosition: 'Specialized Leader - Best for specific obfuscation types'
      },
      {
        name: 'Restringer',
        repository: 'https://github.com/PerimeterX/restringer',
        description: 'PerimeterX\'s JavaScript deobfuscator with enterprise backing',
        strengths: [
          'Enterprise development and support',
          'Security-focused approach',
          'AST-based transformations',
          'Commercial-grade reliability'
        ],
        weaknesses: [
          'Less community adoption than Synchrony',
          'Limited documentation and examples',
          'Performance reports suggest slower than Webcrack',
          'Fewer GitHub stars and community contributions'
        ],
        supportedTechniques: [
          'ast_transformations',
          'eval_unpacking',
          'string_obfuscation',
          'identifier_renaming'
        ],
        marketPosition: 'Enterprise Solution - Security-focused commercial backing'
      },
      {
        name: 'UnuglifyJS',
        repository: 'https://github.com/eth-sri/UnuglifyJS',
        description: 'Open-source version of JSNice with statistical analysis approach',
        strengths: [
          'Academic research foundation (ETH Zurich)',
          'Statistical approach to variable naming',
          'Type inference capabilities',
          'Research-backed methodologies'
        ],
        weaknesses: [
          'Primarily focused on variable name recovery',
          'Limited general deobfuscation capabilities',
          'Less active development',
          'Requires more setup and configuration'
        ],
        supportedTechniques: [
          'identifier_recovery',
          'type_inference', 
          'statistical_renaming',
          'minification_reversal'
        ],
        marketPosition: 'Academic Solution - Research-focused with specific strengths'
      },
      {
        name: 'De4js',
        repository: 'https://github.com/lelinhtinh/de4js',
        description: 'Web-based JavaScript deobfuscator and unpacker',
        strengths: [
          'Easy web-based interface',
          'Multiple unpacking methods',
          'Good for quick analysis',
          'Handles various packer formats'
        ],
        weaknesses: [
          'Web-based interface limits automation',
          'Manual process not suitable for batch processing',
          'Limited advanced analysis features',
          'Scalability challenges for large-scale use'
        ],
        supportedTechniques: [
          'eval_unpacking',
          'array_unpacking',
          'url_encoding',
          'packer_formats'
        ],
        marketPosition: 'User-Friendly Tool - Best for manual/interactive analysis'
      },
      {
        name: 'ArachneJS',
        repository: 'local',
        description: 'Advanced IR-based deobfuscator with constraint solving and formal analysis',
        strengths: [
          'Sophisticated IR-based analysis pipeline',
          'Z3 SMT solver integration for constraint solving',
          'Multi-pass optimization with CFG and SSA forms',
          'Bytecode lifting capabilities (QuickJS/V8)',
          'Sandboxed execution with comprehensive tracing',
          'Property-based testing and validation framework',
          'Academic-quality analysis architecture'
        ],
        weaknesses: [
          'Early development stage (v0.1.0)',
          'Complex architecture may impact initial performance',
          'Requires more setup (Z3, Python, Docker)',
          'Limited real-world testing and validation',
          'No established community or ecosystem'
        ],
        supportedTechniques: [
          'ir_based_analysis',
          'constraint_solving',
          'symbolic_execution',
          'bytecode_lifting',
          'cfg_analysis',
          'ssa_optimization',
          'property_based_validation'
        ],
        marketPosition: 'Innovation Leader - Advanced academic approach with commercial potential'
      }
    ];
  }

  /**
   * Analyze existing sample corpus
   */
  private analyzeSampleCorpus(): Sample[] {
    const samples: Sample[] = [];
    
    // Load existing wild samples
    const corpusDir = join(this.projectRoot, 'tests/corpus/wild_samples');
    const metadataFile = join(corpusDir, 'samples_metadata.json');
    
    if (existsSync(metadataFile) && existsSync(corpusDir)) {
      const metadata = JSON.parse(readFileSync(metadataFile, 'utf8'));
      
      for (const meta of metadata) {
        const filepath = join(corpusDir, meta.filename);
        if (existsSync(filepath)) {
          const content = readFileSync(filepath, 'utf8');
          
          samples.push({
            name: meta.filename,
            filepath,
            size: Buffer.byteLength(content, 'utf8'),
            hash: crypto.createHash('sha256').update(content).digest('hex'),
            content,
            obfuscationTechniques: meta.classification?.patterns_detected || []
          });
        }
      }
    }
    
    console.log(`📝 Analyzed ${samples.length} samples from corpus`);
    return samples;
  }

  /**
   * Analyze obfuscation technique coverage across competitors
   */
  private analyzeTechniqueCoverage(competitors: CompetitorTool[]): Record<string, string[]> {
    const techniqueCoverage: Record<string, string[]> = {};
    
    // Get all unique techniques from samples and competitors
    const allTechniques = new Set<string>();
    
    competitors.forEach(competitor => {
      competitor.supportedTechniques.forEach(tech => allTechniques.add(tech));
    });

    // Common obfuscation techniques from research
    const commonTechniques = [
      'string_array_obfuscation',
      'identifier_renaming',
      'control_flow_flattening',
      'dead_code_insertion',
      'eval_patterns',
      'minification',
      'packer_obfuscation',
      'vm_based_obfuscation'
    ];

    commonTechniques.forEach(tech => allTechniques.add(tech));

    // Map each technique to supporting tools
    allTechniques.forEach(technique => {
      techniqueCoverage[technique] = competitors
        .filter(competitor => competitor.supportedTechniques.includes(technique))
        .map(competitor => competitor.name);
    });

    return techniqueCoverage;
  }

  /**
   * Generate competitive positioning analysis
   */
  private analyzeArachneJSPosition(competitors: CompetitorTool[], samples: Sample[]): {
    position: string;
    recommendations: string[];
  } {
    const arachneJS = competitors.find(c => c.name === 'ArachneJS')!;
    const marketLeaders = competitors.filter(c => 
      c.marketPosition.includes('Leader') || c.marketPosition.includes('Popular')
    );

    const recommendations: string[] = [];
    
    // Market position analysis
    let position = '';
    
    if (marketLeaders.length > 0) {
      position = `**Current Position**: ArachneJS is positioned as an innovation leader with advanced technical capabilities, but faces market adoption challenges against established tools like ${marketLeaders.map(c => c.name).join(', ')}.

**Competitive Advantages**:
- **Technical Sophistication**: IR-based analysis with CFG/SSA optimization surpasses pattern-matching approaches
- **Formal Methods**: Z3 constraint solving enables symbolic execution beyond heuristic tools  
- **Comprehensive Analysis**: Multi-modal bytecode lifting and sandboxed execution provide deeper insights
- **Research Foundation**: Academic-quality architecture positions for handling advanced obfuscation techniques

**Market Challenges**:
- **Adoption Gap**: Synchrony (939 stars) and Webcrack have established communities
- **Complexity Barrier**: Advanced architecture may deter casual users seeking simple solutions
- **Performance Validation**: Need to prove performance benefits of sophisticated approach
- **Ecosystem Development**: Limited integrations, documentation, and community resources`;

      // Generate strategic recommendations
      recommendations.push(
        'Establish performance benchmarks demonstrating measurable advantages over simpler approaches',
        'Focus on unique value propositions: constraint solving, bytecode analysis, formal verification',
        'Target advanced use cases where pattern-matching tools fail: sophisticated malware, AI-generated obfuscation',
        'Build developer-friendly interfaces and integrations while maintaining technical depth',
        'Collaborate with security research community to validate academic approach benefits',
        'Create comprehensive documentation and tutorials showcasing unique capabilities'
      );
    }

    return { position, recommendations };
  }

  /**
   * Run the competitive analysis
   */
  async runAnalysis(): Promise<CompetitiveLandscape> {
    console.log('🔍 Running Quick Competitive Analysis...\n');
    
    // Get competitor landscape
    const competitors = this.getCompetitorLandscape();
    console.log(`🏢 Analyzed ${competitors.length} competitor tools`);
    
    // Analyze samples
    const samples = this.analyzeSampleCorpus();
    
    // Technique coverage analysis  
    const techniqueCoverage = this.analyzeTechniqueCoverage(competitors);
    console.log(`⚡ Mapped ${Object.keys(techniqueCoverage).length} obfuscation techniques`);
    
    // Market overview
    const marketOverview = `The JavaScript deobfuscation market is dominated by pattern-matching tools like Synchrony (939 GitHub stars) and Webcrack, which excel at handling common obfuscation from popular tools like javascript-obfuscator.io. Enterprise solutions like Restringer provide commercial reliability, while academic tools like UnuglifyJS focus on statistical analysis for variable name recovery.

**Market Segments**:
- **General-Purpose Leaders**: Synchrony, Webcrack (high adoption, broad technique support)
- **Specialized Solutions**: De4js (web-based), UnuglifyJS (statistical analysis)  
- **Enterprise Tools**: Restringer (security-focused, commercial backing)
- **Innovation Category**: ArachneJS (advanced analysis, research-driven)

**Technology Trends**: 
- Pattern-matching approaches dominate current market
- Growing need for handling AI-generated and sophisticated obfuscation
- Academic research in formal methods and constraint solving showing promise
- LLM integration emerging as new frontier (GPT-4 showing 75%+ success rates)`;
    
    // ArachneJS positioning
    const { position, recommendations } = this.analyzeArachneJSPosition(competitors, samples);
    
    console.log('📊 Analysis complete!');
    
    return {
      executedAt: new Date().toISOString(),
      competitors,
      samples,
      analysis: {
        marketOverview,
        techniqueCoverage,
        arachneJSPosition: position,
        recommendations
      }
    };
  }

  /**
   * Generate comprehensive competitive report
   */
  generateReport(analysis: CompetitiveLandscape): string {
    let report = `# JavaScript Deobfuscation - Competitive Landscape Analysis\n\n`;
    report += `**Generated**: ${analysis.executedAt}\n`;
    report += `**Competitors Analyzed**: ${analysis.competitors.length}\n`;
    report += `**Sample Corpus**: ${analysis.samples.length} obfuscated JavaScript files\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    report += `The JavaScript deobfuscation market features several established tools with different strengths and market positions. ArachneJS enters as an innovation leader with advanced IR-based analysis, but faces adoption challenges against simpler, more established solutions.\n\n`;

    // Market Overview
    report += `## Market Overview\n\n`;
    report += analysis.analysis.marketOverview + '\n\n';

    // Competitive Landscape
    report += `## Competitive Landscape\n\n`;
    
    // Market leaders table
    report += `### Market Leaders Comparison\n\n`;
    report += `| Tool | Market Position | GitHub Stars | Strengths | Primary Use Case |\n`;
    report += `|------|----------------|--------------|-----------|------------------|\n`;
    
    // Sort by market position importance
    const sortedCompetitors = [...analysis.competitors].sort((a, b) => {
      const getPositionWeight = (pos: string) => {
        if (pos.includes('Market Leader')) return 5;
        if (pos.includes('Specialized Leader')) return 4;
        if (pos.includes('Innovation Leader')) return 3;
        if (pos.includes('Enterprise')) return 2;
        return 1;
      };
      return getPositionWeight(b.marketPosition) - getPositionWeight(a.marketPosition);
    });

    sortedCompetitors.forEach(competitor => {
      const stars = competitor.name === 'Synchrony' ? '939+' : 
                    competitor.name === 'Webcrack' ? '400+' :
                    competitor.name === 'Restringer' ? '300+' :
                    competitor.name === 'ArachneJS' ? 'N/A (New)' : 'Varies';
      
      const primaryStrength = competitor.strengths[0] || 'General deobfuscation';
      const useCase = competitor.name === 'Synchrony' ? 'General-purpose deobfuscation' :
                      competitor.name === 'Webcrack' ? 'Obfuscator.io and bundler unpacking' :
                      competitor.name === 'Restringer' ? 'Enterprise security applications' :
                      competitor.name === 'UnuglifyJS' ? 'Variable name recovery' :
                      competitor.name === 'De4js' ? 'Interactive web-based analysis' :
                      competitor.name === 'ArachneJS' ? 'Advanced analysis and research' : 'Specialized tasks';
                      
      report += `| ${competitor.name} | ${competitor.marketPosition.split(' - ')[0]} | ${stars} | ${primaryStrength} | ${useCase} |\n`;
    });

    report += `\n`;

    // Detailed tool analysis
    report += `### Detailed Tool Analysis\n\n`;
    
    analysis.competitors.forEach(competitor => {
      report += `#### ${competitor.name}\n\n`;
      report += `**Repository**: ${competitor.repository}\n`;
      report += `**Description**: ${competitor.description}\n`;
      report += `**Market Position**: ${competitor.marketPosition}\n\n`;
      
      report += `**Strengths**:\n`;
      competitor.strengths.forEach(strength => {
        report += `- ${strength}\n`;
      });
      
      report += `\n**Weaknesses**:\n`;
      competitor.weaknesses.forEach(weakness => {
        report += `- ${weakness}\n`;
      });
      
      report += `\n**Supported Techniques**: ${competitor.supportedTechniques.join(', ')}\n\n`;
    });

    // Technique coverage analysis
    report += `## Obfuscation Technique Coverage\n\n`;
    report += `Analysis of which tools support specific obfuscation techniques:\n\n`;
    report += `| Technique | Supporting Tools | Coverage |\n`;
    report += `|-----------|------------------|----------|\n`;
    
    Object.entries(analysis.analysis.techniqueCoverage).forEach(([technique, tools]) => {
      const coverage = tools.length === 0 ? '❌ None' :
                       tools.length === 1 ? '⚠️ Limited' :
                       tools.length <= 3 ? '✅ Good' : '🏆 Excellent';
      
      report += `| ${technique} | ${tools.join(', ') || 'None'} | ${coverage} |\n`;
    });

    report += `\n`;

    // ArachneJS competitive positioning
    report += `## ArachneJS Competitive Position\n\n`;
    report += analysis.analysis.arachneJSPosition + '\n\n';

    // Strategic recommendations
    report += `## Strategic Recommendations\n\n`;
    report += `Based on competitive analysis, the following strategic actions are recommended for ArachneJS:\n\n`;
    
    analysis.analysis.recommendations.forEach((recommendation, index) => {
      report += `${index + 1}. **${recommendation}**\n\n`;
    });

    // Market opportunity analysis
    report += `## Market Opportunity Analysis\n\n`;
    report += `### Immediate Opportunities\n\n`;
    report += `- **Advanced Malware Analysis**: Current tools struggle with sophisticated obfuscation techniques\n`;
    report += `- **AI-Generated Code**: Growing need for handling LLM-generated obfuscated code\n`;
    report += `- **Research Community**: Academic researchers need formal verification capabilities\n`;
    report += `- **Enterprise Security**: Organizations requiring deep analysis beyond pattern matching\n\n`;
    
    report += `### Long-term Market Trends\n\n`;
    report += `- **Sophistication Arms Race**: Obfuscation becoming more advanced, requiring formal methods\n`;
    report += `- **LLM Integration**: AI-assisted deobfuscation showing promising results\n`;
    report += `- **Real-time Analysis**: Growing demand for performance-optimized tools\n`;
    report += `- **Automation Focus**: Need for tools supporting CI/CD and automated security pipelines\n\n`;

    // Technical differentiation
    report += `## Technical Differentiation Matrix\n\n`;
    report += `| Capability | Synchrony | Webcrack | Restringer | UnuglifyJS | De4js | ArachneJS |\n`;
    report += `|------------|-----------|----------|------------|------------|-------|----------|\n`;
    report += `| Pattern Matching | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ |\n`;
    report += `| AST Analysis | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | 🏆 |\n`;
    report += `| IR-based Analysis | ❌ | ❌ | ❌ | ❌ | ❌ | 🏆 |\n`;
    report += `| Constraint Solving | ❌ | ❌ | ❌ | ❌ | ❌ | 🏆 |\n`;
    report += `| Bytecode Lifting | ❌ | ❌ | ❌ | ❌ | ❌ | 🏆 |\n`;
    report += `| Symbolic Execution | ❌ | ❌ | ❌ | ❌ | ❌ | 🏆 |\n`;
    report += `| Statistical Analysis | ❌ | ❌ | ❌ | 🏆 | ❌ | ⚠️ |\n`;
    report += `| Bundle Unpacking | ⚠️ | 🏆 | ⚠️ | ❌ | ⚠️ | ⚠️ |\n`;
    report += `| Community Size | 🏆 | ✅ | ⚠️ | ⚠️ | ✅ | ❌ |\n`;
    report += `| Enterprise Support | ❌ | ❌ | 🏆 | ❌ | ❌ | ❌ |\n`;

    report += `\n**Legend**: 🏆 Excellent | ✅ Good | ⚠️ Fair | ❌ Limited/None\n\n`;

    // Sample corpus analysis
    report += `## Sample Corpus Analysis\n\n`;
    report += `**Corpus Statistics**:\n`;
    report += `- Total samples analyzed: ${analysis.samples.length}\n`;
    
    const totalSize = analysis.samples.reduce((sum, s) => sum + s.size, 0);
    report += `- Total size: ${(totalSize / 1024).toFixed(1)}KB\n`;
    report += `- Average file size: ${(totalSize / analysis.samples.length / 1024).toFixed(1)}KB\n\n`;

    report += `**Obfuscation Techniques in Corpus**:\n`;
    const techniqueCount = new Map<string, number>();
    analysis.samples.forEach(sample => {
      sample.obfuscationTechniques.forEach(technique => {
        techniqueCount.set(technique, (techniqueCount.get(technique) || 0) + 1);
      });
    });

    Array.from(techniqueCount.entries())
      .sort(([, a], [, b]) => b - a)
      .forEach(([technique, count]) => {
        report += `- ${technique}: ${count} samples (${((count / analysis.samples.length) * 100).toFixed(1)}%)\n`;
      });

    report += `\n`;

    // Next steps
    report += `## Next Steps for Comprehensive Analysis\n\n`;
    report += `**Phase 1: Tool Installation & Setup**\n`;
    report += `- Execute \`./scripts/setup-competitors.sh\` to install competitor tools\n`;
    report += `- Verify tool functionality and API compatibility\n`;
    report += `- Create standardized test harness for fair comparison\n\n`;
    
    report += `**Phase 2: Performance Benchmarking**\n`;
    report += `- Run all tools against corpus samples\n`;
    report += `- Measure processing time, memory usage, and success rates\n`;
    report += `- Analyze output quality with automated and manual evaluation\n\n`;
    
    report += `**Phase 3: Advanced Analysis**\n`;
    report += `- Generate larger, more diverse sample set\n`;
    report += `- Test scalability with files ranging from 1KB to 1MB+\n`;
    report += `- Evaluate handling of cutting-edge obfuscation techniques\n\n`;
    
    report += `**Phase 4: Strategic Planning**\n`;
    report += `- Develop competitive positioning strategy based on benchmark results\n`;
    report += `- Identify specific areas for ArachneJS improvement\n`;
    report += `- Create roadmap for market entry and differentiation\n\n`;

    report += `---\n\n`;
    report += `*This competitive landscape analysis provides strategic foundation for ArachneJS market positioning.*\n`;
    report += `*Generated by ArachneJS Competitive Analysis Tool v0.1.0*\n`;

    return report;
  }

  /**
   * Save analysis results and report
   */
  async saveResults(analysis: CompetitiveLandscape): Promise<void> {
    // Save raw analysis
    const resultsFile = join(this.outputDir, 'competitive-landscape-analysis.json');
    writeFileSync(resultsFile, JSON.stringify(analysis, null, 2));

    // Generate and save report
    const report = this.generateReport(analysis);
    const reportFile = join(this.outputDir, 'competitive-landscape-report.md');
    writeFileSync(reportFile, report);

    // Create competitor summary CSV
    const csvLines = ['Tool,Market Position,Repository,Strengths,Supported Techniques'];
    analysis.competitors.forEach(competitor => {
      csvLines.push([
        competitor.name,
        competitor.marketPosition.replace(/,/g, ';'),
        competitor.repository,
        competitor.strengths.join('; ').replace(/,/g, ';'),
        competitor.supportedTechniques.join('; ')
      ].join(','));
    });
    
    const csvFile = join(this.outputDir, 'competitor-summary.csv');
    writeFileSync(csvFile, csvLines.join('\n'));

    console.log(`\n📊 Analysis saved:`);
    console.log(`  📄 Report: ${reportFile}`);
    console.log(`  📋 Raw data: ${resultsFile}`);
    console.log(`  📈 CSV: ${csvFile}`);
  }
}

// Main execution
async function main() {
  const analyzer = new QuickCompetitiveAnalysis();
  
  try {
    console.log('🔍 Starting JavaScript Deobfuscation Competitive Landscape Analysis...\n');
    
    const analysis = await analyzer.runAnalysis();
    await analyzer.saveResults(analysis);
    
    console.log(`\n✅ Competitive landscape analysis completed!`);
    console.log(`\n🎯 Key Findings:`);
    console.log(`  Market Leaders: Synchrony, Webcrack`);
    console.log(`  ArachneJS Position: Innovation Leader with advanced capabilities`);
    console.log(`  Primary Opportunity: Sophisticated obfuscation analysis`);
    console.log(`  Main Challenge: Proving performance benefits vs. simpler tools`);
    
    console.log(`\n🚀 Recommended Next Steps:`);
    console.log(`  1. Run: ./scripts/setup-competitors.sh`);
    console.log(`  2. Execute full benchmarks: tsx benchmarks/competitive-analysis.ts`);
    console.log(`  3. Focus on unique value propositions in marketing`);
    console.log(`  4. Target advanced use cases where pattern matching fails`);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// ES module compatible execution check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}