/**
 * Data saving functionality, using Ajax.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { inject, injectable } from "inversify";
import mergeOptions from "merge-options";

import { BaseSaver, SaverOptions } from "@wedxml/base-saver";
import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
import { Runtime, SaveError } from "@wedxml/client-api";
import { RUNTIME } from "@wedxml/common/tokens";

// We reexport it as a convenience.
export { SAVER_OPTIONS };

export const version = "1.0.0";

interface Message {
  command: string;
  version: string;
  data?: string;
}

interface Response {
  messages: SaveError[];
}

interface ParsedResponse {
  [key: string]: SaveError;
}

/**
 * Processes a list of messages received from the server.
 *
 * @param data The data received from the server.
 *
 * @returns An object which has for field names message types and for field
 * values a message of the corresponding type.
 *
 * @throws {Error} If there is more than one message of the same type in the
 * data being processed.
 */
function getMessages(data: Response): ParsedResponse | undefined {
  const raw = data.messages;
  if (raw === undefined || raw.length === 0) {
    return undefined;
  }

  const ret: ParsedResponse = {};
  for (const msg of raw) {
    // When we parse responses from the server it is not possible to get an
    // answer for which msg.type is undefined.
    // tslint:disable-next-line:no-non-null-assertion
    const errType = msg.type!;
    if (ret[errType] !== undefined) {
      throw new Error("same type of message appearing more than " +
                      "once in one transaction");
    }
    ret[errType] = msg;
  }

  return ret;
}

export interface Options extends SaverOptions {
  /** The URL location to POST save requests. */
  url: string;

  /**
   * Headers to set on the POST request. This may be necessary for cross
   * domain request protection, for instance.
   */
  headers?: Record<string, string>;

  /** The initial ETag to use. */
  initial_etag?: string;
}

/**
 * A saver responsible for communicating with a server to save the data edited
 * by a wed editor.
 *
 * @param runtime The runtime under which this saver is created.
 *
 * @param options The options specific to this class.
 */
@injectable()
export class AjaxSaver extends BaseSaver {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private etag: string | undefined;

  constructor(@inject(RUNTIME) protected readonly runtime: Runtime,
              @inject(SAVER_OPTIONS) protected readonly options: Options) {
    super(runtime, options);

    const headers = options.headers;
    this.headers = headers != null ? headers : {};
    // This value is saved with the double quotes around it so that we can just
    // pass it to 'If-Match'.
    const initial_etag = options.initial_etag;
    this.etag = initial_etag != null ? `"${initial_etag}"` : undefined;
    this.url = options.url;
  }

  async _init(): Promise<void> {
    let response: Response;
    try {
      response = await this._post({ command: "check", version: this.version },
                                  "json");
    }
    catch {
      // This effectively aborts the editing session. This is okay, since
      // there's a good chance that the issue is major.
      throw new Error(`${this.url} is not responding to a check; \
saving is not possible.`);
    }

    const msgs = getMessages(response);
    if (msgs !== undefined && msgs.version_too_old_error !== undefined) {
      this._fail({ type: "too_old", msg: "" });

      return;
    }

    this.initialized = true;
    this.failed = false;
  }

  async _save(autosave: boolean): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // We must store this value now because a modifying operation could occur
    // after the data is sent to the server but before we can be sure the data
    // is saved.
    const savingGeneration = this.currentGeneration;

    let response: Response;
    try {
      response = await this._post({
        command: autosave ? "autosave" : "save",
        version: this.version,
        data: this.getData(),
      }, "json");
    }
    catch {
      const error = {
        msg: "Your browser cannot contact the server",
        type: "save_disconnected",
      };
      this._fail(error);

      return;
    }

    const msgs = getMessages(response);
    if (msgs === undefined) {
      this._fail();
      throw new Error(`The server accepted the save request but did \
not return any information regarding whether the save was successful or not.`);
    }

    if (msgs.save_fatal_error !== undefined) {
      this._fail();
      throw new Error(`The server was not able to save the data due to \
a fatal error. Please contact technical support before trying to edit again.`);
    }

    if (msgs.save_transient_error !== undefined) {
      this._events.next({ name: "Failed", error: msgs.save_transient_error });

      return;
    }

    if (msgs.save_edited !== undefined) {
      this._fail(msgs.save_edited);

      return;
    }

    if (msgs.save_successful === undefined) {
      this._fail();
      throw new Error(`Unexpected response from the server while \
saving. Please contact technical support before trying to edit again.`);
    }

    if (msgs.version_too_old_error !== undefined) {
      this._fail({ type: "too_old", msg: "" });

      return;
    }

    this._saveSuccess(autosave, savingGeneration);
  }

  async _recover(): Promise<boolean> {
    let data: Response;
    try {
      data = await this._post({
        command: "recover",
        version: this.version,
        data: this.getData(),
      }, "json");
    }
    catch {
      return false;
    }

    const msgs = getMessages(data);

    return !((msgs === undefined)  ||
             (msgs.save_fatal_error !== undefined) ||
             (msgs.save_successful === undefined));
  }

  /**
   * Utility wrapper for Ajax queries. Read the code for more information.
   *
   * @private
   *
   * @param data
   * @param dataType
   *
   * @returns A promise that resolves when the post is over.
   */
  private async _post(data: Message, dataType: string): Promise<Response> {
    let headers;

    if (this.etag !== undefined) {
      headers = mergeOptions(this.headers, {
        "If-Match": this.etag,
      });
    }
    else {
      headers = this.headers;
    }

    try {
      const [reply, , jqXHR] = await this.runtime.ajax({
        type: "POST",
        url: this.url,
        data: data,
        dataType: dataType,
        headers: headers,
        bluejaxOptions: {
          verboseResults: true,
        },
      });

      const msgs = getMessages(reply);
      // Unsuccessful operations don't have a valid etag.
      if (msgs !== undefined && msgs.save_successful !== undefined) {
        this.etag = jqXHR.getResponseHeader("ETag");
      }

      return reply;
    }
    catch (bluejaxError) {
      const jqXHR = bluejaxError.jqXHR;
      // This is a case where a precondition failed.
      if (jqXHR.status === 412) {
        // We transform the 412 status into a Response object that will
        // produce the right reaction.
        return {
          messages: [{
            msg: "The document was edited by someone else.",
            type: "save_edited",
          }],
        };
      }
      throw bluejaxError;
    }
  }
}

//  LocalWords:  MPL ETag runtime etag json url autosave
