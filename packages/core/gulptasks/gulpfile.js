const gulp = require("gulp");
const path = require("path");
const requireDir = require("require-dir");
const argparse = require("argparse");

const config = require("./config");
const {
  del, exec, execFile, execFileAndReport, cprp,
  cprpdir, defineTask, spawn, sequence, mkdirp, fs,
} = require("./util");

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
