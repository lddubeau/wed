/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import sinon from "sinon";

import { CaretMark } from "wed/caret-mark";
import { Layer } from "wed/gui/layer";
import { Scroller } from "wed/gui/scroller";

const expect = chai.expect;

describe("CaretMark", () => {
  let mark: CaretMark;
  let input: HTMLInputElement;
  let layer: Layer;
  let scroller: Scroller;

  before(() => {
    const layerEl = document.createElement("div");
    const scrollerEl = document.createElement("scrollerEl");
    input = document.createElement("input");
    layer = new Layer(layerEl);
    scroller = new Scroller(scrollerEl);
  });

  beforeEach(() => {
    mark = new CaretMark({
      caret: undefined,
    }, document, layer, input, scroller);
  });

  describe("#constructor", () => {
    it("creates a mark that is unsuspended", () => {
      expect((mark as any).suspended).to.equal(0);
    });

    it("creates a mark that is not pending refresh", () => {
      expect((mark as any).pendingRefresh).to.be.false;
    });
  });

  describe("#suspend", () => {
    it("makes the mark suspended", () => {
      mark.suspend();
      expect((mark as any).suspended).to.equal(1);
    });

    it("does not cause a pending refresh", () => {
      expect((mark as any).pendingRefresh).to.be.false;
    });
  });

  describe("#resume", () => {
    it("makes the mark unsuspended", () => {
      mark.suspend();
      expect((mark as any).suspended).to.equal(1);
      mark.resume();
      expect((mark as any).suspended).to.equal(0);
    });

    it("balances suspend calls", () => {
      mark.suspend();
      mark.suspend();
      expect((mark as any).suspended).to.equal(2);
      mark.resume();
      mark.resume();
      expect((mark as any).suspended).to.equal(0);
    });

    it("throws if the mark is not suspended", () => {
      expect((mark as any).suspended).to.equal(0);
      expect(() => mark.resume()).to.throw(Error,
                                           "too many calls to resume");
    });

    it("does not cause a pending refresh", () => {
      mark.suspend();
      mark.resume();
      expect((mark as any).pendingRefresh).to.be.false;
    });

    it("does not refresh if the mark is still suspended", () => {
      const spy = sinon.spy(mark, "refresh");
      mark.suspend();
      mark.suspend();
      mark.refresh();
      spy.resetHistory();
      mark.resume();
      expect((mark as any).pendingRefresh).to.be.true;
      expect(spy).to.not.have.been.called;
    });

    it("does refresh if the mark is no longer suspended", () => {
      const spy = sinon.spy(mark, "refresh");
      mark.suspend();
      mark.suspend();
      mark.refresh();
      spy.resetHistory();
      mark.resume();
      mark.resume();
      expect(spy).to.have.been.calledOnce;
      expect((mark as any).pendingRefresh).to.be.false;
    });
  });

  describe("#refresh", () => {
    it("refreshes immediately if not suspended", () => {
      mark.refresh();
      expect((mark as any).pendingRefresh).to.be.false;
    });

    it("records the refresh as pending if suspended", () => {
      mark.suspend();
      mark.refresh();
      expect((mark as any).pendingRefresh).to.be.true;
    });
  });
});
