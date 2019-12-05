/**
 * Genric actions.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { action, DLoc, EditorAPI, transformation, WED_ORIGIN } from "wed";

import Action = action.Action;
import NamedTransformationData = transformation.NamedTransformationData;

import { GenericMode } from "./generic";

export interface InsertPIData {
  name?: string;

  moveCaretTo?: DLoc;
}

export class InsertPI extends Action<InsertPIData> {
  constructor(editor: EditorAPI) {
    super(WED_ORIGIN, editor, "Insert PI", {
      kind: "add",
    });
  }

  execute(data: InsertPIData): void {
    const { caretManager } = this.editor;
    const caret = caretManager.getDataCaret(true)!;
    const mode = this.editor.modeTree.getMode(caret.node) as GenericMode<any>;
    const tr = mode.insertPITr;

    if (data.name !== undefined) {
      // Sigh... TS 3.4 needs the type assertion.
      tr.execute(data as NamedTransformationData);
      return;
    }

    this.editor.prompt({
      title: "Provide a name (target) for the processing instruction:",
    }).then(result => {
      if (result === null) {
        return;
      }

      tr.execute({
        name: result,
        moveCaretTo: data.moveCaretTo,
      });
    });
  }
}
