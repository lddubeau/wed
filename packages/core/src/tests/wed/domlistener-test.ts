/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import $ from "jquery";

import * as dloc from "wed/dloc";
import { DOMListener, EventHandler, ExcludedElementEvent, ExcludingElementEvent,
         IncludedElementEvent } from "wed/domlistener";
import { indexOf } from "wed/domutil";
import { TreeUpdater } from "wed/tree-updater";

const assert = chai.assert;

// tslint:disable-next-line:completed-docs
class Mark {
  private count: number = 0;
  private readonly counts: Record<string, number> = Object.create(null);

  constructor(private readonly totalExpected: number,
              private readonly countsExpected: Record<string, number>,
              readonly listener: DOMListener,
              private readonly done: () => void) {}

  check(): void {
    // We iterate so that we can get a precise error message.
    for (const k of Object.keys(this.countsExpected)) {
      assert.equal(this.counts[k], this.countsExpected[k], `count for ${k}`);
    }

    for (const k of Object.keys(this.counts)) {
      assert.equal(this.counts[k], this.countsExpected[k]);
    }

    assert.equal(this.count, this.totalExpected, "total mark count");
    this.done();
  }

  mark(label: string): void {
    if (this.counts[label] === undefined) {
      this.counts[label] = 0;
    }

    this.counts[label]++;

    this.count++;
  }
}

describe("domlistener", () => {
  let domroot: HTMLElement;
  let root: HTMLElement;
  let $root: JQuery;
  let fragmentToAdd: Element;
  let listener: DOMListener;
  let treeUpdater: TreeUpdater;
  let mark: Mark;
  let marker: HTMLElement;

  before(() => {
    // This is a fake element we add to the root to know when we've seen
    // everything we care about.
    marker = document.createElement("div");
    marker.className = "_real _marker";

    domroot = document.createElement("div");
    document.body.appendChild(domroot);
  });

  after(() => {
    document.body.removeChild(domroot);
  });

  beforeEach(() => {
    // Create a new fragment each time.
    // tslint:disable-next-line:no-jquery-raw-elements
    fragmentToAdd = $("<div class='_real ul'><div class='_real li'>A</div>\
<div class='_real li'>B</div></div>")[0];
    // tslint:disable-next-line:no-inner-html
    domroot.innerHTML = "";
    root = document.createElement("div");
    domroot.appendChild(root);
    new dloc.DLocRoot(root);
    $root = $(root);
    treeUpdater = new TreeUpdater(root);
    listener = new DOMListener(root, treeUpdater);
  });

  afterEach(() => {
    listener.stopListening();
  });

  function makeIncludedHandler(name: string, expectedTree: Element):
  EventHandler<IncludedElementEvent> {
    return ({ root: thisRoot, tree, element }) => {
      assert.equal(thisRoot, root);
      assert.equal(element.className, `_real ${name}`);
      assert.equal(tree, expectedTree);
      mark.mark(`included ${name}`);
    };
  }

  function makeExcludedHandler(name: string, expectedTree: Element,
                               expectedParent: Element):
  EventHandler<ExcludedElementEvent> {
    return ({ root: thisRoot, tree, parent, element }) => {
      assert.equal(thisRoot, root);
      assert.equal(element.className, `_real ${name}`);
      assert.equal(tree, expectedTree);
      assert.equal(parent, expectedParent);
      mark.mark(`excluded ${name}`);
    };
  }

  function makeExcludingHandler(name: string, expectedTree: Element):
  EventHandler<ExcludingElementEvent> {
    return ({ root: thisRoot, tree, element }) => {
      assert.equal(thisRoot, root);
      assert.equal(element.className, `_real ${name}`);
      assert.equal(tree, expectedTree);
      mark.mark(`excluding ${name}`);
    };
  }

  it("fires included-element, added-element and added-child when " +
     "adding a fragment", done => {
       mark = new Mark(5, {
         "included ul": 1,
         "added ul": 1,
         "children root": 1,
         "included li": 2,
       }, listener, done);
       listener.addHandler("included-element", "._real.ul",
                           makeIncludedHandler("ul", fragmentToAdd));
       listener.addHandler("included-element", "._real.li",
                           makeIncludedHandler("li", fragmentToAdd));
       listener.addHandler("added-element", "._real.ul",
                           ({ root: thisRoot, element }) => {
                              assert.equal(thisRoot, root);
                              assert.equal(element, fragmentToAdd);
                              mark.mark("added ul");
                           });
       listener.addHandler("added-child", "*",
                           ({ root: thisRoot, child }) => {
                             // The marker will also trigger this
                             // handler. Ignore it.
                             if (child === marker) {
                               return;
                             }
                             assert.equal(thisRoot, root);
                             assert.equal(child, fragmentToAdd);
                             mark.mark("children root");
                           });
       listener.startListening();
       treeUpdater.insertNodeAt(root, root.childNodes.length, fragmentToAdd);
       mark.check();
     });

  it("fires excluding-element, excluded-element, removing-element, " +
     "removed-element, removing-child and removed-child when " +
     "removing a fragment", done => {
       root.appendChild(fragmentToAdd);
       mark = new Mark(10, {
         "excluding ul": 1,
         "excluded ul": 1,
         "removing ul": 1,
         "removed ul": 1,
         "removing-child root": 1,
         "removed-child root": 1,
         "excluding li": 2,
         "excluded li": 2,
       }, listener, done);
       listener.addHandler("excluding-element", "._real.ul",
                           makeExcludingHandler("ul", fragmentToAdd));
       listener.addHandler("excluded-element", "._real.ul",
                           makeExcludedHandler("ul", fragmentToAdd, root));
       listener.addHandler("excluding-element", "._real.li",
                           makeExcludingHandler("li", fragmentToAdd));
       listener.addHandler("excluded-element", "._real.li",
                           makeExcludedHandler("li", fragmentToAdd, root));

       listener.addHandler("removing-element", "._real.ul",
                           ({ root: thisRoot, element }) => {
                             assert.equal(thisRoot, root);
                             assert.equal(element, fragmentToAdd);
                             mark.mark("removing ul");
                           });

       listener.addHandler("removed-element", "._real.ul",
                           ({ root: thisRoot, parent, element }) => {
                             assert.equal(thisRoot, root);
                             assert.equal(thisRoot, parent);
                             assert.equal(element, fragmentToAdd);
                             mark.mark("removed ul");
                           });

       listener.addHandler("removing-child", "*",
                           ({ root: thisRoot, child }) => {
                             // The marker will also trigger this
                             // handler. Ignore it.
                             if (child === marker) {
                               return;
                             }
                             assert.equal(thisRoot, root);
                             assert.equal(child, fragmentToAdd);
                             mark.mark("removing-child root");
                           });

       listener.addHandler("removed-child", "*",
                           ({ root: thisRoot, parent, child }) => {
                             // The marker will also trigger this
                             // handler. Ignore it.
                             if (child === marker) {
                               return;
                             }
                             assert.equal(thisRoot, root);
                             assert.equal(parent, root);
                             assert.equal(child, fragmentToAdd);
                             mark.mark("removed-child root");
                           });
       listener.startListening();
       treeUpdater.deleteNode(fragmentToAdd);
       mark.check();
     });

  it("trigger triggered twice, invoked once", done => {
    mark = new Mark(3, { "triggered test": 1, "included li": 2 },
                    listener, done);
    listener.addHandler("trigger", "test", ({ root: thisRoot }) => {
      assert.equal(thisRoot, root);
      mark.mark("triggered test");
    });
    listener.addHandler("included-element", "._real.li",
                        ({ root: thisRoot, element }) => {
                          assert.equal(thisRoot, root);
                          assert.equal(element.className, "_real li");
                          listener.trigger("test");
                          mark.mark("included li");
                        });
    listener.startListening();
    treeUpdater.insertNodeAt(root, root.childNodes.length, fragmentToAdd);
    // We have to allow for triggers to run.
    window.setTimeout(() => {
      mark.check();
    }, 0);
  });

  it("trigger triggering a trigger", done => {
    mark = new Mark(4, {
      "triggered test": 1,
      "triggered test2": 1,
      "included li": 2,
    }, listener, done);
    listener.addHandler("trigger", "test", ({ root: thisRoot }) => {
      assert.equal(thisRoot, root);
      listener.trigger("test2");
      mark.mark("triggered test");
    });
    listener.addHandler("trigger", "test2", ({ root: thisRoot }) => {
      assert.equal(thisRoot, root);
      mark.mark("triggered test2");
    });

    listener.addHandler("included-element", "._real.li",
                        ({ root: thisRoot, element }) => {
                          assert.equal(thisRoot, root);
                          assert.equal(element.className, "_real li");
                          listener.trigger("test");
                          mark.mark("included li");
                        });
    listener.startListening();
    treeUpdater.insertNodeAt(root, root.childNodes.length, fragmentToAdd);
    // We have to allow for triggers to run.
    window.setTimeout(() => {
      mark.check();
    }, 0);
  });

  it("fires text-changed when changing a text node", done => {
    mark = new Mark(1, { "text-changed": 1 }, listener, done);
    listener.addHandler(
      "text-changed", "._real.li", ({ root: thisRoot, node, oldValue }) => {
        assert.equal(thisRoot, root);
        assert.equal((node.parentNode as Element).className, "_real li");
        assert.equal(node.nodeValue, "Q");
        assert.equal(oldValue, "A");
        mark.mark("text-changed");
      });
    root.appendChild(fragmentToAdd);
    listener.startListening();
    treeUpdater.setTextNodeValue(
      root.querySelector("._real.li")!.firstChild as Text, "Q");
    mark.check();
  });

  it("fires added-child when adding a text node", done => {
    // The handler is called twice. Once when the single text node which was
    // already there is removed. Once when the new text node is added.

    mark = new Mark(1, { "children li": 1 }, listener, done);
    listener.addHandler(
      "added-child", "._real.li",
      ({ root: thisRoot, child }) => {
        // The marker will also trigger this handler. Ignore it.
        if (child === marker) {
          return;
        }
        assert.equal(thisRoot, root);
        assert.equal(child.nodeValue, "Q");
        mark.mark("children li");
      });
    root.appendChild(fragmentToAdd);
    listener.startListening();
    const li = root.querySelector("._real.li")!;
    // We'll simulate what jQuery does: remove the text node and add a new one.
    treeUpdater.deleteNode(li.firstChild!);
    treeUpdater.insertText(li, 0, "Q");
    mark.check();
  });

  it("fires attribute-changed when changing an attribute", done => {
    mark = new Mark(1, { "attribute-changed": 1 }, listener, done);
    listener.addHandler(
      "attribute-changed", "._real.li",
      ({ root: thisRoot, element, ns, attrName, oldValue }) => {
        assert.equal(thisRoot, root);
        assert.equal(element.className, "_real li");
        // tslint:disable-next-line:no-http-string
        assert.equal(ns, "http://foo.foo/foo");
        assert.equal(attrName, "X");
        assert.equal(oldValue, null);
        mark.mark("attribute-changed");
      });
    root.appendChild(fragmentToAdd);
    listener.startListening();
    treeUpdater.setAttributeNS(
      // tslint:disable-next-line:no-http-string
      root.querySelector("._real.li")!, "http://foo.foo/foo", "X", "ttt");
    mark.check();
  });

  it("fires attribute-changed when deleting an attribute", done => {
    mark = new Mark(1, { "attribute-changed": 1 }, listener, done);
    listener.addHandler(
      "attribute-changed", "._real.li",
      ({ root: thisRoot, element, ns, attrName, oldValue }) => {
        assert.equal(thisRoot, root);
        assert.equal(element.className, "_real li");
        // tslint:disable-next-line:no-http-string
        assert.equal(ns, "http://foo.foo/foo");
        assert.equal(attrName, "X");
        assert.equal(oldValue, "ttt");
        mark.mark("attribute-changed");
      });
    root.appendChild(fragmentToAdd);
    const li = root.querySelector("._real.li")!;
    // tslint:disable-next-line:no-http-string
    li.setAttributeNS("http://foo.foo/foo", "X", "ttt");
    listener.startListening();
    // tslint:disable-next-line:no-http-string
    treeUpdater.setAttributeNS(li, "http://foo.foo/foo", "X", null);
    mark.check();
  });

  it("generates children-changing and children-changed with " +
     "the right parent when removing", done => {
       fragmentToAdd = $(`<div class='_real ul'><div class='_real li'>A</div>\
<div class='_real li'>B</div><div class='_real li'>C</div></div>`)[0];

       mark = new Mark(2, {
         "removed-child ul": 1,
         "removing-child ul": 1,
       }, listener, done);
       root.appendChild(fragmentToAdd);
       const $li = $root.find("._real.li");
       const parent = $li[0].parentNode;
       listener.addHandler("removing-child", "._real.ul",
                           ({ child }) => {
                             // The marker will also trigger this
                             // handler. Ignore it.
                             if (child === marker) {
                               return;
                             }
                             mark.mark("removing-child ul");
                           });

       listener.addHandler("removed-child", "._real.ul",
                           ({ parent: thisParent, child }) => {
                             // The marker will also trigger this
                             // handler. Ignore it.
                             if (child === marker) {
                               return;
                             }
                             assert.equal(thisParent, parent);
                             mark.mark("removed-child ul");
         });

       listener.startListening();
       treeUpdater.deleteNode($li[1]);
       mark.check();
     });

  it("generates included-element with the right tree", done => {
    mark = new Mark(8, {
      "included li at root": 2,
      "included li at ul": 2,
      "excluding li at ul": 2,
      "excluding li at root": 2,
    }, listener, done);
    const $fragment = $(`<div><p>before</p><div class='_real ul'>\
<div class='_real li'>A</div><div class='_real li'>B</div></div>\
<p>after</p></div>`);
    function addHandler(incex: "included" | "excluding"): void {
      listener.addHandler(
        `${incex}-element` as "included-element" | "excluding-element",
        "._real.li",
        ({ root: thisRoot, tree, element }) => {
          assert.equal(thisRoot, root, "root");
          assert.equal(element.className, "_real li", "element class");
          // The following tests are against $fragment rather than $root
          // or $thisRoot because by the time the handler is called, the
          // $root could be empty!

          if (tree === $fragment[0]) {
            mark.mark(`${incex} li at root`);
          }
          else {
            assert.equal(tree, $fragment.find(".ul")[0], "tree value");
            mark.mark(`${incex} li at ul`);
          }
        });
    }
    addHandler("included");
    addHandler("excluding");
    listener.startListening();
    treeUpdater.insertNodeAt(root, root.childNodes.length, $fragment[0]);
    const $ul = $root.find(".ul");
    treeUpdater.deleteNode($ul[0]);
    const p = $root.find("p")[0];
    const pParent = p.parentNode!;
    treeUpdater.insertNodeAt(pParent, indexOf(pParent.childNodes, p) + 1,
                             $ul[0]);
    $root.contents().each(function each(this: Node): void {
      // tslint:disable-next-line:no-invalid-this
      treeUpdater.deleteNode(this);
    });
    mark.check();
  });

  it("processImmediately processes immediately", () => {
    let marked = false;
    mark = new Mark(2, { "children root": 1, trigger: 1 }, listener,
                    () => {
                      marked = true;
                    });
    listener.addHandler("added-child", "*", ({ child }) => {
      if (child === marker) {
        return;
      }
      listener.trigger("t");
      mark.mark("children root");
    });
    listener.addHandler("trigger", "t", () => {
      mark.mark("trigger");
    });
    listener.startListening();

    treeUpdater.insertNodeAt(root, root.childNodes.length, fragmentToAdd);
    listener.processImmediately();
    mark.check();
    assert.isTrue(marked);
  });

  it("clearPending clears pending operations", () => {
    let marked = false;
    mark = new Mark(1, { "children root": 1 }, listener, () => {
      marked = true;
    });
    listener.addHandler("added-child", "*", ({ child }) => {
      if (child === marker) {
        return;
      }
      listener.trigger("t");
      mark.mark("children root");
    });
    listener.addHandler("trigger", "t", () => {
      mark.mark("trigger");
    });
    listener.startListening();

    treeUpdater.insertNodeAt(root, root.childNodes.length, fragmentToAdd);
    listener.clearPending();
    mark.check();
    assert.isTrue(marked);
  });
});

//  LocalWords:  domlistener Dubeau MPL Mangalam jsdom TreeUpdater
//  LocalWords:  MutationObserver
