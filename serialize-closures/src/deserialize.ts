import { SerializedGraph } from "./serializedGraph";
import { BuiltinList } from "./builtins";

/**
 * Deserializes a serialized value.
 * @param value The serialized value to deserialize.
 * @param builtins An optional list of builtins to use.
 * If not specified, the default builtins are assumed.
 * @param evalImpl An optional `eval` implementation to use.
 */
export default function deserialize(
  value: any,
  builtins?: BuiltinList,
  evalImpl?: (code: string) => any): any {
  return SerializedGraph.fromJSON(value, builtins, evalImpl).root;
}
