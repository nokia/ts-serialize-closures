// Based on compile.ts from Kris Zyp's https://github.com/DoctorEvidence/ts-transform-safely,
// licensed under the MIT license.

import * as ts from 'typescript';
import { sync as globSync } from 'glob';
import { beforeTransform, afterTransform } from './src';

export const CJS_CONFIG = {
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  noEmitOnError: false,
  noUnusedLocals: true,
  noUnusedParameters: true,
  stripInternal: true,
  target: ts.ScriptTarget.ES5
};

export default function compile(
  input: string,
  options: ts.CompilerOptions = CJS_CONFIG,
  writeFile?: ts.WriteFileCallback) {

  const files = globSync(input);

  const compilerHost = ts.createCompilerHost(options);
  const program = ts.createProgram(files, options, compilerHost);

  const msgs = {};

  let emitResult = program.emit(undefined, writeFile, undefined, undefined, {
    before: [
      beforeTransform()
    ],
    after: [
      afterTransform()
    ]
  });

  let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

  allDiagnostics.forEach(diagnostic => {
    let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
  });
  return msgs;
}
