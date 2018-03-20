const path = require('path');
const loaderUtils = require('loader-utils');
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

module.exports.pitch = function (request) {
  // 必须是由 webpack 编译的
  if (!this.webpack) throw new Error('必须在 【webpack】 中');

  // 取消缓存,因为依赖了外部的 sw 文件，有副作用
  this.cacheable(false);
  // 异步的回调函数
  const callback = this.async();
  const query = loaderUtils.getOptions(this) || {};
  const filename = query.name || 'sw.js';

  const childCompiler = this._compilation.createChildCompiler('sw', {
    filename,
    chunkname: `[id].${filename}`,
  });
  // 单入口调用 SingleEntryPlugin 插件 （多入口 调用 MultiEntryPlugin）
  childCompiler.apply(new SingleEntryPlugin(this.context, request, filename));
  
  const subCache = `subcache ${__dirname} ${request}`;
  childCompiler.plugin('compilation', (compilation) => {
    if (compilation.cache) {
      if (!compilation.cache[subCache]) {
        compilation.cache[subCache] = {};
      }
      compilation.cache = compilation.cache[subCache];
    }
  })

  childCompiler.runAsChild((err, entries, compilation) => {
    if (err) return callback(err);
    if (!entries[0]) return callback(null, null);
    const swFile = entries[0].files[0];

    if (query.outputPath) {
      // 删除默认输出
      delete this._compilation.assets[swFile];

      // 项目根目录
      const outputPath = path.resolve(process.cwd(), query.outputPath, swFile);

      this.emitFile(
        // 从父编译器的输出获取相对路径
        path.relative(this.options.output.path, outputPath),
        compilation.assets[swFile].source()
      );
    }

    const publicPath = query.publicPath ?
      JSON.stringify(path.join(query.publicPath, swFile)) :
      `__webpack_public_path__ + ${JSON.stringify(swFile)}`;

    callback(null, `module.exports = ${publicPath};`);
  })
}