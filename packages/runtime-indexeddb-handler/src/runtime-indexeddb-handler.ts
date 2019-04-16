/**
 * Handler supporting the indexeddb scheme.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Dexie } from "dexie";

import { RuntimeURISchemeHandler } from "@wedxml/default-runtime";

export const version = "5.0.0-alpha.21";

/**
 * Handler supporting the ``indexeddb`` scheme.
 *
 * The URIs supported by this scheme are of this form:
 *
 * ``indexeddb://v1/database/table/<type>/key[/property]``
 *
 * The square brackets indicate an optional part. And the angle brackets are
 * delimiters for variables described below.
 *
 * ``v1`` is the version number of the *URI interpretation scheme* used. Future
 * versions may introduce new ways to interpret an indexeddb URI and use higher
 * versions.
 *
 * The URI above opens the IndexedDB database named ``database``, looks for the
 * table named ``table``, loads the item with primary key named ``key`` and
 * extracts the value of the property named ``property``. ``property`` is
 * optional. When not specified, the whole record will be returned. The ``type``
 * must have either the value ``number`` or ``string`` determining how ``key``
 * is going to be interpreted. (Because the *number* 1 used as a key is not the
 * same as the *string* ``"1"`` used as a key.)
 */
export class RuntimeIndexedDBHandler implements RuntimeURISchemeHandler {

  canHandle(scheme: string): boolean {
    return scheme === "indexeddb";
  }

  // tslint:disable-next-line:no-any
  async resolve(uri: string): Promise<any> {
    const schemeSep = uri.indexOf("://");

    const scheme = schemeSep === -1 ? "" : uri.substr(0, schemeSep);
    if (scheme !== "indexeddb") {
      throw new Error(`unknown scheme: ${scheme}`);
    }

    const path = uri.substr(schemeSep + 3);
    const parts = path.split("/");
    const schemeVersion = parts[0];
    const db = parts[1];
    const table = parts[2];
    const keyType = parts[3];
    let key: string | number = parts[4];
    const property = parts[5];

    if (schemeVersion !== "v1") {
      throw new Error(`unsupported version number: ${schemeVersion}`);
    }

    switch (keyType) {
      case "string":
        break;
      case "number":
        key = Number(key);
        break;
      default:
        throw new Error(`unknown key type: ${keyType}`);
    }

    const store = new Dexie(db);

    await store.open();

    const record = await store.table(table).get(key);
    if (record == null) {
      throw Error(`cannot resolve key from: ${uri}`);
    }

    if (property === undefined) {
      return record;
    }

    if (!(property in record)) {
      throw Error(`cannot resolve property in the record of: ${uri}`);
    }

    return record[property];
  }
}
