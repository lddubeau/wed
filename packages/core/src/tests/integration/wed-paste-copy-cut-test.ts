/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { domtypeguards, keyConstants, SelectionMode } from "wed";
import { CaretManager } from "wed/caret-manager";
import { Clipboard } from "wed/clipboard";
import { Editor } from "wed/editor";

import * as globalConfig from "../base-config";
import { makeFakePasteEvent } from "../util";
import { dataCaretCheck, dataPath, EditorSetup } from "../wed-test-util";

const { assert, expect } = chai;

//
// Ideally, the copy and cut tests would be done here too. However, there is no
// cross platform reliable way to perform those tests here. The issue ultimately
// stems from limitations as to how we can create synthetic events, and how
// browsers protect users from nefarious clipboard modifications.  Browsers
// allow event handlers to manipulate the clipboard if and only if the event was
// ultimately triggered by a user action, like typing Ctrl-C or clicking on a
// button. Using `dispatchEvent` or anything that relies on this mechanism to
// generate a synthetic event that initates a copy/cut operation is untrusted
// and does not have access to the clipboard.
//
// So the copy/cut tests are done through Selenium, which **can** simulate real
// user interactions with the browser. (At least on many platforms it can.)
//

describe("wed paste-copy-cut:", () => {
  let setup: EditorSetup;
  let editor: Editor;
  let caretManager: CaretManager;
  let comment: Comment;
  let pi: ProcessingInstruction;

  beforeEach(() => {
    const body = editor.dataRoot.querySelector("body")!;
    comment = body.lastChild as Comment;
    expect(comment).to.have.property("nodeType").equal(Node.COMMENT_NODE);
    pi = comment.previousSibling as ProcessingInstruction;
    expect(pi).to.have.property("nodeType")
      .equal(Node.PROCESSING_INSTRUCTION_NODE);
  });

  afterEach(() => {
    setup.reset();
    document.designMode = "off";
  });

  after(() => {
    setup.restore();

    // tslint:disable-next-line:no-any
    (editor as any) = undefined;
    // tslint:disable-next-line:no-any
    (caretManager as any) = undefined;
  });

  async function setupEditor(source: string): Promise<void> {
    setup = new EditorSetup(source, globalConfig.config, document);
    ({ editor } = setup);
    await setup.init();
    // tslint:disable-next-line:no-any
    (editor.validator as any)._validateUpTo(editor.dataRoot, -1);
    caretManager = editor.caretManager;

  }

  describe("", () => {
    before(() => setupEditor(`${dataPath}/wed_test_data/source_converted.xml`));

    it("the PASTE_AS_TEXT keybinding switches the paste mode", () => {
      editor.type(keyConstants.PASTE_AS_TEXT);
      let messages = document.querySelectorAll("[data-notify=message]");
      expect(messages[messages.length - 1]).to.have.property("textContent")
        .equal("The next paste will paste content as text.");

      editor.type(keyConstants.PASTE_AS_TEXT);
      messages = document.querySelectorAll("[data-notify=message]");
      expect(messages[messages.length - 1]).to.have.property("textContent")
        .equal("All pastes will paste content as text, until you turn it off.");

      editor.type(keyConstants.PASTE_AS_TEXT);
      messages = document.querySelectorAll("[data-notify=message]");
      expect(messages[messages.length - 1]).to.have.property("textContent")
        .equal("All pastes will paste content as XML if possible.");
    });
  });

  describe("span mode", function span(): void {
    before(() => setupEditor(`${dataPath}/wed_test_data/source_converted.xml`));

    it("pastes simple text", () => {
      const initial = editor.dataRoot.querySelector("body>p")!.firstChild!;
      caretManager.setCaret(initial, 0);
      const initialValue = initial.nodeValue;

      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/plain"],
        getData: () => "abcdef",
      });
      editor.$guiRoot.trigger(event);
      assert.equal(initial.nodeValue, `abcdef${initialValue}`);
      dataCaretCheck(editor, initial, 6, "final position");
    });

    it("pastes a single space for many spaces", () => {
      const initial = editor.dataRoot.querySelector("body>p")!.firstChild!;
      caretManager.setCaret(initial, 0);
      const initialValue = initial.nodeValue;

      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/plain"],
        getData: () => "    \u00A0  ",
      });
      editor.$guiRoot.trigger(event);
      assert.equal(initial.nodeValue, ` ${initialValue}`);
      dataCaretCheck(editor, initial, 1, "final position");
    });

    it("pastes nothing for zero-width space", () => {
      const initial = editor.dataRoot.querySelector("body>p")!.firstChild!;
      caretManager.setCaret(initial, 0);
      const initialValue = initial.nodeValue;

      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/plain"],
        getData: () => "\u200B\u200B",
      });
      editor.$guiRoot.trigger(event);
      assert.equal(initial.nodeValue, initialValue);
      dataCaretCheck(editor, initial, 0, "final position");
    });

    it("pastes XML", () => {
      const p = editor.dataRoot.querySelector("body>p")!;
      const initial = p.firstChild!;
      caretManager.setCaret(initial, 0);
      const initialValue = p.innerHTML;

      const toPaste = `Blah <term xmlns="http://www.tei-c.org/ns/1.0">blah\
</term> blah.`;
      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/html", "text/plain"],
        // We add the zero-width space for the heck of it.  It will be stripped.
        getData: () => `${toPaste}\u200B`,
      });
      editor.$guiRoot.trigger(event);
      assert.equal(p.innerHTML, toPaste + initialValue);
      dataCaretCheck(editor, p.childNodes[2], 6, "final position");
    });

    it("pastes XML as text", () => {
      (editor as any).pasteMode.next();
      const p = editor.dataRoot.querySelector("body>p")!;
      const initial = p.firstChild!;
      caretManager.setCaret(initial, 0);
      const initialValue = p.textContent!;

      const toPaste = `Blah <term xmlns="http://www.tei-c.org/ns/1.0">blah\
</term> blah.`;
      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/html", "text/plain"],
        // We add the zero-width space for the heck of it.  It will be stripped.
        getData: () => `${toPaste}\u200B`,
      });
      editor.$guiRoot.trigger(event);
      assert.equal(p.textContent, toPaste + initialValue);
      dataCaretCheck(editor, p.firstChild!, toPaste.length, "final position");
    });

    it("pastes invalid XML", () => {
      const p = editor.dataRoot.querySelector("body>p")!;
      const initial = p.firstChild!;
      caretManager.setCaret(initial, 0);
      const initialValue = p.innerHTML;

      const toPaste = `Blah <fnord xmlns="http://www.tei-c.org/ns/1.0">blah\
</fnord> blah.`;
      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/html", "text/plain"],
        getData: () => toPaste,
      });
      editor.$guiRoot.trigger(event);
      assert.equal(p.innerHTML, toPaste + initialValue);
      dataCaretCheck(editor, p.childNodes[2], 6, "final position");
    });

    it("pastes simple text into an attribute", () => {
      const p = editor.dataRoot.querySelector("body>p:nth-of-type(8)")!;
      const initial = p.getAttributeNode("rend")!;
      caretManager.setCaret(initial, 0);
      const initialValue = initial.value;

      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/plain"],
        getData: () => "abcdef",
      });
      editor.$guiRoot.trigger(event);
      assert.equal(initial.value, `abcdef${initialValue}`);
      dataCaretCheck(editor, initial, 6, "final position");
    });

    it("pastes XML as text into an attribute", () => {
      const p = editor.dataRoot.querySelector("body>p:nth-of-type(8)")!;
      const initial = p.getAttributeNode("rend")!;
      caretManager.setCaret(initial, 0);
      const initialValue = initial.value;

      const toPaste = `<foo>blah</foo>`;
      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/html", "text/plain"],
        getData: () => toPaste,
      });
      editor.$guiRoot.trigger(event);
      assert.equal(initial.value, `${toPaste}${initialValue}`);
      dataCaretCheck(editor, initial, 15, "final position");
    });

    it("pastes simple text into a pi", () => {
      caretManager.setCaret(pi, 0);
      const initialValue = pi.data;

      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/plain"],
        getData: () => "abcdef",
      });
      editor.$guiRoot.trigger(event);
      assert.equal(pi.data, `abcdef${initialValue}`);
      dataCaretCheck(editor, pi, 6, "final position");
    });

    it("pasting XML into a pi splits the PI", () => {
      caretManager.setCaret(pi, 1);
      const initialValue = pi.data;

      const toPaste = `<foo>blah</foo>`;
      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/html", "text/plain"],
        getData: () => toPaste,
      });
      editor.$guiRoot.trigger(event);
      const caret = caretManager.getDataCaret();
      const pointed = caret!.pointedNode!;
      expect(pointed).to.have.property("data").equal(initialValue.slice(1));
      expect(pointed).to.have.property("nodeType")
        .equal(Node.PROCESSING_INSTRUCTION_NODE);
      const prev = pointed.previousSibling!;
      expect(prev).to.have.property("outerHTML").equal(toPaste);
      expect(prev).to.have.property("nodeType").equal(Node.ELEMENT_NODE);
      const front = prev.previousSibling;
      expect(front).to.have.property("data").equal(initialValue[0]);
      expect(front).to.have.property("nodeType")
        .equal(Node.PROCESSING_INSTRUCTION_NODE);
    });

    it("pastes simple text into a comment", () => {
      caretManager.setCaret(comment, 0);
      const initialValue = comment.data;

      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/plain"],
        getData: () => "abcdef",
      });
      editor.$guiRoot.trigger(event);
      assert.equal(comment.data, `abcdef${initialValue}`);
      dataCaretCheck(editor, comment, 6, "final position");
    });

    it("pastes XML into a comment splits the comment", () => {
      caretManager.setCaret(comment, 1);
      const initialValue = comment.data;

      const toPaste = `<foo>blah</foo>`;
      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/html", "text/plain"],
        getData: () => toPaste,
      });
      editor.$guiRoot.trigger(event);
      const caret = caretManager.getDataCaret();
      const pointed = caret!.pointedNode!;
      expect(pointed).to.have.property("data").equal(initialValue.slice(1));
      expect(pointed).to.have.property("nodeType").equal(Node.COMMENT_NODE);
      const prev = pointed.previousSibling!;
      expect(prev).to.have.property("outerHTML").equal(toPaste);
      expect(prev).to.have.property("nodeType").equal(Node.ELEMENT_NODE);
      const front = prev.previousSibling;
      expect(front).to.have.property("data").equal(initialValue[0]);
      expect(front).to.have.property("nodeType").equal(Node.COMMENT_NODE);
    });
  });

  describe("unit mode", function unit(): void {
    let clipboard: Clipboard;

    before(() => setupEditor(`${dataPath}/wed_test_data/\
unit_selection_converted.xml`));

    beforeEach(() => {
      editor.selectionMode = SelectionMode.UNIT;
      clipboard = (editor as any).clipboard;
    });

    function paste(node: Element | ProcessingInstruction | Comment): string {
      clipboard.putUnit(node, false);
      let toPaste: string;
      if (domtypeguards.isElement(node)) {
        toPaste = node.outerHTML;
      }
      else {
        const el = document.createElement("div");
        el.appendChild(node.cloneNode(true));
        toPaste = el.innerHTML;
      }
      // Synthetic event
      const event = makeFakePasteEvent({
        types: ["text/html", "text/plain"],
        getData: () => toPaste,
      });
      editor.$guiRoot.trigger(event);
      return toPaste;
    }

    it("pasting into a pi splits the PI", () => {
      caretManager.setCaret(pi, 1);
      const initialValue = pi.data;

      const foo = editor.dataRoot.createElement("foo");
      foo.textContent = "blah";

      const toPaste = paste(foo);
      const caret = caretManager.getDataCaret();
      const pointed = caret!.pointedNode!;
      expect(pointed).to.have.property("data").equal(initialValue.slice(1));
      expect(pointed).to.have.property("nodeType")
        .equal(Node.PROCESSING_INSTRUCTION_NODE);
      const prev = pointed.previousSibling!;
      expect(prev).to.have.property("outerHTML").equal(toPaste);
      expect(prev).to.have.property("nodeType").equal(Node.ELEMENT_NODE);
      const front = prev.previousSibling;
      expect(front).to.have.property("data").equal(initialValue[0]);
      expect(front).to.have.property("nodeType")
        .equal(Node.PROCESSING_INSTRUCTION_NODE);
    });

    it("pasting into a comment splits the comment", () => {
      caretManager.setCaret(comment, 1);
      const initialValue = comment.data;

      const foo = editor.dataRoot.createElement("foo");
      foo.textContent = "blah";

      const toPaste = paste(foo);
      const caret = caretManager.getDataCaret();
      const pointed = caret!.pointedNode!;
      expect(pointed).to.have.property("data").equal(initialValue.slice(1));
      expect(pointed).to.have.property("nodeType").equal(Node.COMMENT_NODE);
      const prev = pointed.previousSibling!;
      expect(prev).to.have.property("outerHTML").equal(toPaste);
      expect(prev).to.have.property("nodeType").equal(Node.ELEMENT_NODE);
      const front = prev.previousSibling;
      expect(front).to.have.property("data").equal(initialValue[0]);
      expect(front).to.have.property("nodeType").equal(Node.COMMENT_NODE);
    });

    it("pasting a PI into an element", () => {
      const initial = editor.dataRoot.querySelector("body>p")!.firstChild!;
      caretManager.setCaret(initial, 1);
      const initialValue = initial.nodeValue!;

      const foo = editor.dataRoot.createProcessingInstruction("target", "foo");
      paste(foo);
      const caret = caretManager.getDataCaret();
      const pointed = caret!.pointedNode!;
      expect(pointed).to.have.property("data").equal(initialValue.slice(1));
      expect(pointed).to.have.property("nodeType").equal(Node.TEXT_NODE);
      const prev = pointed.previousSibling!;
      expect(prev).to.have.property("target").equal("target");
      expect(prev).to.have.property("data").equal("foo");
      expect(prev).to.have.property("nodeType")
        .equal(Node.PROCESSING_INSTRUCTION_NODE);
      const front = prev.previousSibling;
      expect(front).to.have.property("data").equal(initialValue[0]);
      expect(front).to.have.property("nodeType").equal(Node.TEXT_NODE);
    });

    it("pasting a comment into an element", () => {
      const initial = editor.dataRoot.querySelector("body>p")!.firstChild!;
      caretManager.setCaret(initial, 1);
      const initialValue = initial.nodeValue!;

      const foo = editor.dataRoot.createComment("foo");
      paste(foo);
      const caret = caretManager.getDataCaret();
      const pointed = caret!.pointedNode!;
      expect(pointed).to.have.property("data").equal(initialValue.slice(1));
      expect(pointed).to.have.property("nodeType").equal(Node.TEXT_NODE);
      const prev = pointed.previousSibling!;
      expect(prev).to.have.property("data").equal("foo");
      expect(prev).to.have.property("nodeType").equal(Node.COMMENT_NODE);
      const front = prev.previousSibling;
      expect(front).to.have.property("data").equal(initialValue[0]);
      expect(front).to.have.property("nodeType").equal(Node.TEXT_NODE);
    });

    it("pasting a PI into an attribute", () => {
      const p = editor.dataRoot.querySelector("body>p")!;
      const initial = p.getAttributeNode("rend")!;
      caretManager.setCaret(initial, 1);
      const initialValue = initial.value;

      const foo = editor.dataRoot.createProcessingInstruction("target", "foo");
      paste(foo);
      expect(initial).to.have.property("value")
        .equal(`${initialValue[0]}foo${initialValue.slice(1)}`);
      dataCaretCheck(editor, initial, 4, "final position");
    });

    it("pasting a comment into an attribute", () => {
      const p = editor.dataRoot.querySelector("body>p")!;
      const initial = p.getAttributeNode("rend")!;
      caretManager.setCaret(initial, 1);
      const initialValue = initial.value;

      const foo = editor.dataRoot.createComment("foo");
      paste(foo);
      expect(initial).to.have.property("value")
        .equal(`${initialValue[0]}foo${initialValue.slice(1)}`);
      dataCaretCheck(editor, initial, 4, "final position");
    });

    it("pasting as text into a pi", () => {
      (editor as any).pasteMode.next();
      caretManager.setCaret(pi, 1);
      const initialValue = pi.data;

      const foo = editor.dataRoot.createElement("foo");
      foo.textContent = "blah";

      const toPaste = paste(foo);
      const caret = caretManager.getDataCaret()!;
      const { node } = caret;
      expect(node).to.have.property("data")
        .equal(initialValue[0] + toPaste + initialValue.slice(1));
      expect(node).to.have.property("nodeType")
        .equal(Node.PROCESSING_INSTRUCTION_NODE);
    });
  });
});
