const webpack = require('webpack')
const path = require('path')
const merge = require('webpack-merge')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const FriendlyErrorsPlugin = require('friendly-errors-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const utils = require('./utils')
const config = require('./config')
const baseWebpackConfig = require('./base.config')

// 将热重载相关代码添加到 entry 块
Object.keys(baseWebpackConfig.entry).forEach(name => {
  baseWebpackConfig.entry[name] = ['./webpack/dev-client'].concat(baseWebpackConfig.entry[name])
})

// 开发环境下 css sass文件不需要生成单独的文件
module.exports = merge(baseWebpackConfig, {
  module: {
    rules: [
    {
      test: /\.css$/,
      use: ExtractTextPlugin.extract({
        use: [
          'happypack/loader?id=css', 
          utils.PostCssLoader()
        ]
      })
    },
    {
      test: /\.scss$/,
      exclude: /(node_modules|libs)/,
      use: [
        'style-loader',
        'happypack/loader?id=css_module',
        utils.PostCssLoader('sass'),
        'resolve-url-loader',
        'happypack/loader?id=sass',
      ]
    }]
  },
  devtool: '#cheap-module-eval-source-map',
  plugins: [
    new webpack.DefinePlugin({
      'process.env': config.dev.env
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new FriendlyErrorsPlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'index.html',
      inject: true
    })
  ]
})