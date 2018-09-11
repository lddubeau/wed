"use strict";

const path = require("path");

const { makeKarmaMiddleware } = require("../misc/server-util");

const absoluteTopDir = path.join("/absolute", path.resolve(__dirname, "../.."));
module.exports = (config) => {
  const options = {
    basePath: ".",
    plugins: [
      "karma-*", // This is the default, which we need to keep here.
      { "middleware:serve-static": ["factory", makeKarmaMiddleware] },
    ],
    frameworks: ["mocha", "chai"],
    middleware: ["serve-static"],
    client: {
      mocha: {
        grep: config.grep,
      },
      absoluteTopDir,
    },
    reportSlowerThan: 200,
    files: [
      "../../node_modules/reflect-metadata/Reflect.js",
      "../../node_modules/systemjs/dist/system.src.js",
      "test/karma-main.js",
      { pattern: "build/dist/**/*.@(js|json|map)", included: false },
      { pattern: "test/**/*.ts", included: false },
      { pattern: "test/data/**/*", included: false },
    ],
    serveStatic: [{
      fsPath: "./node_modules",
      baseURL: "/base/node_modules/",
    }, {
      fsPath: "../../node_modules",
      baseURL: `${absoluteTopDir}/node_modules/`,
    }],
    preprocessors: {
      "test/**/*.ts": ["typescript"],
    },
    typescriptPreprocessor: {
      tsconfigPath: "./test/tsconfig.json",
      compilerOptions: {
        // eslint-disable-next-line global-require, import/no-extraneous-dependencies
        typescript: require("typescript"),
        sourceMap: false,
        // We have to have them inline for the browser to find them.
        inlineSourceMap: true,
        inlineSources: true,
      },
    },
    reporters: ["progress"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browserStack: {
    },
    browsers: ["ChromeHeadless", "FirefoxHeadless"],
    customLaunchers: {
      ChromeWin: {
        base: "BrowserStack",
        browser: "Chrome",
        os: "Windows",
        os_version: "10",
      },
      FirefoxWin: {
        base: "BrowserStack",
        browser: "Firefox",
        os: "Windows",
        os_version: "10",
      },
      Edge: {
        base: "BrowserStack",
        browser: "Edge",
        os: "Windows",
        os_version: "10",
      },
      Opera: {
        base: "BrowserStack",
        browser: "Opera",
        os: "Windows",
        os_version: "10",
      },
      SafariHighSierra: {
        base: "BrowserStack",
        browser: "Safari",
        os: "OS X",
        os_version: "High Sierra",
      },
      SafariSierra: {
        base: "BrowserStack",
        browser: "Safari",
        os: "OS X",
        os_version: "Sierra",
      },
    },
    singleRun: false,
  };

  let localConfig = {
    browserStack: {},
  };

  if (process.env.CONTINUOUS_INTEGRATION) {
    // Running on Travis. Grab the configuration from Travis.
    localConfig.browserStack = {
      // Travis provides the tunnel.
      startTunnel: false,
      tunnelIdentifier: process.env.BROWSERSTACK_LOCAL_IDENTIFIER,
      // Travis adds "-travis" to the name, which mucks things up.
      username: process.env.BROWSERSTACK_USER.replace("-travis", ""),
      accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
    };
  }
  else {
    // Running outside Travis: we get our configuration from
    // ../../local-config/config.js, if it exists.
    try {
      // eslint-disable-next-line import/no-unresolved, global-require
      localConfig = require("../local_config/config");
    }
    catch (ex) {} // eslint-disable-line no-empty
  }

  // Merge the browserStack configuration we got with the base values in our
  // config.
  Object.assign(options.browserStack, localConfig.browserStack);

  const { browsers } = config;
  if (browsers.length === 1 && browsers[0] === "all") {
    const newList = options.browsers.concat(Object.keys(options.customLaunchers));

    // Yes, we must modify this array in place.
    // eslint-disable-next-line prefer-spread
    browsers.splice.apply(browsers, [0, browsers.length].concat(newList));
  }

  return options;
};
