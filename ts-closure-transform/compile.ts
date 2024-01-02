// Based on compile.ts from Kris Zyp's https://github.com/DoctorEvidence/ts-transform-safely,
// licensed under the MIT license.

// MIT License

// Copyright (c) 2017 Kris Zyp

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

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
  noImplicitUseStrict: true,
  target: ts.ScriptTarget.ES5
};

export default function compile(
  input: string,
  options: ts.CompilerOptions = CJS_CONFIG,
  writeFile?: ts.WriteFileCallback,
  printDiagnostics: boolean = true,
  transformClosures: boolean = true) {

  const files = globSync(input);

  const compilerHost = ts.createCompilerHost(options);
  const program = ts.createProgram(files, options, compilerHost);

  const msgs = {};

  let transformers = transformClosures
    ? { before: [beforeTransform()], after: [afterTransform()] }
    : undefined;

  let emitResult = program.emit(undefined, writeFile, undefined, undefined, transformers);

  if (printDiagnostics) {
    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

    allDiagnostics.forEach(diagnostic => {
      let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (diagnostic.file) {
        let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
        console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
      } else {
        console.log(`${message}`);
      }
    });
  }

  return msgs;
}
