This is a friendly HTML editor that uses [slowparse][] and [hacktionary][]
to provide ultra-friendly real-time help to novice webmakers.

## Updating CodeMirror

In the `codemirror2` directory is a mini-distribution of [CodeMirror][]
which contains only the files necessary for HTML editing. It can be updated
with the following Python script, if it is run from the root directory
of the repository and the value of `NEW_CODEMIRROR_PATH` is changed:

```python
import os

NEW_CODEMIRROR_PATH = "/path/to/new/codemirror/version"
OUR_CODEMIRROR_PATH = os.path.abspath("codemirror2")

for dirpath, dirnames, filenames in os.walk(OUR_CODEMIRROR_PATH):
    for filename in filenames:
        ourpath = os.path.join(dirpath, filename)
        relpath = os.path.relpath(ourpath, OUR_CODEMIRROR_PATH)
        newpath = os.path.join(NEW_CODEMIRROR_PATH, relpath)
        if os.path.exists(newpath):
            print "copying %s" % newpath
            open(ourpath, "wb").write(open(newpath, "rb").read())
```

  [slowparse]: https://github.com/toolness/slowparse
  [hacktionary]: https://github.com/toolness/hacktionary
  [CodeMirror]: http://codemirror.net/
