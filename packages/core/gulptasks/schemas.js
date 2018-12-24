const gulp = require("gulp");
const path = require("path");
const log = require("fancy-log");
const Promise = require("bluebird");
const { options } = require("./config");
const { del, newer, checkOutputFile, exec, mkdirp } = require("./util");

gulp.task("wed-metadata-prereq", ["copy-bin", "tsc-wed"]);

gulp.task("copy-schemas",
          () => gulp.src(["schemas/*.js", "schemas/**/*.rng"], { base: "." })
          .pipe(gulp.dest("build")));

const jsonTasks = [];
function xmlToJsonChain(name, dest) {
  const xml = `schemas/${name}.xml`;
  const compiled = `schemas/out/${name}.compiled`;
  const json = `schemas/out/${name}.json`;
  const metaJson = `build/schemas/${dest}`;

  const rngTaskName = `compile-rng-${name}`;
  const compiledToJsonTaskName = `compiled-to-json-${name}`;
  const metaJsonTaskName = `convert-to-meta-json-${name}`;

  gulp.task(rngTaskName, Promise.coroutine(function *task() {
    const isNewer = yield newer(xml, compiled);
    if (!isNewer) {
      log(`Skipped running teitoodd for ${compiled}.`);
      return;
    }

    yield exec(`teitoodd --localsource=${options.tei} ${xml} ${compiled}`);
  }));

  function *compiledToJson() {
    const isNewer = yield newer(compiled, json);
    if (!isNewer) {
      log(`Skipped running saxon for ${json}.`);
      return;
    }

    yield exec(`${options.saxon} -xsl:` +
               "/usr/share/xml/tei/stylesheet/odds/odd2json.xsl" +
               ` -s:${compiled} -o:${json} callback=''`);
  }

  gulp.task(compiledToJsonTaskName, [rngTaskName],
            Promise.coroutine(compiledToJson));

  function *meta() {
    const fragment = "schemas/tei-meta-fragment.yml";
    const isNewer = yield newer([json, fragment], metaJson);

    if (!isNewer) {
      log(`Skipping generation of ${metaJson}`);
      return;
    }

    yield mkdirp(path.dirname(metaJson));
    yield checkOutputFile("build/bin/wed-metadata",
                          ["--tei", "--merge", fragment].concat(json,
                                                                metaJson));
  }

  // tsc-wed is a necessary dependency because tei-to-generic-meta-json
  // needs to load compiled code.
  gulp.task(metaJsonTaskName, ["wed-metadata-prereq",
                               `compiled-to-json-${name}`],
            Promise.coroutine(meta));

  jsonTasks.push(metaJsonTaskName);
}

xmlToJsonChain("myTEI", "tei-metadata.json");
xmlToJsonChain("tei-math", "tei-math-metadata.json");

gulp.task("tei-doc", ["compile-rng-myTEI"], Promise.coroutine(function *task() {
  const src = "schemas/out/myTEI.compiled";
  const dest = "build/schemas/tei-doc";

  const isNewer = yield newer(src, dest, true /* forceDestFile */);
  if (!isNewer) {
    log(`Skipping generation of ${dest}`);
    return;
  }

  yield del(dest);
  yield mkdirp(dest);
  yield checkOutputFile(
    options.saxon,
    [`-s:${src}`, `-xsl:${options.odd2html}`,
     "STDOUT=false", "splitLevel=0", `outputDir=${dest}`]);
}));

gulp.task("docbook-metadata", ["wed-metadata-prereq"],
          Promise.coroutine(function *task() {
            const fragment = "schemas/docbook-meta-fragment.yml";
            const metadata = "build/schemas/docbook-metadata.json";
            const isNewer = yield newer(fragment, metadata);

            if (!isNewer) {
              log(`Skipping generation of ${metadata}`);
              return;
            }

            yield mkdirp(path.dirname(metadata));
            yield checkOutputFile("build/bin/wed-metadata",
                                  [fragment, metadata]);
          }));

gulp.task("build-schemas", ["copy-schemas",
                            "docbook-metadata"].concat(jsonTasks, "tei-doc"));
