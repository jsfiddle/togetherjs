assert = require 'assert'
http = require 'http'
util = require 'util'

# For testing the streaming library
#clientio = require('../../lib/Socket.io-node-client/io-client').io
clientio = require('Socket.io-node-client').io

server = require '../src/server'
events = server.events
db = server.db

server.socket.install(server.server)

types = require '../src/types'
randomizer = require './randomizer'
require './types'

client = require '../src/client'
DeltaStream = require('../src/client/stream').DeltaStream

p = util.debug
i = util.inspect

hostname = 'localhost'
port = 8768
client = null

makeNewSocket = (callback) ->
	socket = new clientio.Socket hostname, {port: port}
	socket.connect()
	socket.on 'connect', () -> callback(socket)

# Expected data is an array of objects.
expectData = (socket, expectedData, callback) ->
	listener = (data) ->
		expected = expectedData.shift()
		assert.deepEqual expected, data

		if expectedData.length == 0
			socket.removeListener 'message', listener
			callback()
	
	socket.on 'message', listener

#     Utility methods

# Async fetch. Aggregates whole response and sends to callback.
# Callback should be function(response, data) {...}
fetch = (method, path, postData, callback) ->
	assert.ok client

	request = client.request(method, path, {host: hostname})

	if postData?
		postData = JSON.stringify(postData) if typeof(postData) == 'object'
		request.write(postData)

	request.end()

	request.on('response', (response) ->
		data = ''
		response.on('data', (chunk) -> data += chunk)
		response.on('end', () -> callback(response, data))
	)


# Callback will be called after all the ops have been applied, with the
# resultant snapshot. Callback format is callback(error, snapshot)
applyOps = (docName, startVersion, ops, callback) ->
	op = ops.shift()
	db.applyDelta docName, {version:startVersion, op:op}, (error, appliedVersion) ->
		if error
			callback(error, null)
		else
			if ops.length == 0
				db.getSnapshot docName, (snapshot) ->
					callback(null, snapshot)
			else
				applyOps docName, startVersion + 1, ops, callback

# Generate a new, locally unique document name.
newDocName = do ->
	index = 1
	() -> 'doc' + index++

## ** Note
#
# Some of the tests below still use named documents. This is because I'm lazy and haven't
# fixed them all yet. Use newDocName() for all new tests.


#      TESTS

should = (name, method) -> {name: name, method: method}
doesnt = (name, method) -> {name: name, method: method, run: false}
stop = {stop: true}

tests = [
	# Testing tool tests
	should 'create new doc name with each invocation of newDocName()', (pass, fail) ->
		assert.notStrictEqual newDocName(), newDocName()
		assert.strictEqual typeof newDocName(), 'string'
		pass()

	# DB tests
	should 'Return null when asked for the snapshot of a new object', (pass, fail) ->
		db.getSnapshot newDocName(), (snapshot) ->
			assert.strictEqual snapshot, null
			pass()

	should 'Apply a set type op correctly sets the type and version', (pass, fail) ->
		db.applyDelta newDocName(), {version:0, op:{type:'simple'}}, (error, appliedVersion) ->
			fail error if error?
			assert.strictEqual appliedVersion, 0
			pass()
	
	should 'Return a fresh snapshot after submitting ops', (pass, fail) ->
		name = newDocName()
		db.applyDelta name, {version:0, op:{type:'simple'}}, (error, appliedVersion) ->
			fail error if error?
			assert.strictEqual appliedVersion, 0
			db.getSnapshot name, (snapshot) ->
				assert.deepEqual snapshot, {v:1, type:types.simple, snapshot:{str:''}}

				db.applyDelta name, {version:1, op:{position: 0, text:'hi'}}, (error, appliedVersion) ->
					fail error if error?
					assert.strictEqual appliedVersion, 1
					db.getSnapshot name, (snapshot) ->
						assert.deepEqual snapshot, {v:2, type:types.simple, snapshot:{str:'hi'}}
						pass()

	should 'Apply op to future version fails', (pass, fail) ->
		db.applyDelta newDocName(), {version:1, type:{v:1,op:{}}}, (err, result) ->
			assert.ok err
			pass()
	
	should 'be able to apply ops at the most recent version', (pass, fail) ->
		applyOps newDocName(), 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi '}
				{position: 3, text: 'mum'}
				{position: 3, text: 'to you '}
			], (error, snapshot) ->
				assert.strictEqual error, null
				assert.strictEqual snapshot.v, 4
				assert.deepEqual snapshot.snapshot.str, 'Hi to you mum'
				pass()
				
	should 'be able to apply ops at an old version', (pass, fail) ->
		name = newDocName()
		applyOps name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi '}
				{position: 3, text: 'mum'}
			], (error, snapshot) ->
				assert.strictEqual error, null
				assert.strictEqual snapshot.v, 3
				assert.deepEqual snapshot.snapshot.str, 'Hi mum'

				applyOps name, 2, [
					{position: 2, text: ' to you'}
				], (error, snapshot) ->
					assert.strictEqual error, null
					assert.strictEqual snapshot.v, 4
					assert.deepEqual snapshot.snapshot.str, 'Hi to you mum'
					pass()
	

	should 'delete a document when delete is called', (pass, fail) ->
		name = newDocName()
		db.applyDelta name, {version:0, op:{type:'simple'}}, (error, appliedVersion) ->
			fail error if error?
			db.delete name, (error) ->
				fail error if error?
				pass()
	
	should 'pass an error to the callback if you delete something that doesn\'t exist', (pass, fail) ->
		db.delete newDocName(), (error) ->
			fail 'No error!' unless error?
			pass()
	
	# Events
	should 'emit events when ops are applied', (pass, fail) ->
		expectedVersions = [0...2]
		events.listen 'G', ((v) -> assert.strictEqual v, 0), (delta) ->
			assert.strictEqual delta.version, expectedVersions.shift()
			pass() if expectedVersions.length == 0

		applyOps 'G', 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) -> fail(error) if error?
	
	should 'emit transformed events when old ops are applied', (pass, fail) ->
		name = newDocName()
		expectedVersions = [0...3]
		events.listen name, ((v) -> assert.strictEqual v, 0), (delta) ->
			assert.strictEqual delta.version, expectedVersions.shift()
			pass() if expectedVersions.length == 0

		applyOps name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) ->
				fail(error) if error?
				db.applyDelta name, {version:1, op:{position: 0, text: 'hi2'}}, (error, v) ->
					fail(error) if error?
					assert.strictEqual v, 2
	
	should 'emit events when ops are applied to an existing document', (pass, fail) ->
		applyOps 'H', 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) -> fail(error) if error?

		expectedVersions = [2...4]
		events.listen 'H', ((v) -> assert.strictEqual v, 2), (delta) ->
			assert.strictEqual delta.version, expectedVersions.shift()
			pass() if expectedVersions.length == 0

		applyOps 'H', 2, [
				{position: 0, text: 'Hi'}
				{position: 0, text: 'Hi'}
			], (error, _) -> fail(error) if error?

	should 'emit events with listenFromVersion from before the first version', (pass, fail) ->
		expectedVersions = [0...2]
		events.listenFromVersion 'J', 0, (delta) ->
			assert.strictEqual delta.version, expectedVersions.shift()
			pass() if expectedVersions.length == 0

		applyOps 'J', 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) -> fail(error) if error?
	

	should 'emit events with listenFromVersion from the first version after its been sent', (pass, fail) ->
		applyOps 'K', 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) -> fail(error) if error?

		expectedVersions = [0...2]
		events.listenFromVersion 'K', 0, (delta) ->
			assert.strictEqual delta.version, expectedVersions.shift()
			pass() if expectedVersions.length == 0
	
	should 'emit events with listenFromVersion from the current version', (pass, fail) ->
		applyOps 'L', 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) -> fail(error) if error?

		expectedVersions = [2...4]
		events.listenFromVersion 'L', 2, (delta) ->
			assert.strictEqual delta.version, expectedVersions.shift()
			pass() if expectedVersions.length == 0

		applyOps 'L', 2, [
				{position: 0, text: 'Hi'}
				{position: 0, text: 'Hi'}
			], (error, _) -> fail(error) if error?

	should 'stop emitting events after removeListener is called', (pass, fail) ->
		name = newDocName()
		listener = (delta) ->
			assert.strictEqual delta.version, 0, 'Listener was not removed correctly'
			events.removeListener name, listener

		events.listen name, ((v) -> assert.strictEqual v, 0), listener

		applyOps name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) ->
				fail(error) if error?
				pass()

	should 'stop emitting events after removeListener is called when using listenFromVersion', (pass, fail) ->
		name = newDocName()
		listener = (delta) ->
			assert.strictEqual delta.version, 0, 'Listener was not removed correctly'
			events.removeListener name, listener

		applyOps name, 0, [
				{type: 'simple'},
				{position: 0, text: 'Hi'}
			], (error, _) ->
				fail(error) if error?
				events.listenFromVersion name, 0, listener
				pass()

	# Frontend tests
	should 'return 404 when on GET on a random URL', (pass, fail) ->
		fetch 'GET', "/#{newDocName()}", null, (res, data) ->
			assert.strictEqual(res.statusCode, 404)
			pass()
	
	should 'PUT returns 405', (pass, fail) ->
		fetch 'PUT', "/#{newDocName()}", null, (res, data) ->
			assert.strictEqual res.statusCode, 405
			# These might be in a different order... this will do for now.
			assert.strictEqual res.headers.allow, 'GET,POST,DELETE'
			pass()

	should 'POST a document in the DB returns 200 OK', (pass, fail) ->
		fetch 'POST', '/M?v=0', {type:'simple'}, (res, data) ->
			assert.strictEqual res.statusCode, 200
			assert.deepEqual JSON.parse(data), {v:0}

			fetch 'POST', '/M?v=1', {position: 0, text: 'Hi'}, (res, data) ->
				assert.strictEqual res.statusCode, 200
				assert.deepEqual JSON.parse(data), {v:1}
				fetch 'GET', '/M', null, (res, data) ->
					assert.strictEqual res.statusCode, 200
					assert.deepEqual JSON.parse(data), {v:2, type:'simple', snapshot:{str: 'Hi'}}
					pass()
		

	should 'POST a document with no version returns 400', (pass, fail) ->
		fetch 'POST', '/N', {type:'simple'}, (res, data) ->
			assert.strictEqual res.statusCode, 400
			pass()

	should 'POST a document with invalid JSON returns 400', (pass, fail) ->
		fetch 'POST', '/O?v=0', 'invalid>{json', (res, data) ->
			assert.strictEqual res.statusCode, 400
			pass()
	
	should 'DELETE deletes a document', (pass, fail) ->
		db.applyDelta 'P', {version:0, op:{type:'simple'}}, (error, newVersion) ->
			fail(error) if error?
			fetch 'DELETE', '/P', null, (res, data) ->
				assert.strictEqual res.statusCode, 200
				pass()
	
	should 'DELETE returns a 404 message if you delete something that doesn\'t exist', (pass, fail) ->
		fetch 'DELETE', '/Q', null, (res, data) ->
			assert.strictEqual res.statusCode, 404
			pass()
	
	# Streaming protocol (sockets) tests

	should 'be able to open a document', (pass, fail) ->
		name = newDocName()
		makeNewSocket (socket) ->
			socket.send {open:name, v:0}
			expectData socket, [{open:name, v:0}], ->
				pass()
				socket.disconnect()
	
	should 'be able to open a document with no version specified', (pass, fail) ->
		makeNewSocket (socket) ->
			socket.send {open:'s2'}
			socket.on 'message', (data) ->
				assert.deepEqual data, {open:'s2', v:0}
				pass()
				socket.disconnect()
	
	should 'be able to open a document at a previous version and get ops since', (pass, fail) ->
		db.applyDelta 's3', {version:0, op:{type:'simple'}}, (error, newVersion) ->
			fail(error) if error?

			makeNewSocket (socket) ->
				socket.send {open:'s3', v:0}
				expectData socket, [{open:'s3', v:0}, {v:0, op:{type:'simple'}}], ->
					pass()
					socket.disconnect()

	should 'be able to receive ops through an open socket', (pass, fail) ->
		makeNewSocket (socket) ->
			socket.send {open:'s4', v:0}
			expectData socket, [{open:'s4', v:0}], ->
				applyOps 's4', 0, [{type:'simple'}], (error, snapshot) ->
					throw error if error?

					expectedData = [{v:0, op:{type:'simple'}}]
					expectData socket, expectedData, ->
						pass()
						socket.disconnect()
	
	should 'be able to send an op', (pass, fail) ->
		makeNewSocket (socket) ->
			events.listen 's5', ((v) -> assert.strictEqual v, 0), (delta) ->
				assert.strictEqual delta.version, 0
				assert.deepEqual delta.op, {type:'simple'}
				pass()
				socket.disconnect()

			socket.send {doc:'s5', v:0, op:{type:'simple'}}

	should 'receive confirmation when an op is sent', (pass, fail) ->
		makeNewSocket (socket) ->
			expectData socket, [{doc:'s6', v:0, r:'ok'}], () ->
				pass()
				socket.disconnect()

			socket.send {doc:'s6', v:0, op:{type:'simple'}}

	should 'not be sent your own ops back', (pass, fail) ->
		makeNewSocket (socket) ->
			socket.on 'message', (data) ->
				assert.notDeepEqual data.op, {type:'simple'} if data.op?

			expectData socket, [{open:'s7', v:0}, {v:0, r:'ok'}], () ->
				# Gonna do this a dodgy way. Because I don't want to wait an undefined amount of time
				# to make sure the op doesn't come, I'll trigger another op and make sure it recieves that.
				# The second op should come after the first.
				applyOps 's7', 0, [{position:0, text:'hi'}], (error, snapshot) ->
					expectData socket, [{v:1, op:{position:0, text:'hi'}}], () ->
					pass()
					socket.disconnect()

			socket.send {open:'s7', v:0}
			socket.send {doc:'s7', v:0, op:{type:'simple'}}

	should 'get a document snapshot', (pass, fail) ->
		applyOps 's8', 0, [
				{type: 'simple'},
				{position: 0, text: 'internet'}
			], (error, _) ->
				fail(error) if error?

				makeNewSocket (socket) ->
					socket.send {get:'s8'}
					socket.on 'message', (data) ->
						assert.deepEqual data, {doc:'s8', snapshot:{str:'internet'}, v:2, type:'simple'}
						pass()
						socket.disconnect()

	should 'get a null snapshot when getting a nonexistent document', (pass, fail) ->
		makeNewSocket (socket) ->
			socket.send {get:'s9'}
			socket.on 'message', (data) ->
				assert.deepEqual data, {doc:'s9', snapshot:null, type:null, v:0}
				pass()
				socket.disconnect()

	should 'be able to close a document', (pass, fail) ->
		name1 = newDocName()
		name2 = newDocName()
		makeNewSocket (socket) ->
			socket.send {open:name1}
			expectData socket, [{open:name1, v:0}], ->
				socket.send {close:name1}
				# The close message has no reply. We'll open another fake document
				# to make sure the server has recieved the close message.
				socket.send {open:name2}
				expectData socket, [{open:name2, v:0}], ->
					# name1 should be closed, and name2 should be open.
					# We should only get the op for name2.
					db.applyDelta name1, {version:0, op:{type:'simple'}}, (error, appliedVersion) ->
						throw error if error?
					db.applyDelta name2, {version:0, op:{type:'text'}}, (error, appliedVersion) ->
						throw error if error?

					expectData socket, [{v:0, op:{type:'text'}}], ->
						pass()
						socket.disconnect()

	# Type tests
	should 'pass text type tests', (pass, fail) ->
		types.text.test()
		randomizer.test(types.text)
		pass()

	# Client stream tests
	should 'open a document', (pass, fail) ->
		name = newDocName()
		ds = new DeltaStream hostname, port

		ds.open name, 0, (msg) ->
			assert.deepEqual msg, {open:name, v:0}
			ds.disconnect()
			pass()
	
	should 'submit an op', (pass, fail) ->
		name = newDocName()
		ds = new DeltaStream hostname, port

		ds.open name, 0, (msg) ->
			ds.submit name, {type:'simple'}, 0, (msg) ->
				assert.deepEqual msg, {r:'ok', v:0, doc:name}
				ds.disconnect()
				pass()
	
	should 'have a docname with the op even when the server skips it', (pass, fail) ->
		name = newDocName()
		ds = new DeltaStream hostname, port

		ds.submit name, {type:'simple'}, 0, (msg) ->
			assert.deepEqual msg, {r:'ok', v:0, doc:name}
			ds.submit name, {position:0, text:'hi'}, 1, (msg) ->
				assert.deepEqual msg, {r:'ok', v:1, doc:name}
				ds.disconnect()
				pass()

	should 'get an empty document returns a null snapshot', (pass, fail) ->
		name = newDocName()
		ds = new DeltaStream hostname, port

		ds.get name, (msg) ->
			assert.deepEqual msg, {v:0, type:null, snapshot:null, doc:name}
			ds.disconnect()
			pass()

	should 'get a non-empty document gets its snapshot', (pass, fail) ->
		name = newDocName()
		ds = new DeltaStream hostname, port

		ds.submit name, {type:'simple'}, 0, ->
			ds.get name, (msg) ->
				assert.deepEqual msg, {v:1, type:'simple', snapshot:{str:''}, doc:name}
				ds.disconnect()
				pass()

	should 'get a stream of ops for an open document', (pass, fail) ->
		name = newDocName()
		ds = new DeltaStream hostname, port

		ds.open name, 0, (msg) ->
			db.applyDelta name, {version:0, op:{type:'simple'}}, (error, appliedVersion) ->
				fail(error) if error?
				assert.strictEqual appliedVersion, 0

		ds.on name, 'op', (data) ->
			assert.deepEqual data, {doc:name, v:0, op:{type:'simple'}}
			ds.disconnect()
			pass()

	should 'not get ops sent after the document was closed', (pass, fail) ->
		name = newDocName()
		ds = new DeltaStream hostname, port

		ds.open name, 0, (msg) ->
			ds.close name
			ds.open newDocName(), 0, (msg) ->
				# The document should now be closed.
				db.applyDelta name, {version:0, op:{type:'simple'}}, (error, appliedVersion) ->
					# We shouldn't get that op...
					ds.open newDocName(), 0, (msg) ->
						ds.disconnect()
						pass()

		ds.on name, 'op', (data) ->
			fail "Received op for closed document: #{i data}"
]



###### Test runner

server.server.listen(8768, () ->
	client = http.createClient port, hostname

	tests_count = tests.length
	tests_run = 0
	tests_passed = 0
	stop = false

	maybeStop = () ->
		if tests_run == tests_count
			if tests_passed == tests_run
				console.log "\nAll #{tests_run} tests passed! PARTY!"
			else
				console.log "\nPassed #{tests_passed} out of #{tests_run} tests"
			server.server.close()

	for test in tests
		stop = true if test.stop? && test.stop == true

		if stop == true or (test.run? and test.run == false)
			tests_count--
			continue

		console.log "Should #{test.name}..."

		# Called when a test is complete, regardless of the outcome.
		testrun = () ->
			tests_run++
			maybeStop()

		pass = () ->
			tests_passed++
			testrun()

		fail = (message = "no message") ->
			throw new Error(message)
			testrun()

		exc = (message = "--") ->
			console.log "FAIL: It should #{test.name}:\n\t#{message}"
			testrun()

		try
			test.method(pass, fail)
		catch error
			exc error.stack
	
	maybeStop()
)


