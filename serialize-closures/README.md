# serialize-closures

This package is a runtime library for that allows for arbitrary object graphs to be serialized, including variable-capturing functions. **Note:** only functions whose code has first been processed by `ts-closure-transform` are eligible for serialization. 

`serialize-closures` defines the `serialize` and `deserialize` functions. These should work for any object graph as long as all source code has first been processed by `ts-closure-transform`.

Here's some example usage of `serialize` and `deserialize`:

```typescript
import { serialize, deserialize } from 'serialize-closures';

// Just about anything can be serialized by calling `serialize`.
let capturedVariable = 5;
let serialized = serialize(() => capturedVariable);

// Serialized representations can be stringified and parsed.
let text = JSON.stringify(serialized);
let parsed = JSON.parse(text);

// Serialized representations can be deserialized by calling `deserialize`.
console.log(deserialize(serialized)()); // Prints '5'.
```