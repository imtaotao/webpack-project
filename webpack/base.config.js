const path = require('path')
const webpack = require('webpack')
const merge = require('webpack-merge')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const utils = require('./utils')
const config = require('./config')
const resolve = dir => path.join(__dirname, '..', dir)

module.exports = merge({
  entry: {
    app: resolve('/src/main.ts') 
  },
  output: {
    path: config.build.assetsRoot,
    filename: '[name].js',
    publicPath: process.env.NODE_ENV === 'production'
      ? config.build.assetsPublicPath
      : config.dev.assetsPublicPath
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.json'],
    alias: {
      '@': resolve('src')
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'happypack/loader?id=babel',
        include: resolve('src')
      },
      {
        test: /\.(ts|tsx)?$/,
        use: [
          'happypack/loader?id=babel',
          'happypack/loader?id=ts',
        ],
        include: resolve('src'),
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: utils.assetsPath('img/[name].[hash:7].[ext]')
        }
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        loader: 'url-loader',
        options: {
          limit: 10000,
          name: utils.assetsPath('media/[name].[hash:7].[ext]')
        }
      }
    ]
  },
  plugins: [
    new webpack.optimize.LimitChunkCountPlugin({
      // disable creating additional chunks
      maxChunks: 1
    }),
    new ExtractTextPlugin({
      filename: utils.assetsPath('css/[name].[contenthash].css')
    }),
  ]
}, require('./happypack'))