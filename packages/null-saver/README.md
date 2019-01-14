Introduction
============

This package provides a saver that does nothing.  This saver does not raise any
errors. Recoveries are always considered to be successful, even though nothing
happened.

This saver is not meant for production, but only for testing or demos that do
not need to save data.

How to Use
==========

You need to setup your container so that it uses the ``NullSaver`` class
exported by the ``@wedxml/null-saver`` package.

```
import { Container } from "inversify";

import { NullSaver } from "@wedxml/null-saver";
import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
import { SAVER } from "@wedxml/common/tokens";

const container = new Container();
container.bind(SAVER).to(NullSaver);
container.bind(SAVER_OPTIONS).toConstantValue({});
```

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
