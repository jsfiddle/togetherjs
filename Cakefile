{exec} = require 'child_process'

task 'test', 'Run all tests', ->
	require './tests'

#option '-w', '--watch', 'Watch'

task 'build', 'Build the .js files', (options) ->
	#	console.log options
#	options.watch ||= no
#	exec "coffee --compile #{if options.watch then '--watch' else ''} --output lib/ src/", (err, stdout, stderr) ->
	exec "coffee --compile --bare --output lib/ src/", (err, stdout, stderr) ->
		throw err if err
		console.log stdout + stderr

lib = [
	'thirdparty/microevent.js/microevent.js'
]

client = [
	'types/text'
	'client/opstream'
	'client/client'
]

e = (str, callback) ->
	exec str, (err, stdout, stderr) ->
		throw err if err
		console.log stdout + stderr
		callback() if callback?

task 'webclient', 'Assemble the web client into one file', ->
	clientfiles = ("src/#{c}.coffee" for c in client).join ' '
	e "coffee -cj #{clientfiles}", ->
		e "cat #{lib.join ' '} concatenation.js >share.js", ->
			e 'rm concatenation.js'
