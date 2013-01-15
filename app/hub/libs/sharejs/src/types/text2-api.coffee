# Text document API for text

if WEB?
  type = exports.types.text2
else
  type = require './text2'

type.api =
  provides: {text:true}

  # The number of characters in the string
  getLength: -> @snapshot.length

  # Get the text contents of a document
  getText: -> @snapshot

  insert: (pos, text, callback) ->
    op = type.normalize [pos, text]
    
    @submitOp op, callback
    op
  
  del: (pos, length, callback) ->
    op = type.normalize [pos, d:length]

    @submitOp op, callback
    op

  _register: ->
    @on 'remoteop', (op, snapshot) ->
      pos = spos = 0 # Reported insert position and snapshot position.
      for component in op
        switch typeof component
          when 'number'
            pos += component
            spos += component
          when 'string'
            @emit 'insert', pos, component
            pos += component.length
          when 'object'
            @emit 'delete', pos, snapshot[spos...spos + component.d]
            spos += component.d

