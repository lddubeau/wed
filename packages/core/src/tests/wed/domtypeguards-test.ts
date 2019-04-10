/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { isAttr, isComment, isDocument, isDocumentFragment, isElement, isNode,
         isPI, isText } from "wed/domtypeguards";

const expect = chai.expect;

describe("domtypeguards", () => {
  let text: Text;
  let element: Element;
  let attribute: Attr;
  let frag: DocumentFragment;
  let comment: Comment;
  let pi: ProcessingInstruction;

  let allNodes: Record<string, Node>;
  before(() => {
    text = document.createTextNode("foo");
    element = document.createElement("div");
    attribute = document.createAttribute("moo");
    frag = document.createDocumentFragment();
    comment = document.createComment("comment");
    pi = document.createProcessingInstruction("pi", "body");

    allNodes = {
      text,
      element,
      attribute,
      "document fragment": frag,
      comment,
      pi,
      document,
    };
  });

  describe("isNode", () => {
    it("returns true on node", () => {
      // tslint:disable-next-line:forin
      for (const name in allNodes) {
        expect(isNode(allNodes[name])).to.be.true;
      }
    });

    it("returns false on a non-node", () => {
      expect(isNode(1)).to.be.false;
    });

    it("returns false on null", () => {
      expect(isNode(null)).to.be.false;
    });

    it("returns false on undefined", () => {
      expect(isNode(undefined)).to.be.false;
    });
  });

  function makeGuardTest(fn: (nodes: Node | undefined | null) => boolean,
                         trueCase: string): void {
    describe(fn.name, () => {
      it(`returns true on ${trueCase}`, () => {
        expect(fn(allNodes[trueCase])).to.be.true;
      });

      it("returns false on a non-element", () => {
        for (const name in allNodes) {
          if (name === trueCase) {
            continue;
          }
          expect(fn(allNodes[name])).to.be.false;
        }
      });

      it("returns false on null", () => {
        expect(fn(null)).to.be.false;
      });

      it("returns false on undefined", () => {
        expect(fn(undefined)).to.be.false;
      });
    });
  }

  // tslint:disable-next-line:mocha-no-side-effect-code
  makeGuardTest(isElement, "element");
  // tslint:disable-next-line:mocha-no-side-effect-code
  makeGuardTest(isText, "text");
  // tslint:disable-next-line:mocha-no-side-effect-code
  makeGuardTest(isAttr, "attribute");
  // tslint:disable-next-line:mocha-no-side-effect-code
  makeGuardTest(isDocumentFragment, "document fragment");
  // tslint:disable-next-line:mocha-no-side-effect-code
  makeGuardTest(isDocument, "document");
  // tslint:disable-next-line:mocha-no-side-effect-code
  makeGuardTest(isComment, "comment");
  // tslint:disable-next-line:mocha-no-side-effect-code
  makeGuardTest(isPI, "pi");
});
