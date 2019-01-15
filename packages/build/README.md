Introduction
============

This package provides the a building tool you can use to produce a bundle
containing wed and the packages it uses.

Rationale
=========

Very early versions of wed did not have very many usage options: there was only
one way to save data, one kind of runtime, etc. So wed was distributed as a
pre-built bundle that contained everything wed supported, which wasn't much.

Wed evolved to support multiple ways to save data: there was an Ajax saver, an
localForage saver, and so on. We still distributed wed as a pre-built bundle but
it had the disadvantage that the bundle always contained all savers, runtimes,
etc even if *your* own use-case scenario did not need them. This made for a
bundle that was bigger than necessary.

Wed 5 was a major reorganization of the code to enhance modularity. With this
release, it became imperative to allow using wed without having to include in
the build every single possible saver and various modules that may or may not be
used for each use-case scenario. So starting with version 5, wed is no longer
distributed in a pre-built form. The downside is that developers wishing to use
wed must now build wed to a final bundle. (Actually, they do not **have** to
build wed. It is possible to use the development tree that is shipped with
``@wedxml/core`` and just have a loader like RequireJS or SystemJS load the
modules individually. This is not *recommended* because this is exceedingly
slow.)

``wed-build`` was introduced to help developers build wed for their
needs. Internally, ``wed-build`` uses Webpack to grab the modules needed by a
specific use of wed and create a bundle containing everything needed.

Usage
=====

You must provide an entry point which loads the modules you want to use and
creates an [InversifyJS](https://github.com/inversify/InversifyJS) container
with the classes you want and the configuration options you want.

Examine this example and the comments in it:

    import { Container } from "inversify";

    import { bindEditor } from "wed";

    import { AjaxSaver } from "@wedxml/ajax-saver";
    import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
    import { EditorInstance, Options } from "@wedxml/client-api";
    import { EDITOR_INSTANCE, EDITOR_OPTIONS, EDITOR_WIDGET, GRAMMAR_LOADER,
             RUNTIME, SAVER } from "@wedxml/common/tokens";
    import { DefaultRuntime } from "@wedxml/default-runtime";
    import { TrivialGrammarLoader } from "@wedxml/trivial-grammar-loader";

    // It is important to reexport everything from wed because modes need to be able
    // to get what wed exports. Since this file becomes the entry point of the
    // bundle, we must reexport everything.
    export * from "wed";

    // There are many ways this could be implemented. We export a makeEditor
    // function which takes parameters that are liable to change from case to case.
    export function makeEditor(wedroot: Element, options: Options,
                               saverOptions: {}): EditorInstance {
      // You must create an InversifyJS container.
      const container = new Container();

      // The EDITOR_WIDGET is the DOM element that the editor will take over. This
      // binding is mandatory.
      container.bind(EDITOR_WIDGET).toConstantValue(wedroot);

      // EDITOR_OPTIONS are the options to pass to the editor that will be
      // created. This binding is mandatory.
      container.bind(EDITOR_OPTIONS).toConstantValue(options);

      // This editor will use an AjaxSaver object to save. The SAVER and
      // SAVER_OPTIONS bindings are mandatory.
      container.bind(SAVER).to(AjaxSaver);
      container.bind(SAVER_OPTIONS).toConstantValue(saverOptions);

      // GRAMMAR_LOADER is the object we use to load Relax NG grammars. It is
      // mandatory.
      container.bind(GRAMMAR_LOADER).to(TrivialGrammarLoader);

      // RUNTIME is mandatory. You'll typically use DefaultRuntime for this.
      container.bind(RUNTIME).to(DefaultRuntime);

      // You must call this function to bind the editor class to the container.
      bindEditor(container);

      // And this is how you get a new editor that you can use.
      return container.get<EditorInstance>(EDITOR_INSTANCE);
    }

You must also create a configuration file for ``wed-build``. The possible fields
are:

* ``entry`` (mandatory): a path to the entry point file containing the code
  described above.

* ``outDir`` (mandatory): the directory where to put the output of
  ``wed-build``. This may be a path relative to ``CWD`` of the ``wed-build``
  process.

* ``wedDir`` (optional): the directory where ``@wedxml/core`` is installed. If
  omitted, ``wed-build`` will infer it by trying to load the package
  ``@wedxml/core``.

* ``nodeModules`` (optional): a path to where to find the node modules that
  provide the external dependencies that wed requires. In most cases this should
  be omitted. When omitted, ``wed-build`` gets the modules from where
  ``@wedxml/core`` is installed.

You can then build wed with ``wed-build [path to config]``.
