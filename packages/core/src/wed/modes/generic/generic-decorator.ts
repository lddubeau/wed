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
      (root, _tree, _parent, _prev, _next, el) => {
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

    this.domlistener.addHandler(
      "children-changed",
      util.classFromOriginalName("*", {}),
      (root, added, removed, _previousSibling, _nextSibling, el) => {
         for (const child of added.concat(removed)) {
           if (isText(child) || (isElement(child) &&
                                 (child.classList.contains("_real") ||
                                  child.classList.contains("_phantom_wrap")))) {
             this.elementDecorator(root as Element, el);
             break;
           }
         }
       });

    this.domlistener.addHandler("text-changed",
                                util.classFromOriginalName("*", {}),
                                (root, node) => {
                                  this.elementDecorator(
                                    root as Element,
                                    node.parentNode! as Element);
                                });

    this.domlistener.addHandler("attribute-changed",
                                util.classFromOriginalName("*", {}),
                                (root, el) => {
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
    const ret = [];
    if (this.metadata.isInline(node)) {
      ret.push("_inline");
    }
    return ret.join(" ");
  }
}

//  LocalWords:  Dubeau MPL Mangalam util klass
