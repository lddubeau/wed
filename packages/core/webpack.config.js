"use strict";

/* global __dirname */

const path = require("path");

const { NormalModuleReplacementPlugin } = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const buildDir = "build/standalone/lib/";

const externals = {};

//
// The decision between what should remain "external" and what should be
// included in the bundle is a bit arbitrary.
//
// For each library, we must ask, is it going to be a problem, if the library is
// part of the bundle and used in code that co-exists with wed? A good example
// is jQuery. Mixing multiple jQuery instances on the same page is *doable* but
// it can have some undesirable side-effects. So we keep it external.
//
// On the other hand there are libraries that are mainly computational utilities
// like "merge-options" where it does not matter whether the other frameworks
// running on the same page use different versions.
//
// In all cases, there may be duplication/size considerations but these are
// different from context to context, and this is where different usages call
// for custom builds.
//
["jquery",
 "bootstrap",
 "inversify",
 "log4javascript",
 "font-awesome",
 "localforage",
 "bootbox",
 "typeahead",
 "bloodhound",
 "interactjs",
 "bluebird",
 "bootstrap-notify",
 "dexie",
].forEach((name) => {
  externals[name] = name;
});

module.exports = {
  mode: "production",
  resolve: {
    modules: [buildDir, "node_modules"],
    alias: {
      "rangy-textrange": "rangy/lib/rangy-textrange",
    },
  },
  entry: {
    // We have to use the test entry point to build our bundle.
    wed: "tests/entry.js",
  },
  module: {
    rules: [{
      test: /\.js$/,
      use: ["source-map-loader"],
      enforce: "pre",
    }],
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
    // This causes webpack to load wed/glue/rangy-glue whenever rangy is
    // required. Except that in rangy-glue.js when rangy is required, rangy is
    // loaded.
    new NormalModuleReplacementPlugin(/^rangy$/, (resource) => {
      if (resource.contextInfo.issuer !==
          path.join(__dirname, "build/standalone/lib/wed/glue/rangy-glue.js")) {
        resource.request = "wed/glue/rangy-glue";
      }
    }),
    new CopyWebpackPlugin([
      "wed/{glue,patches,polyfills,modes}/**/*",
      "../kitchen-sink.html", "kitchen-sink.js", "../doc/**/*",
      "global-config.js", "wed/**/*.css",
      "wed/less-inc/**/*"].map(name => ({
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
