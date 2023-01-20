[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![npm version](https://badge.fury.io/js/serialize-closures.svg)](https://badge.fury.io/js/serialize-closures)
[![npm version](https://badge.fury.io/js/ts-closure-transform.svg)](https://badge.fury.io/js/ts-closure-transform)
[![Build Status](https://travis-ci.org/nokia/ts-serialize-closures.svg?branch=master)](https://travis-ci.org/nokia/ts-serialize-closures)

# ts-serialize-closures

Serialize your TypeScript functions!

`ts-serialize-closures` can serialize and deserialize arbitrary TypeScript/JavaScript object graphs. That includes:

  * **functions, which may have captured data,**
  * `Date` and `RegExp` objects,
  * cyclic graphs,
  * prototypes,
  * references to built-in objects,
  * etc.

The idea is that `serialize` creates a self-contained snapshot of all program state relevant to the object being serialized. The `deserialize` function decodes that snapshot back to a JavaScript object graph.

This tool might be useful in a number of scenarios:

  * Exchanging functions between different processes. That's often a useful tool for building distributed systems.

  * Lightweight remote post-mortem debugging: have failing processes create a neat little snapshot of their current state and send yourself that snapshot for analysis.

## Usage

The serializer (`serialize-closures`) requires a preprocessing step (`ts-closure-transform`). Therefore, the typical usage of this library is to configure webpack to automatically transform the source code using a hook in the TypeScript compiler (`tsc`). Take the following steps to set up a stand-alone example:

  1. Prepare project and install dev-dependencies
```bash
mkdir example && cd example
npm init
npm install --save-dev ts-closure-transform serialize-closures webpack webpack-cli typescript ts-loader util
```

  2. Configure `webpack.config.js`:
```javascript
const tsClosureTransform = require('ts-closure-transform');
const path = require('path');
module.exports = {
  entry: {
    example: './src/example.ts',
  },
  module: {
    rules: [
      {
        test: /.tsx?$/,
        loader: 'ts-loader', // or 'awesome-typescript-loader'
        options: {
          getCustomTransformers: () => ({
            before: [tsClosureTransform.beforeTransform()],
            after: [tsClosureTransform.afterTransform()]
          })
        }
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
    fallback: {
      "util": require.resolve("util/"),
    },
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].bundle.js',
  }
}
```

  3. Write code to serialize and deserialize arbitrary functions:
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
console.log(deserialize(parsed)());     // Prints '5'.
```

  4. Compile with webpack and run the sample
```bash
npx webpack
node dist/example.bundle.js
```

## Components

The serializer consists of two components.

  1. `ts-closure-transform`: a transformation to inject in the TypeScript compiler's pass pipeline. This transformation will rewrite all function definitions to include a special `__closure` property. The serializer uses that `__closure` property to figure out which variables are captured by the function.

      How you inject this transform depends on the webpack loader you're using. For `ts-loader` and `awesome-typescript-loader`, you can do the following:

      ```typescript
      import { beforeTransform, afterTransform } from 'ts-closure-transform';
      // ...
      loader: 'ts-loader', // or 'awesome-typescript-loader'
      options: {
        getCustomTransformers: () => ({
          before: [beforeTransform()],
          after: [afterTransform()]
        })
      }
      // ...
      ```

      Note that `ts-closure-transform` is strictly a dev dependency: there's no need to package it with your application.

  2. `serialize-closures`: a runtime library that defines the `serialize` and `deserialize` functions. These should work for any object graph as long as all source code has first been processed by `ts-closure-transform`.


## Limitations

`ts-serialize-closures` works fairly well for modest object graphs, but it does have a number of limitations you should be aware of:

  * Variable-capturing functions defined in files that have not been transformed by `ts-closure-transform` cannot be deserialized correctly.

  * Serializing class definitions works, but only if they are first lowered to function definitions by the TypeScript compiler, i.e., the target is ES5 or lower.

  * Functions can only be serialized and deserialized *once.* There is no support for serializing a deserialized function.
