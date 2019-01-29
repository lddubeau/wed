/**
 * Menu for replacing values.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import $ from "jquery";

import { ContextMenu } from "./context-menu";

export type DismissCallback = (selected: string | undefined) => void;

/**
 * A menu for displaying replacement values.
 */
export class ReplacementMenu extends ContextMenu<string> {
  private selected: string | undefined;

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
   * @param items An array of possible replacement values.
   *
   * @param dismissCallback Function to call when the menu is dismissed.
   */
  constructor(document: Document, x: number, y: number, items: string[],
              dismissCallback: DismissCallback) {
    super(document, x, y, items, () => {
      dismissCallback(this.selected);
    });
    this.dropdown.classList.add("wed-replacement-menu");
    this.display();
  }

  protected makeMenuItem(spec: string): HTMLElement {
    const item = this.makeMenuItemElement();
    item.textContent = spec;
    $(item).click(() => {
      this.selected = spec;
      this.dismiss();
    });
    return item;
  }

  dismiss(): void {
    if (this.dismissed) {
      return;
    }
    super.dismiss();
  }
}

//  LocalWords:  MPL li href
