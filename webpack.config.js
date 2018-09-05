"use strict";

/* global __dirname */

const CopyWebpackPlugin = require("copy-webpack-plugin");

const buildDir = "build/standalone/lib/";

const externals = {};

["jquery",
 "bootstrap",
 "inversify",
 "log4javascript",
 "font-awesome",
 "xregexp",
 "localforage",
 "bootbox",
 "typeahead",
 "bloodhound",
 "interactjs",
 "merge-options",
 "is-plain-obj",
 "bluebird",
 "last-resort",
 "rangy",
 "rangy-core",
 "rangy-textrange",
 "salve",
 "salve-dom",
 "bootstrap-notify",
 "dexie",
 "bluejax",
 "bluejax.try",
 "ajv",
 // onerror must be loadable outside wed...
 "onerror",
 // log is used by onerror
 "log",
].forEach((name) => {
  externals[name] = name;
});

module.exports = {
  mode: "production",
  resolve: {
    modules: [buildDir, "node_modules"],
  },
  entry: {
    wed: "wed.js",
  },
  externals,
  devtool: "source-map",
  output: {
    path: `${__dirname}/build/packed/lib`,
    filename: "[name].js",
    sourceMapFilename: "[name].map.js",
    library: "wed",
    libraryTarget: "amd",
  },
  plugins: [
    new CopyWebpackPlugin([
      "wed/{glue,patches,polyfills,modes,savers}/**/*",
      "{requirejs,external}/*", "{requirejs,external}/!(rxjs)/**/*",
      "../kitchen-sink.html", "../requirejs-config.js", "kitchen-sink.js",
      "../doc/**/*", "global-config.js", "json.js", "wed/**/*.css",
      "wed/less-inc/**/*", "wed/{onerror,log}.*"].map(name => ({
        // Using an object with a "glob" field forces CopyWebpackPlugin to treat
        // all patterns as globs and simplifies the logic a bit. Otherwise, we'd
        // have to have a "to" field to switch where we put the results of some
        // copies.
        from: {
          glob: name,
        },
        context: "./build/standalone/lib",
      }))),
  ],
};
