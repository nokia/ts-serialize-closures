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

If you want to attach some data to an object that don't want to see serialized, then you can assign that property a name that starts with two underscores. The serializer will ignore those when serializing.

```typescript
deserialize(serialize({ __dont_include_this: 10 })); // Produces '{ }'.
```
