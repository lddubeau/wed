/**
 * The interface through which clients access the editor.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Action } from "./action";

export interface AddToolbarActionOptions {
  /**
   * If true, push the options at the right end of the toolbar. Note that this
   * is can only be used when appending buttons. And this is something
   * independent from the mere fact of appending. When using this option, the
   * appended button will be visually pushed away from the previous button,
   * towards the right end of the toolbar.
   */
  right?: boolean;

  /** If true, prepend the buttons rather than append them. */
  prepend?: boolean;
}

// We set the type of editor to ``any`` on purpose. At the place where
// addToolbarAction is called, the editor is of type EditorInstance but the type
// of the editor in an actual action class is EditorAPI. So the code calling
// addToolbarAction would have to be forced to do a type assertion.
export type ActionCtor = new (editor: any) => Action<{}>;

/**
 * The interface through which clients access the editor.
 */
export interface EditorInstance {
  /** A name for this editor. */
  readonly name: string;

  /** A promise that resolves once the first validation is complete. */
  readonly firstValidationComplete: Promise<EditorInstance>;

  /** A promise that resolves once the editor is initialized. */
  readonly initialized: Promise<EditorInstance>;

  /**
   * Initialize the editor.
   *
   * @param xmlData The XML document to load.
   *
   * @return A promise that resolves once the editor is initialized.
   */
  init(xmlData?: string): Promise<EditorInstance>;

  /**
   * Add an action to the toolbar. This is meant to be used to add "general"
   * actions that are tied to the application in which wed is embedded rather
   * than to the mode being used.
   *
   * @param actionClass The class to instantiate to provide the action.
   *
   * @param options The options to use for adding the action.
   */
  addToolbarAction(actionClass: ActionCtor, options: AddOptions): void;

  /**
   * Triggers the resizing algorithm.
   */
  resize(): void;

  /**
   * Destroy this instance. This will stop all task runners and run clean up
   * code. After this is called, it is illegal to call any methods other than
   * this one.
   */
  destroy(): void;
}
