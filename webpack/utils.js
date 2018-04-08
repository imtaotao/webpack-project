const os = require('os')
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

    if (type === 'css') {
      plugins.push(require('postcss-mixins')())
      plugins.push(require('postcss-cssnext')(cssnextOptions())) //cssnext 中包含了 autoprefixer
      plugins.push(require('postcss-import')({root: loader.resourcePath}))
    } else {
      if (!isUndef(cssRootPath)) {
        plugins.push(require('postcss-import')({root: loader.resourcePath}))
      }
    }
    if (!isUndef(cssRootPath)) {
      plugins.push(convertUrl()(loader.resourcePath, cssRootPath))
    }
    return plugins
  }

  function cssnextOptions () {
    return {
      features: {
        rem: false
      }
    }
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

// family is IPv4 or IPv6
exports.getIP = function (family = 'IPv4') {
  const interfaces = os.networkInterfaces()

  return Object.keys(interfaces).reduce((arr, x) => {
    const interfce = interfaces[x]

    return arr.concat(Object.keys(interfce)
      .filter(x => interfce[x].family === family && !interfce[x].internal)
      .map(x => interfce[x].address))
  }, [])
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
      const concatUrl = path.posix.join(relativeUrl, k4)
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
