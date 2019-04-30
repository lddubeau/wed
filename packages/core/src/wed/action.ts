/**
 * Editing actions.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Action as ActionInterface,
         EventWithData } from "@wedxml/client-api/action";
import { Button } from "./gui/button";
import { EditorAPI } from "./mode-api";

export class ActionInvocation<Data extends {} | void = void> {
  constructor(readonly action: Action<Data>, readonly data: Data) {}

  getDescription(): string {
    return this.action.getDescriptionFor(this.data);
  }

  get key(): string {
    return `${this.action.origin}:${this.action.getDescriptionFor(this.data)}`;
  }
}

export interface ActionOptions {
  /**  An abbreviated description of this action. */
  abbreviatedDesc?: string;

  /** An HTML representation of the icon associated with this action. */
  icon?: string;

  /**
   * Indicates whether this action needs input from the user. For instance, an
   * action which brings up a modal dialog to ask something of the user must
   * have this parameter set to ``true``. It is important to record whether an
   * action needs input because, to take one example, the ``autoinsert`` logic
   * will try to insert automatically any element it can. However, doing this
   * for elements that need user input will just confuse the user (or could
   * cause a crash). Therefore, it is important that the insertion operations
   * for such elements be marked with ``needsInput`` set to ``true`` so that the
   * ``autoinsert`` logic backs off from trying to insert these elements.
   *
   * Defaults to ``false`` if not specified.
   */
  needsInput?: boolean;
}

/**
 * Actions model "things the user can do." These can be contextual menu items,
 * menu items, buttons, keybindings, etc. The base class is always enabled but
 * derived classes can set their own enabled state depending on whatever
 * conditions they choose.
 */
export abstract class Action<Data extends {} | void = void>
  implements ActionInterface<Data> {
  protected readonly abbreviatedDesc?: string;
  protected readonly icon: string;
  readonly needsInput: boolean = false;
  readonly boundHandler: (ev: EventWithData<Data>) => void;
  readonly boundTerminalHandler: (ev: EventWithData<Data>) => boolean;

  /**
   *
   * @param origin The action's origin. If you produce a mode with custom
   * actions, you must select an origin that won't clash with wed and other
   * modes. You should use a URI you have (reasonable) authority over. URLs are
   * URIs so if you produce a wed mode hosted at ``https://github.com/foo/bar``,
   * you could use this as the origin. The origin is used by wed to possibly
   * distinguish actions that are otherwise indistinguishable. For instance if
   * wed provides an "Undo" action and a mode provides an "Undo" action, the
   * origin may be the only way to distinguish the two actions.
   *
   * @param editor The editor to which this action belongs.
   *
   * @param desc A simple string description of the action.
   *
   * @param options Options that can be set for the action.
   */
  constructor(readonly origin: string, readonly editor: EditorAPI,
              protected readonly desc: string, options?: ActionOptions) {
    options = options || {};
    this.needsInput = !!options.needsInput; // normalize value
    this.abbreviatedDesc = options.abbreviatedDesc;
    this.icon = options.icon || "";
    this.boundHandler = this.eventHandler.bind(this);
    this.boundTerminalHandler = this.terminalEventHandler.bind(this);
  }

  /**
   * @param data Arbitrary data. What data must be passed is
   * determined by the action.
   */
  abstract execute(data: Data): void;

  /**
   * An event handler. By default just calls [[execute]]. You probably want to
   * use [[boundHandler]] rather than rebind this method. This handler always
   * returns ``undefined`` and calls ``preventDefault()`` on the event passed to
   * it.
   *
   * @param ev The DOM event.
   */
  eventHandler(ev: EventWithData<Data>): void {
    //
    // Due to the way jQuery's typings are set, the event object passed when
    // calling this method will essentially have a ``data`` field with type
    // ``any``, and this will sastisfy the type checking done at compilation
    // time. There does not appear to be a simple way to coerce ``data`` to not
    // be null or undefined.
    //
    // We toyed with the idea of having it be an error to call this method with
    // an event that does not have a ``data`` field set to some valid value, but
    // that did not seem fruitful. Instead, we silently use an empty object if
    // the field is missing.
    //
    // tslint:disable-next-line:no-object-literal-type-assertion
    const data = ev.data != null ? ev.data : ({} as Data);
    this.execute(data);
    ev.preventDefault();
  }

  /**
   * An event handler. By default just calls [[eventHandler]]. You probably want
   * to use [[boundTerminalHandler]] rather than rebind this method.  This
   * handler always returns false and calls ``preventDefault()`` and
   * ``stopPropagation`` on the event passed to it.
   *
   * @param ev The DOM event.
   *
   * @returns False.
   */
  terminalEventHandler(ev: EventWithData<Data>): boolean {
    this.eventHandler(ev);
    ev.preventDefault();
    ev.stopPropagation();
    return false;
  }

  /**
   * Gets a description for this action.
   *
   * @returns A description for the action.
   */
  getDescription(): string {
    return this.desc;
  }

  /**
   * Gets a description for this action, contextualized by the data passed.
   *
   * @param data The same data that would be passed to [[execute]].
   *
   * @returns The description.
   */
  // @ts-ignore
  getDescriptionFor(data: Data): string {
    return this.getDescription();
  }

  /**
   * Gets the abbreviated description for this action.
   *
   * @returns The abbreviated description.
   */
  getAbbreviatedDescription(): string | undefined {
    return this.abbreviatedDesc;
  }

  /**
   * Gets the icon.
   *
   * @returns The icon. This is an HTML string.
   */
  getIcon(): string {
    return this.icon;
  }

  /**
   * This method returns the icon together with the description for the
   * data passed as parameter.
   *
   * @param data The same data that would be passed to [[execute]].
   *
   * @returns The icon and the description, combined for presentation.
   */
  getLabelFor(data: Data): string {
    const desc = this.getDescriptionFor(data);
    const icon = this.getIcon();
    if (icon !== "" && desc !== "") {
      return `${icon} ${desc}`;
    }

    if (icon !== "") {
      return icon;
    }

    return desc;
  }

  /**
   * Converts this action to a string. By default calls [[getDescription]].
   */
  toString(): string {
    return this.getDescription();
  }

  makeButton(data?: Data): Button {
    const button = new Button(
      data !== undefined ? this.getDescriptionFor(data) : this.getDescription(),
      this.getAbbreviatedDescription(),
      this.getIcon());

    button.events.subscribe(() => {
      // tslint:disable-next-line:no-object-literal-type-assertion
      this.execute(data !== undefined ? data : {} as Data);
    });

    return button;
  }
}

/**
 * An interface modeling actions for which we do not have precise information
 * regarding what data they accept.
 */
// tslint:disable-next-line:no-any
export interface UnspecifiedAction extends Action<any> {
}

/**
 * An interface modeling action invocations for which we do not have precise
 * information regarding what data they accept.
 */
// tslint:disable-next-line:no-any
export interface UnspecifiedActionInvocation extends ActionInvocation<any> {
}

//  LocalWords:  autoinsert Dubeau MPL Mangalam html keybindings
