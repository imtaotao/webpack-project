const path = require('path')
const HappyPack = require('happypack')
const config = require('./config')
const utils = require('./utils')

const happypack_thread_pool = HappyPack.ThreadPool({ size: 4 })

// 使用ChunkManifestPlugin来最小化模块名称的大小
module.exports = {
  plugins: [
    new HappyPack({
      id: 'babel',
      threadPool: happypack_thread_pool,
      loaders: ['babel-loader'],
    }),
    new HappyPack({
      id: 'ts',
      threadPool: happypack_thread_pool,
      loaders: [
        {
          path: 'ts-loader',
          query: { happyPackMode: true }
        }
      ]
    }),
    new HappyPack({
      id: 'css',
      threadPool: happypack_thread_pool,
      loaders: [
        {
          path: 'css-loader',
          query: {
            sourceMap: config.dev.cssSourceMap
          }
        }
      ]
    }),
    new HappyPack({
      id: 'css_module',
      threadPool: happypack_thread_pool,
      loaders: [
        {
          path: 'css-loader',
          query: {
            sourceMap: config.dev.cssSourceMap,
            modules: true,
            importLoaders: 3,
            localIdentName: '[local]_[hash:base64:5]',
          }
        }
      ]
    }),
    new HappyPack({
      id: 'sass',
      threadPool: happypack_thread_pool,
      loaders: [
        {
          path: 'sass-loader',
          query: sassQuery()
        }
      ]
    })
  ]
}

function sassQuery () {
  let query = {
    includePaths: [
      path.join(__dirname, './src'),
    ]
  }
  // 处理为false的情况，否则 postcss-loader 会发出一个警告
  if (config.dev.cssSourceMap) {
    query.sourceMap = config.dev.cssSourceMap
  }
  return query
}