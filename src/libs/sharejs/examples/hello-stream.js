// A simple node.js program which prints out ops as they are submitted to the
// 'hello' document.

var client = require('..').client;

client.open('hello', 'text', 'http://localhost:8000/channel', function(error, doc) {
	if (error) {
		throw error;
	}

	console.log('Document open at version ' + doc.version);
	if (doc.created) {
		console.log('The document was created!');
	}
	console.log(JSON.stringify(doc.snapshot));

	doc.on('change', function(op) {
		console.log("Version: " + doc.version + ":" , op);
		console.log(JSON.stringify(doc.snapshot));
	});
});
