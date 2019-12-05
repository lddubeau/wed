/**
 * Basic decoration facilities.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { inject, injectable } from "inversify";
import $ from "jquery";

import { EDITOR_INSTANCE, MODE } from "@wedxml/common/tokens";

import { isRealElement} from "./convert";
import { DLoc } from "./dloc";
import { DOMListener } from "./domlistener";
import { isAttr } from "./domtypeguards";
import * as  domutil from "./domutil";
import { GUIUpdater } from "./gui-updater";
import { Mode } from "./mode";
import { ContextMenuHandler, DecoratorAPI, EditorAPI } from "./mode-api";

function tryToSetDataCaret(editor: EditorAPI, dataCaret: DLoc): void {
  try {
    editor.caretManager.setCaret(dataCaret, { textEdit: true });
  }
  catch (e) {
    // Do nothing.
  }
}

function attributeSelectorMatch(selector: string, name: string): boolean {
  return selector === "*" || selector === name;
}

/**
 * A decorator is responsible for adding decorations to a tree of DOM
 * elements. Decorations are GUI elements.
 */
@injectable()
export abstract class Decorator implements DecoratorAPI {
  protected readonly namespaces: Record<string, string>;
  protected readonly domlistener: DOMListener;
  protected readonly guiUpdater: GUIUpdater;

  /**
   * @param domlistener The listener that the decorator must use to know when
   * the DOM tree has changed and must be redecorated.
   *
   * @param editor The editor instance for which this decorator was created.
   *
   * @param guiUpdater The updater to use to modify the GUI tree. All
   * modifications to the GUI must go through this updater.
   */
  constructor(@inject(MODE) protected readonly mode: Mode,
              @inject(EDITOR_INSTANCE) protected readonly editor: EditorAPI) {
    this.domlistener = editor.domlistener;
    this.guiUpdater = editor.guiUpdater;
    this.namespaces = mode.getAbsoluteNamespaceMappings();
  }

  /**
   * Request that the decorator add its event handlers to its listener.
   */
  abstract addHandlers(): void;

  /**
   * Start listening to changes to the DOM tree.
   */
  startListening(): void {
    this.domlistener.startListening();
  }

  listDecorator(el: Element, sep: string | Element): void {
    if (this.editor.modeTree.getMode(el) !== this.mode) {
      // The element is not governed by this mode.
      return;
    }

    const dataNode = this.editor.toDataNode(el) as Element;
    // We expect to work with a homogeneous list. That is, all children the same
    // element.
    const nameMap: Record<string, number> = Object.create(null);
    let child = dataNode.firstElementChild;
    while (child !== null) {
      nameMap[child.tagName] = 1;
      child = child.nextElementSibling;
    }

    const tags = Object.keys(nameMap);
    if (tags.length > 1) {
      throw new Error("calling listDecorator on a non-homogeneous list.");
    }

    if (tags.length === 0) {
      return;
    } // Nothing to work with

    // First drop all children that are separators
    child = el.firstElementChild;
    while (child !== null) {
      // Grab it before the node is removed.
      const next = child.nextElementSibling;
      if (child.hasAttribute("data-wed--separator-for")) {
        this.guiUpdater.removeNode(child);
      }
      child = next;
    }

    const tagName = tags[0];

    // If sep is a string, create an appropriate div.
    let sepNode: Element;
    if (typeof sep === "string") {
      sepNode = el.ownerDocument!.createElement("div");
      sepNode.textContent = sep;
    }
    else {
      sepNode = sep;
    }

    sepNode.classList.add("_text");
    sepNode.classList.add("_phantom");
    sepNode.setAttribute("data-wed--separator-for", tagName);

    let first = true;
    child = el.firstElementChild;
    while (child !== null) {
      if (isRealElement(child)) {
        if (!first) {
          this.guiUpdater.insertBefore(el, sepNode.cloneNode(true) as Element,
                                       child);
        }
        else {
          first = false;
        }
      }
      child = child.nextElementSibling;
    }
  }

  makeStartLabel(doc: Document, cls: string,
                 contextMenuHandler: ContextMenuHandler | undefined,
                 html: string): HTMLElement {
    const label = doc.createElement("span");
    label.className =
      `_gui _phantom __start_label _start_wrapper ${cls} _label`;
    const inner = doc.createElement("span");
    inner.className = "_phantom";
    // tslint:disable-next-line:no-inner-html
    inner.innerHTML = html;
    label.appendChild(inner);

    $(label).on("wed-context-menu",
                contextMenuHandler !== undefined ? contextMenuHandler : false);

    return label;
  }

  makeEndLabel(doc: Document, cls: string,
               contextMenuHandler: ContextMenuHandler | undefined,
               html: string): HTMLElement {
    const label = doc.createElement("span");
    label.className = `_gui _phantom __end_label _end_wrapper ${cls} _label`;
    const inner = doc.createElement("span");
    inner.className = "_phantom";
    // tslint:disable-next-line:no-inner-html
    inner.innerHTML = html;
    label.appendChild(inner);

    $(label).on("wed-context-menu",
                contextMenuHandler !== undefined ? contextMenuHandler : false);

    return label;
  }

  // tslint:disable-next-line:max-func-body-length
  elementDecorator(_root: Element, el: Element, level: number,
                   preContextHandler: ContextMenuHandler | undefined,
                   postContextHandler: ContextMenuHandler | undefined): void {
    if (this.editor.modeTree.getMode(el) !== this.mode) {
      // The element is not governed by this mode.
      return;
    }

    if (level > this.editor.maxLabelLevel) {
      throw new Error(
        `level higher than the maximum set by the mode: ${level}`);
    }

    // Save the caret because the decoration may mess up the GUI caret.
    let dataCaret: DLoc | undefined = this.editor.caretManager.getDataCaret();
    if (dataCaret != null &&
        !(isAttr(dataCaret.node) &&
          dataCaret.node.ownerElement === domutil.getMirror(el))) {
      dataCaret = undefined;
    }

    const dataNode = domutil.mustGetMirror(el) as Element;
    this.setReadOnly(el, this.editor.isReadonly(dataNode));

    const origName = dataNode.tagName;
    // _[name]_label is used locally to make the function idempotent.
    let cls = `_${origName}_label`;

    // We must grab a list of nodes to remove before we start removing them
    // because an element that has a placeholder in it is going to lose the
    // placeholder while we are modifying it. This could throw off the scan.
    const toRemove = domutil.childrenByClass(el, cls);
    for (const remove of toRemove) {
      //
      // This is really a workaround for a problem with how the decorator
      // works. We should use this.guiUpdater.removeChild. However, when this
      // removal merges text nodes, it causes elementDecorator to be reentered
      // and this causes problems.
      //
      // The decoration code should be revamped to listen on the data tree
      // rather than listen on the GUI tree.
      //
      // Listening on the GUI tree may be desirable sometimes but it should not
      // be the default wed behavior.
      //
      this.guiUpdater.removeTooltips(remove);
      el.removeChild(remove);
    }

    cls += " __el_label";
    let attributesHTML = "";
    let hiddenAttributes = false;
    const attributeHandling = this.editor.modeTree.getAttributeHandling(el);
    if (attributeHandling === "show" || attributeHandling === "edit") {
      // include the attributes
      const attributes = dataNode.attributes;
      const names = dataNode.getAttributeNames().sort();

      for (const name of names) {
        const hideAttribute = this.mustHideAttribute(el, name);
        if (hideAttribute) {
          hiddenAttributes = true;
        }

        const extra = hideAttribute ? " _shown_when_caret_in_label" : "";

        attributesHTML += ` \
<span class="_phantom _attribute${extra}">\
<span class="_phantom _attribute_name">${name}</span>=\
"<span class="_phantom _attribute_value">\
${domutil.textToHTML(attributes.getNamedItem(name)!.value)}</span>"</span>`;
      }
    }

    const doc = el.ownerDocument!;
    cls += ` _label_level_${level}`;

    // Save the cls of the end label here so that we don't further modify it.
    const endCls = cls;

    if (hiddenAttributes) {
      cls += " _autohidden_attributes";
    }

    const pre = this.makeStartLabel(doc, cls, preContextHandler, `\
&nbsp;<span class='_phantom _element_name'>${origName}\
</span>${attributesHTML}<span class='_phantom _greater_than'> >&nbsp;</span>`);
    this.guiUpdater.insertNodeAt(el, 0, pre);

    const post = this.makeEndLabel(doc, endCls, postContextHandler, `\
<span class='_phantom _less_than'>&nbsp;&lt; </span>\
<span class='_phantom _element_name'>${origName}</span>&nbsp;`);
    this.guiUpdater.insertBefore(el, post, null);

    if (dataCaret != null) {
      tryToSetDataCaret(this.editor, dataCaret);
    }
  }

  piDecorator(_root: Element, pi: Element,
              preContextHandler: ContextMenuHandler | undefined,
              postContextHandler: ContextMenuHandler | undefined): void {
    if (this.editor.modeTree.getMode(pi) !== this.mode) {
      // The element is not governed by this mode.
      return;
    }

    const dataNode = domutil.mustGetMirror(pi) as ProcessingInstruction;
    const origName = dataNode.target;
    // _[name]_label is used locally to make the function idempotent.
    const nameCls = `_${origName}_label`;

    // We must grab a list of nodes to remove before we start removing them
    // because an element that has a placeholder in it is going to lose the
    // placeholder while we are modifying it. This could throw off the scan.
    const toRemove = domutil.childrenByClass(pi, nameCls);
    for (const remove of toRemove) {
      //
      // This is really a workaround for a problem with how the decorator
      // works. We should use this.guiUpdater.removeChild. However, when this
      // removal merges text nodes, it causes elementDecorator to be reentered
      // and this causes problems.
      //
      // The decoration code should be revamped to listen on the data tree
      // rather than listen on the GUI tree.
      //
      // Listening on the GUI tree may be desirable sometimes but it should not
      // be the default wed behavior.
      //
      pi.removeChild(remove);
    }

    const doc = pi.ownerDocument!;

    const cls = `__pi_label ${nameCls}`;
    const pre = this.makeStartLabel(doc, cls, preContextHandler, `\
&nbsp;<span class='_phantom _amp'> &lt;&amp;&nbsp;</span>\
<span class='_phantom _pi_name'>${origName}</span>`);
    this.guiUpdater.insertNodeAt(pi, 0, pre);

    const post = this.makeEndLabel(doc, cls, postContextHandler, `\
<span class='_phantom _amp'>&nbsp;&amp;> </span>\
<span class='_phantom _element_name'>${origName}</span>&nbsp;`);
    this.guiUpdater.insertBefore(pi, post, null);
  }

  commentDecorator(_root: Element, comment: Element,
                   preContextHandler: ContextMenuHandler | undefined,
                   postContextHandler: ContextMenuHandler | undefined): void {
    if (this.editor.modeTree.getMode(comment) !== this.mode) {
      // The element is not governed by this mode.
      return;
    }

    // We must grab a list of nodes to remove before we start removing them
    // because an element that has a placeholder in it is going to lose the
    // placeholder while we are modifying it. This could throw off the scan.
    const toRemove = domutil.childrenByClass(comment, "_label");
    for (const remove of toRemove) {
      //
      // This is really a workaround for a problem with how the decorator
      // works. We should use this.guiUpdater.removeChild. However, when this
      // removal merges text nodes, it causes elementDecorator to be reentered
      // and this causes problems.
      //
      // The decoration code should be revamped to listen on the data tree
      // rather than listen on the GUI tree.
      //
      // Listening on the GUI tree may be desirable sometimes but it should not
      // be the default wed behavior.
      //
      comment.removeChild(remove);
    }

    const doc = comment.ownerDocument!;

    const cls = "__comment_label";
    const pre = this.makeStartLabel(doc, cls, preContextHandler, "--");
    this.guiUpdater.insertNodeAt(comment, 0, pre);

    const post = this.makeEndLabel(doc, cls, postContextHandler, "--");
    this.guiUpdater.insertBefore(comment, post, null);
  }

  /**
   * Determine whether an attribute must be hidden. The default implementation
   * calls upon the ``attributes.autohide`` section of the "wed options" that
   * were used by the mode in effect to determine whether an attribute should be
   * hidden or not.
   *
   * @param el The element in the GUI tree that we want to test.
   *
   * @param name The attribute name in "prefix:localName" format where "prefix"
   * is to be understood according to the absolute mapping defined by the mode.
   *
   * @returns ``true`` if the attribute must be hidden. ``false`` otherwise.
   */
  protected mustHideAttribute(el: Element, name: string): boolean {
    const specs = this.editor.modeTree.getAttributeHidingSpecs(el);
    if (specs === null) {
      return false;
    }

    for (const element of specs.elements) {
      if (el.matches(element.selector)) {
        let matches = false;
        for (const attribute of element.attributes) {
          if (typeof attribute === "string") {
            // If we already matched, there's no need to try to match with
            // another selector.
            if (!matches) {
              matches = attributeSelectorMatch(attribute, name);
            }
          }
          else {
            // If we do not match yet, there's no need to try to exclude the
            // attribute.
            if (matches) {
              for (const exception of attribute.except) {
                matches = !attributeSelectorMatch(exception, name);
                // As soon as we stop matching, there's no need to continue
                // checking other exceptions.
                if (!matches) {
                  break;
                }
              }
            }
          }
        }

        // An element selector that matches is terminal.
        return matches;
      }
    }

    return false;
  }

  /**
   * Add or remove the CSS class ``_readonly`` on the basis of the 2nd argument.
   *
   * @param el The element to modify. Must be in the GUI tree.
   *
   * @param readonly Whether the element is readonly or not.
   */
  setReadOnly(el: Element, readonly: boolean): void {
    const cl = el.classList;
    (readonly ? cl.add : cl.remove).call(cl, "_readonly");
  }
}

//  LocalWords:  attributeName unresolve func tslint readonly localName endCls
//  LocalWords:  PossibleDueToWildcard Dubeau MPL Mangalam attributesHTML util
//  LocalWords:  jquery validator domutil domlistener gui autohidden jQuery cls
//  LocalWords:  listDecorator origName li nbsp lt el sep
