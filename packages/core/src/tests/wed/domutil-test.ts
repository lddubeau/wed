/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import $ from "jquery";

import * as convert from "wed/convert";
import * as domutil from "wed/domutil";

import { DataProvider } from "../util";
import { dataPath } from "../wed-test-util";

// Assert is being deprecated from our test suite. Use expect for new tests.
const assert = chai.assert;
const expect = chai.expect;

// tslint:disable:no-any

// tslint:disable-next-line:no-http-string
const XHTML = "http://www.w3.org/1999/xhtml";
// tslint:disable-next-line:no-http-string
const TEI = "http://www.tei-c.org/ns/1.0";

// Utility  XML nodes.
function empty(el: Element): void {
  // tslint:disable-next-line:no-inner-html
  el.innerHTML = "";
}

function defined<T>(x: T | null | undefined): T {
  assert.isDefined(x);
  // The assertion above already excludes null and undefined, but TypeScript
  // does not know this.
  return x as T;
}

const commonMap = {
  // tslint:disable-next-line:no-http-string
  btw: "http://mangalamresearch.org/ns/btw-storage",
  tei: TEI,
};

describe("domutil", () => {
  let provider: DataProvider;
  let domroot: HTMLElement;
  let sourceDoc: Document;

  before(async () => {
    provider = new DataProvider(`${dataPath}/domutil_test_data/`);
    const data = await provider.getText("source_converted.xml");
    const parser = new DOMParser();
    sourceDoc = parser.parseFromString(data, "application/xml");
  });

  before(() => {
    domroot = document.createElement("div");
    document.body.appendChild(domroot);
  });

  after(() => {
    document.body.removeChild(domroot);
  });

  describe("splitTextNode", () => {
    let root: Document;
    let title: HTMLElement;
    let child: Text;
    beforeEach(() => {
      root = sourceDoc.cloneNode(true) as Document;
      title = root.getElementsByTagName("title")[0];
      child = title.firstChild as Text;
    });

    it("fails on non-text node", () => {
      expect(() => domutil.splitTextNode(title as any, 0)).to
        .throw(Error, "insertIntoText called on non-text");
    });

    it("splits a text node", () => {
      const [first, second] = domutil.splitTextNode(child, 2);
      assert.equal(first.nodeValue, "ab");
      assert.equal(second.nodeValue, "cd");
      assert.equal(title.childNodes.length, 2);
    });

    it("works fine with negative offset", () => {
      const [first, second] = domutil.splitTextNode(child, -1);
      assert.equal(first.nodeValue, "");
      assert.equal(second.nodeValue, "abcd");
      assert.equal(title.childNodes.length, 2);
    });

    it("works fine with offset beyond text length", () => {
      const [first, second] =
        domutil.splitTextNode(child, child.nodeValue!.length);
      assert.equal(first.nodeValue, "abcd");
      assert.equal(second.nodeValue, "");
      assert.equal(title.childNodes.length, 2);
    });
  });

  describe("insertIntoText", () => {
    let root: Document;
    let title: HTMLElement;
    let child: Text;
    let p: HTMLElement;
    let pChild: Text;
    beforeEach(() => {
      root = sourceDoc.cloneNode(true) as Document;
      title = root.getElementsByTagName("title")[0];
      child = title.firstChild as Text;
      p = root.getElementsByTagName("p")[0];
      pChild = p.firstChild as Text;
    });

    it("fails on non-text node", () => {
      expect(() => domutil.insertIntoText(title as any, 0, title)).to
        .throw(Error, "insertIntoText called on non-text");
    });

    it("fails on undefined node to insert", () => {
      expect(() => domutil.insertIntoText(child, 0, undefined as any))
        .to.throw(Error, "must pass an actual node to insert");
    });

    it("inserts the new element", () => {
      const el = child.ownerDocument!.createElement("span");
      const [first, second] = domutil.insertIntoText(child, 2, el);
      assert.equal(first[0].nodeValue, "ab");
      assert.equal(first[0].nextSibling, el);
      assert.equal(first[1], 2);
      assert.equal(second[0].nodeValue, "cd");
      assert.equal(second[0].previousSibling, el);
      assert.equal(second[1], 0);
      assert.equal(title.childNodes.length, 3);
      assert.equal(title.childNodes[1], el);
    });

    it("works with negative offset", () => {
      const el = child.ownerDocument!.createElement("span");
      const [first, second] = domutil.insertIntoText(child, -1, el);
      assert.deepEqual(first, [el.parentNode!, 0], "first caret");
      assert.equal(second[0].nodeValue, "abcd");
      assert.equal(second[0].previousSibling, el);
      assert.equal(second[1], 0);
      assert.equal(title.childNodes.length, 2);
      assert.equal(title.firstChild, el);
    });

    it("works with negative offset and fragment", () => {
      const frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode("first"));
      frag.appendChild(document.createElement("span")).textContent = "blah";
      frag.appendChild(document.createTextNode("last"));
      const [first, second] = domutil.insertIntoText(child, -1, frag);
      assert.deepEqual(first, [title, 0]);
      assert.equal(second[0].nodeValue, "lastabcd");
      assert.equal(second[1], 4);
      assert.equal(title.childNodes.length, 3);
      assert.equal(title.innerHTML,
                   `first<span xmlns="${XHTML}">blah</span>lastabcd`);
    });

    it("works with negative offset and fragment containing only text", () => {
      const frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode("first"));
      const [first, second] = domutil.insertIntoText(child, -1, frag);
      assert.deepEqual(first, [title, 0]);
      assert.deepEqual(second, [title.firstChild!, 5]);
      assert.equal(title.childNodes.length, 1);
      assert.equal(title.innerHTML, "firstabcd");
    });

    it("works with offset beyond text length", () => {
      assert.equal(title.childNodes.length, 1,
                   "the parent should start with one child");
      const el = child.ownerDocument!.createElement("span");
      const [first, second] =
        domutil.insertIntoText(child, child.nodeValue!.length, el);
      assert.equal(title.childNodes.length, 2,
                   "the parent should have two children after insertion");
      assert.equal(first[0].nodeValue, "abcd");
      assert.equal(first[0].nextSibling, el);
      assert.deepEqual(first, [title.firstChild!, 4]);
      assert.deepEqual(second, [title, 2]);
      assert.equal(title.childNodes.length, 2,
                   "title.childNodes.length should be 2");
      assert.equal(title.lastChild, el);
    });

    it("works with offset beyond text length and fragment", () => {
      const frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode("first"));
      frag.appendChild(document.createElement("span")).textContent = "blah";
      frag.appendChild(document.createTextNode("last"));
      const [first, second] =
        domutil.insertIntoText(child, child.nodeValue!.length, frag);
      assert.equal(first[0].nodeValue, "abcdfirst");
      assert.deepEqual(first, [title.firstChild!, 4]);
      assert.deepEqual(second, [title, 3]);
      assert.equal(title.childNodes.length, 3);
      assert.equal(title.innerHTML,
                   `abcdfirst<span xmlns="${XHTML}">blah</span>last`);
       });

    it("works with offset beyond text length and text-only fragment", () => {
      const frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode("first"));
      const [first, second] =
        domutil.insertIntoText(child, child.nodeValue!.length, frag);
      assert.deepEqual(first, [title.firstChild!, 4]);
      assert.deepEqual(second, [title, title.childNodes.length]);
      assert.equal(title.childNodes.length, 1);
      assert.equal(title.innerHTML, "abcdfirst");
    });

    it("cleans up after inserting a text node", () => {
      const text = document.createTextNode("test");
      const [first, second] = domutil.insertIntoText(child, 2, text);
      assert.equal(first[0].nodeValue, "abtestcd");
      assert.equal(first[1], 2);
      assert.equal(second[0].nodeValue, "abtestcd");
      assert.equal(second[1], 6);
      assert.equal(title.childNodes.length, 1);
    });

    it("cleans up after inserting an element into whitespace", () => {
      const el = document.createElement("hi");
      const [first, second] = domutil.insertIntoText(pChild, 1, el);
      expect(p).to.have.property("innerHTML")
        .equal(` <hi xmlns="${XHTML}"></hi>  with  spaces  `);
      expect(first[0]).to.have.property("data").equal(" ");
      expect(first[1]).to.equal(1);
      expect(second[0]).to.have.property("data").equal("  with  spaces  ");
      expect(second[1]).to.equal(0);
      expect(p).to.have.property("childNodes").lengthOf(3);
    });

    it("cleans up after inserting a fragment with text", () => {
      const frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode("first"));
      frag.appendChild(document.createElement("span")).textContent = "blah";
      frag.appendChild(document.createTextNode("last"));
      const [first, second] = domutil.insertIntoText(child, 2, frag);
      assert.equal(first[0].nodeValue, "abfirst");
      assert.equal(first[1], 2);
      assert.equal(second[0].nodeValue, "lastcd");
      assert.equal(second[1], 4);
      assert.equal(title.childNodes.length, 3);
    });
  });

  describe("insertText", () => {
    let root: Document;
    let title: HTMLElement;
    beforeEach(() => {
      root = sourceDoc.cloneNode(true) as Document;
      title = root.getElementsByTagName("title")[0];
    });

    function makeSeries(seriesTitle: string,
                        caretAtEnd: boolean,
                        adapter: (node: Node,
                                  offset: number,
                                  text: string) => domutil.TextInsertionResult)
    : void {
      describe(seriesTitle, () => {
        it("modifies a text node", () => {
          const node = title.firstChild!;
          const { node: textNode, isNew, caret } = adapter(node, 2, "Q");
          assert.equal(textNode as Node, node);
          assert.isFalse(isNew);
          assert.equal(textNode!.nodeValue, "abQcd");
          assert.equal(caret[0], textNode);
          assert.equal(caret[1], caretAtEnd ? 3 : 2);
        });

        it("uses the next text node if possible", () => {
          const { node: textNode, isNew, caret } = adapter(title, 0, "Q");
          assert.equal(textNode as Node, title.firstChild);
          assert.isFalse(isNew);
          assert.equal(textNode!.nodeValue, "Qabcd");
          assert.equal(caret[0], textNode);
          assert.equal(caret[1], caretAtEnd ? 1 : 0);
        });

        it("uses the previous text node if possible", () => {
          const { node: textNode, isNew, caret } = adapter(title, 1, "Q");
          assert.equal(textNode as Node, title.firstChild);
          assert.isFalse(isNew);
          assert.equal(textNode!.nodeValue, "abcdQ");
          assert.equal(caret[0], textNode);
          assert.equal(caret[1], caretAtEnd ? 5 : 4);
        });

        it("creates a text node if needed", () => {
          empty(title);
          const { node: textNode, isNew, caret } = adapter(title, 0, "test");
          assert.equal(textNode as Node, title.firstChild);
          assert.equal(textNode!.nodeValue, "test");
          assert.isTrue(isNew);
          assert.equal(caret[0], textNode);
          assert.equal(caret[1], caretAtEnd ? 4 : 0);
        });

        it("does nothing if passed an empty string", () => {
          assert.equal(title.firstChild!.nodeValue, "abcd");
          const { node: textNode, isNew, caret } = adapter(title, 1, "");
          assert.equal(title.firstChild!.nodeValue, "abcd");
          assert.isUndefined(textNode);
          assert.isFalse(isNew);
          assert.equal(caret[0], title);
          assert.equal(caret[1], 1);
        });

        it("inserts in correct position if needs to create text node", () => {
          empty(title);
          const b = title.ownerDocument!.createElement("b");
          b.textContent = "q";
          title.appendChild(b);
          const { node: textNode, isNew, caret } = adapter(title, 1, "test");
          assert.equal(textNode as Node, title.lastChild);
          assert.equal(textNode!.nodeValue, "test");
          assert.isTrue(isNew);
          assert.equal(caret[0], textNode);
          assert.equal(caret[1], caretAtEnd ? 4 : 0);
        });
      });
    }

    // tslint:disable-next-line:mocha-no-side-effect-code
    makeSeries("(caretAtEnd unspecified)",
               true,
               (node, offset, text) => domutil.insertText(node, offset, text));
    // tslint:disable-next-line:mocha-no-side-effect-code
    makeSeries("(caretAtEnd true)",
               true,
               (node, offset, text) =>
               domutil.insertText(node, offset, text, true));
    // tslint:disable-next-line:mocha-no-side-effect-code
    makeSeries("(caretAtEnd false)",
               false,
               (node, offset, text) =>
               domutil.insertText(node, offset, text, false));
  });

  describe("deleteText", () => {
    let root: Document;
    let title: HTMLElement;
    let child: Text;

    beforeEach(() => {
      root = sourceDoc.cloneNode(true) as Document;
      title = root.getElementsByTagName("title")[0];
      child = title.firstChild as Text;
    });

    it("fails on non-text node", () => {
      expect(() => {
        domutil.deleteText(title as any, 0, 0);
      }).to.throw(Error, "deleteText called on non-text");
    });

    it("modifies a text node", () => {
      domutil.deleteText(child, 2, 2);
      assert.equal(child.nodeValue, "ab");
    });

    it("deletes an empty text node", () => {
      domutil.deleteText(child, 0, 4);
      assert.isNull(child.parentNode);
    });
  });

  describe("firstDescendantOrSelf", () => {
    let root: Document;
    beforeEach(() => {
      root = sourceDoc.cloneNode(true) as Document;
    });

    it("returns null when passed null", () => {
      assert.isNull(domutil.firstDescendantOrSelf(null));
    });

    it("returns null when passed undefined", () => {
      assert.isNull(domutil.firstDescendantOrSelf(undefined));
    });

    it("returns the node when it has no descendants", () => {
      const node = root.getElementsByTagName("title")[0].firstChild;
      assert.isNotNull(node); // make sure we got something
      assert.isDefined(node); // make sure we got something
      assert.equal(domutil.firstDescendantOrSelf(node), node);
    });

    it("returns the first descendant", () => {
      const node = root;
      assert.isNotNull(node); // make sure we got something
      assert.isDefined(node); // make sure we got something
      assert.equal(domutil.firstDescendantOrSelf(node),
                   root.getElementsByTagName("title")[0].firstChild);
    });
  });

  describe("lastDescendantOrSelf", () => {
    let root: Document;
    beforeEach(() => {
      root = sourceDoc.cloneNode(true) as Document;
    });

    it("returns null when passed null", () => {
      assert.isNull(domutil.lastDescendantOrSelf(null));
    });

    it("returns null when passed undefined", () => {
      assert.isNull(domutil.lastDescendantOrSelf(undefined));
    });

    it("returns the node when it has no descendants", () => {
      const node = root.getElementsByTagName("title")[0].firstChild;
      assert.isNotNull(node); // make sure we got something
      assert.isDefined(node); // make sure we got something
      assert.equal(domutil.lastDescendantOrSelf(node), node);
    });

    it("returns the last descendant", () => {
      const node = root;
      assert.isNotNull(node); // make sure we got something
      assert.isDefined(node); // make sure we got something
      assert.equal(domutil.lastDescendantOrSelf(node),
                   root.getElementsByTagName("p")[5].lastChild);
    });
  });

  describe("correspondingNode", () => {
    let root: Document;
    beforeEach(() => {
      root = sourceDoc.cloneNode(true) as Document;
    });

    it("returns the corresponding node", () => {
      const clone = root.cloneNode(true) as Element;
      const corresp = domutil.correspondingNode(
        root, clone, root.querySelectorAll("quote")[1]);
      assert.equal(corresp, clone.querySelectorAll("quote")[1]);
    });

    it("fails if the node is not in the tree", () => {
      expect(() => domutil.correspondingNode(root, root.cloneNode(true),
                                             document.body))
        .to.throw(Error, "nodeInA is not treeA or a child of treeA");
    });
  });

  describe("linkTrees", () => {
    let doc: Document;
    beforeEach(() => {
      doc = sourceDoc.cloneNode(true) as Document;
    });

    it("sets wed_mirror_node", () => {
      const root = doc.firstChild as Element;
      const cloned = root.cloneNode(true) as Element;
      domutil.linkTrees(cloned, root);
      const p = root.getElementsByTagName("p")[0];
      const clonedP = cloned.getElementsByTagName("p")[0];
      assert.equal($.data(p, "wed_mirror_node"), clonedP);
      assert.equal($.data(clonedP, "wed_mirror_node"), p);
    });
  });

  describe("focusNode", () => {
    let testPara: HTMLElement;
    let diversion: HTMLElement;
    let text: Text;
    let comment: Comment;
    let pi: ProcessingInstruction;

    before(() => {
      testPara = document.createElement("p");
      testPara.setAttribute("tabindex", "-1");
      testPara.textContent = "Test para.";
      text = testPara.firstChild as Text;
      comment = document.createComment("foo");
      pi = document.createProcessingInstruction("a", "b");
      testPara.appendChild(comment);
      testPara.appendChild(pi);
      document.body.appendChild(testPara);

      diversion = document.createElement("p");
      diversion.setAttribute("tabindex", "-1");
      document.body.appendChild(diversion);
    });

    afterEach(() => {
      diversion.focus();
    });

    after(() => {
      document.body.removeChild(testPara);
      document.body.removeChild(diversion);
    });

    it("focuses an element", () => {
      expect(document).to.have.property("activeElement").not.equal(testPara);
      domutil.focusNode(testPara);
      expect(document).to.have.property("activeElement").equal(testPara);
    });

    it("focuses text's parent", () => {
      expect(document).to.have.property("activeElement").not.equal(testPara);
      domutil.focusNode(text);
      expect(document).to.have.property("activeElement").equal(testPara);
    });

    it("focuses comment's parent", () => {
      expect(document).to.have.property("activeElement").not.equal(testPara);
      domutil.focusNode(comment);
      expect(document).to.have.property("activeElement").equal(testPara);
    });

    it("focuses pi's parent", () => {
      expect(document).to.have.property("activeElement").not.equal(testPara);
      domutil.focusNode(pi);
      expect(document).to.have.property("activeElement").equal(testPara);
    });

    // It is not possible to test with CDATA because CDATA is not valid in an
    // HTML tree.

    it("throws an error when called with bad value", () => {
      expect(() => {
        domutil.focusNode(document);
      }).to.throw(Error, "tried to focus something other than an element or an \
element child.");
    });
  });

  describe("genericCutFunction", () => {
    let root: Document;
    let p: Element;
    beforeEach(() => {
      root = sourceDoc.cloneNode(true) as Document;
      p = root.querySelectorAll("body>p")[1];
    });

    function checkNodes(ret: Node[], nodes: Node[]): void {
      assert.equal(ret.length, nodes.length, "result length");
      for (let i = 0; i < nodes.length; ++i) {
        assert.equal(ret[i].nodeType, nodes[i].nodeType);
        assert.isTrue(ret[i].nodeType === Node.TEXT_NODE ||
                      ret[i].nodeType === Node.ELEMENT_NODE,
                      "node type");
        switch (ret[i].nodeType) {
        case Node.TEXT_NODE:
          assert.equal(ret[i].nodeValue, nodes[i].nodeValue,
                       `text node at ${i}`);
          break;
        case Node.ELEMENT_NODE:
          assert.equal((ret[i] as Element).outerHTML,
                       (nodes[i] as Element).outerHTML, `element node at ${i}`);
          break;
        default:
        }
      }
    }

    let cut: Function;
    before(() => {
      cut = domutil.genericCutFunction.bind({
        deleteText: domutil.deleteText,
        deleteNode: domutil.deleteNode,
        mergeTextNodes: domutil.mergeTextNodes,
      });
    });

    it("removes nodes and merges text", () => {
      const start = [p.firstChild!, 4] as domutil.Caret;
      const end = [p.lastChild!, 3] as domutil.Caret;
      assert.equal(p.childNodes.length, 5);

      const nodes = Array.prototype.slice.call(
        p.childNodes,
        domutil.indexOf(p.childNodes, start[0].nextSibling!),
        domutil.indexOf(p.childNodes, end[0].previousSibling!) + 1);
      nodes.unshift(p.ownerDocument!.createTextNode("re "));
      nodes.push(p.ownerDocument!.createTextNode(" af"));

      const [final, cutContent] = cut(start, end);

      // Check that we're doing what we think we're doing.
      assert.equal(p.childNodes.length, 1);
      assert.equal(p.innerHTML, "befoter");

      // Check the caret position.
      assert.deepEqual(final, [p.firstChild, 4]);

      // Check that the nodes are those we expected.
      checkNodes(cutContent, nodes);
    });

    it("returns proper nodes when merging a single node", () => {
      const start = [p.firstChild, 4];
      const end = [p.firstChild, 6];
      assert.equal(p.childNodes.length, 5);

      const nodes = [p.ownerDocument!.createTextNode("re")];
      const [final, cutContent] = cut(start, end);

      // Check that we're doing what we think we're doing.
      assert.equal(p.childNodes.length, 5);
      assert.equal(p.firstChild!.nodeValue, "befo ");

      // Check the caret position.
      assert.deepEqual(final, [p.firstChild, 4]);

      // Check that the nodes are those we expected.
      checkNodes(cutContent, nodes);
    });

    it("empties an element without problem", () => {
      const start = [p, 0];
      const end = [p, p.childNodes.length];
      assert.equal(p.childNodes.length, 5);

      const nodes = Array.prototype.slice.call(p.childNodes);
      const [final, cutContent] = cut(start, end);

      // Check that we're doing what we think we're doing.
      assert.equal(p.childNodes.length, 0);

      // Check the caret position.
      assert.deepEqual(final, [p, 0]);
      // Check that the nodes are those we expected.
      checkNodes(cutContent, nodes);
    });

    it("accepts a start caret in text and an end caret outside text", () => {
      const start = [p.firstChild, 0];
      const end = [p, p.childNodes.length];
      assert.equal(p.childNodes.length, 5);

      const nodes = Array.prototype.slice.call(p.cloneNode(true).childNodes);
      const [final, cutContent] = cut(start, end);

      // Check that we're doing what we think we're doing.
      assert.equal(p.childNodes.length, 0);

      // Check the caret position.
      assert.deepEqual(final, [p, 0]);
      // Check that the nodes are those we expected.
      checkNodes(cutContent, nodes);
    });

    it("accepts a start caret outside text and an end caret in text", () => {
      const start = [p, 0];
      const end = [p.lastChild, p.lastChild!.nodeValue!.length];
      assert.equal(p.childNodes.length, 5);

      const nodes = Array.prototype.slice.call(p.cloneNode(true).childNodes);
      const [final, cutContent] = cut(start, end);

      // Check that we're doing what we think we're doing.
      assert.equal(p.childNodes.length, 0);

      // Check the caret position.
      assert.deepEqual(final, [p, 0]);
      // Check that the nodes are those we expected.
      checkNodes(cutContent, nodes);
    });
  });

  // tslint:disable:no-inner-html
  describe("closest", () => {
    let p: HTMLElement;
    let text: HTMLElement;
    before(() => {
      domroot.innerHTML = `<div class="text"><div class="body">\
<div class="p">aaa</div></div></div>`;
      p = domroot.getElementsByClassName("p")[0] as HTMLElement;
      text = domroot.getElementsByClassName("text")[0] as HTMLElement;
    });

    it("returns null when node is null", () => {
      assert.isNull(domutil.closest(null, "foo"));
    });

    it("returns a value when there is a match", () => {
      assert.equal(domutil.closest(p, ".text"), text);
    });

    it("initially moves out of text nodes", () => {
      const textNode = p.firstChild!;
      assert.equal(textNode.nodeType, Node.TEXT_NODE);
      assert.equal(domutil.closest(textNode, ".text"), text);
    });

    it("returns null when there is no match", () => {
      assert.isNull(domutil.closest(p, "FOO"));
    });

    it("returns null when it hits nothing before the limit", () => {
      assert.isNull(domutil.closest(p, ".text", p.parentNode as Element));
    });
  });

  describe("closestByClass", () => {
    let p: HTMLElement;
    let text: HTMLElement;
    before(() => {
      domroot.innerHTML = `<div class="text"><div class="body">\
<div class="p">aaa</div></div></div>`;
      p = domroot.getElementsByClassName("p")[0] as HTMLElement;
      text = domroot.getElementsByClassName("text")[0] as HTMLElement;
    });

    it("returns null when node is null", () => {
      assert.isNull(domutil.closestByClass(null, "foo"));
    });

    it("returns a value when there is a match", () => {
      assert.equal(domutil.closestByClass(p, "text"), text);
    });

    it("initially moves out of text nodes", () => {
      const textNode = p.firstChild!;
      assert.equal(textNode.nodeType, Node.TEXT_NODE);
      assert.equal(domutil.closestByClass(textNode, "text"), text);
    });

    it("returns null when there is no match", () => {
      assert.isNull(domutil.closestByClass(p, "FOO"));
    });

    it("returns null when it hits nothing before the limit", () => {
      assert.isNull(domutil.closestByClass(p, "text", p.parentNode as Element));
    });
  });

  describe("siblingByClass", () => {
    let a: HTMLCollectionOf<Element>;
    let b: HTMLCollectionOf<Element>;
    let firstLi: HTMLElement;
    before(() => {
      domroot.innerHTML = `<ul><li>a</li><li class="a"></li><li></li>\
<li class="b"></li><li></li><li class="a"></li></ul>`;
      b = domroot.getElementsByClassName("b");
      a = domroot.getElementsByClassName("a");
      firstLi = domroot.getElementsByTagName("li")[0];
    });

    it("returns null when node is null", () => {
      assert.isNull(domutil.siblingByClass(null, "foo"));
    });

    it("returns null when the node is not an element", () => {
      const text = firstLi.firstChild!;
      assert.equal(text.nodeType, Node.TEXT_NODE);
      assert.isNull(domutil.siblingByClass(text, "foo"));
    });

    it("returns null when the node has no parent", () => {
      assert.isNull(domutil.siblingByClass(document.createElement("q"), "foo"));
    });

    it("returns null when nothing matches", () => {
      assert.isNull(domutil.siblingByClass(firstLi, "foo"));
    });

    it("returns a match when a preceding sibling matches", () => {
      assert.equal(domutil.siblingByClass(b[0], "a"), a[0]);
    });

    it("returns a match when a following sibling matches", () => {
      assert.equal(domutil.siblingByClass(a[0], "b"), b[0]);
    });
  });

  describe("childrenByClass", () => {
    let a: HTMLCollectionOf<Element>;
    let firstLi: HTMLElement;
    let ul: HTMLElement;
    before(() => {
      domroot.innerHTML = `<ul><li>a</li><li class="a"></li><li></li>
<li class=\"b\"></li><li></li><li class="a"></li></ul>`;
      ul = domroot.getElementsByTagName("ul")[0];
      a = domroot.getElementsByClassName("a");
      firstLi = domroot.getElementsByTagName("li")[0];
    });

    it("returns [] when node is null", () => {
      assert.sameMembers(domutil.childrenByClass(null, "foo"), []);
    });

    it("returns [] when the node is not an element", () => {
      const text = firstLi.firstChild!;
      assert.equal(text.nodeType, Node.TEXT_NODE);
      assert.sameMembers(domutil.childrenByClass(text, "foo"), []);
    });

    it("returns [] when nothing matches", () => {
      assert.sameMembers(domutil.childrenByClass(ul, "foo"), []);
    });

    it("returns a match", () => {
      assert.sameMembers(domutil.childrenByClass(ul, "a"),
                         Array.prototype.slice.call(a));
    });
  });

  describe("childByClass", () => {
    let a: HTMLCollectionOf<Element>;
    let firstLi: HTMLElement;
    let ul: HTMLElement;
    before(() => {
      domroot.innerHTML = `<ul><li>a</li><li class="a"></li><li></li>\
<li class="b"></li><li></li><li class="a"></li></ul>`;
      ul = domroot.getElementsByTagName("ul")[0];
      a = domroot.getElementsByClassName("a");
      firstLi = domroot.getElementsByTagName("li")[0];
    });

    it("returns null when node is null", () => {
      assert.isNull(domutil.childByClass(null, "foo"));
    });

    it("returns null when the node is not an element", () => {
      const text = firstLi.firstChild!;
      assert.equal(text.nodeType, Node.TEXT_NODE);
      assert.isNull(domutil.childByClass(text, "foo"));
    });

    it("returns null when nothing matches", () => {
      assert.isNull(domutil.childByClass(ul, "foo"));
    });

    it("returns the first match when something matches", () => {
      assert.equal(domutil.childByClass(ul, "a"), a[0]);
    });
  });

  describe("toGUISelector", () => {
    it("raises an error on brackets", () => {
      expect(() => domutil.toGUISelector("abcde[f]", {}))
        .to.throw(Error, "selector is too complex");
    });

    it("raises an error on parens", () => {
      expect(() => domutil.toGUISelector("abcde:not(f)", {}))
        .to.throw(Error, "selector is too complex");
    });

    it("converts a > sequence", () => {
      expect(domutil.toGUISelector("p > term > foreign", { "": "" }))
        .to.equal("._local_p._xmlns_._real > ._local_term._xmlns_._real \
> ._local_foreign._xmlns_._real");
    });

    it("converts a space sequence with namespaces", () => {
      expect(domutil.toGUISelector("btw:cit tei:q", commonMap))
        .to.equal("._local_cit.\
_xmlns_http\\:\\/\\/mangalamresearch\\.org\\/ns\\/btw-storage._real \
._local_q._xmlns_http\\:\\/\\/www\\.tei-c\\.org\\/ns\\/1\\.0._real");
    });

    it("lets class names without element names go through", () => {
      expect(domutil.toGUISelector("p > .head", { "": "" }))
        .to.equal("._local_p._xmlns_._real > .head");
    });

    it("lets class names on element names go through", () => {
      expect(domutil.toGUISelector("p.foo", { "": "" }))
        .to.equal("._local_p._xmlns_._real.foo");
    });

    it("lets ids without element names go through", () => {
      expect(domutil.toGUISelector("p > .head#fnord", { "": "" }))
        .to.equal("._local_p._xmlns_._real > .head#fnord");
    });

    it("lets ids on element names go through", () => {
      expect(domutil.toGUISelector("p.foo#fnord", { "": "" }))
        .to.equal("._local_p._xmlns_._real.foo#fnord");
    });
  });

  describe("dataFind/dataFindAll", () => {
    let dataRoot: Element;
    before(() => provider.getText("dataFind_converted.xml").then((data) => {
      const parser = new DOMParser();
      const dataDoc = parser.parseFromString(data, "application/xml");
      dataRoot = dataDoc.firstChild as Element;
      const guiRoot = convert.toHTMLTree(document, dataRoot) as HTMLElement;
      domutil.linkTrees(dataRoot, guiRoot);
    }));

    it("find a node", () => {
      const result = domutil.dataFind(dataRoot, "btw:sense-emphasis",
                                      commonMap)!;
      assert.equal(result.tagName, "btw:sense-emphasis");
      assert.isTrue(dataRoot.contains(result));
    });

    it("find a child node", () => {
      const result = domutil.dataFind(dataRoot, "btw:overview>btw:definition",
                                      commonMap)!;
      assert.equal(result.tagName, "btw:definition");
      assert.isTrue(dataRoot.contains(result));
    });

    it("find nodes", () => {
      const results = domutil.dataFindAll(dataRoot, "btw:sense-emphasis",
                                          commonMap);
      assert.equal(results.length, 4);
      results.forEach((x) => {
        assert.equal(x.tagName, "btw:sense-emphasis");
        assert.isTrue(dataRoot.contains(x));
      });
    });
  });

  describe("contains", () => {
    let ul: HTMLElement;
    let li: HTMLElement;

    before(() => {
      domroot.innerHTML = "<ul><li class=\"a\"></li></ul>";
      ul = domroot.getElementsByTagName("ul")[0];
      li = domroot.getElementsByTagName("li")[0];
    });

    it("handles elements", () => {
      assert.isTrue(domutil.contains(ul, li));
      assert.isFalse(domutil.contains(li, ul));
    });

    it("handles attributes", () => {
      const classAttr = li.attributes.getNamedItem("class")!;
      assert.isTrue(domutil.contains(li, classAttr));
      // Transitively: the attribute is contained by li, which is contained by
      // ul
      assert.isTrue(domutil.contains(ul, classAttr));
      assert.isFalse(domutil.contains(classAttr, ul));
    });
  });

  describe("comparePositions", () => {
    let p: Node;
    before(() => {
      p = defined(sourceDoc.querySelector("body p"));
    });

    it("returns 0 if the two locations are equal", () => {
      assert.equal(domutil.comparePositions(p, 0, p, 0), 0);
    });

    it("returns -1 if the 1st location is before the 2nd", () => {
      assert.equal(domutil.comparePositions(p, 0, p, 1), -1);
    });

    it("returns 1 if the 1st location is after the 2nd", () => {
      assert.equal(domutil.comparePositions(p, 1, p, 0), 1);
    });

    describe("(siblings)", () => {
      let next: Node;

      before(() => {
        next = defined(p.nextSibling);
      });

      it("returns -1 if 1st location precedes 2nd", () => {
        assert.equal(domutil.comparePositions(p, 0, next, 0), -1);
      });

      it("returns 1 if 1st location follows 2nd", () => {
        assert.equal(domutil.comparePositions(next, 0, p, 0), 1);
      });
    });

    describe("(parent - child positions)", () => {
      let parent: Node;

      before(() => {
        parent = defined(p.parentNode);
        // We want to check that we are looking at the p element we think
        // we are looking at.
        assert.equal(parent.childNodes[0], p);
      });

      it("returns -1 if 1st position is a parent position before 2nd", () => {
        assert.equal(domutil.comparePositions(parent, 0, p, 0), -1);
      });

      it("returns 1 if 1st position is a parent position after 2nd", () => {
        assert.equal(domutil.comparePositions(parent, 1, p, 0), 1);
      });

      it("returns 1 if 1st position is a child position after 2nd", () => {
        assert.equal(domutil.comparePositions(p, 0, parent, 0), 1);
      });

      it("returns -1 if 1st position is a child position before 2nd", () => {
        assert.equal(domutil.comparePositions(p, 0, parent, 1), -1);
      });
    });
  });
});

//  LocalWords:  jquery domutil nextCaretPosition domroot chai isNotNull html
//  LocalWords:  prevCaretPosition splitTextNode pre abcd insertIntoText lastcd
//  LocalWords:  lastabcd firstabcd abtestcd abcdfirst abfirst insertText abQcd
//  LocalWords:  Qabcd deleteText firstDescendantOrSelf cd abcdQ linkTrees MPL
//  LocalWords:  whitespace nextSibling jQuery previousSibling Dubeau Mangalam
