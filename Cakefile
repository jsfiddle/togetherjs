{exec} = require 'child_process'

task 'test', 'Run all tests', ->
	test = require './test'

#option '-w', '--watch', 'Watch'

task 'build', 'Build the .js files', (options) ->
	#	console.log options
#	options.watch ||= no
#	exec "coffee --compile #{if options.watch then '--watch' else ''} --output lib/ src/", (err, stdout, stderr) ->
	exec "coffee --compile --output lib/ src/", (err, stdout, stderr) ->
		throw err if err
		console.log stdout + stderr

client = [
	'types/text'
	'client/stream'
	'client/client'
]

e = (str, callback) ->
	exec str, (err, stdout, stderr) ->
		throw err if err
		console.log stdout + stderr
		callback() if callback?

task 'webclient', 'Assemble the web client into one file', ->
	clientfiles = ("src/#{c}.coffee" for c in client).join(' ')
	e "coffee -cj #{clientfiles}", ->
		e 'mv concatenation.js webclient.js'
