/**
 * The error handler for wed.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import $ from "jquery";

import { Editor } from "./editor";
import * as log from "./log";

/* tslint:disable:no-any */

// tslint:disable-next-line:no-typeof-undefined
const test = (typeof __WED_TESTING !== "undefined") && __WED_TESTING.testing;

const $modal = $(`\
<div class="modal wed-fatal-modal" style="position: absolute" tabindex="1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal"
aria-hidden="true">&times;</button>
        <h3>Fatal Error</h3>
      </div>
      <div class="modal-body">
        <div class="save-messages"></div>
        <div class="error-message"></div>
      </div>
      <div class="modal-footer">
        <a href="#" class="btn btn-primary" data-dismiss="modal">Reload</a>
      </div>
    </div>
  </div>
</div>`);

let terminating = false;
let terminationTimeout: number | undefined;
let terminationWindow: Window;

// Normally onerror will be reset by reloading but when testing with mocha we
// don't want reloading, so we export this function.
function reset(): void {
  terminating = false;
  if (terminationTimeout !== undefined) {
    terminationWindow.clearTimeout(terminationTimeout);
    terminationTimeout = undefined;
  }
  $modal.off();
  $modal.modal("hide");
  $modal.remove();
}

/**
 * @returns True if the error handling code was triggered.
 */
export function isTerminating(): boolean {
  return terminating;
}

/**
 * A structure used only for testing purposes.
 *
 * @private
 */
// tslint:disable-next-line:variable-name
export const __test = test ? {
    $modal,
    reset,
} : undefined;

/**
 * An array into which wed editors register themselves at creation and
 * unregister themselves when destroyed.
 */
export const editors: Editor[] = [];

const TERMINATION_TIMEOUT = 5000;
  // So that we can issue clearTimeout elsewhere.

function showModal(saveMessages: string, errorMessage: string): void {
  $(document.body).append($modal);
  // tslint:disable-next-line:no-inner-html
  $modal.find(".save-messages")[0].innerHTML = saveMessages;
  $modal.find(".error-message")[0].textContent = errorMessage;
  $modal.on("hide.bs.modal.modal", () => {
    $modal.remove();
    window.location.reload();
  });
  $modal.modal();
}

function eventToMessage(ev: any): string {
  let msg = "";
  if (ev.type === "error") {
    const { message, filename, lineno, colno, error: err } = ev;

    if (err) {
      msg = err.stack;
    }
    else {
      msg = `${filename}:${lineno}`;
      if (colno) {
        msg += `.${colno}`;
      }
      msg += `: ${message}`;
    }
  }
  else {
    msg += "Unhandled promise rejection!\n";
    const source = ev.promise ? ev : ev.detail;
    if (source) {
      const { reason, promise } = source;
      if (reason) {
        msg += `Reason: ${reason.stack ? `\n${reason.stack}` : reason}`;
      }
      else if (promise) {
        msg += `Promise: ${promise}`;
      }
    }
  }
  return msg;
}

/**
 * Converts a save operation result to a message.
 *
 * @param name The name of the editor instance.
 * @param result The result of the save operation.
 *
 * @returns The message.
 */
function toMsg(name?: string, result?: boolean): string {
  let ret = `\
<p>${name !== undefined ? name : "Your editor"} experienced a severe error.`;
  ret += result === true ?
           ` However, it successfully saved the latest state of your data to \
the server. Please reload.` :
           ` It was not able to save your data to the server before \
terminating.`;
  return `${ret}</p>`;
}

function _handler(ev: any): boolean {
  ev.preventDefault();
  // This avoids an infinite loop.
  if (terminating) {
    return false;
  }
  terminating = true;

  const errorMessage = eventToMessage(ev);

  const total = editors.length;
  const root = window;

  function terminate(results: [Editor, any][]): void {
    if (terminationTimeout !== undefined) {
      root.clearTimeout(terminationTimeout);
    }

    const messages: string[] = [];
    if (total === 1) {
      messages.push(toMsg(undefined,
                          results.length !== 0 ? results[0][1] : undefined));
    }
    else {
      for (const result of results) {
        messages.push(toMsg(result[0].name, result[1]));
      }
    }
    showModal(messages.join(""), errorMessage);
  }

  terminationTimeout = root.setTimeout(terminate, TERMINATION_TIMEOUT);
  terminationWindow = root;

  // tslint:disable-next-line:no-console
  console.error(errorMessage);
  log.error(errorMessage);

  // tslint:disable-next-line:no-floating-promises
  Promise.all(editors
    .map(editor =>
         (async (): Promise<[Editor, any]> => {
           try {
             return [editor, await editor.saver.recover()];
           }
           catch {
             return [editor, undefined];
           }
         })()))
    .then(terminate);

  return false;
}

/**
 * This is the error handler meant to be used to trap wed errors.
 */
export function handler(ev: any): void {
  try {
    try {
      _handler(ev);
    }
    catch (ex) {
      showModal("",
                `Error while trying to handle fatal error: ${ex.toString()}`);
    }
  }
  catch (ex) {
  // tslint:disable-next-line:no-console
    console.error("Error while trying to handle fatal error:");
  // tslint:disable-next-line:no-console
    console.error(ex);
  }
}

//  LocalWords:  clearTimeout unregister iframe RequireJS href MPL
//  LocalWords:  onerror Mangalam Dubeau validthis jshint btn jquery
//  LocalWords:  tabindex jQuery
