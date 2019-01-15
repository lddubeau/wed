// tslint:disable-next-line:missing-jsdoc
import { expect, use } from "chai";
import * as fetchiest from "fetchiest";
import "mocha";
import { first } from "rxjs/operators";
import sinon from "sinon";
import sinonChai from "sinon-chai";

use(sinonChai);

import { SaverOptions } from "@wedxml/base-saver";
import { makeSaverTests } from "@wedxml/base-saver/test/saver-tests";
import { Options, Runtime } from "@wedxml/client-api";

import { DBSaver, Store } from "db-saver";

class FakeRuntime implements Runtime {
  options: Options;

  constructor() {
    this.options = {} as any;
  }

  async fetch(input: RequestInfo,
              init?: fetchiest.FetchiestRequestInit): Promise<Response> {
    const resp = await fetch(input, init);
    if (!resp.ok) {
      const err = new Error("failed");
      (err as any).response = resp;
      throw err;
    }

    return resp;
  }

  async resolve(_uri: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  async resolveToString(_uri: string): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async resolveModules(_names: string | string[]): Promise<{}[]> {
    throw new Error("Method not implemented.");
  }
}

class MyStore implements Store {
  // tslint:disable-next-line:no-empty
  async put(_name: string, _data: string): Promise<void> {}
}

// tslint:disable-next-line:mocha-no-side-effect-code
const store = new MyStore();

const generalOptions = {
  name: "fnord",
  getStore: () => store,
};

makeSaverTests("DBSaver (BaseSaver API)",
               (options: SaverOptions) =>
               new DBSaver(new FakeRuntime(), {
                 ...options,
                 ...generalOptions,
               }));

describe("DBSaver", () => {
  let sandbox: sinon.SinonSandbox;
  let rt: Runtime;
  let doc: Document;
  let putStub: sinon.SinonStub;
  let saver: DBSaver;

  before(() => {
    sandbox = sinon.createSandbox();
    putStub = sandbox.stub(store, "put");
    rt = new FakeRuntime();
    doc = new DOMParser().parseFromString("<doc/>", "text/xml");
  });

  beforeEach(async () => {
    putStub.returns(Promise.resolve());
    saver = new DBSaver(rt, generalOptions);
    await saver.init("0.30.0", doc);
  });

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  describe("#init", () => {
    it("marks the saver as initialized", async () => {
      const newSaver = new DBSaver(rt, generalOptions);
      await newSaver.init("0.30.0", document);
      expect(newSaver).to.have.property("initialized").true;
    });
  });

  describe("#save", () => {
    it("is a no-op on an uninitialized saver", async () => {
      await new DBSaver(rt, generalOptions).save();
      expect(putStub).to.have.not.been.called;
    });

    it("puts into the store", async () => {
      await saver.save();
      expect(putStub).to.have.been.calledWith("fnord", "<doc/>");
    });

    it("emits fail event if the save fails", async () => {
      putStub.returns(Promise.reject(new Error("failed")));
      const p = saver.events.pipe(first()).toPromise();
      await saver.save();
      expect(await p).to.have.property("name").equal("Failed");
      expect(await p).to.have.nested.property("error.type").undefined;
      expect(await p).to.have.nested.property("error.msg")
        .equal("Failed to save!");
    });

    it("marks the saver as failed if the save fails", async () => {
      putStub.returns(Promise.reject(new Error("failed")));
      await saver.save();
      expect(saver).to.have.property("failed").true;
    });
  });

  describe("#recover", () => {
    it("is a no-op on an uninitialized saver", async () => {
      expect(await new DBSaver(rt, generalOptions).recover())
        .to.be.undefined;
      expect(putStub).to.have.not.been.called;
    });

    it("is a no-op on failed saver", async () => {
      putStub.returns(Promise.reject(new Error("failed")));
      await saver.save();
      putStub.reset();
      expect(saver).to.have.property("failed").true;
      expect(await saver.recover()).to.be.undefined;
      expect(putStub).to.have.not.been.called;
    });

    it("puts data into the store", async () => {
      expect(await saver.recover()).to.be.true;
      expect(putStub).to.have.been.calledWith("fnord", "<doc/>");
    });

    it("returns false on failure", async () => {
      putStub.returns(Promise.reject(new Error("failed")));
      expect(await saver.recover()).to.be.false;
    });
  });
});
