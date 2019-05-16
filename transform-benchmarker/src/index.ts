import compile from '../../ts-closure-transform/compile';
import { resolve, dirname, join, sep, isAbsolute } from 'path';
import { statSync, readdirSync, copyFileSync, fstat, mkdirSync } from 'fs';

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

/**
 * Creates an instrumented version of the Octane benchmark suite.
 * @param configuration The name of the instrumentation tool that is used.
 * @param instrumentFile A function that instruments a file and writes the result to an output file.
 * @returns A function that runs the instrumented version of the Octane benchmark suite.
 */
function instrument_octane(
    configuration: string,
    instrumentFile: (inputPath: string, outputPath: string) => void):
    () => void {

    let sourceRootDir = dirname(require.resolve('benchmark-octane/lib/octane'));
    let destRootDir = resolve(__dirname, `benchmark-octane/${configuration}`);

    function walk(relativePath: string) {
        let sourcePath = resolve(sourceRootDir, relativePath);
        let destPath = resolve(destRootDir, relativePath);
        mkDirByPathSync(destPath);

        for (let name of readdirSync(sourcePath)) {
            let f = statSync(resolve(sourcePath, name));
            if (f.isDirectory()) {
                // Recursively visit directories.
                walk(join(relativePath, name));
            } else if (name.length >= '.js'.length && name.substring(name.length - '.js'.length) == '.js') {
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

    return require(resolve(destRootDir, 'octane.js')).run;
}

let original = instrument_octane("original", (from, to) => {
    copyFileSync(from, to);
});

original();
