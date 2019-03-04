===========================
Using Wed in an Application
===========================

Wed is a schema-aware editor for XML documents. It runs in a web browser. The
software is at the beta stage. It is currently used in a project for editing
scholarly articles. We aim to make it extensible by means of a stable API, but
the API is likely to change quickly for now.

Make sure to read :ref:`help_browser_requirements` to learn which browsers are
supported by wed.

Known limitations:

* Wed does not load documents containing XML comments (``<!-- ... -->``).

* Wed does not load documents that include processing instructions. (The ``<?xml
  ...>`` at the very top of documents is not a processing instruction, but an
  XML declaration, which wed handles just fine.)

* Wed loads CData sections but convert them all to text. See
  :ref:`problem_with_cdata` for details.

* Wed supports most of Relax NG, with a few limitations. See the `salve
  <https://github.com/mangalam-research/salve/>`_ package for details.

* Wed does not currently support ordering attributes according to some
  preference. (The order is alphabetic.)

* Wed does not currently support multiline values in attributes.

* Empty elements appear in the editor as if they had an opening and closing tag,
  irrespective of how they are encoded in the original document. So ``<foo/>``
  and ``<foo></foo>`` are treated the same. Part of this problem is due to the
  fact that wed sees the document as a DOM tree, not as a serialization. In a
  DOM tree, ``<foo/>`` and ``<foo></foo>`` are the same.

* Elements that *must be empty* appear in the editor as if they *could* contain
  contents. Note that the validator raises an error if these elements are filled
  with any contents but it would be nicer if they were displayed in a way that
  distinguished them from the elements that *can* be filled with contents. We
  worked on a prototype that would check whether an element *can* contain
  anything and display it differently if it could not. However, this required
  that the rendering engine query the validating engine during rendering, which
  made rendering extremely slow. Since the editor will raise an error if an
  element that should be empty is filled erroneously, we've decided that a
  solution to this problem can wait.

* Eventually the plan is to handle XML namespace changes completely, and there
  is incipient code to deal with this; for now the safe thing to do if you have
  a file using multiple namespaces is to declare them once and for all on the
  top element, and never change them throughout the document. Otherwise,
  problems are likely.

  [A significant issue here is that the various browsers do not handle
  namespaces in the same way. For instance FF and Chrome are absolutely fine if
  you specify ``xmlns`` with DOM's ``setAttribute`` on an element that is on the
  same namespace as the namespace specified with the new ``xmlns`` attribute and
  they will produce a correct serialization. IE, on the other hand, will produce
  a node with two ``xmlns`` attributes.]

* We've not tested a setup in which more than one wed instance appears on the
  same page. So using more than one wed editor on the same page could be
  problematic.

* Keyboard navigation in contextual menus works. However, if the mouse is
  hovering over menu items, two items will be highlighted at once, which may be
  confusing. This seems to be a limitation of CSS which Bootstrap does nothing
  to deal with. (One element may be in the focused state (keyboard) while
  another is in the hover state.)

* Wed does not work with RTL scripts. There no inherent reason wed could not
  support them but the project for which it is developed currently does not need
  support for RTL scripts. So no resources have been expended towards supporting
  this.

* Wed is not internationalized. Although the contents of a document could be in
  any language, wed's UI is in English. Again, there is no inherent reason wed
  could not support other languages for the UI. The project for which it is
  developed currently does not need support for other languages, hence this
  state of affairs.

* See also :ref:`help_browser_requirements`.

* See also `Round-Tripping`_, as some limitations there may affect whether you
  can use wed for your project.

* Wed does not use XPath nor is it currently recommended to use XPath. See
  :ref:`tech_notes_xpath`.

Building Wed
============

In order to use wed as part of your own application, you must select the
components that you want to use and run ``wed-build`` on it. See the
documentation for ``@wedxml/build`` for the details of how to build it.

Testing
=======

See :doc:`tech_notes`.

Local Demos
===========

The demos, you must have a minimal server running. To run a server suitable for
the demos, you can do::

    $ ./misc/server.js localhost:8888 &

The address and port ``localhost:8888`` is just a suggestion, but the link in
the documentation below assume that's the address used.

Demos Saving to a Server
------------------------

Once the server is started, point your browser to either:

* `<http://localhost:8888/build/dist/dev/kitchen-sink.html>`_ to view the demo
  with the unoptimized file tree.

* or `<http://localhost:8888/build/dist/packed/kitchen-sink.html>`_ to
  view the demo with an optimized file tree.

The demo currently starts with an empty document using a vanilla TEI schema. See
:doc:`help` to learn what wed can do, in general.

When you save with this demo, the data is currently dumped into a file located
at ``build/ajax/save.txt``. You won't be able to reload data from that file. For
full functionality wed needs to be used with a server able to save the data and
serve it intelligently.

:kbd:`Ctrl-\`` allows to go into development mode. Since this is meant only for
developers, you should read the source code of wed to know what this allows.

It is possible to run the kitchen sink with a different mode than the default
one (generic) by passing a ``mode`` parameter in the URL, for instance the URL
`<http://localhost:8888/web/kitchen-sink.html?mode=tei>`_ would tell the kitchen
sink to load the tei mode.

Using
=====

Starting with version 0.31, wed is much stricter as to what it exposes to
libraries. The only parts of the code base that are safe to access are those
exported by the facade exposed as ``wed``. ``wed`` exports ``EditorInstance``
for the sake of allowing the creation of editors. However, modes **must** access
the editor through the interface defined in ``wed/mode-api`` (which is
reexported by ``wed``). It is **not** legal for a mode to cast an ``EditorAPI``
variable to anything that exposes members that are not exposed through
``wed/mode-api``. Any access that bypasses the public API is liable to break
without notice, no complaints, no recourse.

Also note that under the new regime the only module that is generally legitimate
to load is ``wed``, and nothing else. There are a few exceptions to the rule
just given:

* The files in ``wed/glue``, ``wed/patches`` and ``wed/polyfills`` can (and
  sometimes *must*) be used indepdently of the main ``wed`` module.

* You may load any module from the bundled editing modes. This may be useful to
  build your own modes.

To include wed in a web page you must:

* Require the bundle you created with ``wed-build`` and use the function you
  exported from that bundle to create an editor.

Errors
======

The ``onerror`` object exported by wed provides an error handler that could be
used with `last-resort <https://github.com/lddubeau/last-resort>`_ or with any
other error handler that can call a handler that takes a single argument which
is an ``error`` DOM event. This handler tries to save the data in all editors
that exist in the window. Here is an example that uses ``last-resort``::

    define(function (require) {

    var wed = require("wed");
    var lr = require("last-resort");
    var onError = lr.install(window);
    onError.register(wed.onerror.handler);
    //...

.. warning:: **IF YOU DO NOT SET THE HANDLER TO BE CALLED ON UNCAUGHT
             EXCEPTIONS, WED CANNOT DO ERROR RECOVERY.** Previous versions of
             wed would automatically install a handler but the problem with this
             is that it makes wed a bad player when it is used on pages that
             already have their handlers.

Round-Tripping
==============

At this stage wed does not guarantee that saving an **unmodified** document will
send the exact same string as what it was originally given to edit. This is due
to the fact that the same document can be represented in XML in multiple
ways. Notably:

* The XML declaration is not preserved.

* The order of the attributes could differ.

* The order and location of namespaces declarations could differ.

* The encoding of empty elements could differ. That is, ``<foo></foo>`` could
  become ``<foo/>`` or vice-versa.

* Whitespace before the start tag of the top element or after the end tag of the
  top element may not be preserved.

* CData sections are converted to text when the document is read by wed but are
  not reconverted to CData later.

The Generic Mode
================

Wed is bundled with a single mode, the "generic" mode. We recommend to
developers who wish to create modes to use the generic mode as their
basis. Therefore, the explanations here should apply to those modes that follow
our recommendations.

The generic mode is a mode that provides almost no customization of wed's
capabilities. For instance, a custom mode could represent elements that are
paragraphs purely through indentation changes and line breaks *rather than*
start and end labels. (Such a mode does exist for the BTW project.) The generic
mode does not do this: it represents paragraphs as any other element, with a
start label and end label.

Nonetheless, the generic mode requires a minimum amount of customization in
order to be able to do its work. In particular, it needs to use a "metadata"
file that provides information on the schema being used. This is necessary
because Relax NG schemas often lack information that wed needs. For instance,
while it is possible to include documentation about the elements that are part
of a schema into a Relax NG schema, this is not the most convenient place for
it. For one thing, salve (which is what wed uses for validation) right now does
not save this information when it convert a Relax NG schema to use for
validation. Even if it did, it would not solve all problems. The TEI
documentation, for instance, is multilingual. Having it all stored in the schema
would increase its size considerably, even if the user needs using only one
language. It would be possible to produce schemas that include documentation
only in one language but then you'd need one schema per language. By having the
metadata be responsible for providing this documentation, wed can load only the
language the user needs. Another issue that the metadata addresses is the fact
that Relax NG schemas do not specify what prefix to use for namespaces. One of
the jobs of the metadata is to provide defaults for namespace prefixes. These
are used internally by the mode, rather than require mode developers to spell
out namespace URIs every time they need to refer to a namespace. The XML file
being edited can use whatever prefix desired, but the mode must have a
standardized mapping of prefix to URI.

The information provided by the metadata is not made part of the mode itself
because the information it provides may be orthogonal to the concerns of the
mode. The generic mode is a case in point: it can work just as well (or as
"generically") for editing TEI documents as DocBook documents, or documents
using any other schema. Or to take another example, TEI allows for quite a bit
of customization: elements can be redefined, added, or removed. Entire modules
can be added if a project calls for it. A mode specialized for editing TEI
documents could have its metadata load only the documentation that pertains to
the specific customization of TEI being used.

Therefore, the generic mode takes a ``metadata`` option which is a simple string
which is a path to metadata that will be loaded by the mode.

Here is an example of what the ``mode`` option passed to wed could contain::

    path: 'wed/modes/generic/generic',
    options: {
      metadata: '../../../../../schemas/tei-math-metadata.json'
    }

This tells wed to load the generic mode, and have it load the metadata file
``../../../../../schemas/tei-math-metadata.json``.

The way the generic mode operates entails that three elements must cooperate for
a file to be usable by wed:

* the correct schema must be passed to wed,

* the correct mode must be selected,

* this mode must load the correct metadata file.

Contributing
============

Contributions must pass the commit checks turned on in
:github:`.glerbl/repo_conf.py`. Use ``glerbl install`` to install the
hooks. Glerbl itself can be found at `<https://github.com/lddubeau/glerbl>`_. It
will eventually make its way to the Python package repository so that ``pip
install glerbl`` will work.

..  LocalWords:  NG API namespace namespaces CSS RTL wed's UI github
..  LocalWords:  SauceLab's OpenSauce RequireJS config requirejs dev
..  LocalWords:  js jquery selectionsaverestore amd pre jsdoc rst mk
..  LocalWords:  perl chai semver json Makefile saxon selenic npm
..  LocalWords:  glerbl subdirectory README html CHANGELOG TEI Ctrl
..  LocalWords:  RequireJS's unoptimized ajax txt tei hoc xml xsl rng
..  LocalWords:  schemas init onerror CDATA versa LocalWords xmlns
..  LocalWords:  multiline DOM's setAttribute ESR Attr ownerElement
..  LocalWords:  globalKeydownHandler ajaxlog jQuery's teiCorpus
..  LocalWords:  localhost metadata
