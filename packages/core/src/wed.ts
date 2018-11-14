/**
 * The main module of wed.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Container } from "inversify";

import { EditorInstance, GrammarLoader, Options,
         Runtime } from "@wedxml/client-api";
import * as tokens from "@wedxml/common/tokens";
import { DefaultRuntime } from "@wedxml/default-runtime";

import * as convert from "./wed/convert";
import * as domtypeguards from "./wed/domtypeguards";
import * as domutil from "./wed/domutil";
import { Editor } from "./wed/editor";
import * as exceptions from "./wed/exceptions";
import * as inputTriggerFactory from "./wed/input-trigger-factory";
import * as key from "./wed/key";
import * as keyConstants from "./wed/key-constants";
import * as labelman from "./wed/labelman";
import * as objectCheck from "./wed/object-check";
import * as onerror from "./wed/onerror";
import * as transformation from "./wed/transformation";
import * as treeUpdater from "./wed/tree-updater";
import * as util from "./wed/util";

export {
  convert,
  DefaultRuntime,
  domutil,
  domtypeguards,
  EditorInstance,
  exceptions,
  GrammarLoader,
  inputTriggerFactory,
  key,
  keyConstants,
  labelman,
  objectCheck,
  onerror,
  Options,
  Runtime,
  tokens,
  transformation,
  treeUpdater,
  util,
};

export function makeEditor(container: Container): EditorInstance {
  container.bind<Runtime>(tokens.RUNTIME).to(DefaultRuntime);
  container.bind<EditorInstance>(tokens.EDITOR_INSTANCE).to(Editor);
  return container.get<EditorInstance>(tokens.EDITOR_INSTANCE);
}

export { Action } from "./wed/action";
export { Decorator } from "./wed/decorator";
export { DLoc, DLocRoot } from "./wed/dloc";
export { DOMListener } from "./wed/domlistener";
export { version } from "./wed/editor";
export { GUISelector } from "./wed/gui-selector";
export { BaseMode, CommonModeOptions, Mode } from "./wed/mode";
export * from "./wed/mode-api";
export { SelectionMode } from "./wed/selection-mode";
export { UndoMarker } from "./wed/undo";
// We export Validator too because it is useful in some cases for utility code
// to be able to perform validation of DOM trees with a bona-fide wed validator
// that can take mode validators.
export { ModeValidator, Validator } from "./wed/validator";
export { WedOptions } from "./wed/wed-options";

import * as button_ from "./wed/gui/button";
import * as contextMenu_ from "./wed/gui/context-menu";
import * as modal_ from "./wed/gui/modal";
import * as tooltip_ from "./wed/gui/tooltip";
import * as typeaheadPopup_ from "./wed/gui/typeahead-popup";
export namespace gui {
  export import button = button_;
  export import contextMenu = contextMenu_;
  export import modal = modal_;
  export import tooltip = tooltip_;
  export import typeaheadPopup = typeaheadPopup_;
}

//  LocalWords:  domutil DLocRoot runtime MPL
