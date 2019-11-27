/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { CaretManager } from "wed/caret-manager";
import { Editor } from "wed/editor";
import * as keyConstants from "wed/key-constants";

import { waitForSuccess } from "@wedxml/common/test/util";
import * as globalConfig from "../base-config";
import { dataPath, EditorSetup } from "../wed-test-util";

const assert = chai.assert;

describe("wed file state:", () => {
  let setup: EditorSetup;
  let editor: Editor;
  let caretManager: CaretManager;
  let $modificationStatus: JQuery;
  let $saveStatus: JQuery;
  let titles: HTMLCollectionOf<Element>;

  beforeEach(async () => {
    setup = new EditorSetup(`${dataPath}/wed_test_data/source_converted.xml`,
                            globalConfig.config,
                            document);
    ({ editor } = setup);
    await setup.init();

    // tslint:disable-next-line:no-any
    (editor.validator as any)._validateUpTo(editor.dataRoot, -1);
    caretManager = editor.caretManager;
    // tslint:disable-next-line:no-any
    $modificationStatus = (editor as any).$modificationStatus;
    // tslint:disable-next-line:no-any
    $saveStatus = (editor as any).$saveStatus;
    titles = editor.guiRoot.getElementsByClassName("title");
  });

  afterEach(() => {
    setup.restore();
  });

  it("modification status shows an unmodified document when starting", () => {
    assert.isTrue($modificationStatus.hasClass("badge-success"));
  });

  it("save status shows an unsaved document when starting", () => {
    assert.isTrue($saveStatus.hasClass("badge-dark"));
    assert.equal($saveStatus.children("span").text(), "");
  });

  it("onbeforeunload returns falsy on unmodified doc", () => {
    assert.isFalse(!!editor.window.onbeforeunload!
                   // tslint:disable-next-line:no-any
                   .call(editor.window, undefined as any) as any);
  });

  it("modification status shows a modified document after modification", () => {
    // Text node inside title.
    const initial = titles[0].childNodes[1];
    caretManager.setCaret(initial, 0);
    editor.type(" ");

    assert.isTrue($modificationStatus.hasClass("badge-warning"));
  });

  it("onbeforeunload returns truthy on modified doc", () => {
    // Text node inside title.
    const initial = titles[0].childNodes[1];
    caretManager.setCaret(initial, 0);
    editor.type(" ");

    assert.isTrue(!!editor.window.onbeforeunload!
                   // tslint:disable-next-line:no-any
                  .call(editor.window, undefined as any));
  });

  it("modification status shows an unmodified document after save", () => {
    // Text node inside title.
    const initial = titles[0].childNodes[1];
    caretManager.setCaret(initial, 0);
    editor.type(" ");

    assert.isTrue($modificationStatus.hasClass("badge-warning"));
    editor.type(keyConstants.SAVE);
    return waitForSuccess(() => {
      assert.isTrue($modificationStatus.hasClass("badge-success"));
    });
  });

  it("save status shows a saved document after a save", () => {
    assert.isTrue($saveStatus.hasClass("badge-dark"));
    assert.equal($saveStatus.children("span").text(), "");

    editor.type(keyConstants.SAVE);
    return waitForSuccess(() => {
      assert.isTrue($saveStatus.hasClass("badge-success"));
      assert.equal($saveStatus.children("span").text(), "moments ago");
      // We also check the tooltip text.
      assert.equal($saveStatus.data("bs.tooltip").getTitle(),
                   "The last save was a manual save.");
    });
  });

  it("save status shows a saved document after an autosave", () => {
    assert.isTrue($saveStatus.hasClass("badge-dark"));
    assert.equal($saveStatus.children("span").text(), "");

    // Text node inside title.
    const initial = titles[0].childNodes[1];
    caretManager.setCaret(initial, 0);
    editor.type(" ");
    editor.saver.setAutosaveInterval(50);
    return waitForSuccess(() => {
      assert.isTrue($saveStatus.hasClass("badge-info"));
      assert.equal($saveStatus.children("span").text(), "moments ago");
      // We also check the tooltip text.
      assert.equal($saveStatus.data("bs.tooltip").getTitle(),
                   "The last save was an autosave.");
    });
  });

  it("save status tooltip updated after a different kind of save", async () => {
    // Text node inside title.
    const initial = titles[0].childNodes[1];
    caretManager.setCaret(initial, 0);
    editor.type(" ");
    editor.saver.setAutosaveInterval(50);
    await waitForSuccess(() => {
      // We check the initial tooltip text.
      const tooltip = $saveStatus.data("bs.tooltip");
      assert.isDefined(tooltip);
      assert.equal(tooltip.getTitle(), "The last save was an autosave.");
    });

    // Now perform a save.
    editor.type(keyConstants.SAVE);

    return waitForSuccess(() => {
      // We check the tooltip changed.
      const tooltip = $saveStatus.data("bs.tooltip");
      assert.isDefined(tooltip);
      assert.equal(tooltip.getTitle(), "The last save was a manual save.");
    });
  });
});
