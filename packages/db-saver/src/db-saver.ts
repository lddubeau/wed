/**
 * Data saving functionality, using a database backend.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { inject, injectable } from "inversify";

import { BaseSaver, SaverOptions } from "@wedxml/base-saver";
import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
import { Runtime } from "@wedxml/client-api";
import { RUNTIME } from "@wedxml/common/tokens";

export const version = "5.0.0-alpha.19";

/**
 * A database backend abstraction used by this saver.
 *
 * The store's concrete implementation should take care of performing any DB
 * initialization necessary for successfully saving the data.
 */
export interface Store {
  /**
   * This is the method by which [[DBSaver]] stores data into the backend.
   *
   * @param name The "name" of the file to save. This is the key used to save
   * the file. Depending on the backend, this could be an actual file name, or
   * it may be a backend-generated key.
   *
   * @param data The data to save.
   */
  put(name: string, data: string): Promise<void>;
}

export interface Options extends SaverOptions {
  /**
   * The "name" of the file to save. This is the key used to save the file.
   */
  name: string;

  /**
   * A function that provides access to a Store through which the data is passed
   * on to the DB backend.
   *
   * All accesses to the DB backed are done through the store.
   */
  getStore(): Store;
}

/**
 * Defines a saver that uses a DB backend to save documents.
 */
@injectable()
export class DBSaver extends BaseSaver {
  private readonly name: string;
  private readonly store: Store;

  /**
   * @param runtime The runtime under which this saver is created.
   *
   * @param options The options specific to this class.
   */
  constructor(@inject(RUNTIME) protected readonly runtime: Runtime,
              @inject(SAVER_OPTIONS) protected readonly options: Options) {
    super(runtime, options);
    this.failed = false;
    this.name = options.name;

    this.store = options.getStore();
    this.setAutosaveInterval(5 * 60 * 1000);
  }

  async _init(): Promise<void> {
    this.initialized = true;
  }

  async _save(autosave: boolean): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await this._update(this.name, this.getData(), autosave,
                         this.currentGeneration);
    }
    catch {
      return;
    }
  }

  async _update(name: string, data: string, autosave: boolean,
                savingGeneration: number): Promise<void> {
    try {
      await this.store.put(name, data);
    }
    catch {
      this._fail({ type: undefined, msg: "Failed to save!" });
      throw new Error("save failed");
    }

    this._saveSuccess(autosave, savingGeneration);
  }

  async _recover(): Promise<boolean> {
    try {
      await this._update(this.name, this.getData(), false,
                         this.currentGeneration);

      return true;
    }
    catch {
      return false;
    }
  }
}

//  LocalWords:  MPL runtime
