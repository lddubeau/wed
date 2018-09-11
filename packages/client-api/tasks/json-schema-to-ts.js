"use strict";

const fs = require("fs-extra");
const path = require("path");

const { compile } = require("json-schema-to-typescript");

const args = process.argv;

fs.ensureDirSync(path.dirname(args[3]));

fs.readFile(args[2])
  .then(x => compile(JSON.parse(x)))
  .then(x => fs.writeFile(args[3], x));
