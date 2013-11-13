Introduction
============

Wed is a schema-aware editor for XML documents. It runs in a web
browser. It is alpha software. We aim to make it extensible, but the
API is likely to change quickly for now. Please see our Documentation_
for details about how to use wed in your own project.

Demo
====

You can run the demo with:

  * an `empty document
    <http://mangalam-research.github.io/wed/build/standalone/
    kitchen-sink.html>`_
    using a vanilla TEI schema.
  * `Sketch for a medical education <http://mangalam-research.github.io/
    wed/build/standalone/kitchen-sink.html?file=/wed/build/samples/
    sketch_for_a_medical_education.xml>`_, a sample document from the Oxford
    Text Archive.

Here are some limitations of the demo:

  * Wed does not support old browsers, mobile devices, oddball, or
    unpopular browsers. Your notion of "old" might differ from ours.
  * Wed will fail if you try to save. Rest assured that the saving
    functionality works, but it needs a server able to handle AJAX
    calls. Github.io is not able to do this.
  * You cannot edit attributes in a generic way, as attributes. The
    functionality just has not been implemented yet because wed is
    developed in the context of a project where all attributes are set
    by software or are edited through domain-specific abstractions
    rather than directly, as attributes.

Things you can do:

  * Use the left mouse button to bring up a context menu. Such a menu
    exists for starting tags and all positions that are editable. This
    menu allows inserting elements.  Ctrl-/ also brings up this menu.
  * Insert text where text is valid.
  * Ctrl-Z to undo.
  * Ctrl-Y to redo.
  * Ctrl-C to copy.
  * Ctrl-V to paste.
  * Ctrl-X to cut.
  * Using Ctrl-S to save does not work, for the reasons given above.

Documentation
=============

For information about building wed and using it on your own site, see
the `basic usage information <usage.html>`_. For advanced usage
information and information about wed's internals, see the `technical
notes <tech_notes.html>`_.

People who would like to customize wed or create a mode for it should
consult the `API documentation <api/index.html>`_.

Downloads
=========

View on `Github <https://github.com/mangalam-research/wed>`_.

Download a `zip <https://github.com/mangalam-research/wed/zipball/master>`_
or `tarball <https://github.com/mangalam-research/wed/tarball/master>`_.

License
=======

Wed is released under the `Mozilla Public License version 2.0
<http://www.mozilla.org/MPL/2.0/>`_. Copyright Mangalam Research
Center for Buddhist Languages, Berkeley, CA.

Credits
=======

Wed is designed and developed by Louis-Dominique Dubeau (`@lddubeau
<https://github.com/lddubeau>`_), Director of Software Development for
the Buddhist Translators Workbench project, Mangalam Research Center
for Buddhist Languages.

.. image:: https://secure.gravatar.com/avatar/7fc4e7a64d9f789a90057e7737e39b2a
   :target: http://www.mangalamresearch.org/

This software has been made possible in part by a Level I Digital
Humanities Start-up Grant and a Level II Digital Humanities Start-up
Grant from the National Endowment for the Humanities (grant numbers
HD-51383-11 and HD-51772-13). Any views, findings, conclusions, or
recommendations expressed in this software do not necessarily
represent those of the National Endowment for the Humanities.

.. image:: http://www.neh.gov/files/neh_logo_horizontal_rgb.jpg
   :target: http://www.neh.gov/

Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`

..  LocalWords:  API README html Github TEI xml io Ctrl Mangalam api
..  LocalWords:  Dubeau LocalWords readme changelog