/**
 * Entry point for creating a wed bundle.
 */
import { Container } from "inversify";

import { makeEditor } from "wed";

import { AjaxSaver } from "@wedxml/ajax-saver";
import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
import { EditorInstance, Options } from "@wedxml/client-api";
import { EDITOR_OPTIONS, EDITOR_WIDGET, GRAMMAR_LOADER,
         SAVER } from "@wedxml/common/tokens";
import { TrivialGrammarLoader } from "@wedxml/trivial-grammar-loader";

function myMakeEditor(wedroot: Element, options: Options,
                      saverOptions: {}): EditorInstance {
  const container = new Container();
  container.bind(EDITOR_WIDGET).toConstantValue(wedroot);
  container.bind(EDITOR_OPTIONS).toConstantValue(options);
  container.bind(SAVER).to(AjaxSaver);
  container.bind(SAVER_OPTIONS).toConstantValue(saverOptions);
  container.bind(GRAMMAR_LOADER).to(TrivialGrammarLoader);
  return makeEditor(container);
}

export * from "wed";
export { myMakeEditor as makeEditor };
