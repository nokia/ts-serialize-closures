import { serialize, deserialize } from 'serialize-closures';
// Just about anything can be serialized by calling `serialize`.
let capturedVariable = 5;
let serialized = serialize(() => capturedVariable);

// Serialized representations can be stringified and parsed.
let text = JSON.stringify(serialized);
let parsed = JSON.parse(text);

// Serialized representations can be deserialized by calling `deserialize`.
console.log(deserialize(serialized)()); // Prints '5'.
console.log(deserialize(parsed)());     // Prints '5'.
