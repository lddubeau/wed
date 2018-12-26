const vfs = require("vinyl-fs");
const gulpNewer = require("gulp-newer");
const childProcess = require("child_process");
const Promise = require("bluebird");
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

exports.cprpdir = function cprpdir(src, dest) {
  if (!(src instanceof Array)) {
    src = [src];
  }
  const promises = [];
  for (const s of src) {
    const basename = path.basename(s);
    promises.push(cprp(s, path.join(dest, basename)));
  }

  if (promises.length === 0) {
    return promises[0];
  }

  return Promise.each(promises, () => {});
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

exports.checkStatusFile = function checkStatusFile(file, args, options) {
  return new Promise((resolve) => {
    childProcess.execFile(file, args, options,
                          err => resolve(err ? err.code : 0));
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

exports.newer = function newer(src, dest, forceDestFile) {
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

exports.sameFiles = function sameFiles(a, b) {
  return Promise.coroutine(function *gen() {
    const [statsA, statsB] = yield Promise.all([
      fs.stat(a).catch(() => null),
      fs.stat(b).catch(() => null)]);

    if (!statsA || !statsB || statsA.size !== statsB.size) {
      return false;
    }

    const { size } = statsA;

    const [fdA, fdB] = yield Promise.all([
      fs.open(a, "r"),
      fs.open(b, "r")]);

    const bufsize = 64 * 1024;
    const bufA = Buffer.alloc(bufsize);
    const bufB = Buffer.alloc(bufsize);
    let read = 0;

    while (read < size) {
      yield Promise.all([
        fs.read(fdA, bufA, 0, bufsize, read),
        fs.read(fdB, bufB, 0, bufsize, read),
      ]);
      // The last read will probably be partially filling the buffer but it does
      // not matter because in the previous iteration, the data was equal.
      if (!bufA.equals(bufB)) {
        return false;
      }
      read += bufsize;
    }

    return true;
  })();
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

/**
 * Why use this over spawn with { stdio: "inherit" }? If you use this function,
 * the results will be shown in one shot, after the process exits, which may
 * make things tidier.
 *
 * However, not all processes are amenable to this. When running Karma, for
 * instance, it is desirable to see the progress "live" and so using spawn is
 * better.
 */
exports.execFileAndReport = function execFileAndReport(...args) {
  return execFile(...args)
    .then((result) => {
      if (result.stdout) {
        log(result.stdout);
      }
    }, (err) => {
      if (err.stdout) {
        log(err.stdout);
      }
      throw err;
    });
};

exports.execFile = execFile;
