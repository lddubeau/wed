/**
 * Editing menu manager.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Action, ActionInvocation, UnspecifiedAction,
         UnspecifiedActionInvocation } from "../action";
import { CaretManager } from "../caret-manager";
import { DLoc } from "../dloc";
import { isAttr, isComment, isDocument, isElement, isPI,
         isText } from "../domtypeguards";
import { closestByClass, isNotDisplayed, mustGetMirror } from "../domutil";
import { Editor } from "../editor";
import { ContextMenuHandler } from "../mode-api";
import { Transformation } from "../transformation";
import { ActionContextMenu } from "./action-context-menu";
import { CompletionMenu } from "./completion-menu";
import { ContextMenu } from "./context-menu";
import { ReplacementMenu } from "./replacement-menu";
import { TypeaheadPopup } from "./typeahead-popup";

/** A context menu can be triggered by the keyboard or the mouse. */
export type ContextMenuEvent = JQuery.KeyboardEventBase | JQuery.MouseEventBase;

/**
 * An action invocation which dicriminates as to whether an action is performed
 * before or after the element to which the caret belongs.
 */
export class LocalizedActionInvocation<Data extends {} | void = void>
  extends ActionInvocation<Data>{
  private readonly text: string;

  /**
   * @param action The action to be invoked.
   *
   * @param data The data for the action.
   *
   * @param before Whether the action happens before or after the element to
   * which the caret belongs.
   */
  constructor(action: Action<Data>, data: Data, readonly before: boolean) {
    super(action, data);
    this.text = ` ${before ? "before" : "after"} this element`;
  }

  /**
   * Get a description which takes into account the [[before]] field.
   */
  getDescription(): string {
    return `${super.getDescription()}${this.text}`;
  }
}

/**
 * Manages the editing menus for a specific editing view. An "editing menu" is a
 * menu that appears in the editing pane. The context menu and completion menu
 * are editing menus.
 *
 * Only one editing menu may be shown at any given time.
 */
export class EditingMenuManager {
  private readonly caretManager: CaretManager;
  private readonly guiRoot: HTMLDocument | HTMLElement;
  private readonly dataRoot: Document | Element;
  private currentDropdown: ContextMenu<unknown> | undefined;
  private readonly doc: HTMLDocument;
  private currentTypeahead: TypeaheadPopup | undefined;

  readonly boundElementStartLabelContextMenuHandler: ContextMenuHandler;
  readonly boundElementEndLabelContextMenuHandler: ContextMenuHandler;
  readonly boundPIStartLabelContextMenuHandler: ContextMenuHandler;
  readonly boundPIEndLabelContextMenuHandler: ContextMenuHandler;
  readonly boundCommentStartLabelContextMenuHandler: ContextMenuHandler;
  readonly boundCommentEndLabelContextMenuHandler: ContextMenuHandler;

  /**
   * @param editor The editor for which the manager is created.
   */
  constructor(private readonly editor: Editor) {
    this.caretManager = editor.caretManager;
    this.guiRoot = editor.guiRoot;
    this.dataRoot = editor.dataRoot;
    this.doc = this.guiRoot.ownerDocument!;
    this.boundElementStartLabelContextMenuHandler =
      this.elementStartLabelContextMenuHandler.bind(this);
    this.boundElementEndLabelContextMenuHandler =
      this.elementEndLabelContextMenuHandler.bind(this);
    this.boundPIStartLabelContextMenuHandler =
      this.piStartLabelContextMenuHandler.bind(this);
    this.boundPIEndLabelContextMenuHandler =
      this.piEndLabelContextMenuHandler.bind(this);
    this.boundCommentStartLabelContextMenuHandler =
      this.commentStartLabelContextMenuHandler.bind(this);
    this.boundCommentEndLabelContextMenuHandler =
      this.commentEndLabelContextMenuHandler.bind(this);
  }

  /**
   * Context menu handler for the start labels of elements decorated by
   * [[Decorator.elementDecorator]].
   *
   * @param wedEv The DOM event that wed generated to trigger this handler.
   *
   * @param ev The DOM event that wed received.
   *
   * @returns To be interpreted the same way as for all DOM event handlers.
   */
  elementStartLabelContextMenuHandler(wedEv: JQuery.TriggeredEvent,
                                      ev: JQuery.MouseEventBase): boolean {
    return this.elementLabelContextMenuHandler(true, wedEv, ev);
  }

  /**
   * Context menu handler for the end labels of elements decorated by
   * [[Decorator.elementDecorator]].
   *
   * @param wedEv The DOM event that wed generated to trigger this handler.
   *
   * @param ev The DOM event that wed received.
   *
   * @returns To be interpreted the same way as for all DOM event handlers.
   */
  elementEndLabelContextMenuHandler(wedEv: JQuery.TriggeredEvent,
                                    ev: JQuery.MouseEventBase): boolean {
    return this.elementLabelContextMenuHandler(false, wedEv, ev);
  }

  /**
   * Context menu handler for the labels of elements decorated by
   * [[Decorator.elementDecorator]].
   *
   * @param atStart Whether or not this event is for the start label.
   *
   * @param wedEv The DOM event that wed generated to trigger this handler.
   *
   * @param ev The DOM event that wed received.
   *
   * @returns To be interpreted the same way as for all DOM event handlers.
   */
  // tslint:disable-next-line:max-func-body-length
  private elementLabelContextMenuHandler(atStart: boolean,
                                         wedEv: JQuery.TriggeredEvent,
                                         ev: JQuery.MouseEventBase): boolean {
    const editor = this.editor;
    const guiNode = wedEv.target;
    const invocations: UnspecifiedActionInvocation[] = [];
    const mode = editor.modeTree.getMode(guiNode);

    function pushInvocations(transformationType: string[] | string,
                             name: string, node: Node, offset?: number): void {
      const data = { name, node };
      for (const tr of mode.getContextualActions(transformationType, name, node,
                                                 offset)) {
        invocations.push(new ActionInvocation(tr, data));
      }
    }

    const real = closestByClass(guiNode, "_real", editor.guiRoot);
    if (real === null) {
      throw new Error("cannot find real parent");
    }

    const attrVal = closestByClass(guiNode, "_attribute_value", editor.guiRoot);
    let dataNode: Node;
    if (attrVal !== null) {
      const node = editor.toDataNode(attrVal) as Attr;
      const element = node.ownerElement!;
      const treeCaret = DLoc.mustMakeDLoc(editor.dataRoot, element);
      invocations.push(...this.getAddAttributeInvocationsAt(treeCaret,
                                                            element));

      if (!editor.isAttrProtected(node)) {
        pushInvocations("delete-attribute", node.name, node);
      }
      dataNode = node;
    }
    else {
      const node = editor.toDataNode(real)! as Element;
      invocations.push(...this.makeCommonItems(node));

      // We first gather the transformations that pertain to the node to which
      // the label belongs.
      const topNode = (node.parentNode === editor.dataRoot);
      if (!topNode) {
        pushInvocations(["unwrap", "delete-element"], node.tagName, node, 0);
      }

      // Then we check what could be done before the node (if the user clicked
      // on an start label) or after the node (if the user clicked on an end \
      // label).
      let treeCaret = DLoc.mustMakeDLoc(editor.dataRoot, node);
      if (atStart) {
        if (editor.modeTree.getAttributeHandling(node) === "edit") {
          invocations.push(...this.getAddAttributeInvocationsAt(treeCaret,
                                                                node));
        }
      }
      else {
        // Move to after the element.
        treeCaret = treeCaret.makeWithOffset(treeCaret.offset + 1);
      }

      for (const tr of mode.getContextualActions(["insert-comment",
                                                  "insert-pi"],
                                                 "",
                                                 treeCaret.node,
                                                 treeCaret.offset)) {
        invocations.push(
          new LocalizedActionInvocation(tr,
                                        { moveCaretTo: treeCaret },
                                        atStart));
      }

      if (!topNode) {
        for (const { tr, name } of
             this.getElementTransformationsAt(treeCaret, "insert")) {
          invocations.push(
            new LocalizedActionInvocation(
              tr,
              name !== undefined ? { name, moveCaretTo: treeCaret } : null,
              atStart));
        }

        if (atStart) {
          // Move to inside the element and get the wrap-content possibilities.
          const caretInside = treeCaret.make(node, 0);
          for (const { tr, name } of
               this.getElementTransformationsAt(caretInside, "wrap-content")) {
            invocations.push(
              new ActionInvocation(tr,
                                   name !== undefined ? { name, node } : null));
          }
        }
      }

      dataNode = node;
    }

    // There's no menu to display, so let the event bubble up.
    if (invocations.length === 0) {
      return true;
    }

    this.setupContextMenu(ActionContextMenu, invocations,
                          editor.isReadonly(dataNode), ev);
    return false;
  }

  /**
   * Context menu handler for the start labels of PIs decorated by
   * [[Decorator.piDecorator]].
   *
   * @param wedEv The DOM event that wed generated to trigger this handler.
   *
   * @param ev The DOM event that wed received.
   *
   * @returns To be interpreted the same way as for all DOM event handlers.
   */
  piStartLabelContextMenuHandler(wedEv: JQuery.TriggeredEvent,
                                 ev: JQuery.MouseEventBase): boolean {
    return this.piLabelContextMenuHandler(true, wedEv, ev);
  }

  /**
   * Context menu handler for the end labels of PIs decorated by
   * [[Decorator.piDecorator]].
   *
   * @param wedEv The DOM event that wed generated to trigger this handler.
   *
   * @param ev The DOM event that wed received.
   *
   * @returns To be interpreted the same way as for all DOM event handlers.
   */
  piEndLabelContextMenuHandler(wedEv: JQuery.TriggeredEvent,
                               ev: JQuery.MouseEventBase): boolean {
    return this.piLabelContextMenuHandler(false, wedEv, ev);
  }

  /**
   * Context menu handler for the labels of PIs decorated by
   * [[Decorator.piDecorator]].
   *
   * @param atStart Whether or not this event is for the start label.
   *
   * @param wedEv The DOM event that wed generated to trigger this handler.
   *
   * @param ev The DOM event that wed received.
   *
   * @returns To be interpreted the same way as for all DOM event handlers.
   */
  private piLabelContextMenuHandler(_atStart: boolean,
                                    wedEv: JQuery.TriggeredEvent,
                                    ev: JQuery.MouseEventBase): boolean {
    const editor = this.editor;
    const guiNode = wedEv.target;
    const invocations: UnspecifiedActionInvocation[] = [];
    const mode = editor.modeTree.getMode(guiNode);

    function pushInvocations(transformationType: string[] | string,
                             name: string, node: Node, offset?: number): void {
      const data = { name, node };
      for (const tr of mode.getContextualActions(transformationType, name, node,
                                                 offset)) {
        invocations.push(new ActionInvocation(tr, data));
      }
    }

    const real = closestByClass(guiNode, "_real", editor.guiRoot);
    if (real === null) {
      throw new Error("cannot find real parent");
    }

    const pi = editor.toDataNode(real)! as ProcessingInstruction;

    pushInvocations("delete-pi", pi.target, pi, 0);

    // There's no menu to display, so let the event bubble up.
    if (invocations.length === 0) {
      return true;
    }

    this.setupContextMenu(ActionContextMenu, invocations,
                          real.classList.contains("_readonly"), ev);
    return false;
  }

  /**
   * Context menu handler for the start labels of PIs decorated by
   * [[Decorator.piDecorator]].
   *
   * @param wedEv The DOM event that wed generated to trigger this handler.
   *
   * @param ev The DOM event that wed received.
   *
   * @returns To be interpreted the same way as for all DOM event handlers.
   */
  commentStartLabelContextMenuHandler(wedEv: JQuery.TriggeredEvent,
                                      ev: JQuery.MouseEventBase): boolean {
    return this.commentLabelContextMenuHandler(true, wedEv, ev);
  }

  /**
   * Context menu handler for the end labels of PIs decorated by
   * [[Decorator.piDecorator]].
   *
   * @param wedEv The DOM event that wed generated to trigger this handler.
   *
   * @param ev The DOM event that wed received.
   *
   * @returns To be interpreted the same way as for all DOM event handlers.
   */
  commentEndLabelContextMenuHandler(wedEv: JQuery.TriggeredEvent,
                                    ev: JQuery.MouseEventBase): boolean {
    return this.commentLabelContextMenuHandler(false, wedEv, ev);
  }

  /**
   * Context menu handler for the labels of PIs decorated by
   * [[Decorator.piDecorator]].
   *
   * @param atStart Whether or not this event is for the start label.
   *
   * @param wedEv The DOM event that wed generated to trigger this handler.
   *
   * @param ev The DOM event that wed received.
   *
   * @returns To be interpreted the same way as for all DOM event handlers.
   */
  private commentLabelContextMenuHandler(_atStart: boolean,
                                         wedEv: JQuery.TriggeredEvent,
                                         ev: JQuery.MouseEventBase): boolean {
    const editor = this.editor;
    const guiNode = wedEv.target;
    const invocations: UnspecifiedActionInvocation[] = [];
    const mode = editor.modeTree.getMode(guiNode);

    function pushInvocations(transformationType: string[] | string,
                             name: string | undefined, node: Node,
                             offset?: number): void {
      const data = { name, node };
      for (const tr of mode.getContextualActions(transformationType,
                                                 name !== undefined ? name : "",
                                                 node, offset)) {
        invocations.push(new ActionInvocation(tr, data));
      }
    }

    const real = closestByClass(guiNode, "_real", editor.guiRoot);
    if (real === null) {
      throw new Error("cannot find real parent");
    }

    const comment = editor.toDataNode(real)! as Comment;

    pushInvocations("delete-comment", undefined, comment, 0);

    // There's no menu to display, so let the event bubble up.
    if (invocations.length === 0) {
      return true;
    }

    this.setupContextMenu(ActionContextMenu, invocations,
                          real.classList.contains("_readonly"), ev);
    return false;
  }

  /**
   * This is the default menu handler called when the user right-clicks in the
   * contents of a document or uses the keyboard shortcut.
   *
   * The menu handler which is invoked when a user right-clicks on an element
   * start or end label is defined by the decorator that the mode is using.
   */
  contentContextMenuHandler(e: ContextMenuEvent): boolean {
    const sel = this.caretManager.sel;
    if (sel === undefined || (!sel.collapsed && !sel.wellFormed)) {
      return false;
    }

    const caret = this.caretManager.getDataCaret(true)!;
    if (isAttr(caret.node)) {
      return true;
    }

    const readonly = this.editor.isReadonly(caret.node);

    let guiCaret = this.caretManager.fromDataLocation(caret)!;
    if (!isElement(guiCaret.node)) {
      guiCaret = guiCaret.getLocationInParent();
    }
    let menuItems: UnspecifiedActionInvocation[] = [];
    if (isDocument(caret.node) || isElement(caret.node) || isText(caret.node)) {
      menuItems =
        this.getMenuItemsForElementContent(guiCaret.node as HTMLElement,
                                           guiCaret.offset,
                                           !sel.collapsed);
    }
    else if (isPI(caret.node)) {
      menuItems = this.getMenuItemsForPIContent(guiCaret.node as HTMLElement);
    }
    else if (isComment(caret.node)) {
      menuItems =
        this.getMenuItemsForCommentContent(guiCaret.node as HTMLElement);
    }

    // There's no menu to display, so let the event bubble up.
    if (menuItems.length === 0) {
      return true;
    }

    this.setupContextMenu(ActionContextMenu, menuItems, readonly, e);
    return false;
  }

  /**
   * Dismiss the menu currently shown. If there is no menu currently shown, does
   * nothing.
   */
  dismiss(): void {
    // We may be called when there is no menu active.
    if (this.currentDropdown !== undefined) {
      this.currentDropdown.dismiss();
    }

    if (this.currentTypeahead !== undefined) {
      this.currentTypeahead.dismiss();
    }
  }

  /**
   * Compute an appropriate position for a context menu, and display it. This is
   * a convenience function that essentially combines [[computeMenuPosition]]
   * and [[displayContextMenu]].
   *
   * @param cmClass See [[displayContextMenu]].
   *
   * @param items See [[displayContextMenu]].
   *
   * @param readonly See [[displayContextMenu]].
   *
   * @param e See [[computeMenuPosition]].
   *
   * @param bottom See [[computeMenuPosition]].
   */
  // @ts-ignore
  setupContextMenu(cmClass: typeof ActionContextMenu,
                   items: UnspecifiedActionInvocation[],
                   readonly: boolean,
                   e: ContextMenuEvent | undefined,
                   bottom?: boolean): void {
    const pos = this.computeMenuPosition(e, bottom);
    this.displayContextMenu(ActionContextMenu, pos.left, pos.top, items,
                            readonly);
  }

  /**
   * Remove duplicate menu items from a list of items.
   *
   * @param items The items to deduplicate.
   *
   * @param readonly Whether the menu should provide only items that don't
   * modify the document. This amounts to removing all items with an ``action``
   * field that is a [[Transformation]].
   *
   * @returns A new array with the remaining unique menu items.
   */
  dedupItems(items: UnspecifiedActionInvocation[],
             readonly: boolean): UnspecifiedActionInvocation[] {
    // Eliminate duplicate items. We perform a check only in the description of
    // the action, and on ``data.name``.
    const seen: Record<string, boolean> = Object.create(null);
    return items.filter(({ action, key }) => {
      const keep = !seen[key];
      seen[key] = true;

      return (!keep || !readonly) ? keep :
        // If we get here, then we need to filter out anything that transforms
        // the tree.
        !(action instanceof Transformation);
    });
  }

  /**
   * @param cmClass The class to use to create the menu.
   *
   * @param x The position of the menu.
   *
   * @param y The position of the menu.
   *
   * @param items The menu items to show.
   *
   * @param readonly If true, don't include in the menu any operation that
   *                 would trigger a ``Transformation``.
   */
  displayContextMenu(cmClass: typeof ActionContextMenu, x: number, y: number,
                     items: UnspecifiedActionInvocation[],
                     readonly: boolean): void {
    this.dismiss();
    this.caretManager.pushSelection();
    this.currentDropdown = new cmClass(
      this.doc, x, y, this.dedupItems(items, readonly),
      () => {
        this.currentDropdown = undefined;
        this.caretManager.popSelection();
      });
  }

  private getMenuItemsForElementContent(node: HTMLElement, offset: number,
                                        wrap: boolean):
  UnspecifiedActionInvocation[] {
    let actualNode: HTMLElement | null = node;
    // If we are in a phantom, we want to get to the first parent which is not
    // phantom.
    let lastPhantomChild: HTMLElement | undefined;
    while (actualNode !== null && actualNode.classList.contains("_phantom")) {
      lastPhantomChild = actualNode;
      actualNode = actualNode.parentNode as HTMLElement;
    }

    if (actualNode === null || !this.guiRoot.contains(actualNode)) {
      return [];
    }

    const { caretManager } = this;
    if (lastPhantomChild !== undefined) {
      // The actualNode exists and is in our GUI tree. If the offset is outside
      // editable contents, move it into editable contents.
      ({ offset } = caretManager.normalizeToEditableRange(
        DLoc.mustMakeDLoc(this.guiRoot, lastPhantomChild)));
    }

    // tslint:disable-next-line:no-any
    const menuItems: UnspecifiedActionInvocation[] = [];
    if (// Should not be part of a gui element.
      !(actualNode.parentNode as Element).classList.contains("_gui")) {
      // We want the data node, not the gui node.
      const treeCaret = caretManager.toDataLocation(actualNode, offset);
      if (treeCaret === undefined) {
        throw new Error("cannot find tree caret");
      }
      // We are cheating a bit here. treeCaret.node cannot be a text node
      // because of the way this method is invoked. It cannot be an attribute
      // either. However, it could be a Document, which happens if the edited
      // document is empty.
      const dataNode = treeCaret.node as Element;
      const mode = this.editor.modeTree.getMode(dataNode);
      menuItems.push(...this.makeCommonItems(dataNode));

      for (const action of mode.getContextualActions(["insert-comment",
                                                      "insert-pi"],
                                                     "", treeCaret.node,
                                                     treeCaret.offset)) {
        menuItems.push(new ActionInvocation(action, null));
      }

      const trs = this.getElementTransformationsAt(treeCaret,
                                                   wrap ? "wrap" : "insert");
      for (const { name, tr } of trs) {
        // If name is not undefined we have a real transformation.
        // Otherwise, it is an action.
        menuItems.push(
          new ActionInvocation(tr, name !== undefined ? { name } : null));
      }

      if (dataNode !== this.dataRoot.firstChild && dataNode !== this.dataRoot) {
        const { tagName } = dataNode;
        const actions = mode.getContextualActions(
          ["unwrap", "delete-parent", "split"], tagName, dataNode, 0);
        for (const action of actions) {
          menuItems.push(
            new ActionInvocation(action, { node: dataNode, name: tagName }));
        }
      }
    }

    const $sep = $(actualNode).parents().addBack()
      .siblings("[data-wed--separator-for]").first();
    const sepFor = $sep[0] !== undefined ?
      $sep[0].getAttribute("data-wed--separator-for") : null;
    if (sepFor !== null) {
      const transformationNode = $sep.siblings()
        .filter(function filter(this: Element): boolean {
          // Node.contains() will return true if this === node, whereas
          // jQuery.has() only looks at descendants, so this can't be replaced
          // with .has().
          return this.contains(actualNode!);
        })[0];
      const mode = this.editor.modeTree.getMode(transformationNode);
      const actions = mode.getContextualActions(
        ["merge-with-next", "merge-with-previous", "append", "prepend"], sepFor,
        mustGetMirror(transformationNode), 0);
      for (const action of actions) {
        menuItems.push(
          new ActionInvocation(action,
                               { node: transformationNode, name: sepFor }));
      }
    }

    return menuItems;
  }

  private getMenuItemsForPIContent(real: HTMLElement):
  UnspecifiedActionInvocation[] {
    const { caretManager } = this;
    // tslint:disable-next-line:no-any
    const menuItems: UnspecifiedActionInvocation[] = [];

    const treeCaret = caretManager.toDataLocation(real, 0);
    if (treeCaret === undefined) {
      throw new Error("cannot find tree caret");
    }

    const dataNode = treeCaret.node;
    menuItems.push(...this.makeCommonItems(dataNode));

    const mode = this.editor.modeTree.getMode(dataNode);

    for (const action of mode.getContextualActions(["delete-pi"], "",
                                                   dataNode, 0)) {
      menuItems.push(new ActionInvocation(action, {
        node: dataNode,
      }));
    }

    return menuItems;
  }

  private getMenuItemsForCommentContent(real: HTMLElement):
  UnspecifiedActionInvocation[] {
    const { caretManager } = this;
    // tslint:disable-next-line:no-any
    const menuItems: UnspecifiedActionInvocation[] = [];

    const treeCaret = caretManager.toDataLocation(real, 0);
    if (treeCaret === undefined) {
      throw new Error("cannot find tree caret");
    }

    const dataNode = treeCaret.node;
    menuItems.push(...this.makeCommonItems(dataNode));

    const mode = this.editor.modeTree.getMode(dataNode);

    for (const action of mode.getContextualActions(["delete-comment"], "",
                                                   dataNode, 0)) {
      menuItems.push(new ActionInvocation(action, {
        node: dataNode,
      }));
    }

    return menuItems;
  }

  /**
   * Returns the list of element transformations for the location pointed to by
   * the caret.
   *
   * @param treeCaret The location in the document. This must be a data
   * location, not a GUI location.
   *
   * @param types The types of transformations to get.
   *
   * @return An array of objects having the fields ``tr`` which contain the
   * actual transformation and ``name`` which is the unresolved element name for
   * this transformation. It is exceptionally possible to have an item of the
   * list contain ``undefined`` for ``name``.
   */
  getElementTransformationsAt(treeCaret: DLoc, types: string |  string[]):
  { tr: UnspecifiedAction; name?: string }[]
  {
    const mode = this.editor.modeTree.getMode(treeCaret.node);
    const resolver = mode.getAbsoluteResolver();
    const ret: { tr: UnspecifiedAction; name?: string }[] = [];
    this.editor.validator.possibleAt(treeCaret).forEach(ev => {
      if (ev.name !== "enterStartTag") {
        return;
      }

      const pattern = ev.param;
      const asArray = pattern.toArray();
      if (asArray !== null) {
        for (const name of asArray) {
          const unresolved = resolver.unresolveName(name.ns, name.name);

          const trs = mode.getContextualActions(
            types, unresolved!, treeCaret.node, treeCaret.offset);
          if (trs === undefined) {
            return;
          }

          for (const tr of trs) {
            ret.push({ tr, name: unresolved });
          }
        }
      }
      else {
        // We push an action rather than a transformation.
        ret.push({ tr: this.editor.complexElementPatternAction,
                   name: undefined });
      }
    });

    return ret;
  }

  protected getAddAttributeInvocationsAt(at: DLoc, element: Element):
  UnspecifiedActionInvocation[] {
    const { editor } = this;
    const invocations: UnspecifiedActionInvocation[] = [];
    const mode = editor.modeTree.getMode(at.node);
    const absoluteResolver = mode.getAbsoluteResolver();
    editor.validator.possibleAt(at, true).forEach(event => {
      if (event.name !== "attributeName") {
        return;
      }

      const namePattern = event.param;
      if (namePattern.simple()) {
        // If the namePattern is simple, then toArray is necessarily not null.
        for (const name of namePattern.toArray()!) {
          const unresolved = absoluteResolver.unresolveName(name.ns,
                                                            name.name);
          if (unresolved === undefined) {
            throw new Error("cannot unresolve attribute");
          }

          if (editor.isAttrProtected(unresolved, element)) {
            return;
          }

          for (const tr of mode.getContextualActions("add-attribute",
                                                     unresolved,
                                                     element)) {
            invocations.push(new ActionInvocation(tr,
                                                  { name: unresolved,
                                                    node: element }));
          }
        }
      }
      else {
        invocations.push(
          new ActionInvocation(editor.complexAttributePatternAction,
                               undefined));
      }
    });

    return invocations;
  }

  /**
   * Make the menu items that should appear in all contextual menus.
   *
   * @param dataNode The element for which we are creating the menu.
   *
   * @returns Menu items.
   */
  makeCommonItems(dataNode: Node): UnspecifiedActionInvocation[] {
    const menuItems: UnspecifiedActionInvocation[] = [];
    if (isElement(dataNode)) {
      const tagName = dataNode.tagName;
      const mode = this.editor.modeTree.getMode(dataNode);
      const docURL = mode.documentationLinkFor(tagName);

      if (docURL != null) {
        menuItems.push(new ActionInvocation(this.editor.documentationAction,
                                            { docURL }));
      }
    }

    return menuItems;
  }

  private getPossibleAttributeValues(): string[] {
    const sel = this.caretManager.sel;

    // We must not have an actual range in effect
    if (sel === undefined || !sel.collapsed) {
      return [];
    }

    // If we have a selection, we necessarily have a caret.
    const caret = this.caretManager.getNormalizedCaret()!;
    const node = caret.node;
    const attrVal = closestByClass(node, "_attribute_value", this.guiRoot);
    if (attrVal === null ||
        isNotDisplayed(attrVal as HTMLElement, this.guiRoot)) {
      return [];
    }

    // If we have a selection, we necessarily have a caret.
    const dataCaret = this.caretManager.getDataCaret()!;
    // The node is necessarily an attribute.
    const dataNode = dataCaret.node as Attr;

    // First see if the mode has something to say.
    const mode = this.editor.modeTree.getMode(dataNode);
    const possible = mode.getAttributeCompletions(dataNode);

    if (possible.length === 0) {
      // Nothing from the mode, use the validator.
      this.editor.validator.possibleAt(dataCaret.node, 0).forEach(ev => {
        if (ev.name !== "attributeValue") {
          return;
        }

        const text = ev.param;
        if (text instanceof RegExp) {
          return;
        }

        possible.push(text);
      });
    }

    return possible;
  }

  setupCompletionMenu(): void {
    this.dismiss();
    const possible = this.getPossibleAttributeValues();
    // Nothing to complete.
    if (possible.length === 0) {
      return;
    }

    const dataCaret = this.caretManager.getDataCaret();
    if (dataCaret === undefined) {
      return;
    }

    // The node is necessarily an attribute, otherwise possible would have a
    // length of 0.
    const dataNode = dataCaret.node as Attr;

    // We complete only at the end of an attribute value.
    if (dataCaret.offset !== dataNode.value.length) {
      return;
    }

    const narrowed = [];
    for (const possibility of possible) {
      if (possibility.lastIndexOf(dataNode.value, 0) === 0) {
        narrowed.push(possibility);
      }
    }

    // The current value in the attribute is not one that can be
    // completed.
    if (narrowed.length === 0 ||
        (narrowed.length === 1 && narrowed[0] === dataNode.value)) {
      return;
    }

    const pos = this.computeMenuPosition(undefined, true);

    this.caretManager.pushSelection();
    const menu = this.currentDropdown = new CompletionMenu(
      this.editor, this.doc, pos.left, pos.top,
      dataNode.value, possible,
      () => {
        this.currentDropdown = undefined;
        // If the focus moved from the document to the completion menu, we
        // want to restore the caret. Otherwise, leave it as is.
        if (menu.focused) {
          this.caretManager.popSelection();
        }
        else {
          this.caretManager.popSelectionAndDiscard();
        }
      });
  }

  setupReplacementMenu(): void {
    this.dismiss();
    const possible = this.getPossibleAttributeValues();
    // Nothing to complete.
    if (possible.length === 0) {
      return;
    }

    const dataCaret = this.caretManager.getDataCaret();
    if (dataCaret === undefined) {
      return;
    }

    const pos = this.computeMenuPosition(undefined, true);
    this.caretManager.pushSelection();
    this.currentDropdown = new ReplacementMenu(
      this.doc, pos.left, pos.top, possible, selected => {
        this.currentDropdown = undefined;
        this.caretManager.popSelection();

        if (selected === undefined) {
          return;
        }
        // The node is necessarily an attribute, otherwise possible would have a
        // length of 0.
        const dataNode = dataCaret.node as Attr;
        const uri = dataNode.namespaceURI !== null ? dataNode.namespaceURI : "";
        this.editor.dataUpdater.setAttributeNS(dataNode.ownerElement!, uri,
                                               dataNode.name, selected);
      });
  }

  /**
   * Compute an appropriate position for a typeahead popup, and display it. This
   * is a convenience function that essentially combines [[computeMenuPosition]]
   * and [[displayTypeaheadPopup]].
   *
   * @param width See [[displayTypeaheadPopup]].
   *
   * @param placeholder See [[displayTypeaheadPopup]].
   *
   * @param options See [[displayTypeaheadPopup]].
   *
   * @param dismissCallback See [[displayTypeaheadPopup]].
   *
   * @param e See [[computeMenuPosition]].
   *
   * @param bottom See [[computeMenuPosition]].
   *
   * @returns The popup that was created.
   */
  setupTypeaheadPopup(width: number, placeholder: string,
                      // tslint:disable-next-line:no-any
                      options: any,
                      // tslint:disable-next-line:no-any
                      dismissCallback: (obj?: any) => void,
                      e: ContextMenuEvent | undefined,
                      bottom?: boolean): TypeaheadPopup {
    const pos = this.computeMenuPosition(e, bottom);
    return this.displayTypeaheadPopup(pos.left, pos.top, width, placeholder,
                                      options, dismissCallback);
  }

  /**
   * Brings up a typeahead popup.
   *
   * @param x The position of the popup.
   *
   * @param y The position of the popup.
   *
   * @param width The width of the popup.
   *
   * @param placeholder Placeholder text to put in the input field.
   *
   * @param options Options for Twitter Typeahead.
   *
   * @param dismissCallback The callback to be called upon dismissal. It will be
   * called with the object that was selected, if any.
   *
   * @returns The popup that was created.
   */
  displayTypeaheadPopup(x: number, y: number, width: number,
                        placeholder: string,
                        // tslint:disable-next-line:no-any
                        options: any,
                        // tslint:disable-next-line:no-any
                        dismissCallback: (obj?: { value: string }) => void):
  TypeaheadPopup {
    this.dismiss();
    this.caretManager.pushSelection();
    this.currentTypeahead = new TypeaheadPopup(
      this.doc, x, y, width, placeholder, options, obj => {
        this.currentTypeahead = undefined;
        this.caretManager.popSelection();
        if (dismissCallback !== undefined) {
          dismissCallback(obj);
        }
      });
    return this.currentTypeahead;
  }

  /**
   * Computes where a menu should show up, depending on the event that triggered
   * it.
   *
   * @param e The event that triggered the menu. If no event is passed, it is
   * assumed that the menu was not triggered by a mouse event.
   *
   * @param bottom Only used when the event was not triggered by a mouse event
   * (``e === undefined``). If ``bottom`` is true, use the bottom of the DOM
   * entity used to compute the ``left`` coordinate. Otherwise, use its middle
   * to determine the ``left`` coordinate.
   *
   * @returns The top and left coordinates where the menu should appear.
   */
  computeMenuPosition(e: ContextMenuEvent | undefined,
                      bottom: boolean = false): { top: number; left: number } {
    if (e === undefined) {
      // tslint:disable-next-line:no-object-literal-type-assertion
      e = {} as JQuery.KeyboardEventBase;
    }

    // Take care of cases where the user is using the mouse.
    if (e.type === "mousedown" || e.type === "mouseup" || e.type === "click" ||
        e.type === "contextmenu") {
      return {
        left: (e as JQuery.MouseEventBase).clientX,
        top: (e as JQuery.MouseEventBase).clientY,
      };
    }

    // The next conditions happen only if the user is using the keyboard
    const mark = this.caretManager.mark;
    if (mark.inDOM) {
      mark.scrollIntoView();
      // We need to refresh immediately and acquire the client rectangle of the
      // caret.
      mark.refresh();
      const rect = mark.getBoundingClientRect();
      return {
        top: bottom ? rect.bottom : (rect.top + (rect.height / 2)),
        left: rect.left,
      };
    }

    const gui = closestByClass(this.caretManager.caret!.node, "_gui",
                               this.guiRoot);
    if (gui !== null) {
      const rect = gui.getBoundingClientRect();
      // Middle of the region.
      return {
        top: bottom ? rect.bottom : (rect.top + (rect.height / 2)),
        left: rect.left + (rect.width / 2),
      };
    }

    throw new Error("no position for displaying the menu");
  }
}

//  LocalWords:  MPL contextMenuHandler readonly actualNode treeCaret jQuery li
//  LocalWords:  prepend tabindex href getDescriptionFor iconHtml mousedown
//  LocalWords:  attributeValue mouseup contextmenu computeMenuPosition
//  LocalWords:  displayContextMenu
