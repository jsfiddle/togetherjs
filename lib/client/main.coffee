require ["types/builtin", "types/text", "client"], (builtin, text, client) ->
	builtin.registerType text
	console.log 'client: ', client
	client.getOrCreate 'doc', builtin.types.text, (doc, error) ->
		throw new Error(error) if error
		console.log doc
#		doc.
