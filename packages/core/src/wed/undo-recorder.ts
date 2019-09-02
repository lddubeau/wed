/**
 * Listens to changes on a tree and records undo operations corresponding to
 * these changes.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { indexOf } from "./domutil";
import { Editor } from "./editor";
import { BeforeDeleteNodeEvent, InsertNodeAtEvent, SetAttributeNSEvent,
         SetCommentValueEvent, SetPIBodyEvent, SetTextNodeValueEvent,
         TreeUpdater } from "./tree-updater";
import * as undo from "./undo";

function getOuterHTML(node: Node | undefined | null): string {
  return (node == null) ? "undefined" : (node as Element).outerHTML;
}

/**
 * Undo operation for [["wed/tree-updater".InsertNodeAtEvent]].
 *
 * The parameters after ``tree_updater`` are the same as the properties on the
 * event corresponding to this class.
 *
 * @private
 */
class InsertNodeAtUndo extends undo.Undo {
  private readonly parentPath: string;
  private node: Node | undefined;
  private readonly index: number;

  /**
   * @param treeUpdater The tree updater to use to perform undo or redo
   * operations.
   *
   * @param parent
   * @param index
   */
  constructor(private readonly treeUpdater: TreeUpdater,
              { parent, index }: InsertNodeAtEvent) {
    super("InsertNodeAtUndo");
    this.index = index;
    this.parentPath = treeUpdater.nodeToPath(parent);

    // We do not take a node parameter and save it here because further
    // manipulations could take the node out of the tree. So we cannot rely in a
    // reference to a node. What we do instead is keep a path to the parent and
    // the index. The ``node`` property will be filled as needed when
    // undoing/redoing.
  }

  performUndo(): void {
    if (this.node !== undefined) {
      throw new Error("undo called twice in a row");
    }
    const parent = this.treeUpdater.pathToNode(this.parentPath)!;
    this.node = parent.childNodes[this.index].cloneNode(true);
    this.treeUpdater.deleteNode(parent.childNodes[this.index]);
  }

  performRedo(): void {
    if (this.node === undefined) {
      throw new Error("redo called twice in a row");
    }
    const parent = this.treeUpdater.pathToNode(this.parentPath)!;
    this.treeUpdater.insertNodeAt(parent, this.index, this.node);
    this.node = undefined;
  }

  toString(): string {
    return [this.desc, "\n",
            " Parent path: ", this.parentPath, "\n",
            " Index: ", this.index, "\n",
            " Node: ", getOuterHTML(this.node), "\n"].join("");
  }
}

/**
 * Common class for those undo objects which set a node to some string values.
 *
 * @private
 */
abstract class ValueUndo extends undo.Undo {
  private readonly nodePath: string;
  private readonly value: string;
  private readonly oldValue: string;

  /**
   * @param treeUpdater The tree updater to use to perform undo or redo
   * operations.
   */
  constructor(protected readonly treeUpdater: TreeUpdater,
              name: string, node: Node, value: string, oldValue: string) {
    super(name);
    this.value = value;
    this.oldValue = oldValue;
    this.nodePath = treeUpdater.nodeToPath(node);
  }

  protected abstract update(node: Node, value: string): void;

  performUndo(): void {
    this.update(this.treeUpdater.pathToNode(this.nodePath)!,
                this.oldValue);
  }

  performRedo(): void {
    this.update(this.treeUpdater.pathToNode(this.nodePath)!,
                this.value);
  }

  toString(): string {
    return [this.desc, "\n",
            " Node path: ", this.nodePath, "\n",
            " Value: ", this.value, "\n",
            " Old value: ", this.oldValue, "\n"].join("");
  }
}

/**
 * Undo operation for [["wed/tree-updater".SetTextNodeValueEvent]].
 *
 * @private
 */
class SetTextNodeValueUndo extends ValueUndo {
  /**
   * @param treeUpdater The tree updater to use to perform undo or redo
   * operations.
   */
  constructor(treeUpdater: TreeUpdater,
              { node, value, oldValue }: SetTextNodeValueEvent) {
    super(treeUpdater, "SetTextNodeValueUndo", node, value, oldValue);
  }

  protected update(node: Node, value: string): void {
    this.treeUpdater.setTextNodeValue(node as Text, value);
  }
}

/**
 * Undo operation for [["wed/tree-updater".BeforeDeleteNodeEvent]].
 *
 * @private
 */
class DeleteNodeUndo extends undo.Undo {
  private readonly parentPath: string;
  private readonly index: number;
  private node: Node | undefined;

  /**
   * @param treeUpdater The tree updater to use to perform undo or redo
   * operations.
   */
  constructor(private readonly treeUpdater: TreeUpdater,
              { node }: BeforeDeleteNodeEvent) {
    super("DeleteNodeUndo");
    const parent = node.parentNode!;
    this.parentPath = treeUpdater.nodeToPath(parent);
    this.index = indexOf(parent.childNodes, node);
    this.node = node.cloneNode(true);
  }

  performUndo(): void {
    if (this.node === undefined) {
      throw new Error("undo called twice in a row");
    }
    const parent = this.treeUpdater.pathToNode(this.parentPath)!;
    this.treeUpdater.insertNodeAt(parent, this.index, this.node);
    this.node = undefined;
  }

  performRedo(): void {
    if (this.node !== undefined) {
      throw new Error("redo called twice in a row");
    }
    const parent = this.treeUpdater.pathToNode(this.parentPath)!;
    this.node = parent.childNodes[this.index].cloneNode(true);
    this.treeUpdater.deleteNode(parent.childNodes[this.index]);
  }

  toString(): string {
    return [this.desc, "\n",
            " Parent path: ", this.parentPath, "\n",
            " Index: ", this.index, "\n",
            " Node: ", getOuterHTML(this.node), "\n"].join("");
  }
}

/**
 * Undo operation for [["wed/tree-updater".SetCommentValue]].
 *
 * @private
 */
class SetCommentValueUndo extends ValueUndo {
  /**
   * @param treeUpdater The tree updater to use to perform undo or redo
   * operations.
   */
  constructor(treeUpdater: TreeUpdater,
              { node, value, oldValue }: SetCommentValueEvent) {
    super(treeUpdater, "SetCommentValueUndo", node, value, oldValue);
  }

  protected update(node: Node, value: string): void {
    this.treeUpdater.setCommentValue(node as Comment, value);
  }
}

/**
 * Undo operation for [["wed/tree-updater".SetPIBody]].
 *
 * @private
 */
class SetPIBodyUndo extends ValueUndo {
  /**
   * @param treeUpdater The tree updater to use to perform undo or redo
   * operations.
   */
  constructor(treeUpdater: TreeUpdater,
              { node, value, oldValue }: SetPIBodyEvent) {
    super(treeUpdater, "SetPIBodyEvent", node, value, oldValue);
  }

  protected update(node: Node, value: string): void {
    this.treeUpdater.setPIBody(node as ProcessingInstruction, value);
  }
}

/**
 * Undo operation for [["wed/tree-updater".SetAttributeNSEvent]].
 *
 * @private
 */
class SetAttributeNSUndo extends undo.Undo {
  private readonly nodePath: string;
  private readonly ns: string;
  private readonly attribute: string;
  private readonly oldValue: string | null;
  private readonly newValue: string | null;

  /**
   * @param treeUpdater The tree updater to use to perform undo or redo
   * operations.
   */
  constructor(private readonly treeUpdater: TreeUpdater,
              { node, ns, attribute, oldValue,
                newValue }: SetAttributeNSEvent) {
    super("SetAttributeNSUndo");
    this.ns = ns;
    this.attribute = attribute;
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.nodePath = treeUpdater.nodeToPath(node);
  }

  performUndo(): void {
    const node = this.treeUpdater.pathToNode(this.nodePath) as Element;
    this.treeUpdater.setAttributeNS(node, this.ns, this.attribute,
                                    this.oldValue);
  }

  performRedo(): void {
    const node = this.treeUpdater.pathToNode(this.nodePath) as Element;
    this.treeUpdater.setAttributeNS(node, this.ns, this.attribute,
                                    this.newValue);
  }

  toString(): string {
    return [this.desc, "\n",
            " Node path: ", this.nodePath, "\n",
            " Namespace: ", this.ns, "\n",
            " Attribute Name: ", this.attribute, "\n",
            " New value: ", this.newValue, "\n",
            " Old value: ", this.oldValue, "\n"].join("");
  }
}

type RecorderEvents = InsertNodeAtEvent | SetTextNodeValueEvent |
  BeforeDeleteNodeEvent | SetAttributeNSEvent | SetCommentValueEvent |
  SetPIBodyEvent;
type RecorderEventNames = RecorderEvents["name"];

type EventNameToHandler<N extends RecorderEventNames> =
  new (updater: TreeUpdater, ev: Extract<RecorderEvents,
       { name: N }>) => undo.Undo;

type HandlerMap = { [k: string]: undefined } &
  { [k in RecorderEventNames]: EventNameToHandler<k> };

const ctors: HandlerMap = Object.create(null);
ctors.InsertNodeAt = InsertNodeAtUndo;
ctors.SetTextNodeValue = SetTextNodeValueUndo;
ctors.BeforeDeleteNode = DeleteNodeUndo;
ctors.SetAttributeNS = SetAttributeNSUndo;
ctors.SetCommentValue = SetCommentValueUndo;
ctors.SetPIBody = SetPIBodyUndo;

/**
 * Records undo operations.
 */
export class UndoRecorder {
  private suppress: boolean = false;

  /**
   * @param editor The editor for which this recorder is created.
   *
   * @param treeUpdater The tree updater on which to listen for modifications.
   */
  constructor(private readonly editor: Editor,
              private readonly treeUpdater: TreeUpdater) {
    treeUpdater.events.subscribe(ev => {
      if (this.suppress) {
        return;
      }

      const ctor = ctors[ev.name];
      if (ctor === undefined) {
        return;
      }

      // We need the type assertion here because TS does not realize that `ev`
      // is of the type that the handler requires.
      // tslint:disable-next-line:no-any
      this.editor.recordUndo(new ctor(this.treeUpdater, ev as any));
    });
  }

  /**
   * Sets the suppression state. When suppression is on, the recorder does not
   * record anything. When off, the recorder records. The recorder's suppression
   * state is initially off.
   *
   * @param suppress Whether to suppress or not.
   *
   * @throws {Error} If the call does not change the suppression state.
   */
  suppressRecording(suppress: boolean): void {
    if (suppress === this.suppress) {
      throw new Error("spurious call to suppressRecording");
    }
    this.suppress = suppress;
  }
}

//  LocalWords:  domutil insertNodeAt setTextNodeValue deleteNode ev param MPL
//  LocalWords:  InsertNodeAtUndo SetTextNodeValueUndo DeleteNodeUndo Dubeau
//  LocalWords:  pathToNode nodeToPath Mangalam SetAttributeNSUndo
//  LocalWords:  BeforeDeleteNode SetAttributeNS suppressRecording
