`
/** @preserve ShareJS v0.4.0
http://sharejs.org

BSD licensed:
https://github.com/josephg/ShareJS/raw/master/LICENSE
*/
`

# This will be exported to window.sharejs
exports =
	'version': '0.4.0'


# Hint to the closure compiler to optimize out code for node.js.
#
# This is compiled out when compiled with uglifyjs. Its important for the
# share.uncompressed.js.
if typeof WEB == 'undefined'
	# This will put WEB in the global scope in a browser.
	window.WEB = true
