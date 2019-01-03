/**
 * A saver that does nothing.
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

// We reexport it as a convenience.
export { SAVER_OPTIONS };

export const version = "5.0.0-alpha.8";

/**
 * A saver that does nothing. This saver does not raise any errors. Recoveries
 * are always considered to be successful, even though nothing happened.
 *
 * This saver is not meant for production, but only for testing or demos that do
 * not need to save data.
 *
 * @param runtime The runtime under which this saver is created.
 *
 * @param options The options specific to this class.
 */
@injectable()
export class NullSaver extends BaseSaver {
  constructor(@inject(RUNTIME) protected readonly runtime: Runtime,
              @inject(SAVER_OPTIONS) protected readonly options: SaverOptions) {
    super(runtime, options);
    // There's no point in autosaving.
    this.setAutosaveInterval(0);
  }

  async _init(): Promise<void> {
    this.initialized = true;

    return;
  }

  async _save(): Promise<void> {
    return;
  }

  async _recover(): Promise<boolean> {
    return true;
  }
}

//  LocalWords:  MPL ETag runtime etag json url autosave
