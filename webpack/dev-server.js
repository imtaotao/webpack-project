const config = require('./config')
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = JSON.parse(config.dev.env.NODE_ENV)
}

if (config.dev.nodeMonkey) {
  // http://127.0.0.1:50500 默认账号密码 guest
  require('node-monkey')()
}

const opn = require('opn')
const path = require('path')
const express = require('express')
const webpack = require('webpack')
const proxyMiddleware = require('http-proxy-middleware')
const webpackConfig = require('./dev.config')

const port = process.env.PORT || config.dev.port
const autoOpenBrowser = !!config.dev.autoOpenBrowser
const proxyTable = config.dev.proxyTable || {}
const app = express()
const compiler = webpack(webpackConfig)

// https://www.npmjs.com/package/webpack-dev-middleware
const devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: webpackConfig.output.publicPath,
  //向控制台显示任何内容 
  quiet: true
})

// https://github.com/glenjamin/webpack-hot-middleware
const hotMiddleware = require('webpack-hot-middleware')(compiler, {
  log: false,
  // 心跳时间，保证和客户端的连接活动
  heartbeat: 2000
})

// https://github.com/jantimon/html-webpack-plugin
compiler.plugin('compilation', function (compilation) {
  // 在编译完成之后，发送一个reload指令，让浏览器刷新，完成重载
  compilation.plugin('html-webpack-plugin-after-emit', function (data, callbck) {
    hotMiddleware.publish({ action: 'reload' })
    callbck()
  })
})

// 跨域设置
Object.keys(proxyTable).forEach(function (context) {
  let options = proxyTable[context]
  if (typeof options === 'string') {
    options = { target: options }
  }
  app.use(proxyMiddleware(options.filter || context, options))
})

// https://www.npmjs.com/package/connect-history-api-fallback
app.use(require('connect-history-api-fallback')())

// 提供webpack包输出
app.use(devMiddleware)

// 启用热重载和状态保存
app.use(hotMiddleware)

// 提供纯静态资源
const staticSource = path.join(__dirname, '../src')
app.use(config.dev.staticResoucePath, express.static(staticSource))

const uri = 'http://localhost:' + port
let _resolve
const readyPromise = new Promise(resolve =>  {
  _resolve = resolve
})

console.log('> Starting dev server...')
// 编译完成之后执行回调
devMiddleware.waitUntilValid(() => {
  console.log('> Listening at ' + uri + '\n')
  // 测试环境就不要让浏览器打开了，opn包可以自动打开浏览器，做了不同平台下的命令兼容
  if (autoOpenBrowser && process.env.NODE_ENV !== 'testing') {
    opn(uri)
  }
  _resolve()
})

const server = app.listen(port)

module.exports = {
  ready: readyPromise,
  close: () => {
    server.close()
  }
}