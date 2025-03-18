import { SerializedGraph } from "./serializedGraph.js";
import { BuiltinList } from "./builtins.js";
import { CustomDeserializerList} from "./customs.js";

/**
 * Deserializes a serialized value.
 * @param value The serialized value to deserialize.
 * @param builtins An optional list of builtins to use.
 * If not specified, the default builtins are assumed.
 * @param customs An optional list of custom serializers to use.
 * @param evalImpl An optional `eval` implementation to use.
 */
export default function deserialize(
  value: any,
  builtins?: BuiltinList,
  customs?: CustomDeserializerList,
  evalImpl?: (code: string) => any) : any {

  return SerializedGraph.fromJSON(value, builtins, customs, evalImpl).root;
}
