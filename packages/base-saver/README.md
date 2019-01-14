Introduction
============

This is the base from which all savers should be derived.

How to Use
==========

You need to setup your container so that it uses the a class exported by a
package that implements a wed saver. You cannot use the base class provided by
this package directly.

```
import { Container } from "inversify";

import { Saver } from "@wedxml/some-saver-package";
import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
import { SAVER } from "@wedxml/common/tokens";

const container = new Container();
container.bind(SAVER).to(AjaxSaver);
container.bind(SAVER_OPTIONS).toConstantValue({ ... });
```

The object bound to ``SAVER_OPTIONS`` supports these fields:

- ``autosave`` (optional): the time between autosaves in seconds.

A specific saver may support additional fields.

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
