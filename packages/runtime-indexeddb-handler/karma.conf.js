"use strict";

const { name } = require("./package.json");

const configure = require("../../karma/basic.conf");

module.exports = (config) => {
  const options = configure(config);
  options.browserStack.name = name;
  config.set(options);
};
