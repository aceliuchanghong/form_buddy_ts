import type { Configuration } from 'webpack';
import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: Configuration = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
    popup: './src/popup/popup.ts',
    options: './src/options/options.ts',
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name]/index.js',
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },

  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest/manifest.json', to: 'manifest.json' },
        { from: 'src/popup/index.html', to: 'popup/index.html' },
        { from: 'src/options/index.html', to: 'options/index.html' },
        { from: 'public/icons', to: 'icons', noErrorOnMissing: true },
      ],
    }),
  ],

  optimization: {
    minimize: process.env.NODE_ENV === 'production',
  },

  devtool: 'cheap-module-source-map',
};

export default config;