// A simple node.js program which prepends 'Hello there' to the front of the
// 'hello' document.

var client = require('../lib/client');

client.open('hello', 'text', 'http://localhost:8000/sjs', function(doc, error) {
	doc.insert('Hi there\n', 0);
	
	console.log(doc.snapshot);

	doc.close();
});
