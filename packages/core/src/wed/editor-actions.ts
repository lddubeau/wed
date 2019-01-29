/**
 * Actions that all editors support.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Observable, Subject } from "rxjs";

import { Action } from "./action";
import { Button, ToggleButton } from "./gui/button";
import { makeHTML } from "./gui/icon";
import { DocumentationActionData, EditorAPI } from "./mode-api";
import { SelectionMode } from "./selection-mode";

export type ActionCtor = { new (editor: EditorAPI): Action };

export type Handler = (editor: EditorAPI) => void;

export function makeAction(desc: string,
                           icon: string,
                           needsInput: boolean,
                           fn: Handler): ActionCtor;
export function makeAction(desc: string,
                           icon: string,
                           abbreviatedDesc: string,
                           needsInput: boolean,
                           fn: Handler): ActionCtor;
export function makeAction(desc: string,
                           abbreviatedDesc: string | undefined,
                           icon: string | boolean,
                           needsInput: boolean | Handler,
                           fn?: Handler): ActionCtor {
  let actualAbbreviatedDesc: string | undefined;
  let actualIcon: string;
  let actualNeedsInput: boolean;
  let actualFn: Handler;
  if (typeof icon === "boolean") {
    actualAbbreviatedDesc = undefined;
    actualIcon = abbreviatedDesc as string;
    actualNeedsInput = icon;
    actualFn = needsInput as Handler;
  }
  else {
    actualAbbreviatedDesc = abbreviatedDesc;
    actualIcon = icon;
    actualNeedsInput = needsInput as boolean;
    actualFn = fn as Handler;
  }

  return class extends Action {
    constructor(editor: EditorAPI) {
      super(editor, desc, actualAbbreviatedDesc, actualIcon, actualNeedsInput);
    }

    execute(_data: void): void {
      actualFn(this.editor);
    }
  };
}

// tslint:disable-next-line:variable-name
export const Save =
  makeAction("Save", makeHTML("upload"), false,
             (editor) => {
               // tslint:disable-next-line:no-floating-promises
               editor.save();
             });

// tslint:disable-next-line:variable-name
export const Undo =
  makeAction("Undo", makeHTML("undo"), false,
             (editor) => {
               editor.undo();
             });

// tslint:disable-next-line:variable-name
export const Redo =
  makeAction("Redo", makeHTML("redo"), false,
             (editor) => {
               editor.redo();
             });

// tslint:disable-next-line:variable-name
export const DecreaseLabelVisibilityLevel =
  makeAction("Decrease label visibility level", "Decrease label visibility",
             makeHTML("arrow-down"), false,
             (editor) => {
               editor.decreaseLabelVisiblityLevel();
             });

// tslint:disable-next-line:variable-name
export const IncreaseLabelVisibilityLevel =
  makeAction("Increase label visibility level", "Increase label visibility",
             makeHTML("arrow-up"), false,
             (editor) => {
               editor.increaseLabelVisibilityLevel();
             });

export interface PressedEvent {
  name: "Pressed";
  action: ToggleAttributeHiding;
}

/**
 * An action that toggles the editors attribute hiding.
 */
export class ToggleAttributeHiding extends Action<boolean> {
  protected pressed: boolean = true;

  /**
   * The object on which this class and subclasses may push new events.
   */
  protected readonly _events: Subject<PressedEvent> = new Subject();

  /**
   * The observable on which clients can listen for events.
   */
  readonly events: Observable<PressedEvent> = this._events.asObservable();

  constructor(editor: EditorAPI) {
    super(editor, "Toggle attribute hiding", "AH", undefined, false);
  }

  execute(data: boolean): void {
    if (this.pressed !== data) {
      this.pressed = data;
      this.editor.toggleAttributeHiding();
      this._events.next({ name: "Pressed", action: this });
    }
  }

  makeButton(data?: boolean): Button {
    const button = new ToggleButton(
      this.pressed,
      data !== undefined ? this.getDescriptionFor(data) : this.getDescription(),
      this.getAbbreviatedDescription(),
      this.getIcon());

    button.events.subscribe(() => {
      this.execute(button.pressed);
    });

    this.events.subscribe(() => {
      button.pressed = this.pressed;
    });

    return button;
  }
}

/**
 * An action that changes the editor's selection mode.
 */
export class SetSelectionMode extends Action<{}> {
  constructor(editor: EditorAPI, name: string, icon: string,
              private readonly desiredMode: SelectionMode) {
    super(editor, `Set selection mode to ${name}`, name, icon, false);
  }

  execute(): void {
    this.editor.selectionMode = this.desiredMode;
  }

  makeButton(data?: boolean): Button {
    const button = new ToggleButton(
      this.editor.selectionMode === this.desiredMode,
      data !== undefined ? this.getDescriptionFor(data) : this.getDescription(),
      this.getAbbreviatedDescription(),
      this.getIcon());

    button.events.subscribe(() => {
      this.execute();
    });

    this.editor.selectionModeChanges.subscribe(({ value }) => {
      button.pressed = value === this.desiredMode;
    });

    return button;
  }
}

/**
 * An action that opens a documentation link. This is really meant to be used to
 * provide menu items to open links to element documentation. We do not take an
 * ``Element`` in the data because the discovery of whether an element has
 * documentation or not must be made **before** using this class.
 */
export class DocumentationAction extends Action<DocumentationActionData> {
  constructor(editor: EditorAPI) {
    super(editor, "Element's documentation.", undefined,
          makeHTML("documentation"), false);
  }

  execute(data: DocumentationActionData): void {
    this.editor.openDocumentationLink(data.docURL);
  }
}
