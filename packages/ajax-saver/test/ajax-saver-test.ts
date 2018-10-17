// tslint:disable-next-line:missing-jsdoc
import { expect, use } from "chai";
import $ from "jquery";
import "mocha";
import qs from "qs";
import { first } from "rxjs/operators";
import * as sinon from "sinon";
import sinonChai from "sinon-chai";

use(sinonChai);

import { SaverOptions } from "@wedxml/base-saver";
import { makeSaverTests } from "@wedxml/base-saver/test/saver-tests";
import { Options, Runtime } from "@wedxml/client-api";
import { expectError } from "@wedxml/common/test/util";
import * as bluejax from "bluejax";

import { AjaxSaver } from "ajax-saver";

class FakeRuntime implements Runtime {
  options: Options;
  ajax: any;
  ajax$: any;

  constructor() {
    this.options = {} as any;
    const ajax$ = bluejax.make({});
    this.ajax$ = ajax$;
    this.ajax = async (...args: any[]) => {
      return ajax$(...args).promise;
    };
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

function handleSave(request: sinon.SinonFakeXMLHttpRequest): void {
  const decoded = qs.parse(request.requestBody);
  let status = 200;
  const headers: Record<string, string> =
    { "Content-Type": "application/json" };
  // tslint:disable-next-line:no-reserved-keywords
  const messages: { type: string }[] = [];

  switch (decoded.command) {
    case "check":
      break;
    case "save":
    case "autosave":
    case "recover":
      messages.push({ type: "save_successful" });
      break;
    default:
      status = 400;
  }

  request.respond(status, headers, JSON.stringify({ messages }));
}

{
  let sandbox: sinon.SinonSandbox;
  makeSaverTests("AjaxSaver (BaseSaver API)",
                 (options: SaverOptions) =>
                 new AjaxSaver(new FakeRuntime(), {...options, url: "/moo" }),
                 () => {
                   sandbox = sinon.createSandbox({ useFakeServer: true });
                   const server = sandbox.server;
                   server.respondImmediately = true;
                   server.respondWith(handleSave);
                 },
                 () => {
                   sandbox.reset();
                 });
}

describe("AjaxSaver", () => {
  let sandbox: sinon.SinonSandbox;
  let rt: Runtime;
  let server: sinon.SinonFakeServer;
  let doc: Document;

  before(() => {
    sandbox = sinon.createSandbox({ useFakeServer: true });
    rt = new FakeRuntime();
    server = sandbox.server;
    server.respondImmediately = true;
    doc = new DOMParser().parseFromString("<doc/>", "text/xml");
  });

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  it("can be created", () => {
    new AjaxSaver(rt, { url: "/moo" });
  });

  describe("#init", () => {
    it("sends a check command with the editor version", async () => {
      const saver = new AjaxSaver(rt, { url: "/moo" });
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({messages: []})]);
      await saver.init("0.30.0", document);
      expect(server).to.have.property("requests").have.lengthOf(1);
      expect(server).to.have.nested.property("requests[0].requestBody")
        .equal($.param({ command: "check", version: "0.30.0" }));
    });

    it("sets the saver as initialized if the version check works", async () => {
      const saver = new AjaxSaver(rt, { url: "/moo" });
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({messages: []})]);
      await saver.init("0.30.0", document);
      expect(saver).to.have.property("initialized").true;
      expect(saver).to.have.property("failed").false;
    });

    it("marks the saver as failed if the version check fails", async () => {
      const saver = new AjaxSaver(rt, { url: "/moo" });
      server.respondWith("POST", "/moo", [
        200, { "Content-Type": "application/json" },
        JSON.stringify({
          messages: [{ type: "version_too_old_error" }],
        }),
      ]);
      await saver.init("0.30.0", document);
      expect(saver).to.have.property("failed").true;
    });

    it("rejects if the underlying ajax fails", async () => {
      const saver = new AjaxSaver(rt, { url: "/moo" });
      server.respondWith("POST", "/moo", [
        404, { "Content-Type": "text/plain" }, "",
      ]);
      await expectError(saver.init("0.30.0", document),
                        Error, /^\/moo is not responding to a check;/);
    });

    it("does not set If-Match if there is no etag in the options", async () => {
      const saver = new AjaxSaver(rt, { url: "/moo" });
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({messages: []})]);
      await saver.init("0.30.0", document);
      expect(server).to.have.property("requests").have.lengthOf(1);
      expect(server).to.not.have.nested
        .property("requests[0].requestHeaders.If-Match");
    });

    it("sets If-Match if there an etag in the options", async () => {
      const saver = new AjaxSaver(rt, {
        url: "/moo",
        initial_etag: "abc",
      });
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({messages: []})]);
      await saver.init("0.30.0", document);
      expect(server).to.have.property("requests").have.lengthOf(1);
      expect(server).to.have.nested
        .property("requests[0].requestHeaders.If-Match").equal("\"abc\"");
    });
  });

  describe("#save", () => {
    let saver: AjaxSaver;

    beforeEach(async () => {
      saver = new AjaxSaver(rt, { url: "/moo" });
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({messages: []})]);
      await saver.init("0.30.0", doc);
      server.requests = [];
    });

    it("is a no-op on an uninitialized saver", async () => {
      await new AjaxSaver(rt, { url: "/blerh" }).save();
      expect(server).to.have.property("requests").have.lengthOf(0);
    });

    it("sends a save command", async () => {
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({messages: [
                            { type: "save_successful" },
                          ]})]);
      await saver.save();
      const body = server.requests[0].requestBody;
      const params = new URLSearchParams(body);
      expect(params.get("command")).to.equal("save");
      expect(params.get("version")).to.equal("0.30.0");
      expect(params.get("data")).to.equal("<doc/>");
    });

    describe("when the server does not send an HTTP success", () => {
      beforeEach(() => {
        server.respondWith("POST", "/moo",
                           [400, { "Content-Type": "text/plain" }, ""]);
      });

      it("marks saver as failed", async () => {
        await saver.save();
        expect(saver).to.have.property("failed").true;
      });

      it("emits fail event", async () => {
        const p = saver.events.pipe(first()).toPromise();
        await saver.save();
        expect(await p).to.have.property("name").equal("Failed");
        expect(await p).to.have.nested.property("error.type")
          .equal("save_disconnected");
        expect(await p).to.have.nested.property("error.msg")
          .equal("Your browser cannot contact the server");
      });
    });

    describe("when the response has no messages", async () => {
      const message = `The server accepted the save request but did \
not return any information regarding whether the save was successful or not.`;

      beforeEach(() => {
        server.respondWith("POST", "/moo",
                           [200, { "Content-Type": "application/json" },
                            JSON.stringify({ messages: []})]);
      });

      it("rejects", async () => {
        await expectError(saver.save(), Error, message);
      });

      it("marks saver as failed", async () => {
        await expectError(saver.save(), Error, message);
        expect(saver).to.have.property("failed").true;
      });

      it("does not emit a fail event", async () => {
        const spy = sinon.spy((saver as any)._events, "next");
        await expectError(saver.save(), Error, message);
        expect(spy).to.have.not.been.called;
      });
    });

    describe("when a save_fatal_error message is returned", async () => {
      const message = `The server was not able to save the data due to \
a fatal error. Please contact technical support before trying to edit again.`;

      beforeEach(() => {
        server.respondWith("POST", "/moo",
                           [200, { "Content-Type": "application/json" },
                            JSON.stringify({ messages: [
                              { type: "save_fatal_error" },
                            ]})]);
      });

      it("rejects", async () => {
        await expectError(saver.save(), Error, message);
      });

      it("marks saver as failed", async () => {
        await expectError(saver.save(), Error, message);
        expect(saver).to.have.property("failed").true;
      });

      it("does not emit a fail event", async () => {
        const spy = sinon.spy((saver as any)._events, "next");
        await expectError(saver.save(), Error, message);
        expect(spy).to.have.not.been.called;
      });
    });

    describe("when a save_transient_error message is returned", async () => {
      beforeEach(() => {
        server.respondWith("POST", "/moo",
                           [200, { "Content-Type": "application/json" },
                            JSON.stringify({ messages: [
                              { type: "save_transient_error" },
                            ]})]);
      });

      it("does not reject", async () => {
        await saver.save();
      });

      it("does not mark saver as failed", async () => {
        await saver.save();
        expect(saver).to.have.property("failed").false;
      });

      it("emits a fail event", async () => {
        const p = saver.events.pipe(first()).toPromise();
        await saver.save();
        expect(await p).to.have.property("name").equal("Failed");
        expect(await p).to.have.nested.property("error.type")
          .equal("save_transient_error");
      });
    });

    describe("when a save_edited message is returned", async () => {
      beforeEach(() => {
        server.respondWith("POST", "/moo",
                           [200, { "Content-Type": "application/json" },
                            JSON.stringify({ messages: [
                              { type: "save_edited" },
                            ]})]);
      });

      it("does not reject", async () => {
        await saver.save();
      });

      it("marks saver as failed", async () => {
        await saver.save();
        expect(saver).to.have.property("failed").true;
      });

      it("emits a fail event", async () => {
        const p = saver.events.pipe(first()).toPromise();
        await saver.save();
        expect(await p).to.have.property("name").equal("Failed");
        expect(await p).to.have.nested.property("error.type")
          .equal("save_edited");
      });
    });

    describe("when save_successful is missing", async () => {
      const message = `Unexpected response from the server while \
saving. Please contact technical support before trying to edit again.`;

      beforeEach(() => {
        server.respondWith("POST", "/moo",
                           [200, { "Content-Type": "application/json" },
                            JSON.stringify({ messages: [
                              { type: "version_too_old_error" },
                            ]})]);
      });

      it("rejects", async () => {
        await expectError(saver.save(), Error, message);
      });

      it("marks saver as failed", async () => {
        await expectError(saver.save(), Error, message);
        expect(saver).to.have.property("failed").true;
      });

      it("does not emit a fail event", async () => {
        const spy = sinon.spy((saver as any)._events, "next");
        await expectError(saver.save(), Error, message);
        expect(spy).to.have.not.been.called;
      });
    });

    describe("when getting version_too_old_error", async () => {
      beforeEach(() => {
        server.respondWith("POST", "/moo",
                           [200, { "Content-Type": "application/json" },
                            JSON.stringify({ messages: [
                              { type: "version_too_old_error" },
                              // We need this. Or we're going to get another
                              // error.
                              { type: "save_successful" },
                            ]})]);
      });

      it("does not reject", async () => {
        await saver.save();
      });

      it("marks saver as failed", async () => {
        await saver.save();
        expect(saver).to.have.property("failed").true;
      });

      it("emits a fail event", async () => {
        const p = saver.events.pipe(first()).toPromise();
        await saver.save();
        expect(await p).to.have.property("name").equal("Failed");
        expect(await p).to.have.nested.property("error.type")
          .equal("too_old");
      });
    });

    describe("when getting save_successful", async () => {
      beforeEach(() => {
        server.respondWith("POST", "/moo",
                           [200, { "Content-Type": "application/json" },
                            JSON.stringify({ messages: [
                              { type: "save_successful" },
                            ]})]);
      });

      it("does not reject", async () => {
        await saver.save();
      });

      it("does not mark saver as failed", async () => {
        await saver.save();
        expect(saver).to.have.property("failed").false;
      });

      it("emits a saved event", async () => {
        const p = saver.events.pipe(first()).toPromise();
        await saver.save();
        expect(await p).to.have.property("name").equal("Saved");
      });

      it("calls _saveSuccess with the current generation", async () => {
        const spy = sinon.spy(saver as any, "_saveSuccess");
        // We set it to an arbitrary value.
        (saver as any).currentGeneration = 999;
        await saver.save();
        expect(spy).to.have.been.calledWith(false, 999);
      });
    });
  });

  describe("#recover", () => {
    let saver: AjaxSaver;

    beforeEach(async () => {
      saver = new AjaxSaver(rt, { url: "/moo" });
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({messages: []})]);
      await saver.init("0.30.0", doc);
      server.requests = [];
    });

    it("is a no-op on an uninitialized saver", async () => {
      expect(await new AjaxSaver(rt, { url: "/blerh" }).recover())
        .to.be.undefined;
      expect(server).to.have.property("requests").have.lengthOf(0);
    });

    it("is a no-op on failed saver", async () => {
      server.respondWith("POST", "/moo",
                         [400, { "Content-Type": "text/plain" }, ""]);
      await saver.save();
      server.requests = [];
      expect(saver).to.have.property("failed").true;
      expect(await saver.recover()).to.be.undefined;
      expect(server).to.have.property("requests").have.lengthOf(0);
    });

    it("sends a recover command", async () => {
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({messages: [
                            { type: "save_successful" },
                          ]})]);
      await saver.recover();
      const body = server.requests[0].requestBody;
      const params = new URLSearchParams(body);
      expect(params.get("command")).to.equal("recover");
      expect(params.get("version")).to.equal("0.30.0");
      expect(params.get("data")).to.equal("<doc/>");
    });

    it("returns false on HTTP failures", async () => {
      server.respondWith("POST", "/moo",
                         [404, { "Content-Type": "text/plain" }, ""]);
      expect(await saver.recover()).to.be.false;
    });

    it("returns false when the response has no messages", async () => {
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({ messages: []})]);
      expect(await saver.recover()).to.be.false;
    });

    it("returns false on save_fatal_error", async () => {
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({ messages: [
                            { type: "save_fatal_error" },
                          ]})]);
      expect(await saver.recover()).to.be.false;
    });

    it("returns false if not save_successful", async () => {
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({ messages: [
                            { type: "version_too_old_error" },
                          ]})]);
      expect(await saver.recover()).to.be.false;
    });

    it("returns true on save_successful", async () => {
      server.respondWith("POST", "/moo",
                         [200, { "Content-Type": "application/json" },
                          JSON.stringify({ messages: [
                            { type: "save_successful" },
                          ]})]);
      expect(await saver.recover()).to.be.true;
    });
  });

});
