# This is some utility code to connect an ace editor to a sharejs document.

Range = require("ace/range").Range

# Convert an ace delta into an op understood by share.js
convertDelta = (editorDoc, delta) ->
	# Get the start position of the range, in no. of characters
	getStartOffsetPosition = (range) ->
		# This is quite inefficient - getLines makes a copy of the entire
		# lines array in the document. It would be nice if we could just
		# access them directly.
		lines = editorDoc.getLines 0, range.start.row
			
		offset = 0

		for line, i in lines
			offset += if i < range.start.row
				line.length
			else
				range.start.column

		# Add the row number to include newlines.
		offset + range.start.row

	pos = getStartOffsetPosition(delta.range)

	switch delta.action
		when 'insertText' then [{i:delta.text, p:pos}]
		when 'removeText' then [{d:delta.text, p:pos}]
		
		when 'insertLines'
			text = delta.lines.join('\n') + '\n'
			[{i:text, p:pos}]
			
		when 'removeLines'
			text = delta.lines.join('\n') + '\n'
			[{d:text, p:pos}]

		else throw new Error "unknown action: #{delta.action}"

# Apply a share.js op to an ace editor document
applyToDoc = (editorDoc, op) ->
	offsetToPos = (offset) ->
		# Again, very inefficient.
		lines = editorDoc.getAllLines()

		row = 0
		for line, row in lines
			break if offset <= line.length

			# +1 for the newline.
			offset -= lines[row].length + 1

		row:row, column:offset

	for c in op
		if c.d?
			# Delete
			range = Range.fromPoints offsetToPos(c.p), offsetToPos(c.p + c.d.length)
			editorDoc.remove range
		else
			# Insert
			editorDoc.insert offsetToPos(c.p), c.i
	
	return

window.sharejs.Document::attach_ace = (editor) ->
	doc = this
	editorDoc = editor.getSession().getDocument()
	editorDoc.setNewLineMode 'unix'

	check = ->
		editorText = editorDoc.getValue()
		otText = doc.snapshot

		if editorText != otText
			console.error "Text does not match!"
			console.error "editor: #{editorText}"
			console.error "ot:     #{otText}"
			# Should probably also replace the editor text with the doc snapshot.

	editorDoc.setValue doc.snapshot
	check()

	suppress = false
	editorDoc.on 'change', (change) ->
		return if suppress
		op = convertDelta editorDoc, change.data
		doc.submitOp op

		check()

	doc.subscribe 'remoteop', (op) ->
#		console.log("Received", op);
		suppress = true
		applyToDoc editorDoc, op
		suppress = false

		check()
	
	return

