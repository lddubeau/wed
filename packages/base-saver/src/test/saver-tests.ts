import chai from "chai";
import { expect, use } from "chai";
import { expectRejection, use as erUse } from "expect-rejection";
import "mocha";
import { first } from "rxjs/operators";
import sinon from "sinon";
import sinonChai from "sinon-chai";

use(sinonChai);
erUse(chai);

import { SaveKind } from "@wedxml/client-api";

import { BaseSaver, SaverOptions } from "../base-saver";

export type Hook = () => void | Promise<void>;

/**
 * This function can be used by test suites for saver implementations to verify
 * that savers respect the behavior that all savers should have.
 *
 * @param testName The name to give this test.
 *
 * @param saverMaker A function for making a saver.
 */
// tslint:disable-next-line:max-func-body-length
export function makeSaverTests(testName: string,
                               saverMaker:
                               (options: SaverOptions) => BaseSaver,
                               beforeAllHook: Hook = () => undefined,
                               afterAllHook: Hook = () => undefined): void {
  //
  // Our goal is to cover the public API since it is used by client code and
  // protected API because it is used by derived classes.
  //

  describe(testName , () => {
    before(beforeAllHook);

    after(afterAllHook);
    describe("newly created", () => {
      let saver: BaseSaver;
      before(() => {
        saver = saverMaker({});
      });

      it("is not initialized", () => {
        expect(saver).to.have.property("initialized").be.false;
      });

      it("is not failed", () => {
        expect(saver).to.have.property("failed").be.false;
      });

      it("has a currentGeneration of 0", () => {
        expect(saver).to.have.property("currentGeneration").to.equal(0);
      });

      it("has a savedGeneration of 0", () => {
        expect(saver).to.have.property("savedGeneration").to.equal(0);
      });

      it("has an undefined dataTree", () => {
        expect(saver).to.not.have.property("dataTree");
      });

      it("has an undefined version", () => {
        expect(saver).to.not.have.property("version");
      });
    });

    describe("#init", () => {
      let saver: BaseSaver;
      let spy: sinon.SinonSpy;

      before(async () => {
        saver = saverMaker({});
        spy = sinon.spy(saver as any, "_init");
        await saver.init("1.0.0", document.body);
      });

      it("sets version", () => {
        expect(saver).to.have.property("version").equal("1.0.0");
      });

      it("sets dataTree", () => {
        expect(saver).to.have.property("dataTree").equal(document.body);
      });

      it("invokes _init", () => {
        expect(spy).to.have.been.calledOnce;
      });
    });

    describe("#init", () => {
      let saver: BaseSaver;
      let stub: sinon.SinonStub;

      beforeEach(() => {
        saver = saverMaker({});
        stub = sinon.stub(saver as any, "_init");
      });

      it("fails if _init fails", async () => {
        const error = new Error("foo");
        stub.returns(Promise.reject(error));
        await expectRejection(saver.init("1.0.0", document.body), Error,
                              /^foo$/);
        expect(stub).to.have.been.calledOnce;
      });

      it("fails when called twice", async () => {
        await saver.init("1.0.0", document.body);
        await expectRejection(saver.init("1.0.0", document.body),
                              Error, /^init called more than once$/);
      });
    });

    describe("#change", () => {
      let saver: BaseSaver;

      beforeEach(async () => {
        saver = saverMaker({});
        await saver.init("1.0.0", document.body);
      });

      describe("on a new saver", () => {
        it("updates #currentGeneration", () => {
          const orig = (saver as any).currentGeneration;
          saver.change();
          expect((saver as any).currentGeneration).to.not.equal(orig);
        });

        it("causes to emit a Changed event", async () => {
          const p = saver.events.pipe(first()).toPromise();
          saver.change();
          expect(await p).to.have.property("name").equal("Changed");
        });
      });

      describe("when the data is already changed", () => {
        beforeEach(() => {
          saver.change();
        });

        it("does not update #currentGeneration", () => {
          const orig = (saver as any).currentGeneration;
          saver.change();
          expect((saver as any).currentGeneration).to.equal(orig);
        });

        it("does not emit an event", async () => {
          const spy = sinon.spy();
          saver.events.subscribe(spy);
          saver.change();
          expect(spy).to.not.have.been.called;
        });
      });

      describe("when the data has been saved", () => {
        beforeEach(async () => {
          saver.change();
          await saver.save();
        });

        it("updates #currentGeneration", () => {
          const orig = (saver as any).currentGeneration;
          saver.change();
          expect((saver as any).currentGeneration).to.not.equal(orig);
        });

        it("causes to emit a Changed event", async () => {
          const p = saver.events.pipe(first()).toPromise();
          saver.change();
          expect(await p).to.have.property("name").equal("Changed");
        });
      });
    });

    describe("#save", () => {
      let saver: BaseSaver;
      let stub: sinon.SinonStub;

      beforeEach(async () => {
        saver = saverMaker({});
        stub = sinon.stub(saver as any, "_save");
        await saver.init("1.0.0", document.body);
      });

      it("calls _save with autosave false", async () => {
        await saver.save();
        expect(stub).to.have.been.calledOnce;
        expect(stub).to.have.been.calledWith(false);
      });

      it("fails if _save fails", async () => {
        const error = new Error("foo");
        stub.returns(Promise.reject(error));
        await expectRejection(saver.save(), error);
        expect(stub).to.have.been.calledOnce;
      });
    });

    describe("#getData", () => {
      const xml = `<doc attr="foo"/>`;
      let saver: BaseSaver;

      beforeEach(async () => {
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        saver = saverMaker({});
        await saver.init("1.0.0", doc);
      });

      it("produces a serialization of #dataTree", () => {
        expect((saver as any).getData()).to.equal(xml);
      });
    });

    describe("#_saveSuccess", () => {
      let saver: BaseSaver;

      beforeEach(async () => {
        saver = saverMaker({});
        await saver.init("1.0.0", document.body);
      });

      it("updates #savedGeneration", () => {
        const orig = (saver as any).savedGeneration;
        (saver as any)._saveSuccess(false, 999);
        expect(saver).to.have.property("savedGeneration").not.equal(orig);
        expect(saver).to.have.property("savedGeneration").equal(999);
      });

      it("generates an Saved event when autosave false", async () => {
        const p = saver.events.pipe(first()).toPromise();
        (saver as any)._saveSuccess(false, 999);
        expect(await p).to.have.property("name").equal("Saved");
      });

      it("generates an Autosaved event when autosave true", async () => {
        const p = saver.events.pipe(first()).toPromise();
        (saver as any)._saveSuccess(true, 999);
        expect(await p).to.have.property("name").equal("Autosaved");
      });

      it("calls #setAutosaveInterval", () => {
        const spy = sinon.spy(saver, "setAutosaveInterval");
        (saver as any)._saveSuccess(true, 999);
        expect(spy).to.have.been.calledOnce;
      });
    });

    describe("#_fail", () => {
      let saver: BaseSaver;

      beforeEach(async () => {
        saver = saverMaker({});
        await saver.init("1.0.0", document.body);
      });

      it("generates a Failed event", async () => {
        const p = saver.events.pipe(first()).toPromise();
        const saveError = {
          type: undefined,
          msg: "fnord",
        };
        (saver as any)._fail(saveError);
        const error = await p;
        expect(error).to.have.property("name").equal("Failed");
        expect(error).to.have.property("error").equal(saveError);
      });

      it("sets #failed to true", async () => {
        expect(saver).to.have.property("failed").false;
        const saveError = {
          type: undefined,
          msg: "fnord",
        };
        (saver as any)._fail(saveError);
        expect(saver).to.have.property("failed").true;
      });
    });

    describe("#setAutosaveInterval", () => {
      let saver: BaseSaver;

      beforeEach(async () => {
        saver = saverMaker({
          autosave: 5000,
        });
        await saver.init("1.0.0", document.body);
      });

      it("schedules a new autosave", () => {
        const orig = (saver as any).autosaveTimeout;
        saver.setAutosaveInterval(10000);
        expect(saver).to.have.property("autosaveTimeout").not.equal(orig);
        expect(saver).to.have.property("autosaveTimeout").not.be.undefined;
      });

      it("when called with 0, stops autosaves", () => {
        const orig = (saver as any).autosaveTimeout;
        saver.setAutosaveInterval(0);
        expect(saver).to.have.property("autosaveTimeout").not.equal(orig);
        expect(saver).to.have.property("autosaveTimeout").be.undefined;
      });
    });

    describe("#recover", () => {
      let saver: BaseSaver;
      let stub: sinon.SinonStub;

      beforeEach(async () => {
        saver = saverMaker({});
        stub = sinon.stub(saver as any, "_recover");
      });

      describe("returns undefined and does not call recover", () => {
        it("on an uninitialized saver", async () => {
          expect(await saver.recover()).to.be.undefined;
          expect(stub).to.not.have.been.calledOnce;
        });

        it("on a failed saver", async () => {
          await saver.init("1.0.0", document.body);
          (saver as any)._fail();
          expect(await saver.recover()).to.be.undefined;
          expect(stub).to.not.have.been.calledOnce;
        });
      });

      it("calls #_recover", async () => {
        await saver.init("1.0.0", document.body);
        await saver.recover();
        expect(stub).to.have.been.calledOnce;
      });

      it("returns the value of #_recover", async () => {
        await saver.init("1.0.0", document.body);
        stub.returns(Promise.resolve(true));
        expect(await saver.recover()).to.be.true;
        expect(stub).to.have.been.calledOnce;
      });
    });

    describe("#getModifiedWhen()", () => {
      let saver: BaseSaver;

      beforeEach(async () => {
        saver = saverMaker({});
        await saver.init("1.0.0", document.body);
      });

      it("returns false on a new saver", () => {
        expect(saver.getModifiedWhen()).to.be.false;
      });

      it("returns a sensible value after #change is called", () => {
        expect(saver.getModifiedWhen()).to.be.false;
        saver.change();
        expect(saver.getModifiedWhen()).to.match(/^moments ago$/);
      });
    });

    describe("#getSavedWhen()", () => {
      let saver: BaseSaver;

      beforeEach(async () => {
        saver = saverMaker({});
        await saver.init("1.0.0", document.body);
      });

      it("returns undefined on a new saver", () => {
        expect(saver.getSavedWhen()).to.be.undefined;
      });

      it("returns a sensible value after a save", async () => {
        expect(saver.getSavedWhen()).to.be.undefined;
        await saver.save();
        expect(saver.getSavedWhen()).to.match(/^moments ago$/);
      });
    });

    describe("#getLastSaveKind()", () => {
      let saver: BaseSaver;

      beforeEach(async () => {
        saver = saverMaker({});
        await saver.init("1.0.0", document.body);
      });

      it("returns undefined on a new saver", () => {
        expect(saver.getLastSaveKind()).to.be.undefined;
      });

      it("returns a sensible value after a manual save", async () => {
        expect(saver.getLastSaveKind()).to.be.undefined;
        await saver.save();
        expect(saver.getLastSaveKind()).to.equal(SaveKind.MANUAL);
      });

      it("returns a sensible value after an autosave", async () => {
        expect(saver.getLastSaveKind()).to.be.undefined;
        const clock = sinon.useFakeTimers();
        saver.change();
        const p = saver.events.pipe(first()).toPromise();
        saver.setAutosaveInterval(1);
        clock.tick(2);
        expect(await p).to.have.property("name").equal("Autosaved");
        expect(saver.getLastSaveKind()).to.equal(SaveKind.AUTO);
        clock.restore();
      });
    });
  });
}
