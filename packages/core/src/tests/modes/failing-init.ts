/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Container } from "inversify";

import { tokens } from "wed";

import MODE = tokens.MODE;

import { METADATA } from "wed/modes/generic/metadata";
import { TestMode } from "wed/modes/test/test-mode";

// tslint:disable-next-line:completed-docs
class FakeMode extends TestMode {
  init(): Promise<void> {
    return Promise.reject(new Error("failed init"));
  }
}

class FakeBinder {
  async bind(container: Container): Promise<void> {
    container.bind(METADATA).toConstantValue({});
    container.bind(MODE).to(FakeMode);
  }
}

export { FakeBinder as Binder };
