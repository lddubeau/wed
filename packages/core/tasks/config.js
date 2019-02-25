exports.options = {
  saxon: "saxon",
  tei: "/usr/share/xml/tei/odd/p5subset.xml",
  odd2html: "/usr/share/xml/tei/stylesheet/odds/odd2html.xsl",
};

/**
 * Values internal to the scripts. These are not settable through a local
 * configuration file or through command line options.
 */
exports.internals = {
  stampDir: "build/stamps",
};
