import { expect, use } from "chai";
import { expectRejection } from "expect-rejection";
import { Container, injectable } from "inversify";
import "mocha";
// tslint:disable-next-line:match-default-export-name
import sinon from "sinon";
import sinonChai from "sinon-chai";

use(sinonChai);

import { Options } from "@wedxml/client-api";
import { EDITOR_OPTIONS, RUNTIME } from "@wedxml/common/tokens";

// tslint:disable-next-line:no-implicit-dependencies
import { DefaultRuntime, RUNTIME_URI_SCHEME_HANDLER,
         RuntimeURISchemeHandler } from "default-runtime";

function makeRuntime(runtimeOptions: Options): DefaultRuntime {
  const container = new Container();
  container.bind(EDITOR_OPTIONS).toConstantValue(runtimeOptions);
  container.bind(RUNTIME).to(DefaultRuntime);

  return container.get<DefaultRuntime>(RUNTIME);
}

const options: Options = {
  schema: "foo",
  mode: {
    path: "moo",
  },
};

describe("DefaultRuntime", () => {
  let sandbox: sinon.SinonSandbox;
  let fetchStub: sinon.SinonStub;

  before(() => {
    sandbox = sinon.createSandbox({
      useFakeTimers: false,
    });
    fetchStub = sandbox.stub(window, "fetch");
  });

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  it("copies its options", () => {
    expect(makeRuntime(options)).to.have.property("options").not.equal(options);
  });

  describe("fetch", () => {
    it("returns a response", async () => {
      const resp = { ok: true };
      fetchStub.returns(Promise.resolve(resp));
      const runtime = makeRuntime(options);
      expect(await runtime.fetch("foo")).to.equal(resp);
    });

    it("should retry", async () => {
      // tslint:disable-next-line:promise-must-complete no-empty
      fetchStub.returns(new Promise(() => {}));
      const runtime = makeRuntime(options);
      try {
        await runtime.fetch("foo", { fetchiestOptions: { timeout: 10 } });
      }
      // tslint:disable-next-line:no-empty
      catch {}
      // Retries 3 times + two server checks.
      expect(fetchStub).to.have.callCount(5);
    });

    it("can have retry turned off", async () => {
      const runtime = makeRuntime({...options,
        fetchiestOptions: {
          diagnose: {},
        },
      });
      try {
        await runtime.fetch("foo", { fetchiestOptions: { timeout: 10 } });
      }
      // tslint:disable-next-line:no-empty
      catch {}
      expect(fetchStub).to.have.callCount(1);
    });
  });
});

@injectable()
class ExampleHandler implements RuntimeURISchemeHandler {
  file: Blob | null = null;

  canHandle(scheme: string): boolean {
    return scheme === "fnord";
  }

  // tslint:disable-next-line:no-any
  async resolve(uri: string): Promise<any> {
    switch (uri) {
      case "fnord://string":
        return "string";
      case "fnord://file":
        return this.file;
      default:
        throw new Error(`cannot resolve ${uri}`);
    }
  }
}

describe("DefaultRuntime", () => {
  let runtime: DefaultRuntime;
  let file: Blob;
  let handler: ExampleHandler;

  before(() => {
    file = new Blob(["q"], { type: "text" });

    const container = new Container();
    container.bind(EDITOR_OPTIONS).toConstantValue(options);
    handler = new ExampleHandler();
    handler.file = file;
    container.bind(RUNTIME_URI_SCHEME_HANDLER).toConstantValue(handler);
    container.bind(RUNTIME).to(DefaultRuntime);

    runtime = container.get<DefaultRuntime>(RUNTIME);
  });

  describe("resolve", () => {
    it("loads files", async () => {
      expect(await runtime.resolve("/base/test/data/text.txt"))
        .to.equal("contents\n");
    });

    it("rejects if a file is not available", async () => {
      await expectRejection(runtime.resolve("nonexistent"), Error, /.*/);
    });

    it("uses handlers", async () => {
      const spy = sinon.spy(handler, "resolve");
      expect(await runtime.resolve("fnord://string")).to.equal("string");
      expect(spy).to.have.been.calledOnce;
    });
  });

  describe("resolveToString", () => {
    it("loads files", async () => {
      expect(await runtime.resolveToString("/base/test/data/text.txt"))
        .to.equal("contents\n");
    });

    it("rejects if a file is not available", async () => {
      await expectRejection(runtime.resolveToString("nonexistent"), Error,
                            /.*/);
    });

    it("converts files to strings", async () => {
      expect(await runtime.resolveToString("fnord://file")).to.equal("q");
    });

  });

  describe("resolveModules", () => {
    it("loads modules", async () => {
      expect(await runtime.resolveModules(["/base/test/data/modA",
                                           "/base/test/data/modB"]))
        .to.deep.equal([{ modA: "modA"}, { modB: "modB" }]);
    });

    it("loads modules", async () => {
      expect(await runtime.resolveModules("/base/test/data/modA"))
        .to.deep.equal([{ modA: "modA"}]);
    });

    it("rejects if the module is not available", async () => {
      await expectRejection(runtime.resolveModules("nonexistent"), Error, /.*/);
    });
  });
});
