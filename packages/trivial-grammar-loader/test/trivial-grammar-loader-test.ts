import { expect } from "chai";
import { Container, injectable } from "inversify";
import "mocha";
import { Grammar } from "salve";

import { Runtime } from "@wedxml/client-api";
import { GRAMMAR_LOADER, RUNTIME } from "@wedxml/common/tokens";

import { TrivialGrammarLoader } from "trivial-grammar-loader";

//
// TrivialGrammarLoader uses only resolveToString.
//
@injectable()
class FakeRuntime implements Pick<Runtime, "resolveToString"> {
  async resolveToString(url: string): Promise<string> {
    return (await fetch(url)).text();
  }
}

function makeLoader(): TrivialGrammarLoader {
  const container = new Container();
  container.bind(RUNTIME).to(FakeRuntime);
  container.bind(GRAMMAR_LOADER).to(TrivialGrammarLoader);

  return container.get(GRAMMAR_LOADER);
}

describe("TrivialGrammarLoader", () => {
  let loader: TrivialGrammarLoader;

  before(() => {
    loader = makeLoader();
  });

  it("load json", async () => {
    const grammar = await loader.load("/base/test/data/simple.js");
    expect(grammar).to.be.instanceOf(Grammar);
    expect(grammar.elementDefinitions)
      .to.have.property(JSON.stringify({ns: "", name: "html"}));
  });

  it("load RNG", async () => {
    const grammar =
      await loader.load("/base/test/data/inclusion/doc-unannotated.rng");
    expect(grammar).to.be.instanceOf(Grammar);
    expect(grammar.elementDefinitions)
      .to.have.property(JSON.stringify({
        // tslint:disable-next-line:no-http-string
        ns: "http://mangalamresearch.org/ns/mmwp/doc-unannotated",
        name: "doc",
      }));
  });
});
