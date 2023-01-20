
const tsClosureTransform = require('ts-closure-transform');
const path = require('path');
module.exports = {
  devtool: 'inline-source-map',
  mode: 'development',
  module: {
    rules: [
      {
        test: /.tsx?$/,
        loader: "ts-loader",
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
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "util": require.resolve("util/"),
    },
  },
  entry: {
    example: './src/example.ts',
  },
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].bundle.js'
  }
};
