{exec} = require 'child_process'
closure = require './thirdparty/closure'
fs = require 'fs'

task 'test', 'Run all tests', ->
	require './tests'

task 'build', 'Build the .js files', (options) ->
	exec "coffee --compile --bare --output lib/ src/", (err, stdout, stderr) ->
		throw err if err
		console.log stdout + stderr

lib = [
]

client = [
	'client/web-prelude'
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
	clientfiles = ("src/#{c}.coffee" for c in client).join ' '
	# I would really rather do this in pure JS.
	e "coffee -cj #{clientfiles}", ->
		e "cat #{lib.join ' '} concatenation.js >share.uncompressed.js", ->
			e 'rm concatenation.js'
			compile 'share.uncompressed.js', 'share.js'
			
