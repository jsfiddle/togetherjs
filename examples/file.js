// This script watches for changes in the 'hello' document and constantly resaves a file
// with the document's contents.

var client = require('../lib/client');
var fs = require('fs');

var filename = 'out.html'

var timeout = null;
var doc = null;

// Writes the snapshot data to the file not more than once per second.
var write = function() {
	if (timeout == null) {
		timeout = setTimeout(function() {
			console.log("Saved version " + doc.version);
			fs.writeFile(filename, doc.snapshot);
			timeout = null;
		}, 1000);
	}
}

client.open('hello', 'text', {host: 'localhost', port: 8000}, function(d, error) {
	doc = d;
	console.log('Document open at version ' + doc.version);

	write();
	doc.on('change', function(op) {
		write();
	});
});
