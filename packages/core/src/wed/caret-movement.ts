/**
 * Library of caret movement computations. This library is meant to compute
 * positions in the GUI tree.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { isRealElement } from "./convert";
import { DLoc } from "./dloc";
import { isDocument, isElement, isText } from "./domtypeguards";
import { Caret, childByClass, closest, closestByClass,
         indexOf } from "./domutil";
import { ModeTree } from "./mode-tree";
import { boundaryXY, getValueNode } from "./wed-util";

function moveInAttributes(node: Node, modeTree: ModeTree): boolean {
  return modeTree.getAttributeHandling(node) === "edit";
}

/**
 * @param pos The position form which we start.
 *
 * @param root The root of the DOM tree within which we move.
 *
 * @param after Whether we are to move after the placeholder (``true``) or not
 * (``false``).
 *
 * @returns If called with a position inside a placeholder, return a position
 * outside of the placeholder. Otherwise, return the position unchanged.
 */
function moveOutOfPlaceholder(pos: DLoc, root: Element | Document,
                              after: boolean): DLoc {
  // If we are in a placeholder node, immediately move out of it.
  const closestPh = closestByClass(pos.node, "_placeholder", root);
  if (closestPh !== null) {
    const parent = closestPh.parentNode!;
    let index = indexOf(parent.childNodes, closestPh);
    if (after) {
      index++;
    }

    pos = pos.make(parent, index);
  }

  return pos;
}

/**
 * Determine whether a position is within the editable content of an element or
 * outside of it. Modes often decorate elements by adding decorations before and
 * after the content of the element. These are not editable, and should be
 * skipped by caret movement.
 *
 * @param element The element in which the caret is appearing.
 *
 * @param offset The offset into the element at which the caret is positioned.
 *
 * @param modeTree The mode tree from which to get a mode.
 *
 * @returns ``true`` if we are inside editable content, ``false`` otherwise.
 */
function insideEditableContent(element: Element, offset: number,
                               modeTree: ModeTree): boolean {
  const mode = modeTree.getMode(element);
  const [before, after] = mode.nodesAroundEditableContents(element);

  // If the element has nodes before editable contents and the caret would
  // be before or among such nodes, then ...
  if (before !== null && indexOf(element.childNodes, before) >= offset) {
    return false;
  }

  // If the element has nodes after editable contents and the caret would be
  // after or among such nodes, then ...
  if (after !== null && indexOf(element.childNodes, after) < offset) {
    return false;
  }

  return true;
}

/**
 * @returns ``true`` if ``prev`` and ``next`` are both decorated; ``false``
 * otherwise.
 */
function bothDecorated(prev: Node | undefined,
                       next: Node | undefined): boolean {
  if (next === undefined || prev === undefined) {
    return false;
  }

  const nextFirst = next.firstChild;
  const prevLast = prev.lastChild;

  return isElement(nextFirst) &&
    nextFirst.classList.contains("_gui") &&
    !nextFirst.classList.contains("_invisible") &&
    isElement(prevLast) &&
    prevLast.classList.contains("_gui") &&
    !prevLast.classList.contains("_invisible");
}

/**
 * Find the first node in a set of nodes which is such that the reference node
 * **precedes** it.
 *
 * @param haystack The nodes to search.
 *
 * @param ref The reference node.
 *
 * @returns The first node in ``haystack`` which does not precede ``ref``.
 */
function findNext(haystack: NodeList | HTMLCollection,
                  ref: Node): Node | undefined {
  const { length } = haystack;
  for (let ix = 0; ix < length; ++ix) {
    const x = haystack[ix];
    // tslint:disable-next-line:no-bitwise
    if ((x.compareDocumentPosition(ref) &
         Node.DOCUMENT_POSITION_PRECEDING) !== 0) {
      return x;
    }
  }

  return undefined;
}

/**
 * This function determines the caret position if the caret was moved forward.
 *
 * This function does not fully emulate how a browser moves the caret. The sole
 * emulation it performs is to check whether whitespace matters or not. It skips
 * whitespace that does not matter. It is moreover designed to work in the GUI
 * tree of a wed editor, not in the data tree.
 *
 * @param caret A caret position where the search starts. This should be an
 * array of length two that has in first position the node where the caret is
 * and in second position the offset in that node. This pair is to be
 * interpreted in the same way node, offset pairs are interpreted in selection
 * or range objects.
 *
 * @param container A DOM node which indicates the container within which caret
 * movements must be contained.
 *
 * @returns The next caret position, or ``null`` if such position does not
 * exist. The ``container`` parameter constrains movements to positions inside
 * it.
 */
// tslint:disable-next-line:cyclomatic-complexity
export function nextCaretPosition(caret: Caret, container: Node): Caret | null {
  let [node, offset] = caret;
  if (!container.contains(node)) {
    return null;
  }

  const doc = isDocument(node) ? node : node.ownerDocument!;

  const window = doc.defaultView!;
  let found = false;
  while (!found) {
    const parent = node === container ? null : node.parentNode;
    switch (node.nodeType) {
      case Node.TEXT_NODE:
        if (offset >= (node as Text).length ||
            // If the parent node is set to normal whitespace handling, then
            // moving the caret forward by one position will skip this
            // whitespace.
            (parent !== null && parent.lastChild === node &&
             window.getComputedStyle(parent as Element, undefined)
             .whiteSpace === "normal" &&
             /^\s+$/.test((node as Text).data.slice(offset)))) {
          // We would move outside the container
          if (parent === null) {
            return null;
          }

          offset = indexOf(parent.childNodes, node) + 1;
          node = parent;
        }
        else {
          offset++;
          found = true;
        }
        break;
      case Node.ELEMENT_NODE:
        if (offset >= node.childNodes.length) {
          // If we've hit the end of what we can search, stop.
          if (parent === null) {
            return null;
          }

          offset = indexOf(parent.childNodes, node) + 1;
          node = parent;
          found = true;
        }
        else {
          node = node.childNodes[offset];
          offset = 0;
          // We want to stop if the new location points *into* a text node or
          // *into* an empty element, or does not point *to* a text node. (If it
          // points to a text node, we want to update the location to point
          // *into* the node.)
          found = isText(node) || (isElement(node) &&
                                   (node.childNodes.length === 0 ||
                                    !isText(node.childNodes[offset])));
        }
        break;
      default:
        // We point into something else than text or an element, move out to the
        // sibling.
        if (parent === null) {
          return null;
        }
        offset = indexOf(parent.childNodes, node) + 1;
        node = parent;
    }
  }

  return (node === container && offset >= node.childNodes.length) ?
    null : // We've moved to a position outside the container.
    [node, offset]; // We have a real position.
}

/**
 * Does the same as [[nextCaretPosition]] but if the returned position would be
 * in a text node, it returns a position in the element that contains the text
 * node instead.
 */
export function nextCaretPositionNoText(caret: Caret,
                                        container: Node): Caret | null {
  const loc = nextCaretPosition(caret, container);
  if (loc === null) {
    return null;
  }

  const [node] = loc;
  if (!isText(node)) {
    return loc;
  }

  const parent = node.parentNode;
  if (parent === null) {
    throw new Error("detached node");
  }

  return !container.contains(parent) ?
    null : // We've moved to a position outside the container.
    [parent, indexOf(parent.childNodes, node)]; // We have a real position.
}

/**
 * This function determines the caret position if the caret was moved backwards.
 *
 * This function does not fully emulate how a browser moves the caret. The sole
 * emulation it performs is to check whether whitespace matters or not. It skips
 * whitespace that does not matter.  It is moreover designed to work in the GUI
 * tree of a wed editor, not in the data tree.
 *
 * @param caret A caret position where the search starts. This should be an
 * array of length two that has in first position the node where the caret is
 * and in second position the offset in that node. This pair is to be
 * interpreted in the same way node, offset pairs are interpreted in selection
 * or range objects.
 *
 * @param container A DOM node which indicates the container within which caret
 * movements must be contained.
 *
 * @returns The previous caret position, or ``null`` if such position does not
 * exist. The ``container`` parameter constrains movements to positions inside
 * it.
 */
// tslint:disable-next-line:cyclomatic-complexity
export function prevCaretPosition(caret: Caret, container: Node): Caret | null {
  let [node, offset] = caret;
  if (!container.contains(node)) {
    return null;
  }

  const doc = isDocument(node) ? node : node.ownerDocument!;

  const window = doc.defaultView!;
  let found = false;
  while (!found) {
    offset--;
    const parent = node === container ? null : node.parentNode;
    switch (node.nodeType) {
      case Node.TEXT_NODE:
        if (offset < 0 ||
            // If the parent node is set to normal whitespace handling, then
            // moving the caret back by one position will skip this whitespace.
            (parent !== null && parent.firstChild === node &&
             window.getComputedStyle(parent as Element, undefined)
             .whiteSpace === "normal" &&
             /^\s+$/.test((node as Text).data.slice(0, offset)))) {
          // We would move outside the container
          if (parent === null) {
            return null;
          }

          offset = indexOf(parent.childNodes, node);
          node = parent;
        }
        else {
          found = true;
        }
        break;
      case Node.ELEMENT_NODE:
        if (offset < 0 || node.childNodes.length === 0) {
          // If we've hit the end of what we can search, stop.
          if (parent === null) {
            return null;
          }

          offset = indexOf(parent.childNodes, node);
          node = parent;
          found = true;
        }
        // If node.childNodes.length === 0, the first branch would have been
        // taken. No need to test that offset indexes to something that exists.
        else {
          node = node.childNodes[offset];
          if (isElement(node)) {
            offset = node.childNodes.length;
            found = node.childNodes.length === 0 ||
              !isText(node.childNodes[offset - 1]);
          }
          else {
            offset = (node as Text).length;
            found = isText(node);
          }
        }
        break;
      default:
        if (parent === null) {
          return null;
        }

        offset = indexOf(parent.childNodes, node);
        node = parent;
    }
  }

  return (node === container && offset < 0) ?
    null : // We've moved to a position outside the container.
    [node, offset];  // We have a real position.
}

/**
 * Does the same as [[prevCaretPosition]] but if the returned position would be
 * in a text node, it returns a position in the element that contains the text
 * node instead.
 */
export function prevCaretPositionNoText(caret: Caret,
                                        container: Node): Caret | null {
  const loc = prevCaretPosition(caret, container);
  if (loc === null) {
    return null;
  }

  const [node] = loc;
  if (!isText(node)) {
    return loc;
  }

  const parent = node.parentNode;
  if (parent === null) {
    throw new Error("detached node");
  }

  return !container.contains(parent) ?
    null : // We've moved to a position outside the container.
    [parent, indexOf(parent.childNodes, node)];  // We have a real position.
}

export type Direction = "right" | "left" | "up" | "down";

const directionToFunction = {
  right: positionRight,
  left: positionLeft,
  up: positionUp,
  down: positionDown,
};

export function newPosition(pos: DLoc | undefined | null,
                            direction: Direction,
                            docRoot: Document | Element,
                            modeTree: ModeTree): DLoc | undefined {
  const fn = directionToFunction[direction];
  if (fn === undefined) {
    throw new Error(`cannot resolve direction: ${direction}`);
  }

  return fn(pos, docRoot, modeTree);
}

/**
 * Compute the position to the right of a starting position. This function takes
 * into account wed-specific needs. For instance, it knows how start and end
 * labels are structured.
 *
 * @param pos The position at which we start.
 *
 * @param docRoot The element within which caret movement is to be constrained.
 *
 * @param modeTree The mode tree from which to get a mode.
 *
 * @returns The new position, or ``undefined`` if there is no such position.
 */
// tslint:disable-next-line:cyclomatic-complexity max-func-body-length
export function positionRight(pos: DLoc | undefined | null,
                              docRoot: Document | Element,
                              modeTree: ModeTree): DLoc | undefined {
  if (pos == null) {
    return undefined;
  }

  const root = pos.root;
  // If we are in a placeholder node, immediately move out of it.
  pos = moveOutOfPlaceholder(pos, root, true);

  // tslint:disable-next-line:strict-boolean-expressions no-constant-condition
  while (true) {
    const guiBefore = closestByClass(pos.node, "_gui", root);

    const nextCaret = nextCaretPosition(pos.toArray(), docRoot);
    if (nextCaret === null) {
      pos = null;
      break;
    }

    pos = pos.make(...nextCaret);
    const { node, offset } = pos;
    const closestGUI = closest(node, "._gui:not(._invisible)", root);
    if (closestGUI !== null) {
      const startLabel = closestGUI.classList.contains("__start_label");
      const real = closestByClass(closestGUI, "_real", root)!;
      const realIsRealElement = isRealElement(real);
      if (startLabel && realIsRealElement && moveInAttributes(real, modeTree)) {
        if (closestByClass(node, "_attribute_value", root) !== null) {
          // We're in an attribute value, stop here.
          break;
        }

        // Already in the element name, or in a previous attribute, move from
        // attribute to attribute.
        if (closest(node, "._element_name, ._attribute", root) !== null) {
          // Search for the next attribute.
          const nextAttr = findNext(
            closestGUI.getElementsByClassName("_attribute"), node);

          if (nextAttr !== undefined) {
            // There is a next attribute: move to it.
            const val = getValueNode(childByClass(nextAttr,
                                                  "_attribute_value")!);
            pos = pos.make(val, 0);
            break;
          }
        }
        // else fall through and move to end of gui element.
      }

      if (guiBefore === closestGUI) {
        // Move to the end of the gui element ...
        pos = pos.make(closestGUI, closestGUI.childNodes.length);
        // ... and then out of it.
        continue;
      }
      pos = pos.make(
        // If in an element label, normalize to element name. If in another kind
        // of gui element, normalize to start of the element.
        (realIsRealElement &&
         (startLabel || closestByClass(node, "_label", closestGUI) !== null)) ?
          (node as Element).getElementsByClassName("_element_name")[0] :
          closestGUI, 0);
      // ... stop here.
      break;
    }

    // Can't stop inside a phantom node.
    const closestPhantom = closestByClass(node, "_phantom", root);
    if (closestPhantom !== null) {
      // This ensures the next loop will move after the phantom.
      pos = pos.make(closestPhantom, closestPhantom.childNodes.length);
      continue;
    }

    // Or beyond the first position in a placeholder node.
    const closestPh = closestByClass(node, "_placeholder", root);
    if (closestPh !== null && offset > 0) {
      // This ensures the next loop will move after the placeholder.
      pos = pos.make(closestPh, closestPh.childNodes.length);
      continue;
    }

    // Make sure the position makes sense from an editing standpoint.
    if (isElement(node)) {
      const nextNode = node.childNodes[offset];

      // Always move into text
      if (isText(nextNode)) {
        continue;
      }

      const prevNode = node.childNodes[offset - 1];
      // Stop between two decorated elements.
      if (bothDecorated(prevNode, nextNode)) {
        break;
      }

      if (isElement(prevNode) &&
          // We do not stop in front of element nodes.
          ((isElement(nextNode) &&
            !nextNode.classList.contains("_end_wrapper") &&
            !prevNode.classList.contains("_start_wrapper")) ||
           prevNode.matches("._wed-validation-error, ._gui.__end_label"))) {
        // can't stop here
        continue;
      }

      // If the offset is not inside the editable content of the node, then...
      if (!insideEditableContent(node, offset, modeTree)) {
        // ... can't stop here.
        continue;
      }
    }

    // If we get here, the position is good!
    break;
  }

  return pos !== null ? pos : undefined;
}

/**
 * Compute the position to the left of a starting position. This function takes
 * into account wed-specific needs. For instance, it knows how start and end
 * labels are structured.
 *
 * @param pos The position at which we start.
 *
 * @param docRoot The element within which caret movement is to be constrained.
 *
 * @param modeTree The mode tree from which to get a mode.
 *
 * @returns The new position, or ``undefined`` if there is no such position.
 */
// tslint:disable-next-line:cyclomatic-complexity max-func-body-length
export function positionLeft(pos: DLoc | undefined | null,
                             docRoot: Document | Element,
                             modeTree: ModeTree): DLoc | undefined {
  if (pos == null) {
    return undefined;
  }

  const root = pos.root;
  // If we are in a placeholder node, immediately move out of it.
  pos = moveOutOfPlaceholder(pos, root, false);

  // tslint:disable-next-line:strict-boolean-expressions no-constant-condition
  while (true) {
    let elName = closestByClass(pos.node, "_element_name", root);
    const wasInName = (pos.node === elName) && (pos.offset === 0);
    const prevCaret = prevCaretPosition(pos.toArray(), docRoot);
    if (prevCaret === null) {
      pos = null;
      break;
    }

    pos = pos.make(...prevCaret);
    const node = pos.node;
    let offset = pos.offset;
    const closestGUI = closest(node, "._gui:not(._invisible)", root);
    if (closestGUI !== null) {
      const startLabel = closestGUI.classList.contains("__start_label");
      const real = closestByClass(closestGUI, "_real", root)!;
      const realIsRealElement = isRealElement(real);
      if (startLabel && !wasInName && realIsRealElement &&
          moveInAttributes(real, modeTree)) {
        if (closestByClass(node, "_attribute_value", closestGUI) !== null) {
          // We're in an attribute value, stop here.
          break;
        }

        let attr = closestByClass(node, "_attribute", closestGUI);
        if (attr === null &&
            isElement(node) &&
            node.nextElementSibling !== null &&
            node.nextElementSibling.classList.contains("_attribute")) {
          attr = node.nextElementSibling;
        }

        if (attr === null) {
          elName = closestByClass(node, "_element_name", closestGUI);
          attr = elName !== null ? elName.nextElementSibling : null;
        }

        let prevAttr = attr !== null ? attr.previousElementSibling : null;

        // If we have not yet found anything, then the
        // previous attribute is the last one.
        if (prevAttr === null) {
          const all = closestGUI.getElementsByClassName("_attribute");
          if (all.length > 0) {
            prevAttr = all[all.length - 1];
          }
        }

        // Eliminate those elements which are not attributes.
        if (prevAttr !== null && !prevAttr.classList.contains("_attribute")) {
          prevAttr = null;
        }

        if (prevAttr !== null) {
          // There is a previous attribute: move to it.
          let val: Node = childByClass(prevAttr, "_attribute_value")!;
          offset = 0;
          if (val.lastChild !== null) {
            val = val.lastChild;
            if (isElement(val) && val.classList.contains("_placeholder")) {
              offset = 0;
            }
            else if (isText(val)) {
              offset = val.length;
            }
            else {
              throw new Error("unexpected content in attribute value");
            }
          }
          pos = pos.make(val, offset);
          break;
        }
      }

      if (!wasInName) {
        pos = pos.make(
          // If we are in any element label, normalize to the element name,
          // otherwise normalize to the first position in the gui element.
          (realIsRealElement &&
           (startLabel ||
            closestByClass(node, "_label", closestGUI) !== null)) ?
              closestGUI.getElementsByClassName("_element_name")[0]
            : closestGUI,
          0);
        break;
      }

      // ... move to start of gui element ...
      pos = pos.make(closestGUI, 0);
      // ... and then out of it.
      continue;
    }

    const closestPh = closestByClass(node, "_placeholder", root);
    if (closestPh !== null) {
      // Stopping in a placeholder is fine, but normalize the position to the
      // start of the text.
      pos = pos.make(closestPh.firstChild!, 0);
      break;
    }

    // Can't stop inside a phantom node.
    const closestPhantom = closestByClass(node, "_phantom", root);
    if (closestPhantom !== null) {
      // Setting the position to this will ensure that on the next loop we move
      // to the left of the phantom node.
      pos = pos.make(closestPhantom, 0);
      continue;
    }

    // Make sure the position makes sense from an editing standpoint.
    if (isElement(node)) {
      const prevNode = node.childNodes[offset - 1];

      // Always move into text
      if (isText(prevNode)) {
        continue;
      }

      const nextNode = node.childNodes[offset];
      // Stop between two decorated elements.
      if (bothDecorated(prevNode, nextNode)) {
        break;
      }

      if (isElement(nextNode) &&
          // We do not stop just before a start tag button.
          ((isElement(prevNode) &&
            !prevNode.classList.contains("_start_wrapper") &&
            !nextNode.classList.contains("_end_wrapper")) ||
           // Can't stop right before a validation error.
           nextNode.matches("._gui.__start_label, .wed-validation-error"))) {
        continue;
      } // can't stop here

      // If the offset is not inside the editable content of the node, then...
      if (!insideEditableContent(node, offset, modeTree)) {
        // ... can't stop here.
        continue;
      }
    }

    // If we get here, the position is good!
    break;
  }

  return pos !== null ? pos : undefined;
}

/**
 * Compute the position under a starting position. This function takes into
 * account wed-specific needs. For instance, it knows how start and end labels
 * are structured.
 *
 * @param pos The position at which we start.
 *
 * @param docRoot The element within which caret movement is to be constrained.
 *
 * @param modeTree The mode tree from which to get a mode.
 *
 * @returns The new position, or ``undefined`` if there is no such position.
 */
export function positionDown(pos: DLoc | undefined | null,
                             docRoot: Document | Element,
                             modeTree: ModeTree): DLoc | undefined {
  if (pos == null) {
    return undefined;
  }

  // Search for the next line.
  const initialCaret = boundaryXY(pos);
  let next = initialCaret;
  while (initialCaret.bottom > next.top) {
    pos = positionRight(pos, docRoot, modeTree);
    if (pos === undefined) {
      return undefined;
    }
    next = boundaryXY(pos);
  }

  // pos is now at the start of the next line. We need to find the position that
  // is closest horizontally.

  const nextBottom = next.bottom;
  let minDist = Infinity;
  let minPosition;
  while (pos !== undefined) {
    const dist = Math.abs(next.left - initialCaret.left);
    // We've started moving away from the minimum distance.
    if (dist > minDist) {
      break;
    }

    // We've moved to yet another line. The minimum we have so far is *it*.
    if (nextBottom <= next.top) {
      break;
    }

    minDist = dist;
    minPosition = pos;
    pos = positionRight(pos, docRoot, modeTree);
    if (pos !== undefined) {
      next = boundaryXY(pos);
    }
  }

  return minPosition;
}

/**
 * Compute the position above a starting position. This function takes into
 * account wed-specific needs. For instance, it knows how start and end labels
 * are structured.
 *
 * @param pos The position at which we start.
 *
 * @param docRoot The element within which caret movement is to be constrained.
 *
 * @param modeTree The mode tree from which to get a mode.
 *
 * @returns The new position, or ``undefined`` if there is no such position.
 */
export function positionUp(pos: DLoc | undefined | null,
                           docRoot: Document | Element,
                           modeTree: ModeTree): DLoc | undefined {
  if (pos == null) {
    return undefined;
  }

  // Search for the previous line.
  const initialBoundary = boundaryXY(pos);
  let prev = initialBoundary;
  while (initialBoundary.top < prev.bottom) {
    pos = positionLeft(pos, docRoot, modeTree);
    if (pos === undefined) {
      return undefined;
    }
    prev = boundaryXY(pos);
  }

  // pos is now at the end of the previous line. We need to find the position
  // that is closest horizontally.

  const prevTop = prev.top;
  let minDist = Infinity;
  let minPosition;
  while (pos !== undefined) {
    const dist = Math.abs(prev.left - initialBoundary.left);
    // We've started moving away from the minimum distance.
    if (dist > minDist) {
      break;
    }

    // We've moved to yet another line. The minimum we have so far is *it*.
    if (prev.bottom <= prevTop) {
      break;
    }

    minDist = dist;
    minPosition = pos;
    pos = positionLeft(pos, docRoot, modeTree);
    if (pos !== undefined) {
      prev = boundaryXY(pos);
    }
  }

  return minPosition;
}

//  LocalWords:  docRoot firstChild pos
