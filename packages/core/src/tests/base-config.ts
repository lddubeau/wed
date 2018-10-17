/**
 * Common configuration for tests.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Options } from "@wedxml/client-api";

export const config: Options = {
  schema: "/base/build/schemas/tei-simplified-rng.js",
  mode: {
    path: "wed/modes/test/test-mode",
    options: {
      metadata: "/base/build/schemas/tei-metadata.json",
    },
  },
  // You certainly do not want this in actual deployment.
  ajaxlog: {
    url: "/build/ajax/log.txt",
  },
};
