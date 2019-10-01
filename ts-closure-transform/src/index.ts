import { default as closureTransform } from './transform';
import { default as flattenImports } from './flatten-destructured-imports';
import { default as boxMutableSharedVariables } from './box-mutable-captured-vars';
import { default as hoistFunctions } from './hoist-functions';
import * as ts from 'typescript';

type Transform = (ctx: ts.TransformationContext) => ts.Transformer<ts.SourceFile>;

/**
 * Takes a list of transforms and turns it into a transform pipeline.
 */
function createPipeline(transforms: ReadonlyArray<Transform>): Transform {
  if (transforms.length == 1) {
    return transforms[0];
  }

  return ctx => {
    // Compose a pipeline of transforms.
    let pipeline = transforms.map(t => t(ctx));

    // Apply each element of the pipeline to each source file.
    return node => {
      let result = node;
      for (let elem of pipeline) {
        result = elem(result);
      }
      return result;
    }
  };
}

/**
 * Creates the 'before' part of the closure serialization transform.
 */
export function beforeTransform(): Transform {
  return flattenImports();
}

/**
 * Creates the 'after' part of the closure serialization transform.
 */
export function afterTransform(): Transform {
  return createPipeline([
    hoistFunctions(),
    boxMutableSharedVariables(),
    closureTransform()
  ]);
}
