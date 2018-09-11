const gulp = require("gulp");
const glob = require("glob");
const path = require("path");
const log = require("fancy-log");
const Promise = require("bluebird");
const { options } = require("./config");
const { newer, checkOutputFile, cprp, existsInFile } = require("./util");

gulp.task(
  "build-samples",
  () => Promise.all(
    glob.sync("sample_documents/*.xml")
      .map(Promise.coroutine(function *task(sample) {
        const dest = `build/samples/${path.basename(sample)}`;
        const isNewer = yield newer([sample, "src/tests/xml-to-xml-tei.xsl"],
                                    dest);
        if (!isNewer) {
          log(`Skipping generation of ${dest}`);
          return;
        }

        const needsXSL = yield existsInFile(sample,
                                            "http://www.tei-c.org/ns/1.0");
        yield needsXSL ?
          checkOutputFile(options.xsltproc,
                          ["-o", dest, "src/tests/xml-to-xml-tei.xsl",
                           sample]) :
          cprp(sample, dest);
      }))));
