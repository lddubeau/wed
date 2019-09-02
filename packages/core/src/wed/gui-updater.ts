/**
 * Listens to changes on a tree and updates the GUI tree in response to changes.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import $ from "jquery";

import * as convert from "./convert";
import { DLoc } from "./dloc";
import { isComment, isPI, isText } from "./domtypeguards";
import { isAttr, linkTrees, mustGetMirror } from "./domutil";
import { BeforeDeleteNodeEvent, InsertNodeAtEvent, SetAttributeNSEvent,
         SetCommentValueEvent, SetPIBodyEvent, SetTextNodeValueEvent,
         TreeUpdater } from "./tree-updater";
import { getValueNode } from "./wed-util";

/**
 * Updates a GUI tree so that its data nodes (those nodes that are not
 * decorations) mirror a data tree.
 */
export class GUIUpdater extends TreeUpdater {
  private readonly haveTooltips: HTMLCollectionOf<Element>;

  /**
   * @param guiTree The DOM tree to update.
   *
   * @param treeUpdater A tree updater that updates the data tree. It serves as
   * a source of modification events which the object being created will listen
   * on.
   */
  constructor(guiTree: Element, private readonly treeUpdater: TreeUpdater) {
    super(guiTree);
    this.haveTooltips =
      guiTree.ownerDocument!.getElementsByClassName("wed-has-tooltip");
    this.treeUpdater.events.subscribe(ev => {
      switch (ev.name) {
        case "InsertNodeAt":
          this._insertNodeAtHandler(ev);
          break;
        case "SetTextNodeValue":
          this._setTextNodeValueHandler(ev);
          break;
        case "BeforeDeleteNode":
          this._beforeDeleteNodeHandler(ev);
          break;
        case "SetAttributeNS":
          this._setAttributeNSHandler(ev);
          break;
        case "SetCommentValue":
          this._setCommentValueHandler(ev);
          break;
        case "SetPIBody":
          this._setPIBodyHandler(ev);
          break;
        default:
          // Do nothing...
      }
    });
  }

  /**
   * Handles "InsertNodeAt" events.
   *
   * @param ev The event.
   */
  private _insertNodeAtHandler(ev: InsertNodeAtEvent): void {
    const guiCaret = this.fromDataLocation(ev.parent, ev.index);
    if (guiCaret === null) {
      throw new Error("cannot find gui tree position");
    }
    const clone = convert.toHTMLTree(this.tree.ownerDocument!, ev.node);
    linkTrees(ev.node, clone);
    this.insertNodeAt(guiCaret, clone);
  }

  /**
   * Handles "SetTextNodeValue" events.
   *
   * @param ev The event.
   */
  private _setTextNodeValueHandler(ev: SetTextNodeValueEvent):
  void {
    const guiCaret = this.fromDataLocation(ev.node, 0);
    if (guiCaret === null) {
      throw new Error("cannot find gui tree position");
    }
    this.setTextNodeValue(guiCaret.node as Text, ev.value);
  }

  /**
   * Handles "SetCommentValue" events.
   *
   * @param ev The event.
   */
  private _setCommentValueHandler(ev: SetCommentValueEvent): void {
    const guiCaret = this.fromDataLocation(ev.node, 0);
    if (guiCaret === null) {
      throw new Error("cannot find gui tree position");
    }

    // The caret either points to the text node inside the PI, or to the element
    // which repesents the pi.
    if (isText(guiCaret.node)) {
      this.setTextNodeValue(guiCaret.node as Text, ev.value);
    }
    else {
      this.insertNodeAt(guiCaret,
                        guiCaret.node.ownerDocument!.createTextNode(ev.value));
    }
  }

  /**
   * Handles "SetPIBody" events.
   *
   * @param ev The event.
   */
  private _setPIBodyHandler(ev: SetPIBodyEvent):
  void {
    const guiCaret = this.fromDataLocation(ev.node, 0);
    if (guiCaret === null) {
      throw new Error("cannot find gui tree position");
    }
    // The caret either points to the text node inside the PI, or to the element
    // which repesents the pi.
    if (isText(guiCaret.node)) {
      this.setTextNodeValue(guiCaret.node as Text, ev.value);
    }
    else {
      this.insertNodeAt(guiCaret,
                        guiCaret.node.ownerDocument!.createTextNode(ev.value));
    }
  }

  /**
   * Handles "BeforeDeleteNode" events.
   *
   * @param ev The event.
   */
  private _beforeDeleteNodeHandler(ev: BeforeDeleteNodeEvent):
  void {
    this.deleteNode(mustGetMirror(ev.node));
  }

  /**
   * Handles "SetAttributeNS" events.
   *
   * @param ev The event.
   */
  private _setAttributeNSHandler(ev: SetAttributeNSEvent): void {
    const guiCaret = this.fromDataLocation(ev.node, 0);
    if (guiCaret === null) {
      throw new Error("cannot find gui tree position");
    }
    this.setAttributeNS(guiCaret.node as Element, "",
                        convert.encodeAttrName(ev.attribute), ev.newValue);
  }

  /**
   * Converts a data location to a GUI location.
   *
   * @param loc The location.
   *
   * @returns The GUI location.
   */
  fromDataLocation(loc: DLoc): DLoc | null;
  fromDataLocation(node: Node, offset: number): DLoc | null;
  fromDataLocation(loc: DLoc | Node, offset?: number): DLoc |null {
    let node;
    if (loc instanceof DLoc) {
      node = loc.node;
      offset = loc.offset;
    }
    else {
      node = loc;
      if (offset === undefined) {
        throw new Error("must specify an offset");
      }
    }

    let guiNode = this.pathToNode(this.treeUpdater.nodeToPath(node));
    if (guiNode === null) {
      return null;
    }

    if (isText(node) || isPI(node) || isComment(node)) {
      guiNode = getValueNode(guiNode as Element);
      return DLoc.mustMakeDLoc(this.tree, guiNode, offset);
    }

    if (isAttr(node)) {
      // The check for the node type is to avoid getting a location inside a
      // placeholder.
      guiNode = getValueNode(guiNode as Element);
      return DLoc.mustMakeDLoc(this.tree, guiNode, offset);
    }

    if (offset === 0) {
      return DLoc.mustMakeDLoc(this.tree, guiNode, 0);
    }

    if (offset >= node.childNodes.length) {
      return DLoc.mustMakeDLoc(this.tree, guiNode, guiNode.childNodes.length);
    }

    const guiChild = this.pathToNode(
      this.treeUpdater.nodeToPath(node.childNodes[offset]));
    if (guiChild === null) {
      // This happens if for instance node has X children but the
      // corresponding node in tree has X-1 children.
      return DLoc.mustMakeDLoc(this.tree, guiNode, guiNode.childNodes.length);
    }

    return DLoc.mustMakeDLoc(this.tree, guiChild);
  }

  /**
   * Check whether a tooltip should be destroyed when the element is removed
   * from the tree. This function checks whether the element or any descendant
   * has a tooltip.
   *
   * @param el An element to check.
   *
   */
  removeTooltips(el: Element): void {
    for (const hasTooltip of Array.from(this.haveTooltips)) {
      if (!el.contains(hasTooltip)) {
        continue;
      }

      const tt = $.data(hasTooltip, "bs.tooltip");
      if (tt != null) {
        tt.dispose();
      }

      // We don't remove the wed-has-tooltip class. Generally, the elements
      // that have tooltips and are removed from the GUI tree won't be added
      // to the tree again. If they are added again, they'll most likely get
      // a new tooltip so removing the class does not gain us much because
      // it will be added again.
      //
      // If we *were* to remove the class, then the collection would change
      // as we go through it.
    }
  }
}

//  LocalWords:  domutil jquery pathToNode nodeToPath jQuery deleteNode Dubeau
//  LocalWords:  insertNodeAt MPL Mangalam gui setTextNodeValue TreeUpdater ev
//  LocalWords:  BeforeDeleteNode SetAttributeNS
