/**
 * @fileoverview Dead Code Elimination (DCE) pass
 * 
 * This module implements dead code elimination to remove unreachable code
 * and unused variable definitions based on liveness analysis.
 */

import { DeadCodeEliminationBase } from './base/dead-code-elimination-base.js';

/**
 * Basic dead code elimination pass
 */
export class DeadCodeEliminationPass extends DeadCodeEliminationBase {
  readonly name = 'dead-code-elimination';
  readonly description = 'Remove dead code and unused variables';

  constructor() {
    super({
      removeUnusedVariables: true,
      removeUnreachableCode: true,
      removeEmptyStatements: true,
      removeUnusedFunctions: true,
      aggressiveElimination: false,
      maxIterations: 100
    });
  }
}