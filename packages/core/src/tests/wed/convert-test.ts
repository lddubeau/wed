/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import * as convert from "wed/convert";

import { DataProvider } from "../util";
import { dataPath } from "../wed-test-util";

const expect = chai.expect;

describe("convert", () => {
  let parser: DOMParser;
  let provider: DataProvider;

  before(() => {
    parser = new DOMParser();
    provider = new DataProvider(`${dataPath}/convert_test_data/`);
  });

  describe("sanitizeXML", () => {
    it("normalizes text nodes", () => {
      const doc = parser.parseFromString("<a>text</a>", "text/xml");
      const top = doc.documentElement;
      const text = doc.createTextNode("foo");
      top.appendChild(text);
      expect(top).to.have.property("childNodes").lengthOf(2);
      convert.sanitizeXML(top);
      expect(top).to.have.property("childNodes").lengthOf(1);
      expect(top).to.have.property("textContent").equal("textfoo");
    });

    it("converts CData to text and normalizes it", () => {
      const doc = parser.parseFromString("<a><b>text<![CDATA[<>]]>more</b></a>",
                                         "text/xml");
      const top = doc.documentElement;
      const b = doc.getElementsByTagName("b")[0];
      expect(b).to.have.property("childNodes").lengthOf(3);
      convert.sanitizeXML(top);
      expect(b).to.have.property("childNodes").lengthOf(1);
      expect(b).to.have.property("textContent").equal("text<>more");
    });
  });

  describe("toHTMLTree", () => {
    function makeTest(name: string): void {
      const convertedName = name.replace(/ /g, "-");
      describe("", () => {
        let source: string;
        let expected: string;
        before(async () => {
          [source, expected] = await Promise.all([
            provider.getText(`${convertedName}.xml`),
            provider.getText(`${convertedName}.html`),
          ]);
        });

        it(name, () => {
          const root = parser.parseFromString(source, "application/xml")
            .documentElement;
          const html = convert.toHTMLTree(window.document, root) as HTMLElement;
          // The reason this does not produce a diff seems to be that Mocha's
          // HTML reporter does not support diffs.
          expect(`${html.outerHTML}\n`).to.equal(expected);
        });
      });
    }

    // tslint:disable:mocha-no-side-effect-code
    makeTest("should convert xml to html");
    makeTest("should encode name prefixes");
    makeTest("should encode dashes in attribute names");
    makeTest("should encode namespace changes");
    // tslint:enable:mocha-no-side-effect-code
  });

  describe("encodeDiff", () => {
    it("produces an empty diff for as-is cases", () => {
      expect(convert.encodeDiff("abc", "abc")).to.equal("");
    });

    it("produces a diff for cases that are not as-is", () => {
      expect(convert.encodeDiff("Abc", "abc")).to.equal("u1");
      expect(convert.encodeDiff("abC", "abc")).to.equal("g2u1");
      expect(convert.encodeDiff("abCdexFGh", "abcdexfgh"))
        .to.equal("g2u1g3u2");

      // The treatment of "C" cannot be handled with the u operation because the
      // diff removes "abc" and then adds "C", and "abc" in uppercase is not
      // "C". The algorithm *could* be modified to handle this, but this is an a
      // case that won't actually happen with "real" data, and the few rare
      // cases that happens in languages other than English are not worth the
      // development expense.
      expect(convert.encodeDiff("CdexFGh", "abcdexfgh"))
        .to.equal("m3px43g3u2");
    });
  });

  describe("decodeDiff", () =>  {
    it("returns name unchanged for empty diff", () => {
      expect(convert.decodeDiff("abc", "")).to.equal("abc");
    });

    it("decodes diffs properly", () => {
      expect(convert.decodeDiff("abc", "u1")).to.equal("Abc");
      expect(convert.decodeDiff("abc", "g2u1")).to.equal("abC");
      expect(convert.decodeDiff("abCdexFGh", "g2u1g3u2")).to.equal("abCdexFGh");
    });

    it("throws on bad input", () => {
      expect(() => convert.decodeDiff("abc", "q1")).to.throw(Error);
      expect(() => convert.decodeDiff("abc", "g2uz")).to.throw(Error);
    });
  });

  describe("decodeAttrName", () => {
    it("without namespace prefix", () => {
      expect(convert.decodeAttrName("data-wed-blah-"))
        .to.deep.equal({ name: "blah", qualifier: undefined });
    });

    it("with a namespace prefix", () => {
      expect(convert.decodeAttrName("data-wed-btw---blah-"))
        .to.deep.equal({ name: "btw:blah", qualifier: undefined });
    });

    it("with dashes in the name", () => {
      expect(convert.decodeAttrName(
        "data-wed-btw---blah-one--two----three-----four-"))
        .to.deep.equal({ name: "btw:blah-one--two---three----four",
                         qualifier: undefined });
    });

    it("with qualifier", () => {
      expect(convert.decodeAttrName("data-wed--ns-blah-"))
        .to.deep.equal({ name: "blah", qualifier: "ns" });
    });

    it("with a name that cannot be represented as-is", () => {
      expect(convert.decodeAttrName("data-wed-moo---abc----def-u3g2u1"))
        .to.deep.equal({ name: "MOO:aBc---def", qualifier: undefined });
    });

    it("throws on bad input", () => {
      expect(() => convert.decodeAttrName("data-moo--ns-blah-"))
        .to.throw(Error);
      expect(() => convert.decodeAttrName("data-wed--ns-blah")).to.throw(Error);
      expect(() => convert.decodeAttrName("data-wed--ns-blah-x1"))
        .to.throw(Error);
    });
  });

  describe("encodeAttrName", () => {
    it("without namespace prefix", () => {
      expect(convert.encodeAttrName("blah")).to.equal("data-wed-blah-");
    });

    it("with a namespace prefix", () => {
      expect(convert.encodeAttrName("btw:blah"))
        .to.equal("data-wed-btw---blah-");
    });

    it("with dashes in the name", () => {
      expect(convert.encodeAttrName("btw:blah-one--two---three----four"))
        .to.equal("data-wed-btw---blah-one--two----three-----four-");
    });

    it("with a name that cannot be represented as-is", () => {
      expect(convert.encodeAttrName("MOO:aBc---def"))
        .to.equal("data-wed-moo---abc----def-u3g2u1");
    });

    it("with qualifier", () => {
      expect(convert.encodeAttrName("blah", "ns"))
        .to.equal("data-wed--ns-blah-");
    });
  });

  describe("stringToCodeSequence", () => {
    it("converts a string", () => {
      expect(convert.stringToCodeSequence("abc")).to.equal("x61x62x63");
    });
  });

  describe("codeSequenceToString", () => {
    it("converts back a sequence", () => {
      expect(convert.codeSequenceToString("x61x62x63")).to.equal("abc");
    });

    it("throws an error on incorrect strings", () => {
      expect(() => convert.codeSequenceToString("x")).to.throw(Error);
      expect(() => convert.codeSequenceToString("x61x")).to.throw(Error);
      expect(() => convert.codeSequenceToString("x61q")).to.throw(Error);
      // We allow only lowercase hex.
      expect(() => convert.codeSequenceToString("x6F")).to.throw(Error);
    });
  });
});
