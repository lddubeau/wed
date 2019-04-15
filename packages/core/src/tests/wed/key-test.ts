/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import * as keyMod from "wed/key";

const assert = chai.assert;

describe("key", () => {
  let key: typeof keyMod;
  let frame: HTMLIFrameElement;
  let frameWindow: Window;

  const browsers = {
    CHROME_31: false,
    MISE: false,
    OSX: false,
    __esModule: true,
  };

  // We load the module into a frame so that we can give it a fake ``browsers``
  // module.
  before(done => {
    frame = document.createElement("iframe");
    document.body.appendChild(frame);
    frameWindow = frame.contentWindow!;
    // We need <base> in the following code so that the proper protocol
    // is set when resolving the relative paths.
    /* tslint:disable:no-any */
    const absoluteTopDir = (window as any).__karma__.config.absoluteTopDir;
    /* tslint:enable:no-any */

    frame.addEventListener("load", () => {
      // tslint:disable-next-line:no-any
      const SystemJS = (frameWindow as any).SystemJS;
      // tslint:disable-next-line:no-any
      SystemJS.config((window as any).systemJSConfig);
      // This will be loaded instead of the real module. We have to create an
      // array like we do here due to the frame being a separate JS VM.
      SystemJS.amdDefine(
        SystemJS.normalizeSync("npm:@wedxml/common/browsers.js"),
        // tslint:disable-next-line:prefer-array-literal no-any
        new (frameWindow as any).Array(),
        browsers);
      SystemJS.import("wed/key").then((_key: typeof keyMod) => {
        key = _key;
        done();
      }).catch(done);
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

  after(() => {
    document.body.removeChild(frame);
  });

  describe("makeKey", () => {
    it("makes a key", () => {
      const k = key.makeKey(1, true, 2, 3, true, false, true, key.EITHER);
      assert.equal(k.which, 1);
      assert.equal(k.keyCode, 2);
      assert.equal(k.charCode, 3);
      assert.equal(k.ctrlKey, true);
      assert.equal(k.altKey, false);
      assert.equal(k.metaKey, true);
      assert.equal(k.shiftKey, key.EITHER);
      assert.equal(k.keypress, true);
    });

    it("sets sensible defaults", () => {
      const k = key.makeKey(1);
      assert.equal(k.which, 1);
      assert.equal(k.keyCode, 1);
      assert.equal(k.charCode, 1);
      assert.equal(k.ctrlKey, false);
      assert.equal(k.altKey, false);
      assert.equal(k.metaKey, false);
      assert.equal(k.shiftKey, key.EITHER);
      assert.equal(k.keypress, true);
    });

    it("returns the same value for same parameters", () => {
      const k1 = key.makeKey(1, true, 2, 3, true, false, true);
      const k2 = key.makeKey(1, true, 2, 3, true, false, true);
      assert.equal(k1, k2);
      const k3 = key.makeKey(1, true, 2, 3, true, false, true, key.EITHER);
      assert.equal(k1, k3);
    });
  });

  describe("makeCtrlKey", () => {
    it("makes a control key", () => {
      const k = key.makeCtrlKey(1);
      assert.equal(k.which, 1);
      assert.equal(k.keyCode, 1);
      assert.equal(k.charCode, 0);
      assert.equal(k.ctrlKey, true);
      assert.equal(k.altKey, false);
      assert.equal(k.metaKey, false);
      assert.equal(k.shiftKey, key.EITHER);
      assert.equal(k.keypress, false);
    });
  });

  describe("makeMetaKey", () => {
    it("makes a meta key", () => {
      const k = key.makeMetaKey(1);
      assert.equal(k.which, 1);
      assert.equal(k.keyCode, 1);
      assert.equal(k.charCode, 0);
      assert.equal(k.ctrlKey, false);
      assert.equal(k.altKey, false);
      assert.equal(k.metaKey, true);
      assert.equal(k.shiftKey, key.EITHER);
      assert.equal(k.keypress, false);
    });
  });

  describe("makeCtrlEqKey", () => {
    it("makes a control key on non-OSX platforms", () => {
      const k = key.makeCtrlEqKey(1);
      assert.equal(k, key.makeCtrlKey(1));
    });

    it("makes a meta key on OSX platforms", () => {
      browsers.OSX = true;
      const k = key.makeCtrlEqKey(1);
      assert.equal(k, key.makeMetaKey(1));
    });

    afterEach(() => {
      browsers.OSX = false;
    });
  });

  describe("Key", () => {
    describe("anyModifier", () => {
      it("returns true if any modifier is set", () => {
        // We set shift true here to show it does not impact anyModifier.
        let k = key.makeCtrlKey(1, true);
        assert.isTrue(k.anyModifier());

        k = key.makeKey(1, false, 2, 3, false, true, false);
        assert.isTrue(k.anyModifier());

        k = key.makeKey(1, false, 2, 3, false, false, true);
        assert.isTrue(k.anyModifier());
      });
    });

    describe("matchesEvent", () => {
      it("matches keydown/keyup keys, with unspecified shift", () => {
        const k = key.makeCtrlKey(1);
        // tslint:disable-next-line:no-object-literal-type-assertion
        const event = {
          which: 1,
          keyCode: 1,
          charCode: 0,
          ctrlKey: true,
          altKey: false,
          metaKey: false,
          shiftKey: false,
          type: "keydown",
        } as KeyboardEvent;
        assert.isTrue(k.matchesEvent(event));

        // Matches keyup too.
        // tslint:disable-next-line:no-any
        (event as any).type = "keyup";
        assert.isTrue(k.matchesEvent(event));

        // Shift state does not matter.
        // tslint:disable-next-line:no-any
        (event as any).shiftKey = true;
        assert.isTrue(k.matchesEvent(event));
      });

      it("matches keydown/keyup keys, with specified shift", () => {
        const k = key.makeCtrlKey(1, true);
        // tslint:disable-next-line:no-object-literal-type-assertion
        const event = {
          which: 1,
          keyCode: 1,
          charCode: 0,
          ctrlKey: true,
          altKey: false,
          metaKey: false,
          shiftKey: true,
          type: "keydown",
        } as KeyboardEvent;
        assert.isTrue(k.matchesEvent(event));

        // Matches keyup too.
        // tslint:disable-next-line:no-any
        (event as any).type = "keyup";
        assert.isTrue(k.matchesEvent(event));

        // Shift state matters.
        // tslint:disable-next-line:no-any
        (event as any).shiftKey = false;
        assert.isFalse(k.matchesEvent(event));
      });

      it("matches a keypress key", () => {
        const k = key.makeKey(1);
        // tslint:disable-next-line:no-object-literal-type-assertion
        const event = {
          which: 1,
          keyCode: 1,
          charCode: 1,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          shiftKey: false,
          type: "keypress",
        } as KeyboardEvent;
        assert.isTrue(k.matchesEvent(event));

        // Shift state does not matter.
        // tslint:disable-next-line:no-any
        (event as any).shiftKey = true;
        assert.isTrue(k.matchesEvent(event));
      });

      it("returns false when not matching an event", () => {
        const k = key.makeCtrlKey(1);
        // tslint:disable-next-line:no-object-literal-type-assertion
        assert.isFalse(k.matchesEvent({
          which: 1,
          keyCode: 1,
          charCode: 1,
          ctrlKey: false,
          altKey: false,
          metaKey: false,
          shiftKey: false,
        } as KeyboardEvent));
      });
    });

    describe("setEventToMatch", () => {
      it("sets an event to match a ctrl key, with unspecified shift", () => {
        // tslint:disable-next-line:no-object-literal-type-assertion
        const event = {} as KeyboardEvent;
        const k = key.makeCtrlKey(1);
        k.setEventToMatch(event);
        assert.isTrue(k.matchesEvent(event));
        // Biased towards keydown
        assert.equal(event.type, "keydown");
        assert.isUndefined(event.shiftKey);
      });

      it("sets an event to match a ctrl key, with specified shift", () => {
        // tslint:disable-next-line:no-object-literal-type-assertion
        const event = {} as KeyboardEvent;
        const k = key.makeCtrlKey(1, true);
        k.setEventToMatch(event);
        assert.isTrue(k.matchesEvent(event));
        // Biased towards keydown
        assert.equal(event.type, "keydown");
        assert.equal(event.shiftKey, true);
      });

      it("sets an event to match a keypress", () => {
        // tslint:disable-next-line:no-object-literal-type-assertion
        const event = {} as KeyboardEvent;
        const k = key.makeKey(1);
        k.setEventToMatch(event);
        assert.isTrue(k.matchesEvent(event));
        assert.isUndefined(event.shiftKey);
      });
    });
  });
});

//  LocalWords:  ctrl setEventToMatch keypress keydown matchesEvent keyup chai
//  LocalWords:  anyModifier makeCtrlKey makeKey Dubeau MPL Mangalam Ctrl
