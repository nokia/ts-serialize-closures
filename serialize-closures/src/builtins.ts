import { isPrimitive } from "util";

type BuiltinRecord = {name: string, builtin: any };
type BuiltinList = ReadonlyArray<BuiltinRecord>;

/**
 * A collection of builtins to give special treatment.
 */
export const builtins: BuiltinList = expandBuiltins([
  // This list is based on the list of JavaScript global
  // objects at
  //
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects

  // # Fundamental objects.
  { name: 'Object', builtin: Object },
  { name: 'Function', builtin: Function },
  { name: 'Boolean', builtin: Boolean },
  { name: 'Symbol', builtin: Symbol },
  { name: 'Error', builtin: Error },
  { name: 'EvalError', builtin: EvalError },
  // Apparently V8 doesn't implement InternalError.
  // { name: 'InternalError', builtin: InternalError },
  { name: 'RangeError', builtin: RangeError },
  { name: 'ReferenceError', builtin: ReferenceError },
  { name: 'SyntaxError', builtin: SyntaxError },
  { name: 'TypeError', builtin: TypeError },
  { name: 'URIError', builtin: URIError },

  // # Numbers and dates
  { name: 'Number', builtin: Number },
  { name: 'Math', builtin: Math },
  { name: 'Date', builtin: Date },

  // # Text processing
  { name: 'String', builtin: String },
  { name: 'RegExp', builtin: RegExp },

  // # Indexed collections
  { name: 'Array', builtin: Array },
  { name: 'Int8Array', builtin: Int8Array },
  { name: 'Uint8Array', builtin: Uint8Array },
  { name: 'Uint8ClampedArray', builtin: Uint8ClampedArray },
  { name: 'Int16Array', builtin: Int16Array },
  { name: 'Uint16Array', builtin: Uint16Array },
  { name: 'Int32Array', builtin: Int32Array },
  { name: 'Uint32Array', builtin: Uint32Array },
  { name: 'Float32Array', builtin: Float32Array },
  { name: 'Float64Array', builtin: Float64Array },

  // # Keyed collections
  { name: 'Map', builtin: Map },
  { name: 'Set', builtin: Set },
  { name: 'WeakMap', builtin: WeakMap },
  { name: 'WeakSet', builtin: WeakSet },

  // # Structured data
  { name: 'ArrayBuffer', builtin: ArrayBuffer },
  { name: 'SharedArrayBuffer', builtin: SharedArrayBuffer },
  { name: 'Atomics', builtin: Atomics },
  { name: 'DataView', builtin: DataView },
  { name: 'JSON', builtin: JSON },

  // # Control abstraction objects
  { name: 'Promise', builtin: Promise },
  // The MDN page lists Generator, GeneratorFunction and AsyncFunction
  // as global objects but V8 seems to disagree.
  // { name: 'Generator', builtin: Generator },
  // { name: 'GeneratorFunction', builtin: GeneratorFunction },
  // { name: 'AsyncFunction', builtin: AsyncFunction },

  // # Reflection
  { name: 'Reflect', builtin: Reflect },
  { name: 'Proxy', builtin: Proxy },

  // # Internationalization
  { name: 'Intl', builtin: Intl },
  { name: 'Intl.Collator', builtin: Intl.Collator },
  { name: 'Intl.DateTimeFormat', builtin: Intl.DateTimeFormat },
  { name: 'Intl.NumberFormat', builtin: Intl.NumberFormat },

  // TODO: include WebAssembly? That'd surely be nice, but TypeScript
  // doesn't seem to have type definitions for it by default.

  // # Value properties
  { name: 'Infinity', builtin: Infinity },
  { name: 'NaN', builtin: NaN },

  // # Function properties
  { name: 'eval', builtin: eval },
  { name: 'parseInt', builtin: parseInt },
  { name: 'parseFloat', builtin: parseFloat },
  { name: 'isNaN', builtin: isNaN },
  { name: 'isFinite', builtin: isFinite },
  { name: 'decodeURI', builtin: decodeURI },
  { name: 'decodeURIComponent', builtin: decodeURIComponent },
  { name: 'encodeURI', builtin: encodeURI },
  { name: 'encodeURIComponent', builtin: encodeURIComponent },
  { name: 'escape', builtin: escape },
  { name: 'unescape', builtin: unescape },

  // # Extra addition: console
  { name: 'console', builtin: console }
]);

/**
 * Takes a list of builtins and expands it to include all
 * properties reachable from those builtins.
 * @param roots The root builtins to start searching from.
 */
function expandBuiltins(roots: BuiltinList): BuiltinList {

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
    if (getNameOfBuiltinImpl(record.builtin, results) === undefined) {
      // Builtin does not exist already. Add it to the results.
      results.push(record);
      // Add the builtin's properties to the worklist.
      for (let propName of Object.getOwnPropertyNames(record.builtin)) {
        if (propName === 'callee' || propName === 'caller' || propName === 'arguments') {
          continue;
        } else {
          let desc = Object.getOwnPropertyDescriptor(record.builtin, propName);
          if (desc.value) {
            addToWorklist(record.name, propName, desc.value);
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
 * @returns The builtin if there is a builtin matching the
 * given name; otherwise, `false`.
 */
export function getBuiltinByName(builtinName: string): any {
  for (let { name, builtin } of builtins) {
    if (name === builtinName) {
      return builtin;
    }
  }
  return undefined;
}

function getNameOfBuiltinImpl(value: any, builtinList: BuiltinList): string | undefined {
  for (let { name, builtin } of builtinList) {
    if (value === builtin) {
      return name;
    }
  }
  return undefined;
}

/**
 * Gets the name of a builtin.
 * @param value The builtin to name.
 * @returns The name of `value` if it is a builtin; otherwise, `false`.
 */
export function getNameOfBuiltin(value: any): string | undefined {
  return getNameOfBuiltinImpl(value, builtins);
}
