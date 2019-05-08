/**
 * Listener for DOM tree changes.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { isElement } from "./domtypeguards";
import { findProcessingInstructions } from "./domutil";
import { BeforeDeleteNodeEvent, DeleteNodeEvent, InsertNodeAtEvent,
         SetAttributeNSEvent, SetCommentValueEvent, SetPIBodyEvent,
         SetTextNodeValueEvent, TreeUpdater } from "./tree-updater";

export interface BaseDOMListenerEvent {
  /** The name of the event. */
  readonly name: string;

  /** The root of the tree being listened on. */
  readonly root: Node;
}

/**
 * This event is fired when an element appears in the observed tree whether it
 * is directly added or added because its parent was added.  The opposite events
 * are [[ExcludingElementEvent]] and [[ExcludedElementEvent]].
 */
export interface IncludedElementEvent extends BaseDOMListenerEvent {
  readonly name: "included-element";

  /**
   * The node which is at the root of the tree *fragment* that was added to
   * trigger the event concering [[element]].
   */
  readonly tree: Node;

  /**
   * The element that was matched.
   */
  readonly element: Element;
}

/**
 * This event is generated when an element is removed from the tree directly or
 * because its parent was removed. It is the opposite of
 * [[IncludedElementEvent]].
 */
export interface ExcludedElementEvent extends BaseDOMListenerEvent {
  readonly name: "excluded-element";

  /**
   * The node which is at the root of the tree *fragment* that was removed to
   * trigger the event concering [[element]].
   */
  readonly tree: Node;

  /**
   * The **former** parent of the tree.
   */
  readonly parent: Node;

  /**
   * The element that was matched.
   */
  readonly element: Element;
}

/**
 * This event is generated when an element is **about to be removed** from the
 * tree directly or because its ancestor is about to be removed. It is the
 * opposite of [[IncludedElementEvent]].
 */
export interface ExcludingElementEvent extends BaseDOMListenerEvent {
  readonly name: "excluding-element";

  /**
   * The node which is at the root of the tree *fragment* that is about to be
   * removed to trigger the event concering [[element]].
   */
  readonly tree: Node;

  /**
   * The element that was matched.
   */
  readonly element: Element;
}

/**
 * Generated when an element has been directly added to the tree.
 */
export interface AddedElementEvent extends BaseDOMListenerEvent {
  readonly name: "added-element";

  /**
   * The element that was matched.
   */
  readonly element: Element;
}

/**
 * Generated when an element is about to be directly removed from the tree but
 * is still in the tree.
 */
export interface RemovingElementEvent extends BaseDOMListenerEvent {
  readonly name: "removing-element";

  /**
   * The element that was matched.
   */
  readonly element: Element;
}

/**
 * Generated when an element has been directly removed from the tree.
 */
export interface RemovedElementEvent extends BaseDOMListenerEvent {
  readonly name: "removed-element";

  /**
   * The **former** parent of [[element]].
   */
  readonly parent: Node;

  /**
   * The element that was matched.
   */
  readonly element: Element;
}

/**
 * Generated when the child of an element has been added to the element.
 */
export interface AddedChildEvent extends BaseDOMListenerEvent {
  readonly name: "added-child";

  /** The child that was added. */
  readonly child: Node;
}

/**
 * Generated when the child of an element is about to be removed from the
 * element.
 */
export interface RemovingChildEvent extends BaseDOMListenerEvent {
  readonly name: "removing-child";

  /** The child that is about to be removed. */
  readonly child: Node;
}

/**
 * Generated when the child of an element has been removed from the
 * element.
 */
export interface RemovedChildEvent extends BaseDOMListenerEvent {
  readonly name: "removed-child";

  /** The former parent. */
  readonly parent: Element;

  /** The child that has been removed. */
  readonly child: Node;
}

/**
 * Generated when a text node has its value changed.  A ``text-changed`` event
 * is not generated when Node objects of type ``TEXT_NODE`` are added or
 * removed. They trigger ``*-child`` events.
 */
export interface TextChangedEvent extends BaseDOMListenerEvent {
  readonly name: "text-changed";

  /** The text node that was changed. */
  readonly node: Text;

  /** The value the node had before this change. */
  readonly oldValue: string;
}

/**
 * Generated when a comment node has its value changed.  A ``comment-changed``
 * event is not generated when Node objects of type ``COMMENT_NODE`` are added
 * or removed. They trigger ``children-changed`` events.
 */
export interface CommentChangedEvent extends BaseDOMListenerEvent {
  readonly name: "comment-changed";

  /** The comment node that was changed. */
  readonly node: Comment;

  /** The value the node had before this change. */
  readonly oldValue: string;
}

/**
 * Generated when a processing instruction is included in the tree.
 */
export interface IncludedPIEvent extends BaseDOMListenerEvent {
  readonly name: "included-pi";

  /**
   * The node which is at the root of the tree *fragment* that was added to
   * trigger the event concerning [[pi]].
   */
  readonly tree: Node;

  /** The processing instruction that was included. */
  readonly pi: ProcessingInstruction;
}

/**
 * Generated when a processing instruction is about to be removed from the DOM.
 */
export interface ExcludingPIEvent extends BaseDOMListenerEvent {
  readonly name: "excluding-pi";

  /**
   * The node which is at the root of the tree *fragment* that is about to be
   * removed.
   */
  readonly tree: Node;

  /** The processing instruction that is about to be removed. */
  readonly pi: ProcessingInstruction;
}

/**
 * Generated when a processing instruction has been removed from the DOM.
 */
export interface ExcludedPIEvent extends BaseDOMListenerEvent {
  readonly name: "excluded-pi";

  /**
   * The node which is at the root of the tree *fragment* that was removed.
   */
  readonly tree: Node;

  /**
   * The **former** parent of the tree.
   */
  readonly parent: Node;

  /** The processing instruction was removed. */
  readonly pi: ProcessingInstruction;
}

/**
 * Generated when a processing instruction node has its body changed.  A
 * ``pi-changed`` event is not generated when Node objects of type
 * ``PROCESSING_INSTRUCTION_NODE`` are added or removed. They trigger
 * ``children-changed`` events.
 */
export interface PIChangedEvent extends BaseDOMListenerEvent {
  readonly name: "pi-changed";

  /** The processing instruction that was changed. */
  readonly node: ProcessingInstruction;

  /** The value the body of the node had before this change. */
  readonly oldValue: string;
}

/**
 * Generated when an attribute value has changed.
 */
export interface AttributeChangedEvent extends BaseDOMListenerEvent {
  readonly name: "attribute-changed";

  /** The element whose attribute changed. */
  readonly element: Element;

  /** The namespace of the attribute, as a URI. */
  readonly ns: string;

  /** The name of the attribute. */
  readonly attrName: string;

  /** The value the node had before this change. */
  readonly oldValue: string | null;
}

export interface TriggerEvent extends BaseDOMListenerEvent {
  readonly name: "trigger";
}

export type Events = IncludedElementEvent | ExcludedElementEvent |
  ExcludingElementEvent | AddedElementEvent | RemovingElementEvent |
  RemovedElementEvent | AddedChildEvent | RemovingChildEvent |
  RemovedChildEvent | TextChangedEvent | AttributeChangedEvent |
  CommentChangedEvent | IncludedPIEvent | ExcludingPIEvent | ExcludedPIEvent |
  PIChangedEvent | TriggerEvent;

export type EventNames = Events["name"];

export type EventHandler<E extends Events> = (ev: E) => void;

export type EventFor<N> = Extract<Events, { name: N }>;

type EventNameToHandler =
  { [name in EventNames]: EventHandler<EventFor<name>> };

export type EventHandlerFor<N extends EventNames> = EventNameToHandler[N];

export type SelectorHandlerPair<H> = readonly [string, H];

export type EventHandlerMap =
  { [name in Exclude<EventNames, "trigger">]:
    SelectorHandlerPair<FixFn<EventHandlerFor<name>>>[] };

//
// Work around a bug in TS.
//
// See
// https://github.com/Microsoft/TypeScript/issues/30889#issuecomment-482767931
//
type FixFn<T extends (...args: any[]) => any> =
  (...v: Parameters<T>) => ReturnType<T>;

type ChildEvents = "added-child" | "removing-child" | "removed-child";
type AddRemEvents = "added-element" | "removed-element" | "removing-element";
type IncludeExcludeEvents = "included-element" | "excluded-element" |
  "excluding-element";
type PIIncludeExcludeEvents = "included-pi" | "excluded-pi" | "excluding-pi";

interface ElementCallSpec<T extends Events> {
  fn: EventHandlerFor<T["name"]>;
  subtarget: Element;
}

interface PICallSpec<T extends Events> {
  fn: EventHandlerFor<T["name"]>;
  subtarget: ProcessingInstruction;
}

/**
 * This class models a listener designed to listen to changes to a DOM tree and
 * fire events on the basis of the changes that it detects.
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
 * event will be generated only for ``<ul>``. An ``added-child`` event will
 * be generated for the parent of ``<ul>``.
 *
 * If the fragment is removed, an ``excluding-element`` and ``excluded-element``
 * event will be generated for ``<ul>`` and ``<li>`` but a ``removing-element``
 * and ``remove-element`` event will be generated only for ``<ul>``. A
 * ``removing-child`` and ``removed-child`` event will be generated for the
 * parent of ``<ul>``.
 *
 * The order in which handlers are added matters. The listener provides the
 * following guarantee: for any given type of event, the handlers will be called
 * in the order that they were added to the listener.
 *
 * <h2>Warnings:</h2>
 *
 * - Keep in mind that the ``removed-child``, ``excluded-element`` and
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
 * - Handlers that are fired on ``*-child`` events, **and** which modify
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
    "added-child": [],
    "removing-child": [],
    "removed-child": [],
    "text-changed": [],
    "attribute-changed": [],
    "comment-changed": [],
    "included-pi": [],
    "excluding-pi": [],
    "excluded-pi": [],
    "pi-changed": [],
  };

  private readonly triggerHandlers: { [key: string]:
                                      EventHandlerFor<"trigger">[] }
    = Object.create(null);
  private triggersToFire: { [key: string]: number } = Object.create(null);
  private stopped: boolean = true;
  private scheduledProcessTriggers: number | undefined;

  /**
   * @param root The root of the DOM tree about which the listener should listen
   * to changes.
   *
   * @param updater The tree updator from which to generate events.
   */
  constructor(private readonly root: Node,
              private readonly updater: TreeUpdater) {
    this.updater.events.subscribe(ev => {
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
   * process.
   *
   * @param selector The selector has different meanings depending on
   * ``eventType``:
   *
   * - Generally, when adding an event handler, this argument is a CSS selector.
   *   What it matches depends on the event:
   *
   *   + For the ``*-element`` events, it matches the element for which an event
   *     is generated (which appears as the ``element`` field on these events).
   *
   *   + For the ``*-child`` events, it matches the *parent* of the child for
   *     which an event is generated. The matched element is
   *     ``child.parentNode`` on ``{added,removing}-child`` and it is the
   *     ``parent`` field on ``removed-child``.
   *
   *   + For the ``{text,comment,attribute}-changed`` events, it matches the
   *     parent of the node that changed. The matched element is
   *     ``node.parentNode`` on all these events.
   *
   *   + For the ``*-pi`` events and the ``pi-changed`` event the selector is
   *   not a CSS selector but a simple string matching the processing
   *   instruction name. The special value `"*"` may be used to match all
   *   processing instructions.
   *
   * - When adding a trigger handler, this argument is a trigger name.
   *
   * @param handler The handler to be called by this listener when the events
   * specified in ``eventTypes`` occur.
   *
   * @throws {Error} If an event is unrecognized.
   */
  addHandler<T extends EventNames>(eventType: T, selector: string,
                                   handler: FixFn<EventHandlerFor<T>>): void {
    if (eventType === "trigger") {
      let handlers = this.triggerHandlers[selector];
      if (handlers === undefined) {
        handlers = this.triggerHandlers[selector] = [];
      }

      handlers.push(handler as unknown as EventHandler<TriggerEvent>);
    }
    else {
      const pairs = this.eventHandlers[eventType as
                                       Exclude<EventNames, "trigger">] as
      (readonly [string, FixFn<EventHandlerFor<T>>])[];
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
      // We flush the map because the triggers could trigger more triggers. This
      // also explains why we are in a loop.
      this.triggersToFire = Object.create(null);

      const triggerMap = this.triggerHandlers;
      for (const key of keys) {
        const handlers = triggerMap[key];
        if (handlers !== undefined) {
          for (const handler of handlers) {
            handler({
              name: "trigger",
              root: this.root,
            });
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

    const ccCalls = this._childrenCalls("added-child", parent);

    let aeCalls: EventHandler<AddedElementEvent>[] = [];
    let ieCalls: ElementCallSpec<IncludedElementEvent>[] = [];
    if (isElement(node)) {
      aeCalls = this._addRemCalls("added-element", node);
      ieCalls = this._incExcCalls("included-element", node);
    }
    const piCalls = this._piCalls("included-pi", node);

    const { root } = this;
    const ccEvent = { name: "added-child", root, child: node } as const;
    for (const fn of ccCalls) {
      fn(ccEvent);
    }

    const aeEvent = { name: "added-element", root,
                      element: node as Element} as const;
    for (const fn of aeCalls) {
      fn(aeEvent);
    }

    for (const { fn, subtarget } of ieCalls) {
      fn({ name: "included-element", root, tree: node, element: subtarget});
    }

    for (const { fn, subtarget } of piCalls) {
      fn({ name: "included-pi", root, tree: node, pi: subtarget });
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

    const ccCalls = this._childrenCalls("removing-child", parent);

    let reCalls: EventHandler<RemovingElementEvent>[] = [];
    let eeCalls: ElementCallSpec<ExcludingElementEvent>[] = [];
    if (isElement(node)) {
      reCalls = this._addRemCalls("removing-element", node);
      eeCalls = this._incExcCalls("excluding-element", node);
    }
    const piCalls = this._piCalls("excluding-pi", node);

    const { root } = this;
    const ccEvent = { name: "removing-child", root, child: node } as const;
    for (const fn of ccCalls) {
      fn(ccEvent);
    }

    const reEvent = { name: "removing-element", root,
                      element: node as Element } as const;
    for (const fn of reCalls) {
      fn(reEvent);
    }

    for (const { fn, subtarget } of eeCalls) {
      fn({ name: "excluding-element", root, tree: node, element: subtarget });
    }

    for (const { fn, subtarget } of piCalls) {
      fn({ name: "excluding-pi", root, tree: node, pi: subtarget });
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

    const ccCalls = this._childrenCalls("removed-child", parent);

    let reCalls: EventHandler<RemovedElementEvent>[] = [];
    let eeCalls: ElementCallSpec<ExcludedElementEvent>[] = [];
    if (isElement(node)) {
      reCalls = this._addRemCalls("removed-element", node);
      eeCalls = this._incExcCalls("excluded-element", node);
    }
    const piCalls = this._piCalls("excluded-pi", node);

    const { root } = this;
    const ccEvent = { name: "removed-child", root, parent,
                      child: node } as const;
    for (const fn of ccCalls) {
      fn(ccEvent);
    }

    const reEvent = { name: "removed-element", root, parent,
                      element: node as Element } as const;
    for (const fn of reCalls) {
      fn(reEvent);
    }

    for (const { fn, subtarget } of eeCalls) {
      fn({ name: "excluded-element", root, tree: node, parent,
           element: subtarget});
    }

    for (const { fn, subtarget } of piCalls) {
      fn({ name: "excluded-pi", root, tree: node, parent, pi: subtarget });
    }

    this._scheduleProcessTriggers();
  }

  /**
   * Produces the calls for ``*-child`` events.
   *
   * @param call The type of call to produce.
   *
   * @param parent The parent of the children that have changed.
   *
   * @returns A list of call specs.
   */
  private _childrenCalls<T extends ChildEvents>(call: T, parent: Element):
  EventHandlerFor<T>[] {
    const ret: EventHandlerFor<T>[] = [];

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
    const fns: EventHandler<TextChangedEvent>[] = [];
    for (const [sel, fn] of this.eventHandlers["text-changed"]) {
      if (parent.matches(sel)) {
        fns.push(fn);
      }
    }

    const textEvent = { name: "text-changed", root: this.root, node,
                        oldValue } as const;
    for (const fn of fns) {
      fn(textEvent);
    }

    this._scheduleProcessTriggers();
  }

  /**
   * Handles comment changes events.
   *
   * @param ev The event.
   */
  private _setCommentValueHandler(ev: SetCommentValueEvent): void {
    if (this.stopped) {
      return;
    }

    const { node, oldValue } = ev;

    // Go over all the elements for which we have handlers
    const parent = node.parentNode as Element;
    const fns: EventHandler<CommentChangedEvent>[] = [];
    for (const [sel, fn] of this.eventHandlers["comment-changed"]) {
      if (parent.matches(sel)) {
        fns.push(fn);
      }
    }

    const commentEvent = { name: "comment-changed", root: this.root, node,
                           oldValue } as const;
    for (const fn of fns) {
      fn(commentEvent);
    }

    this._scheduleProcessTriggers();
  }

  /**
   * Handles processing instruction changes events.
   *
   * @param ev The event.
   */
  private _setPIBodyHandler(ev: SetPIBodyEvent): void {
    if (this.stopped) {
      return;
    }

    const { node, oldValue } = ev;

    // Go over all the elements for which we have handlers
    const fns: EventHandler<PIChangedEvent>[] = [];
    for (const [sel, fn] of this.eventHandlers["pi-changed"]) {
      if (sel === "*" || node.nodeName === sel) {
        fns.push(fn);
      }
    }

    const piEvent = { name: "pi-changed", root: this.root, node,
                      oldValue } as const;
    for (const fn of fns) {
      fn(piEvent);
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
    const fns: EventHandler<AttributeChangedEvent>[] = [];
    for (const [sel, fn] of this.eventHandlers["attribute-changed"]) {
      if (target.matches(sel)) {
        fns.push(fn);
      }
    }

    const attributeEvent = { name: "attribute-changed",
                             root: this.root, element: target, ns,
                             attrName: attribute, oldValue } as const;
    for (const fn of fns) {
      fn(attributeEvent);
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
  EventHandlerFor<T>[] {
    const ret: EventHandlerFor<T>[] = [];

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
  ElementCallSpec<EventFor<T>>[] {
    const ret: ElementCallSpec<EventFor<T>>[] = [];

    // Go over all the elements for which we have handlers
    for (const [sel, fn] of this.eventHandlers[name]) {
      if (node.matches(sel)) {
        ret.push({ fn, subtarget: node });
      }

      for (const subtarget of Array.from(node.querySelectorAll(sel))) {
        ret.push({ fn, subtarget });
      }
    }

    return ret;
  }

  private _piCalls<T extends PIIncludeExcludeEvents>(name: T, node: Node):
  PICallSpec<EventFor<T>>[] {
    const ret: PICallSpec<EventFor<T>>[] = [];

    for (const pi of findProcessingInstructions(node)) {
      for (const [sel, fn] of this.eventHandlers[name]) {
        if (sel === "*" || pi.nodeName === sel) {
          ret.push({ fn, subtarget: pi });
        }
      }
    }

    return ret;
  }
}
//  LocalWords:  eventType SetAttributeNS DeleteNode BeforeDeleteNode ul li MPL
//  LocalWords:  SetTextNodeValue nextSibling InsertNodeAt previousSibling DOM
//  LocalWords:  Dubeau Mangalam
