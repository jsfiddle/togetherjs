# Text document API for text

text = require './text' if not WEB?
if WEB?
  text = sharejs.types.text

text.api =
  provides: {text:true}

  # The number of characters in the string
  getLength: -> @snapshot.length

  # Get the text contents of a document
  getText: -> @snapshot

  insert: (pos, text, callback) ->
    op = [{p:pos, i:text}]

    @submitOp op, callback
    op

  del: (pos, length, callback) ->
    op = [{p:pos, d:@snapshot[pos...(pos + length)]}]

    @submitOp op, callback
    op

  _register: ->
    @on 'remoteop', (op) ->
      for component in op
        if component.i != undefined
          @emit 'insert', component.p, component.i
        else
          @emit 'delete', component.p, component.d
