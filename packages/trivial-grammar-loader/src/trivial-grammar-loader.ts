/**
 * A trivial grammar loader.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { inject, injectable } from "inversify";
import { convertRNGToPattern, Grammar, readTreeFromJSON } from "salve";

import { GrammarLoader, Runtime } from "@wedxml/client-api";
import { RUNTIME } from "@wedxml/common/tokens";

export const version = "5.0.0-alpha.28";

/**
 * A grammar loader capable of loading a serialized representation of a Relax NG
 * grammar or an a grammar represented as an XML file in the RNG format.
 *
 * This loader does not have any bells and whistles. It merely loads what you
 * ask it to load. For instance, it does not cache results.
 */
@injectable()
export class TrivialGrammarLoader implements GrammarLoader {
  constructor(@inject(RUNTIME) private readonly runtime: Runtime) {}

  async load(path: string | URL): Promise<Grammar> {
    const schemaText = await this.runtime.resolveToString(path.toString());
    let schema: Grammar | undefined;
    // Minimal heuristic to determine whether we should convert from a JSON
    // serialization.
    if (/\s*[{(]/.test(schemaText)) {
      try {
        schema = readTreeFromJSON(schemaText);
      }
      catch {
        // If it fails, the assumption is that we're not dealing with a JSON
        // file and we'll try with ``convertRNGToPattern``.
      }
    }

    if (schema === undefined) {
      schema = (await convertRNGToPattern(new URL(path.toString(),
                                                  window.location.href)))
        .pattern;
    }

    return schema;
  }
}
