import { expect, use } from "chai";
import { Container, injectable } from "inversify";
import "mocha";
// tslint:disable-next-line:match-default-export-name
import sinon from "sinon";
import sinonChai from "sinon-chai";

use(sinonChai);

import { Options } from "@wedxml/client-api";
import { expectError } from "@wedxml/common/test/util";
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

// tslint:disable-next-line:no-any
type ResponseSpec = [number, any, string];

describe("DefaultRuntime", () => {
  let xhr: sinon.SinonFakeXMLHttpRequestStatic;
  let nextResponses: ResponseSpec[] = [];
  let requests: sinon.SinonFakeXMLHttpRequest[] = [];

  const something: ResponseSpec =
    [200, { "Content-Type": "application/html" }, "something"];

  beforeEach(() => {
    nextResponses = [something];
    requests = [];
    xhr = sinon.useFakeXMLHttpRequest();
    xhr.onCreate = (request) => {
      requests.push(request);
      setTimeout(() => {
        const nextResponse = nextResponses.shift();
        if (nextResponse !== undefined) {
          request.respond(...nextResponse);
        }
      }, 1);
    };

  });

  afterEach(() => {
    if (xhr !== undefined) {
      xhr.restore();
    }
  });

  it("copies its options", () => {
    expect(makeRuntime(options)).to.have.property("options").not.equal(options);
  });

  // It is not the job of this test suite to check that the ajax methods do
  // everthing that bluejax provides. We do a minimal amount of testing to check
  // that they perform retries, that the configuration passed to the runtime is
  // passed along.
  describe("ajax", () => {
    it("returns a response", async () => {
      const runtime = makeRuntime(options);
      expect(await runtime.ajax("foo")).to.equal("something");
    });

    it("should retry", async () => {
      const runtime = makeRuntime(options);
      nextResponses = [];
      try {
        await runtime.ajax({ url: "foo", timeout: 10 });
      }
      // tslint:disable-next-line:no-empty
      catch {}
      // Retries 3 times + two server checks.
      expect(requests).to.have.lengthOf(5);
    });

    it("can have retry turned off", async () => {
      const runtime = makeRuntime({...options,
        bluejaxOptions: {
          diagnose: {},
        },
      });
      nextResponses = [];
      try {
        await runtime.ajax({ url: "foo", timeout: 10 });
      }
      // tslint:disable-next-line:no-empty
      catch {}
      expect(requests).to.have.lengthOf(1);
    });
  });

  describe("ajax$", () => {
    it("returns a response", async () => {
      const runtime = makeRuntime(options);
      expect(await runtime.ajax$("foo").promise).to.equal("something");
    });

    it("should retry", async () => {
      const runtime = makeRuntime(options);
      nextResponses = [];
      try {
        await runtime.ajax$({ url: "foo", timeout: 10 }).promise;
      }
      // tslint:disable-next-line:no-empty
      catch {}
      // Retries 3 times + two server checks.
      expect(requests).to.have.lengthOf(5);
    });

    it("can have retry turned off", async () => {
      const runtime = makeRuntime({...options,
        bluejaxOptions: {
          diagnose: {},
        },
      });
      nextResponses = [];
      try {
        await runtime.ajax$({ url: "foo", timeout: 10 }).promise;
      }
      // tslint:disable-next-line:no-empty
      catch {}
      expect(requests).to.have.lengthOf(1);
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
      await expectError(async () => runtime.resolve("nonexistent"),
                        Error, /.*/);
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
      await expectError(async () => runtime.resolveToString("nonexistent"),
                        Error, /.*/);
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
      await expectError(async () => runtime.resolveModules("nonexistent"),
                        Error, /.*/);
    });
  });
});
