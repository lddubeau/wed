/**
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { nextCaretPosition, nextCaretPositionNoText,
         prevCaretPosition, prevCaretPositionNoText } from "wed/caret-movement";
import { Caret } from "wed/domutil";

const expect = chai.expect;

// tslint:disable:no-any

// Utility  XML nodes.
function empty(el: Element): void {
  // tslint:disable-next-line:no-inner-html
  el.innerHTML = "";
}

describe("caret-movement", () => {
  let domroot: HTMLElement;

  before(() => {
    domroot = document.createElement("div");
    document.body.appendChild(domroot);
  });

  after(() => {
    document.body.removeChild(domroot);
  });

  type Callback = (data: HTMLElement) => [Caret,
                                          Caret | null,
                                          Caret | null | undefined,
                                          Node];

  function makeTestFactory(method: typeof nextCaretPosition,
                           method2: typeof nextCaretPositionNoText):
  (name: string, callback: Callback) => void {
    return function makeTest(name: string, callback: Callback): void {
      let caret: Caret;
      let noTextExpected: Caret | null;
      let textExpected: Caret | null | undefined;
      let container: Node;

      describe(name, () => {
        before(() => {
          const data = document.createElement("span");
          [caret, noTextExpected, textExpected, container] = callback(data);

          empty(domroot);
          domroot.appendChild(data);

          if (textExpected === undefined) {
            textExpected = noTextExpected;
          }
        });

        it(`${method.name} returns the expected position`, () => {
          const result = method(caret, container);
          expect(result).to.deep.equal(textExpected);
        });

        it(`${method2.name} returns the expected position`, () => {
          const result = method2(caret, container);
          expect(result).to.deep.equal(noTextExpected);
        });
      });
    };
  }

  // tslint:disable:mocha-no-side-effect-code no-inner-html
  describe("nextCaretPosition and nextCaretPositionNoText", () => {
    const makeTest = makeTestFactory(nextCaretPosition,
                                     nextCaretPositionNoText);

    makeTest("in text", data => {
      data.textContent = "test";
      return [[data.firstChild!, 2], [data, 0], [data.firstChild!, 3], domroot];
    });

    makeTest("move into child from text", data => {
      data.innerHTML = "test <b>test</b>";
      const child = data.firstChild!;
      return [
        // This puts the caret at the end of the first text node in <span>.
        [child, child.nodeValue!.length],
        [data.lastElementChild!, 0],
        [data.lastElementChild!.firstChild!, 0],
        domroot,
      ];
    });

    makeTest("move to parent", data => {
      data.innerHTML = "test <b>test</b><b>test2</b>";
      const child = data.firstElementChild!.firstChild!;
      return [
        // This puts the caret at the end of the first b element.
        [child, child.nodeValue!.length],
        // This position is between the two b elements.
        [data, 2],
        undefined,
        domroot,
      ];
    });

    makeTest("enter empty elements", data => {
      data.innerHTML = "<i>a</i><i></i><i>b</i>";
      return [
        // Just after the first <i>.
        [data, 1],
        [data.getElementsByTagName("i")[1], 0],
        undefined,
        domroot,
      ];
    });

    // The case is designed so that it skips over the white space.
    makeTest("white-space: normal", data => {
      data.innerHTML = "<s>test    </s><s>test  </s>";
      return [
        // This is just after the "test" string in the first s element.
        [data.firstElementChild!.firstChild!, 4],
        // Ends between the two s elements.
        [data, 1],
        undefined,
        domroot,
      ];
    });

    // The case is designed so that it does not skip over the whitespace.
    makeTest("white-space: normal, not at end of parent node", data => {
      data.innerHTML = "test <s>test</s>";
      return [
        // This is just after the "test" string in the top element, before the
        // space.
        [data.firstChild!, 4],
        // Ends after the space
        [data, 0],
        [data.firstChild!, 5],
        domroot];
    });

    // The case is designed so that it does not skip over the whitespace.
    makeTest("white-space: pre", data => {
      data.innerHTML = "<s>test    </s><s style='white-space: pre'>test  </s>";
      const s = data.getElementsByTagName("s")[1];

      return [[s.firstChild!, 4], [s, 0], [s.firstChild!, 5], domroot];
    });

    makeTest("skips over nodes that are not element or text", data => {
      // The case is designed so that it does not skip over the whitespace.
      data.innerHTML = "te<!-- comment --><?pi foo?>st";
      return [
        // Place the caret just before the comment.
        [data, 1],
        [data, 3],
        [data.childNodes[3], 0],
        domroot,
      ];
    });

    makeTest("moves out of nodes that are not element or text", data => {
      // The case is designed so that it does not skip over the whitespace.
      data.innerHTML = "te<!-- comment --><?pi foo?>st";
      return [
        // Place the caret inside the comment.
        [data.childNodes[1], 0],
        [data, 3],
        [data.childNodes[3], 0],
        domroot,
      ];
    });

    makeTest("does not move out of text container", data => {
      data.innerHTML = "test";
      return [[data.firstChild!, 4], null, null, data.firstChild!];
    });

    makeTest("does not move out of element container", data => {
      data.innerHTML = "test";
      return [[data, 1], null, null, data];
    });

    makeTest("can't find a node", () =>
             [[document.body.parentNode!, 30000], null, null, document]);
  });

  describe("prevCaretPosition and prevCaretPositionNoText", () => {
    const makeTest = makeTestFactory(prevCaretPosition,
                                     prevCaretPositionNoText);

    makeTest("in text", data => {
      data.textContent = "test";
      return [[data.firstChild!, 2], [data, 0], [data.firstChild!, 1],
              domroot];
    });

    makeTest("move into child", data => {
      data.innerHTML = "<b>test</b> test";
      return [
        // This puts the caret at the start of the last text node.
        [data.lastChild!, 0],
        [data.lastElementChild!, 0],
        [data.lastElementChild!.firstChild!, 4],
        domroot,
      ];
    });

    makeTest("move into child", data => {
      data.innerHTML = "test <b>test</b>";
      return [
        // This puts the caret at the start of the text node in <b>
        [data.lastElementChild!.firstChild!, 0],
        [data, 1],
        undefined,
        domroot,
      ];
    });

    makeTest("enter empty elements", data => {
      data.innerHTML = "<i>a</i><i></i><i>b</i>";
      return [
        // This puts the caret after the 2nd <i>.
        [data, 2],
        [data.getElementsByTagName("i")[1], 0],
        undefined,
        domroot,
      ];
    });

    makeTest("white-space: normal", data => {
      // The case is designed so that it skips over the whitespace
      data.innerHTML = "<s>test</s><s>   test</s>";
      return [
        // Place the caret just after the whitespace in the 2nd <s> node.
        [data.lastElementChild!.firstChild!, 3],
        [data, 1], undefined,
        domroot,
      ];
    });

    makeTest("white-space: normal, not at start of parent node", data => {
      // The case is designed so that it does not skip over the whitespace
      data.innerHTML = "<s>test</s>   test";
      return [
        // Place the caret just after the whitespace in the top node
        [data.childNodes[1], 3],
        [data, 1], [data.childNodes[1], 2],
        domroot,
      ];
    });

    makeTest("white-space: pre", data => {
      // The case is designed so that it does not skip over the whitespace.
      data.innerHTML = "<s>test</s><s style='white-space: pre'>   test</s>";
      const s = data.lastElementChild!;
      return [
        // Place the caret just after the white space in the 2nd <s> node.
        [s.firstChild!, 3],
        [s, 0], [s.firstChild!, 2],
        domroot,
      ];
    });

    makeTest("skips over nodes that are not element or text", data => {
      // The case is designed so that it does not skip over the whitespace.
      data.innerHTML = "te<!-- comment --><?pi foo?>st";
      return [
        // Place the caret just after the PI.
        [data, 3],
        [data, 0],
        [data.firstChild!, 2],
        domroot,
      ];
    });

    makeTest("moves out of nodes that are not element or text", data => {
      // The case is designed so that it does not skip over the whitespace.
      data.innerHTML = "te<!-- comment --><?pi foo?>st";
      return [
        // Place the caret inside the PI.
        [data.childNodes[2], 0],
        [data, 0],
        [data.firstChild!, 2],
        domroot,
      ];
    });

    makeTest("does not move out of text container", data => {
      data.innerHTML = "test";
      return [
        [data.firstChild!, 0],
        null, null,
        data.firstChild!,
      ];
    });

    makeTest("does not move out of element container", data => {
      data.innerHTML = "test";
      return [
        [data, 0],
        null, null,
        data,
      ];
    });

    makeTest("can't find a node", () =>
             [[document.body.parentNode!.parentNode!, 0], null, null,
              document]);
  });
});

//  LocalWords:  jquery domutil nextCaretPosition domroot chai isNotNull html
//  LocalWords:  prevCaretPosition splitTextNode pre abcd insertIntoText lastcd
//  LocalWords:  lastabcd firstabcd abtestcd abcdfirst abfirst insertText abQcd
//  LocalWords:  Qabcd deleteText firstDescendantOrSelf cd abcdQ linkTrees MPL
//  LocalWords:  whitespace nextSibling jQuery previousSibling Dubeau Mangalam
