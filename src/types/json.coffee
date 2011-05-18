# This is the implementation of the JSON OT type.
#
# Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

text = require './text'

exports ?= {}

exports.name = 'json'

exports.initialVersion = -> null

# Move paths can be relative - ie, {p:[1,2,3], m:4} is the equivalent of
# {p:[1,2,3], m:[1,2,4]}. This method expands relative paths
# Makes sure a path is a list.
normalizeMovePath = (path, newPath) ->


invertComponent = (c) ->
	c_ = { p: c['p'] }
	c_['sd'] = c['si'] if c['si'] != undefined
	c_['si'] = c['sd'] if c['sd'] != undefined
	c_['od'] = c['oi'] if c['oi'] != undefined
	c_['oi'] = c['od'] if c['od'] != undefined
	c_['ld'] = c['li'] if c['li'] != undefined
	c_['li'] = c['ld'] if c['ld'] != undefined
	c_['na'] = -c['na'] if c['na'] != undefined
	if c['lm'] != undefined
		c_['lm'] = c['p'][c['p'].length-1]
		c_['p'] = c['p'][0...c['p'].length - 1].concat([c['lm']])
	c_

exports.invert = (op) -> invertComponent c for c in op.slice().reverse()

checkValidOp = (op) ->

checkList = (elem) ->
	throw new Error 'Referenced element not a list' unless Array.isArray && Array.isArray(elem)

checkObj = (elem) ->
	throw new Error "Referenced element not an object (it was #{JSON.stringify elem})" unless elem.constructor is Object

exports.apply = apply = (snapshot, op) ->
	checkValidOp op
	op = clone op

	container = {data: clone snapshot}

	try
		for c, i in op
			parent = null
			parentkey = null
			elem = container
			key = 'data'

			for p in c.p
				parent = elem
				parentkey = key
				elem = elem[key]
				key = p

				throw new Error 'Path invalid' unless parent?

			if c.na != undefined
				# Number add
				throw new Error 'Referenced element not a number' unless typeof elem[key] is 'number'
				elem[key] += c.na

			else if c.si != undefined
				# String insert
				throw new Error "Referenced element not a string (it was #{JSON.stringify elem})" unless typeof elem is 'string'
				parent[parentkey] = elem[...key] + c.si + elem[key..]
			else if c.sd != undefined
				# String delete
				throw new Error 'Referenced element not a string' unless typeof elem is 'string'
				throw new Error 'Deleted string does not match' unless elem[key...key + c.sd.length] == c.sd
				parent[parentkey] = elem[...key] + elem[key + c.sd.length..]

			else if c.li != undefined && c.ld != undefined
				# List replace
				checkList elem

				# Should check the list element matches c.ld
				elem[key] = c.li
			else if c.li != undefined
				# List insert
				checkList elem

				elem.splice key, 0, c.li
			else if c.ld != undefined
				# List delete
				checkList elem

				# Should check the list element matches c.ld here too.
				elem.splice key, 1
			else if c.lm != undefined
				# List move
				checkList elem
				if c.lm != key
					e = elem[key]
					# Remove it...
					elem.splice key, 1
					# And insert it back.
					elem.splice c.lm, 0, e

			else if c.oi != undefined
				# Object insert / replace
				checkObj elem
				
				# Should check that elem[key] == c.od
				elem[key] = c.oi
			else if c.od != undefined
				# Object delete
				checkObj elem

				# Should check that elem[key] == c.od
				delete elem[key]
	catch e
		# TODO: Roll back all already applied changes. Write tests before implementing this code.
		throw e

	container['data']

# Checks if two paths, p1 and p2 match.
pathMatches = (p1, p2, ignoreLast) ->
	return false unless p1.length == p2.length

	for p, i in p1
		return false if p != p2[i] and (!ignoreLast or i != p1.length - 1)
			
	true

append = (dest, c) ->
	c = clone c
	if dest.length != 0 and pathMatches c.p, (last = dest[dest.length - 1]).p
		if last.na != undefined and c.na != undefined
			dest[dest.length - 1] = { p: last.p, na: last.na + c.na }
		else if last.li != undefined and c.li == undefined and c.ld == last.li
			# insert immediately followed by delete becomes a noop.
			if last.ld != undefined
				# leave the delete part of the replace
				delete last.li
			else
				dest.pop()
		else if last.od != undefined and last.oi == undefined and
				c.oi != undefined and c.od == undefined
			last.oi = c.oi
		else if c.lm != undefined and c.p[c.p.length-1] == c.lm
			null # don't do anything
		else
			dest.push c
	else
		dest.push c

exports.compose = (op1, op2) ->
	checkValidOp op1
	checkValidOp op2

	newOp = clone op1
	append newOp, c for c in op2

	newOp

exports.normalize = (op) ->
	op

# hax, copied from test/types/json
clone = (o) -> JSON.parse(JSON.stringify o)

commonPath = (p1, p2) ->
	p1 = p1.slice()
	p2 = p2.slice()
	p1.unshift('data')
	p2.unshift('data')
	p1 = p1[...p1.length-1]
	p2 = p2[...p2.length-1]
	return -1 if p2.length == 0
	i = 0
	while p1[i] == p2[i] && i < p1.length
		i++
		if i == p2.length
			return i-1
	return

transformComponent = (dest, c, otherC, type) ->
	j = JSON.stringify
	console.log 'transformComponenting',j(c),'against',j(otherC),'type:',type
	res = transformComponent_ dest, c, otherC, type
	console.log 'got',j dest
	res

# transform c so it applies to a document with otherC applied.
transformComponent_ = (dest, c, otherC, type) ->
	c = clone c
	c['p'].push(0) if c['na'] != undefined
	otherC['p'].push(0) if otherC['na'] != undefined

	common = commonPath c['p'], otherC['p']
	common2 = commonPath otherC.p, c.p
	console.log common, common2

	cplength = c.p.length
	otherCplength = otherC.p.length

	c['p'].pop() if c['na'] != undefined # hax
	otherC['p'].pop() if otherC['na'] != undefined

	if otherC['na']
		if common2? && otherCplength >= cplength && otherC.p[common2] == c.p[common2]
			if c.ld != undefined
				oc = clone otherC
				oc.p = oc.p[cplength..]
				c.ld = apply clone(c.ld), [oc]
			else if c.od != undefined
				oc = clone otherC
				oc.p = oc.p[cplength..]
				c.od = apply clone(c.od), [oc]
		append dest, c
		return dest

	if common2? && otherCplength > cplength && c.p[common2] == otherC.p[common2]
		# transform based on c
		if c.ld != undefined
			oc = clone otherC
			oc.p = oc.p[cplength..]
			c.ld = apply clone(c.ld), [oc]
		else if c.od != undefined
			oc = clone otherC
			oc.p = oc.p[cplength..]
			c.od = apply clone(c.od), [oc]


	if common?
		commonOperand = cplength == otherCplength
		# transform based on otherC
		if otherC.na != undefined
			null
			# this case is handled above due to icky path hax
		else if otherC.si != undefined || otherC.sd != undefined
			# String op -- pass through to text type
			if c.si != undefined || c.sd != undefined
				throw new Error("must be a string?") unless commonOperand
				p1 = c.p[cplength - 1]
				p2 = otherC.p[otherCplength - 1]
				tc1 = { p: p1 }
				tc2 = { p: p2 }
				tc1['i'] = c.si if c.si?
				tc1['d'] = c.sd if c.sd?
				tc2['i'] = otherC.si if otherC.si?
				tc2['d'] = otherC.sd if otherC.sd?
				res = []
				text._transformComponent res, tc1, tc2, type
				for tc in res
					jc = { p: c.p[...common] }
					jc['p'].push(tc['p'])
					jc['si'] = tc['i'] if tc['i']?
					jc['sd'] = tc['d'] if tc['d']?
					append dest, jc
				return dest
		else if otherC.li != undefined && otherC.ld != undefined
			if otherC.p[common] == c.p[common]
				# noop
				if otherCplength < cplength
					# we're below the deleted element, so -> noop
					return dest
				else if c.ld != undefined
					if c.li != undefined and type == 'client'
						c.ld = clone otherC.li
					else
						# we're trying to delete the same element, -> noop
						return dest
		else if otherC.li != undefined
			if c.li != undefined and c.ld == undefined and otherCplength == cplength and c.p[common] == otherC.p[common]
				# in li vs. li, client wins.
				if type == 'server'
					c.p[common]++
			else if otherC.p[common] <= c.p[common]
				c.p[common]++

			if c.lm != undefined
				if otherCplength == cplength
					# otherC edits the same list we edit
					if otherC.p[common] <= c.lm
						c.lm++
		else if otherC.ld != undefined
			if c.lm != undefined
				if otherCplength == cplength
					if otherC.p[common] == c.p[common]
						# they deleted the thing we're trying to move
						return dest
					# otherC edits the same list we edit
					p = otherC.p[common]
					from = c.p[common]
					to = c.lm
					if p < to || (p == to && from < to)
						c.lm--

			if otherC.p[common] < c.p[common]
				c.p[common]--
			else if otherC.p[common] == c.p[common]
				if otherCplength < cplength
					# we're below the deleted element, so -> noop
					return dest
				else if c.ld != undefined
					if c.li != undefined
						# we're replacing, they're deleting. we become an insert.
						delete c.ld
					else
						# we're trying to delete the same element, -> noop
						return dest
		else if otherC.lm != undefined
			if c.lm != undefined and cplength == otherCplength
				# lm vs lm, here we go!
				from = c.p[common]
				to = c.lm
				otherFrom = otherC.p[common]
				otherTo = otherC.lm
				f = transformPosByMove = (pos, from, to, bumpIfEqual) ->
					if pos != from
						pos-- if pos > from
						pos++ if pos > to or (pos == to and bumpIfEqual)
					pos
				
				if from == otherFrom
					# Tie break based on client/server
					if type == 'client'
						from = otherTo
					else
						return dest
				else
					from = transformPosByMove from, otherFrom, otherTo, true
					to = transformPosByMove to, otherFrom, otherTo, type == 'server'

				c.p[common] = from
				c.lm = to
										
#				if otherFrom == otherTo
#					# nop
#				else
#					if from == otherFrom
#						c.p[common] = otherTo
#					else
#						if from > otherFrom
#							c.p[common]--
#						if from > otherTo
#							c.p[common]++
#						if to > otherFrom
#							c.lm--
#						if to > otherTo
#							c.lm++
#						else if to == otherTo
#							# tiebreak
#							if type == 'server' or from == to
#								c.lm++
			else if c.li == undefined || c.ld != undefined || !commonOperand
				from = otherC.p[common]
				to = otherC.lm
				p = c.p[common]
				if from < p
					c.p[common]--
				if to < p || (to == p and from > to)
					c.p[common]++
				if p == from
					c.p[common] = to
		else if otherC.oi != undefined && otherC.od != undefined
			return dest if cplength > otherCplength and c.p[common] == otherC.p[common]
			if c.oi != undefined and c.p[common] == otherC.p[common]
				# we inserted where someone else replaced
				if type == 'server'
					# client wins
					return dest
				else
					# we win, make our op a replacement
					c.od = otherC.oi
			else
				# -> noop if the other component is deleting the same object (or any
				# parent)
				return dest if c.p[common] == otherC.p[common]
		else if otherC.oi != undefined
			if c.oi != undefined and c.p[common] == otherC.p[common]
				# client wins if we try to insert at the same place
				if type == 'client'
					append dest, {p:c.p,od:otherC.oi}
				else
					return dest
		else if otherC.od != undefined
			if c.p[common] == otherC.p[common]
				return dest if cplength > otherCplength
				if c.oi != undefined
					delete c.od
				else
					return dest
	
	append dest, c
	return dest

require('./helpers').bootstrapTransform(exports, transformComponent, checkValidOp, append)
