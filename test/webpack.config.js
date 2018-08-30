const webpack = require('webpack');
const path = require('path');

module.exports = (() => {
  const config = {};

  config.devtool = 'inline-source-map';

  config.resolve = {
    extensions: ['.ts', '.js'],
  };

  config.module = {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'istanbul-instrumenter-loader',
          options: { esModules: true },
        },
        exclude: /node_modules|\.test\.ts$/,
        enforce: 'post',
      },
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            compilerOptions: {
              inlineSourceMap: true,
              sourceMap: false,
            },
          },
        },
      },
    ],
  };

  return config;
})();
