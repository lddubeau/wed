const gulp = require("gulp");
const gulpNewer = require("gulp-newer");
const gulpFilter = require("gulp-filter");
const less = require("gulp-less");
const rename = require("gulp-rename");
const changed = require("gulp-changed");
const es = require("event-stream");
const vinylFile = require("vinyl-file");
const Promise = require("bluebird");
const path = require("path");
const log = require("fancy-log");
const requireDir = require("require-dir");
const wrapAmd = require("gulp-wrap-amd");
const replace = require("gulp-replace");
const argparse = require("argparse");
const touch = require("touch");
const yaml = require("js-yaml");
const { compile: compileToTS } = require("json-schema-to-typescript");

const config = require("./config");
const {
  del, newer, exec, execFile, execFileAndReport, checkOutputFile, cprp,
  cprpdir, defineTask, spawn, sequence, mkdirp, fs, stampPath,
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


gulp.task("config", () => {
  const dest = "build/config";
  // In effect, anything in localConfigPath overrides the same file in
  // config.
  const configPath = "config";
  const localConfigPath = "local_config";
  return gulp.src(path.join(configPath, "**"), { nodir: true })
    .pipe(es.map((file, callback) =>
                 vinylFile.read(
                   path.join(localConfigPath, file.relative),
                   { base: localConfigPath })
                 .then(override => callback(null, override),
                       () => callback(null, file))))
  // We do not use newer here as it would sometimes have
  // unexpected effects.
    .pipe(changed(dest, { hasChanged: changed.compareContents }))
    .pipe(gulp.dest(dest));
});

const buildDeps = ["build-standalone", "build-bundled-doc"];
if (options.optimize) {
  buildDeps.push("webpack");
}
gulp.task("build", buildDeps);

gulp.task("build-standalone-wed", ["copy-wed-source",
                                   "convert-wed-yaml",
                                   "tsc-wed"]);

gulp.task("copy-wed-source", () => {
  const dest = "build/standalone/";
  return es.merge(gulp.src(["lib/**/*", "!**/*_flymake.*", "!**/flycheck*",
                            "!**/*.{less,ts,yml}", "lib/**/*.d.ts"],
                           { base: "." }),
                  gulp.src(["lib/**/*.d.ts"], { base: "." }))
    .pipe(gulpNewer(dest))
    .pipe(gulp.dest(dest));
});

gulp.task("convert-wed-yaml", () => {
  const dest = "build/standalone/";
  return gulp.src(["lib/**/*.yml"], { base: "." })
    .pipe(rename({
      extname: ".json",
    }))
    .pipe(gulpNewer(dest))
    .pipe(es.mapSync((file) => {
      file.contents = Buffer.from(JSON.stringify(yaml.safeLoad(file.contents, {
        schema: yaml.JSON_SCHEMA,
      })));

      return file;
    }))
    .pipe(gulp.dest(dest));
});

function tsc(tsconfigPath, dest) {
  return execFileAndReport("./node_modules/.bin/tsc", ["-p", tsconfigPath,
                                                       "--outDir", dest]);
}

function parseFile(name, data) {
  let ret;

  try {
    ret = JSON.parse(data);
  }
  // eslint-disable-next-line no-empty
  catch (ex) {}

  if (ret !== undefined) {
    return ret;
  }

  try {
    ret = yaml.safeLoad(data, {
      schema: yaml.JSON_SCHEMA,
    });
  }
  // eslint-disable-next-line no-empty
  catch (ex) {}

  if (ret !== undefined) {
    return ret;
  }

  throw new Error(`cannot parse ${name}`);
}

function convertJSONSchemaToTS(srcPath, destBaseName) {
  if (!destBaseName) {
    destBaseName = path.basename(srcPath).replace(/(\..*?)?$/, ".d.ts");
  }

  const baseDirname = path.dirname(srcPath);
  const dest = path.join("build/generated", baseDirname, destBaseName);
  return newer(srcPath, dest)
    .then((result) => {
      if (!result) {
        return undefined;
      }

      return fs.readFile(srcPath)
        .then(data => compileToTS(parseFile(srcPath, data)))
        .then(ts => fs.outputFile(dest, ts));
    });
}

gulp.task("generate-ts", () =>
          Promise.all([
            convertJSONSchemaToTS("lib/wed/modes/generic/metadata-schema.json",
                                  "metadata-as-json.d.ts"),
            convertJSONSchemaToTS(
              "lib/wed/wed-options-schema.yml", "wed-options.d.ts"),
            convertJSONSchemaToTS(
              "lib/wed/options-schema.yml", "options.d.ts"),
          ]));

gulp.task("tsc-wed", ["generate-ts"],
          () => tsc("lib/tsconfig.json", "build/standalone/lib"));

gulp.task("copy-js-web",
          () => gulp.src("web/**/*.{js,html,css}")
          .pipe(gulp.dest("build/standalone/lib/")));

gulp.task("build-standalone-web", ["copy-js-web"]);

gulp.task("build-standalone-wed-config", ["config"], () => {
  const dest = "build/standalone";
  return gulp.src("build/config/requirejs-config-dev.js")
    .pipe(rename("requirejs-config.js"))
    .pipe(gulpNewer(dest))
    .pipe(gulp.dest(dest));
});

const lessInc = "lib/wed/less-inc/";

gulp.task("stamp-dir", () => mkdirp(config.internals.stampDir));

gulp.task("build-standalone-wed-less",
          ["stamp-dir", "build-standalone-wed", "copy-bootstrap"],
          (callback) => {
            const dest = "build/standalone/";
            const stamp = stampPath("less");
            const incFiles = `${lessInc}**/*.less`;

            // We have to filter out the included files from the less
            // transformation but we do include them literally in the final
            // package so that modes developed by users of wed can use them.
            const filter = gulpFilter(["lib/**/*", `!${incFiles}`],
                                      { restore: true });
            // This is a bit of a compromise. This will actually run less for
            // *all* less files if *any* of the less files changes.
            gulp.src(["lib/**/*.less", incFiles, "!**/*_flymake.*"],
                     { base: "." })
              .pipe(gulpNewer(stamp))
              .pipe(filter)
              .pipe(less({ paths: lessInc }))
              .pipe(filter.restore)
              .pipe(gulp.dest(dest))
              .on("end", () => {
                Promise.resolve(touch(stamp)).asCallback(callback);
              });
          });

gulp.task("copy-bin", () => gulp.src("bin/**/*")
          // Update all paths that point into the build directory be relative
          // to .. instead.
          .pipe(replace("../build/", "../"))
          .pipe(gulp.dest("build/bin")));

const copyTasks = [];
function npmCopyTask(...args) {
  // Package is reserved. So `pack`.
  let name;
  let src;
  let dest;
  let pack;
  // It is always possible to past an options object as the last argument.
  const last = args[args.length - 1];
  let copyOptions;
  if (typeof last === "object") {
    copyOptions = last;
    args.pop();
  }
  else {
    copyOptions = {};
  }

  if (args.length === 3) {
    // All arguments passed: just unpack.
    [name, src, dest] = args;
    pack = `node_modules/${src.split("/", 1)[0]}`;
  }
  else if (args.length === 2) {
    const [arg1, arg2] = args;
    // There are two possibilities.
    if (/[/*]/.test(arg1)) {
      // Arg1 is path-like: we interpret it as a source, arg2 is then dest. Task
      // name and package names are derived from arg1.
      src = arg1;
      dest = arg2;
      [name] = src.split("/", 1);
      pack = `node_modules/${name}`;
    }
    else {
      // Arg1 is not path-like: we interpret it as a task and
      // package name. Arg2 is the source. We assume `dest` is
      // `'external'`;
      name = arg1;
      src = arg2;
      dest = "external";
      pack = `node_modules/${name}`;
    }
  }
  else if (args.length === 1) {
    // Only one argument. It is the source. We derive the task and
    // package names from it. And we assume dest is '`external`'.
    [src] = args;
    dest = "external";
    [name] = src.split("/", 1);
    pack = `node_modules/${name}`;
  }

  const completeSrc = [`node_modules/${src}`];
  const completeDest = `build/standalone/lib/${dest}`;

  // We want to match everything except the package directory itself.
  const filter = gulpFilter(file => !/node_modules\/$/.test(file.base));

  //
  // For the ``newer`` computation, we have to depend on the actual
  // file to be copied and on the package directory itself. The fact
  // is that when npm installs a package, it preserves the
  // modification dates on the files. Consider:
  //
  // - June 1st: I ran make.
  //
  // - June 2nd: the package that contains ``src`` has a new version released.
  //
  // - June 3rd: I run make clean and make again. So ``dest`` has a stamp of
  //   June 3rd.
  //
  // - June 4th: I upgrade the package that contains ``src``. I run make but it
  //   does not update ``dest`` because ``src`` has a timestamp of June 2nd or
  //   earlier.
  //
  // Therefore I have to depend on the package itself too.
  //

  const fullName = `copy-${name}`;
  const stamp = stampPath(fullName);
  gulp.task(fullName, ["stamp-dir"], (callback) => {
    let stream = gulp.src([pack].concat(completeSrc), {
      allowEmpty: false,
    });

    if (copyOptions.rename) {
      stream = stream.pipe(rename(copyOptions.rename));
    }

    stream = stream.pipe(gulpNewer(stamp))
    // Remove the package from the stream...
      .pipe(filter);

    if (copyOptions.wrapAmd) {
      // Wrapping makes sense only for .js files.
      const jsFilter = gulpFilter("**/*.js", { restore: true });
      stream = stream.pipe(jsFilter)
        .pipe(wrapAmd({ exports: "module.exports" }))
        .pipe(jsFilter.restore);
    }

    if (copyOptions.map) {
      stream = stream.pipe(es.map(copyOptions.map));
    }

    stream.pipe(gulp.dest(completeDest))
      .on("end", () => Promise.resolve(touch(stamp)).asCallback(callback));
  });

  copyTasks.push(fullName);
}

npmCopyTask("jquery/dist/jquery.js");

npmCopyTask("bootstrap/dist/**/*", "external/bootstrap");

npmCopyTask("font-awesome/{css,fonts}/**/*", "external/font-awesome");

npmCopyTask("text-plugin", "requirejs-text/text.js", "requirejs");

npmCopyTask("requirejs/require.js", "requirejs");

npmCopyTask("corejs-typeahead",
            "corejs-typeahead/dist/{bloodhound,typeahead.jquery}.min.js");

npmCopyTask("localforage/dist/localforage.js");

npmCopyTask("bootbox/bootbox*.js");

npmCopyTask("urijs/src/**", "external/urijs",
            {
              map: (file, callback) => {
                // Sigh... the punycode version included with the latest urijs
                // hardcodes its name.
                if (file.path.endsWith("punycode.js")) {
                  file.contents =
                    Buffer.from(file.contents.toString()
                                .replace(/define\('punycode',\s*/, "define("));
                }

                callback(null, file);
              },
            });

npmCopyTask("lodash", "lodash-amd/{modern/**,main.js,package.json}",
            "external/lodash");

npmCopyTask("classlist", "classlist-polyfill/src/index.js",
            { rename: "classList.js" });

npmCopyTask("salve/salve*");

npmCopyTask("salve-dom/salve-dom*");

npmCopyTask("interactjs/dist/interact.min.js");

npmCopyTask("merge-options", "merge-options/index.js",
            { rename: "merge-options.js", wrapAmd: true });

npmCopyTask("is-plain-obj", "is-plain-obj/index.js",
            { rename: "is-plain-obj.js", wrapAmd: true });

npmCopyTask("bluebird/js/browser/bluebird.js");

npmCopyTask("last-resort/dist/last-resort.js**");

npmCopyTask("rangy/lib/**", "external/rangy");

npmCopyTask("bootstrap-notify/bootstrap-notify*.js");

npmCopyTask("typeahead.js-bootstrap-css/typeaheadjs.css");

npmCopyTask("dexie/dist/dexie{,.min}.js{.map,}");

npmCopyTask("core-js/client/shim.min.js", { rename: "core-js.min.js" });

npmCopyTask("zone.js/dist/zone.js");

npmCopyTask("bluejax/index.js", { rename: "bluejax.js" });

npmCopyTask("bluejax.try/index.js", { rename: "bluejax.try.js" });

npmCopyTask("slug/slug-browser.js", { rename: "slug.js" });

npmCopyTask("rxjs/**", "external/rxjs", { wrapAmd: true });

npmCopyTask("ajv/dist/ajv.min.js");

npmCopyTask("diff/diff.js");

gulp.task("build-info", Promise.coroutine(function *task() {
  const dest = "build/standalone/lib/wed/build-info.js";
  yield mkdirp(path.dirname(dest));

  yield exec("node misc/generate_build_info.js --unclean " +
             `--module > ${dest}`);
}));

function *generateModes(x) {
  const common = `wed/modes/${x}/`;
  for (const ext of ["js", "ts"]) {
    yield `${common}${x}.${ext}`;
    yield `${common}${x}-mode.${ext}`;
    yield `${common}${x}_mode.${ext}`;
  }
}

gulp.task("generate-mode-map", Promise.coroutine(function *task() {
  const dest = "build/standalone/lib/wed/mode-map.js";
  const isNewer = yield newer(["lib/wed/modes/**", "!**/*_flymake.*"], dest);
  if (!isNewer) {
    return;
  }

  yield mkdirp(path.dirname(dest));

  const modeDirs = yield fs.readdir("lib/wed/modes");
  const modes = {};
  modeDirs.forEach((x) => {
    for (const mode of generateModes(x)) {
      try {
        fs.accessSync(path.join("./lib", mode));
        modes[x] = mode.replace(/\..*$/, "");
        break;
      }
      catch (e) {} // eslint-disable-line no-empty
    }
  });

  const exporting = { modes };

  yield fs.writeFile(dest, `define(${JSON.stringify(exporting)});`);
}));

function htmlTask(suffix) {
  gulp.task(`build-html${suffix}`, () => {
    const dest = `build/standalone${suffix}`;
    return gulp.src("web/*.html", { base: "web" })
      .pipe(gulpNewer(dest))
      .pipe(gulp.dest(dest));
  });
}

htmlTask("");
htmlTask("-optimized");

gulp.task("build-standalone",
          [].concat(
            "build-standalone-wed",
            "build-standalone-web",
            "build-standalone-wed-less",
            "build-standalone-wed-config",
            "copy-log4javascript",
            "copy-bin",
            copyTasks,
            "build-schemas",
            "build-samples",
            "build-html",
            "build-info",
            "generate-mode-map"),
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

gulp.task("webpack", ["build-standalone"], () =>
          execFileAndReport("./node_modules/.bin/webpack", ["--color"],
                            { maxBuffer: 300 * 1024 }));

gulp.task("rst-doc", () =>
          gulp.src("*.rst", { read: false })
          // eslint-disable-next-line array-callback-return
          .pipe(es.map((file, callback) => {
            const dest = `${file.path.substr(
                  0, file.path.length - path.extname(file.path).length)}.html`;
            exec(`${options.rst2html} ${file.path}` +
                 ` ${dest}`).asCallback(callback);
          })));

gulp.task("default", ["build"]);

gulp.task("doc", ["rst-doc", "typedoc"]);

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
    yield exec("node ./misc/generate_build_info.js > /dev/null");
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
    yield exec("node misc/modify_config.js -d config.ajaxlog -d config.save " +
               `${globalConfig}.t > ${globalConfig}`);

    yield del([`${globalConfig}.t`,
               `${dest}/build/${tree}/test.html`,
               `${dest}/build/${tree}/mocha_frame.html`,
               `${dest}/build/${tree}/wed_test.html`]);
  }
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
    yield cprp("NPM_README.md", `${dist}/README.md`);
    const { stdout } = yield execFile("npm", ["pack"], { cwd: dist });
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
  return spawn("npm", ["publish", LATEST_DIST], { stdio: "inherit" });
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
