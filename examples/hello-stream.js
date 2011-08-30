// A simple node.js program which prints out ops as they are submitted to the
// 'hello' document.
//
// This example uses the compiled JS version of sharejs.
// % cake build
// to use.

var client = require('../lib/client');

client.open('hello', 'text', 'http://localhost:8000/sjs', function(doc, error) {
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
