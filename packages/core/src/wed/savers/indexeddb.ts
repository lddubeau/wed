/**
 * Data saving functionality, using IndexedDB. Note that this saver is mainly
 * designed for demonstration purposes.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
// Everything from wed must be loaded from "wed".
import { Runtime, saver } from "wed";

export interface Store {
  put(name: string, data: string): Promise<void>;
}

export interface Options extends saver.SaverOptions {
  /**
   * The "name" of the file to save. This is the key used to save the file.
   */
  name: string;

  getStore(): Store;
}

/**
 * Defines a saver that uses IndexedDB to save documents.
 *
 * This saver stores the document as a "file" into an IndexedDB instance. The
 * objects are not really files but similar to files. Henceforth, the name
 * "file" will be used without quotes to refer to the objects stored.
 *
 * @param version The version of wed for which this object is
 * created.
 *
 * @param dataUpdater The updater that the editor created for its data tree.
 *
 * @param dataTree The editor's data tree.
 *
 * @param options The options specific to this class.
 */
export class Saver extends saver.Saver {
  private readonly name: string;
  private readonly store: Store;

  /**
   * @param runtime The runtime under which this saver is created.
   *
   * @param version The version of wed for which this object is created.
   *
   * @param dataTree The editor's data tree.
   *
   * @param options The options specific to this class.
   */
  constructor(runtime: Runtime, options: Options) {
    super(runtime, options);
    this.failed = false;
    this.name = options.name;

    this.store = options.getStore();
    this.setAutosaveInterval(5 * 60 * 1000);
  }

  async _init(): Promise<void> {
    this.initialized = true;
  }

  _save(autosave: boolean): Promise<void> {
    return Promise.resolve().then(() => {
      if (!this.initialized) {
        return;
      }

      return this._update(this.name, this.getData(), autosave,
                          this.currentGeneration)
      // All save errors produced by this saver are handled with this._fail.
        .catch(() => undefined);
    });
  }

  _update(name: string, data: string, autosave: boolean,
          savingGeneration: number): Promise<void> {
    return this.store.put(name, data).then(() => {
      this._saveSuccess(autosave, savingGeneration);
    }).catch(() => {
      this._fail({ type: undefined, msg: "Failed to save!" });
      throw new Error("save failed");
    });
  }

  _recover(): Promise<boolean> {
    return this._save(false)
      .then(() => true)
      .catch(() => false);
  }
}

//  LocalWords:  IndexedDB MPL runtime
