/**
 * Ajax utilities for wed.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import "bootstrap";
import { ConnectivityError, DiagnoseOptions, fetch, FetchiestOptions,
         FetchiestRequestInit } from "fetchiest";
import $ from "jquery";

// tslint:disable-next-line:no-any
export function suppressUnhandledRejections<P extends Promise<any>>(p: P): P {
  // tslint:disable-next-line:no-any
  const pAsAny = p as any;
  if (pAsAny.suppressUnhandledRejections) {
    pAsAny.suppressUnhandledRejections();
  }

  return p;
}

// tslint:disable-next-line:no-jquery-raw-elements
const $modal = $("\
<div class='modal btw-fatal-modal' style='position: absolute' tabindex='1'>\
  <div class='modal-dialog'>\
    <div class='modal-content'>\
      <div class='modal-header'>\
        <button type='button' class='close' data-dismiss='modal'\
aria-hidden='true'>&times;</button>\
        <h3>Connectivity Problem</h3>\
      </div>\
      <div class='modal-body'>\
        <p>We have detected a connectivity problem: \
           <span class='reason'></span>.</p>\
        <p>When you click the Ok button, we will recheck the connectivity. \
           If there is still a problem, this dialog will remain. Otherwise, \
           the window will be reloaded. If you were modifying information \
           on the \
           site when the outage occurred, please verify that what you were \
           trying to do actually happened.</p>\
      </div>\
      <div class='modal-footer'>\
        <a href='#' class='btn btn-primary' data-dismiss='modal'>Ok</a>\
      </div>\
    </div>\
  </div>\
</div>");

const modal = $modal[0];

// tslint:disable:no-any
export type FetchCall = typeof fetch;

export interface MakeOptions extends FetchiestOptions {
  diagnose: DiagnoseOptions;
}

export function make(opts: MakeOptions): FetchCall {

  const diagnoseOpts = opts.diagnose;
  let { serverURL } = diagnoseOpts;
  delete diagnoseOpts.serverURL;

  if (serverURL === undefined) {
    serverURL = "";
  }

  return async function fetch$(input: RequestInfo,
                               init?: FetchiestRequestInit): Promise<Response> {
    const fetchiestOptions =
      init !== undefined && init.fetchiestOptions !== undefined ? {
        ...opts,
        ...init.fetchiestOptions,
      } : opts;

    let response: Response;
    try {
      response = await fetch(input, {
        ...init,
        fetchiestOptions,
      });
    }
    catch (err) {
      if (err instanceof ConnectivityError) {
        document.body.appendChild(modal);
        // tslint:disable-next-line:no-non-null-assertion
        const reason = modal.querySelector("span.reason")!;
        reason.textContent = err.message;
        $modal.on("hide.bs.modal.modal", (ev: JQueryEventObject) => {
          ev.stopPropagation();
          ev.preventDefault();
          // tslint:disable-next-line:no-floating-promises
          suppressUnhandledRejections(
            // tslint:disable-next-line:no-non-null-assertion
            fetch(serverURL!, {
              fetchiestOptions: {
                diagnose: diagnoseOpts,
              },
            }).then(() => {
              window.location.reload();
            }));
        });
        $modal.modal();
      }

      throw err;
    }

    if (!response.ok) {
      const err = new Error(`cannot retreive: ${response.url}`);
      (err as any).response = response;
      throw err;
    }

    return response;
  };
}

//  LocalWords:  btw tabindex href btn MPL
