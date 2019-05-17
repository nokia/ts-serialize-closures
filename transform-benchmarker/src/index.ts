import compile, { CJS_CONFIG } from '../../ts-closure-transform/compile';
import { resolve, dirname, join, sep, isAbsolute } from 'path';
import { statSync, readdirSync, copyFileSync, fstat, mkdirSync, writeFileSync, readFileSync } from 'fs';

// Recursive directory creation logic. Based on Mahmoud Mouneer's answer to
// https://stackoverflow.com/questions/31645738/how-to-create-full-path-with-nodes-fs-mkdirsync
function mkDirByPathSync(targetDir, { isRelativeToScript = false } = {}) {
  const initDir = isAbsolute(targetDir) ? sep : '';
  const baseDir = isRelativeToScript ? __dirname : '.';

  return targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = resolve(baseDir, parentDir, childDir);
    try {
      mkdirSync(curDir);
    } catch (err) {
      if (err.code === 'EEXIST') { // curDir already exists!
        return curDir;
      }

      // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
      if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
        throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
      }

      const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
      if (!caughtErr || caughtErr && curDir === resolve(targetDir)) {
        throw err; // Throw if it's just the last created dir.
      }
    }

    return curDir;
  }, initDir);
}

// Polyfill so we can still target old JS versions.
function endsWith(value: string, suffix: string) {
  return value.indexOf(suffix, value.length - suffix.length) !== -1;
}

// A flag that allows us to exclude the Mandreel benchmark from the
// instrumentation pipeline. Doing so is useful for development because
// Mandreel is a hefty benchmark that takes a long time to process.
const includeMandreel = false;

/**
 * Creates an instrumented version of the Octane benchmark suite.
 * @param configuration The name of the instrumentation tool that is used.
 * @param instrumentFile A function that instruments a file and writes the result to an output file.
 * @returns A function that runs the instrumented version of the Octane benchmark suite.
 */
function instrumentOctane(
  configuration: string,
  instrumentFile: (inputPath: string, outputPath: string) => void):
  () => void {

  let sourceRootDir = dirname(require.resolve('benchmark-octane/lib/octane'));
  let destRootDir = resolve(__dirname, `benchmark-octane/${configuration}`);

  function walk(relativePath: string, ignoreSource: boolean = false) {
    let sourcePath = resolve(sourceRootDir, relativePath);
    let destPath = resolve(destRootDir, relativePath);
    mkDirByPathSync(destPath);

    for (let name of readdirSync(sourcePath)) {
      let f = statSync(resolve(sourcePath, name));
      if (f.isDirectory()) {
        // Recursively visit directories. Do not instrument the files
        // in the JS directory because they appear to trigger a bug in
        // the TypeScript compiler's handling of JSDoc tags. These files
        // aren't part of the benchmark code, so excluding them is harmless.
        walk(join(relativePath, name), ignoreSource || name == 'js');
      } else if (!ignoreSource
          && endsWith(name, '.js')
          && (includeMandreel || name != 'mandreel.js')) {
        // Instrument JavaScript files.
        instrumentFile(
          resolve(sourcePath, name),
          resolve(destPath, name));
      } else {
        // Copy all other files.
        copyFileSync(
          resolve(sourcePath, name),
          resolve(destPath, name));
      }
    }
  }

  walk('.');

  let suite = require(resolve(destRootDir, 'octane.js')).BenchmarkSuite;
  function run() {
    let results = [];
    suite.RunSuites({
      NotifyResult: (name, result) => {
        console.log((name + '                      ').substr(0, 20) + ': ' + result);
        results.push([name, result]);
      },
      NotifyError: (name, error) => {
        console.log((name + '                      ').substr(0, 20) + ': ' + error);
      },
      NotifyScore: (score) => {
        console.log('Score (version ' + suite.version + '): ' + score);
      }
    });

    // Create a results directory.
    let resultsDir = resolve(process.cwd(), 'results');
    mkDirByPathSync(resultsDir);

    // Write the scores to a CSV.
    let scoreHeader = 'benchmark,score\n';
    let scoreCsv = scoreHeader + results.map(pair => pair[0] + ',' + pair[1]).join('\n');
    let scoreFileName = resolve(resultsDir, `${configuration}-scores.csv`);
    writeFileSync(scoreFileName, scoreCsv, { encoding: 'utf8' });

    // Write the files' sizes to a CSV.
    let sizes = [];
    for (let fileName of readdirSync(resolve(destRootDir, 'octane'))) {
      let absPath = resolve(destRootDir, 'octane', fileName);
      let f = statSync(absPath);
      if (!f.isDirectory() && endsWith(fileName, '.js')) {
        sizes.push([
          fileName,
          Buffer.byteLength(readFileSync(absPath))
        ]);
      }
    }
    let sizeHeader = 'benchmark,size\n';
    let sizeCsv = sizeHeader + sizes.map(pair => pair[0] + ',' + pair[1]).join('\n');
    let sizeFileName = resolve(resultsDir, `${configuration}-sizes.csv`);
    writeFileSync(sizeFileName, sizeCsv, { encoding: 'utf8' });
  }

  return run;
}

/**
 * Patches an instrumented 'octane.js' file to export the BenchmarkSuite object.
 * @param code The code to patch.
 */
function exportBenchmarkSuite(code: string) {
  return code.replace(
    'module.exports = {',
    'module.exports = { BenchmarkSuite: BenchmarkSuite,');
}

function instrumentWithTsc(inputFile: string, outputFile: string, transformClosures: boolean) {
  function writeFileCallback(
    fileName: string,
    data: string,
    writeByteOrderMark: boolean,
    onError: (message: string) => void | undefined,
    sourceFiles): void {

    if (transformClosures && endsWith(fileName, 'gbemu-part1.js')) {
      // The Gameboy benchmark is problematic for FlashFreeze because the Gameboy
      // benchmark shares mutable variables across files. Our transform assumes
      // that each file is a separate module, but the Gameboy benchmark breaks
      // that assumption.
      //
      // There's not much that can be done about this at a fundamental level:
      // FlashFreeze's approach really hinges on the module abstraction that the
      // Gameboy benchmark doesn't respect.
      //
      // As a workaround for this specific case, we can replace all references
      // to the 'gameboy' object with 'gameboy.value'.
      data = data
        .replace(/gameboy\./g, 'gameboy.value.')
        .replace('gameboy = null;', 'gameboy.value = null;');
    }
    else if (endsWith(fileName, 'octane.js')) {
      data = exportBenchmarkSuite(data);
    }
    writeFileSync(outputFile, data, { encoding: 'utf8' });
  }

  // Copy the file to a temporary path with a 'ts' suffix.
  let tsCopyPath = outputFile.substring(0, outputFile.length - '.js'.length) + '.ts';
  copyFileSync(inputFile, tsCopyPath);
  // Then feed it to the TypeScript compiler.
  compile(
    tsCopyPath,
    { ...CJS_CONFIG, removeComments: true },
    writeFileCallback,
    false,
    transformClosures);
}

function instrumentWithThingsJS(inputFile: string, outputFile: string) {
  if (endsWith(inputFile, 'base.js')) {
    // Just copy 'base.js'. Instrumenting it will produce a stack overflow
    // because an instrumented base.js will create ThingsJS stack frames in
    // its reimplementation of Math.random. ThingsJS stack frame creation
    // depends on Math.random, hence the stack overflow.
    //
    // This copy shouldn't affect our measurements: 'base.js' is not an
    // actual benchmark. It only contains some benchmark setup infrastructure.
    copyFileSync(inputFile, outputFile);
    return;
  }

  let code: string = require("child_process").spawnSync("things-js", ["inst", inputFile], { encoding: 'utf8' }).stdout;
  // ThingsJS generates code that calls 'require' at the top of the file but then
  // demands that 'require' is called as a property of the big sigma global.
  // This breaks the Octane benchmark, which depends on file inclusion. We will
  // work around this problem by patching the test runner and the tests.
  let remove = "require('things-js/lib/core/Code').bootstrap(module, function (Σ) {";
  if (endsWith(outputFile, 'octane.js')) {
    let add = "require('things-js/lib/core/Code').bootstrap(module, function (Σ) { global.Σ = Σ; ";
    code = add + code.substr(remove.length);
    code = exportBenchmarkSuite(code);
  } else {
    let epilogueIndex = code.lastIndexOf("'mqtt://localhost'");
    let epilogueStartIndex = code.lastIndexOf('\n', epilogueIndex);
    code = code.substr(0, epilogueStartIndex).substr(remove.length);
  }
  writeFileSync(outputFile, code, { encoding: 'utf8' });
}

if (process.argv.length <= 2 || process.argv[2] == 'original') {
  instrumentOctane('original', (from, to) => {
    instrumentWithTsc(from, to, false);
  })();
} else if (process.argv[2] == 'flash-freeze') {
  instrumentOctane('flash-freeze', (from, to) => {
    instrumentWithTsc(from, to, true);
  })();
} else if (process.argv[2] == 'things-js') {
  instrumentOctane('things-js', instrumentWithThingsJS)();
  process.exit(0);
} else {
  console.log(`Unknown configuration '${process.argv[2]}'`);
  process.exit(1);
}
