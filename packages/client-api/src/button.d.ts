/**
 * The interface for GUI buttons.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Observable } from "rxjs";

export interface ButtonEvent {
  name: string;
  button: Button;
}

export interface ClickEvent extends ButtonEvent {
  name: "Click";
}

/**
 * A GUI button that can be clicked.
 */
export interface Button {
  /**
   * The observable on which clients can listen for events.
   */
  readonly events: Observable<ClickEvent>;

  /**
   * Render the button.
   *
   * @param parent On first render, this parameter must contain the parent DOM
   * element of the button. On later renders, this parameter is ignored.
   *
   */
  render(parent?: Element | Document | DocumentFragment): void;
}
