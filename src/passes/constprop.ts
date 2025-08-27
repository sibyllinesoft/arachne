/**
 * @fileoverview Constant propagation analysis pass
 * 
 * This module implements constant propagation to replace variables with their
 * constant values and perform compile-time evaluation of constant expressions.
 */

import { ConstantPropagationBase } from './base/constant-propagation-base.js';

/**
 * Basic constant propagation pass
 */
export class ConstantPropagationPass extends ConstantPropagationBase {
  readonly name = 'constant-propagation';
  readonly description = 'Propagate constants and evaluate constant expressions';

  constructor() {
    super({
      confidenceThreshold: 0.9,
      enableArithmeticEvaluation: true,
      enableStringConcatenation: true,
      enableBooleanEvaluation: true,
      maxIterations: 100
    });
  }
}