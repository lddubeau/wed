/**
 * Common configuration for tests.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Options } from "@wedxml/client-api";

import { config as base } from "./base-config";

export const config: Options = {
  schema: "/base/build/schemas/tei-simplified-rng.js",
  mode: {
    path: "wed/modes/generic/generic",
    options: {
      metadata: "/base/build/schemas/tei-metadata.json",
    },
    submode: {
      method: "selector",
      selector: "teiHeader",
      mode: {
        path: "wed/modes/test/test-mode",
        options: {
          metadata: "/base/build/schemas/tei-metadata.json",
        },
      },
    },
  },
  ajaxlog: base.ajaxlog,
  save: base.save,
};
