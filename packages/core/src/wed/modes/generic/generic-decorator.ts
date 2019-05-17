/**
 * Decorator for the generic mode.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Decorator, domtypeguards, EditorAPI, Mode, util } from "wed";

const { isElement, isText } = domtypeguards;

import { Metadata } from "./metadata";

/**
 * A decorator for the generic mode.
 */
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
  constructor(mode: Mode, editor: EditorAPI,
              protected readonly metadata: Metadata,
              // tslint:disable-next-line:no-any
              protected readonly options: any) {
    super(mode, editor);
  }

  addHandlers(): void {
    this.domlistener.addHandler(
      "included-element",
      util.classFromOriginalName("*", {}),
      ({ root, element: el }) => {
        // Skip elements which would already have been removed from the
        // tree. Unlikely but...
        if (!root.contains(el)) {
          return;
        }

        this.elementDecorator(root as Element, el);

        const klass = this.getAdditionalClasses(el);
        if (klass.length > 0) {
          el.className += ` ${klass}`;
        }
      });

    const redecorate = (root: Element, child: Node, parent: Element) => {
        if (isText(child) || (isElement(child) &&
                              (child.classList.contains("_real") ||
                               child.classList.contains("_phantom_wrap")))) {
          this.elementDecorator(root, parent);
        }
    };

    this.domlistener.addHandler(
      "added-child",
      util.classFromOriginalName("*", {}),
      ({ root, child }) => {
        redecorate(root as Element, child, child.parentNode as Element);
      });

    this.domlistener.addHandler(
      "removed-child",
      util.classFromOriginalName("*", {}),
      ({ root, parent, child }) => {
        redecorate(root as Element, child, parent);
      });

    this.domlistener.addHandler("text-changed",
                                util.classFromOriginalName("*", {}),
                                ({ root, node }) => {
                                  this.elementDecorator(
                                    root as Element,
                                    node.parentNode! as Element);
                                });

    this.domlistener.addHandler("attribute-changed",
                                util.classFromOriginalName("*", {}),
                                ({ root, element: el}) => {
                                  this.elementDecorator(root as Element, el);
                                });
  }

  elementDecorator(root: Element, el: Element): void {
    const { editor: { editingMenuManager } } = this;
    super.elementDecorator(root, el, 1,
                           editingMenuManager.boundStartLabelContextMenuHandler,
                           editingMenuManager.boundEndLabelContextMenuHandler);
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
