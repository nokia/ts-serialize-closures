import { SerializedGraph } from "./serializedGraph";
import { BuiltinList } from "./builtins";
import { CustomSerializerList } from "./customs";

/**
 * Serializes a value. This value may be a closure or an object
 * that contains a closure.
 * @param value The value to serialize.
 * @param builtins An optional list of builtins to use.
 * If not specified, the default builtins are assumed.
 */
export default function serialize(value: any, builtins?: BuiltinList, customs?: CustomSerializerList): any {
  return SerializedGraph.serialize(value, builtins, customs).toJSON();
}
