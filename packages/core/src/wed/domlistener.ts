/**
 * Listener for DOM tree changes.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { isElement } from "./domtypeguards";
import { BeforeDeleteNodeEvent, DeleteNodeEvent, InsertNodeAtEvent,
         SetAttributeNSEvent, SetTextNodeValueEvent,
         TreeUpdater } from "./tree-updater";

export type SelectorHandlerPair<H> = [string, H];

/**
 * Called when a **tree fragment** is added which contains the element matched
 * by the selector that was passed to [[DOMListener.addHandler]].
 *
 * @param root The root of the tree being listened on.
 *
 * @param tree The node which is at the root of the tree *fragment* that was
 * added to trigger the event.
 *
 * @param parent The parent of the tree.
 *
 * @param previousSibling The sibling that precedes ``tree``.
 *
 * @param nextSibling The sibling that follows ``tree``.
 *
 * @param element The element that was matched.
 */
export type IncludedElementHandler = (root: Node, tree: Node, parent: Node,
                                      previousSibling: Node | null,
                                      nextSibling: Node | null,
                                      element: Element) => void;

/**
 * Called when a **tree fragment** is removed which contains the element matched
 * by the selector that was passed to [[DOMListener.addHandler]].
 *
 * @param root The root of the tree being listened on.
 *
 * @param tree The node which is at the root of the tree *fragment* that was
 * removed to trigger the event.
 *
 * @param parent The former parent of the tree.
 *
 * @param previousSibling ``null`` because the tree no longer has siblings.
 *
 * @param nextSibling ``null`` because the tree no longer has siblings.
 *
 * @param element The element that was matched.
 */
export type ExcludedElementHandler = (root: Node, tree: Node, parent: Node,
                                      previousSibling: null,
                                      nextSibling: null,
                                      element: Element) => void;

/**
 * Called when a **tree fragment** is about to be removed and contains the
 * element matched by the selector that was passed to
 * [[DOMListener.addHandler]].
 *
 * @param root The root of the tree being listened on.
 *
 * @param tree The node which is at the root of the tree *fragment* that is
 * being removed.
 *
 * @param parent The parent of the tree.
 *
 * @param previousSibling The sibling that precedes ``tree``.
 *
 * @param nextSibling The sibling that follows ``tree``.
 *
 * @param element The element that was matched.
 */
export type ExcludingElementHandler = (root: Node, tree: Node, parent: Node,
                                       previousSibling: Node | null,
                                       nextSibling: Node | null,
                                       element: Element) => void;

/**
 * Called when an element has been directly added to the tree.  There is no
 * reason to provide ``parent``, ``previousSibling``, ``nextSibling`` for an
 * ``added-element`` event but having the same signature for additions and
 * removals allows use of the same function for both cases.
 *
 * @param root The root of the tree being listened on.
 *
 * @param parent The parent of the element that was added.
 *
 * @param previousSibling The sibling that precedes the element.
 *
 * @param nextSibling The sibling that follows the element.
 *
 * @param element The element that was matched.
 */
export type AddedElementHandler = (root: Node, parent: Node,
                                   previousSibling: Node | null,
                                   nextSibling: Node | null,
                                   element: Element) => void;

/**
 * Called when an element is about to be directly removed from the tree.
 *
 * @param root The root of the tree being listened on.
 *
 * @param parent The parent of the element that was added.
 *
 * @param previousSibling The sibling that precedes the element.
 *
 * @param nextSibling The sibling that follows the element.
 *
 * @param element The element that was matched.
 */
export type RemovingElementHandler = (root: Node, parent: Node,
                                      previousSibling: Node | null,
                                      nextSibling: Node | null,
                                      element: Element) => void;

/**
 * Called when an element is has been directly removed from the tree.
 *
 * @param root The root of the tree being listened on.
 *
 * @param parent The former parent of ``element``.
 *
 * @param previousSibling ``null`` because the element is no longer in the tree.
 *
 * @param nextSibling ``null`` because the element is no longer in the tree.
 *
 * @param element The element that was matched.
 */
export type RemovedElementHandler = (root: Node, parent: Node,
                                     previousSibling: null, nextSibling: null,
                                     element: Element) => void;

/**
 * Called when children are about to be *removed* from an element. Note the
 * asymmetry: **these handlers are not called when nodes are added!!**
 *
 * @param root The root of the tree being listened on.
 *
 * @param added The nodes that are about to be added. This will always be an
 * empty list.
 *
 * @param removed The nodes that are about to be removed.
 *
 * @param previousSibling: The node before the list of nodes to be removed.
 *
 * @param nextSibling: The node after the list of nodes to be removed.
 *
 * @param element: The element whose children are being removed.
 */
export type ChildrenChangingHandler = (root: Node, added: readonly Node[],
                                       removed: readonly Node[],
                                       previousSibling: Node | null,
                                       nextSibling: Node | null,
                                       element: Element) => void;

/**
 * Called when children of an element have been added to or removed from the
 * element. Note that the listener will call handlers with at most one of
 * ``added`` or ``removed`` non-empty.
 *
 * @param root The root of the tree being listened on.
 *
 * @param added The nodes that were added.
 *
 * @param removed The nodes that were removed.
 *
 * @param previousSibling: The node before the list of nodes added or
 * removed. When the handler is called after a removal of children, this is
 * necessarily ``null``.
 *
 * @param nextSibling: The node after the list of nodes added or removed. When
 * the handler is called after a removal of children, this is necessarily
 * ``null``.
 *
 * @param element: The element whose children were modified.
 */
export type ChildrenChangedHandler = (root: Node, added: readonly Node[],
                                      removed: readonly Node[],
                                      previousSibling: Node | null,
                                      nextSibling: Node | null,
                                      element: Element) => void;

/**
 * Called when a text node has its value changed.  A ``text-changed`` event is
 * not generated when Node objects of type ``TEXT_NODE`` are added or
 * removed. They trigger ``children-changed`` events.
 *
 * @param root The root of the tree being listened on.
 *
 * @param node The text node that was changed.
 *
 * @param oldValue The value the node had before this change.
 */
export type TextChangedHandler = (root: Node, node: Text,
                                  oldValue: string) => void;

/**
 * Called when an attribute value has been changed.
 *
 * @param root The root of the tree being listened on.
 *
 * @param element The element whose attribute changed.
 *
 * @param ns The URI of the namespace of the attribute.
 *
 * @param name The name of the attribute.
 *
 * @param oldValue The value of the attribute before this change.
 */
export type AttributeChangedHandler = (root: Node, element: Element, ns: string,
                                       name: string,
                                       oldValue: string | null) => void;

/**
 * A ``trigger`` event with name ``[name]`` is fired when ``trigger([name])`` is
 * called. Trigger events are meant to be triggered by event handlers called by
 * the listener, not by other code.
 */
export type TriggerHandler = (root: Node) => void;

export interface EventHandlers {
  "included-element": IncludedElementHandler;
  "excluded-element": ExcludedElementHandler;
  "excluding-element": ExcludingElementHandler;
  "added-element": AddedElementHandler;
  "removing-element": RemovingElementHandler;
  "removed-element": RemovedElementHandler;
  "children-changing": ChildrenChangingHandler;
  "children-changed": ChildrenChangedHandler;
  "text-changed": TextChangedHandler;
  "attribute-changed": AttributeChangedHandler;
}

export interface Handlers extends EventHandlers {
  "trigger": TriggerHandler;
}

export type Events = keyof EventHandlers;

export type EventsOrTrigger = keyof Handlers;

export type EventHandlerMap =
  { [name in Events]: SelectorHandlerPair<EventHandlers[name]>[] };

type ChildEvents = "children-changing" | "children-changed";
type AddRemEvents = "added-element" | "removed-element" | "removing-element";
type IncludeExcludeEvents = "included-element" | "excluded-element" |
  "excluding-element";

interface CallSpec<T extends Events> {
  fn: EventHandlers[T];
  subtarget: Element;
}

/**
 * This class models a listener designed to listen to changes to a DOM tree and
 * fire events on the basis of the changes that it detects.
 *
 * An  ``included-element``  event is  fired  when  an  element appears  in  the
 * observed tree  whether it is directly  added or added because  its parent was
 * added.     The    opposite     events    are     ``excluding-element``    and
 * ``excluded-element``.  The event  ``excluding-element`` is  generated *before
 * the tree fragment is removed, and ``excluded-element`` *after*.
 *
 * An ``added-element`` event is fired when an element is directly added to the
 * observed tree. The opposite events are ``removing-element`` and
 * ``removed-element``.
 *
 * A ``children-changing`` and ``children-changed`` event are fired when an
 * element's children are being changed.
 *
 * A ``text-changed`` event is fired when a text node has changed.
 *
 * An ``attribute-changed`` is fired when an attribute has changed.
 *
 * A ``trigger`` event with name ``[name]`` is fired when ``trigger([name])`` is
 * called. Trigger events are meant to be triggered by event handlers called by
 * the listener, not by other code.
 *
 * <h2>Example</h2>
 *
 * Consider the following HTML fragment:
 *
 *     <ul>
 *      <li>foo</li>
 *     </ul>
 *
 * If the fragment is added to a ``<div>`` element, an ``included-element``
 * event will be generated for ``<ul>`` and ``<li>`` but an ``added-element``
 * event will be generated only for ``<ul>``. A ``changed-children`` event will
 * be generated for the parent of ``<ul>``.
 *
 * If the fragment is removed, an ``excluding-element`` and ``excluded-element``
 * event will be generated for ``<ul>`` and ``<li>`` but a ``removing-element``
 * and ``remove-element`` event will be generated only for ``<ul>``. A
 * ``children-changing`` and ``children-changed`` event will be generated for
 * the parent of ``<ul>``.
 *
 * The order in which handlers are added matters. The listener provides the
 * following guarantee: for any given type of event, the handlers will be called
 * in the order that they were added to the listener.
 *
 * <h2>Warnings:</h2>
 *
 * - Keep in mind that the ``children-changed``, ``excluded-element`` and
 *   ``removed-element`` events are generated **after** the DOM operation that
 *   triggers them. This has some consequences. In particular, a selector that
 *   will work perfectly with ``removing-element`` or ``excluding-element`` may
 *   not work with ``removed-element`` and ``excluded-element``. This would
 *   happen if the selector tests for ancestors of the element removed or
 *   excluded. By the time the ``-ed`` events are generated, the element is gone
 *   from the DOM tree and such selectors will fail.
 *
 *   The ``-ed`` version of these events are still useful. For instance, a wed
 *   mode in use for editing scholarly articles listens for ``excluded-element``
 *   with a selector that is a tag name so that it can remove references to
 *   these elements when they are removed. Since it does not need anything more
 *   complex then ``excluded-element`` works perfectly.
 *
 * - A listener does not verify whether the parameters passed to handlers are
 *   part of the DOM tree. For instance, handler A could operate on element X so
 *   that it is removed from the DOM tree. If there is already another mutation
 *   on X in the pipeline by the time A is called and handler B is called to
 *   deal with it, then by the time B is run X will no longer be part of the
 *   tree.
 *
 *   To put it differently, even if when an event is generated element X was
 *   part of the DOM tree, it is possible that by the time the handlers that
 *   must be run for that mutation are run, X is no longer part of the DOM tree.
 *
 *   Handlers that care about whether they are operating on elements that are in
 *   the DOM tree should perform a test themselves to check whether what is
 *   passed to them is still in the tree.
 *
 *   The handlers fired on removed-elements events work on nodes that have been
 *   removed from the DOM tree. To know what was before and after these nodes
 *   **before** they were removed use events that have ``previous_sibling`` and
 *   ``next_sibling`` parameters, because it is likely that the nodes themselves
 *   will have both their ``previousSibling`` and ``nextSibling`` set to
 *   ``null``.
 *
 * - Handlers that are fired on children-changed events, **and** which modify
 *   the DOM tree can easily result in infinite loops. Care should be taken
 *   early in any such handler to verify that the kind of elements added or
 *   removed **should** result in a change to the DOM tree, and ignore those
 *   changes that are not relevant.
 */
export class DOMListener {
  private readonly eventHandlers: EventHandlerMap = {
      "included-element": [],
      "added-element": [],
      "excluded-element": [],
      "excluding-element": [],
      "removed-element": [],
      "removing-element": [],
      "children-changed": [],
      "children-changing": [],
      "text-changed": [],
      "attribute-changed": [],
  };

  private readonly triggerHandlers: { [key: string]: TriggerHandler[] }
    = Object.create(null);
  private triggersToFire: { [key: string]: number } = Object.create(null);
  private stopped: boolean = true;
  private scheduledProcessTriggers: number | undefined;

  /**
   * @param root The root of the DOM tree about which the listener should listen
   * to changes.
   */
  constructor(private readonly root: Node,
              private readonly updater: TreeUpdater) {
    this.updater.events.subscribe((ev) => {
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
      case "DeleteNode":
        this._deleteNodeHandler(ev);
        break;
      case "SetAttributeNS":
        this._setAttributeNSHandler(ev);
        break;
      default:
        // Do nothing...
      }
    });
  }

  /**
   * Start listening to changes on the root passed when the object was
   * constructed.
   */
  startListening(): void {
    this.stopped = false;
  }

  /**
   * Stops listening to DOM changes.
   */
  stopListening(): void {
    this.stopped = true;
  }

  /**
   * Process all changes immediately.
   */
  processImmediately(): void {
    if (this.scheduledProcessTriggers !== undefined) {
      this.clearPending();
      this._processTriggers();
    }
  }

  /**
   * Clear anything that is pending. Some implementations may have triggers
   * delivered asynchronously.
   */
  clearPending(): void {
    if (this.scheduledProcessTriggers !== undefined) {
      window.clearTimeout(this.scheduledProcessTriggers);
      this.scheduledProcessTriggers = undefined;
    }
  }

  /**
   * Adds an event handler or a trigger handler. Note that if you want to add a
   * trigger handler, the first argument must be a single string, due to how the
   * 2nd argument is interpreted.
   *
   * @param eventTypes Either a string naming the event this handler will
   * process or an array of strings if multiple types of events are to be
   * handled.
   *
   * @param selector When adding an event handler, this argument is a CSS
   * selector. When adding a trigger handler, this argument is a trigger name.
   *
   *   Note that the meaning of the ``selector`` parameter for ``text-changed``
   *   events is different than the usual. Whereas for all other handlers, the
   *   ``selector`` matches the ``element`` parameter passed to the handlers, in
   *   the case of a ``text-changed`` event the ``selector`` matches the
   *   **parent** of the ``node`` parameter.
   *
   * @param handler The handler to be called by this listener when the events
   * specified in ``eventTypes`` occur.
   *
   * @throws {Error} If an event is unrecognized.
   */
  addHandler(eventType: "trigger", selector: string,
             handler: TriggerHandler): void;
  addHandler<T extends Events>(eventType: T, selector: string,
                               handler: EventHandlers[T]): void;
  addHandler<T extends Events>(eventType: T | "trigger", selector: string,
                               handler: EventHandlers[T] | TriggerHandler):
  void {
    if (eventType === "trigger") {
      let handlers = this.triggerHandlers[selector];
      if (handlers === undefined) {
        handlers = this.triggerHandlers[selector] = [];
      }

      handlers.push(handler as TriggerHandler);
    }
    else {
      // As of TS 2.2.2, we need to the type annotation in the next line.
      const pairs: SelectorHandlerPair<EventHandlers[T]>[] =
        this.eventHandlers[eventType];
      if (pairs === undefined) {
        throw new Error(`invalid eventType: ${eventType}`);
      }

      pairs.push([selector, handler]);
    }
  }

  /**
   * Tells the listener to fire the named trigger as soon as possible.
   *
   * @param {string} name The name of the trigger to fire.
   */
  trigger(name: string): void {
    this.triggersToFire[name] = 1;
  }

  /**
   * Processes pending triggers.
   */
  protected _processTriggers(): void {
    let keys = Object.keys(this.triggersToFire);
    while (keys.length > 0) {
      // We flush the map because the triggers could trigger
      // more triggers. This also explains why we are in a loop.
      this.triggersToFire = Object.create(null);

      const triggerMap = this.triggerHandlers;
      for (const key of keys) {
        const handlers = triggerMap[key];
        if (handlers !== undefined) {
          for (const handler of handlers) {
            handler(this.root);
          }
        }
      }

      // See whether there is more to trigger.
      keys = Object.keys(this.triggersToFire);
    }
  }

  /**
   * Handles node additions.
   *
   * @param ev The event.
   */
  private _insertNodeAtHandler(ev: InsertNodeAtEvent): void {
    if (this.stopped) {
      return;
    }

    const parent = ev.parent as Element;
    const node = ev.node;

    //
    // The semantics of DOMListener are such that we must:
    //
    // 1. Record the parameters that will be used to call the handlers prior to
    // calling any handler.
    //
    // 2. Gather *all* the calls to call prior to calling any handler.
    //
    // 1 and 2 can be done in any order relative to one another.
    //

    const ccCalls = this._childrenCalls("children-changed", parent);

    let aeCalls: AddedElementHandler[] = [];
    let ieCalls: CallSpec<"included-element">[] = [];
    if (isElement(node)) {
      aeCalls = this._addRemCalls("added-element", node);
      ieCalls = this._incExcCalls("included-element", node);
    }

    const { root } = this;
    const added = [node];
    const removed: Node[] = [];
    const { previousSibling, nextSibling } = node;
    for (const fn of ccCalls) {
      fn(root, added, removed, previousSibling, nextSibling, parent);
    }

    for (const fn of aeCalls) {
      fn(root, parent, previousSibling, nextSibling, node as Element);
    }

    for (const { fn, subtarget } of ieCalls) {
      fn(root, node, parent, previousSibling, nextSibling, subtarget);
    }

    this._scheduleProcessTriggers();
  }

  /**
   * Handles node deletions.
   *
   * @param ev The event.
   */
  private _beforeDeleteNodeHandler(ev: BeforeDeleteNodeEvent): void {
    if (this.stopped) {
      return;
    }

    const node = ev.node;
    const parent = node.parentNode as Element;

    //
    // The semantics of DOMListener are such that we must:
    //
    // 1. Record the parameters that will be used to call the handlers prior to
    // calling any handler.
    //
    // 2. Gather *all* the calls to call prior to calling any handler.
    //
    // 1 and 2 can be done in any order relative to one another.
    //

    const ccCalls = this._childrenCalls("children-changing", parent);

    let reCalls: RemovingElementHandler[] = [];
    let eeCalls: CallSpec<"excluding-element">[] = [];
    if (isElement(node)) {
      reCalls = this._addRemCalls("removing-element", node);
      eeCalls = this._incExcCalls("excluding-element", node);
    }

    const { root } = this;
    const added: Node[] = [];
    const removed = [node];
    const { previousSibling, nextSibling } = node;
    for (const fn of ccCalls) {
      fn(root, added, removed, previousSibling, nextSibling, parent);
    }

    for (const fn of reCalls) {
      fn(root, parent, previousSibling, nextSibling, node as Element);
    }

    for (const { fn, subtarget } of eeCalls) {
      fn(root, node, parent, previousSibling, nextSibling, subtarget);
    }

    this._scheduleProcessTriggers();
  }

  /**
   * Handles node deletion events.
   *
   * @param ev The event.
   */
  private _deleteNodeHandler(ev: DeleteNodeEvent): void {
    if (this.stopped) {
      return;
    }

    const node = ev.node;
    const parent = ev.formerParent as Element;

    //
    // The semantics of DOMListener are such that we must:
    //
    // 1. Record the parameters that will be used to call the handlers prior to
    // calling any handler.
    //
    // 2. Gather *all* the calls to call prior to calling any handler.
    //
    // 1 and 2 can be done in any order relative to one another.
    //

    const ccCalls = this._childrenCalls("children-changed", parent);

    let reCalls: RemovedElementHandler[] = [];
    let eeCalls: CallSpec<"excluded-element">[] = [];
    if (isElement(node)) {
      reCalls = this._addRemCalls("removed-element", node);
      eeCalls = this._incExcCalls("excluded-element", node);
    }

    const { root } = this;
    const added: Node[] = [];
    const removed = [node];
    for (const fn of ccCalls) {
      fn(root, added, removed, null, null, parent);
    }

    for (const fn of reCalls) {
      fn(root, parent, null, null, node as Element);
    }

    for (const { fn, subtarget } of eeCalls) {
      fn(root, node, parent, null, null, subtarget);
    }

    this._scheduleProcessTriggers();
  }

  /**
   * Produces the calls for ``children-...`` events.
   *
   * @param call The type of call to produce.
   *
   * @param parent The parent of the children that have changed.
   *
   * @returns A list of call specs.
   */
  private _childrenCalls<T extends ChildEvents>(call: T,
                                                parent: Element):
  EventHandlers[T][] {
    const ret: EventHandlers[T][] = [];

    // Go over all the elements for which we have handlers
    for (const [sel, fn] of this.eventHandlers[call]) {
      if (parent.matches(sel)) {
        ret.push(fn);
      }
    }

    return ret;
  }

  /**
   * Handles text node changes events.
   *
   * @param ev The event.
   */
  private _setTextNodeValueHandler(ev: SetTextNodeValueEvent): void {
    if (this.stopped) {
      return;
    }

    const { node, oldValue } = ev;

    // Go over all the elements for which we have handlers
    const parent = node.parentNode as Element;
    for (const [sel, fn] of this.eventHandlers["text-changed"]) {
      if (parent.matches(sel)) {
        fn(this.root, node, oldValue);
      }
    }

    this._scheduleProcessTriggers();
  }

  /**
   * Handles attribute change events.
   *
   * @param ev The event.
   */
  private _setAttributeNSHandler(ev: SetAttributeNSEvent): void {
    if (this.stopped) {
      return;
    }

    const { ns, attribute, oldValue, node: target } = ev;

    // Go over all the elements for which we have handlers
    for (const [sel, fn] of this.eventHandlers["attribute-changed"]) {
      if (target.matches(sel)) {
        fn(this.root, target, ns, attribute, oldValue);
      }
    }

    this._scheduleProcessTriggers();
  }

  /**
   * Sets a timeout to run the triggers that must be run.
   */
  private _scheduleProcessTriggers(): void {
    if (this.scheduledProcessTriggers !== undefined) {
      return;
    }
    this.scheduledProcessTriggers = window.setTimeout(() => {
      this.scheduledProcessTriggers = undefined;
      this._processTriggers();
    },
                                                      0);
  }

  /**
   * Get the calls for the added/removed family of events.
   *
   * @param name The event name.
   *
   * @param node The node added or removed.
   *
   * @returns A list of calls.
   */
  private _addRemCalls<T extends AddRemEvents>(name: T, node: Element):
  EventHandlers[T][] {
    const ret: EventHandlers[T][] = [];

    // Go over all the elements for which we have handlers
    for (const [sel, fn] of this.eventHandlers[name]) {
      if (node.matches(sel)) {
        ret.push(fn);
      }
    }

    return ret;
  }

  /**
   * Produces the calls for included/excluded family of events.
   *
   * @param name The event name.
   *
   * @param node The node which was included or excluded and for which we must
   * issue the events.
   *
   * @returns A list of call specs.
   */
  private _incExcCalls<T extends IncludeExcludeEvents>(name: T, node: Element):
  CallSpec<T>[] {
    const ret: CallSpec<T>[] = [];

    // Go over all the elements for which we have handlers
    for (const [sel, fn] of this.eventHandlers[name]) {
      if (node.matches(sel)) {
        ret.push({ fn, subtarget: node });
      }

      const targets = node.querySelectorAll(sel);
      for (const subtarget of Array.prototype.slice.call(targets)) {
        ret.push({ fn, subtarget });
      }
    }

    return ret;
  }

}
//  LocalWords:  eventType SetAttributeNS DeleteNode BeforeDeleteNode ul li MPL
//  LocalWords:  SetTextNodeValue nextSibling InsertNodeAt previousSibling DOM
//  LocalWords:  Dubeau Mangalam
