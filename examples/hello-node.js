// A simple node.js program which prepends 'Hello there' to the front of the
// 'hello' document.

var client = require('../lib/client');

client.open('hello', 'text', {host: 'localhost', port: 8000}, function(doc, error) {
	doc.submitOp([{i:"<p>Hi there</p>\n", p:0}]);
	
	console.log(doc.snapshot);

	doc.close();
});
