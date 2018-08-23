import { SerializedGraph } from "./serializedGraph";

/**
 * Deserializes a serialized value.
 * @param value The serialized value to deserialize.
 */
export default function deserialize(value: any): any {
  return SerializedGraph.fromJSON(value).root;
}
