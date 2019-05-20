/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { AnyName, DefaultNameResolver, Name, NameChoice, NsName } from "salve";

import * as util from "wed/util";

const assert = chai.assert;

describe("util", () => {
  describe("classFromOriginalName", () => {
    it("no namespace", () => {
      assert.equal(util.classFromOriginalName("li", { "": "" }),
                   "._local_li._xmlns_._real._el");
    });

    it("match all", () => {
      assert.equal(util.classFromOriginalName("*", {}), "._real._el");
    });

    it("with namespace", () => {
      assert.equal(util.classFromOriginalName("btw:foo", {
        // tslint:disable-next-line:no-http-string
        btw: "http://mangalamresearch.org/ns/btw-storage",
      }), "._local_foo.\
_xmlns_http\\:\\/\\/mangalamresearch\\.org\\/ns\\/btw-storage._real._el");
    });
  });

  describe("distFromDeltas", () => {
    it("works", () => {
      assert.equal(util.distFromDeltas(0, 0), 0);
      assert.equal(util.distFromDeltas(3, 4), 5);
    });
  });

  describe("distFromRect", () => {
    it("returns 0 when point inside", () => {
      assert.equal(util.distFromRect(5, 5, 0, 0, 10, 10), 0);
    });

    it("returns 0 when point at corners", () => {
      assert.equal(util.distFromRect(0, 0, 0, 0, 10, 10), 0);
      assert.equal(util.distFromRect(0, 10, 0, 0, 10, 10), 0);
      assert.equal(util.distFromRect(10, 0, 0, 0, 10, 10), 0);
      assert.equal(util.distFromRect(10, 10, 0, 0, 10, 10), 0);
    });

    it("returns dist from top when point above", () => {
      assert.equal(util.distFromRect(4, -5, 0, 0, 10, 10), 5);
    });

    it("returns dist from bottom when point below", () => {
      assert.equal(util.distFromRect(4, 15, 0, 0, 10, 10), 5);
    });

    it("returns dist from left when point left", () => {
      assert.equal(util.distFromRect(-5, 4, 0, 0, 10, 10), 5);
    });

    it("returns dist from right when point right", () => {
      assert.equal(util.distFromRect(15, 4, 0, 0, 10, 10), 5);
    });

    it("returns min dist when point at corner", () => {
      assert.equal(util.distFromRect(-5, -12, 0, 0, 10, 10), 13);
      assert.equal(util.distFromRect(13, -4, 0, 0, 10, 10), 5);
      assert.equal(util.distFromRect(-4, 13, 0, 0, 10, 10), 5);
      assert.equal(util.distFromRect(15, 22, 0, 0, 10, 10), 13);
    });
  });

  describe("convertPatternObj", () => {
    let nr: DefaultNameResolver;
    before(() => {
      nr = new DefaultNameResolver();
      nr.definePrefix("", "default");
      nr.definePrefix("prefix", "uri");
      nr.definePrefix("prefix2", "uri2");
    });

    it("converts a Name", () => {
      const name = new Name("", "uri", "name");
      assert.equal(util.convertPatternObj(name.toObject(), nr), "prefix:name");
    });

    it("converts a Name with an unprefixed namespace", () => {
      const name = new Name("", "unprefixed", "name");
      assert.equal(util.convertPatternObj(name.toObject(), nr),
                   "{unprefixed}name");
    });

    it("converts a Name with a default namespace", () => {
      const name = new Name("", "default", "name");
      assert.equal(util.convertPatternObj(name.toObject(), nr), "name");
    });

    it("converts an NsName", () => {
      const name = new NsName("", "uri");
      assert.equal(util.convertPatternObj(name.toObject(), nr), "prefix:*");
    });

    it("converts an NsName with a default namespace", () => {
      const name = new NsName("", "default");
      assert.equal(util.convertPatternObj(name.toObject(), nr), "*");
    });

    it("converts an NsName with an unprefixed namespace", () => {
      const name = new NsName("", "unprefixed");
      assert.equal(util.convertPatternObj(name.toObject(), nr),
                   "{unprefixed}*");
    });

    it("converts an NsName with exception", () => {
      const name = new NsName("", "uri", new Name("", "uri", "name"));
      assert.equal(util.convertPatternObj(name.toObject(), nr),
                   "prefix:* except (prefix:name)");
    });

    it("converts an AnyName", () => {
      const name = new AnyName("");
      assert.equal(util.convertPatternObj(name.toObject(), nr), "*:*");
    });

    it("converts an AnyName with exception", () => {
      const name = new AnyName("", new Name("", "uri", "name"));
      assert.equal(util.convertPatternObj(name.toObject(), nr),
                   "*:* except (prefix:name)");
    });

    it("converts a NameChoice", () => {
      const name = new NameChoice("", new Name("", "uri", "name"),
                                  new Name("", "uri2", "name2"));
      assert.equal(util.convertPatternObj(name.toObject(), nr),
                   "(prefix:name) or (prefix2:name2)");
    });
  });
});

//  LocalWords:  Mangalam MPL Dubeau li distFromRect btw distFromDeltas chai
//  LocalWords:  namespace classFromOriginalName util
