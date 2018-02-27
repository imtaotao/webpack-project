const path = require('path')

module.exports = {
	build: {
    env: require('./prod.env'),
    index: path.resolve(__dirname, '../../dist/index.html'),
    assetsRoot: path.resolve(__dirname, '../../dist'),
    assetsSubDirectory: 'static',
    assetsPublicPath: './',
    productionSourceMap: true,
    // npm install --save-dev compression-webpack-plugin
    productionGzip: false,
    productionGzipExtensions: ['js', 'css'],
    // `npm run build --report`
    bundleAnalyzerReport: process.env.npm_config_report
  },
  dev: {
    env: require('./dev.env'),
    port: 3000,
    autoOpenBrowser: false,
    assetsSubDirectory: 'assets',
    assetsPublicPath: '/',
    // 跨域设置 https://github.com/chimurai/http-proxy-middleware
    proxyTable: {},
    cssSourceMap: true
  },
  commom: {
  	// resolve 指定路径，通用，设置 false 可以禁止掉
    cssRootPath: './assets',
    nodeMonkey: false
  }
}