/**
 * @module kitchen-sink
 * @desc A demo module for wed
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
/* global Promise */
define(function f(require) {
  "use strict";

  var wed = require("wed");
  var $ = require("jquery");
  var lr = require("last-resort");
  var globalConfig = require("global-config");
  var mergeOptions = require("merge-options");

  // This installs last-resort on our current window and registers with it
  // wed's error handler.
  var onError = lr.install(window);
  onError.register(wed.onerror.handler);

  var url = new URL(window.location.href);
  var query = url.searchParams;
  var mode = query.get("mode");
  var file = query.get("file");
  var schema = query.get("schema");
  var options_param = query.get("options");
  var fetchOptions = query.get("fetchOptions");

  function fetched(options) {
    if (mode) {
      options.mode = { path: mode };
    }

    if (schema) {
      switch (schema) {
      case "@math":
        options.schema = "../../schemas/tei-math-rng.js";
        options.mode = {
          path: "wed/modes/generic/generic",
          options: {
            metadata: "../../schemas/tei-math-metadata.json",
          },
        };
        break;
      case "@docbook":
        options.schema = "../../schemas/docbook.js";
        options.mode = {
          path: "wed/modes/generic/generic",
          options: {
            metadata: "../../schemas/docbook-metadata.json",
          },
        };
        break;
      default:
        options.schema = schema;
      }
    }

    if (options_param === "noautoinsert") {
      options.mode.options = { autoinsert: false };
    }

    if (options_param === "ambiguous_fileDesc_insert") {
      options.mode.options = { ambiguous_fileDesc_insert: true };
    }

    if (options_param === "fileDesc_insert_needs_input") {
      options.mode.options = { fileDesc_insert_needs_input: true };
    }

    if (options_param === "hide_attributes") {
      options.mode.options = { hide_attributes: true };
    }

    Promise.resolve()
      .then(function loadFile() {
        return file ? fetch(file) : undefined;
      })
      .then(function getText(resp) {
        return resp ? resp.text() : undefined;
      })
      .then(function start(text) {
        $(function ready() {
          var widget = document.getElementById("widget");
          var finalOptions = mergeOptions({}, globalConfig.config, options);
          window.wed_editor = wed.makeEditor(widget, finalOptions, {
            url: "/build/ajax/save.txt",
          });
          window.wed_editor.init(text);
        });
      });
  }

  if (fetchOptions) {
    // eslint-disable-next-line import/no-dynamic-require
    require([fetchOptions], function loaded(module) {
      fetched(module.config);
    });
  }
  else {
    fetched({});
  }
});
