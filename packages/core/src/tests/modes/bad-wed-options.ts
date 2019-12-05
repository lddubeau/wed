/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import mergeOptions from "merge-options";

import { EditorAPI } from "wed";
import { Metadata } from "wed/modes/generic/metadata";
import { TestMode, TestModeOptions } from "wed/modes/test/test-mode";

// tslint:disable-next-line:completed-docs
class FakeMode extends TestMode {
  constructor(editor: EditorAPI, metadata: Metadata, options: TestModeOptions) {
    super(editor, metadata, options);
    this.wedOptions = mergeOptions({}, this.wedOptions);
    // Oh god, that as "hide" bit is funny as hell. Anyway we need it to
    // purposely put a crap value there.
    this.wedOptions.attributes = "moo" as "hide";
  }
}

export { FakeMode as Mode };
