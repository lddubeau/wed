Introduction
============

This package provides a saver designed to save a document into a database
record.

This package does not provide an implementation tied to a specific database
backend. Historically, it has been used to save into [``localStorage``][1] and
[``IndexedDB``][2] (either through [``localForage``][3] or [``Dexie``][4]).

[1]: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
[2]: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
[3]: https://github.com/localForage/localForage
[4]: https://dexie.org/

How to Use
==========

You need to setup your container so that it uses the ``DBSaver`` class exported
by the ``@wedxml/db-saver`` package.

```
import { Container } from "inversify";

import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
import { SAVER } from "@wedxml/common/tokens";
import { DBSaver } from "@wedxml/db-saver";

const container = new Container();
container.bind(SAVER).to(DBSaver);
container.bind(SAVER_OPTIONS).toConstantValue({
  getStore() {
    return <store>;
  },
  name: <some name>,
});
```

The object bound to ``SAVER_OPTIONS`` must have a ``name`` field that contains
the "file name". This can be a key into a database table, or any other means you
have to uniquely identify a file. The ``getStore`` function must return an
object conforming to the ``Store`` interface. See the source code or API
documentation of ``@wedxml/db-saver`` for details. The ``Store`` object is what
actually stores the saved data. It interfaces with the actual database backend.

License
=======

This package is released under the [Mozilla Public License version
2.0](http://www.mozilla.org/MPL/2.0/). Copyright Mangalam Research Center for
Buddhist Languages, Berkeley, CA.

Acknowledgments
===============

[![BrowserStack](https://www.browserstack.com/images/mail/browserstack-logo-footer.png)](https://www.browserstack.com)

Wed is tested using [BrowserStack](https://www.browserstack.com). BrowserStack
provides this service for free under their program for supporting open-source
software.

Credits
=======

This package is designed and developed by Louis-Dominique Dubeau, Director of
Software Development for the Buddhist Translators Workbench project, Mangalam
Research Center for Buddhist Languages.
