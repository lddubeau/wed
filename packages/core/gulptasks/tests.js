const gulp = require("gulp");
const log = require("fancy-log");
const shell = require("shell-quote");
const versync = require("versync");
const Promise = require("bluebird");

const glob = Promise.promisify(require("glob"));

const { options, internals: { devBins } } = require("./config");
const { defineTask, execFileAndReport, sequence, spawn } = require("./util");

gulp.task("build-test-files",
          () => execFileAndReport("npm", ["run", "build-test-files"]));

const lint = {
  name: "lint",
  deps: [],
  func: () => execFileAndReport("npm", ["run", "lint"]),
};
defineTask(lint);

function runKarma(localOptions) {
  // We cannot let it be set to ``null`` or ``undefined``.
  if (options.browsers) {
    localOptions = localOptions.concat("--browsers", options.browsers);
  }
  return spawn(`${devBins}/karma`, localOptions, { stdio: "inherit" });
}

const testKarma = {
  name: "test-karma",
  deps: ["default", "build-test-files"],
  func: () => runKarma(["start", "--single-run"]),
};
defineTask(testKarma);

const testKarmaWebpack = {
  name: "test-karma-webpack",
  deps: ["build-prod", "build-test-files"],
  func: () => runKarma(["start", "karma-webpack.conf.js", "--single-run"]),
};
defineTask(testKarmaWebpack);

exports.test = sequence("test", lint, testKarma, testKarmaWebpack,
                        function *done() {
                          if (!options.skip_semver) {
                            yield versync.run({
                              onMessage: log,
                            });
                          }
                        });

// Features is an optional array of features to run instead of running all
// features.
function selenium(features) {
  let args = options.behave_params ? shell.parse(options.behave_params) : [];

  // We check what we obtained from `behave_params` too, just in case someone is
  // trying to select a specific feature though behave_params.
  if (args.filter(x => /\.feature$/.test(x)).length === 0 && !features) {
    args.push("selenium_test");
  }

  if (features) {
    args = features.concat(args);
  }

  return spawn("behave", args, { stdio: "inherit" });
}

const seleniumTest = {
  name: "selenium-test",
  deps: ["build", "build-test-files"],
  func: () => selenium(),
};
defineTask(seleniumTest);

for (const feature of glob.sync("selenium_test/*.feature")) {
  gulp.task(feature, seleniumTest.deps, () => selenium([feature]));
}
exports.seleniumTest = seleniumTest;
