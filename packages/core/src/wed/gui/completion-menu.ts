/**
 * Menu for completions.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import $ from "jquery";

import { Editor, KeydownHandler } from "../editor";
import * as keyConstants from "../key-constants";
import { ContextMenu, DismissCallback } from "./context-menu";

/**
 * A menu for displaying completions.
 */
export class CompletionMenu extends ContextMenu {
  private readonly completionPrefix: string;
  private readonly completionItems: string[];
  private readonly editor: Editor;
  private readonly boundCompletionKeydownHandler: KeydownHandler;
  private _focused: boolean = false;

  /**
   * @param editor The editor for which to create this menu.
   *
   * @param document The DOM document for which to make this context menu.
   *
   * @param x Position of the menu. The context menu may ignore this position if
   * the menu would appear off-screen.
   *
   * @param y Position of the menu.
   *
   * @param prefix The prefix. This is the data which is currently present in
   * the document and that has to be completed.
   *
   * @param items An array of possible completions.
   *
   * @param dismissCallback Function to call when the menu is dismissed.
   */
  constructor(editor: Editor, document: Document, x: number, y: number,
              prefix: string, items: string[],
              dismissCallback?: DismissCallback) {
    super(document, x, y, [], dismissCallback, false);
    this.completionPrefix = prefix;
    this.completionItems = items;
    this.editor = editor;

    this.dropdown.classList.add("wed-completion-menu");

    //
    // We hide this menu by disposing it rather than by clicking on a DOM
    // element which serves as a toggle. So we prevent hide events from doing
    // their default, which is to hide the menu.
    //
    // Without this, it would not be possible to bring up the menu on a click
    // inside a placeholder because the menu would be created and then the data
    // API of Bootstrap would get the click on the ``body`` element and close
    // the menu.
    //
    $(this.dropdown).on("hide.bs.dropdown", (ev: JQueryEventObject) => {
      ev.preventDefault();
    });

    // Remove the backdrop. We do not need a backdrop for this kind of GUI item
    // because completion menus are evanescent.
    this.backdrop.parentNode!.removeChild(this.backdrop);

    // We need to install our own handler so that we can handle the few keys
    // that ought to be transferred to the menu itself. Remember that the focus
    // remains in the editing pane. So the editing pane, rather than the menu,
    // gets the key events.
    this.boundCompletionKeydownHandler =
      this.globalKeydownHandler.bind(this);
    editor.pushGlobalKeydownHandler(this.boundCompletionKeydownHandler);

    this.display([]);

    // We want the user to still be able to type into the document.
    editor.caretManager.focusInputField();
  }

  /** Whether the completion menu has been focused. */
  get focused(): boolean {
    return this._focused;
  }

  private globalKeydownHandler(_wedEv: JQueryEventObject,
                               ev: JQueryKeyEventObject): boolean {
    if (keyConstants.ENTER.matchesEvent(ev)) {
      this.$menu.find("a").first().click();
      return false;
    }
    else if (keyConstants.DOWN_ARROW.matchesEvent(ev)) {
      this._focused = true;
      this.$menu.find("a").first().focus();
      this.$menu.trigger(ev as JQueryEventObject);
      return false;
    }
    else if (keyConstants.ESCAPE.matchesEvent(ev)) {
      this.dismiss();
      return false;
    }
    return true;
  }

  render(): void {
    const editor = this.editor;
    const items = [];
    const prefix = this.completionPrefix;
    const doc = this.doc;
    function typeData(ev: JQueryEventObject): void {
      editor.type(ev.data);
    }

    for (const item of this.completionItems) {
      if (prefix === "") {
        const menuItem = this.makeMenuItem();
        menuItem.textContent = item;
        items.push(menuItem);
        $(menuItem).click(item, typeData);
      }
      else if (item.lastIndexOf(prefix, 0) === 0) {
        const menuItem = this.makeMenuItem();
        // tslint:disable-next-line:no-inner-html
        menuItem.innerHTML = "<b></b>";
        menuItem.firstChild!.textContent = item.slice(0, prefix.length);
        const tail = item.slice(prefix.length);
        menuItem.appendChild(doc.createTextNode(tail));
        items.push(menuItem);
        $(menuItem).click(tail, typeData);
      }
    }

    if (items.length === 0) {
      this.dismiss();
    }

    if (items.length === 1 && this.completionItems[0] === prefix) {
      this.dismiss();
    }

    super.render(items);
  }

  dismiss(): void {
    if (this.dismissed) {
      return;
    }
    this.editor.popGlobalKeydownHandler(this.boundCompletionKeydownHandler);
    super.dismiss();
  }
}

//  LocalWords:  MPL li href
