/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";
import sinon from "sinon";
import * as onbeforeunloadMod from "wed/onbeforeunload";

const assert = chai.assert;

// We need any in a bunch of places here.
// tslint:disable:no-any

describe("onbeforeunload", () => {
  let onbeforeunload: typeof onbeforeunloadMod;
  let frame: HTMLIFrameElement;
  let frameWindow: Window;

  beforeEach(done => {
    frame = document.createElement("iframe");
    document.body.appendChild(frame);
    frameWindow = frame.contentWindow!;
    // We need <base> in the following code so that the proper protocol
    // is set when resolving the relative paths.
    const absoluteTopDir = (window as any).__karma__.config.absoluteTopDir;

    frame.addEventListener("load", () => {
      // tslint:disable-next-line:no-any
      const SystemJS = (frameWindow as any).SystemJS;
      // tslint:disable-next-line:no-any
      SystemJS.config((window as any).systemJSConfig);
      // tslint:disable-next-line:no-console
      SystemJS.import("wed/onbeforeunload")
        .then((_onbeforeunload: typeof onbeforeunloadMod) => {
          onbeforeunload = _onbeforeunload;
          done();
        })
        .catch(done);
    });

    // We used to set src with a URL created from a blob, but in Chrome 71 for
    // some reason the frame was not loading when using Chrome Headless. So we
    // switched to srcdoc. This is not supported on Edge prior to 18 (and maybe
    // not even on 18) but we don't run this suite on Edge, and with the MS
    // announcement that Edge will use Chrome guts the issue is mostly moot.
    frame.srcdoc = `
<html>
  <base href="${window.location.origin}"></base>
  <head>
    <script src="${absoluteTopDir}\
/node_modules/systemjs/dist/system.src.js"></script>
  </head>
  <body>
  </body>
</html>`;
  });

  afterEach(() => {
    document.body.removeChild(frame);
  });

  it("does not automatically install itself on window", () => {
    assert.isNull(frameWindow.onbeforeunload);
  });

  describe("install", () => {
    it("fails when already set and force is not set", () => {
      onbeforeunload.install(frameWindow);
      // Upon upgrading from Chai 3.5.0 to 4.1.2 this fails. The problem is that
      // isCompatibleConstructor in check-error is too strict. It checks whether
      // the parameter passed to throws is an instance of Error, which fails due
      // to the error being raised in a frame.
      //
      // assert.throws(onbeforeunload.install.bind(undefined, frameWindow),
      //               (frameWindow as any).Error,
      //               /^reregistering window with `force` false$/);
      let e: any;
      try {
        onbeforeunload.install(frameWindow);
      }
      catch (_e) {
        e = _e;
      }
      assert.instanceOf(e, (frameWindow as any).Error);
      assert.equal(e.message, "reregistering window with `force` false");
    });

    it("works when force is set", () => {
      onbeforeunload.install(frameWindow);
      onbeforeunload.install(frameWindow, undefined, true);
      assert.isTrue(frameWindow.onbeforeunload!.call(frameWindow,
                                                     undefined as any));
    });

    it("a true check results in a prompt", () => {
      const check = sinon.stub();
      check.returns(true);

      onbeforeunload.install(frameWindow, check, true);
      assert.isTrue(frameWindow.onbeforeunload!.call(frameWindow,
                                                     undefined as any));
      assert.isTrue(check.calledOnce);
    });

    it("a false check does not result in a prompt", () => {
      const check = sinon.stub();
      check.returns(false);

      onbeforeunload.install(frameWindow, check, true);
      assert.isUndefined(frameWindow.onbeforeunload!.call(frameWindow,
                                                          undefined as any));
      assert.isTrue(check.calledOnce);
    });
  });
});

//  LocalWords:  chai Dubeau MPL Mangalam
