{exec} = require 'child_process'

task 'test', 'Run all tests', ->
	require './tests'

task 'build', 'Build the .js files', (options) ->
	exec "coffee --compile --bare --output lib/ src/", (err, stdout, stderr) ->
		throw err if err
		console.log stdout + stderr

lib = [
]

client = [
	'client/microevent'
	'types/text'
	'client/opstream'
	'client/client'
]

# Backticks
e = (str, callback) ->
	exec str, (err, stdout, stderr) ->
		throw err if err
		out = stdout + stderr
		console.log out if out != ''
		callback() if callback?

task 'webclient', 'Assemble the web client into one file', ->
	clientfiles = ("src/#{c}.coffee" for c in client).join ' '
	# I would really rather do this in pure JS.
	e "coffee -cj #{clientfiles}", ->
		e "cat #{lib.join ' '} concatenation.js >share.js", ->
			e 'rm concatenation.js'
