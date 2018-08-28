# ts-closure-transform

This package defines TypeScript code transformations that enable the `serialize-closures` package to serialize functions.

These transformations will rewrite all function definitions to include a special `__closure` property. The serializer uses that `__closure` property to figure out which variables are captured by the function.

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
