
const tsClosureTransform = require('ts-closure-transform');
const path = require('path');
module.exports = {
  devtool: 'inline-source-map',
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
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    path: path.join(__dirname, 'dist')
  }
};