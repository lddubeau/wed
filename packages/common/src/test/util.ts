/**
 * Testing utilities.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AssertionError } from "chai";

// tslint:disable-next-line:no-any
export type ErrorClass = new (...args: any[]) => Error;

export async function delay(timeout: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, timeout));
}

export async function waitFor(fn: () => boolean | Promise<boolean>,
                              pollDelay: number = 100,
                              timeout?: number): Promise<boolean> {
  const start = Date.now();

  async function check(): Promise<boolean> {
    const ret = await fn();
    if (ret) {
      return ret;
    }

    if ((timeout !== undefined) && (Date.now() - start > timeout)) {
      return false;
    }

    await delay(pollDelay);

    return check();
  }

  return check();
}

export async function waitForSuccess(fn: () => void,
                                     pollDelay?: number,
                                     timeout?: number): Promise<void> {
  await waitFor(() => {
    try {
      fn();

      return true;
    }
    catch (e) {
      if (e instanceof AssertionError) {
        return false;
      }

      throw e;
    }
  }, pollDelay, timeout);
}
