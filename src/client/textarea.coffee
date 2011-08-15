# Create an op which converts oldval -> newval.
#
# This function should be called every time the text element is changed. Because changes are
# always localised, the diffing is quite easy.
#
# This algorithm is O(N), but I suspect you could speed it up somehow using regular expressions.
applyChange = (doc, oldval, newval) ->
	return if oldval == newval
	commonStart = 0
	commonStart++ while oldval.charAt(commonStart) == newval.charAt(commonStart)

	commonEnd = 0
	commonEnd++ while oldval.charAt(oldval.length - 1 - commonEnd) == newval.charAt(newval.length - 1 - commonEnd) and
		commonEnd + commonStart < oldval.length and commonEnd + commonStart < newval.length

	doc.del oldval.length - commonStart - commonEnd, commonStart unless oldval.length == commonStart + commonEnd
	doc.insert newval[commonStart ... newval.length - commonEnd], commonStart unless newval.length == commonStart + commonEnd

window.sharejs.Doc::attach_textarea = (elem) ->
	doc = this
	elem.value = @snapshot
	prevvalue = elem.value

	replaceText = (newText, transformCursor) ->
		newSelection = [
			transformCursor elem.selectionStart
			transformCursor elem.selectionEnd
		]

		scrollTop = elem.scrollTop
		elem.value = newText
		elem.scrollTop = scrollTop if elem.scrollTop != scrollTop
		[elem.selectionStart, elem.selectionEnd] = newSelection

	@on 'insert', (text, pos) ->
		transformCursor = (cursor) ->
			if pos <= cursor
				cursor + text.length
			else
				cursor

		replaceText elem.value[...pos] + text + elem.value[pos..], transformCursor
	
	@on 'delete', (text, pos) ->
		transformCursor = (cursor) ->
			if pos < cursor
				cursor - Math.min(text.length, cursor - pos)
			else
				cursor

		replaceText elem.value[...pos] + elem.value[pos + text.length..], transformCursor

	genOp = (event) ->
		onNextTick = (fn) -> setTimeout fn, 0
		onNextTick ->
			if elem.value != prevvalue
				# IE constantly replaces unix newlines with \r\n. ShareJS docs
				# should only have unix newlines.
				prevvalue = elem.value
				applyChange doc, doc.getText(), elem.value.replace /\r\n/g, '\n'

	for event in ['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste']
		if elem.addEventListener
			elem.addEventListener event, genOp, false
		else
			elem.attachEvent 'on'+event, genOp

