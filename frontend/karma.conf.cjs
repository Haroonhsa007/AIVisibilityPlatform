// Angular emits font assets at /media, but Karma serves CSS from /base/styles.css.
function fontAssetPath() {
  return (request, _response, next) => {
    if (request.url.startsWith('/base/media/')) request.url = request.url.slice(5);
    next();
  };
}

module.exports = function (config) {
  config.set({
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage'),
      { 'middleware:font-asset-path': ['factory', fontAssetPath] },
    ],
    beforeMiddleware: ['font-asset-path'],
    reporters: ['dots'],
    browsers: ['ChromeHeadless'],
    restartOnFileChange: true,
  });
};
