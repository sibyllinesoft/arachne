#!/usr/bin/env node

/**
 * @fileoverview Simple deobfuscation example using the shared base class
 * 
 * This replaces the redundant test-deobfuscator.js file and demonstrates
 * how to use the consolidated DeobfuscatorBase class.
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { DeobfuscatorBase } from '../utils/deobfuscator-base.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample input file path
const SAMPLE_FILE = path.join(__dirname, '../../tests/corpus/wild_samples/wild_sample_000_d5099032.js');

/**
 * Simple deobfuscator using the base functionality
 */
class SimpleDeobfuscator extends DeobfuscatorBase {
  constructor() {
    super({
      verbose: true,
      enableConstantFolding: true,
      enableStringArrayDeobfuscation: true,
      enableDeadCodeElimination: false, // Keep simple for this example
      enableFunctionInlining: false
    });
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 ArachneJS Simple Deobfuscation Demo');
    console.log('=====================================\n');

    // Check if sample file exists
    if (!require('fs').existsSync(SAMPLE_FILE)) {
      console.log(`⚠️  Sample file not found: ${SAMPLE_FILE}`);
      console.log('Creating a test obfuscated sample instead...\n');
      
      // Create a simple obfuscated sample
      const testCode = `
        var _0x123abc = 42;
        var hex_def456 = "hello world";
        function _$obfuscated() { return _0x123abc + 1; }
        var result = _$obfuscated();
        console.log(hex_def456, result);
      `;
      
      const deobfuscator = new SimpleDeobfuscator();
      const cleanedCode = deobfuscator.deobfuscate(testCode);
      
      console.log('\n📝 Original Code:');
      console.log(testCode);
      
      console.log('\n✨ Cleaned Code:');
      console.log(cleanedCode);
      
      console.log('\n📊 Deobfuscation completed successfully!');
      return;
    }

    // Read the sample file
    console.log(`📂 Reading sample file: ${SAMPLE_FILE}`);
    const obfuscatedCode = DeobfuscatorBase.readFile(SAMPLE_FILE);
    
    console.log(`📏 Original code length: ${obfuscatedCode.length} characters\n`);

    // Create deobfuscator and process
    const deobfuscator = new SimpleDeobfuscator();
    const cleanedCode = deobfuscator.deobfuscate(obfuscatedCode);
    
    console.log(`📏 Cleaned code length: ${cleanedCode.length} characters`);
    
    // Save output
    const outputPath = path.join(__dirname, '../../output/simple-deobfuscated.js');
    DeobfuscatorBase.writeFile(outputPath, cleanedCode);
    console.log(`💾 Saved cleaned code to: ${outputPath}`);
    
    // Show first few lines of result
    const preview = cleanedCode.split('\n').slice(0, 10).join('\n');
    console.log('\n📝 First 10 lines of cleaned code:');
    console.log('----------------------------------------');
    console.log(preview);
    console.log('----------------------------------------\n');
    
    console.log('✅ Deobfuscation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during deobfuscation:', (error as Error).message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${__filename}`) {
  main();
}

export { SimpleDeobfuscator };