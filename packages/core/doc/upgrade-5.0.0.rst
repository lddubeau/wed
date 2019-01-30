Version 5.0.0 is a major restructuration of wed from a single package that
contains all possible savers, all means of loading grammars, etc., to a series
of packages that can be used as needed. The packages are under the ``@wedxml``
scope.

The new setup allows to tailor wed to specific use-case scenarios. If you need
to use wed in a context the data is saved into an IndexedDB backend, then you do
not need to have the Ajax based saver.

Conversely, the new setup now **requires** that you build wed to serve your own
purposes. See the README for ``@wedxml/build`` to learn how to do this.

Miscelaneous changes
====================

* The ``localForage`` saver has been removed and there is no direct replacement
  for it. You could use ``@wedxml/db-saver`` with a store based on
  ``localForage`` if you want.

* The ``IndexedDB`` saver has been removed and there is no direct replacement
  for it. You can use ``@wedxml/db-saver`` with a store based on ``IndexedDB``,
  or a wrapper like Dexie. Wed is used in a project where the data is saved in
  ``IndexedDB`` and uses Dexie with ``@wedxml/db-saver`` to save the data.

* ``wed/onerror`` and ``wed/log`` are no longer meant to be loaded individually.

  The ``onerror`` module is available as the ``onerror`` field exposed by the
  ``wed`` module.

  The old approach had the advantage that one could load ``wed/onerror`` to trap
  errors early, like errors that occur while wed loads. The problem though is
  that the capability to load ``wed/onerror`` as and individual module
  complicates the build, and makes it a bit awkward. Going forward,
  ``wed/onerror`` will be only meant to be used to trap errors happening when
  wed is already loaded. Wed clients desirous to trap early errors will have to
  use another method to do so.

* We no longer use RequireJS in development but SystemJS. Wed still needs an AMD
  loader and must have ``define`` and ``require`` accessible. These can be
  provided by SystemJS.

* The Reflection Metadata API must be fully available. You may use
  ``reflect-metadata``.

* The wed runtime now use ``fetchiest`` instead of ``bluejax`` to provide
  diagnosis and retry capabilities. Consequently the ``bluejaxOptions`` that
  used to be passed to wed are now ``fetchiestOptions``. See the documentation
  of ``fetchiest`` for what is available.

* The wed runtime no longer provides a check for connectivity errors. There were
  multiple issues with that check that made it harmful.

* Wed now uses Bootstrap 4.x (4.2.1) instead of Bootstrap 3.x for its GUI.

* The patch for Bootstrap is gone since it was only required for Bootstrap 3.x.

* The family of classes for creating contextual menus has changed quite a
  bit:

  + ``ContextMenu`` used to take a series of ``Element`` for menu items. It now
    takes an list of objects of abritrary type and calls ``makeMenuItems`` to
    convert them to elements.

  + ``ContextMenu`` now calls ``refreshItemList`` to refresh the list of items
    shown. Where previously you might have called ``render`` directly, you
    should now call ``refreshItemList``.

  + ``ActionContextMenu``, ``CompletionMenu`` and ``ReplacementMenu`` have all
    been updated to use the refactored base class.

* ``EditorAPI`` how exposes a ``documentationAction`` which must be used for
  menu items providing links to documentation.

* ``EditingMenuManager`` no longer has ``makeMenuItemForAction`` and
  ``makeDocumentationMenuItem``. Their functions have been folded into
  ``ActionContextMenu`` and ``documentationAction``. (Your code does not need to
  use the removed methods anymore.)

Notable Bootstrap Changes
=========================

These changes may affect you if you customized wed's look or wrote modes that
use or modify GUI elements. We list here the notable changes we had to deal with
when converting wed.

* Use SCSS instead of LESS.

* You must load the CSS of ``typeahead.js-bootstrap4-css`` instead of the old
  ``typeahead.js-boostrap-css``.

* Usually, usage of ``...-danger``, ``...-info``, ``...-success`` etc. must be
  converted to use ``.bg-danger``, ``.bg-info``, ``.bg-success``, etc. However,
  there are exceptions. ``.badge`` uses ``.badge-danger``, etc.

* ``.label`` and ``.label-`` are now ``.badge`` and ``.badge-``. We use
  ``.badge-dark`` for ``.label-default``.

* ``.panel`` and ``.panel-`` are now ``.card`` and ``.card-``. It is not just a
  matter of doing search replace. For instance ``.panel-heading`` is
  ``.card-header``.

* ``.tooltip("destroy")`` is now ``.tooltip("dispose")``.

* Tooltips now longer allow multiple values for ``placement``. So ``"auto top"``
  is no longer valid.

* Buttons no longer have an ``-xs`` size.

* ``.btn-default`` is not a thing. We use ``.btn-outline-dark``.

* If you create dropdown menu items yourself, they are no longer ``<li><a>`` but
  ``<a class="dropdown-item"``. Also the change in structure may require that
  you update where you put your event handler.

* If you create navigation items, the ``<li>`` and ``<a>`` elements now need
  ``.nav-item`` and ``.nav-link``.

* If you create modals yourself, the order of the close button and modal title
  is flipped in Bootstrap v5.
