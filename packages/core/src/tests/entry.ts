/**
 * Entry point for creating a wed bundle.
 */
import { Container } from "inversify";

import { makeEditor, Options, tokens } from "wed";
import { Editor } from "wed/editor";

import { AjaxSaver } from "@wedxml/ajax-saver";
import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
import { TrivialGrammarLoader } from "@wedxml/trivial-grammar-loader";

function myMakeEditor(wedroot: Element, options: Options,
                      saverOptions: {}): Editor {
  const container = new Container();
  container.bind(tokens.EDITOR_WIDGET).toConstantValue(wedroot);
  container.bind(tokens.EDITOR_OPTIONS).toConstantValue(options);
  container.bind(tokens.SAVER).to(AjaxSaver);
  container.bind(SAVER_OPTIONS).toConstantValue(saverOptions);
  container.bind(tokens.GRAMMAR_LOADER).to(TrivialGrammarLoader);
  return makeEditor(container) as Editor;
}

export * from "wed";
export { myMakeEditor as makeEditor };
