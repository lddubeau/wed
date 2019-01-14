/**
 * Entry point for creating a wed bundle.
 */
import { Container } from "inversify";

import { bindEditor } from "wed";

import { AjaxSaver } from "@wedxml/ajax-saver";
import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
import { EditorInstance, Options } from "@wedxml/client-api";
import { EDITOR_INSTANCE, EDITOR_OPTIONS, EDITOR_WIDGET, GRAMMAR_LOADER,
         RUNTIME, SAVER } from "@wedxml/common/tokens";
import { DefaultRuntime } from "@wedxml/default-runtime";
import { TrivialGrammarLoader } from "@wedxml/trivial-grammar-loader";

// It is important to reexport everything from wed because modes need to be able
// to get what wed exports. Since this file becomes the entry point of the
// bundle, we must reexport everything.
export * from "wed";

// There are many ways this could be implemented. We export a makeEditor
// function which takes parameters that are liable to change from case to case.
export function makeEditor(wedroot: Element, options: Options,
                           saverOptions: {}): EditorInstance {
  // You must create an InversifyJS container.
  const container = new Container();

  // The EDITOR_WIDGET is the DOM element that the editor will take over. This
  // binding is mandatory.
  container.bind(EDITOR_WIDGET).toConstantValue(wedroot);

  // EDITOR_OPTIONS are the options to pass to the editor that will be
  // created. This binding is mandatory.
  container.bind(EDITOR_OPTIONS).toConstantValue(options);

  // This editor will use an AjaxSaver object to save. The SAVER and
  // SAVER_OPTIONS bindings are mandatory.
  container.bind(SAVER).to(AjaxSaver);
  container.bind(SAVER_OPTIONS).toConstantValue(saverOptions);

  // GRAMMAR_LOADER is the object we use to load Relax NG grammars. It is
  // mandatory.
  container.bind(GRAMMAR_LOADER).to(TrivialGrammarLoader);

  // RUNTIME is mandatory. You'll typically use DefaultRuntime for this.
  container.bind(RUNTIME).to(DefaultRuntime);

  // You must call this function to bind the editor class to the container.
  bindEditor(container);

  // And this is how you get a new editor that you can use.
  return container.get<EditorInstance>(EDITOR_INSTANCE);
}
