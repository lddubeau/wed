/**
 * The API for savers.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Observable } from "rxjs";

export const enum SaveKind {
  AUTO = 1,
  MANUAL,
}

/**
 * A structure describing an error that happened during saving.
 */
export interface SaveError {
  /**
   * The possible values for ``type`` are:
   *
   * - ``save_edited`` when the file to be saved has changed in the save
   *   media. (For instance, if someone else edited a file that is stored on a
   *   server.)
   *
   * - ``save_disconnected`` when the saver has lost contact with the media that
   *   holds the data to be saved.
   *
   * - ``save_transient_error`` when an recoverable error happened while
   *   saving. These are errors that a user should be able to recover from. For
   *   instance, if the document must contain a specific piece of information
   *   before being saved, this kind of error may be used to notify the user.
   */
  // tslint:disable-next-line:no-reserved-keywords
  type: string | undefined;
  msg: string;
}

/**
 * Emitted upon a failure during operations.
 */
export interface FailedEvent {
  name: "Failed";
  error: SaveError;
}

/**
 * This event is emitted when the saver detects that the document it is
 * responsible for saving has changed in a way that makes it stale from the
 * point of view of saving.
 *
 * Suppose that the document has been saved. Then a change is made. Upon this
 * first change, this event is emitted. Then a change is made again. Since the
 * document was *already* stale, this event is not emitted again.
 */
export interface ChangedEvent {
  name: "Changed";
}

/**
 * This event is emitted after a document has been successfully saved.
 */
export interface Saved {
  name: "Saved";
}

/**
 * This event is emitted after a document has been successfully autosaved.
 */
export interface Autosaved {
  name: "Autosaved";
}

/**
 * All the events that a saver may emit.
 */
export type SaveEvents = Saved | Autosaved | ChangedEvent | FailedEvent;

export interface Saver {
  /**
   * The observable on which clients can listen for events.
   */
  readonly events: Observable<SaveEvents>;

  /**
   * This method must be called before using the saver. **MUST BE CALLED ONLY
   * ONCE.**
   *
   * @param version The version of wed for which this saver is created.
   *
   * @param dataTree The editor's data tree.
   *
   * @returns A promise that is resolved when the saver is initialized.
   */
  init(version: string, dataTree: Node): Promise<void>;

  /**
   * Inform the saver that a change occurred in the data.
   */
  change(): void;

  /**
   * This method must be called when the user manually initiates a save.
   *
   * @returns A promise which resolves if the save was successful.
   */
  save(): Promise<void>;

  /**
   * Changes the interval at which autosaves are performed. Note that calling
   * this function will stop the current countdown and restart it from zero. If,
   * for instance, the previous interval was 5 minutes, and 4 minutes had
   * elapsed since the last save, the next autosave should happen one minute
   * from now. However, if I now call this function with a new interval of 4
   * minutes, this will cause the next autosave to happen 4 minutes after the
   * call, rather than one minute.
   *
   * @param interval The interval between autosaves in milliseconds. 0 turns off
   * autosaves.
   */
  setAutosaveInterval(interval: number): void;

  /**
   * This method is to be used by wed upon encountering a fatal error. It will
   * attempt to record the last state of the data tree before wed dies.
   *
   * @returns A promise which resolves to ``undefined`` if the method did not do
   * anything because the Saver object is in an unintialized state or has
   * already failed. It resolves to ``true`` if the recovery operation was
   * successful, and ``false`` if not.
   */
  recover(): Promise<boolean | undefined>;

  /**
   * Returns information regarding whether the saver sees the data tree as
   * having been modified since the last save occurred.
   *
   * @returns ``false`` if the tree has not been modified. Otherwise, returns a
   * string that describes how long ago the modification happened.
   */
  getModifiedWhen(): false | string;

  /**
   * Produces a string that indicates in human readable format when the last
   * save occurred.
   *
   * @returns The string. The value ``undefined`` is returned if no save has
   * occurred yet.
   */
  getSavedWhen(): undefined | string;

  /**
   * Returns the last kind of save that occurred.
   *
   * @returns {number|undefined} The kind. The value will be
   * ``undefined`` if there has not been any save yet.
   */
  getLastSaveKind(): SaveKind | undefined;
}
