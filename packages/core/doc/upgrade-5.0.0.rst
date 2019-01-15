Version 5.0.0 is a major restructuration of wed from a single package that
contains all possible savers, all means of loading grammars, etc., to a series
of packages that can be used as needed.

The new setup allows to tailor wed to specific use-case scenarios. If you need
to use wed in a context the data is saved into an IndexedDB backend, then you do
not need to have the Ajax based saver.

Conversely, the new setup now **requires** that you build wed to serve your own
purposes. See the README for ``@wedxml/build`` to learn how to do this.

Miscelaneous changes:

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
