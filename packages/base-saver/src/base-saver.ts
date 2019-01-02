/**
 * Base class for savers.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { inject, injectable } from "inversify";
import { Observable, Subject } from "rxjs";

import { Runtime, SaveError, SaveEvents, SaveKind,
         Saver } from "@wedxml/client-api";
import * as browsers from "@wedxml/common/browsers";
import { RUNTIME } from "@wedxml/common/tokens";

import * as serializer from "./serializer";
import { SAVER_OPTIONS } from "./tokens";

export const version = "5.0.0-alpha.4";

function deltaToString(delta: number): string {
  // tslint:disable-next-line:no-parameter-reassignment
  delta = Math.round(delta / 1000);
  let timeDesc = "moments ago";
  if (delta > 0) {
    timeDesc = " ≈ ";
    // To get a single digit after the decimal point, we divide by (factor /
    // 10), round the result, and then divide by 10. Note that this is imprecise
    // due to rounding errors in floating point arithmetic but we don't care.
    if (delta > 60 * 60 * 24) {
      timeDesc += `${Math.round(delta / (6 * 60 * 24)) / 10}d`;
    }
    else if (delta > 60 * 60) {
      timeDesc += `${Math.round(delta / (6 * 60)) / 10}h`;
    }
    else if (delta > 60) {
      timeDesc += `${Math.round(delta / 6) / 10}m`;
    }
    else {
      timeDesc += `${delta}s`;
    }
    timeDesc += " ago";
  }

  return timeDesc;
}

/**
 * The minimum set of options supported by savers deriving from this
 * class. Derived classes should derive their own interface from this one.
 */
export interface SaverOptions {
  /** The time between autosaves in seconds. */
  autosave?: number;
}

/**
 * A saver is responsible for saving a document's data. This class cannot be
 * instantiated as-is, but only through subclasses.
 */
@injectable()
export abstract class BaseSaver implements Saver {
  /**
   * Subclasses must set this variable to true once they have finished with
   * their initialization.
   */
  protected initialized: boolean = false;

  /**
   * Subclasses must set this variable to true if the saver is in a failed
   * state. Note that the "failed" state is for cases where it makes no sense to
   * attempt a recovery operation.
   *
   * One effect of being in a "failed" state is that the saver won't perform a
   * recover operation if it is in a "failed" state.
   */
  protected failed: boolean = false;

  /**
   * The generation that is currently being edited.  It is mutable. Derived
   * classes can read it but not modify it.
   */
  protected currentGeneration: number = 0;

  /**
   * The generation that has last been saved. Derived classes can read it but
   * not modify it.
   */
  protected savedGeneration: number = 0;

  /**
   * Whether init was called already.
   */
  private initCalled: boolean = false;

  /**
   * The date of last modification.
   */
  private lastModification: number | undefined;

  /**
   * The date of last save.
   */
  private lastSave: number | undefined;

  /**
   * The last kind of save.
   */
  private lastSaveKind: SaveKind | undefined;

  /**
   * The interval at which to autosave, in milliseconds.
   */
  private autosaveInterval: number = 0;

  /**
   * The current timeout object which will trigger an autosave. It has the value
   * ``undefined`` if there is no current timeout.
   */
  private autosaveTimeout: number | undefined;

  /**
   * The object on which this class and subclasses may push new events.
   */
  protected readonly _events: Subject<SaveEvents>;

  /**
   * The observable on which clients can listen for events.
   */
  public readonly events: Observable<SaveEvents>;

  private _boundAutosave: Function;

  protected dataTree!: Node;
  protected version!: string;

  /**
   * @param runtime The runtime under which this saver is created.
   */
  constructor(@inject(RUNTIME) protected readonly runtime: Runtime,
              @inject(SAVER_OPTIONS) protected readonly options: SaverOptions) {
    /**
     * The _autosave method, pre-bound to ``this``.
     * @private
     */
    this._boundAutosave = this._autosave.bind(this);

    this._events = new Subject();

    this.events = this._events.asObservable();

    let { autosave } = options;
    // Undefined means use the 5 minute default.
    if (autosave === undefined) {
      autosave = 5 * 60;
    }
    this.setAutosaveInterval(autosave * 1000);
  }

  /**
   * This method must be called before using the saver. **MUST BE CALLED ONLY
   * ONCE.**
   *
   * @param wedVersion The version of wed for which this object is created.
   *
   * @param dataTree The editor's data tree.
   *
   * @returns A promise that is resolved when the saver is initialized.
   */
  async init(wedVersion: string, dataTree: Node): Promise<void> {
    if (this.initCalled) {
      throw new Error("init called more than once");
    }
    this.initCalled = true;
    this.version = wedVersion;
    this.dataTree = dataTree;

    return this._init();
  }

  /**
   * Supplementary initialization to be provided by the classes derived from
   * this class.
   *
   * After this method is called, [[initialized]] must be true.
   *
   * @returns A promise that is resolved when the saver is initialized.
   */
  protected abstract _init(): Promise<void>;

  /**
   * Must be called by the editor when the data tree changes.
   */
  change(): void {
    this.lastModification = Date.now();
    if (this.savedGeneration === this.currentGeneration) {
      this.currentGeneration++;
      this._events.next({ name: "Changed" });
    }
  }

  /**
   * This method must be called when the user manually initiates a save.
   *
   * @returns A promise which resolves if the save was successful.
   */
  async save(): Promise<void> {
    return this._save(false);
  }

  /**
   * This method is called when saving or autosaving. This is the method
   * responsible for the implementation-specific details.
   *
   * @param autosave ``true`` if called by an autosave, ``false`` if not.
   */
  protected abstract _save(autosave: boolean): Promise<void>;

  /**
   * This method returns the data to be saved in a save operation. Derived
   * classes **must** call this method rather than get the data directly from
   * the data tree.
   */
  protected getData(): string {
    const child = this.dataTree.firstChild as Element;

    if (browsers.MSIE) {
      return serializer.serialize(child);
    }

    const serialization = child.outerHTML;

    // Edge has the bad habit of adding a space before the forward slash in
    // self-closing tags. Remove it.
    return browsers.EDGE ? serialization.replace(/<([^/<>]+) \/>/g, "<$1/>") :
      serialization;
  }

  /**
   * Must be called by derived class upon a successful save.
   *
   * @param autosave ``true`` if called for an autosave operation, ``false`` if
   * not.
   *
   * @param savingGeneration The generation being saved. It is necessary to pass
   * this value due to the asynchronous nature of some saving operations.
   */
  protected _saveSuccess(autosave: boolean, savingGeneration: number): void {
    // If we get here, we've been successful.
    this.savedGeneration = savingGeneration;
    this.lastSave = Date.now();
    this.lastSaveKind = autosave ? SaveKind.AUTO : SaveKind.MANUAL;
    this._events.next(autosave ? { name: "Autosaved" } : { name: "Saved" });
    // This resets the countdown to now.
    this.setAutosaveInterval(this.autosaveInterval);
  }

  /**
   * Must be called by derived classes when they fail to perform their task.
   *
   * @param The error message associated with the failure. If the error message
   * is specified a ``failed`` event will be emitted. If not, no event is
   * emitted.
   */
  protected _fail(error?: SaveError): void {
    this.failed = true;
    if (error !== undefined) {
      this._events.next({ name: "Failed", error });
    }
  }

  /**
   * This is the function called internally when an autosave is needed.
   */
  private _autosave(): void {
    this.autosaveTimeout = undefined;
    const done = () => {
      // Calling ``setAutosaveInterval`` effectively starts a new timeout, and
      // takes care of possible race conditions. For instance, a call to
      // ``setAutosaveInterval`` could happen after the current timeout has
      // started saving but before ``done`` is called. This would launch a new
      // timeout. If the code here called ``setTimeout`` instead of
      // ``setAutosaveInterval`` then two timeouts would be running.
      this.setAutosaveInterval(this.autosaveInterval);
    };

    if (this.currentGeneration !== this.savedGeneration) {
      // We have something to save!
      // tslint:disable-next-line:no-floating-promises
      this._save(true).then(done);
    }
    else {
      done();
    }
  }

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
  setAutosaveInterval(interval: number): void {
    this.autosaveInterval = interval;
    const oldTimeout = this.autosaveTimeout;

    if (oldTimeout !== undefined) {
      clearTimeout(oldTimeout);
    }

    this.autosaveTimeout = interval !== 0 ?
      setTimeout(this._boundAutosave, interval) : undefined;
  }

  /**
   * This method is to be used by wed upon encountering a fatal error. It will
   * attempt to record the last state of the data tree before wed dies.
   *
   * @returns A promise which resolves to ``undefined`` if the method did not do
   * anything because the Saver object is in an unintialized state or has
   * already failed. It resolves to ``true`` if the recovery operation was
   * successful, and ``false`` if not.
   */
  async recover(): Promise<boolean | undefined> {
    if (!this.initialized || this.failed) {
      return undefined;
    }

    return this._recover();
  }

  /**
   * This method is called when recovering. This is the method responsible for
   * the implementation-specific details.
   *
   * @returns A promise that resolves to ``true`` if the recovery operation was
   * successful, and ``false`` if not.
   */
  protected abstract _recover(): Promise<boolean>;

  /**
   * Returns information regarding whether the saver sees the data tree as
   * having been modified since the last save occurred.
   *
   * @returns ``false`` if the tree has not been modified. Otherwise, returns a
   * string that describes how long ago the modification happened.
   */
  getModifiedWhen(): false | string {
    if (this.savedGeneration === this.currentGeneration ||
        this.lastModification === undefined) {
      return false;
    }

    return deltaToString(Date.now() - this.lastModification);
  }

  /**
   * Produces a string that indicates in human readable format when the last
   * save occurred.
   *
   * @returns The string. The value ``undefined`` is returned if no save has
   * occurred yet.
   */
  getSavedWhen(): undefined | string {
    if (this.lastSave === undefined) {
      return undefined;
    }

    return deltaToString(Date.now() - this.lastSave);
  }

  /**
   * Returns the last kind of save that occurred.
   *
   * @returns {number|undefined} The kind. The value will be
   * ``undefined`` if there has not been any save yet.
   */
  getLastSaveKind(): SaveKind | undefined {
    return this.lastSaveKind;
  }
}

export interface SaverConstructor {
  new (runtime: Runtime, options: SaverOptions): BaseSaver;
}

//  LocalWords:  param unintialized Mangalam MPL Dubeau autosaved autosaves pre
//  LocalWords:  autosave runtime autosaving setAutosaveInterval setTimeout
