# Make sure the server can run in a few different environments.
#
# NOTE: This test hasn't been written yet, and is not run by the standard test runner.

http = require 'http'
assert = require 'assert'

testRunning = (url, port, callback) ->
  testsComplete = 0

  # Create a new document then get it back again using the RESTful interface
  path = "#{url}/doc/abc123"
  post = http.request {method:'POST', path:"#{path}?v=0", host: 'localhost', port:port}, (res) ->
    assert.strictEqual res.statusCode, 200
    http.get {path:path, host:'localhost', port:port}, (res) ->
      assert.strictEqual res.statusCode, 200
      del = http.request {method:'DELETE', path:path, host: 'localhost', port:port}, (res) ->
        assert.strictEqual res.statusCode, 200
        callback() if ++testsComplete
      del.end()

  post.end '{"type":"simple"}'
  
  
  # Also, open the DB using socket.io and make a document
  client = new client.Connection 'localhost', port, url
  client.
