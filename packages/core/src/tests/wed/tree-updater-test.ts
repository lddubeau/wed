/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";

import { DLoc, DLocRoot } from "wed/dloc";
import { indexOf } from "wed/domutil";
import { TextInsertionResult, TreeUpdater,
         TreeUpdaterEvents } from "wed/tree-updater";

import { DataProvider } from "../util";
import { dataPath } from "../wed-test-util";

const assert = chai.assert;
const expect = chai.expect;

// tslint:disable:no-any

const TEINS = `xmlns="http://www.tei-c.org/ns/1.0"`;

type EventNames = TreeUpdaterEvents["name"];
interface TreeUpdaterEventTest {
  name: EventNames;
  fn(ev: TreeUpdaterEvents): void;
}
type EventOrTest = TreeUpdaterEvents | TreeUpdaterEventTest;

describe("TreeUpdater", () => {
  let sourceXML: string;
  let parser: DOMParser;
  let doc: Document;
  let tu: TreeUpdater;

  before(async () => {
    const provider = new DataProvider(`${dataPath}/tree_updater_test_data/`);
    sourceXML = await provider.getText("source_converted.xml");

    parser = new DOMParser();
  });

  beforeEach(() => {
    doc = parser.parseFromString(sourceXML, "text/xml");
    new DLocRoot(doc);
    tu = new TreeUpdater(doc);
  });

  // tslint:disable-next-line:mocha-no-side-effect-code
  const CHANGED = { name: "Changed" as "Changed" };

  // tslint:disable-next-line:completed-docs
  class Listener {
    private expectedCounts: Record<EventNames, number> = {
      BeforeInsertNodeAt: 0,
      InsertNodeAt: 0,
      SetTextNodeValue: 0,
      BeforeDeleteNode: 0,
      DeleteNode: 0,
      SetAttributeNS: 0,
      Changed: 0,
      SetCommentValue: 0,
      SetPIBody: 0,
    };

    private _events: Record<EventNames, number> = {
      BeforeInsertNodeAt: 0,
      InsertNodeAt: 0,
      SetTextNodeValue: 0,
      BeforeDeleteNode: 0,
      DeleteNode: 0,
      SetAttributeNS: 0,
      Changed: 0,
      SetCommentValue: 0,
      SetPIBody: 0,
    };

    private expectIx: number = 0;

    constructor(updater: TreeUpdater,
                readonly expected: (EventOrTest)[]) {
      updater.events.subscribe((ev) => {
        const evName = ev.name;
        this._events[evName]++;
        const it = expected[this.expectIx++];
        if ((it as TreeUpdaterEventTest).fn != null) {
          const { name, fn } = it as TreeUpdaterEventTest;
          expect(ev).to.have.property("name").equal(name);
          fn(ev);
        }
        else {
          expect(ev).to.deep.equal(it);
        }
      });

      const { expectedCounts } = this;
      for (const { name } of expected) {
        expectedCounts[name]++;
      }
    }

    check(): void {
      for (const k of Object.keys(this.expectedCounts) as EventNames[]) {
        expect(this._events[k]).to.equal(this.expectedCounts[k],
                                         `number of events ${k}`);
      }

      for (const k of (Object.keys(this._events) as EventNames[])) {
        expect(this.expectedCounts[k], `unaccounted event ${k}`).to.not.be
          .undefined;
      }

      expect(this.expectIx).to.equal(this.expected.length);
    }
  }

  function flatten<T>(arr: T[][]): T[] {
    return arr.reduce((acc, curr) => acc.concat(curr), []);
  }

  function expandDeleteEvents(...abbrev: [Node, Node][]): EventOrTest[] {
    return flatten(abbrev.map(([node, parent]) => {
      return [{
        name: "BeforeDeleteNode" as "BeforeDeleteNode",
        fn(ev: TreeUpdaterEvents): void {
          expect(ev).to.have.property("node").equal(node);
          expect(ev).to.have.nested.property("node.parentNode").equal(parent);
        },
      }, CHANGED, {
        name: "DeleteNode" as "DeleteNode",
        fn(ev: TreeUpdaterEvents): void {
          expect(ev).to.have.property("node").equal(node);
          expect(ev).to.have.nested.property("node.parentNode").null;
          expect(ev).to.have.property("formerParent").equal(parent);
        },
      }, CHANGED];
    }));
  }

  function expandInsertEvents(...abbrev: [Node, number][]): EventOrTest[] {
    return flatten(abbrev.map(([parent, offset]) => {
      function fn(ev: TreeUpdaterEvents): void {
        expect(ev).to.have.property("parent").equal(parent);
        expect(ev).to.have.property("index").equal(offset);
      }

      return [{
        name: "BeforeInsertNodeAt" as "BeforeInsertNodeAt",
        fn,
      }, CHANGED, {
        name: "InsertNodeAt" as "InsertNodeAt",
        fn,
      }, CHANGED];
    }));
  }

  describe("insertNodeAt", () => {
    it("works with fragments", () => {
      const top = doc.getElementsByTagName("p")[0];
      const frag = doc.createDocumentFragment();
      const firstChild = doc.createElement("a");
      const secondChild = doc.createElement("b");
      frag.appendChild(firstChild);
      frag.appendChild(secondChild);
      const templates = [
        [top, 0, firstChild],
        [top, 1, secondChild],
      ] as [Node, number, Node][];
      const listener =
        new Listener(tu,
                     flatten(templates.map(([parent, index, node]) => [{
                       name: "BeforeInsertNodeAt" as "BeforeInsertNodeAt",
                       parent,
                       index,
                       node,
                     }, CHANGED, {
                       name: "InsertNodeAt" as "InsertNodeAt",
                       parent,
                       index,
                       node,
                     }, CHANGED])));

      tu.insertNodeAt(top, 0, frag);

      listener.check();

      expect(top).to.have.property("innerHTML").equal("<a/><b/>");
    });
  });

  describe("splitAt", () => {
    it("fails on node which is not child of the top", () => {
      const top = doc.getElementsByTagName("p")[0];
      const node = doc.getElementsByTagName("title")[0];
      expect(() => tu.splitAt(top, node, 0)).
        to.throw(Error, "split location is not inside top");
    });

    it("fails if splitting would denormalize an element", () => {
      const node = doc.getElementsByTagName("title")[0];
      expect(() => tu.splitAt(node.firstChild!, node.firstChild!, 2))
        .to.throw(Error, "splitAt called in a way that would result in two \
adjacent text nodes");
    });

    describe("splitting recursively", () => {
      it("one level of depth generates appropriate events", () => {
        const node = doc.getElementsByTagName("title")[0];
        const formerParent = node.parentNode!;

        const listener =
          new Listener(tu,
                       [...expandDeleteEvents([node, formerParent]),
                        ...expandInsertEvents(
                          // Insertion of a text node into <title>.
                          [formerParent, 0],
                          // Insertion of the completed 2nd half into the DOM
                          // tree.
                          [formerParent, 1])]);

        tu.splitAt(node, node.firstChild!, 2);

        // Check that we're doing what we think we're doing.
        assert.equal((formerParent.firstChild as HTMLElement).outerHTML,
                     `<title ${TEINS}>ab</title>`, "first half");
        assert.equal((formerParent.childNodes[1] as HTMLElement).outerHTML,
                     `<title ${TEINS}>cd</title>`, "second half");
        listener.check();
      });

      it("at multiple levels does the right work", () => {
        const node = doc.getElementsByTagName("quote")[0].firstChild!;
        const top = doc.getElementsByTagName("text")[0];
        const body = doc.getElementsByTagName("body")[0];
        // Drop the nodes from 3 onwards so that future additions don't change
        // this test.
        while (body.childNodes[3] !== undefined) {
          body.removeChild(body.childNodes[3]);
        }

        const pair = tu.splitAt(top, node, 3);

        const [firstText, nextText] = doc.getElementsByTagName("text");
        // Check that we're doing what we think we're doing.
        assert.equal(firstText.outerHTML,
                     `\
<text ${TEINS}><body><p>blah</p><p>before <quote>quo</quote></p></body></text>`,
                     "before");
        expect(pair[0]).to.equal(firstText);
        expect(pair[1]).to.equal(nextText);
        assert.equal(nextText.outerHTML,
                     `\
<text ${TEINS}><body><p><quote>ted</quote> between \
<quote>quoted2</quote> after</p>\
<p><quote>quoted</quote><quote>quoted2</quote><quote>quoted3</quote>\
</p></body></text>`, "after");
      });
    });

    it("does the right thing if spliting at end an element", () => {
      const top = doc.querySelector("body>p")!;
      const node = top.firstChild!;
      // Make sure we're looking at the right stuff.
      assert.equal(node.nodeValue!.length, 4);
      const pair = tu.splitAt(top, node, 4);
      assert.equal((pair[0] as HTMLElement).outerHTML, `<p ${TEINS}>blah</p>`);
      assert.equal((pair[1] as HTMLElement).outerHTML, `<p ${TEINS}/>`);
    });
  });

  describe("insertText", () => {
    it("generates appropriate events when it modifies a text node", () => {
      const node = doc.getElementsByTagName("title")[0].firstChild as Text;
      const listener = new Listener(tu, [{
        name: "SetTextNodeValue" as "SetTextNodeValue",
        node,
        value: "abQcd",
        oldValue: "abcd",
      }, CHANGED]);

      const { node: textNode, isNew, caret } = tu.insertText(node, 2, "Q");

      // Check that we're doing what we think we're doing.
      assert.equal(textNode, node);
      assert.isFalse(isNew);
      assert.equal(textNode!.nodeValue, "abQcd");
      assert.equal(caret.node, textNode);
      assert.equal(caret.offset, 3);
      listener.check();
    });

    function makeSeries(seriesTitle: string,
                        caretAtEnd: boolean,
                        adapter: (node: Node,
                                  offset: number,
                                  text: string) => TextInsertionResult)
    : void {
      describe(seriesTitle, () => {
        let title: Element;

        beforeEach(() => {
          title = doc.getElementsByTagName("title")[0];
        });

        describe("generates appropriate events when", () => {
          it("it uses the next text node", () => {
            const listener = new Listener(tu, [{
              name: "SetTextNodeValue" as "SetTextNodeValue",
              node: title.firstChild as Text,
              value: "Qabcd",
              oldValue: "abcd",
            }, CHANGED]);

            const { node: textNode, isNew, caret } = adapter(title, 0, "Q");

            // Check that we're doing what we think we're doing.
            assert.equal(textNode!, title.firstChild);
            assert.isFalse(isNew);
            assert.equal(textNode!.nodeValue, "Qabcd");
            assert.equal(caret.node, textNode);
            assert.equal(caret.offset, caretAtEnd ? 1 : 0);

            listener.check();
          });

          it("it uses the previous text node", () => {
            const listener = new Listener(tu, [{
              name: "SetTextNodeValue" as "SetTextNodeValue",
              node: title.firstChild as Text,
              value: "abcdQ",
              oldValue: "abcd",
            }, CHANGED]);

            const { node: textNode, isNew, caret } = adapter(title, 1, "Q");

            // Check that we're doing what we think we're doing.
            assert.equal(textNode!, title.firstChild);
            assert.isFalse(isNew);
            assert.equal(textNode!.nodeValue, "abcdQ");
            assert.equal(caret.node, textNode);
            assert.equal(caret.offset, caretAtEnd ? 5 : 4);

            listener.check();
          });

          it("it creates a text node", () => {
            // tslint:disable-next-line:no-inner-html
            title.innerHTML = "";

            function fn(ev: TreeUpdaterEvents): void {
              expect(ev).to.have.property("parent").equal(title);
              expect(ev).to.have.property("index").equal(0);
              expect(ev).to.have.nested.property("node.nodeValue")
                .equal("test");
            }

            const listener = new Listener(tu, [{
              name: "BeforeInsertNodeAt" as "BeforeInsertNodeAt",
              fn,
            }, CHANGED, {
              name: "InsertNodeAt" as "InsertNodeAt",
              fn,
            }, CHANGED]);

            const { node: textNode, isNew, caret } = adapter(title, 0, "test");

            // Check that we're doing what we think we're doing.
            assert.equal(textNode!, title.firstChild);
            assert.equal(textNode!.nodeValue, "test");
            assert.isTrue(isNew);
            assert.equal(caret.node, textNode);
            assert.equal(caret.offset, caretAtEnd ? 4 : 0);

            listener.check();
          });
        });

        it("does nothing if passed an empty string", () => {
          const listener = new Listener(tu, []);

          assert.equal(title.firstChild!.nodeValue, "abcd");
          const { node: textNode, isNew, caret } = adapter(title, 1, "");

          // Check that we're doing what we think we're doing.
          assert.equal(title.firstChild!.nodeValue, "abcd");
          assert.isUndefined(textNode);
          assert.isFalse(isNew);
          assert.equal(caret.node, title);
          assert.equal(caret.offset, 1);

          listener.check();
        });
      });
    }

    // tslint:disable-next-line:mocha-no-side-effect-code
    makeSeries("(caretAtEnd unspecified)",
               true,
               (node, offset, text) => tu.insertText(node, offset, text));
    // tslint:disable-next-line:mocha-no-side-effect-code
    makeSeries("(caretAtEnd true)",
               true,
               (node, offset, text) => tu.insertText(node, offset, text, true));
    // tslint:disable-next-line:mocha-no-side-effect-code
    makeSeries("(caretAtEnd false)",
               false,
               (node, offset, text) =>
               tu.insertText(node, offset, text, false));
  });

  describe("deleteText", () => {
    let text: Text;

    beforeEach(() => {
      text = doc.getElementsByTagName("title")[0].firstChild as Text;
    });

    it("fails on non-text node", () => {
      expect(() => {
        tu.deleteText(text.parentNode as any, 0, 1);
      }).to.throw(Error, "deleteText called on non-text");
    });

    describe("generates appropriate events when", () => {
      it("it modifies a text node", () => {
        const listener = new Listener(tu, [{
          name: "SetTextNodeValue" as "SetTextNodeValue",
          node: text,
          value: "ab",
          oldValue: "abcd",
        }, CHANGED]);
        tu.deleteText(text, 2, 2);

        // Check that we're doing what we think we're doing.
        assert.equal(text.nodeValue, "ab");
        listener.check();
      });

      it("it deletes an empty text node", () => {
        const listener =
          new Listener(tu, expandDeleteEvents([text, text.parentNode!]));

        tu.deleteText(text, 0, 4);
        // Check that we're doing what we think we're doing.
        assert.isNull(text.parentNode);
        listener.check();
      });
    });
  });

  describe("setAttribute", () => {
    let title: Element;

    beforeEach(() => {
      title = doc.getElementsByTagName("title")[0];
    });

    it("fails on non-element node", () => {
      expect(() => {
        tu.setAttribute(title.firstChild as Element, "q", "ab");
      }).to.throw(Error, "setAttribute called on non-element");
    });

    it("generates appropriate events when changing an attribute", () => {
      // Check that the attribute is not set yet.
      assert.equal(title.getAttribute("q"), undefined);

      const listener = new Listener(tu, [{
        name: "SetAttributeNS" as "SetAttributeNS",
        node: title,
        ns: "",
        attribute: "q",
        oldValue: null,
        newValue: "ab",
      }, CHANGED]);

      tu.setAttribute(title, "q", "ab");

      // Check that we're doing what we think we're doing.
      assert.equal(title.getAttribute("q"), "ab");
      listener.check();
    });

    it("generates appropriate events when removing an attribute", () => {
      // Set the attribute
      title.setAttribute("q", "ab");

      const listener = new Listener(tu, [{
        name: "SetAttributeNS" as "SetAttributeNS",
        node: title,
        ns: "",
        attribute: "q",
        oldValue: "ab",
        newValue: null,
      }, CHANGED]);

      tu.setAttribute(title, "q", null);

      assert.equal(title.getAttribute("q"), undefined, "value after");
      listener.check();
    });
  });

  describe("insertIntoText", () => {
    let text: Text;

    beforeEach(() => {
      text = doc.getElementsByTagName("title")[0].firstChild as Text;
    });

    it("fails on non-text node", () => {
      expect(() => tu.insertIntoText(text.parentNode as any, 0, text))
        .to.throw(Error, "insertIntoText called on non-text");
    });

    it("fails on undefined node to insert", () => {
      expect(() => tu.insertIntoText(text, 0, undefined as any))
        .to.throw(Error, "must pass an actual node to insert");
    });

    it("generates appropriate events when inserting a new element", () => {
      const parent = text.parentNode!;
      const el = doc.createElement("span");
      const listener = new Listener(tu,
                                    [...expandDeleteEvents([text, parent]),
                                     ...expandInsertEvents([parent, 0],
                                                           [parent, 1],
                                                           [parent, 2])]);

      const [first, second] = tu.insertIntoText(text, 2, el);

      // Check that we're doing what we think we're doing.
      assert.equal(first.node.nodeValue, "ab");
      assert.equal(first.node.nextSibling, el);
      assert.equal(first.offset, 2);
      assert.equal(second.node.nodeValue, "cd");
      assert.equal(second.node.previousSibling, el);
      assert.equal(second.offset, 0);
      assert.equal(parent.childNodes.length, 3);
      assert.equal(parent.childNodes[1], el);

      listener.check();
    });

    it("works fine with negative offset", () => {
      const parent = text.parentNode!;
      const el = document.createElement("span");

      const listener = new Listener(tu, [...expandDeleteEvents([text, parent]),
                                         ...expandInsertEvents([parent, 0],
                                                               [parent, 1])]);

      const [first, second] = tu.insertIntoText(text, -1, el);

      // Check that we're doing what we think we're doing.
      assert.equal(first.node, parent);
      assert.equal(first.offset, 0);
      assert.equal(second.node.nodeValue, "abcd");
      assert.equal(second.node.previousSibling, el);
      assert.equal(parent.childNodes.length, 2);

      listener.check();
    });

    it("works fine with offset beyond text length", () => {
      const parent = text.parentNode!;
      const el = document.createElement("span");

      const listener = new Listener(tu, [...expandDeleteEvents([text, parent]),
                                         ...expandInsertEvents([parent, 0],
                                                               [parent, 1])]);

      const [first, second] = tu.insertIntoText(text, text.length, el);

      // Check that we're doing what we think we're doing.
      assert.equal(first.node.nodeValue, "abcd");
      assert.equal(first.node.nextSibling, el);
      assert.equal(second.node, parent);
      assert.equal(second.offset, 2);
      assert.equal(parent.childNodes.length, 2);
      listener.check();
    });
  });

  describe("setTextNodeValue", () => {
    let text: Text;

    beforeEach(() => {
      text = doc.getElementsByTagName("title")[0].firstChild as Text;
    });

    it("fails on non-text node", () => {
      expect(() => {
        tu.setTextNode(text.parentNode as any, "test");
      }).to.throw(Error, "setTextNode called on non-text");
    });

    describe("generates appropriate events when", () => {
      it("setting text", () => {
        const listener = new Listener(tu, [{
          name: "SetTextNodeValue" as "SetTextNodeValue",
          node: text,
          value: "test",
          oldValue: "abcd",
        }, CHANGED]);

        assert.equal(text.data, "abcd");
        tu.setTextNode(text, "test");

        // Check that we're doing what we think we're doing.
        assert.equal(text.data, "test");
        listener.check();
      });

      it("setting text to an empty string", () => {
        const listener =
          new Listener(tu, [...expandDeleteEvents([text, text.parentNode!])]);

        assert.equal(text.data, "abcd");
        tu.setTextNode(text, "");

        // Check that we're doing what we think we're doing.
        assert.isNull(text.parentNode);
        listener.check();
      });
    });
  });

  describe("removeNode", () => {
    it("generates appropriate events when removing a node", () => {
      const node = doc.querySelectorAll("body>p")[2]
        .querySelectorAll("quote")[1];
      const parent = node.parentNode as HTMLElement;
      assert.equal(parent.childNodes.length, 3);
      const listener = new Listener(tu, expandDeleteEvents([node, parent]));
      tu.removeNode(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.outerHTML,
                   `<p ${TEINS}><quote>quoted</quote><quote>quoted3</quote>\
</p>`);

      assert.equal(parent.childNodes.length, 2);
      listener.check();
    });

    it("generates appropriate events when merging text", () => {
      const node = doc.querySelectorAll("body>p")[1].querySelector("quote")!;
      const parent = node.parentNode as HTMLElement;
      const prev = node.previousSibling;
      const next = node.nextSibling!;
      assert.equal(parent.childNodes.length, 5);
      const listener =
        new Listener(tu, [
          ...expandDeleteEvents([node, parent]), {
            name: "SetTextNodeValue" as "SetTextNodeValue",
            node: prev as Text,
            value: "before  between ",
            oldValue: "before ",
          }, CHANGED,
          ...expandDeleteEvents([next, parent]),
        ]);

      tu.removeNode(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 3);
      assert.equal(parent.outerHTML, `\
<p ${TEINS}>before  between <quote>quoted2</quote> after</p>`);
      listener.check();
    });

    it("does not bork on missing previous text", () => {
      // An earlier bug would cause an unhandled exception on this test.
      const node = doc.querySelectorAll("body>p")[2].querySelector("quote")!;
      const parent = node.parentNode;
      const ret = tu.removeNode(node);
      assert.equal(ret.node, parent);
      assert.equal(ret.offset, 0);
    });
  });

  describe("removeNodeNF", () => {
    it("generates appropriate events when removing a node", () => {
      const node = doc.querySelectorAll("body>p")[2]
        .querySelectorAll("quote")[1];
      const parent = node.parentNode as HTMLElement;
      assert.equal(parent.childNodes.length, 3);
      const listener = new Listener(tu, expandDeleteEvents([node, parent]));

      tu.removeNodeNF(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.outerHTML, `\
<p ${TEINS}><quote>quoted</quote><quote>quoted3</quote></p>`);

      assert.equal(parent.childNodes.length, 2);
      listener.check();
    });

    it("generates appropriate events when merging text", () => {
      const node = doc.querySelectorAll("body>p")[1].querySelector("quote")!;
      const parent = node.parentNode as HTMLElement;
      const prev = node.previousSibling;
      const next = node.nextSibling!;
      assert.equal(parent.childNodes.length, 5);
      const listener =
        new Listener(tu, [
          ...expandDeleteEvents([node, parent]), {
            name: "SetTextNodeValue" as "SetTextNodeValue",
            node: prev as Text,
            value: "before  between ",
            oldValue: "before ",
          }, CHANGED,
          ...expandDeleteEvents([next, parent]),
        ]);

      tu.removeNodeNF(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 3);
      assert.equal(parent.outerHTML, `\
<p ${TEINS}>before  between <quote>quoted2</quote> after</p>`);
      listener.check();
    });

    it("does not bork on missing previous text", () => {
      // An earlier bug would cause an unhandled exception on this
      // test.
      const node = doc.querySelectorAll("body>p")[2].querySelector("quote")!;
      const parent = node.parentNode;
      const ret = tu.removeNodeNF(node)!;
      assert.equal(ret.node, parent);
      assert.equal(ret.offset, 0);
    });

    it("generates no events if the node is undefined", () => {
      const listener = new Listener(tu, []);
      const initialHTML = doc.documentElement.outerHTML;

      assert.isUndefined(tu.removeNodeNF(undefined));

      // Check that nothing changed.
      assert.equal(doc.documentElement.outerHTML, initialHTML);
      listener.check();
    });

    it("generates no events if the node is null", () => {
      const listener = new Listener(tu, []);
      const initialHTML = doc.documentElement.outerHTML;

      assert.isUndefined(tu.removeNodeNF(null));

      // Check that nothing changed.
      assert.equal(doc.documentElement.outerHTML, initialHTML);
      listener.check();
    });
  });

  describe("removeNodes", () => {
    it("fails on nodes of different parents", () => {
      // An earlier bug would cause an unhandled exception on this
      // test.
      const node = doc.querySelectorAll("body>p")[2].querySelector("quote")!;
      expect(() => tu.removeNodes([node, node.parentNode!]))
        .to.throw(Error,
                  "nodes are not immediately contiguous in document order");
    });

    it("generates appropriate events when merging text", () => {
      const p = doc.querySelectorAll("body>p")[1];
      const quotes = p.querySelectorAll("quote");
      const firstNode = quotes[0];
      const lastNode = quotes[quotes.length - 1];
      const nodes = Array.prototype.slice.call(
        p.childNodes,
        indexOf(p.childNodes, firstNode),
        indexOf(p.childNodes, lastNode) + 1) as Node[];
      const parent = firstNode.parentNode as HTMLElement;
      const prev = firstNode.previousSibling;
      const next = lastNode.nextSibling!;
      assert.equal(parent.childNodes.length, 5);

      const listener = new Listener(tu, [
        ...expandDeleteEvents(...nodes
                              .map((node): [Node, Node] => [node,  p])), {
                                name: "SetTextNodeValue" as "SetTextNodeValue",
                                node: prev as Text,
                                value: "before  after",
                                oldValue: "before ",
                              }, CHANGED,
        ...expandDeleteEvents([next, next.parentNode!]),
      ]);

      tu.removeNodes(nodes);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 1);
      assert.equal(parent.outerHTML, `<p ${TEINS}>before  after</p>`);
      listener.check();
    });

    it("does not bork on missing previous text", () => {
      // An earlier bug would cause an unhandled exception on this
      // test.
      const node = doc.querySelectorAll("body>p")[2].querySelector("quote")!;
      const parent = node.parentNode;
      const ret = tu.removeNodes([node])!;
      assert.equal(ret.node, parent);
      assert.equal(ret.offset, 0);
    });
  });

  describe("mergeTextNodes", () => {
    it("generates appropriate events when merging text", () => {
      const p = doc.querySelectorAll("body>p")[1];
      // Remove the first quote so that we have two text nodes adjacent.
      const quote = p.getElementsByTagName("quote")[0];
      p.removeChild(quote);
      const node = p.firstChild!;
      const parent = node.parentNode as HTMLElement;
      const next = node.nextSibling!;
      assert.equal(parent.childNodes.length, 4);
      const listener = new Listener(tu, [{
        name: "SetTextNodeValue" as "SetTextNodeValue",
        node: node as Text,
        value: "before  between ",
        oldValue: "before ",
      }, CHANGED, ...expandDeleteEvents([next, parent])]);

      tu.mergeTextNodes(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 3);
      assert.equal(parent.outerHTML, `\
<p ${TEINS}>before  between <quote>quoted2</quote> after</p>`);
      listener.check();
    });

    it("does nothing if there is nothing to do", () => {
      const p = doc.querySelectorAll("body>p")[1];
      const node = p.firstChild!;
      const parent = node.parentNode as HTMLElement;
      assert.equal(parent.childNodes.length, 5);

      const listener = new Listener(tu, []);
      tu.mergeTextNodes(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 5);
      assert.equal(parent.outerHTML, `\
<p ${TEINS}>before <quote>quoted</quote> between <quote>quoted2</quote> \
after</p>`);
      listener.check();
    });

    it("returns a proper caret value when it merges", () => {
      const p = doc.querySelectorAll("body>p")[1];
      // Remove the first quote so that we have two text nodes adjacent.
      const quote = p.getElementsByTagName("quote")[0];
      p.removeChild(quote);
      const node = p.firstChild!;
      const parent = node.parentNode as HTMLElement;
      assert.equal(parent.childNodes.length, 4);
      const ret = tu.mergeTextNodes(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 3);
      assert.equal(parent.outerHTML,
                   `<p ${TEINS}>before  between <quote>quoted2</quote> \
after</p>`);

      // Check return value.
      assert.equal(ret.node, node);
      assert.equal(ret.offset, 7);
    });

    it("returns a proper caret value when it does nothing", () => {
      const p = doc.querySelectorAll("body>p")[1];
      const node = p.firstChild!;
      const parent = node.parentNode as HTMLElement;
      assert.equal(parent.childNodes.length, 5);

      const listener = new Listener(tu, []);
      const ret = tu.mergeTextNodes(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 5);
      assert.equal(parent.outerHTML, `\
<p ${TEINS}>before <quote>quoted</quote> between <quote>quoted2</quote> \
after</p>`);
      listener.check();

      // Check the return value.
      assert.equal(ret.node, parent);
      assert.equal(ret.offset, indexOf(parent.childNodes, node) + 1);
    });
  });

  describe("mergeTextNodesNF", () => {
    it("generates appropriate events when merging text", () => {
      const p = doc.querySelectorAll("body>p")[1];
      // Remove the first quote so that we have two text nodes adjacent.
      const quote = p.getElementsByTagName("quote")[0];
      p.removeChild(quote);
      const node = p.firstChild!;
      const parent = node.parentNode as HTMLElement;
      const next = node.nextSibling!;
      assert.equal(parent.childNodes.length, 4);
      const listener = new Listener(tu, [{
        name: "SetTextNodeValue" as "SetTextNodeValue",
        node: node as Text,
        value: "before  between ",
        oldValue: "before ",
      }, CHANGED, ...expandDeleteEvents([next, parent])]);

      tu.mergeTextNodesNF(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 3);
      assert.equal(parent.outerHTML, `\
<p ${TEINS}>before  between <quote>quoted2</quote> after</p>`);
      listener.check();
    });

    it("does nothing if there is nothing to do", () => {
      const p = doc.querySelectorAll("body>p")[1];
      const node = p.firstChild!;
      const parent = node.parentNode as HTMLElement;
      assert.equal(parent.childNodes.length, 5);

      const listener = new Listener(tu, []);
      tu.mergeTextNodesNF(node);

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 5);
      assert.equal(parent.outerHTML, `\
<p ${TEINS}>before <quote>quoted</quote> between <quote>quoted2</quote> \
after</p>`);
      listener.check();
    });

    it("returns a proper caret value when it merges", () => {
      const p = doc.querySelectorAll("body>p")[1];
      // Remove the first quote so that we have two text nodes adjacent.
      const quote = p.getElementsByTagName("quote")[0];
      p.removeChild(quote);
      const node = p.firstChild!;
      const parent = node.parentNode as HTMLElement;
      assert.equal(parent.childNodes.length, 4);
      const ret = tu.mergeTextNodesNF(node)!;

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 3);
      assert.equal(parent.outerHTML, `\
<p ${TEINS}>before  between <quote>quoted2</quote> after</p>`);

      // Check return value.
      assert.equal(ret.node, node);
      assert.equal(ret.offset, 7);
    });

    it("returns a proper caret value when it does nothing", () => {
      const p = doc.querySelectorAll("body>p")[1];
      const node = p.firstChild!;
      const parent = node.parentNode as HTMLElement;
      assert.equal(parent.childNodes.length, 5);

      const listener = new Listener(tu, []);
      const ret = tu.mergeTextNodesNF(node)!;

      // Check that we're doing what we think we're doing.
      assert.equal(parent.childNodes.length, 5);
      assert.equal(parent.outerHTML, `\
<p ${TEINS}>before <quote>quoted</quote> between <quote>quoted2</quote> \
after</p>`);
      listener.check();

      // Check the return value.
      assert.equal(ret.node, parent);
      assert.equal(ret.offset, indexOf(parent.childNodes, node) + 1);
    });

    it("generates no events if the node is undefined", () => {
      const listener = new Listener(tu, []);
      const initialHTML = doc.documentElement.outerHTML;

      assert.isUndefined(tu.removeNodeNF(undefined));

      // Check that nothing changed.
      assert.equal(doc.documentElement.outerHTML, initialHTML);
      listener.check();
    });

    it("generates no events if the node is null", () => {
      const listener = new Listener(tu, []);
      const initialHTML = doc.documentElement.outerHTML;

      assert.isUndefined(tu.mergeTextNodesNF(null));

      // Check that nothing changed.
      assert.equal(doc.documentElement.outerHTML, initialHTML);
      listener.check();
    });
  });

  describe("setCommentValue", () => {
    it("generates appropriate events", () => {
      const p = doc.querySelectorAll("body>p")[4];
      const comment = p.childNodes[1] as Comment;
      const originalLength = p.childNodes.length;
      expect(comment).to.have.property("nodeType").equal(Node.COMMENT_NODE);
      const listener = new Listener(tu, [{
        name: "SetCommentValue" as "SetCommentValue",
        node: comment,
        value: "foo",
        oldValue: " a comment ",
      }, CHANGED]);

      tu.setCommentValue(comment, "foo");

      // Check that we're doing what we think we're doing.
      expect(p.childNodes).to.be.lengthOf(originalLength);
      expect(comment.data).to.equal("foo");
      expect(comment).to.have.property("parentNode").equal(p);
      listener.check();
    });
  });

  describe("setPIBody", () => {
    it("generates appropriate events", () => {
      const p = doc.querySelectorAll("body>p")[4];
      const pi = p.childNodes[3] as ProcessingInstruction;
      const originalLength = p.childNodes.length;
      expect(pi).to.have.property("nodeType")
        .equal(Node.PROCESSING_INSTRUCTION_NODE);
      const listener = new Listener(tu, [{
        name: "SetPIBody" as "SetPIBody",
        node: pi,
        value: "foo",
        oldValue: "body",
      }, CHANGED]);

      tu.setPIBody(pi, "foo");

      // Check that we're doing what we think we're doing.
      expect(p.childNodes).to.be.lengthOf(originalLength);
      expect(pi.data).to.equal("foo");
      expect(pi).to.have.property("parentNode").equal(p);
      listener.check();
    });
  });

  describe("cut", () => {
    function checkNodes(ret: Node[], expected: Node[]): void {
      assert.equal(ret.length, expected.length, "result length");
      for (let i = 0; i < expected.length; ++i) {
        const node = expected[i];
        const actual = ret[i];
        const actualType = actual.nodeType;
        assert.equal(actualType, node.nodeType);
        switch (actualType) {
          case Node.TEXT_NODE:
            assert.equal(actual.nodeValue, node.nodeValue, `text node at ${i}`);
            break;
          case Node.ELEMENT_NODE:
            assert.equal((actual as HTMLElement).outerHTML,
                         (node as HTMLElement).outerHTML,
                         `element node at ${i}`);
            break;
          default:
            expect.fail(`actual node type is not text or element; \
got ${actualType}`);
        }
      }
    }

    it("generates appropriate events when merging text", () => {
      const p = doc.querySelectorAll("body>p")[1];
      const start = DLoc.mustMakeDLoc(doc, p.firstChild, 4);
      const end = DLoc.mustMakeDLoc(doc, p.childNodes[4], 3);
      assert.equal(p.childNodes.length, 5);

      const nodes = Array.prototype.slice.call(
        p.childNodes,
        indexOf(p.childNodes, start.node.nextSibling!),
        indexOf(p.childNodes, end.node.previousSibling!) + 1);
      const listener = new Listener(tu, [{
        name: "SetTextNodeValue" as "SetTextNodeValue",
        node: start.node as Text,
        value: "befo",
        oldValue: "before ",
      }, CHANGED, {
        name: "SetTextNodeValue" as "SetTextNodeValue",
        node: end.node as Text,
        value: "ter",
        oldValue: " after",
      }, CHANGED, ...expandDeleteEvents(
        ...nodes.map((node): [Node, Node] => [node, p])), {
          name: "SetTextNodeValue" as "SetTextNodeValue",
          node: start.node as Text,
          value: "befoter",
          oldValue: "befo",
        }, CHANGED, ...expandDeleteEvents([end.node, end.node.parentNode!])]);

      tu.cut(start, end);

      // Check that we're doing what we think we're doing.
      assert.equal(p.childNodes.length, 1);
      assert.equal(p.outerHTML, `<p ${TEINS}>befoter</p>`);
      listener.check();
    });

    it("returns proper nodes when merging a single node", () => {
      const p = doc.querySelectorAll("body>p")[1];
      const start = DLoc.mustMakeDLoc(doc, p.firstChild, 4);
      const end = DLoc.mustMakeDLoc(doc, p.firstChild, 6);
      assert.equal(p.childNodes.length, 5);

      const nodes = [p.ownerDocument!.createTextNode("re")];
      const [caret, removed] = tu.cut(start, end);

      // Check that we're doing what we think we're doing.
      assert.equal(p.childNodes.length, 5);
      assert.equal(p.firstChild!.nodeValue, "befo ");

      checkNodes(removed, nodes);
      assert.equal(caret.node, p.firstChild);
      assert.equal(caret.offset, 4);
    });

    it("returns proper nodes when merging text", () => {
      const p = doc.querySelectorAll("body>p")[1];
      const start = DLoc.mustMakeDLoc(doc, p.firstChild, 4);
      const end = DLoc.mustMakeDLoc(doc, p.childNodes[4], 3);
      assert.equal(p.childNodes.length, 5);

      const nodes = Array.prototype.slice.call(
        p.childNodes,
        indexOf(p.childNodes, start.node.nextSibling!),
        indexOf(p.childNodes, end.node.previousSibling!) + 1);
      nodes.unshift(p.ownerDocument!.createTextNode("re "));
      nodes.push(p.ownerDocument!.createTextNode(" af"));

      const [caret, removed] = tu.cut(start, end);

      // Check that we're doing what we think we're doing.
      assert.equal(p.childNodes.length, 1);
      assert.equal(p.outerHTML, `<p ${TEINS}>befoter</p>`);

      checkNodes(removed, nodes);
      assert.equal(caret.node, p.firstChild);
      assert.equal(caret.offset, 4);
    });

    it("empties an element without problem", () => {
      const p = doc.querySelectorAll("body>p")[1];
      const start = DLoc.mustMakeDLoc(doc, p, 0);
      const end = DLoc.mustMakeDLoc(doc, p, p.childNodes.length);
      assert.equal(p.childNodes.length, 5);

      const nodes = Array.from(p.childNodes);
      const [caret, removed] = tu.cut(start, end);

      // Check that we're doing what we think we're doing.
      assert.equal(p.childNodes.length, 0);

      // Check the caret position.
      assert.equal(caret.node, p);
      assert.equal(caret.offset, 0);
      // Check that the nodes are those we expected.
      checkNodes(removed, nodes);
    });
  });
});

//  LocalWords:  domroot concat DOM html previousSibling nextSibling
//  LocalWords:  prev abcd jQuery cd Dubeau MPL Mangalam RequireJS
//  LocalWords:  mergeTextNodes removeNodes unhandled removeNode chai
//  LocalWords:  insertIntoText deleteText setTextNodeValue onwards
//  LocalWords:  insertText deleteNode denormalize splitAt jquery
//  LocalWords:  insertNodeAt TreeUpdater
