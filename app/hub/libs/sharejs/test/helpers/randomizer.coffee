assert = require 'assert'
helpers = require './misc'
util = require 'util'
p = -> #util.debug
i = -> #util.inspect

{randomInt, randomReal, seed} = helpers

# Returns client result
testRandomOp = (type, initialDoc = type.create()) ->
  makeDoc = -> {
      ops: []
      result: initialDoc
    }
  opSets = (makeDoc() for [0...3])
  [client, client2, server] = opSets

  for [0...10]
    doc = opSets[randomInt 3]
    [op, doc.result] = type.generateRandomOp doc.result
    doc.ops.push(op)

  p "Doc #{i initialDoc} + #{i ops} = #{i result}" for {ops, result} in [client, client2, server]

  checkSnapshotsEq = (a, b) ->
    if type.serialize
      assert.deepEqual type.serialize(a), type.serialize(b)
    else
      assert.deepEqual a, b

  # First, test type.apply.
  testApply = (doc) ->
    s = initialDoc
    s = type.apply s, op for op in doc.ops

    checkSnapshotsEq s, doc.result
  
  testApply set for set in opSets

  if type.invert?
    # Invert all the ops and apply them to result. Should end up with initialDoc.
    testInvert = (doc, ops = doc.ops) ->
      snapshot = JSON.parse(JSON.stringify(doc.result))

      # Sadly, coffeescript doesn't seem to support iterating backwards through an array.
      # reverse() reverses an array in-place so it needs to be cloned first.
      ops = doc.ops.slice().reverse()
      for op in ops
        op_ = type.invert op
        snapshot = type.apply snapshot, op_

      checkSnapshotsEq snapshot, initialDoc
  
    testInvert set for set in opSets

  # If all the ops are composed together, then applied, we should get the same result.
  if type.compose?
    p 'COMPOSE'
    compose = (doc) ->
      if doc.ops.length > 0
        doc.composed = helpers.composeList type, doc.ops
        # .... And this should match the expected document.
        checkSnapshotsEq doc.result, type.apply initialDoc, doc.composed

    compose set for set in opSets

    testInvert? set, [set.composed] for set in opSets when set.composed?
  
    # Check the diamond property holds
    if client.composed? && server.composed?
      [server_, client_] = helpers.transformX type, server.composed, client.composed

      s_c = type.apply server.result, client_
      c_s = type.apply client.result, server_

      # Interestingly, these will not be the same as s_c and c_s above.
      # Eg, when:
      #  server.ops = [ [ { d: 'x' } ], [ { i: 'c' } ] ]
      #  client.ops = [ 1, { i: 'b' } ]
      checkSnapshotsEq s_c, c_s

      if type.tp2 and client2.composed?
        # TP2 requires that T(op3, op1 . T(op2, op1)) == T(op3, op2 . T(op1, op2)).
        lhs = type.transform client2.composed, (type.compose client.composed, server_), 'left'
        rhs = type.transform client2.composed, (type.compose server.composed, client_), 'left'

        assert.deepEqual lhs, rhs
  
  if type.prune?
    p 'PRUNE'
    
    [op1] = type.generateRandomOp initialDoc
    [op2] = type.generateRandomOp initialDoc

    for idDelta in ['left', 'right']
      op1_ = type.transform op1, op2, idDelta
      op1_pruned = type.prune op1_, op2, idDelta

      assert.deepEqual op1, op1_pruned

  # Now we'll check the n^2 transform method.
  if client.ops.length > 0 && server.ops.length > 0
    p 'TP2'
    p "s #{i server.result} c #{i client.result} XF #{i server.ops} x #{i client.ops}"
    [s_, c_] = helpers.transformLists type, server.ops, client.ops
    p "XF result #{i s_} x #{i c_}"
#    p "applying #{i c_} to #{i server.result}"
    s_c = c_.reduce type.apply, server.result
    c_s = s_.reduce type.apply, client.result

    checkSnapshotsEq s_c, c_s

    # ... And we'll do a round-trip using invert().
    if type.invert?
      c_inv = c_.slice().reverse().map type.invert
      server_result_ = c_inv.reduce type.apply, s_c
      checkSnapshotsEq server.result, server_result_
      orig_ = server.ops.slice().reverse().map(type.invert).reduce(type.apply, server_result_)
      checkSnapshotsEq orig_, initialDoc
  
  client.result

collectStats = (type) ->
  functions = ['transform', 'compose', 'apply', 'prune']

  orig = {}
  orig[fn] = type[fn] for fn in functions when type[fn]?
  restore = ->
    type[fn] = orig[fn] for fn in functions when orig[fn]?
  
  stats = {}
  stats[fn] = 0 for fn in functions when orig[fn]?

  collect = (fn) -> (args...) ->
    stats[fn]++
    orig[fn].apply null, args
  
  type[fn] = collect fn for fn in functions when orig[fn]?

  [stats, restore]

# Run some iterations of the random op tester. Requires a random op generator for the type.
exports.test = (type, iterations = 1000) ->
  assert.ok type.generateRandomOp
  assert.ok type.transform

  [stats, restore] = collectStats type

  console.error "   Running #{iterations} randomized tests for type #{type.name}..."
  console.error "     (seed: #{seed})" if seed

  warnUnless = (fn) -> console.error "NOTE: Not running #{fn} tests because #{type.name} does not have #{fn}() defined" unless type[fn]?
  warnUnless 'invert'
  warnUnless 'compose'

  doc = type.create()

  console.time 'randomizer'
  iterationsPerPct = iterations / 100
  for n in [0..iterations]
    if n % (iterationsPerPct * 2) == 0
      process.stdout.write (if n % (iterationsPerPct * 10) == 0 then "#{n / iterationsPerPct}" else '.')
    doc = testRandomOp(type, doc)
  console.log()

  console.timeEnd 'randomizer'

  console.log "Performed:"
  console.log "\t#{fn}s: #{number}" for fn, number of stats

  restore()
