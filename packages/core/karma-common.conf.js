"use strict";

const path = require("path");

const { makeKarmaMiddleware } = require("../../misc/server-util");

// This is a middleware that just serves empty files for fake css files we use
// in testing (/a.css, /b.css, etc.)
function makeCssMiddleware(/* config */) {
  return function handle(req, resp, next) {
    if (/^\/.*\.css$/.test(req.url)) {
      resp.end("");
    }
    else {
      next();
    }
  };
}

const absoluteTopDir = path.join("/absolute", path.resolve(__dirname, "../.."));
module.exports = function configure(config, dist, specificMain) {
  return {
    basePath: "",
    middleware: ["serve-fake-css-files", "serve-static"],
    plugins: [
      "karma-*", // This is the default, which we need to keep here.
      { "middleware:serve-fake-css-files": ["factory", makeCssMiddleware] },
      { "middleware:serve-static": ["factory", makeKarmaMiddleware] },
    ],
    frameworks: ["mocha", "chai", "source-map-support"],
    client: {
      mocha: {
        grep: config.grep,
      },
      absoluteTopDir,
    },
    files: [
      "../../node_modules/systemjs/dist/system.src.js",
      "../../node_modules/reflect-metadata/Reflect.js",
      "config/system.config.js",
      `src/tests/${specificMain}.js`,
      "src/tests/karma-main.js",
      "../../node_modules/font-awesome/css/font-awesome.min.css",
      "../../node_modules/bootstrap/dist/css/bootstrap.min.css",
      "../../node_modules/typeahead.js-bootstrap-css/typeaheadjs.css",
      `${dist}lib/wed/wed.css`,
      { pattern: "build/schemas/**/*.@(js|json)", included: false },
    ],
    serveStatic: [{
      fsPath: "./node_modules",
      baseURL: "/base/node_modules/",
    }, {
      fsPath: "../../node_modules",
      baseURL: `${absoluteTopDir}/node_modules/`,
    }],
    exclude: [],
    preprocessors: {},
    reporters: ["mocha"],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ["ChromeHeadless"],
    singleRun: false,
    concurrency: Infinity,
  };
};
