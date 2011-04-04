# This statically renders the wiki.

fs = require 'fs'
Mustache = try
	require 'mustache'
catch e
	{to_html: -> "<body><pre>% npm install mustache</pre> to use this demo."}

showdown = new (require('../lib/markdown/showdown').converter)()

template = fs.readFileSync "#{__dirname}/wiki.html.mu", 'utf8'

defaultContent = (name) -> """
# #{name} page

This wiki page is currently empty.

You can put some content in it with the editor on the right. As you do so, the document will update live on the left, and live for everyone else editing at the same time as you. Isn't that cool?

The text on the left is being rendered with markdown, so you can do all the usual markdown stuff like:

- Bullet
  - Points

[links](http://google.com)

[Go back to the main page](Main)
"""

module.exports = (docName, model, res) ->
	name = docName
	docName = "wiki:" + docName

	model.getSnapshot docName, (data) ->
		if data.v == 0
			model.applyOp docName, {op:{type:'text'}, v:0}
			model.applyOp docName, {op:[{i:defaultContent(name), p:0}], v:1}

		content = data.snapshot || ''
		markdown = showdown.makeHtml content
		console.log markdown
		html = Mustache.to_html template, {content, markdown, name, docName}
		res.writeHead 200, {'content-type': 'text/html'}
		res.end html

