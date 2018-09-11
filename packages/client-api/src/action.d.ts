/**
 * Actions meant to be executed by the editor.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
export interface EventWithData<Data> extends Event {
  data: Data;
}

/**
 * Actions model "things the user can do." These can be contextual menu items,
 * menu items, buttons, keybindings, etc. The base class is always enabled but
 * derived classes can set their own enabled state depending on whatever
 * conditions they choose.
 */
export interface Action<Data> {
  readonly boundHandler: (this: Action<Data>, ev: Event) => void;
  readonly boundTerminalHandler: (this: Action<Data>, ev: Event) => boolean;

  /**
   * @param data Arbitrary data. What data must be passed is
   * determined by the action.
   */
  execute(data: Data): void;

  /**
   * An event handler.
   *
   * @param ev The DOM event.
   */
  eventHandler(ev: EventWithData<Data>): void;

  /**
   * An event handler. This handler always returns false and calls
   * ``preventDefault()`` and ``stopPropagation`` on the event passed to it.
   *
   * @param ev The DOM event.
   *
   * @returns False.
   */
  terminalEventHandler(ev: EventWithData<Data>): boolean;

  /**
   * Gets a description for this action.
   *
   * @returns A description for the action.
   */
  getDescription(): string;

  /**
   * Gets a description for this action, contextualized by the data passed.
   *
   * @param data The same data that would be passed to [[execute]].
   *
   * @returns The description.
   */
  // @ts-ignore
  getDescriptionFor(data: Data): string;

  /**
   * Gets the abbreviated description for this action.
   *
   * @returns The abbreviated description.
   */
  getAbbreviatedDescription(): string | undefined;

  /**
   * Gets the icon.
   *
   * @returns The icon. This is an HTML string.
   */
  getIcon(): string;

  /**
   * This method returns the icon together with the description for the
   * data passed as parameter.
   *
   * @param data The same data that would be passed to [[execute]].
   *
   * @returns The icon and the description, combined for presentation.
   */
  getLabelFor(data: Data): string;

  /**
   * Make a GUI button that invokes the action.
   *
   * @param data The same data that would be passed to [[execute]].
   *
   * @returns The button.
   */
  makeButton(data?: Data): Button;
}
