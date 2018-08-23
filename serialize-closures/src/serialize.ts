import { SerializedGraph } from "./serializedGraph";

/**
 * Serializes a value. This value may be a closure or an object
 * that contains a closure.
 * @param value The value to serialize.
 */
export default function serialize(value: any): any {
  return SerializedGraph.serialize(value).toJSON();
}
