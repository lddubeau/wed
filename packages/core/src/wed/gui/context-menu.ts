/**
 * Context menus.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import "bootstrap";
import $ from "jquery";
import * as domutil from "../domutil";

export type DismissCallback = () => void;

/**
 * A context menu GUI element.
 */
export abstract class ContextMenu<T> {
  private readonly dismissCallback: DismissCallback | undefined;
  /**
   * The ``Element`` that contains the list of menu items. This ``Element`` is
   * an HTML list. It is created at construction of the object and deleted only
   * when the object is destroyed. This is what the [[ContextMenu.render]]
   * method should populate.
   */
  protected readonly menu: HTMLElement;

  /** The jQuery equivalent of [[menu]]. */
  protected readonly $menu: JQuery;

  /**
   * The toggle element of the dropdown menu. Even though it is not shown for
   * our menus, it is necessary, and plays a role in how the menu works.
   */
  protected readonly toggle: HTMLElement;

  /** The jQuery equivalent of [[toggle]]. */
  protected readonly $toggle: JQuery;

  protected dismissed: boolean;
  protected dropdown: HTMLElement;
  protected backdrop: Element;

  private x: number;
  private y: number;

  /**
   * @param doc The DOM document for which to make this context menu.
   *
   * @param x Position of the menu. The context menu may ignore this position if
   * the menu would appear off-screen.
   *
   * @param y Position of the menu.
   *
   * @param specs The contents of the items to show in the menu.
   *
   * @param dismissCallback Function to call when the menu is dismissed.
   *
   * @param immediateDisplay If true, will call ``render`` from the constructor.
   */
  constructor(protected readonly doc: Document, x: number, y: number,
              protected readonly specs: T[],
              dismissCallback?: DismissCallback) {
    this.dismissCallback = dismissCallback;
    this.dismissed = false;

    const dropdown = this.dropdown = doc.createElement("div");
    dropdown.className = "dropdown wed-context-menu";
    // tslint:disable-next-line:no-inner-html
    dropdown.innerHTML =
      // This fake toggle is required for bootstrap to do its work.
      "<a href='#' data-toggle='dropdown'></a>" +
      "<div class='dropdown-menu' role='menu'></div>";
    // We move the top and left so that we appear under the mouse cursor.
    // Hackish, but it works. If we don't do this, then the mousedown that
    // brought the menu up also registers as a click on the body element and the
    // menu disappears right away.  (It would be nice to have a more general
    // solution some day.)
    x -= 5;
    y -= 5;
    dropdown.style.top = `${y}px`;
    dropdown.style.left = `${x}px`;
    this.x = x;
    this.y = y;

    const menu = this.menu = dropdown.lastElementChild as HTMLElement;
    const $menu = this.$menu = $(menu);
    const toggle = this.toggle = dropdown.firstElementChild as HTMLElement;
    const $toggle = this.$toggle = $(toggle);

    const backdrop = this.backdrop = doc.createElement("div");
    backdrop.className = "wed-context-menu-backdrop";

    $(backdrop).click(this.backdropClickHandler.bind(this));

    $menu.on("click", this.contentsClickHandler.bind(this));
    // Bootstrap may dispatch clicks onto the toggle. We must catch them.
    $toggle.on("click", this.contentsClickHandler.bind(this));

    $menu.on("mousedown", ev => {
      ev.stopPropagation();
    });

    $(dropdown).on("contextmenu mouseup", false);

    const body = doc.body;
    body.insertBefore(dropdown, body.firstChild);
    body.insertBefore(backdrop, body.firstChild);
  }

  /**
   * Perform the initial rendering of the menu.
   */
  protected display(): void {
    const dropdown = this.dropdown;
    const $toggle = $(dropdown.firstElementChild!);

    this.refreshItemList();

    const $menu = this.$menu;
    const menu = this.menu;
    const win = this.doc.defaultView!;
    const x = this.x;
    let y = this.y;

    // Verify if we're going to run off screen. If so, then modify our position
    // to be inside the screen.
    const width = $menu.outerWidth();
    const winWidth = $(win).width();
    // The x value that would put the menu just against the side of the window
    // is width - winWidth. If x is less than it, then x is the value we want,
    // but we don't want less than 0.
    dropdown.style.left = `${Math.max(0, Math.min(x, winWidth - width))}px`;
    menu.style.maxWidth = `${winWidth}px`;

    // Adjust height so that we can see about 5 lines.
    const fiveLines = Number($menu.css("line-height").replace("px", "")) * 5;

    const winHeight = $(win).height();
    let maxHeight = winHeight - y;
    if (maxHeight < fiveLines) {
      y -= fiveLines - maxHeight;
      maxHeight = fiveLines;
    }
    dropdown.style.top = `${y}px`;
    menu.style.maxHeight = `${maxHeight}px`;

    $toggle.focus(this.handleToggleFocus.bind(this));
    $toggle.dropdown({
      // In theory we could pass parameters to Bootstrap to let popper.js
      // position the menu. The problem is that popper currently does not
      // support what we need. For instance, if the menu is definitely not going
      // to fit in the window, popper does not take care of the overflow. Rather
      // than mess around with popper, we continue using the logic that has
      // worked so far.
      display: "static",
    });
    $toggle.dropdown("toggle");

    //
    // What is going on here? When Bootstrap detects that touch events are
    // supported, it assumes it is on a mobile device (which is a false
    // assumption) and adds a backdrop to its dropdowns so as to be able to
    // close it if the user "clicks" outside the dropdown. This messes up our
    // own handling of the same scenario. To prevent this issue, we remove any
    // backdrop added by Bootstrap. (It may be possible to keep both backdrops
    // around but it would just complicate the code needlessly.)
    //
    // Note that we cannot rely on Bootstrap's backdrop, generally, because, as
    // mentioned already, it won't be added for non-mobile platforms. However,
    // we *always* need to detect clicks outside our menu, on all platforms.
    //
    const bootstrapBackdrop =
      domutil.childByClass(dropdown, "dropdown-backdrop");
    if (bootstrapBackdrop !== null) {
      dropdown.removeChild(bootstrapBackdrop);
    }
  }

  /**
   * Event handler for focus events on the toggle. Bootstrap focuses the toggle
   * when the dropdown is shown. This can cause problems on some platforms if
   * the dropdown is meant to have a descendant focused. (IE in particular
   * grants focus asynchronously.) This method can be used to focus the proper
   * element.
   */
  handleToggleFocus(): void {
    // Default does nothing.
  }

  /**
   * Event handler for clicks on the contents. Dismissed the menu.
   */
  private contentsClickHandler(ev: Event): false {
    this.dismiss();
    ev.stopPropagation();
    ev.preventDefault();
    return false;
  }

  /**
   * Event handler for clicks on the backdrop. Dismisses the menu.
   * @private
   */
  private backdropClickHandler(): false {
      this.dismiss();
      return false;
  }

  /**
   * Refresh the list of menu items.
   */
  refreshItemList(): void {
    // tslint:disable-next-line:no-inner-html
    this.menu.innerHTML = "";
    this.render(this.makeMenuItems(this.specs));
  }

  /**
   * Subclasses can override this to customize what is shown to the user. For
   * instance, subclasses could accept a list of items which is more complex
   * than DOM ``Element`` objects. Or could include in the list shown to the
   * user some additional GUI elements.
   *
   * @param items The items to show.
   */
  protected render(items: Element[]): void {
    this.$menu.append(items);
  }

  /**
   * Create the DOM element for a menu item to display in this menu.
   *
   * @returns The element for the item.
   */
  protected makeMenuItemElement(): HTMLElement {
    const a = this.doc.createElement("a");
    a.className = "dropdown-item";
    a.href = "#";
    return a;
  }

  /**
   * Make a menu item from item spec.
   *
   * @param spec The spec to convert.
   *
   * @returns A menu item, or null if this spec does not generate a menu item.
   */
  protected abstract makeMenuItem(spec: T): HTMLElement | null;

  /**
   * Make menu items from item specs.
   *
   * @param specs The specs of the items.
   *
   * @returns The menu items.
   */
  protected makeMenuItems(specs: T[]): HTMLElement[] {
    const items = [];
    for (const spec of specs) {
      const item = this.makeMenuItem(spec);
      if (item !== null) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Dismisses the menu.
   */
  dismiss(): void {
    if (this.dismissed) {
      return;
    }

    this.$menu.dropdown("toggle");
    if (this.dropdown.parentNode !== null) {
      this.dropdown.parentNode.removeChild(this.dropdown);
    }
    if (this.backdrop.parentNode !== null) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
    if (this.dismissCallback !== undefined) {
      this.dismissCallback();
    }
    this.dismissed = true;
  }
}

//  LocalWords:  contextmenu mousedown dropdown tabindex href gui MPL px
//  LocalWords:  Mangalam Dubeau ul jQuery Prepend util jquery mouseup winWidth
//  LocalWords:  dropdowns
