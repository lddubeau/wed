/**
 * Add interactivity to existing GUI elements.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import interact from "interactjs";

/**
 * This records changes in such a way that if any of the changes cannot take
 * effect, then all the changes are "rolled back". It is called pseudo-atomic
 * because it is not really meant to track any changes that do not happen
 * through instances of this class. This is needed because we are changing the
 * size of multiple elements, and beyond a certain "smallness", some elements
 * won't register any change in dimensions (perhaps due to "min-..." styles.
 */
class PseudoAtomicRectChange {
  private readonly changes: { el: HTMLElement; rect: ClientRect }[] = [];
  private rolledback: boolean = false;

  updateElementRect(el: HTMLElement, dx: number, dy: number): void {
    // If we've already rolled back, we don't do anything.
    if (this.rolledback) {
      return;
    }

    const rect = el.getBoundingClientRect();

    const width = rect.width + dx;
    const height = rect.height + dy;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    this.changes.push({ el, rect });
    const newRect = el.getBoundingClientRect();

    // Check whether the change "took". If not, roll back.
    if (newRect.width !== width || newRect.height !== height) {
      this.rollback();
    }
  }

  rollback(): void {
    const changes = this.changes;
    for (const change of changes) {
      const el = change.el;
      const rect = change.rect;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
    }

    this.rolledback = true;
  }
}

/**
 * Make a bootstrap dialog resizable by clicking on its edge. You must pass
 * sensible value as ``minWidth`` and ``minHeight`` to prevent resizing to
 * absurdly small sizes.
 *
 * @param $top The top level element of the dialog.
 *
 * @param minWidth The minimum width to set on the modal content.
 *
 * @param minHeight The minimum height to set on the modal content.
 */
export function makeResizable($top: JQuery, minWidth: number,
                              minHeight: number): void {
  // We listen to resizestart and resizeend to deal with the following scenario:
  // the user starts resizing the modal, it goes beyond the limits of how big it
  // can be resized, the mouse pointer moves outside the modal window and the
  // user releases the button when the pointer is outside. Without the use of
  // ignoreBackdropClick, this causes the modal to close.
  const content = $top.find(".modal-content")[0] as HTMLElement;
  content.style.minWidth = `${minWidth}px`;
  content.style.minHeight = `${minHeight}px`;
  interact(content)
    .resizable({})
    .on("resizestart", () => {
      const modal = $top.data("bs.modal");
      if (modal == null) {
        return; // Deal with edge cases.
      }
      // Prevent modal closure.
      modal.ignoreBackdropClick = true;
    })
    .on("resizeend", () => {
      // We use a setTimeout otherwise we turn ignoreBackdropClick too soon.
      setTimeout(() => {
        const modal = $top.data("bs.modal");
        if (modal == null) {
          return; // Deal with edge cases.
        }
        modal.ignoreBackdropClick = false;
      }, 0);
    })
    .on("resizemove", (event: interact.InteractEvent) => {
      const target = event.target;

      const change = new PseudoAtomicRectChange();
      change.updateElementRect(target, event.dx, event.dy);
    });
}

/**
 * Make a bootstrap dialog draggable by clicking and dragging the header.
 *
 * @param $top The top level element of the dialog.
 */
export function makeDraggable($top: JQuery): void {
  const win = $top[0].ownerDocument!.defaultView!;
  const header = $top.find(".modal-header")[0];
  const content = $top.find(".modal-content")[0] as HTMLElement;

  let startLeft: number;
  let startTop: number;
  interact(header)
    .draggable({
      restrict: {
        restriction: {
          left: 0,
          top: 0,
          right: win.innerWidth - 10,
          bottom: win.innerHeight - 10,
        },
      },
    })
    .on("dragstart", () => {
      startLeft = content.offsetLeft;
      startTop = content.offsetTop;
    })
    .on("dragmove", (event: interact.InteractEvent) => {
      content.style.left = `${startLeft + event.clientX - event.clientX0}px`;
      content.style.top = `${startTop + event.clientY - event.clientY0}px`;
    });
}
