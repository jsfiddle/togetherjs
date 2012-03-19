{exec} = require 'child_process'
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
	'client/doc'
	'client/connection'
	'client/index'
]

extras = [
	'client/ace'
	'client/cm'
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

makeUgly = (infile, outfile) ->
	# Uglify compile the JS
	source = fs.readFileSync infile, 'utf8'

	{parser, uglify} = require 'uglify-js'

	opts =
		defines:
			WEB: ['name', 'true']

	ast = parser.parse source
	ast = uglify.ast_lift_variables ast
	ast = uglify.ast_mangle ast, opts
	ast = uglify.ast_squeeze ast
	code = uglify.gen_code ast

	smaller = Math.round((1 - (code.length / source.length)) * 100)

	output = outfile
	fs.writeFileSync output, code

	console.log "Uglified: #{smaller}% smaller (#{code.length} bytes} written to #{output}"

expandNames = (names) -> ("src/#{c}.coffee" for c in names).join ' '

compile = (filenames, dest) ->
	filenames = expandNames filenames
	# I would really rather do this in pure JS.
	e "coffee -j #{dest}.uncompressed.js -c #{filenames}", ->
		console.log "Uglifying #{dest}"
		makeUgly "#{dest}.uncompressed.js", "#{dest}.js"

buildtype = (name) ->
	filenames = ['types/web-prelude', "types/#{name}"]

	try
		fs.statSync "src/types/#{name}-api.coffee"
		filenames.push "types/#{name}-api"

	compile filenames, "webclient/#{name}"

task 'webclient', 'Build the web client into one file', ->
	compile client, 'webclient/share'
	buildtype 'json'
	buildtype 'text-tp2'

	# TODO: This should also be closure compiled.
	extrafiles = expandNames extras
	e "coffee --compile --output webclient/ #{extrafiles}", ->
		# For backwards compatibility. (The ace.js file used to be called share-ace.js)
		e "cp webclient/ace.js webclient/share-ace.js"

#task 'lightwave', ->
#	buildclosure ['client/web-prelude', 'client/microevent', 'types/text-tp2'], 'lightwave'
