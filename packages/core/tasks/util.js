const vfs = require("vinyl-fs");
const gulpNewer = require("gulp-newer");
const childProcess = require("child_process");
const log = require("fancy-log");
const fs = require("fs-extra");
const _del = require("del");
const path = require("path");
const { execFile } = require("child-process-promise");
const { internals } = require("./config");

exports.fs = fs;

exports.mkdirp = fs.ensureDir;
exports.del = _del;

const copy = exports.copy = fs.copy;

const cprp = exports.cprp = function cprp(src, dest) {
  return copy(src, dest, { overwrite: true, preserveTimestamps: true });
};

exports.cprpdir = async function cprpdir(src, dest) {
  if (!(src instanceof Array)) {
    src = [src];
  }

  for (const s of src) {
    const basename = path.basename(s);
    //
    // Yes, we wait for each source to be copied. This provides some sane
    // semantics: if a later source overlaps with an ealier one, it overwrites
    // the earlier one. Using Promise.all would yield indeterminate results.
    //
    // eslint-disable-next-line no-await-in-loop
    await cprp(s, path.join(dest, basename));
  }
};

exports.exec = function exec(command, options) {
  return new Promise((resolve, reject) => {
    childProcess.exec(command, options, (err, stdout, stderr) => {
      if (err) {
        log(stdout);
        log(stderr);
        reject(err);
      }
      resolve(stdout, stderr);
    });
  });
};

exports.checkOutputFile = function checkOutputFile(file, args, options) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(file, args, options,
                          (err, stdout, stderr) => {
                            if (err) {
                              log(stdout);
                              log(stderr);
                              reject(err);
                              return;
                            }
                            resolve([stdout, stderr]);
                          });
  });
};

exports.newer = async function newer(src, dest, forceDestFile) {
  // We use gulp-newer to perform the test and convert it to a promise.
  const options = {
    dest,
  };

  if (forceDestFile) {
    options.map = function map() {
      return ".";
    };
  }

  return new Promise((resolve) => {
    const stream = vfs.src(src, { read: false })
          .pipe(gulpNewer(options));

    function end() {
      resolve(false);
    }

    stream.on("data", () => {
      stream.removeListener("end", end);
      stream.end();
      resolve(true);
    });

    stream.on("end", end);
  });
};

exports.stampPath = function stampPath(name) {
  return path.join(internals.stampDir, `${name}.stamp`);
};

exports.makeStampDir = async function makeStampDir() {
  return fs.ensureDir(internals.stampDir);
};

exports.existsInFile = function existsInFile(fpath, re) {
  return fs.readFile(fpath).then(data => data.toString().search(re) !== -1);
};

exports.spawn = function spawn(cmd, args, options) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(cmd, args || [], options || {});

    child.on("exit", (code, signal) => {
      if (code) {
        reject(new Error(`${cmd} terminated with code: ${code}`));
        return;
      }

      if (signal) {
        reject(new Error(`${cmd} terminated with signal: ${signal}`));
        return;
      }

      resolve();
    });
  });
};

exports.execFile = execFile;

exports.addVenv = function addVenv() {
  const pathEnv = process.env.PATH;
  process.env.PATH =
    `${path.join(__dirname, "..", ".wed-venv", "bin")}:${pathEnv}`;
};
