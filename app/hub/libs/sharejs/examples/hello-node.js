// A simple node.js program which prepends 'Hello there' to the front of the
// 'hello' document.

var client = require('..').client;

client.open('hello', 'text', 'http://localhost:8000/channel', function(error, doc) {
	doc.insert('Hi there\n', 0);
	
	console.log(doc.snapshot);

	doc.close();
});
