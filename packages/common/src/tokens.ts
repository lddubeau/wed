/**
 * The tokens we use for dependency resolution.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

/**
 * The token representing the editor's widget.
 */
export const EDITOR_WIDGET = Symbol("EDITOR_WIDGET");

/**
 * The token representing the editor's options.
 */
export const EDITOR_OPTIONS = Symbol("EDITOR_OPTIONS");

/**
 * The token corresponding to the [["@wedxml/client-api".Runtime]] interface.
 */
export const RUNTIME = Symbol("RUNTIME");

/**
 * The token corresponding to the [["@wedxml/client-api".GrammarLoader]]
 * interface.
 */
export const GRAMMAR_LOADER = Symbol("GRAMMAR_LOADER");

/**
 * The token corresponding to the [["@wedxml/client-api".EditorInstance]]
 * interface.
 */
export const EDITOR_INSTANCE = Symbol("EDITOR_INSTANCE");

/**
 * The token corresponding to the [["@wedxml/client-api".Saver]]
 * interface.
 */
export const SAVER = Symbol("SAVER");
