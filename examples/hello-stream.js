// A simple node.js program which prints out ops as they are submitted to the
// 'hello' document.

var client = require('../lib/client');

client.open('hello', 'text', {host: 'localhost', port: 8000}, function(doc, error) {
	console.log('Document open at version ' + doc.version);

	doc.on('change', function(op) {
		console.log("Version: " + doc.version + ":" , op);
	});
});
