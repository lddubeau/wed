/**
 * The grammar loader API.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Grammar } from "salve";

/**
 * A grammar loader is an object responsible for resolving URLs to grammar
 * objects. Behind the scenes grammar loaders implement support for various
 * types of resources, and may do caching of results, etc.
 *
 * This is the API that all grammar loaders must implement.
 */
interface GrammarLoader {
  /**
   * Load a grammar.
   *
   * @param path The URL from which to load the grammar.
   *
   * @returns A promise resolving to the loaded grammar.
   */
  load(path: string | URL): Promise<Grammar>;
}
