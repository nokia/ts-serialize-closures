import { types } from "util";
import { getNameOfBuiltin, getBuiltinByName, BuiltinList, defaultBuiltins, generateDefaultBuiltins } from "./builtins";
import { retrieveCustomSerializer, CustomSerializerList, retrieveCustomDeserializer, CustomDeserializerList } from "./customs";

export interface ValueFlags {
  accessor?: "get" | "set"
};

/**
 * Represents a graph of serialized values.
 */
export class SerializedGraph {
  private indexMap: { element: any, index: number }[];
  private rootIndex: number;
  private contentArray: any[];
  private builtins: BuiltinList;
  private customSerializers: CustomSerializerList;
  private customDeserializers: CustomDeserializerList;
  private evalImpl: undefined | ((code: string) => any);

  /**
   * Creates a new graph of serialized values.
   */
  private constructor() {
    this.indexMap = [];
    this.rootIndex = -1;
    this.contentArray = [];
    this.builtins = defaultBuiltins;
    this.customSerializers = [];
    this.customDeserializers = [];
    this.evalImpl = undefined;
  }

  /**
   * Serializes a value, producing a serialized graph.
   * @param value The value to serialize.
   * @param builtins An optional list of builtins to use.
   * If not specified, the default builtins are used.
   * @param customSerializers An optional list of custom serialize functions to use for specified values.
   */
  static serialize(
    value: any,
    builtins?: BuiltinList,
    customSerializers?: CustomSerializerList): SerializedGraph {

    let graph = new SerializedGraph();
    graph.builtins = builtins;
    graph.customSerializers = customSerializers;
    graph.rootIndex = graph.add(value);
    return graph;
  }

  /**
   * Converts JSON to a serialized graph.
   * @param json The JSON to interpret as a serialized graph.
   * @param builtins An optional list of builtins to use.
   * If not specified, the default builtins are used.
   * @param customDeserializers An optional list of builtins to use.
   * If not specified, the default builtins are used.
   * @param evalImpl An `eval` implementation to use for
   * evaluating functions or regular expressions.
   */
  static fromJSON(
    json: any,
    builtins?: BuiltinList,
    customDeserializers?: CustomDeserializerList,
    evalImpl?: (code: string) => any): SerializedGraph {

    let graph = new SerializedGraph();
    graph.rootIndex = json.root;
    graph.contentArray = json.data;
    if (builtins) {
      graph.builtins = builtins;
    } else if (evalImpl) {
      graph.builtins = generateDefaultBuiltins(undefined, evalImpl);
    }
    graph.evalImpl = evalImpl;
    if (customDeserializers) {
      graph.customDeserializers = customDeserializers;
    } else {
      graph.customDeserializers = [];
    }
    return graph;
  }

  /**
   * Creates a JSON representation of this serialized graph.
   */
  toJSON() {
    return {
      'root': this.rootIndex,
      'data': this.contentArray
    };
  }

  /**
   * Adds a value to the graph and serializes it
   * if necessary. Returns the index of the value
   * in the content array.
   * @param value The value to add.
   */
  private add(value: any, flags?: ValueFlags): number {
    // If the value is already in the graph, then we don't
    // need to serialize it.
    for (let { element, index } of this.indexMap) {
      if (element === value) {
        return index;
      }
    }

    let index = this.contentArray.length;
    this.contentArray.push(undefined);
    this.indexMap.push({ element: value, index });
    this.contentArray[index] = this.serialize(value, flags);
    return index;
  }

  /**
   * Serializes an accessor function.
   * @param value The function to serialize.
   */
  private serializeAccessorFunction(value: Function, kind: "get" | "set"): any {
    let result = this.serializeFunction(value)
    // Applying value.toString() on an accessor function can generate an invalid expression in two cases:
    // 1) named accessors: eliminate the `get` or `set` prefix.
    // 2) function application `()` in function name
    if (value.name.startsWith(kind + ' ')) {
      let source = "function " + value.toString().substring(4)
      result = Object.assign({}, result, {
        source
      })
    }
    if (result.source.startsWith(kind + '(')) {
      let source = "function " + value.toString().substring(3)
      result = Object.assign({}, result, {
        source
      })
    }
    return result;
  }

  /**
   * Serializes a function.
   * @param value The function to serialize.
   */
  private serializeFunction(value: Function): any {
    let closure = (<any>value).__closure;
    if ((<any>value).__impl) {
      // To serialize functions that have been deserialized earlier,
      // we must reuse the __impl source. This is OK because functions are immutable
      value = (<any>value).__impl;
      closure = (<any>value).__closure;
    }
    let source = value.toString()
    if (source.endsWith("{ [native code] }")) {
      throw new Error(`Cannot serialize native code. Value missing from builtin list? '${value}'`)
    }
    if (source.startsWith("class ")) {
      throw new Error(`Cannot serialize classes. Value missing from builtin list? '${value}'`)
    }
    let result = {
      'kind': 'function',
      'source': source,
      'closure': this.add(closure ? closure() : undefined),
      'prototype': this.add(value.prototype)
    };

    this.serializeProperties(value, result);

    return result;
  }

  /**
   * Serializes an object.
   * @param value The object to serialize.
   */
  private serializeObject(value: any): any {
    let result = {
      'kind': 'object',
      'prototype': this.add(Object.getPrototypeOf(value))
    };

    this.serializeProperties(value, result);

    return result;
  }

  /**
   * Serializes a value's properties.
   * @param value The value whose properties to serialize.
   * @param serializedValue A serialized version of the value.
   * Its 'refs' and 'descriptions' properties will be updated by this
   * method.
   */
  private serializeProperties(value: any, serializedValue: any): void {
    let refs = {};
    let descriptions = {};
    for (let key of Object.getOwnPropertyNames(value)) {
      if (key.length > 2 && key.substr(0, 2) === '__') {
        // Ignore keys that start with two underscores. There's
        // a reason those underscores are there.
        continue;
      }

      let desc = Object.getOwnPropertyDescriptor(value, key);
      if ('value' in desc && desc.configurable && desc.writable && desc.enumerable) {
        // Typical property. Just encode its value and be done with it.
        refs[key] = this.add(value[key]);
      } else {
        // Fancy property. We'll emit a description for it.
        let serializedDesc: any = {};
        if (desc.get) {
          serializedDesc.get = this.add(desc.get, { accessor: 'get' });
        }
        if (desc.set) {
          serializedDesc.set = this.add(desc.set, { accessor: 'set' });
        }
        if ('value' in desc) {
          serializedDesc.value = this.add(desc.value);
        }
        serializedDesc.configurable = desc.configurable;
        if (serializedDesc.writable !== undefined) {
          serializedDesc.writable = desc.writable;
        }
        serializedDesc.enumerable = desc.enumerable;
        descriptions[key] = serializedDesc;
      }
    }

    serializedValue.refs = refs;
    serializedValue.descriptions = descriptions;
  }

  /**
   * Serializes a value. This value may be a closure or an object
   * that contains a closure.
   * @param value The value to serialize.
   */
  private serialize(value: any, flags?: ValueFlags): any {
    // Check if the value requires a custom serializer
    let customSerializer = retrieveCustomSerializer(value, this.customSerializers)
    if (customSerializer !== undefined) {
      return {
        'kind': 'custom',
        'name': customSerializer.name,
        'value': customSerializer.serializer()
      };
    }
    // Check if the value is a builtin before proceeding.
    let builtinName = getNameOfBuiltin(value, this.builtins);
    if (builtinName !== undefined) {
      return {
        'kind': 'builtin',
        'name': builtinName
      };
    }

    // Usual serialization logic.
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
      return {
        'kind': 'primitive',
        'value': value
      };
    } else if (Array.isArray(value)) {
      return {
        'kind': 'array',
        'refs': value.map(v => this.add(v))
      };
    } else if (typeof value === 'function') {
      if (flags && flags.accessor) {
        return this.serializeAccessorFunction(value, flags.accessor);
      } else {
        return this.serializeFunction(value);
      }
    } else if (
      (types && types.isDate(value))) {      // Deprecated
      return {
        'kind': 'date',
        'value': JSON.stringify(value)
      };
    } else if (
      (types && types.isRegExp(value))) {      // Deprecated
      return {
        'kind': 'regex',
        'value': value.toString()
      };
    } else {
      return this.serializeObject(value);
    }
  }

  /**
   * Gets a deserialized version of the value
   * stored at a particular index.
   * @param valueIndex The index of the value to deserialize.
   */
  private get(valueIndex: number): any {
    // If the value is already in the index map, then we don't
    // need to deserialize it.
    for (let { element, index } of this.indexMap) {
      if (valueIndex === index) {
        return element;
      }
    }

    let value = this.contentArray[valueIndex];

    if (value.kind === 'primitive') {
      this.indexMap.push({ element: value.value, index: valueIndex });
      return value.value;
    } else if (value.kind === 'array') {
      let results = [];
      // Push the (unfinished) array into the index map here because
      // there may be cycles in the graph of serialized objects.
      this.indexMap.push({ element: results, index: valueIndex });
      for (let ref of value.refs) {
        results.push(this.get(ref));
      }
      return results;
    } else if (value.kind === 'object') {
      // Push the (unfinished) object into the index map here because
      // there may be cycles in the graph of serialized objects.
      let results = Object.create(this.get(value.prototype));
      this.indexMap.push({ element: results, index: valueIndex });
      this.deserializeProperties(value, results);
      return results;
    } else if (value.kind === 'proxy') {
      // A proxy is serialized outside of the current scope
      // so deserialize and proxy the result through a function when accessed
      let results = value.value;
      if (value.value &&
        typeof value.value === 'object' &&
        value.value.constructor === Object &&
        value.value.root === 0 &&
        Array.isArray(value.value.data)) {
        let evalImpl = this.evalImpl;
        let fct = SerializedGraph.fromJSON(value.value, this.builtins, [], evalImpl).root
        results = new Proxy({}, {
          get: function (tgt, name, rcvr) {
            let res = fct();
            return () => res;
          }
        });
      }
      this.indexMap.push({ element: results, index: valueIndex });
      return results;
    } else if (value.kind === 'function') {
      // Decoding functions is tricky because the closure of
      // a function may refer to that function. At the same
      // time, function implementations are immutable.
      // To get around that, we'll use a dirty little hack: create
      // a thunk that calls a property of itself.

      // let thunk = function () {
      //     return (<any>thunk).__impl.apply(this, arguments);
      //   }
      //   this.indexMap.push({ element: thunk, index: valueIndex });

      // TODO: Temporary fix for bug in createClosureLambda (Part 1)
      //       Synthesized variables to do map to literal properties
      var thunkObj = { __thunk: undefined };
      thunkObj.__thunk = function () {
        return (<any>thunkObj.__thunk).__impl.apply(this, arguments);
      }
      this.indexMap.push({ element: thunkObj.__thunk, index: valueIndex });

      // Synthesize a snippet of code we can evaluate.
      // TODO: Temporary fix for bug in createClosureLambda (Part 2)
      //       Synthesized variables to do map to literal properties
      //       Should be 'let deserializedClosure'
      var deserializedClosure = this.get(value.closure) || {};
      let capturedVarKeys = [];
      let capturedVarVals = [];
      for (let key in deserializedClosure) {
        capturedVarKeys.push(key);
        capturedVarVals.push(deserializedClosure[key]);
      }
      let code = `(function(${capturedVarKeys.join(", ")}) { return (${value.source}); })`;

      // Evaluate the code.
      let impl = this.evalInThisContext(code).apply(undefined, capturedVarVals);
      impl.prototype = this.get(value.prototype);
      impl.__closure = () => deserializedClosure;

      // Patch the thunk.
      // (<any>thunk).__impl = impl;
      // (<any>thunk).prototype = impl.prototype;
      // this.deserializeProperties(value, thunk);

      // return thunk;

      // TODO: Temporary fix for bug in createClosureLambda (Part 3)
      //       Synthesized variables to do map to literal properties
      (<any>thunkObj.__thunk).__impl = impl;
      (<any>thunkObj.__thunk).prototype = impl.prototype;
      this.deserializeProperties(value, thunkObj.__thunk);

      return thunkObj.__thunk;
    } else if (value.kind === 'builtin') {
      let builtin = getBuiltinByName(value.name, this.builtins);
      if (builtin === undefined) {
        throw new Error(`Cannot deserialize unknown builtin '${value.name}'.`);
      } else {
        this.indexMap.push({ element: builtin, index: valueIndex });
        return builtin;
      }
    } else if (value.kind === 'custom') {
      let customDeserializer = retrieveCustomDeserializer(value.name, this.customDeserializers);
      if (customDeserializer === undefined) {
        throw new Error(`Cannot deserialize unknown custom '${value.name}'.`);
      }
      let result = customDeserializer(value.value)
      this.indexMap.push({ element: result, index: valueIndex });
      return result;
    } else if (value.kind === 'date') {
      let result = new Date(JSON.parse(value.value));
      this.indexMap.push({ element: result, index: valueIndex });
      return result;
    } else if (value.kind === 'regex') {
      // TODO: maybe figure out a better way to parse regexes
      // than a call to `eval`?
      let result = this.evalInThisContext(value.value);
      this.indexMap.push({ element: result, index: valueIndex });
      return result;
    } else {
      throw new Error(`Cannot deserialize unrecognized content kind '${value.kind}'.`);
    }
  }

  /**
   * Tries to evaluate a string of code..
   * @param code The code to evaluate.
   */
  private evalInThisContext(code: string) {
    // Ideally, we'd like to use a custom `eval` implementation.
    // Otherwise, `eval` will just have to do.
    try {
      if (this.evalImpl) {
        return this.evalImpl(code);
      } else {
        return eval(code);
      }
    } catch (e) {
      throw new Error(`Failed to deserialize code: \`${code}\`: ${e}`)
    }
  }

  /**
   * Deserializes a serialized value's properties.
   * @param value The serialized value.
   * @param deserializedValue The deserialized value to update.s
   */
  private deserializeProperties(value: any, deserializedValue: any): void {
    for (let key in value.refs) {
      deserializedValue[key] = this.get(value.refs[key]);
    }
    for (let key in value.descriptions) {
      // Object property descriptions require some extra love.
      let desc = value.descriptions[key];
      let parsedDesc = { ...desc, };
      if (desc.get) {
        parsedDesc.get = this.get(desc.get);
      }
      if (desc.set) {
        parsedDesc.set = this.get(desc.set);
      }
      if (desc.value) {
        parsedDesc.value = this.get(desc.value);
      }
      Object.defineProperty(deserializedValue, key, parsedDesc);
    }
  }

  /**
   * Gets a deserialized version of the root object serialized by this graph.
   */
  get root(): any {
    return this.get(this.rootIndex);
  }
}
