This is a bunch of little demo apps using Share.js.

Launch the example sharejs server with

    % bin/exampleserver


readonly
--------

Two little demos of live viewers for sharejs documents.

Browse to http://localhost:8000/readonly/html.html
and http://localhost:8000/readonly/markdown.html

### html

Dynamically update html content as a document changes

### markdown

Dynamically render markdown as a document is edited.


ace
---

The ace editor live editing a sharejs document.

Browse to http://localhost:8000/ace/


staticrender
------------

This directory has a little mustache template rendering engine to do server-side rendering of documents.

Access the rendered documents at http://localhost:8000/static/DOCNAME

Eg: http://localhost:8000/static/html

Some of the logic to wire this demo up is in `bin/exampleserver`. You should have a read.

The documents are rendered statically on the server, so they don't update when as you edit them. You could obviously mix in the code from the html demo to make this also re-render as the document changes.


wiki
----

A more complicated demo showing a wiki.
