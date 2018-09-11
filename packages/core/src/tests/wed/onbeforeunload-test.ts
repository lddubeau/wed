/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
"use strict";
import * as sinon from "sinon";
import * as onbeforeunloadMod from "wed/onbeforeunload";

const assert = chai.assert;

// We need any in a bunch of places here.
// tslint:disable:no-any

describe("onbeforeunload", () => {
  let onbeforeunload: typeof onbeforeunloadMod;
  let frame: HTMLIFrameElement;
  let frameWindow: Window;

  beforeEach((done) => {
    frame = document.createElement("iframe");
    document.body.appendChild(frame);
    frameWindow = frame.contentWindow!;
    // We need <base> in the following code so that the proper protocol
    // is set when resolving the relative paths.
    const absoluteTopDir = (window as any).__karma__.config.absoluteTopDir;
    const frameSrc = `
<html>
  <base href="${window.location.origin}"></base>
  <head>
    <script src="${absoluteTopDir}\
/node_modules/systemjs/dist/system.src.js"></script>
  </head>
  <body>
  </body>
</html>`;

    frame.addEventListener("load", () => {
      // tslint:disable-next-line:no-any
      const SystemJS = (frameWindow as any).SystemJS;
      // tslint:disable-next-line:no-any
      SystemJS.config((window as any).systemJSConfig);
      SystemJS.import("wed/onbeforeunload")
        .then((_onbeforeunload: typeof onbeforeunloadMod) => {
          onbeforeunload = _onbeforeunload;
          done();
        });
    });
    frame.src = URL.createObjectURL(new Blob([frameSrc],
                                             { type: "text/html" }));
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
