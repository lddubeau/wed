/**
 * An execution runtime for editors.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { inject, injectable, multiInject, optional } from "inversify";
import mergeOptions from "merge-options";

import { Options, Runtime } from "@wedxml/client-api";
import { EDITOR_OPTIONS } from "@wedxml/common/tokens";

import { fetch, FetchiestOptions, FetchiestRequestInit } from "fetchiest";
import { RuntimeURISchemeHandler } from "./runtime-uri-scheme-handler";
import { RUNTIME_URI_SCHEME_HANDLER } from "./tokens";

export { RuntimeURISchemeHandler, RUNTIME_URI_SCHEME_HANDLER };

export const version = "5.0.0-alpha.17";

async function readFile(file: Blob): Promise<string> {
  const reader = new FileReader();

  return new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// tslint:disable-next-line:no-any
export function suppressUnhandledRejections<P extends Promise<any>>(p: P): P {
  // tslint:disable-next-line:no-any
  const pAsAny = p as any;
  if (pAsAny.suppressUnhandledRejections) {
    pAsAny.suppressUnhandledRejections();
  }

  return p;
}

type RequireJSCall = (deps: string[],
                      // tslint:disable-next-line:no-any
                      callback?: (...args: any[]) => void,
                      // tslint:disable-next-line:no-any
                      errback?: (...args: any[]) => void) => void;

// We "hide" the require call under a different name. It prevents Webpack from
// choking on the dynamic require call we use in this file. (It is up to *us* to
// set the environment so that the dynamic calls can work, not up to Webpack to
// convert it to something sensible.)

// tslint:disable-next-line:no-any no-string-literal
const req = (window as any)["require"] as RequireJSCall;

/**
 * An object representing the runtime environment in which an editor is
 * running. In particular it allows loading external resources.
 */
@injectable()
export class DefaultRuntime implements Runtime {
  readonly options: Options;

  private readonly handlers: RuntimeURISchemeHandler[];

  private readonly fetchiestOptions: FetchiestOptions;

  constructor(@inject(EDITOR_OPTIONS) options: Options,
              @multiInject(RUNTIME_URI_SCHEME_HANDLER) @optional()
              handlers?: RuntimeURISchemeHandler[]) {
    // We cannot use an initializer on the parameter because it confuses
    // InversifyJS.
    if (handlers === undefined) {
      // tslint:disable-next-line:no-parameter-reassignment
      handlers = [];
    }
    this.handlers = handlers;
    // Make a deep copy.
    // tslint:disable-next-line:no-parameter-reassignment
    options = mergeOptions({}, options);
    this.options = options;
    this.fetchiestOptions = options.fetchiestOptions != null ?
      options.fetchiestOptions : {
        tries: 3,
        delay: 100,
        diagnose: {
          // It would be desirable to support this...
          // serverURL: "/ping",
          knownServers: [
            // tslint:disable:no-http-string
            "http://www.google.com/",
            "http://www.cloudfront.com/",
            // tslint:enable:no-http-string
          ],
        },
      };
  }

  async fetch(input: RequestInfo,
              init?: FetchiestRequestInit): Promise<Response> {
    const fetchiestOptions =
      init !== undefined && init.fetchiestOptions !== undefined ? {
        ...this.fetchiestOptions,
        ...init.fetchiestOptions,
      } : this.fetchiestOptions;

    const response = await fetch(input, { ...init, fetchiestOptions });

    if (!response.ok) {
      const err = new Error(`cannot retreive: ${response.url}`);
      // tslint:disable-next-line:no-any
      (err as any).response = response;
      throw err;
    }

    return response;
  }

  /**
   * Resolve resource references. References may be of the form:
   *
   * - String without a URL scheme identifier. Performs an Ajax query with the
   *   resource string as-is.
   *
   */
  // The promise must resolve to any because when we address a field we really
  // can get anything.
  //
  // tslint:disable-next-line:no-any
  async resolve(uri: string): Promise<any> {
    const schemeSep = uri.indexOf("://");

    const scheme = schemeSep === -1 ? "http" : uri.substr(0, schemeSep);
    for (const handler of this.handlers) {
      if (handler.canHandle(scheme)) {
        return handler.resolve(uri);
      }
    }

    if (scheme === "https" || scheme === "http") {
      return (await this.fetch(uri)).text();
    }

    throw new Error(`unknown scheme: ${scheme}`);
  }

  async resolveToString(uri: string): Promise<string> {
    const data = await this.resolve(uri);
    if (typeof data === "string") {
      return data;
    }

    return data instanceof Blob ? readFile(data) : String(data);
  }

  /**
   * Resolve modules through the underlying module loader.
   *
   * @param resources A single module name or an array of such names.
   *
   * @returns promise of modules.
   */
  async resolveModules(resources: string | string[]): Promise<{}[]> {
    if (!(resources instanceof Array)) {
      // tslint:disable-next-line:no-parameter-reassignment
      resources = [resources];
    }

    return new Promise<{}[]>((resolve, reject) => {
      req(resources as string[], function success(): void {
        resolve(Array.prototype.slice.call(arguments));
      }, reject);
    });
  }
}

//  LocalWords:  runtime MPL serverURL IndexedDB indexeddb keyType
