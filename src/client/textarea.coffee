# Create an op which converts oldval -> newval.
#
# This function should be called every time the text element is changed. Because changes are
# always localised, the diffing is quite easy.
#
# This algorithm is O(N), but I suspect you could speed it up somehow using regular expressions.
opFromDiff = (oldval, newval) ->
	return [] if oldval == newval # This is fast because of how javascript strings work
	commonStart = 0
	commonStart++ while oldval.charAt(commonStart) == newval.charAt(commonStart)

	commonEnd = 0
	commonEnd++ while oldval.charAt(oldval.length - 1 - commonEnd) == newval.charAt(newval.length - 1 - commonEnd) and
		commonEnd + commonStart < oldval.length and commonEnd + commonStart < newval.length

	window.sharejs.types.text.normalize [{p:commonStart, d:oldval[commonStart ... oldval.length - commonEnd]},
		{p:commonStart, i:newval[commonStart ... newval.length - commonEnd]}]

window.sharejs.Document::attach_textarea = (elem) ->
	doc = this
	elem.value = @snapshot

	@on 'remoteop', (op) ->
		newSelection = [
			doc.type.transformCursor elem.selectionStart, op, false
			doc.type.transformCursor elem.selectionEnd, op, false
		]
		elem.value = doc.snapshot
		[elem.selectionStart, elem.selectionEnd] = newSelection


	genOp = (event) ->
		# console.log event

		onNextTick = (fn) -> setTimeout fn, 10
		onNextTick ->
			# console.log doc.snapshot, elem.value
			op = opFromDiff doc.snapshot, elem.value
			# console.log op
			doc.submitOp op unless op.length == 0

	elem.addEventListener event, genOp, false for event in ['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste']

