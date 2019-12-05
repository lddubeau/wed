/**
 * Load and initialize modes.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Runtime } from "@wedxml/client-api";
import { Container, inject } from "inversify";
import { provide } from "inversify-binding-decorators";

import { RUNTIME } from "@wedxml/common/tokens";

import { Binder } from "./mode";

interface ModeModule {
  Binder: new () => Binder;
}

/**
 * A class that can load modes.
 */
@provide(ModeLoader)
export class ModeLoader {
  /**
   * @param runtime The runtime to use to load the mode module.
   */
  constructor(@inject(RUNTIME) private readonly runtime: Runtime) {}

  /**
   * Load and bind a mode to a container.
   *
   * @param path The path to the mode.
   *
   * @returns A promise that resolves once binding is done.
   */
  async bindMode(container: Container, path: string): Promise<void> {
    const mmodule: ModeModule = await this.loadMode(path);
    const binder = new mmodule.Binder();
    await binder.bind(container);
  }

  /**
   * Loads a mode.
   *
   * @param path The path to the mode.
   *
   * @returns A promise that resolves to the module that holds the mode.
   */
  private async loadMode(path: string): Promise<ModeModule> {
    const runtime = this.runtime;
    try {
      return (await runtime.resolveModules(path))[0] as ModeModule;
    }
    // tslint:disable-next-line:no-empty
    catch (ex) {}

    if (path.indexOf("/") !== -1) {
      // It is an actual path so don't try any further loading.
      throw new Error(`can't load mode ${path}`);
    }

    path = `wed/modes/${path}/${path}`;

    try {
      return (await runtime.resolveModules(path))[0] as ModeModule;
    }
    // tslint:disable-next-line:no-empty
    catch (ex) {}

    try {
      return (await runtime.resolveModules(`${path}-mode`))[0] as ModeModule;
    }
    // tslint:disable-next-line:no-empty
    catch (ex) {}

    return (await runtime.resolveModules(`${path}_mode`))[0] as ModeModule;
  }
}

//  LocalWords:  MPL runtime
