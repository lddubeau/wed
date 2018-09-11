/**
 * Entry point for creating a wed bundle.
 */
import { Container } from "inversify";

import { makeEditor, Options, tokens } from "wed";
import { Editor } from "wed/editor";

import { TrivialGrammarLoader } from "@wedxml/trivial-grammar-loader";

function myMakeEditor(wedroot: Element, options: Options): Editor {
  const container = new Container();
  container.bind(tokens.EDITOR_WIDGET).toConstantValue(wedroot);
  container.bind(tokens.EDITOR_OPTIONS).toConstantValue(options);
  container.bind(tokens.GRAMMAR_LOADER).to(TrivialGrammarLoader);
  return makeEditor(container) as Editor;
}

export * from "wed";
export { myMakeEditor as makeEditor };
