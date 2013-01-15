# This statically renders the document.

fs = require 'fs'
Mustache = try
	require 'mustache'
catch e
	{to_html: -> "<body><pre>% npm install mustache</pre> to use this demo."}

template = fs.readFileSync "#{__dirname}/template.html.mu", 'utf8'

module.exports = (docName, model, res, next) ->
	model.getSnapshot docName, (error, data) ->
		if data == null
			# The document does not exist
			next()
		else
			html = Mustache.to_html template, {content:data.snapshot, docName}
			res.writeHead 200, {'content-type': 'text/html'}
			res.end html

