/**
 * Testing utilities.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { AssertionError, expect } from "chai";

// tslint:disable-next-line:no-any
export type ErrorClass = { new (...args: any[]): Error };

export async function expectError(p: Promise<unknown>,
                                  pattern:
                                  RegExp | string | Error): Promise<void>;
export async function expectError(p: Promise<unknown>, errorClass: ErrorClass,
                                  pattern: RegExp | string): Promise<void>;
export async function expectError(p: Promise<unknown>,
                                  errorLike:
                                  RegExp | string | ErrorClass | Error,
                                  pattern?: RegExp | string): Promise<void> {
  let shouldHaveRaised = false;
  try {
    await p;
    shouldHaveRaised = true;
  }
  catch (ex) {
    if (errorLike instanceof Error) {
      expect(ex).to.equal(errorLike);
    }
    else {
      if (!(errorLike instanceof RegExp || typeof errorLike === "string")) {
        expect(ex).to.be.instanceof(errorLike);
      }
      else {
        // tslint:disable-next-line:no-parameter-reassignment
        pattern = errorLike;
      }

      if (pattern instanceof RegExp) {
        expect(ex).to.have.property("message").match(pattern);
      }
      else {
        expect(ex).to.have.property("message").equal(pattern);
      }
    }
  }

  if (shouldHaveRaised) {
    throw new Error("should have thrown an error");
  }
}

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
