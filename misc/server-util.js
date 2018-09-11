"use strict";

const serveStatic = require("serve-static");

function makeServeMiddleware(serveStaticOpts) {
  if (!serveStaticOpts) {
    return (req, resp, next) => next();
  }

  const servers = serveStaticOpts.map((x) => {
    const copy = (typeof x === "object") ? Object.assign({}, x) :
          { fsPath: x, baseURL: x };

    copy.serve = serveStatic(x.fsPath, {
      index: false,
    });

    return copy;
  });

  return function handle(req, resp, next) {
    const { url } = req;
    for (const { baseURL, serve } of servers) {
      if (url.startsWith(baseURL)) {
        req.url = url.slice(baseURL.length);
        serve(req, resp, next);
        return;
      }
    }

    next();
  };
}

exports.makeServeMiddleware = makeServeMiddleware;

exports.makeKarmaMiddleware = function makeKarmaMiddleware(config) {
  return makeServeMiddleware(config.serveStatic);
};
