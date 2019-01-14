Introduction
============

This package provides a saver designed to save a document by sending an Ajax
request to a server.

How to Use
==========

You need to setup your container so that it uses the ``AjaxSaver`` class exported
by the ``@wedxml/ajax-saver`` package.

```
import { Container } from "inversify";

import { AjaxSaver } from "@wedxml/ajax-saver";
import { SAVER_OPTIONS } from "@wedxml/base-saver/tokens";
import { SAVER } from "@wedxml/common/tokens";

const container = new Container();
container.bind(SAVER).to(AjaxSaver);
container.bind(SAVER_OPTIONS).toConstantValue({ url: "..." });
```

The object bound to ``SAVER_OPTIONS`` in addition to the fields provided by
``@wedxml/base-saver``, supports these fields:

- ``url`` (mandatory): the URL where to POST save requests.

- ``headers`` (optional): a plain JavaScript object acting as a map of
  additional headers to set on POST requests.

- ``initial_etag`` (optional): the first ETag to use. This should be the ETag of
  the data passed to wed as the initial document.

Protocol
========

Queries are sent as POST requests with the following parameters:

* ``command``: the command wed is issuing.

* ``version``: the version of wed issuing the command.

* ``data``: the data associated with the command. This is always a string
  serialization of the data tree.

The possible commands are:

* ``check``: a mere version check whereby the server should check that the
  version of wed making the request is within the range that the server
  requires.

* ``save``: sent when the user manually requests a save.

* ``autosave``: sent when an autosave occurs.

* ``recover``: sent when wed detects a fatal condition requiring reloading the
  editor from scratch. The server must save the data received.

The replies are sent as JSON-encoded data. Each reply is a single object with a
single field named ``messages`` which is a list of messages. Each message has a
``type`` field which determines its meaning and what other fields may be present
in the message. The possible message types are:

* ``version_too_old_error`` indicates that the version of wed trying to access
  the server is too old.

* ``save_transient_error`` indicates that the save operation cannot happen for
  some transient reason. The ``msg`` parameter on the message should give a
  user-friendly message indicating what the problem is and, to the extent
  possible, how to resolve it.

* ``save_fatal_error`` indicates that the save operation failed fatally. This is
  used for cases where the user cannot reasonably do anything to resolve the
  problem.

* ``locked_error`` indicates that the document the user wants to save is locked.

* ``save_successful`` indicates that the save was successful.

The protocol uses ``If-Match`` to check that the document being saved has not
been edited by some other user. Therefore, it needs an ``ETag`` to be
generated. It acquires its initial ``ETag`` from options described
above. Subsequent successful save operations must provide an ``ETag`` value
representing the saved document.

The meaning of the ``ETag`` value is generally ambiguous. See the following
documents for some discussions of the issue:

- https://datatracker.ietf.org/doc/draft-whitehead-http-etag/
- https://datatracker.ietf.org/doc/draft-reschke-http-etag-on-write/

The current code handles the lack of precision such that ``ETag`` values
returned on error conditions are ignored. Otherwise, the following could happen:

1. Alice loads document, grabs initial ``ETag``.
2. Bob loads same document, grabs initial ``ETag``.
3. Bob saves new version, creates new ``ETag``.
4. Alice tries to save with an ``If-Match`` that has the old
   ``ETag``. This fails and returns an ``ETag`` with the response.

This last ``ETag`` would have to be the one that matches what is *currently*
stored in the server. Alice's wed instance **must not** use this ``ETag`` to
update the ``ETag`` it associates with its document, otherwise a subsequent save
will (erroneously) go through.

This may not correspond to how other systems use ``ETag``.

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
