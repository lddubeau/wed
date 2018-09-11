"use strict";

const fs = require("fs");
const yaml = require("js-yaml");

const args = process.argv;

fs.writeFileSync(args[3],
                 JSON.stringify(yaml.safeLoad(fs.readFileSync(args[2], {
                   schema: yaml.JSON_SCHEMA,
                 }))));
