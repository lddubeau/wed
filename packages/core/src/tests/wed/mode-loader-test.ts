import chai from "chai";
import { expect, use } from "chai";
import { expectRejection, use as erUse } from "expect-rejection";
import { Container, decorate, inject, injectable } from "inversify";
import { buildProviderModule } from "inversify-binding-decorators";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import { EDITOR_INSTANCE, MODE, MODE_OPTIONS,
         RUNTIME } from "@wedxml/common/tokens";
import { bindRoot, bindWidget } from "wed";
import { Editor } from "wed/editor";
import { ModeLoader } from "wed/mode-loader";

use(sinonChai);
erUse(chai);

// tslint:disable-next-line:completed-docs
@injectable()
class FakeMode {
  public initialized: boolean = false;

  // tslint:disable-next-line:no-any
  constructor(@inject(EDITOR_INSTANCE) public readonly editor: any,
              @inject(MODE_OPTIONS) public readonly options: any) {}

  init(): Promise<void> {
    this.initialized = true;
    return Promise.resolve();
  }
}

// tslint:disable-next-line:missing-jsdoc
describe("ModeLoader", () => {
  let loader: ModeLoader;
  // tslint:disable-next-line:no-any
  let runtime: any;
  let root: Container;

  // Yes, we cheat with a typecast.
  // tslint:disable-next-line:no-any mocha-no-side-effect-code
  const editor = { editor: true } as any as Editor;
  const options = { options: true };
  beforeEach(() => {
    const runtime_ = sinon.stub({
      // tslint:disable-next-line:no-empty
      resolveModules: () => {},
    });
    runtime = runtime_;
    root = new Container({ defaultScope: "Singleton" });
    root.load(buildProviderModule());

    bindRoot(root);
    bindWidget(root, document.body);
    root.bind(RUNTIME).toConstantValue(runtime);
    root.bind(EDITOR_INSTANCE).toConstantValue(editor);

    loader = root.get<ModeLoader>(ModeLoader);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("#bindMode", () => {
    it("fails if we cannot load", async () => {
      const container = new Container();
      runtime.resolveModules.throws(new Error("cannot load"));
      await expectRejection(loader.bindMode(container, "moo"),
                            Error, "cannot load");
    });

    it("by default, tries multiple module names", async () => {
      const container = new Container();
      runtime.resolveModules.throws(new Error("cannot load"));
      try {
        await loader.bindMode(container, "moo");
      }
      // tslint:disable-next-line:no-empty
      catch (ex) {}
      expect(runtime).to.have.property("resolveModules").to.have.callCount(4);
      expect(runtime.resolveModules.firstCall).to.have.been.calledWith("moo");
      expect(runtime.resolveModules.secondCall)
        .to.have.been.calledWith("wed/modes/moo/moo");
      expect(runtime.resolveModules.thirdCall)
        .to.have.been.calledWith("wed/modes/moo/moo-mode");
      expect(runtime.resolveModules.lastCall)
        .to.have.been.calledWith("wed/modes/moo/moo_mode");
    });

    it("fails on first attempt if the path has a forward slash", async () => {
      const container = new Container();
      runtime.resolveModules.throws(new Error("cannot load"));
      try {
        await loader.bindMode(container, "moo/foo");
      }
      // tslint:disable-next-line:no-empty
      catch (ex) {}
      expect(runtime).to.have.property("resolveModules").to.have.callCount(1);
      expect(runtime.resolveModules).to.have.been.calledWith("moo/foo");
    });

    it("calls bind on the module", async () => {
      // tslint:disable-next-line:variable-name
      const ModeConstructor = sinon.spy(function Mode(): FakeMode {
          return sinon.createStubInstance(FakeMode);
      });
      class ModeBinder {
        async bind(container: Container): Promise<void> {
          container.bind(MODE).to(ModeConstructor as any);
        }
      }
      decorate(injectable(), ModeConstructor);
      decorate(inject(EDITOR_INSTANCE) as ParameterDecorator, ModeConstructor,
               0);
      decorate(inject(MODE_OPTIONS) as ParameterDecorator, ModeConstructor, 1);
      runtime.resolveModules.returns([{
        Binder: ModeBinder,
      }]);
      const bound = root.createChild();
      await loader.bindMode(bound, "moo/foo");
      bound.bind(MODE_OPTIONS).toConstantValue(options);
      bound.get<FakeMode>(MODE);
      expect(ModeConstructor).to.have.been.calledOnce;
      expect(ModeConstructor).to.have.been.calledWith(editor, options);
    });
  });
});
