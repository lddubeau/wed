const gulp = require("gulp");
const Promise = require("bluebird");
const path = require("path");
const requireDir = require("require-dir");
const argparse = require("argparse");

const config = require("./config");
const {
  del, exec, execFile, execFileAndReport, checkOutputFile, cprp,
  cprpdir, defineTask, spawn, sequence, mkdirp, fs,
} = require("./util");

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

gulp.task("generate-ts",
          () => execFileAndReport("npm", ["run", "generate-ts"]));

gulp.task("stamp-dir", () => mkdirp(config.internals.stampDir));

gulp.task("default", () => execFileAndReport("npm", ["run", "build-dev"]));

gulp.task("build-prod", () => execFileAndReport("npm", ["run", "build-prod"]));

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
