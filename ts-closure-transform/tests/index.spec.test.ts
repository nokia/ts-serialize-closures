import compile, { COMPILER_CONFIG } from '../compile';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as ts from 'typescript';
import { describe, it, expect } from 'vitest';
import * as url from 'node:url';

// Note to test authors: the test runner is designed to
// extract and compile tests automatically. You don't need
// to define tests manually here.
//
//   * Compilation (input, output checks) are extracted as
//     (*.ts, *.out.js) pairs from the 'fixture' folder.
//     Each *.ts file is compiled to JavaScript (including
//     the ts-serialize-closures transformation) and then
//     the test runner checks that the resulting JavaScript
//     matches the code in the corresponding *.out.js file.
//
//     To add a new test, simply create a new (*.ts, *.out.js)
//     pair in the 'fixture' folder. The test runner will
//     automatically include it.
//
//   * Serialization tests are extracted from the 'serialization'
//     folder. Each *.ts file there is first compiled (with the
//     custom transformation on) and subsequently imported.
//     The compiled serialization test file's exports are treated as
//     unit tests.

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

/**
 * Asserts that a particular source file compiles to
 * a particular output.
 * @param sourceFile The source file to test.
 * @param expectedOutput The source file's expected output.
 */
function assertCompilesTo(sourceFile: string, expectedOutput: string) {
  function writeFileCallback(
    fileName: string,
    data: string,
    writeByteOrderMark: boolean,
    onError: ((message: string) => void) | undefined,
    sourceFiles: ReadonlyArray<ts.SourceFile> | undefined): void {

    let trimmedData = data.trim();
    let trimmedOutput = expectedOutput.trim();

    if (trimmedOutput.length === 0 && trimmedData !== trimmedOutput) {
      // If the output is empty and the data is nonempty, then that's
      // probably an indication that the author of the test hasn't filled
      // out the output file.
      // Let's help them out by printing the expected output before
      // we hit them with the error message.

      console.log(`No expected output provided for ${fileName}. Actual output is:\n`);
      console.log(data);
    }

    expect(trimmedData).toBe(trimmedOutput);
  }

  compile(
    path.resolve(__dirname, `fixture/${sourceFile}`),
    { ...COMPILER_CONFIG, target: ts.ScriptTarget.Latest },
    writeFileCallback,
    false);
}

/**
 * Reads a text file as a string.
 * @param fileName The name of the file to read.
 */
function readTextFile(fileName: string) {
  return fs.readFileSync(path.resolve(__dirname, fileName), { encoding: 'utf8' });
}

/**
 * Gathers pairs of test files. Each pair contains a source file
 * and an output file.
 */
function getTestFilePairs(): { sourceFileName: string, outputFileName: string }[] {
  return getFilesWithExtension('fixture', 'ts').map(path => {
    let outputFileName = path.substring(0, path.length - ".ts".length) + ".out.js";
    return { sourceFileName: path, outputFileName };
  });
}

/**
 * Gets a list of all files in a directory with a particular extension.
 * @param dir The directory to look in.
 * @param ext The extension to look for.
 */
function getFilesWithExtension(dir: string, ext: string): ReadonlyArray<string> {
  return fs.readdirSync(path.resolve(__dirname, dir))
    .filter(path =>
      path.length > ext.length + 1 && path.substring(path.length - ext.length - 1) == "." + ext);
}

describe('Compilation', () => {
  // Compile all test files and make sure they match the expected output.
  for (const { sourceFileName, outputFileName } of getTestFilePairs()) {
    it(sourceFileName, () => {
      assertCompilesTo(sourceFileName, readTextFile(`fixture/${outputFileName}`));
    });
  }
});

describe('Serialization', async () => {
  for (let fileName of getFilesWithExtension('serialization', 'ts')) {
    compile(path.resolve(__dirname, `serialization/${fileName}`), undefined, undefined, false);

    let jsFileName = path.resolve(__dirname, `serialization/${fileName.substring(0, fileName.length - 3)}.js`);
    let compiledModule = await import(jsFileName);
    for (let exportedTestName in compiledModule) {
      let exportedTest = compiledModule[exportedTestName];
      if (exportedTest instanceof Function) {
        it(`${fileName}:${exportedTestName}`, exportedTest);
      }
    }
  }
});
