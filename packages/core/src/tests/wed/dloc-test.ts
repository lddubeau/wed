/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";

import { DLoc, DLocRange, DLocRoot, findRoot, getRoot } from "wed/dloc";
import { isAttr } from "wed/domutil";

import { DataProvider } from "../util";
import { dataPath } from "../wed-test-util";

const expect = chai.expect;

// tslint:disable:no-any

function defined<T>(x: T | null | undefined): T {
  expect(x).to.not.be.undefined;
  // The assertion above already excludes null and undefined, but TypeScript
  // does not know this.
  return x as T;
}

describe("dloc", () => {
  let xmlDoc: Document;
  let root: Element;
  let rootObj: DLocRoot;
  let firstP: Element;
  let firstTitle: Element;
  let firstQuote: Element;
  let quoteAtType: Attr;
  let bodyPs: Element[];
  let firstBodyP: Element;
  let secondBodyP: Element;
  let firstComment: Comment;
  let firstPI: ProcessingInstruction;
  let firstCData: CDATASection;

  before(async () => {
    const provider = new DataProvider(`${dataPath}/dloc_test_data/`);
    const sourceXML =
      await provider.getText("source_with_comments_etc_converted.xml");

    const parser = new DOMParser();
    xmlDoc = parser.parseFromString(sourceXML, "text/xml");
    root = xmlDoc.documentElement;
    rootObj = new DLocRoot(root);

    firstP = defined(root.getElementsByTagName("p")[0]);
    firstTitle = defined(root.getElementsByTagName("title")[0]);
    firstQuote = defined(root.getElementsByTagName("quote")[0]);
    // Equivalent to XPath: //quote/@type
    quoteAtType = defined(firstQuote.getAttributeNode("type"));
    expect(isAttr(quoteAtType)).to.be.true;
    bodyPs = Array.prototype.slice.call(root.querySelectorAll("body>p"));
    firstBodyP = defined(bodyPs[0]);
    secondBodyP = defined(bodyPs[1]);
    firstComment =
      defined(root.getElementsByTagName("body")[0].firstChild) as Comment;
    expect(firstComment).to.have.property("nodeType").equal(Node.COMMENT_NODE);
    firstPI = (defined(root.getElementsByTagName("body")[0].childNodes[2]) as
               ProcessingInstruction);
    expect(firstPI).to.have.property("nodeType").
      equal(Node.PROCESSING_INSTRUCTION_NODE);
    firstCData = secondBodyP.childNodes[1] as CDATASection;
    expect(firstCData).to.have.property("nodeType").
      equal(Node.CDATA_SECTION_NODE);
  });

  afterEach(() => {
    for (const el of
         Array.prototype.slice.call(root.getElementsByTagName("nonexistent"))) {
      el.parentNode.removeChild(el);
    }
  });

  function addTestElement(): Element {
    const t = xmlDoc.createElement("nonexistent");
    root.appendChild(t);
    return t;
  }

  function makeAttributeNodeCase(): { attrLoc: DLoc; loc: DLoc } {
    const attrLoc = DLoc.mustMakeDLoc(root, quoteAtType, 0);
    const loc = attrLoc.make(firstBodyP, 1);
    return { attrLoc, loc };
  }

  function makeInvalidCase(): { loc: DLoc; invalid: DLoc } {
    const t = addTestElement();
    const loc = DLoc.mustMakeDLoc(root, secondBodyP, 1);
    const invalid = loc.make(t, 0);
    root.removeChild(t);
    expect(invalid.isValid()).to.be.false;
    return { loc, invalid };
  }

  describe("DLocRoot", () => {
    it("marks the root", () => {
      expect(findRoot(root)).to.equal(rootObj);
    });

    it("fails if the node is already marked", () => {
      expect(() => new DLocRoot(root)).to
        .throw(Error, "node already marked as root");
    });

    describe("nodeToPath", () => {
      it("returns an empty string on root", () => {
        expect(rootObj.nodeToPath(root)).to.equal("");
      });

      it("returns a correct path on text node", () => {
        const node = defined(firstTitle.childNodes[0]);
        expect(rootObj.nodeToPath(node)).to.equal("0/0/0/0/0");
      });

      it("returns a correct path on later text node", () => {
        const node = defined(secondBodyP.childNodes[2]);
        expect(rootObj.nodeToPath(node)).to.equal("1/0/3/2");
      });

      it("returns a correct path on attribute", () => {
        expect(rootObj.nodeToPath(quoteAtType)).to.equal("1/0/3/3/@type");
      });

      it("returns a correct path on comment", () => {
        expect(rootObj.nodeToPath(firstComment)).to.equal("1/0/0");
      });

      it("returns a correct path on processing instruction", () => {
        expect(rootObj.nodeToPath(firstPI)).to.equal("1/0/2");
      });

      it("returns a correct path on CDATA", () => {
        expect(rootObj.nodeToPath(firstCData)).to.equal("1/0/3/1");
      });

      it("fails on a node which is not a descendant of its root", () => {
        expect(() => rootObj.nodeToPath(document.body)).to
          .throw(Error, "node is not a descendant of root");
      });

      it("fails on invalid node", () => {
        expect(() => rootObj.nodeToPath(null as any)).to
          .throw(Error, "invalid node parameter");

        expect(() => rootObj.nodeToPath(undefined as any)).to
          .throw(Error, "invalid node parameter");
      });
    });

    describe("pathToNode", () => {
      it("returns root when passed an empty string", () => {
        expect(rootObj.pathToNode("")).to.equal(root);
      });

      it("returns a correct node on a text path", () => {
        const node = defined(firstTitle.childNodes[0]);
        expect(rootObj.pathToNode("0/0/0/0/0")).to.equal(node);
      });

      it("returns a correct node on a later text path", () => {
        const node = defined(secondBodyP.childNodes[2]);
        expect(rootObj.pathToNode("1/0/3/2")).to.equal(node);
      });

      it("returns a correct node on attribute path", () => {
        expect(rootObj.pathToNode("1/0/3/3/@type")).to.equal(quoteAtType);
      });

      it("returns a correct node on comment path", () => {
        expect(rootObj.pathToNode("1/0/0")).to.equal(firstComment);
      });

      it("returns a correct node on processing instruction path", () => {
        expect(rootObj.pathToNode("1/0/2")).to.equal(firstPI);
      });

      it("returns a correct node on CDATA path", () => {
        expect(rootObj.pathToNode("1/0/3/1")).to.equal(firstCData);
      });

      it("accepts more than one digit per path step", () => {
        // There was a stupid bug in an earlier version which would make this
        // fail with an exception complaining that the path was malformed due to
        // the presence of "10". The null return value is fine since there is no
        // such element, but at least it should not generate an exception.
        expect(rootObj.pathToNode("0/10")).to.be.null;
      });

      it("fails on malformed path", () => {
        expect(() => rootObj.pathToNode("+")).to
          .throw(Error, "malformed path expression");
      });
    });
  });

  describe("findRoot", () => {
    it("finds the root", () => {
      expect(findRoot(firstP)).to.equal(rootObj);
    });

    it("returns undefined if not in a root", () => {
      expect(findRoot(defined(root.parentNode))).to.be.undefined;
    });
  });

  describe("getRoot", () => {
    it("gets the root", () => {
      expect(getRoot(firstP)).to.equal(rootObj);
    });

    it("throws an exception if not in a root", () => {
      expect(() => getRoot(defined(root.parentNode))).to
        .throw(Error, "no root found");
    });
  });

  describe("makeDLoc", () => {
    it("returns undefined when called with undefined location", () => {
      expect(DLoc.makeDLoc(root, undefined)).to.be.undefined;
    });

    it("returns a valid DLoc", () => {
      const loc = DLoc.makeDLoc(root, firstP, 0)!;
      expect(loc).to.have.property("node").equal(firstP);
      expect(loc).to.have.property("offset").equal(0);
      expect(loc).to.have.property("root").equal(root);
      expect(loc.isValid()).to.be.true;
    });

    it("returns a valid DLoc when the root is a DLocRoot", () => {
      const loc = DLoc.makeDLoc(rootObj, firstP, 0)!;
      expect(loc).to.have.property("node").equal(firstP);
      expect(loc).to.have.property("offset").equal(0);
      expect(loc).to.have.property("root").equal(root);
      expect(loc.isValid()).to.be.true;
    });

    it("returns a valid DLoc on an attribute node", () => {
      const loc = DLoc.makeDLoc(root, quoteAtType, 0)!;
      expect(loc).to.have.property("node").equal(quoteAtType);
      expect(loc).to.have.property("offset").equal(0);
      expect(loc).to.have.property("root").equal(root);
      expect(loc.isValid()).to.be.true;
    });

    it("returns a valid DLoc when the offset is omitted", () => {
      const loc = DLoc.makeDLoc(root, secondBodyP)!;
      expect(loc).to.have.property("node").equal(secondBodyP.parentNode);
      expect(loc).to.have.property("offset").equal(3);
      expect(loc).to.have.property("root").equal(root);
      expect(loc.isValid()).to.be.true;
    });

    it("throws when called with an array", () => {
      // We used to allow passing a node, offset tuple. We don't anymore.
      // This tests that makeDLoc crashes if passed an array.
      expect(() => DLoc.makeDLoc(root, [firstP, 0] as any)).to
        .throw(Error);
    });

    it("throws an error when the node is not in the root", () => {
      expect(() => DLoc.makeDLoc(root, defined(root.parentNode), 0)).to
        .throw(Error, "node not in root");
    });

    it("throws an error when the root is not marked", () => {
      const c = defined(root.parentNode);
      expect(() => DLoc.makeDLoc(c as Document, c, 0)).to
        .throw(Error, /^root has not been marked as a root/);
    });

    it("throws an error when the offset is negative", () => {
      expect(() => DLoc.makeDLoc(root, defined(root.parentNode), -1)).to
        .throw(Error, /^negative offsets are not allowed/);
    });

    it("throws an error when the offset is too large (element)", () => {
      expect(() => DLoc.makeDLoc(root, firstP, 100)).to
        .throw(Error, /^offset greater than allowable value/);
    });

    it("throws an error when the offset is too large (text)", () => {
      const c = defined(firstBodyP.firstChild);
      expect(c).to.have.property("nodeType").equal(Node.TEXT_NODE);
      expect(() => DLoc.makeDLoc(root, c, 100)).to
        .throw(Error, /^offset greater than allowable value/);
    });

    it("throws an error when the offset is too large (attribute)", () => {
      expect(() => DLoc.makeDLoc(root, quoteAtType, 100)).to
        .throw(Error, /^offset greater than allowable value/);
    });

    it("throws an error when the offset is too large (comment)", () => {
      expect(() => DLoc.makeDLoc(root, firstComment, 100)).to
        .throw(Error, /^offset greater than allowable value/);
    });

    it("throws an error when the offset is too large (CData)", () => {
      expect(() => DLoc.makeDLoc(root, firstCData, 100)).to
        .throw(Error, /^offset greater than allowable value/);
    });

    it("throws an error when the offset is too large (PI)", () => {
      expect(() => DLoc.makeDLoc(root, firstPI, 100)).to
        .throw(Error, /^offset greater than allowable value/);
    });

    it("normalizes a negative offset", () => {
      expect(DLoc.makeDLoc(root, firstP, -1, true)).to.have.property("offset")
        .equal(0);
    });

    it("normalizes an offset that is too large (element)", () => {
      expect(DLoc.makeDLoc(root, firstP, 100, true)).to.have.property("offset")
        .equal(0);
    });

    it("normalizes an offset that is too large (text)", () => {
      const c = defined(firstBodyP.firstChild) as Text;
      expect(c).to.have.property("nodeType").equal(Node.TEXT_NODE);
      expect(DLoc.makeDLoc(root, c, 100, true)).to.have.property("offset")
        .equal(c.data.length);
    });

    it("normalizes an offset that is too large (attribute)", () => {
      expect(DLoc.makeDLoc(root, quoteAtType, 100, true)).to.have
        .property("offset").equal(quoteAtType.value.length);
    });

    it("normalizes an offset that is too large (comment)", () => {
      expect(DLoc.makeDLoc(root, firstComment, 100, true)).to.have
        .property("offset").equal(9);
    });

    it("normalizes an offset that is too large (CData)", () => {
      expect(DLoc.makeDLoc(root, firstCData, 100, true)).to.have
        .property("offset").equal(3);
    });

    it("normalizes an offset that is too large (PI)", () => {
      expect(DLoc.makeDLoc(root, firstPI, 100, true)).to.have
        .property("offset").equal(4);
    });
  });

  describe("mustMakeDLoc", () => {
    it("throws when called with undefined location", () => {
      expect(() => DLoc.mustMakeDLoc(root, undefined)).to
        .throw(Error, /^called mustMakeDLoc with an absent node$/);
    });

    it("returns a valid DLoc", () => {
      const loc = DLoc.mustMakeDLoc(root, firstP, 0);
      expect(loc).to.have.property("node").equal(firstP);
      expect(loc).to.have.property("offset").equal(0);
      expect(loc).to.have.property("root").equal(root);
      expect(loc.isValid()).to.be.true;
    });

    it("throws when called with an array", () => {
      // We used to allow passing a node, offset tuple. We don't anymore.
      // This tests that mustMakeDLoc crashes if passed an array.
      expect(() => DLoc.mustMakeDLoc(root, [firstP, 0] as any)).to
        .throw(Error);
    });
  });

  describe("DLoc", () => {
    describe("clone", () => {
      it("clones", () => {
        const loc = DLoc.mustMakeDLoc(root, firstBodyP, 1);
        expect(loc).to.deep.equal(loc.clone());
      });
    });

    describe("make", () => {
      it("makes a new location with the same root", () => {
        const loc = DLoc.mustMakeDLoc(root, firstBodyP, 1);
        const loc2 = loc.make(secondBodyP, 0);
        expect(loc).to.have.property("root").equal(loc2.root);
        expect(loc2).to.have.property("node").equal(secondBodyP);
        expect(loc2).to.have.property("offset").equal(0);
      });
    });

    describe("makeRange", () => {
      it("makes a range", () => {
        const loc = DLoc.mustMakeDLoc(root, firstBodyP, 0);
        const loc2 = loc.make(secondBodyP, 1);
        const range = loc.makeRange(loc2);
        expect(range).to.have.nested.property("range.startContainer")
          .equal(firstBodyP);
        expect(range).to.have.nested.property("range.startOffset").equal(0);
        expect(range).to.have.nested.property("range.endContainer")
          .equal(secondBodyP);
        expect(range).to.have.nested.property("range.endOffset").equal(1);
        expect(range).to.have.nested.property("range.collapsed").false;
        expect(range).to.have.property("reversed").false;
      });

      it("makes a collapsed range", () => {
        const loc = DLoc.mustMakeDLoc(root, firstBodyP, 0);
        const range = loc.makeRange();
        expect(range).to.have.property("startContainer").equal(firstBodyP);
        expect(range).to.have.property("startOffset").equal(0);
        expect(range).to.have.property("endContainer").equal(firstBodyP);
        expect(range).to.have.property("endOffset").equal(0);
        expect(range).to.have.property("collapsed").true;
      });

      it("makes a reversed range", () => {
        const loc = DLoc.mustMakeDLoc(root, secondBodyP, 1);
        const loc2 = loc.make(firstBodyP, 0);
        const range = loc.makeRange(loc2);
        expect(range).to.have.nested.property("range.startContainer")
          .equal(firstBodyP);
        expect(range).to.have.nested.property("range.startOffset").equal(0);
        expect(range).to.have.nested.property("range.endContainer")
          .equal(secondBodyP);
        expect(range).to.have.nested.property("range.endOffset").equal(1);
        expect(range).to.have.nested.property("range.collapsed").false;
        expect(range).to.have.property("reversed").true;
      });

      it("makes a range in a comment", () => {
        const loc = DLoc.mustMakeDLoc(root, firstComment, 1);
        const loc2 = loc.make(secondBodyP, 2);
        const range = loc.makeRange(loc2);
        expect(range).to.have.nested.property("range.startContainer")
          .equal(firstComment);
        expect(range).to.have.nested.property("range.startOffset").equal(1);
        expect(range).to.have.nested.property("range.endContainer")
          .equal(secondBodyP);
        expect(range).to.have.nested.property("range.endOffset").equal(2);
        expect(range).to.have.nested.property("range.collapsed").false;
        expect(range).to.have.property("reversed").false;
      });

      it("makes a range in CData", () => {
        const loc = DLoc.mustMakeDLoc(root, firstCData, 0);
        const loc2 = loc.make(firstCData, 2);
        const range = loc.makeRange(loc2);
        expect(range).to.have.nested.property("range.startContainer")
          .equal(firstCData);
        expect(range).to.have.nested.property("range.startOffset").equal(0);
        expect(range).to.have.nested.property("range.endContainer")
          .equal(firstCData);
        expect(range).to.have.nested.property("range.endOffset").equal(2);
        expect(range).to.have.nested.property("range.collapsed").false;
        expect(range).to.have.property("reversed").false;
      });

      it("makes a range in processing instruction", () => {
        const loc = DLoc.mustMakeDLoc(root, firstPI, 1);
        const loc2 = loc.make(secondBodyP, 2);
        const range = loc.makeRange(loc2);
        expect(range).to.have.nested.property("range.startContainer")
          .equal(firstPI);
        expect(range).to.have.nested.property("range.startOffset").equal(1);
        expect(range).to.have.nested.property("range.endContainer")
          .equal(secondBodyP);
        expect(range).to.have.nested.property("range.endOffset").equal(2);
        expect(range).to.have.nested.property("range.collapsed").false;
        expect(range).to.have.property("reversed").false;
      });

      it("fails on an attribute node", () => {
        const { attrLoc, loc } = makeAttributeNodeCase();
        expect(() => attrLoc.makeRange(loc)).to
          .throw(Error, "cannot make range from attribute node");
      });

      it("fails on an attribute node passed as other", () => {
        const { attrLoc, loc } = makeAttributeNodeCase();
        expect(() => loc.makeRange(attrLoc)).to
          .throw(Error, "cannot make range from attribute node");
      });

      it("returns undefined on invalid location", () => {
        expect(makeInvalidCase().invalid.makeRange()).to.be.undefined;
      });

      it("returns undefined on invalid other", () => {
        const { loc, invalid } = makeInvalidCase();
        expect(loc.makeRange(invalid)).to.be.undefined;
      });
    });

    describe("makeDLocRange", () => {
      it("makes a range", () => {
        const loc = DLoc.mustMakeDLoc(root, firstBodyP, 0);
        const loc2 = loc.make(secondBodyP, 1);
        const range = loc.makeDLocRange(loc2);
        expect(range).to.have.property("start").equal(loc);
        expect(range).to.have.property("end").equal(loc2);
      });

      it("makes a collapsed range", () => {
        const loc = DLoc.mustMakeDLoc(root, firstBodyP, 0);
        const range = loc.makeDLocRange();
        expect(range).to.have.property("start").equal(loc);
        expect(range).to.have.property("end").equal(loc);
        expect(range).to.have.property("collapsed").true;
      });

      it("returns undefined on invalid location", () => {
        expect(makeInvalidCase().invalid.makeDLocRange()).to.be.undefined;
      });

      it("returns undefined on invalid other", () => {
        const { loc, invalid } = makeInvalidCase();
        expect(loc.makeDLocRange(invalid)).to.be.undefined;
      });
    });

    describe("mustMakeDLocRange", () => {
      it("throws on invalid location", () => {
        expect(() => makeInvalidCase().invalid.mustMakeDLocRange()).to
          .throw(Error, "cannot make a range");
      });

      it("throws on invalid other", () => {
        const { loc, invalid } = makeInvalidCase();
        expect(() => loc.mustMakeDLocRange(invalid)).to
          .throw(Error, "cannot make a range");
      });
    });

    describe("toArray", () => {
      it("returns an array with the right values", () => {
        expect(DLoc.mustMakeDLoc(root, firstBodyP, 1).toArray())
          .to.deep.equal([firstBodyP, 1]);
      });
    });

    describe("#isValid()", () => {
      describe("returns true when the location is valid", () => {
        it("in element", () => {
          expect(DLoc.makeDLoc(root, firstP, 0)!.isValid()).to.be.true;
        });

        it("in text", () => {
          const t = defined(firstBodyP.firstChild);
          expect(t).to.have.property("nodeType").equal(Node.TEXT_NODE);
          expect(DLoc.makeDLoc(root, t, 0)!.isValid()).to.be.true;
        });

        it("in attribute", () => {
          expect(DLoc.makeDLoc(root, quoteAtType, 0)!.isValid()).to.be.true;
        });

        it("in comment", () => {
          expect(DLoc.makeDLoc(root, firstComment, 0)!.isValid()).to.be.true;
        });

        it("in CData", () => {
          expect(DLoc.makeDLoc(root, firstCData, 0)!.isValid()).to.be.true;
        });

        it("in PI", () => {
          expect(DLoc.makeDLoc(root, firstPI, 0)!.isValid()).to.be.true;
        });
      });

      describe("returns false", () => {
        describe("when node is no longer in document", () => {
          it("on element", () => {
            expect(makeInvalidCase().invalid.isValid()).to.be.false;
          });

          it("on text", () => {
            const t = addTestElement();
            t.textContent = "foo";
            expect(t.firstChild).to.have.property("nodeType")
              .equal(Node.TEXT_NODE);
            const loc = DLoc.mustMakeDLoc(root, t.firstChild, 0);
            root.removeChild(t);
            expect(loc.isValid()).to.be.false;
          });

          it("on attribute", () => {
            const t = addTestElement();
            t.setAttribute("foo", "bar");
            const attr = t.getAttributeNode("foo");
            const loc = DLoc.mustMakeDLoc(root, attr, 0);
            t.removeAttribute("foo");
            expect(loc.isValid()).to.be.false;
          });

          it("on comment", () => {
            const t = addTestElement();
            const comment = xmlDoc.createComment("Q");
            t.appendChild(comment);
            const loc = DLoc.mustMakeDLoc(root, comment, 0);
            root.removeChild(t);
            expect(loc.isValid()).to.be.false;
          });

          it("on CData", () => {
            const t = addTestElement();
            const cdata = xmlDoc.createCDATASection("Q");
            t.appendChild(cdata);
            const loc = DLoc.mustMakeDLoc(root, cdata, 0);
            root.removeChild(t);
            expect(loc.isValid()).to.be.false;
          });

          it("on PI", () => {
            const t = addTestElement();
            const pi = xmlDoc.createProcessingInstruction("Q", "T");
            t.appendChild(pi);
            const loc = DLoc.mustMakeDLoc(root, pi, 0);
            root.removeChild(t);
            expect(loc.isValid()).to.be.false;
          });
        });

        describe("when the offset is no longer valid", () => {
          it("in element", () => {
            const t = addTestElement();
            t.textContent = "test";
            const loc = DLoc.mustMakeDLoc(root, t, 1);
            t.removeChild(t.firstChild!);
            expect(loc.isValid()).to.be.false;
          });

          it("in text", () => {
            const t = addTestElement();
            t.textContent = "test";
            const loc = DLoc.mustMakeDLoc(root, t.firstChild, 4);
            t.textContent = "t";
            expect(loc.isValid()).to.be.false;
          });

          it("in attribute", () => {
            const t = addTestElement();
            t.setAttribute("foo", "bar");
            const attr = defined(t.getAttributeNode("foo"));
            const loc = DLoc.mustMakeDLoc(root, attr, 3);
            attr.value = "f";
            expect(loc.isValid()).to.be.false;
          });

          it("in comment", () => {
            const t = addTestElement();
            const comment = xmlDoc.createComment("abcd");
            t.appendChild(comment);
            const loc = DLoc.mustMakeDLoc(root, comment, 4);
            comment.data = "t";
            expect(loc.isValid()).to.be.false;
          });

          it("in CData", () => {
            const t = addTestElement();
            const cdata = xmlDoc.createCDATASection("abcd");
            t.appendChild(cdata);
            const loc = DLoc.mustMakeDLoc(root, cdata, 4);
            cdata.data = "t";
            expect(loc.isValid()).to.be.false;
          });

          it("in PI", () => {
            const t = addTestElement();
            const pi = xmlDoc.createProcessingInstruction("a", "abcd");
            t.appendChild(pi);
            const loc = DLoc.mustMakeDLoc(root, pi, 4);
            pi.data = "t";
            expect(loc.isValid()).to.be.false;
          });
        });
      });
    });

    describe("#normalizeOffset() make a new valid location", () => {
      it("on element", () => {
        const t = addTestElement();
        t.textContent = "test";
        const loc = DLoc.mustMakeDLoc(root, t, 1);
        t.removeChild(t.firstChild!);
        expect(loc.isValid()).to.be.false;
        const norm = loc.normalizeOffset();
        expect(norm.isValid()).to.be.true;
        expect(loc).to.not.equal(norm);
        expect(norm.normalizeOffset()).to.equal(norm);
      });

      it("on text", () => {
        const t = addTestElement();
        t.textContent = "test";
        const text = t.firstChild!;
        expect(text).to.have.property("nodeType").equal(Node.TEXT_NODE);
        const loc = DLoc.mustMakeDLoc(root, text, 4);
        text.textContent = "t";
        expect(loc.isValid()).to.be.false;
        const norm = loc.normalizeOffset();
        expect(norm.isValid()).to.be.true;
        expect(loc).to.not.equal(norm);
        expect(norm.normalizeOffset()).to.equal(norm);
      });

      it("on attribute", () => {
        const t = addTestElement();
        t.setAttribute("foo", "bar");
        const attr = t.getAttributeNode("foo")!;
        expect(isAttr(attr)).to.be.true;
        const loc = DLoc.mustMakeDLoc(root, attr, 3);
        attr.value = "f";
        expect(loc.isValid()).to.be.false;
        const norm = loc.normalizeOffset();
        expect(norm.isValid()).to.be.true;
        expect(loc).to.not.equal(norm);
        expect(norm.normalizeOffset()).to.equal(norm);
      });

      it("on comment", () => {
        const t = addTestElement();
        const comment = xmlDoc.createComment("abcd");
        t.appendChild(comment);
        const loc = DLoc.mustMakeDLoc(root, comment, 4);
        comment.data = "t";
        const norm = loc.normalizeOffset();
        expect(norm.isValid()).to.be.true;
        expect(loc).to.not.equal(norm);
        expect(norm.normalizeOffset()).to.equal(norm);
      });

      it("on CData", () => {
        const t = addTestElement();
        const cdata = xmlDoc.createCDATASection("abcd");
        t.appendChild(cdata);
        const loc = DLoc.mustMakeDLoc(root, cdata, 4);
        cdata.data = "t";
        const norm = loc.normalizeOffset();
        expect(norm.isValid()).to.be.true;
        expect(loc).to.not.equal(norm);
        expect(norm.normalizeOffset()).to.equal(norm);
      });

      it("on PI", () => {
        const t = addTestElement();
        const pi = xmlDoc.createProcessingInstruction("a", "abcd");
        t.appendChild(pi);
        const loc = DLoc.mustMakeDLoc(root, pi, 4);
        pi.data = "t";
        const norm = loc.normalizeOffset();
        expect(norm.isValid()).to.be.true;
        expect(loc).to.not.equal(norm);
        expect(norm.normalizeOffset()).to.equal(norm);
      });
    });

    describe("equals", () => {
      let loc: DLoc;
      before(() => {
        loc = DLoc.mustMakeDLoc(root, firstBodyP, 0);
      });

      it("returns true if it is the same object", () => {
        expect(loc.equals(loc)).to.be.true;
      });

      it("returns true if the two locations are equal", () => {
        const loc2 = DLoc.makeDLoc(root, firstBodyP, 0);
        expect(loc.equals(loc2)).to.be.true;
      });

      it("returns false if other is null", () => {
        expect(loc.equals(null)).to.be.false;
      });

      it("returns false if other is undefined", () => {
        expect(loc.equals(undefined)).to.be.false;
      });

      it("returns false if the two nodes are unequal", () => {
        expect(loc.equals(loc.make(firstBodyP.parentNode!, 0))).to.be.false;
      });

      it("returns false if the two offsets are unequal", () => {
        expect(loc.equals(loc.make(firstBodyP, 1))).to.be.false;
      });
    });

    describe("compare", () => {
      let loc: DLoc;
      before(() => {
        loc = DLoc.mustMakeDLoc(root, firstBodyP, 0);
      });

      it("returns 0 if it is the same object", () => {
        expect(loc.compare(loc)).to.equal(0);
      });

      it("returns 0 if the two locations are equal", () => {
        const loc2 = DLoc.mustMakeDLoc(root, firstBodyP, 0);
        expect(loc.compare(loc2)).to.equal(0);
      });

      describe("(siblings)", () => {
        let next: DLoc;

        before(() => {
          next = DLoc.mustMakeDLoc(root, firstBodyP.nextSibling, 0);
        });

        it("returns -1 if this precedes other", () => {
          expect(loc.compare(next)).to.equal(-1);
        });

        it("returns 1 if this follows other", () => {
          expect(next.compare(loc)).to.equal(1);
        });
      });

      describe("(attribute - element)", () => {
        let quote: DLoc;
        let attr: DLoc;
        before(() => {
          quote = DLoc.mustMakeDLoc(root, firstQuote);
          attr = DLoc.mustMakeDLoc(root, quoteAtType, 0);
        });

        it("returns -1 if other is an attribute of this", () => {
          expect(quote.compare(attr)).to.equal(-1);
        });

        it("returns 1 if this is an attribute of other", () => {
          expect(attr.compare(quote)).to.equal(1);
        });
      });

      describe("(two attributes)", () => {
        let parent: Element;
        let attr1: DLoc;
        let attr2: DLoc;
        before(() => {
          parent = xmlDoc.createElement("div");
          parent.setAttribute("b", "2");
          parent.setAttribute("a", "1");
          new DLocRoot(parent);
          attr1 = DLoc.mustMakeDLoc(parent, parent.getAttributeNode("a"), 0);
          attr2 = DLoc.mustMakeDLoc(parent, parent.getAttributeNode("b"), 0);
        });

        it("returns -1 if this is an attribute coming before other", () => {
          expect(attr1.compare(attr2)).to.equal(-1);
        });

        it("returns 1 if this is an attribute coming after other", () => {
          expect(attr2.compare(attr1)).to.equal(1);
        });
      });

      describe("(parent - child positions)", () => {
        let parentBefore: DLoc;
        let parentAfter: DLoc;

        before(() => {
          parentBefore = DLoc.mustMakeDLoc(root, firstBodyP.parentNode, 1);
          parentAfter = parentBefore.makeWithOffset(2);
          // We want to check that we are looking at the p element we think
          // we are looking at.
          expect(parentBefore.node.childNodes[1]).to.equal(firstBodyP);
        });

        it("returns -1 if this is a parent position before other", () => {
          expect(parentBefore.compare(loc)).to.equal(-1);
        });

        it("returns 1 if this is a parent position after other", () => {
          expect(parentAfter.compare(loc)).to.equal(1);
        });

        it("returns 1 if this is a child position after other", () => {
          expect(loc.compare(parentBefore)).to.equal(1);
        });

        it("returns -1 if this is a child position before other", () => {
          expect(loc.compare(parentAfter)).to.equal(-1);
        });
      });
    });

    describe("pointedNode", () => {
      let quote: DLoc;
      before(() => {
        quote = DLoc.mustMakeDLoc(root, firstQuote);
        expect(firstQuote).to.have.property("parentNode").equal(quote.node);
      });

      it("is the child of an element node", () => {
        expect(quote).to.have.property("pointedNode").equal(firstQuote);
      });

      it("is the text node itself", () => {
        const text = firstQuote.firstChild!;
        expect(text).to.have.property("nodeType").equal(Node.TEXT_NODE);
        expect(quote.make(text, 0)).to.have.property("pointedNode").equal(text);
      });

      it("is the attribute node itself", () => {
        expect(DLoc.mustMakeDLoc(root, quoteAtType, 0)).to.have
          .property("pointedNode").equal(quoteAtType);
      });

      it("is the comment node itself", () => {
        expect(DLoc.mustMakeDLoc(root, firstComment, 0)).to.have
          .property("pointedNode").equal(firstComment);
      });

      it("is the CData node itself", () => {
        expect(DLoc.mustMakeDLoc(root, firstCData, 0)).to.have
          .property("pointedNode").equal(firstCData);
      });

      it("is the PI node itself", () => {
        expect(DLoc.mustMakeDLoc(root, firstPI, 0)).to.have
          .property("pointedNode").equal(firstPI);
      });

      it("is undefined if offset is past all children of an element", () => {
        expect(quote.make(firstQuote, firstQuote.childNodes.length)).to.have
          .property("pointedNode").undefined;
      });
    });

    describe("makeWithOffset", () => {
      let loc: DLoc;
      before(() => {
        loc = DLoc.mustMakeDLoc(root, firstBodyP, 0);
      });

      it("makes a new object with a new offset", () => {
        const loc2 = loc.makeWithOffset(1);
        expect(loc2).to.have.property("offset").equal(1);
        expect(loc).to.have.property("offset").not.equal(loc2.offset);
        expect(loc).to.not.equal(loc2);
      });

      it("returns the same object if the offset is the same", () => {
        expect(loc).to.equal(loc.makeWithOffset(0));
      });
    });

    describe("getLocationInParent", () => {
      let loc: DLoc;
      before(() => {
        loc = DLoc.mustMakeDLoc(root, secondBodyP, 0);
      });

      it("gets a valid location", () => {
        const loc2 = loc.getLocationInParent();
        expect(loc2).to.have.property("offset").equal(3);
        expect(loc2).to.have.property("node").equal(loc.node.parentNode);
      });

      it("fails if we are already at the root", () => {
        expect(() => loc.make(root, 0).getLocationInParent()).to
          .throw(Error, "node not in root");
      });
    });

    describe("getLocationAfterInParent", () => {
      let loc: DLoc;
      before(() => {
        loc = DLoc.mustMakeDLoc(root, secondBodyP, 0);
      });

      it("gets a valid location", () => {
        const loc2 = loc.getLocationAfterInParent();
        expect(loc2).to.have.property("offset").equal(4);
        expect(loc2).to.have.property("node").equal(loc.node.parentNode);
      });

      it("fails if we are already at the root", () => {
        expect(() => loc.make(root, 0).getLocationAfterInParent()).to
          .throw(Error, "node not in root");
      });
    });
  });

  describe("DLocRange", () => {
    let a: Node;
    let loc: DLoc;

    before(() => {
      a = defined(firstBodyP.firstChild);
      loc = DLoc.mustMakeDLoc(root, a, 0);
    });

    describe("#collapsed", () => {
      it("is true when a range is collapsed", () => {
        expect(new DLocRange(loc, loc)).to.have.property("collapsed").true;
      });

      it("is false when a range is not collapsed", () => {
        expect(new DLocRange(loc, loc.makeWithOffset(1))).to.have
          .property("collapsed").false;
      });
    });

    describe("#equals()", () => {
      it("returns true when other is the same object as this", () => {
        const range = new DLocRange(loc, loc);
        expect(range.equals(range)).to.be.true;
      });

      it("returns true when the two ranges have the same start and end", () => {
        const range = new DLocRange(loc, loc.makeWithOffset(1));
        const range2 = new DLocRange(DLoc.mustMakeDLoc(root, a, 0),
                                     DLoc.mustMakeDLoc(root, a, 1));
        expect(range.equals(range2)).to.be.true;
      });

      it("returns false when the two ranges differ in start positions", () => {
        const range = new DLocRange(loc, loc.makeWithOffset(1));
        const range2 = new DLocRange(DLoc.mustMakeDLoc(root, a, 1),
                                     DLoc.mustMakeDLoc(root, a, 1));
        expect(range.start.equals(range2.start)).to.be.false;
        expect(range.end.equals(range2.end)).to.be.true;
        expect(range.equals(range2)).to.be.false;
      });

      it("returns false when the two ranges differ in end positions", () => {
        const range = new DLocRange(loc, loc);
        const range2 = new DLocRange(DLoc.mustMakeDLoc(root, a, 0),
                                     DLoc.mustMakeDLoc(root, a, 1));
        expect(range.start.equals(range2.start)).to.be.true;
        expect(range.end.equals(range2.end)).to.be.false;
        expect(range.equals(range2)).to.be.false;
      });
    });

    describe("#isValid()", () => {
      it("returns true if both ends are valid", () => {
        expect(new DLocRange(loc, loc).isValid()).to.be.true;
      });

      it("returns false if start is invalid", () => {
        expect(new DLocRange(makeInvalidCase().invalid, loc).isValid()).to.be
          .false;
      });

      it("returns false if end is invalid", () => {
        expect(new DLocRange(loc, makeInvalidCase().invalid).isValid()).to.be
          .false;
      });
    });

    describe("#makeDOMRange()", () => {
      it("makes a DOM range", () => {
        const loc2 = loc.makeWithOffset(1);
        const range = new DLocRange(loc, loc2).makeDOMRange()!;
        expect(range).to.not.be.undefined;
        expect(range).to.have.property("startContainer").equal(loc.node);
        expect(range).to.have.property("startOffset").equal(loc.offset);
        expect(range).to.have.property("endContainer").equal(loc2.node);
        expect(range).to.have.property("endOffset").equal(loc2.offset);
      });

      it("fails if start is an attribute node", () => {
        const { attrLoc, loc: loc2 } = makeAttributeNodeCase();
        expect(() => new DLocRange(attrLoc, loc2).makeDOMRange()).to
          .throw(Error, "cannot make range from attribute node");
      });

      it("fails if end is an attribute node", () => {
        const { attrLoc, loc: loc2 } = makeAttributeNodeCase();
        expect(() => new DLocRange(loc2, attrLoc).makeDOMRange()).to
          .throw(Error, "cannot make range from attribute node");
      });

      it("returns undefined if start is invalid", () => {
        expect(new DLocRange(makeInvalidCase().invalid, loc).makeDOMRange())
          .to.be.undefined;
      });

      it("returns undefined if end is invalid", () => {
        expect(new DLocRange(loc, makeInvalidCase().invalid).makeDOMRange())
          .to.be.undefined;
      });
    });

    describe("#mustMakeDOMRange()", () => {
      it("makes a DOM range", () => {
        const loc2 = loc.makeWithOffset(1);
        const range = new DLocRange(loc, loc2).mustMakeDOMRange();
        expect(range).to.not.be.undefined;
        expect(range).to.have.property("startContainer").equal(loc.node);
        expect(range).to.have.property("startOffset").equal(loc.offset);
        expect(range).to.have.property("endContainer").equal(loc2.node);
        expect(range).to.have.property("endOffset").equal(loc2.offset);
      });

      it("throws if start is invalid", () => {
        expect(() => new DLocRange(makeInvalidCase().invalid, loc)
               .mustMakeDOMRange()).to.throw(Error, "cannot make a range");
      });

      it("throws if end is invalid", () => {
        expect(() => new DLocRange(loc, makeInvalidCase().invalid)
               .mustMakeDOMRange()).to.throw(Error, "cannot make a range");
      });
    });

    describe("#contains()", () => {
      let range: DLocRange;
      before(() => {
        range = new DLocRange(loc, loc.makeWithOffset(2));
      });

      it("returns false if the location is before the range", () => {
        expect(range.contains(loc.make(loc.node.parentNode!, 0))).to.be.false;
      });

      it("returns false if the location is after the range", () => {
        expect(range.contains(loc.makeWithOffset(3))).to.be.false;
      });

      it("returns true if the location is at start of the range", () => {
        expect(range.contains(loc.makeWithOffset(0))).to.be.true;
      });

      it("returns true if the location is at end of the range", () => {
        expect(range.contains(loc.makeWithOffset(2))).to.be.true;
      });

      it("returns true if the location is between the ends", () => {
        expect(range.contains(loc.makeWithOffset(1))).to.be.true;
      });
    });
  });
});
