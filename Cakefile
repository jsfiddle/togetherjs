{exec} = require 'child_process'
closure = require './thirdparty/closure'
fs = require 'fs'
path = require 'path'

task 'test', 'Run all tests', ->
	# run directly to get all the delicious output
	console.log 'Running tests...'
	exec 'nodeunit tests.coffee', (err, stdout, stderr) ->
		throw err if err

task 'build', 'Build the .js files', (options) ->
	exec "coffee --compile --bare --output lib/ src/", (err, stdout, stderr) ->
		throw err if err
		console.log stdout + stderr

client = [
	'client/web-prelude'
	'client/microevent'
	'types/helpers'
	'types/text'
	'types/text-api'
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
	file = fs.readFileSync infile, 'utf8'

	closure.compile file, (err, code) ->
		throw err if err?

		smaller = Math.round((1 - (code.length / file.length)) * 100)

		output = outfile
		fs.writeFileSync output, code

		console.log "Closure compiled: #{smaller}% smaller (#{code.length} bytes} written to #{output}"

# Uncomment to skip closure compiler
#compile = (infile, outfile) -> e "cp #{infile} #{outfile}"

expandNames = (names) -> ("src/#{c}.coffee" for c in names).join ' '

buildclosure = (filenames, dest) ->
	filenames = expandNames filenames
	# I would really rather do this in pure JS.
	e "coffee -j #{dest}.uncompressed.js -c #{filenames}", ->
		console.log "Building #{dest} with closure's REST API..."
		compile "#{dest}.uncompressed.js", "#{dest}.js"

buildtype = (name) ->
	filenames = ['types/web-prelude', "types/#{name}"]

	try
		fs.statSync "src/types/#{name}-api.coffee"
		filenames.push "types/#{name}-api"

	buildclosure filenames, "webclient/#{name}"

task 'webclient', 'Build the web client into one file', ->
	buildclosure client, 'webclient/share'
	buildtype 'json'
	buildtype 'text-tp2'

	# TODO: This should also be closure compiled.
	extrafiles = expandNames extras
	e "coffee --compile --output webclient/ #{extrafiles}", ->
		# For backwards compatibility. (The ace.js file used to be called share-ace.js)
		e "cp webclient/ace.js webclient/share-ace.js"

#task 'lightwave', ->
#	buildclosure ['client/web-prelude', 'client/microevent', 'types/text-tp2'], 'lightwave'
