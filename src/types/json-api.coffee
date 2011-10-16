# API for JSON OT

json = require './json' if typeof WEB is 'undefined'

depath = (path) ->
	if path.length == 1 and path[0].constructor == Array
		path[0]
	else path

class SubDoc
	constructor: (@doc, @path) ->
	at: (path...) -> @doc.at @path.concat depath path
	get: -> @doc.getAt @path
	set: (value, cb) -> @doc.setAt @path, value, cb
	delete: (cb) -> @doc.deleteAt @path, cb
	insertText: (text, pos, cb) -> @doc.insertTextAt @path, text, pos, cb
	deleteText: (length, pos, cb) -> @doc.deleteTextAt @path, length, pos, cb
	insert: (pos, value, cb) -> @doc.insertAt @path, pos, value, cb
	push: (value, cb) -> @insert @get().length, value, cb
	move: (from, to, cb) -> @doc.moveAt @path, from, to, cb
	add: (amount, cb) -> @doc.addAt @path, amount, cb
	on: (event, cb) -> @doc.addListener @path, event, cb

traverse = (snapshot, path) ->
	container = data:snapshot
	key = 'data'
	elem = container
	for p in path
		elem = elem[key]
		key = p
		throw 'bad path' if typeof elem == 'undefined'
	{elem, key}

pathEquals = (p1, p2) ->
	return false if p1.length != p2.length
	for e,i in p1
		return false if e != p2[i]
	true

json['api'] =
	'provides': {'json':true}

	'get': -> @snapshot
	'at': (path...) -> new SubDoc this, depath path

	'getAt': (path) ->
		{elem, key} = traverse @snapshot, path
		return elem[key]

	'setAt': (path, value, cb) ->
		{elem, key} = traverse @snapshot, path
		op = {p:path}
		if elem.constructor == Array
			op.li = value
			op.ld = elem[key] if elem[key]
		else if typeof elem == 'object'
			op.oi = value
			op.od = elem[key] if elem[key]
		else throw 'bad path'
		@submitOp [op], cb

	'deleteAt': (path, cb) ->
		{elem, key} = traverse @snapshot, path
		throw 'no element at that path' unless elem[key]
		op = {p:path}
		if elem.constructor == Array
			op.ld = elem[key]
		else if typeof elem == 'object'
			op.od = elem[key]
		else throw 'bad path'
		@submitOp [op], cb

	'insertAt': (path, pos, value, cb) ->
		op = [{p:path.concat(pos),li:value}]
		@submitOp op, cb

	'moveAt': (path, from, to, cb) ->
		op = [{p:path.concat(from), lm:to}]
		@submitOp op, cb

	'addAt': (path, amount, cb) ->
		op = [{p:path, na:amount}]
		@submitOp op, cb

	'insertTextAt': (path, text, pos, cb) ->
		pos = 0 unless pos?
		op = [{'p':path.concat(pos), 'si':text}]
		@submitOp op, cb

	'deleteTextAt': (path, length, pos, cb) ->
		{elem, key} = traverse @snapshot, path
		op = [{'p':path.concat(pos), 'sd':elem[key][pos...(pos + length)]}]
		@submitOp op, cb

	'addListener': (path, event, cb) ->
		@_listeners.push {path, event, cb}
	'_register': ->
		@_listeners = []
		@on 'remoteop', (op) ->
			for c in op
				match_path = if c.na == undefined then c.p[...c.p.length-1] else c.p
				for {path, event, cb} in @_listeners
					if pathEquals path, match_path
						switch event
							when 'insert'
								if c.li != undefined and c.ld == undefined
									cb(c.li, c.p[c.p.length-1])
								else if c.oi != undefined and c.od == undefined
									cb(c.oi, c.p[c.p.length-1])
							when 'delete'
								if c.li == undefined and c.ld != undefined
									cb(c.ld, c.p[c.p.length-1])
								else if c.oi == undefined and c.od != undefined
									cb(c.od, c.p[c.p.length-1])
							when 'replace'
								if c.li != undefined and c.ld != undefined
									cb(c.ld, c.li, c.p[c.p.length-1])
								else if c.oi != undefined and c.od != undefined
									cb(c.od, c.oi, c.p[c.p.length-1])
							when 'move'
								if c.lm != undefined
									cb(c.p[c.p.length-1], c.lm)
							when 'text-insert'
								if c.si != undefined
									cb(c.si, c.p[c.p.length-1])
							when 'text-delete'
								if c.sd != undefined
									cb(c.sd, c.p[c.p.length-1])
							when 'add'
								if c.na != undefined
									cb(c.na)
