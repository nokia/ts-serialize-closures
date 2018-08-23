import compile from '../compile';
import { resolve } from 'path';
import { expect } from 'chai';
import * as fs from 'fs';
import * as ts from 'typescript';

// Note to test authors: the test runner is designed to
// extract (*.ts, *.out.js) pairs from the 'fixture'
// folder, compile each *.ts file to JavaScript (including
// the ts-serialize-closures transformation) and then
// test that the resulting JavaScript matches the code in
// the corresponding *.out.js file.
//
// To add a new test, simply create a new (*.ts, *.out.js)
// pair in the 'fixture' folder. The test runner will
// automatically include it.

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
    onError: (message: string) => void | undefined,
    sourceFiles: ReadonlyArray<ts.SourceFile>): void {

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

    expect(trimmedData).to.equal(trimmedOutput);
  }

  compile(resolve(__dirname, `fixture/${sourceFile}`), undefined, writeFileCallback);
}

/**
 * Reads a text file as a string.
 * @param fileName The name of the file to read.
 */
function readTextFile(fileName: string) {
  return fs.readFileSync(resolve(__dirname, fileName), { encoding: 'utf8' });
}

/**
 * Gathers pairs of test files. Each pair contains a source file
 * and an output file.
 */
function getTestFilePairs(): { sourceFileName: string, outputFileName: string }[] {
  let pairs = [];
  for (let path of fs.readdirSync(resolve(__dirname, 'fixture'))) {
    if (path.length > 3 && path.substr(path.length - 3) == ".ts") {
      let outputFileName = path.substring(0, path.length - ".ts".length) + ".out.js";
      pairs.push({ sourceFileName: path, outputFileName });
    }
  }
  return pairs;
}

describe('ts-serialize-closures', () => {
  // Compile all test files and make sure they match the expected output.
  for (let { sourceFileName, outputFileName } of getTestFilePairs()) {
    it(sourceFileName, () => {
      assertCompilesTo(sourceFileName, readTextFile(`fixture/${outputFileName}`));
    });
  }
});
