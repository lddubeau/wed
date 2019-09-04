import { Observable, Subject } from "rxjs";

/**
 * A paste mode state. We use this to report previous states of the paste mode.
 */
export interface State {
  asText: boolean;
  sticky: boolean;
}

/**
 * The reason for a change of paste mode state.
 */
export enum PasteModeChangeReason {
  /** Next was called. */
  NEXT,

  /** Use was called. */
  USE,
}

/**
 * An event generated when the paste mode's state changes.
 */
export interface PasteModeChange {
  /** The paste mode from which the event originates. */
  pasteMode: PasteMode;

  /** The state the mode was in prior to the state change. */
  previousState: State;

  reason: PasteModeChangeReason;
}

/**
 * It is useful sometimes to forcibly paste data as text rather than as an XML
 * structure. This class models a "paste mode" which allows switching between:
 *
 * - A default paste mode, in which data which can be interpreted as well-formed
 *   XML is pasted as XML.
 *
 * - An "as text" mode, in which data is forcibly pasted as text, irrespective
 *   of whether it can be interpreted as well-formed XML.
 *
 * Suppose that the caret is located between the start and end tag of
 * ``<p></p>`` and suppose the clipboard contains the text
 * ``<hi>foo</hi>``.
 *
 * - In the default mode, pasting will result in the XML
 *   ``<p><hi>foo</hi></p>``. In other words, a XML ``p`` element will contain
 *   an XML ``hi`` element, which will contain the character data ``foo``.
 *
 * - In the "as text" mode, pasting will result in the XML
 *  ``<p>&lt;hi>foo&lt;/hi></p>``. In other words, a XML ``p`` element will
 *  contain the character data ``<hi>foo</hi>``.
 */
export class PasteMode {
  private _asText: boolean = false;
  private _sticky: boolean = false;

  private readonly _events: Subject<PasteModeChange>;

  /** This is where you can listen to changes. */
  readonly events: Observable<PasteModeChange>;

  constructor() {
    this._events = new Subject();
    this.events = this._events.asObservable();
  }

  /**
   * Whether the paste mode is default state (not "as text") or in the "as text"
   * state.
   */
  get asText(): boolean {
    return this._asText;
  }

  /**
   * Whether the current state is sticky. This can be true only in the "as text"
   * state. When the state is not sticky, the "as text" state remain in effect
   * only for one usage of the paste mode and resets to the default after usage.
   * If the state is sticky, it remains in effect until it is [[next]] is
   * called.
   */
  get sticky(): boolean {
    return this._sticky;
  }

  /**
   * Use the paste mode. If the state of the mode is not sticky, the state is
   * reset to the default (not "as text").
   */
  use(): void {
    if (!this.sticky) {
      this._asText = false;
      this._events.next({
        pasteMode: this,
        previousState: {
          asText: true,
          sticky: false,
        },
        reason: PasteModeChangeReason.USE,
      });
    }
  }

  /**
   * Cycle to the next state. When the mode is:
   *
   * - not in the "as text" state: switches to the "as text" state, not sticky,
   *
   * - in the "as text" state, not sticky: becomes sticky,
   *
   * - in the "as text" state, sticky: switches to the default state, not
   *   sticky.
   */
  next(): void {
    const { asText, sticky } = this;
    if (asText) {
      if (sticky) {
        this._asText = false;
        this._sticky = false;
      }
      else {
        this._sticky = true;
      }
    }
    else {
      this._asText = true;
      this._sticky = false;
    }

    this._events.next({
      pasteMode: this,
      previousState: {
        asText,
        sticky,
      },
      reason: PasteModeChangeReason.NEXT,
    });
  }

  /**
   * Reset the mode to its initial state with [[asText]] false and [[sticky]]
   * false.
   *
   * **NOTE**: this method does not emit any event, as it is used for
   * exceptional cases.
   */
  reset(): void {
    this._asText = false;
    this._sticky = false;
  }
}
