import { isPrimitive } from "util";

type BuiltinRecord = {name: string, builtin: any };
type BuiltinList = ReadonlyArray<BuiltinRecord>;

/**
 * A collection of builtins to give special treatment.
 */
export const builtins: BuiltinList = expandBuiltins([
  { name: 'Object', builtin: Object },
  { name: 'Math', builtin: Math },
  { name: 'console', builtin: console },
  { name: 'String', builtin: String },
  { name: 'Date', builtin: Date },
  { name: 'Array', builtin: Array },
  { name: 'JSON', builtin: JSON },
  { name: 'Number', builtin: Number },
  { name: 'Boolean', builtin: Boolean },
  { name: 'Function', builtin: Function },
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
  { name: 'Symbol', builtin: Symbol },
  { name: 'RegExp', builtin: RegExp }
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
