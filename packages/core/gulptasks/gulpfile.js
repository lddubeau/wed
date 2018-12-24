const gulp = require("gulp");
const Promise = require("bluebird");
const path = require("path");
const log = require("fancy-log");
const requireDir = require("require-dir");
const replace = require("gulp-replace");
const argparse = require("argparse");
const touch = require("touch");

const config = require("./config");
const {
  del, newer, exec, execFile, execFileAndReport, checkOutputFile, cprp,
  cprpdir, defineTask, spawn, sequence, mkdirp, fs, stampPath,
} = require("./util");

const { internals: { devBins } } = config;

const { test, seleniumTest } = require("./tests");

const { ArgumentParser } = argparse;

// Try to load local configuration options.
let localConfig = {};
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  localConfig = require("../gulp.local");
}
catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") {
    throw e;
  }
}

const parser = new ArgumentParser({ addHelp: true });

// eslint-disable-next-line guard-for-in
for (const prop in config.optionDefinitions) {
  const optionOptions = config.optionDefinitions[prop];
  const localOverride = localConfig[prop];
  if (localOverride !== undefined) {
    optionOptions.defaultValue = localOverride;
  }

  const optionName = prop.replace(/_/g, "-");
  parser.addArgument([`--${optionName}`], optionOptions);
}

// We have this here so that the help message is more useful than
// without. At the same time, this positional argument is not
// *required*.
parser.addArgument(["target"], {
  help: "Target to execute.",
  nargs: "?",
  defaultValue: "default",
});

const { options } = config;
Object.assign(options, parser.parseArgs(process.argv.slice(2)));

// We purposely import the files there at this point so that the
// configuration is set once and for all before they execute. Doing
// this allows having code that depends on the configuration values.
requireDir(".");


gulp.task("config", () => execFileAndReport("npm", ["run", "config"]));

const buildDeps = ["build-standalone", "build-bundled-doc"];
if (options.optimize) {
  buildDeps.push("webpack");
}
gulp.task("build", buildDeps);

gulp.task("build-standalone-wed",
          () => execFileAndReport("npm", ["run", "build-dev"]));

gulp.task("tsc", () => execFileAndReport("npm", ["run", "tsc"]));

gulp.task("generate-ts",
          () => execFileAndReport("npm", ["run", "generate-ts"]));

gulp.task("stamp-dir", () => mkdirp(config.internals.stampDir));

gulp.task("build-standalone-wed-less",
          () => execFileAndReport("npm", ["run", "less"]));

gulp.task("copy-bin", () => gulp.src("bin/**/*")
          // Update all paths that point into the build directory be relative
          // to .. instead.
          .pipe(replace("../build/", "../"))
          .pipe(gulp.dest("build/bin")));

gulp.task("build-info", Promise.coroutine(function *task() {
  const dest = "build/standalone/lib/wed/build-info.js";
  yield mkdirp(path.dirname(dest));

  yield exec("node tasks/generate_build_info.js --unclean " +
             `--module > ${dest}`);
}));

gulp.task("build-samples", () => execFileAndReport("tasks/make-samples"));

gulp.task("build-web", () => execFileAndReport("npm", ["run", "copy-web"]));

gulp.task("build-standalone",
          [].concat(
            "build-standalone-wed",
            "build-standalone-wed-less",
            "config",
            "copy-bin",
            "build-web",
            "build-schemas",
            "build-samples",
            "build-info"),
          () => mkdirp("build/ajax"));

gulp.task("build-bundled-doc", ["build-standalone"],
          Promise.coroutine(function *task() {
            // The strategy here is to remove everything except what is in the
            // help.rst ifle, which becomes index.rst and is modified to deal
            // with a theme bug.

            const stamp = stampPath("bundled-doc");
            const buildBundledDoc = "build/bundled-doc";
            const standaloneDoc = "build/standalone/doc";

            const isNewer = yield newer("doc/**/*", stamp);

            if (!isNewer) {
              log("Skipping generation of bundled documentation.");
              return;
            }

            yield del([buildBundledDoc, standaloneDoc]);
            yield cprp("doc", buildBundledDoc);

            // help.rst becomes our index.rst.
            yield cprp("doc/help.rst", path.join(buildBundledDoc, "index.rst"));

            // Then we keep only the index and make that.
            yield del(["*.rst", "!index.rst"], { cwd: buildBundledDoc });
            yield exec(`make -C ${buildBundledDoc} html`);
            yield fs.rename(path.join(buildBundledDoc, "_build/html"),
                            standaloneDoc);
            yield touch(stamp);
          }));

gulp.task("webpack", ["build-standalone"],
          () => execFileAndReport(`${devBins}/webpack`, ["--color"],
                                  { maxBuffer: 300 * 1024 }));

gulp.task("default", ["build"]);

gulp.task("doc", ["typedoc"]);

// We make this a different task so that the check can be performed as
// early as possible.
gulp.task("gh-pages-check", Promise.coroutine(function *task() {
  let [out] = yield checkOutputFile("git",
                                    ["rev-parse", "--abbrev-ref", "HEAD"]);
  out = out.trim();
  if (out !== "master" && !options.force_gh_pages_build) {
    throw new Error(`***
Not on master branch. Don't build gh-pages-build on
a branch other than master.
***`);
  }

  if (!options.unsafe_deployment) {
    // We use this only for the side effect it has:
    // it fails of the current working directory is
    // unclean.
    yield exec("node ./tasks/generate_build_info.js > /dev/null");
  }
}));

function *ghPages() {
  const dest = "gh-pages";
  const merged = "build/merged-gh-pages";
  yield fs.emptyDir(dest);
  yield del(merged);
  yield cprp("doc", merged);

  // Yep we invoke make on the documentation.
  yield exec(`make -C ${merged} html`);

  yield exec(`cp -rp ${merged}/_build/html/* build/api ${dest}`);

  const destBuild = `${dest}/build`;
  yield mkdirp(destBuild);
  yield cprpdir(["build/samples", "build/schemas", "build/standalone",
                 "build/packed"], destBuild);

  for (const tree of ["standalone", "packed"]) {
    const globalConfig = `${dest}/build/${tree}/lib/global-config.js`;
    yield fs.move(globalConfig, `${globalConfig}.t`);
    yield exec("node tasks/modify_config.js -d config.ajaxlog -d config.save " +
               `${globalConfig}.t > ${globalConfig}`);
  }

  const tutorialData = `${dest}/tutorial_data`;
  yield cprpdir("build/standalone/lib/tests/wed_test_data/unit_selection.xml",
                tutorialData);
}

gulp.task("gh-pages", ["gh-pages-check", "default", "doc"],
          Promise.coroutine(ghPages));

const LATEST_DIST = "./build/LATEST-DIST.tgz";
const packNoTest = {
  name: "pack-notest",
  deps: ["build-standalone", "webpack"],
  *func() {
    yield del("build/wed-*.tgz");
    const dist = "build/dist";
    yield fs.emptyDir(dist);
    yield cprpdir(["build/standalone", "build/packed", "build/bin",
                   "package.json", "npm-shrinkwrap.json"],
                  dist);
    yield fs.writeFile(path.join(dist, ".npmignore"), `\
*
!standalone/**
!bin/**
!packed/**
standalone/lib/tests/**
`);
    yield exec(`sed -e'/"private": true/d' package.json > \
${dist}/package.json`);
    yield cprp("README.md", `${dist}/README.md`);
    const { stdout } = yield execFile("npm", ["pack"],
                                      { cwd: dist, maxBuffer: 500 * 1024 });
    const packname = stdout.trim();
    const buildPack = `build/${packname}`;
    yield fs.rename(`${dist}/${packname}`, buildPack);
    yield del(LATEST_DIST);
    yield fs.symlink(packname, LATEST_DIST);
    const tempPath = "build/t";
    yield del(tempPath);
    yield mkdirp(`${tempPath}/node_modules`);
    yield spawn("npm", ["install", `../${packname}`], { cwd: tempPath });
    yield del(tempPath);
  },
};
defineTask(packNoTest);

sequence("pack", test, seleniumTest, packNoTest);

function publish() {
  // We have to execute this in the directory where the pack is located.
  return spawn("npm", ["publish", "LATEST_DIST.tgz"], {
    stdio: "inherit",
    cwd: "./build",
  });
}

gulp.task("publish", ["pack"], publish);

gulp.task("publish-notest", ["pack-notest"], publish);

gulp.task("clean", () => del(["build", "gh-pages", "*.html"]));

gulp.task("distclean", ["clean"],
          () => del(["downloads", "node_modules"]));

const venvPath = ".venv";
gulp.task("venv", [],
          () => fs.access(venvPath).catch(() => exec("virtualenv .venv")));

gulp.task("dev-venv", ["venv"],
          () => exec(".venv/bin/pip install -r dev_requirements.txt"));
