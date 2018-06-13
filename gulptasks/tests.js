const gulp = require("gulp");
const log = require("fancy-log");
const path = require("path");
const glob = require("glob");
const shell = require("shell-quote");
const eslint = require("gulp-eslint");
const versync = require("versync");
const Promise = require("bluebird");

const { options } = require("./config");
const {
  checkOutputFile, cprp, defineTask, existsInFile, mkdirp, newer,
  sequence, spawn,
} = require("./util");

const convertXMLDirs = glob.sync("lib/tests/*_test_data")
        .filter(x => x !== "lib/tests/convert_test_data");

gulp.task("convert-xml-test-files", (callback) => {
  const promises = [];
  gulp.src(convertXMLDirs.map(x => `${x}/**`),
           { base: "lib/tests", read: false, nodir: true })
    .on("data", (file) => {
      const p = Promise.coroutine(function *dataPromise() {
        const ext = path.extname(file.relative);
        const destName = path.join(
          "build/standalone/lib/tests",
          file.relative.substring(0, file.relative.length - ext.length));
        const dest = `${destName}_converted.xml`;

        const tei = yield existsInFile(file.path,
                                       /http:\/\/www.tei-c.org\/ns\/1.0/);

        let isNewer;
        let xsl;
        if (tei) {
          xsl = "lib/tests/xml-to-xml-tei.xsl";
          isNewer = yield newer([file.path, xsl], dest);
        }
        else {
          isNewer = yield newer(file.path, dest);
        }

        if (!isNewer) {
          return;
        }

        if (tei) {
          yield checkOutputFile(options.xsltproc,
                                ["-o", dest, xsl, file.path]);
        }
        else {
          yield mkdirp(path.dirname(dest));
          yield cprp(file.path, dest);
        }
      })();
      promises.push(p);
    })
    .on("end", () => {
      Promise.all(promises).asCallback(callback);
    });
});

gulp.task("build-test-files", ["convert-xml-test-files"]);

// function runTslint(program) {
//   const files = tslint.Linter.getFileNames(program);
//   ts.getPreEmitDiagnostics(program);
//   return gulp.src(files)
//     .pipe(gulpTslint({
//       formatter: "verbose",
//       program,
//     }))
//     .pipe(gulpTslint.report({
//       summarizeFailureOutput: true,
//     }));
// }

function runTslint(tsconfig) {
  // We do not need to pass the path to the tslint.json because when tslint
  // lints a file it automatically looks up for the tslint.json file that
  // governs it. (Looks up the directory chain.)
  return spawn("./node_modules/.bin/tslint",
               ["--project", tsconfig, "-t", "verbose"], { stdio: "inherit" });
}

gulp.task("tslint-wed", ["generate-ts"], () => runTslint("lib/tsconfig.json"));

gulp.task("tslint", ["tslint-wed"]);

gulp.task("eslint", () =>
          gulp.src(["lib/**/*.js", "*.js", "bin/**", "config/**/*.js",
                    "web/**/*.js", "gulptasks/**/*.js", "misc/**/*.js"])
          .pipe(eslint())
          .pipe(eslint.format())
          .pipe(eslint.failAfterError()));

const lint = {
  name: "lint",
  deps: ["eslint", "tslint"],
};
defineTask(lint);

function runKarma(localOptions) {
  // We cannot let it be set to ``null`` or ``undefined``.
  if (options.browsers) {
    localOptions = localOptions.concat("--browsers", options.browsers);
  }
  return spawn("./node_modules/.bin/karma", localOptions, { stdio: "inherit" });
}

const testKarma = {
  name: "test-karma",
  deps: ["build-standalone", "build-test-files"],
  func: () => runKarma(["start", "--single-run"]),
};
defineTask(testKarma);

const testKarmaWebpack = {
  name: "test-karma-webpack",
  deps: ["webpack", "build-test-files"],
  func: () => runKarma(["start", "karma-webpack.conf.js", "--single-run"]),
};
defineTask(testKarmaWebpack);

exports.test = sequence("test", lint, testKarma, testKarmaWebpack,
                        function *done() {
                          if (!options.skip_semver) {
                            yield versync.run({
                              verify: true,
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
