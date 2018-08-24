import { isPrimitive, isArray, isFunction, isDate } from "util";
import { getNameOfBuiltin, getBuiltinByName } from "./builtins";

/**
 * Represents a graph of serialized values.
 */
export class SerializedGraph {
  private indexMap: { element: any, index: number }[];
  private rootIndex: number;
  private contentArray: any[];

  /**
   * Creates a new graph of serialized values.
   */
  private constructor() {
    this.indexMap = [];
    this.rootIndex = -1;
    this.contentArray = [];
  }

  /**
   * Serializes a value, producing a serialized graph.
   * @param value The value to serialize.
   */
  static serialize(value: any): SerializedGraph {
    let graph = new SerializedGraph();
    graph.rootIndex = graph.add(value);
    return graph;
  }

  /**
   * Converts JSON to a serialized graph.
   * @param json The JSON to interpret as a serialized graph.
   */
  static fromJSON(json: any): SerializedGraph {
    let graph = new SerializedGraph();
    graph.rootIndex = json.root;
    graph.contentArray = json.data;
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
  private add(value: any): number {
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
    this.contentArray[index] = this.serialize(value);
    return index;
  }

  /**
   * Serializes a function.
   * @param value The function to serialize.
   */
  private serializeFunction(value: Function): any {
    let closure = (<any>value).__closure;
    if (!closure) {
      closure = () => ({});
    }
    return {
      'kind': 'function',
      'source': value.toString(),
      'closure': this.add(closure())
    };
  }

  /**
   * Serializes an object.
   * @param value The object to serialize.
   */
  private serializeObject(value: any): any {
    let result = {};
    for (let key in value) {
      result[key] = this.add(value[key]);
    }
    return {
      'kind': 'object',
      'refs': result
    };
  }

  /**
   * Serializes a value. This value may be a closure or an object
   * that contains a closure.
   * @param value The value to serialize.
   */
  private serialize(value: any): any {
    // Check if the value is a builtin before proceeding.
    let builtinName = getNameOfBuiltin(value);
    if (builtinName !== undefined) {
      return {
        'kind': 'builtin',
        'name': builtinName
      };
    }

    // Usual serialization logic.
    if (isPrimitive(value)) {
      return {
        'kind': 'primitive',
        'value': value
      };
    } else if (isArray(value)) {
      return {
        'kind': 'array',
        'refs': value.map(v => this.add(v))
      };
    } else if (isFunction(value)) {
      return this.serializeFunction(value);
    } else if (isDate(value)) {
      return {
        'kind': 'date',
        'value': JSON.stringify(value)
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
      let results = {};
      this.indexMap.push({ element: results, index: valueIndex });
      for (let key in value.refs) {
        results[key] = this.get(value.refs[key]);
      }
      return results;
    } else if (value.kind === 'function') {
      // Decoding functions is tricky because the closure of
      // a function may refer to that function. At the same
      // time, function implementations are immutable.
      // To get around that, we'll use a dirty little hack: create
      // a stub that calls a property of itself. Put that
      // in the index map and overwrite it later. 
      let stub = function() {
        return (<any>stub).__impl.apply(this, arguments);
      }
      let resultIndex = this.indexMap.length;
      this.indexMap.push({ element: stub, index: valueIndex });

      // Synthesize a snippet of code we can evaluate.
      let deserializedClosure = this.get(value.closure);
      let capturedVarKeys = [];
      let capturedVarVals = [];
      for (let key in deserializedClosure) {
        capturedVarKeys.push(key);
        capturedVarVals.push(deserializedClosure[key]);
      }
      let code = `(function(${capturedVarKeys.join(", ")}) { return (${value.source}); })`;

      // Evaluate the code.
      let result = eval(code).apply(undefined, capturedVarVals);

      // Patch the stub and index map.
      (<any>stub).__impl = result;
      this.indexMap[resultIndex] = { element: result, index: valueIndex };
      return result;
    } else if (value.kind === 'builtin') {
      let builtin = getBuiltinByName(value.name);
      if (builtin === undefined) {
        throw new Error(`Cannot deserialize unknown builtin '${value.name}'.`);
      } else {
        this.indexMap.push({ element: builtin, index: valueIndex });
        return builtin;
      }
    } else if (value.kind === 'date') {
      let result = new Date(JSON.parse(value.value));
      this.indexMap.push({ element: result, index: valueIndex });
      return result;
    } else {
      throw new Error(`Cannot deserialize unrecognized content kind '${value.kind}'.`);
    }
  }

  /**
   * Gets a deserialized version of the root object serialized by this graph.
   */
  get root(): any {
    return this.get(this.rootIndex);
  }
}
