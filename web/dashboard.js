/**
 * @module files
 * @desc A module to load and manage files stored in localForage.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:files */function f(require) {
  "use strict";

  var localforage_saver = require("wed/savers/localforage");
  var $ = require("jquery");
  var log = require("wed/log");
  var async = require("async");
  var angular = require("angular");
  var bootbox = require("bootbox");
  var browsers = require("wed/browsers");
  require("bootstrap");

  var makeFileRecord = localforage_saver.makeFileRecord;

  var store = localforage_saver.config();

  // The default behavior for bootbox.confirm is to make the default
  // button be the one that says "yes".
  function safe_confirm(message, cb) {
    bootbox.confirm({
      message: message,
      buttons: {
        cancel: {
          label: "No",
          className: "btn-default btn-primary pull-left",
        },
        confirm: {
          label: "Yes",
          className: "btn-danger pull-right",
        },
      },
      callback: cb,
    });
  }

  /**
   * @classdesc An object of this class is instantiated to control the
   * GUI on the ``files.html`` file. One such object is created to
   * control the whole page.
   */
  function Files() {
    var load = document.getElementById("load-file");
    var processing = document.getElementById("processing-modal");
    var clear = document.getElementById("clear-all");
    var new_file = document.getElementById("new-file");
    var download_iframe = document.getElementById("download-iframe");

    var files = angular.module("files", []);
    files.config(function config($provide) {
      // In theory we should be able to return a promise here and in
      // the other functions below rather than use $q(...). However,
      // it is not quite clear how to get Angular to work well with
      // localforage's private promise implementation.
      //
      // See this question for an example with integrating
      // Bluebird's promises with Angular's:
      //
      // http://stackoverflow.com/q/23984471/1906307
      //
      $provide.factory("files-service", ["$q", function factory($q) {
        var ret = {};
        ret.getRecords = function getRecords() {
          return $q(function makePromise(resolve) {
            var result = [];
            store.iterate(function iter(value) {
              result.push(value);
            }, function done() {
              resolve(result);
            });
          });
        };

        ret.deleteRecord = function deleteRecord(record) {
          return store.removeItem(record.name);
        };

        ret.updateRecord = function updateRecord(record) {
          return store.setItem(record.name, record);
        };

        return ret;
      }]);
    });

    var factory = ["$scope", "files-service", function factory($scope,
                                                               files_service) {
      $scope.refresh = function refresh() {
        files_service.getRecords().then(function then(records) {
          $scope.records = records;
        });
      };

      $scope.del = function del(record) {
        safe_confirm("Do you really want to delete '" + record.name + "'?",
                     function done(result) {
                       if (!result) {
                         return;
                       }
                       files_service.deleteRecord(record).then(function then() {
                         $scope.refresh();
                       });
                     });
      };

      $scope.download = function download(record) {
        var file = new window.Blob([record.data], { type: "text/xml" });
        var URL = window.webkitURL || window.URL;
        var downloadUrl = URL.createObjectURL(file);

        // IE
        if (browsers.MSIE) {
          download_iframe.src = downloadUrl;
          var doc = download_iframe.contentDocument;
          doc.close();
          doc.execCommand("SaveAs", true, downloadUrl);
          download_iframe.removeAttribute("src");
        }
        else {
          // This rigmarole allows the download button to
          // **download** rather than open the link in a new window.
          var a = document.createElement("a");
          a.href = downloadUrl;
          a.download = record.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        record.downloaded = new Date();
        files_service.updateRecord(record).then(function then() {
          $scope.refresh();
        });
      };

      $scope.refresh();
    }];

    files.controller("files-controller", factory);

    angular.element(document).ready(function ready() {
      angular.bootstrap(document, ["files"]);
      var ctrl = document.querySelector("[ng-controller=\"files-controller\"]");
      ctrl.style.display = "";
    });

    this._load = load;
    this._processing = processing;
    this._$processing = $(processing);
    this._progress_bar = processing.getElementsByClassName("bar")[0];
    load.addEventListener("change", this.onLoadChange.bind(this));

    this._bound_stopProcessing = this._stopProcessing.bind(this);
    this._controller = angular.element("[ng-controller=\"files-controller\"]");
    this._clear = clear;
    clear.addEventListener("click", this.onClear.bind(this));
    new_file.addEventListener("click", this.onNewFile.bind(this));
  }

  Files.prototype.onLoadChange = log.wrap(function onLoadChange(ev) {
    var files = ev.target.files;
    if (files.length > 0) {
      var ops = [];
      this._startProcessing(files.length);
      for (var i = 0; i < files.length; i++) {
        ops.push(this.loadFile.bind(this, files[i]));
      }
      async.parallel(ops, this._bound_stopProcessing);
      ev.target.value = "";
    }
  });

  Files.prototype.onClear = log.wrap(function onClear() {
    var me = this;
    safe_confirm(
      "Are you sure you want to clear from local storage all the " +
        "files associated with wed?",
      function done(result) {
        if (!result) {
          return;
        }

        store.clear().then(function then() {
          me._controller.scope().$apply("refresh()");
        });
      });
  });

  function writeFileCheck(name, cb) {
    store.getItem(name).then(function then(value) {
      if (value === null) {
        cb(true);
      }
      else {
        safe_confirm("Are you sure you want to overwrite " + name + "?", cb);
      }
    });
  }

  Files.prototype.onNewFile = log.wrap(function onNewFile() {
    var me = this;
    bootbox.prompt("Give a name to your new file", function done(name) {
      if (!name) {
        return;
      }

      writeFileCheck(name, function check(go) {
        if (go) {
          store.setItem(name,
                        makeFileRecord(name, ""),
                        function itemSet() {
                          me._controller.scope().$apply("refresh()");
                        });
        }
      });
    });
  });

  Files.prototype._startProcessing = function _startProcessing(total) {
    this._progress_total = total;
    this._progress_count = 0;
    this._updateProgress();
    this._$processing.modal("show");
  };

  Files.prototype._updateProgress = function _updateProgress() {
    var percent = this._progress_count / this._progress_total * 100;
    this._progress_bar.style.width = "" + percent + "%";
  };

  Files.prototype._stopProcessing = log.wrap(function _stopProcessing() {
    this._$processing.modal("hide");
    this._controller.scope().$apply("refresh()");
  });

  Files.prototype._incrementProgress = function _incrementProgress() {
    this._progress_count++;
    this._updateProgress();
  };

  Files.prototype.loadFile = log.wrap(function loadFile(file, cb) {
    var me = this;

    function finish(err) {
      me._incrementProgress();
      cb(err);
    }

    function load() {
      var reader = new FileReader();
      reader.onload = log.wrap(function onload() {
        store.setItem(file.name, makeFileRecord(file.name, reader.result),
                      finish);
      });
      reader.onerror = finish;
      reader.readAsText(file);
    }

    writeFileCheck(file.name, function done(result) {
      if (result) {
        load();
      }
      else {
        finish();
      }
    });
  });

  new Files(); // eslint-disable-line no-new
});