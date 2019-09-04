/**
 * Utilities that require a DOM to run.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

// tslint:disable-next-line:import-name
import md5 from "blueimp-md5";
import { expect } from "chai";
import sinon from "sinon";

import { DLoc, domutil, onerror, Options, SelectionMode } from "wed";
import { Editor } from "wed/editor";

const { childByClass, childrenByClass } = domutil;

import { makeEditor } from "./entry";
import { DataProvider } from "./util";

export const devPath = "/base/build/dist/dev";

export const dataPath = `${devPath}/lib/tests`;

export function activateContextMenu(editor: Editor, el: Element): void {
  // tslint:disable-next-line:no-any
  function computeValues(): any {
    el.scrollIntoView();
    const rect = el.getBoundingClientRect();
    const left = rect.left + (rect.width / 2);
    const top = rect.top + (rect.height / 2);
    const scrollTop = editor.window.document.body.scrollTop;
    const scrollLeft = editor.window.document.body.scrollLeft;
    return {
      which: 3,
      pageX: left + scrollLeft,
      pageY: top + scrollTop,
      clientX: left,
      clientY: top,
      target: el,
    };
  }

  editor.$guiRoot.trigger(new $.Event("mousedown", computeValues()));
  editor.$guiRoot.trigger(new $.Event("mouseup", computeValues()));
}

export function contextMenuHasOption(editor: Editor, pattern: RegExp,
                                     expectedCount?: number): void {
  const menu =
    editor.window.document.getElementsByClassName("wed-context-menu")[0];
  expect(menu, "the menu should exist").to.not.be.undefined;
  const items = menu.querySelectorAll("a");
  let found = 0;
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    if (pattern.test(item.textContent!.trim())) {
      found++;
    }

    if (expectedCount === undefined && found > 0) {
      break;
    }
  }

  if (expectedCount === undefined) {
    expect(found).to.be.greaterThan(0);
  }
  else {
    expect(found).to.equal(expectedCount,
                           "should have seen the option a number of times \
equal to the expected count");
  }
}

export function firstGUI(container: Element): Element | null {
  return childByClass(container, "_gui");
}

export function lastGUI(container: Element): Element | null {
  const children = childrenByClass(container, "_gui");
  const last = children[children.length - 1];
  return last !== undefined ? last : null;
}

export function getElementNameFor(container: Element,
                                  last: boolean = false): Element | undefined {
  const gui = last ? lastGUI(container) : firstGUI(container);

  return gui!.getElementsByClassName("_element_name")[0];
}

export function getAttributeValuesFor(container: Element):
HTMLCollectionOf<Element> {
  return firstGUI(container)!.getElementsByClassName("_attribute_value");
}

export function getAttributeNamesFor(container: Element):
HTMLCollectionOf<Element> {
  return firstGUI(container)!.getElementsByClassName("_attribute_name");
}

export function caretCheck(editor: Editor, container: Node,
                           offset: number | null, msg: string): void {
  const caret = editor.caretManager.caret!;
  expect(caret, "there should be a caret").to.not.be.undefined;
  if (offset !== null) {
    expect(caret.toArray(), msg).to.deep.equal([container, offset]);
  }
  else {
    // A null offset means we are not interested in the specific offset.  We
    // just want to know that the caret is *inside* container either directly or
    // indirectly.
    expect(container.contains(caret.node), msg).to.be.true;
  }
}

export function dataCaretCheck(editor: Editor, container: Node,
                               offset: number, msg: string): void {
  const caret = editor.caretManager.getDataCaret()!;
  expect(caret, msg).to.have.property("node").equal(container);
  expect(caret, msg).to.have.property("offset").equal(offset);
}

export function dataSelectionCheck(editor: Editor, start: DLoc,
                                   end: DLoc, msg: string): void {
  const sel = editor.caretManager.sel!;
  expect(sel).to.be.not.be.undefined;
  const [selStart, selEnd] = sel.mustAsDataCarets();
  expect(selStart.toArray(), msg).to.deep.equal(start.toArray());
  expect(selEnd.toArray(), msg).to.deep.equal(end.toArray());
}

export interface Payload {
  readonly command: string;
  readonly data: string;
  readonly version: string;
}

// tslint:disable-next-line:completed-docs
export class WedServer {
  private _saveRequests: Payload[] = [];
  private readonly origFetch: typeof window.fetch;

  emptyResponseOnSave: boolean = false;
  failOnSave: boolean = false;
  preconditionFailOnSave: boolean = false;
  tooOldOnSave: boolean = false;

  constructor() {
    this.origFetch = window.fetch;
    window.fetch = this.handleFetch.bind(this);
  }

  async handleFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    const url = (typeof input === "string") ? input : input.url;
    if (/^\/build\/ajax\/save\.txt$/.test(url)) {
      const request = (input instanceof Request) ? input :
        new Request(input, init);
      return this.handleSave(request);
    }

    return this.origFetch.call(window, input, init);
  }

  get saveRequests(): ReadonlyArray<Payload> {
    return this._saveRequests;
  }

  get lastSaveRequest(): Payload {
    const reqs = this.saveRequests;
    return reqs[reqs.length - 1];
  }

  reset(): void {
    this._saveRequests = [];
    this.emptyResponseOnSave = false;
    this.failOnSave = false;
    this.preconditionFailOnSave = false;
    this.tooOldOnSave = false;
  }

  restore(): void {
    window.fetch = this.origFetch;
  }

  private async decode(request: Request): Promise<Payload> {
    const contentType = request.headers.get("Content-Type");
    const body = await request.text();
    switch (contentType) {
      case "application/x-www-form-urlencoded;charset=utf-8":
      case "application/x-www-form-urlencoded;charset=UTF-8":
        const params = new URLSearchParams(body);
        const ret: Record<string, string> = {};
        for (const [name, value] of params) {
          ret[name] = value;
        }

        return ret as unknown as Payload;
      case "json":
        return JSON.parse(body);
      default:
        throw new Error(`unknown content type: ${contentType}`);
    }
  }

  private async handleSave(request: Request): Promise<Response> {
    const decoded = await this.decode(request);
    this._saveRequests.push(decoded);
    let status = 200;
    const headers: Record<string, string> =
      { "Content-Type": "application/json" };
    // tslint:disable-next-line:no-reserved-keywords
    const messages: { type: string }[] = [];

    function populateSaveResponse(): void {
      headers.ETag = btoa(md5(decoded.data, undefined, true));
      messages.push({ type: "save_successful" });
    }

    switch (decoded.command) {
    case "check":
      break;
    case "save":
    case "autosave":
      if (!this.emptyResponseOnSave) {
        if (this.tooOldOnSave) {
          messages.push({ type: "version_too_old_error" });
        }

        if (this.preconditionFailOnSave) {
          status = 412;
        }
        else if (this.failOnSave) {
          status = 400;
        }
        else {
          populateSaveResponse();
        }
      }
      break;
    case "recover":
      populateSaveResponse();
      break;
    default:
      status = 400;
    }

    return new Response(JSON.stringify({ messages }), {
      status,
      headers,
    });
  }
}

export function makeWedRoot(doc: Document): HTMLElement {
  const wedroot = doc.createElement("div");
  wedroot.className = "wed-widget container";
  return wedroot;
}

export function errorCheck(): void {
  // We read the state, reset, and do the assertion later so that if the
  // assertion fails, we still have our reset.
  const wasTerminating = onerror.isTerminating();

  // We don't reload our page so we need to do this.
  onerror.__test!.reset();
  expect(wasTerminating)
    .to.equal(false, "test caused an unhandled exception to occur");
}

export function expectNotification(kind: string, content: string): void {
  const notification = document.querySelector("[data-notify='container']")!;
  expect(notification, "there should be a notification").to.not.be.null;
  expect(notification.classList.contains(`alert-${kind}`),
         `the notification should be of kind ${kind}`).to.be.true;
  const message = notification.querySelector("[data-notify='message']");
  expect(message).to.have.property("textContent").equal(content);
}

// tslint:disable-next-line:completed-docs
export class EditorSetup {
  private static provider: DataProvider = new DataProvider("");

  public readonly sandbox: sinon.SinonSandbox;
  public readonly server: WedServer;
  public readonly wedroot: HTMLElement;
  public readonly editor: Editor;

  constructor(public readonly source: string,
              options: Options, doc: Document) {
    this.sandbox = sinon.createSandbox();

    this.server = new WedServer();

    this.wedroot = makeWedRoot(document);
    doc.body.appendChild(this.wedroot);

    this.editor = makeEditor(this.wedroot, options, {
      url: "/build/ajax/save.txt",
    }) as Editor;
  }

  async init(): Promise<Editor> {
    const provider = (this.constructor as typeof EditorSetup).provider;
    const data = await provider.getText(this.source);
    return this.editor.init(data);
  }

  reset(): void {
    const editor = this.editor;
    editor.undoAll();
    editor.resetLabelVisibilityLevel();
    editor.editingMenuManager.dismiss();
    // We set the caret to a position that will trigger some display changes
    // (e.g. hide attributes).
    editor.caretManager.setCaret(editor.caretManager.minCaret);
    // Then we clear the selection to reset the caret to undefined. The mark
    // will still be visible, but that's not an issue.
    editor.caretManager.clearSelection();
    editor.selectionMode = SelectionMode.SPAN;
    (editor as any).pasteMode.reset();
    this.server.reset();
    errorCheck();
    // Immediately destroy all notifications to prevent interfering with other
    // tests. ($.notifyClose is not drastic enough.)
    $("[data-notify=container]").remove();
  }

  restore(): void {
    if (this.editor !== undefined) {
      this.editor.destroy();
    }

    this.server.restore();

    errorCheck();

    if (this.wedroot !== undefined) {
      document.body.removeChild(this.wedroot);
    }

    if (this.sandbox !== undefined) {
      this.sandbox.restore();
    }

    // Immediately destroy all notifications to prevent interfering with other
    // tests. ($.notifyClose is not drastic enough.)
    $("[data-notify=container]").remove();
  }

  get spanSelectionButton(): HTMLElement {
    return this.wedroot
      .querySelector(`[data-original-title=\
'Set selection mode to span']`) as HTMLElement;
  }

  get unitSelectionButton(): HTMLElement {
    return this.wedroot
      .querySelector(`[data-original-title=\
'Set selection mode to unit']`) as HTMLElement;
  }

  expectSelectionModeIsSpan(): void {
    expect(this.editor.selectionMode).to.equal(SelectionMode.SPAN);
    expect(this.spanSelectionButton.classList.contains("active"),
          "span selection button in toolbar should be active").to.be.true;
    expect(this.unitSelectionButton.classList.contains("active"),
           "unit selection button in toolbar should not be active").to.be.false;
  }

  expectSelectionModeIsUnit(): void {
    expect(this.editor.selectionMode).to.equal(SelectionMode.UNIT);
    expect(this.spanSelectionButton.classList.contains("active"),
           "span selection button in toolbar should not be active")
      .to.be.false;
    expect(this.unitSelectionButton.classList.contains("active"),
           "unit selection button in toolbar should be active").to.be.true;
  }
}
