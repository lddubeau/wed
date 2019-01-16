/* global Promise SystemJS */
(function main() {
  "use strict";

  // Cancel the autorun. This essentially does the magic that the RequireJS
  // adapter (and maybe the SystemJS adapter too) do behind the scenes. We call
  // window.__karma__.start later.
  window.__karma__.loaded = function loaded() {};

  const karmaBaseUrl = "/base/build/dist/";

  const allTestFiles = [];
  const TEST_REGEXP = /test\/.*[-_]test\.js$/i;
  const REPLACE_REGEXP =
        new RegExp(`^${karmaBaseUrl.replace(/\//g, "\\/")}|\\.js$`, "g");

  // Get a list of all the test files to include.
  for (const file of Object.keys(window.__karma__.files)) {
    if (TEST_REGEXP.test(file)) {
      allTestFiles.push(file.replace(REPLACE_REGEXP, ""));
    }
  }

  // This turns on logic used only in testing.
  window.__WED_TESTING = {
    testing: true,
  };

  const { absoluteTopDir } = window.__karma__.config;
  const config = {
    baseURL: karmaBaseUrl,
    paths: {
      "npm:": "/base/node_modules/",
      "top-npm:": `${absoluteTopDir}/node_modules/`,
    },
    map: {
      inversify: "top-npm:inversify",
      sinon: "top-npm:sinon/pkg/sinon",
      "sinon-chai": "top-npm:sinon-chai/lib/sinon-chai",
      "@wedxml/": "npm:@wedxml/",
      dexie: "top-npm:dexie",
      "merge-options": "top-npm:merge-options/index.js",
      "is-plain-obj": "top-npm:is-plain-obj/index.js",
      jquery: "top-npm:jquery",
      bootstrap: "top-npm:bootstrap",
      fetchiest: "top-npm:fetchiest",
      "expect-rejection": "top-npm:expect-rejection",
    },
    packages: {
      "": {},
    },
    packageConfigPaths: [
      "top-npm:*/package.json",
      "npm:*/package.json",
      "npm:@wedxml/*/package.json",
    ],
  };

  SystemJS.config(config);

  // These are preloaded by Karma as scripts that leak into the global space.
  SystemJS.amdDefine("mocha.js", [], {});
  SystemJS.amdDefine("chai.js", [], window.chai);

  window.define = SystemJS.amdDefine;
  window.require = window.requirejs = SystemJS.amdRequire;

  function importIt(file) {
    return SystemJS.import(file);
  }

  Promise.all(allTestFiles.map(importIt)).then(window.__karma__.start);
}());
