import { isPrimitive } from "util";

/**
 * A record for a single builtin in a list of builtins.
 */
export type BuiltinRecord = { name: string, builtin: any };

/**
 * A read-only list of builtins.
 */
export type BuiltinList = ReadonlyArray<BuiltinRecord>;

/**
 * A list of all global JavaScript objects.
 */
export const rootBuiltinNames: ReadonlyArray<string> = [
  // This list is based on the list of JavaScript global
  // objects at
  //
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects

  'Object',
  'Function',
  'Boolean',
  'Symbol',
  'Error',
  'EvalError',
  'InternalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',

  // # Numbers and dates
  'Number',
  'BigInt',
  'Math',
  'Date',

  // # Text processing
  'String',
  'RegExp',

  // # Indexed collections
  'Array',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',

  // # Keyed collections
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',

  // # Structured data
  'ArrayBuffer',
  'SharedArrayBuffer',
  'Atomics',
  'DataView',
  'JSON',

  // # Control abstraction objects
  'Promise',
  'Generator',
  'GeneratorFunction',
  'AsyncFunction',

  // # Reflection
  'Reflect',
  'Proxy',

  // # Internationalization
  'Intl',

  // # WebAssembly
  'WebAssembly',

  // # Value properties
  'Infinity',
  'NaN',

  // # Function properties
  'eval',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'unescape',

  // # Extra additions: partial window / WorkerGlobalScope builtins
  'console',
  'clearInterval',
  'clearTimeout',
  'queueMicrotask',
  'setInterval',
  'setTimeout'
];

/**
 * A default collection of builtins to give special treatment.
 */
export const defaultBuiltins: BuiltinList = generateDefaultBuiltins();

/**
 * Generates the default collection of builtins in the current context.
 * This may differ from the value in `defaultBuiltins` if this function
 * is called from a different VM context or if a different `evalImpl`
 * function is specified.
 * @param rootNames A list of root builtin names.
 * If not specified, `rootBuiltinNames` is assumed.
 * @param evalImpl A custom `eval` function to use.
 */
export function generateDefaultBuiltins(
  rootNames?: ReadonlyArray<string>,
  evalImpl?: (code: string) => any): BuiltinList {

  evalImpl = evalImpl || eval;
  rootNames = rootNames || rootBuiltinNames;
  return expandBuiltins(
    rootNames
      .filter(name => evalImpl(`typeof ${name}`) !== 'undefined')
      .map(name => ({ name, builtin: evalImpl(name) })));
}

/**
 * Takes a list of root builtins and expands it to include all
 * properties reachable from those builtins.
 * @param roots The root builtins to start searching from.
 */
export function expandBuiltins(roots: BuiltinList): BuiltinList {

  let results: BuiltinRecord[] = [];
  let worklist: BuiltinRecord[] = [];
  worklist.push(...roots);

  function addToWorklist(baseName, propertyName, builtin) {
    if (!isPrimitive(builtin)) {
      worklist.push({
        name: `${baseName}.${propertyName}`,
        builtin
      });
    }
  }

  while (worklist.length > 0) {
    let record = worklist.shift();
    if (getNameOfBuiltin(record.builtin, results) === undefined) {
      // Builtin does not exist already. Add it to the results.
      results.push(record);
      // Add the builtin's properties to the worklist.
      for (let propName of Object.getOwnPropertyNames(record.builtin)) {
        if (propName === 'callee' || propName === 'caller' || propName === 'arguments') {
          continue;
        } else {
          try {
            let desc = Object.getOwnPropertyDescriptor(record.builtin, propName);
            if (desc.value) {
              addToWorklist(record.name, propName, desc.value);
            }
          } catch (e) {
            // Ignore inaccessible methods in Node <10, e.g. TypeError: Method bytesRead called on incompatible receiver #<Pipe>
          }
        }
      }
      // Add the builtin's prototype to the worklist.
      addToWorklist(record.name, '__proto__', Object.getPrototypeOf(record.builtin));
      addToWorklist(record.name, 'prototype', record.builtin.prototype);
    }
  }
  return results;
}

/**
 * Gets a builtin by name.
 * @param builtinName The name of the builtin to look for.
 * @param builtinList An optional list of builtins to search through.
 * If defined, `builtinList` is used instead of the default builtins.
 * @returns The builtin if there is a builtin matching the
 * given name; otherwise, `false`.
 */
export function getBuiltinByName(builtinName: string, builtinList?: BuiltinList): any {
  builtinList = builtinList || defaultBuiltins;
  for (let { name, builtin } of builtinList) {
    if (name === builtinName) {
      return builtin;
    }
  }
  return undefined;
}

/**
 * Gets the name of a builtin.
 * @param value The builtin to name.
 * @param builtinList An optional list of builtins to search through.
 * If defined, `builtinList` is used instead of the default builtins.
 * @returns The name of `value` if it is a builtin; otherwise, `undefined`.
 */
export function getNameOfBuiltin(value: any, builtinList?: BuiltinList): string | undefined {
  builtinList = builtinList || defaultBuiltins;
  for (let { name, builtin } of builtinList) {
    if (value === builtin) {
      return name;
    }
  }
  return undefined;
}
