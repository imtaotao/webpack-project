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

// https://github.com/postcss/postcss
exports.PostCssLoader = function (type = 'css') {
  const isProd = process.env.NODE_ENV === 'production'

  function getPlugins (loader) {
    const plugins = []
    const cssRootPath = config.commom.cssRootPath

    if (isProd) {
      plugins.push(require('cssnano')()) // 压缩css代码
    }
    // 如果使用了 resolve 也要配置
    if (type === 'css' || cssRootPath != null) {
       // 可以让使用@improt引入的css也加上前缀
      plugins.push(require('postcss-import')({
      	root: loader.resourcePath
      }))
    }
    if (type === 'css') {
      // 可以使用css最新的语法
      plugins.push(require('postcss-cssnext')())
    }
    if (cssRootPath != null) {
      plugins.push(convertUrl()(cssRootPath))
    }
    // https://github.com/ai/browserslist#queries，
    // 在package里面指定browserslist可以减少配置文件
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
  return postcss.plugin('postcss-convert-url', cssRootPath => {
    return (css, result) => {
      css.walkRules(rule => {
        rule.walkDecls(/^background(-image)?$/, decl => {
          const realUrl = replaceRealUrl(decl, cssRootPath)
          decl.value = realUrl
        })
      })
    }
  })
}

function replaceRealUrl ({value}, cssRootPath) {
  value = value.replace(
    /(resolve)(\(['"])+([^\(\)'"]+)/g, 
    (k1, k2, k3, k4) => {
      return 'url' + k3 + path.join(cssRootPath, k4)
    }
  )
  return value
}