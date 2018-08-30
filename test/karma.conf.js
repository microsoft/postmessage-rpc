const path = require('path');

module.exports = config => {
  const isBrowserstack = Boolean(process.env.USE_BROWSER_STACK);
  const launchers = {
    bsFirefox: {
      base: 'BrowserStack',
      browser: 'firefox',
      os: 'Windows',
      os_version: '10',
    },
    bsSafari: {
      base: 'BrowserStack',
      browser: 'safari',
      os: 'OS X',
      os_version: 'High Sierra',
    },
    bsEdge: {
      base: 'BrowserStack',
      browser: 'edge',
      browser_version: '14',
      os: 'Windows',
      os_version: '10',
    },
    bsChrome: {
      base: 'BrowserStack',
      browser: 'chrome',
      os: 'Windows',
      os_version: '10',
    },
  };

  config.set({
    /**
     * General base config:
     */
    basePath: path.join(__dirname, '..'),
    frameworks: ['mocha'],
    reporters: isBrowserstack ? ['mocha', 'BrowserStack'] : ['mocha', 'coverage-istanbul'],
    browserStack: {},
    coverageIstanbulReporter: {
      reports: ['text-summary', 'html'],
      // fixWebpackSourcePaths: true,
      dir: path.join(__dirname, '../coverage'),
    },

    client: {
      mocha: {
        timeout: 10000,
      },
    },

    customLaunchers: launchers,

    plugins: [
      require('karma-mocha'),
      require('karma-mocha-reporter'),
      require('karma-chrome-launcher'),
      require('karma-browserstack-launcher'),
      require('karma-webpack'),
      require('karma-coverage-istanbul-reporter'),
    ],

    /**
     * Webpack and bundling config:
     */
    webpack: require('./webpack.config'),
    webpackServer: { noInfo: true },
    webpackMiddleware: { stats: 'errors-only' },
    files: ['test/karma.shim.js'],
    preprocessors: { 'test/karma.shim.js': ['webpack'] },

    /**
     * Karma run config:
     */
    browsers: isBrowserstack ? Object.keys(launchers) : ['ChromeHeadless'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    singleRun: true,

    mochaReporter: {
      showDiff: true,
    },
  });
};
