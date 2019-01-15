/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
// This is a convention we use to provide a kind of generic configuration that
// can be modified before actually configuring SystemJS. The fact is that
// SystemJS (contrarily to RequireJS) does not handle changing the baseURL.
// See: https://github.com/systemjs/systemjs/issues/1208#issuecomment-215707469
window.systemJSConfig = {
  baseURL: "lib/",
  pluginFirst: true,
  paths: {
    "npm:": "../../node_modules/",
  },
  map: {
    json: "top-npm:systemjs-plugin-json",
    jquery: "top-npm:jquery",
    log4javascript: "top-npm:log4javascript",
    "font-awesome": "top-npm:font-awesome",
    bootbox: "top-npm:bootbox",
    typeahead: "top-npm:corejs-typeahead/dist/typeahead.jquery.js",
    bloodhound: "top-npm:corejs-typeahead/dist/bloodhound.js",
    interact: "top-npm:interact",
    "merge-options": "top-npm:merge-options/index.js",
    "is-plain-obj": "top-npm:is-plain-obj/index.js",
    bluebird: "top-npm:bluebird/js/browser/bluebird.js",
    "last-resort": "top-npm:last-resort",
    "rangy-core": "top-npm:rangy/lib/rangy-core",
    "rangy-textrange": "top-npm:rangy/lib/rangy-textrange",
    salve: "top-npm:salve/salve.min.js",
    "salve-dom": "top-npm:salve-dom",
    "bootstrap-notify": "top-npm:bootstrap-notify",
    dexie: "top-npm:dexie",
    fetchiest: "top-npm:fetchiest",
    ajv: "top-npm:ajv/dist/ajv.bundle.js",
    diff: "top-npm:diff/dist/diff.js",
    rxjs: "top-npm:rxjs",
    "rxjs/operators": "top-npm:rxjs/operators/index.js",
    "rxjs/operators/": "top-npm:rxjs/operators/",
    inversify: "top-npm:inversify",
    interactjs: "top-npm:interactjs",
    "@wedxml/": "npm:@wedxml/",
    rangy: "wed/glue/rangy-glue.js",
    bootstrap: "wed/patches/bootstrap.js",
  },
  meta: {
    "top-npm:bootbox/*": {
      // We must add bootstrap here because bootbox does not list
      // it as a dependency.
      deps: ["bootstrap"],
    },
    "top-npm:bootstrap/dist/js/bootstrap.js": {
      format: "global",
      deps: ["jquery"],
      exports: "$",
    },
    "wed/modes/generic/metadata-schema.json": {
      loader: "json",
    },
    "wed/wed-options-schema.json": {
      loader: "json",
    },
    "npm:@wedxml/client-api/options-schema.json": {
      loader: "json",
    },
  },
  packages: {
    // We use this to specify a default extension of ".js". Yep, this is enough
    // because if `defaultExtension` is not explicitly set it default to ".js"!
    "": {},
    "wed/glue/rangy-glue.js": {
      map: {
        rangy: "rangy-core",
      },
    },
    "wed/patches/bootstrap.js": {
      map: {
        bootstrap: "top-npm:bootstrap/dist/js/bootstrap.js",
      },
    },
  },
  packageConfigPaths: [
    "top-npm:*/package.json",
    "npm:*/package.json",
    "npm:@wedxml/*/package.json",
  ],
};

//  LocalWords:  popup onerror findandself jQuery Dubeau MPL Mangalam
//  LocalWords:  txt tei ajax jquery
