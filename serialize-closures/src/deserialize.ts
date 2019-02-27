import { SerializedGraph } from "./serializedGraph";
import { BuiltinList } from "./builtins";
import { CustomDeserializerList} from "./customs";

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
  customs?: CustomDeserializerList,
  evalImpl?: (code: string) => any) : any {

  return SerializedGraph.fromJSON(value, builtins, customs, evalImpl).root;
}
