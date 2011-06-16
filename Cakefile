{exec} = require 'child_process'
closure = require './thirdparty/closure'
fs = require 'fs'
path = require 'path'

task 'test', 'Run all tests', ->
	require './tests'

task 'build', 'Build the .js files', (options) ->
	exec "coffee --compile --bare --output lib/ src/", (err, stdout, stderr) ->
		throw err if err
		console.log stdout + stderr

client = [
	'client/web-prelude'
	'client/microevent'
	'types/helpers'
	'types/text'
	'types/json'
	'client/client'
]

extras = [
	'client/ace'
	'client/textarea'
]

# Backticks
e = (str, callback) ->
	console.log str
	exec str, (err, stdout, stderr) ->
		throw err if err
		out = stdout + stderr
		console.log out if out != ''
		callback() if callback?

compile = (infile, outfile) ->
	# Closure compile the JS
	file = fs.readFileSync infile

	closure.compile file, (err, code) ->
		throw err if err?

		smaller = Math.round((1 - (code.length / file.length)) * 100)

		output = outfile
		fs.writeFileSync output, code

		console.log "Closure compiled: #{smaller}% smaller (#{code.length} bytes} written to #{output}"
			

task 'webclient', 'Build the web client into one file', ->
	files = (names) -> ("src/#{c}.coffee" for c in names).join ' '
	clientfiles = files client
	# I would really rather do this in pure JS.
	e "coffee -j webclient/share.uncompressed.js -c #{clientfiles}", ->
		console.log "Building with closure's REST API..."
		compile 'webclient/share.uncompressed.js', 'webclient/share.js'
	
	# TODO: This should also be closure compiled.
	extrafiles = files extras
	e "coffee --compile --output webclient/ #{extrafiles}"

