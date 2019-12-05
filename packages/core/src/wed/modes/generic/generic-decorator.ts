/**
 * Decorator for the generic mode.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { inject, injectable } from "inversify";

import { convert, Decorator, domtypeguards, EditorAPI, Mode,
         tokens } from "wed";

import isElement = domtypeguards.isElement;
import isText = domtypeguards.isText;
// tslint:disable-next-line:import-name
import REAL_SELECTOR = convert.REAL_SELECTOR;
import isRealComment = convert.isRealComment;
import isRealPI = convert.isRealPI;

import { Metadata, METADATA } from "./metadata";

// tslint:disable-next-line:import-name
import EDITOR_INSTANCE = tokens.EDITOR_INSTANCE;
// tslint:disable-next-line:import-name
import MODE_OPTIONS = tokens.MODE_OPTIONS;
// tslint:disable-next-line:import-name
import MODE = tokens.MODE;

/**
 * A decorator for the generic mode.
 */
@injectable()
export class GenericDecorator extends Decorator {
  /**
   * @param mode The mode object.
   *
   * @param editor The wed editor to which the mode is applied.
   *
   * @param metadata Meta-information about the schema.
   *
   * @param options The options object passed to the mode which uses this
   * decorator.
   *
   */
  // tslint:disable-next-line:no-any
  constructor(@inject(MODE) mode: Mode,
              @inject(EDITOR_INSTANCE) editor: EditorAPI,
              @inject(METADATA) protected readonly metadata: Metadata,
              // tslint:disable-next-line:no-any
              @inject(MODE_OPTIONS) protected readonly options: any) {
    super(mode, editor);
  }

  addHandlers(): void {
    this.domlistener.addHandler(
      "included-element",
      REAL_SELECTOR,
      ({ root, element }) => {
        this.decorateGUIElement(root as Element, element);
      });

    const redecorate = (root: Element, child: Node, parent: Element) => {
        if (isText(child) || (isElement(child) &&
                              (child.classList.contains("_real") ||
                               child.classList.contains("_phantom_wrap")))) {
          this.decorateGUIElement(root, parent);
        }
    };

    this.domlistener.addHandler(
      "added-child",
      REAL_SELECTOR,
      ({ root, child }) => {
        redecorate(root as Element, child, child.parentNode as Element);
      });

    this.domlistener.addHandler(
      "removed-child",
      REAL_SELECTOR,
      ({ root, parent, child }) => {
        redecorate(root as Element, child, parent);
      });

    this.domlistener.addHandler("text-changed",
                                REAL_SELECTOR,
                                ({ root, node }) => {
                                  this.decorateGUIElement(
                                    root as Element,
                                    node.parentNode! as Element);
                                });

    this.domlistener.addHandler("attribute-changed",
                                REAL_SELECTOR,
                                ({ root, element: el}) => {
                                  this.decorateGUIElement(root as Element, el);
                                });
  }

  decorateGUIElement(root: Element, el: Element): void {
    // Skip elements which would already have been removed from the
    // tree. Unlikely but...
    if (!root.contains(el)) {
      return;
    }

    if (isRealPI(el)) {
      this.piDecorator(root, el);
    }
    else if (isRealComment(el)) {
      this.commentDecorator(root, el);
    }
    else {
      this.elementDecorator(root, el);

      const klass = this.getAdditionalClasses(el);
      if (klass.length > 0) {
        el.className += ` ${klass}`;
      }
    }
  }

  elementDecorator(root: Element, el: Element): void {
    const { editor: { editingMenuManager } } = this;
    super.elementDecorator(
      root, el, 1,
      editingMenuManager.boundElementStartLabelContextMenuHandler,
      editingMenuManager.boundElementEndLabelContextMenuHandler);
  }

  piDecorator(root: Element, el: Element): void {
    const { editor: { editingMenuManager } } = this;
    super.piDecorator(root, el,
                      editingMenuManager.boundPIStartLabelContextMenuHandler,
                      editingMenuManager.boundPIEndLabelContextMenuHandler);
  }

  commentDecorator(root: Element, el: Element): void {
    const { editor: { editingMenuManager } } = this;
    super.commentDecorator(
      root, el,
      editingMenuManager.boundCommentStartLabelContextMenuHandler,
      editingMenuManager.boundCommentEndLabelContextMenuHandler);
  }

  /**
   * Returns additional classes that should apply to a node.
   *
   * @param node The node to check.
   *
   * @returns A string that contains all the class names separated by spaces. In
   * other words, a string that could be put as the value of the ``class``
   * attribute in an HTML tree.
   */
  getAdditionalClasses(node: Element): string {
    const dataNode = this.editor.toDataNode(node);
    if (!isElement(dataNode)) {
      throw new Error("the GUI node passed does not correspond to an element");
    }
    const ret = [];
    if (this.metadata.isInline(dataNode)) {
      ret.push("_inline");
    }
    return ret.join(" ");
  }
}

//  LocalWords:  Dubeau MPL Mangalam util klass
