/**
 * The runtime API
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import * as fetchiest from "fetchiest";

import { Options } from "./options";

interface Runtime {
  readonly options: Options;

  readonly fetch: typeof fetchiest.fetch;

  /**
   * Resolve a resource reference.
   *
   * @param uri The URI to resolve.
   *
   * @returns A promise that resolves to the resource. The promise must resolve
   * to type ``any`` because resolvers may produce all kinds of results:
   * strings, database records, etc.
   */
  // tslint:disable-next-line:no-any
  resolve(uri: string): Promise<any>;

  /**
   * Resolve a resource and convert it to a string. In general this just pass
   * the resolved resource to the ``String`` constructor. If the resolved
   * resource is a ``File`` then the file is read.
   *
   * @param uri See [[resolve]].
   *
   * @returns A promise resolving to a string.
   */
  resolveToString(uri: string): Promise<string>;

  /**
   * Load modules through a platform-defined module loader.
   *
   * @param names One or more module names.
   *
   * @returns The resolved modules, in the same order as the names passed in
   * ``resources``.
   */
  resolveModules(names: string | string[]): Promise<{}[]>;
}
