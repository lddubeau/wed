function toBoolean(str) {
  const lower = str.toLowerCase();
  if (["true", "1", "y", "yes"].indexOf(lower) !== -1) {
    return true;
  }

  if (["false", "0", "n", "no"].indexOf(lower) !== -1) {
    return false;
  }

  throw new Error(`cannot reliably convert ${str} to a boolean`);
}


/**
 * Definitions for the options passed on the command line. Each key in
 * the structure is an option name and the values are objects to be
 * passed to ``argparse``'s ``addArgument``.
 */
exports.optionDefinitions = {
  saxon: {
    help: "Path to saxon.",
    defaultValue: "saxon",
  },
  xsltproc: {
    help: "Path to xsltproc.",
    defaultValue: "xsltproc",
  },
  jsdoc3: {
    help: "Path to jsdoc.",
    defaultValue: "node_modules/.bin/jsdoc",
  },
  rst2html: {
    help: "Path to rst2html.",
    defaultValue: "rst2html",
  },
  odd2html: {
    help: "Path to the odd2html.xsl stylesheet.",
    defaultValue: "/usr/share/xml/tei/stylesheet/odds/odd2html.xsl",
  },
  dev: {
    help: "Are we in development mode?",
    type: toBoolean,
    defaultValue: false,
  },
  behave_params: {
    help: "Parameters to pass to behave.",
    defaultValue: undefined,
  },
  tei: {
    help: "Path to the directory containing the TEI stylesheets.",
    defaultValue: "/usr/share/xml/tei/stylesheet",
  },
  skip_semver: {
    help: "If true skip the semver check.",
    type: Boolean,
    action: "storeTrue",
    defaultValue: undefined,
  },
  optimize: {
    help: "Whether the build should create an optimized version of " +
      "wed by default.",
    type: toBoolean,
    defaultValue: true,
  },
  force_gh_pages_build: {
    help: `Force the gh-pages target to run even if not on the
main branch`,
    type: toBoolean,
    action: "storeTrue",
    defaultValue: false,
  },
  unsafe_deployment: {
    help: "Allows deploying from an unclean branch",
    type: toBoolean,
    action: "storeTrue",
    defaultValue: false,
  },
  watch_task: {
    help: "Which task to run when the files change.",
    defaultValue: "test",
  },
};

/**
 * The options that the user has actually set. The value here is meant
 * to be set by the main gulpfile.
 */
exports.options = {};

/**
 * Values internal to the gulp scripts. These are not settable through
 * a local configuration file or through command line options.
 */
exports.internals = {
  stampDir: "build/stamps",
};
