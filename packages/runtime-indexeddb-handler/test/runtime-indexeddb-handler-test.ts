import { expect } from "chai";
import Dexie from "dexie";
import { Container } from "inversify";
import "mocha";

import { expectError } from "@wedxml/common/test/util";
import { EDITOR_OPTIONS, RUNTIME } from "@wedxml/common/tokens";
import { DefaultRuntime,
         RUNTIME_URI_SCHEME_HANDLER } from "@wedxml/default-runtime";

// tslint:disable-next-line:no-implicit-dependencies
import { RuntimeIndexedDBHandler } from "runtime-indexeddb-handler";

// tslint:disable-next-line:mocha-no-side-effect-code
const safari = navigator.userAgent.includes("Safari/") &&
  !navigator.userAgent.includes("Chrome/");

// tslint:disable-next-line:mocha-no-side-effect-code
const itNoSafari = safari ? it.skip : it;

async function readFile(file: File): Promise<string> {
  const reader = new FileReader();

  return new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

//
// We use Blob instead of File because Edge does not support the File
// constructor.
//

class SomeRecord {
  id?: number;

  constructor(public name: string, public text: string, public file: Blob) {}
}

type SomeTable = Dexie.Table<SomeRecord, number>;

class OtherRecord {
  constructor(public id: string, public text: string) {}
}

type OtherTable = Dexie.Table<OtherRecord, string>;

export class Store extends Dexie {
  someTable!: SomeTable;
  otherTable!: OtherTable;

  constructor() {
    super("wed");
    this.version(1).stores({
      someTable: "++id",
      otherTable: "id",
    });

    this.someTable.mapToClass(SomeRecord);
    this.otherTable.mapToClass(OtherRecord);
  }
}

describe("RuntimeIndexedDBHandler", () => {
  let handler: RuntimeIndexedDBHandler;
  let file: Blob;
  let record: SomeRecord;
  let otherRecord: OtherRecord;

  before(async () => {
    handler = new RuntimeIndexedDBHandler();
    const db = new Store();
    file = new Blob(["q"], { type: "text" });
    record = new SomeRecord("foo", "foo content", file);
    const key = await db.someTable.put(record);
    record.id = key;

    otherRecord = new OtherRecord("foo", "foo text");
    await db.otherTable.put(otherRecord);
  });

  describe("#canHandle", () => {
    it("returns true for the indexeddb scheme", () => {
      // tslint:disable-next-line:chai-vague-errors
      expect(handler.canHandle("indexeddb")).to.be.true;
    });

    it("returns false for the indexeddb scheme URIs", () => {
      // tslint:disable-next-line:no-http-string chai-vague-errors
      expect(handler.canHandle("http")).to.be.false;
    });
  });

  describe("#resolve", () => {
    it("rejects on bad scheme",
       // tslint:disable-next-line:no-http-string
       async () => expectError(handler.resolve("http://example.com"),
                               Error,
                               /^unknown scheme: http$/));

    it("rejects on bad version",
       async () =>
       expectError(handler.resolve("indexeddb://v999/wed/someTable/number/1"),
                   Error,
                   /^unsupported version number: v999$/));

    it("rejects on bad db",
       async () =>
       expectError(handler.resolve("indexeddb://v1/xxx/someTable/number/1"),
                   Error,
                   /^Database xxx doesnt exist$/));

    it("rejects on bad table",
       async () =>
       expectError(handler.resolve("indexeddb://v1/wed/xxx/number/1"),
                   Error,
                   /^Table xxx does not exist$/));

    it("rejects on bad key type",
       async () =>
       expectError(handler.resolve("indexeddb://v1/wed/someTable/xxx/1"),
                   Error,
                   /^unknown key type: xxx$/));

    it("rejects on bad key",
       async () =>
       expectError(handler.resolve("indexeddb://v1/wed/someTable/number/999"),
                   Error,
                   new RegExp(`^cannot resolve key from: indexeddb://v1/wed/\
someTable/number/999$`)));

    it("rejects on non-existent field",
       async () =>
       expectError(handler.resolve("indexeddb://v1/wed/someTable/number/1/xxx"),
                   Error,
                   new RegExp(`^cannot resolve property in the record of: \
indexeddb://v1/wed/someTable/number/1/xxx$`)));

    // tslint:disable-next-line:mocha-no-side-effect-code
    itNoSafari("loads record from db with number key", async () => {
      expect(await handler.resolve("indexeddb://v1/wed/someTable/number/1"))
        .to.deep.equal(record);
    });

    // tslint:disable-next-line:mocha-no-side-effect-code
    itNoSafari("loads record from db with string key", async () => {
      expect(await handler.resolve("indexeddb://v1/wed/otherTable/string/foo"))
        .to.deep.equal(otherRecord);
    });

    // tslint:disable-next-line:mocha-no-side-effect-code
    itNoSafari("loads field from db", async () => {
      expect(await handler
             .resolve("indexeddb://v1/wed/someTable/number/1/text"))
        .to.equal(record.text);
    });

    // tslint:disable-next-line:mocha-no-side-effect-code
    itNoSafari("loads file from db", async () => {
      expect(await readFile(
        await handler.resolve("indexeddb://v1/wed/someTable/number/1/file")))
        .to.equal("q");
    });
  });
});

describe("RuntimeIndexedDBHandler integration with DefaultRuntime", () => {
  let runtime: DefaultRuntime;
  let handler: RuntimeIndexedDBHandler;
  let record: SomeRecord;

  before(async () => {
    handler = new RuntimeIndexedDBHandler();
    const db = new Store();
    const file = new Blob(["q"], { type: "text" });
    record = new SomeRecord("foo", "foo content", file);
    const key = await db.someTable.put(record);
    record.id = key;

    const container = new Container();
    container.bind(EDITOR_OPTIONS).toConstantValue({
      schema: "foo",
      mode: {
        path: "moo",
      },
    });
    container.bind(RUNTIME_URI_SCHEME_HANDLER).toConstantValue(handler);
    container.bind(RUNTIME).to(DefaultRuntime);

    runtime = container.get<DefaultRuntime>(RUNTIME);
  });

  // tslint:disable-next-line:mocha-no-side-effect-code
  itNoSafari("DefaultRuntime uses the handler", async () => {
    expect(await runtime
           .resolve("indexeddb://v1/wed/someTable/number/1/text"))
      .to.equal(record.text);
  });
});
