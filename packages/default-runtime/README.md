Browser Support Note
====================

IndexedDB on Safari browswers seems irremediably broken. See [this
page](http://dexie.org/docs/IndexedDB-on-Safari) for details. We do not have the
resources necessary to fix this. Contributions to solving the issue are welcome.

So while ``DefaultRuntime`` allows loading from an IndexedDB database, it is not
recommended to use this capability in your project if you care about supporting
Safari.
