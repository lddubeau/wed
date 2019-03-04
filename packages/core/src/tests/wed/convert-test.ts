/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import * as browsers from "@wedxml/common/browsers";

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
    function makeTest(name: string, differsOnIE: boolean = false): void {
      const convertedName = name.replace(/ /g, "-");

      // If the test differs on IE and we are on IE, then add -ie to the
      // basename.
      const ie = differsOnIE && browsers.MSIE;
      describe("", () => {
        let source: string;
        let expected: string;
        before(async () => {
          [source, expected] = await Promise.all([
            provider.getText(`${convertedName}.xml`),
            provider.getText(`${convertedName + (ie ? "-ie" : "")}.html`),
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
    makeTest("should encode name prefixes", true);
    makeTest("should encode dashes in attribute names");
    makeTest("should encode namespace changes", true);
    // tslint:enable:mocha-no-side-effect-code
  });
});
