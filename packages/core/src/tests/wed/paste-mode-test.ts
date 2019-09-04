/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { expect } from "chai";

import { PasteMode, PasteModeChangeReason } from "wed/paste-mode";

describe("paste-mode", () => {
  describe("PasteMode", () => {
    describe("constructor", () => {
      it("constructs a PasteMode with the right initial state", () => {
        const mode = new PasteMode();
        expect(mode).to.have.property("asText").false;
        expect(mode).to.have.property("sticky").false;
      });
    });

    describe("#next()", () => {
      it("switches states", () => {
        const mode = new PasteMode();
        expect(mode).to.have.property("asText").false;
        expect(mode).to.have.property("sticky").false;

        mode.next();
        expect(mode).to.have.property("asText").true;
        expect(mode).to.have.property("sticky").false;

        mode.next();
        expect(mode).to.have.property("asText").true;
        expect(mode).to.have.property("sticky").true;

        mode.next();
        expect(mode).to.have.property("asText").false;
        expect(mode).to.have.property("sticky").false;
      });

      it("emits events", () => {
        const mode = new PasteMode();

        mode.events.subscribe(ev => {
          expect(ev).to.have.property("pasteMode").equal(mode);
          expect(ev).to.have.nested.property("previousState.asText").false;
          expect(ev).to.have.nested.property("previousState.sticky").false;
          expect(ev).to.have.property("reason")
            .equal(PasteModeChangeReason.NEXT);
        });

        expect(mode).to.have.property("asText").false;
        expect(mode).to.have.property("sticky").false;
        mode.next();
      });
    });

    describe("#use()", () => {
      it("when not sticky, clears asText", () => {
        const mode = new PasteMode();
        mode.next();
        expect(mode).to.have.property("asText").true;
        expect(mode).to.have.property("sticky").false;
        mode.use();
        expect(mode).to.have.property("asText").false;
        expect(mode).to.have.property("sticky").false;
      });

      it("emits events", () => {
        const mode = new PasteMode();

        expect(mode).to.have.property("asText").false;
        expect(mode).to.have.property("sticky").false;
        mode.next();

        expect(mode).to.have.property("asText").true;
        expect(mode).to.have.property("sticky").false;

        mode.events.subscribe(ev => {
          expect(ev).to.have.property("pasteMode").equal(mode);
          expect(ev).to.have.nested.property("previousState.asText").true;
          expect(ev).to.have.nested.property("previousState.sticky").false;
          expect(ev).to.have.property("reason")
            .equal(PasteModeChangeReason.USE);
        });

        mode.use();
        expect(mode).to.have.property("asText").false;
        expect(mode).to.have.property("sticky").false;
      });
    });

    describe("#reset()", () => {
      it("resets to default state", () => {
        const mode = new PasteMode();
        expect(mode).to.have.property("asText").false;
        expect(mode).to.have.property("sticky").false;

        mode.next();
        mode.next();
        expect(mode).to.have.property("asText").true;
        expect(mode).to.have.property("sticky").true;

        mode.reset();
        expect(mode).to.have.property("asText").false;
        expect(mode).to.have.property("sticky").false;
      });
    });
  });
});
