const path = require('path')
const postcss = require('postcss')
const config = require('./config')

// js css 图片文件的存放位置
exports.assetsPath = function (_path) {
  const assetsSubDirectory = process.env.NODE_ENV === 'production'
    ? config.build.assetsSubDirectory
    : config.dev.assetsSubDirectory
  return path.posix.join(assetsSubDirectory, _path)
}

exports.cssLoaderConfig = function () {
  return {
    loader: 'css-loader',
    options: {
      root: '/',
      modules: config.common.modules,
      localIdentName: '[local]_[hash:base64:5]',
      minimize: true,
      sourceMap: config.build.productionSourceMap
    }
  }
}

// https://github.com/postcss/postcss
exports.PostCssLoader = function (type = 'css') {
  const isProd = process.env.NODE_ENV === 'production'

  function getPlugins (loader) {
    const plugins = []
    const cssRootPath = config.common.cssRootPath

    if (isProd) { 
      plugins.push(require('cssnano')())
    }
    if (type === 'css') { 
      plugins.push(require('postcss-cssnext')())
    } else {
      if (!isUndef(cssRootPath)) {
        plugins.push(require('postcss-import')({root: loader.resourcePath}))
      }
    }
    if (!isUndef(cssRootPath)) { 
      plugins.push(convertUrl()(loader.resourcePath, cssRootPath))
    }
    // https://github.com/ai/browserslist#queries，
    plugins.push(require('autoprefixer')())
    return plugins
  }
  
  return {
    loader: 'postcss-loader',
    options: {
      ident: 'postcss',
      sourceMap: isProd
        ? config.build.productionSourceMap
        : config.dev.cssSourceMap,
      plugins: loader => getPlugins(loader),
    }
  }
}

// 转换 css url
function convertUrl () {
  return postcss.plugin('postcss-convert-url', (...args) => {
    return (css, result) => {
      css.walkRules(rule => {
        rule.walkDecls(/^background(-image)?$/, decl => {
          const realUrl = replaceRealUrl(decl, ...args)
          decl.value = realUrl
        })
      })
    }
  })
}

function replaceRealUrl ({value}, resourcePath, cssRootPath) {
  const relativeUrl = path.relative(path.dirname(resourcePath), cssRootPath)
  value = value.replace(
    /(resolve)(\(['"])+([^\(\)'"]+)/g,
    (k1, k2, k3, k4) => {
      const concatUrl = path.join(relativeUrl, k4)
      return 'url' + k3 + (
        concatUrl[0] === '.' ? concatUrl : './' + concatUrl
      )
    }
  )
  return value
}

function isUndef (val) {
  return val === undefined || val === null || val === false
}