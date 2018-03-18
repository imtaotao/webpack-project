process.env.NODE_ENV = 'production'

const rm = require('rimraf')
const path = require('path')
const webpack = require('webpack')
const config = require('./config')
const webpackConfig = require('./prod.config')

rm(path.join(config.build.assetsRoot, config.build.assetsSubDirectory), err => {
  if (err) throw err
  webpack(webpackConfig, function (err, stats) {
    if (err) throw err
    process.stdout.write(stats.toString({
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    }) + '\n\n')
  })
})