const path = require('path')
const merge = require('webpack-merge')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const WebpackMd5Hash = require('webpack-md5-hash')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const baseWebpackConfig = require('./base.config')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const utils = require('./utils')
const config = require('./config')

const prodConfig= {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          use: [
            utils.cssLoaderConfig(),
            utils.PostCssLoader(),
          ],
          fallback: 'style-loader',
          publicPath: '../../'
        })
      },
      {
        test: /\.scss$/,
        exclude: /(node_modules|libs)/,
        use: ExtractTextPlugin.extract({
          use: [
            utils.cssLoaderConfig(),
            utils.PostCssLoader('sass'),
            'resolve-url-loader'
          ],
          publicPath: '../../'
        })
      }
    ]
  },
  devtool: config.build.productionSourceMap ? '#source-map' : false,
  output: {
    path: config.build.assetsRoot,
    filename: utils.assetsPath('js/[name].[chunkhash].js'),
    chunkFilename: utils.assetsPath('js/[id].[chunkhash].js')
  },
  plugins: [
    new CleanWebpackPlugin(config.build.assetsRoot, {
      root: path.resolve(__dirname, '..'),
    }),
    new webpack.DefinePlugin({
      'process.env': config.build.env
    }),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      },
      sourceMap: true
    }),
    new WebpackMd5Hash(),
    new HtmlWebpackPlugin({
    	// 生成的html的文件名
      filename: config.build.index,
      // 也可以实例化几个不同的插件，生成不同的html文件，做定制化配置
      template: 'index.html',
      // 值 head 时，js被加入head标签内
      inject: true,
      minify: {
      	// 删除html中的注释代码
        removeComments: true,
        // 删除html中的空白符
        collapseWhitespace: true,
        // 删除html元素中属性的引号
        removeAttributeQuotes: true
      },
      // 'none' | 'auto' | 'dependency' |'manual' | function (chunk1, ...) {} 默认是 auto
      // 可以自己指定chunk的加载顺序
      chunksSortMode: 'dependency',
      // excludeChunks : [] // 允许你跳过一些chunks
      // chunks: [...] 可以指定生成的html包含哪些块
    }),
    // 提取所有的公共模块到vendorJs
    new webpack.optimize.CommonsChunkPlugin({
    	// 生成的文件名字
      name: 'vendor',
      minChunks: function (module, count) {
        // 把 node_modules里面的所有包提取到到公共js文件里面
        return (
          module.resource &&
          /\.js$/.test(module.resource) &&
          module.resource.indexOf(
            path.join(__dirname, '../node_modules')
          ) === 0
        )
      }
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      // 如果忽略，所有的入口文件都会被选择，而且 chunk 必须是公共chunk 的子模块
      chunks: ['vendor']
    }),
    // 把静态资源复制到指定位置
    new CopyWebpackPlugin([
      {
        from: path.resolve(__dirname, '../src/assets'),
        to: config.build.assetsSubDirectory,
        ignore: ['.*']
      }
    ])
  ]
}

// 代码压缩成Gzip，但是需要服务器配合，一般用不上
if (config.build.productionGzip) {
  const CompressionWebpackPlugin = require('compression-webpack-plugin')
  // http://www.css88.com/doc/webpack2/plugins/compression-webpack-plugin/
  prodConfig.plugins.push(
    new CompressionWebpackPlugin({
    	// 目标文件名
      asset: '[path].gz[query]',
      // 使用gzip压缩
      algorithm: 'gzip',
      // 所有匹配该正则的资源都会被处理
      test: new RegExp(
        '\\.(' +
        config.build.productionGzipExtensions.join('|') +
        ')$'
      ),
      // 只有大小大于该值的资源会被处理。单位是 bytes。默认值是 0
      threshold: 10240,
      // 只有大小大于该值的资源会被处理。单位是 bytes。默认值是 0
      minRatio: 0.8
    })
  )
}

// 可视化文件/组件的打包大小（用于分析打包后的代码）
if (config.build.bundleAnalyzerReport) {
  var BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
  prodConfig.plugins.push(new BundleAnalyzerPlugin())
}

module.exports = merge(baseWebpackConfig, prodConfig)