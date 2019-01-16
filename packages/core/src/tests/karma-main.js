/* global Promise Mocha karmaTestType SystemJS */
(function main() {
  "use strict";

  // Cancel the autorun. This essentially does the magic that the RequireJS
  // adapter (and maybe the SystemJS adapter too) do behind the scenes. We call
  // window.__karma__.start later.
  window.__karma__.loaded = function loaded() {};

  var baseUrlMap = {
    unit: "/base/build/dist/dev/lib/",
    webpack: "/base/build/dist/packed/lib/",
  };
  var karmaBaseUrl = baseUrlMap[karmaTestType];

  if (karmaBaseUrl === undefined) {
    throw new Error("cannot determine karmaBaseUrl from test type: " +
                    karmaTestType);
  }

  var allTestFiles = [];
  var TEST_REGEXP = /tests(?:\/.*)?\/.*[-_]test\.js$/i;
  // We need to exclude wed_test.js.
  var WED_REGEXP = /\/wed_test\.js$/i;
  var REPLACE_REGEXP = new RegExp("^" + karmaBaseUrl.replace(/\//g, "\\/") +
                                  "|\\.js$", "g");

  // Get a list of all the test files to include.
  Object.keys(window.__karma__.files).forEach(function each(file) {
    if (TEST_REGEXP.test(file) && !WED_REGEXP.test(file)) {
      var normalizedTestModule = file.replace(REPLACE_REGEXP, "");
      allTestFiles.push(normalizedTestModule);
    }
  });

  // This turns on logic used only in testing.
  window.__WED_TESTING = {
    testing: true,
  };


  var absoluteTopDir = window.__karma__.config.absoluteTopDir;
  var config = window.systemJSConfig;
  config.baseURL = karmaBaseUrl;
  config.paths["npm:"] = "/base/node_modules/";
  config.paths["top-npm:"] = absoluteTopDir + "/node_modules/";
  config.map.sinon = "top-npm:sinon/pkg/sinon";
  config.map["sinon-chai"] = "top-npm:sinon-chai/lib/sinon-chai";
  config.map["blueimp-md5"] = "top-npm:blueimp-md5/js/md5";
  config.map["tests/tree_updater_test_data/source_converted.xml"] =
    "text!tests/tree_updater_test_data/source_converted.xml";
  config.map["expect-rejection"] = "top-npm:expect-rejection";

  if (karmaTestType === "webpack") {
    // When we are testing the webpack bundle, we need to remap the entry module
    // to the actual bundle.
    config.packages["/base/build/dist/dev/lib/tests"] = {
      map: {
        "./entry": "wed.js",
      },
    };
  }

  SystemJS.config(config);

  // These are preloaded by Karma as scripts that leak into the global space.
  SystemJS.amdDefine("mocha.js", [], {});
  SystemJS.amdDefine("chai.js", [], window.chai);

  window.define = SystemJS.amdDefine;
  window.require = window.requirejs = SystemJS.amdRequire;

  function importIt(file) {
    return SystemJS.import(file);
  }

  Promise.all(["last-resort", "wed", "jquery", "bootstrap"].map(importIt))
    .then(function loaded(deps) {
      var lr = deps[0];
      var wed = deps[1];
      var $ = deps[2];
      // Bootstrap sets $.support.transition after the document is ready, so we
      // also have to wait until the document is ready to do our work. Since
      // bootstrap is loaded before us, this will happen after bootstrap does
      // its deed.
      $(function turnOfAnimations() {
        // Turn off all animations.
        $.support.transition = false;
      });

      before(function before() {
        // We need to do this in a before hook because the listener is not added
        // until Mocha starts.
        Mocha.process.removeListener("uncaughtException");
        // We also have to eradicate Karma's on error handler.
        window.onerror = undefined;
      });

      beforeEach(function beforeEach() {
        // We want to reinstall with each test so that the state of the onError
        // object is fresh.
        var onError = lr.install(window, { force: true });
        onError.register(wed.onerror.handler);
      });

      // The effect of the beforeEach handler above is to overwrite Mocha's
      // default unhandled exception handler. So we want to perform our on check
      // after each test.
      afterEach(function afterEach() {
        // We read the state, reset, and do the assertion later so that if the
        // assertion fails, we still have our reset.
        var wasTerminating = wed.onerror.isTerminating();

        // We don't reload our page so we need to do this.
        wed.onerror.__test.reset();

        if (wasTerminating) {
          throw new Error("test caused an unhandled exception to occur");
        }
      });

      // eslint-disable-next-line import/no-dynamic-require
      return Promise.all(allTestFiles.map(importIt));
    })
    .then(window.__karma__.start);
}());
