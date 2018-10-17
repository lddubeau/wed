import "mocha";

import "common";
// tslint:disable-next-line:no-submodule-imports
import "common/browsers";
// tslint:disable-next-line:no-submodule-imports
import "common/tokens";

//
// We do nothing more than a smoketest here. It would be in *theory* possible to
// run tests on the browsers module. However, Karma does not readily provide to
// the code running in the browser the identity of the browser running
// it. Moreover, even when the 1st issue is solved, producing *a test* is easy,
// but producing a *meanigful* test is difficult.
//
describe("smoketest", () => {
  it("loads", () => {
    // Yep it works.
  });
});
