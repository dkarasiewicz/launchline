const { composePlugins, withNx } = require('@nx/webpack');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

// Nx plugins for webpack.
module.exports = composePlugins(withNx({}), (config) => {
  // Update the webpack config as needed here.
  // e.g. `config.plugins.push(new MyPlugin())`
  return {
    ...config,
    entry: ['../../node_modules/webpack/hot/poll?100', ...config.entry.main],
    externals: [
      nodeExternals({
        allowlist: ['../../node_modules/webpack/hot/poll?100'],
      }),
    ],
    plugins: [
      ...config.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
    ],
    watch: true,
    watchOptions: {
      ignored: /node_modules/,
      aggregateTimeout: 200,
      poll: 1000,
    },
  };
});
