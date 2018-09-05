/**
 * The runtime API
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import * as bluejax from "bluejax";

import { Options } from "../options";

interface Runtime {
  readonly options: Options;

  readonly ajax: bluejax.AjaxCall;
  readonly ajax$: bluejax.AjaxCall$;

  /**
   * Resolve a resource reference. References may be of the form:
   *
   * - String without a URL scheme identifier. Performs an Ajax query with the
   *   resource string as-is.
   *
   * - `indexeddb://v1/database/table/type/key/property` Loads from
   *    IndexedDB. It opens the database `database`, looks for the table
   *    `table`, loads the item with primary key `key` and extracts the value of
   *    the property `property`. (`property` is optional. When not specified,
   *    the whole record will be returned.) The `type` must have the values
   *    `number` or `string` determining how `key` is going to be
   *    interpreted. `v1` is the version number of the interpretation scheme
   *    used.
   *
   * @param resource The resource to resolve.
   *
   * @returns A promise that resolves to the resource. The promise must resolve
   * to type ``any`` because when we address a database field we really can get
   * anything.
   */
  // tslint:disable-next-line:no-any
  resolve(resource: string): Promise<any>;

  /**
   * Resolve a resource and convert it to a string. In general this just pass
   * the resolved resource to the ``String`` constructor. If the resolved
   * resource is a ``File`` then the file is read. (Resolution to a file may
   * happen if using the ``indexeddb://` addressing described for [[resolve]].
   *
   * @param resource See [[resolve]].
   *
   * @returns A promise resolving to a string.
   */
  resolveToString(resource: string): Promise<string>;

  /**
   * Load modules through a platform-defined module loader.
   *
   * @param resources One or more module names.
   *
   * @returns The resolved modules, in the same order as the names passed in
   * ``resources``.
   */
  resolveModules(resources: string | string[]): Promise<{}[]>;
}
