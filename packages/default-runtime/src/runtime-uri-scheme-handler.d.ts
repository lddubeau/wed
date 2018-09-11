/**
 * The API for URI scheme handlers supported by the default runtime.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/**
 * The interface that all URI scheme handlers must conform to.
 */
export interface RuntimeURISchemeHandler {
  /**
   * @returns true if it can handle the scheme, false if not.
   */
  canHandle(scheme: string): boolean;

  /**
   * Resolve a resource reference.
   */
  // tslint:disable-next-line:no-any
  resolve(uri: string): Promise<any>;
}
