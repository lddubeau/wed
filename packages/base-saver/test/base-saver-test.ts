import { Runtime } from "@wedxml/client-api";

import { BaseSaver, SaverOptions } from "base-saver";
import { makeSaverTests } from "base-saver/test/saver-tests";

class ConcreteSaver extends BaseSaver {
  async _init(): Promise<void> {
    this.initialized = true;
  }

  async _save(autosave: boolean): Promise<void> {
    this._saveSuccess(autosave, this.currentGeneration);
  }

  async _recover(): Promise<boolean> {
    return true;
  }
}

makeSaverTests("BaseSaver",
               (options: SaverOptions) =>
               new ConcreteSaver({} as Runtime, options));
