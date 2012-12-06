# Some utility functions.
p = -> #require('util').debug
i = -> #require('util').inspect

# Cross-transform function. Transform server by client and client by server. Returns
# [server, client].
exports.transformX = transformX = (type, left, right) ->
  [type.transform(left, right, 'left'), type.transform(right, left, 'right')]

# new seed every 6 hours
exports.seed = Math.floor(Date.now() / (1000*60*60*6))
if exports.seed?
  {rand_real, seed} = require('./mersenne')
  seed exports.seed
  exports.randomReal = rand_real
else
  exports.randomReal = Math.random

# Generate a random int 0 <= k < n
exports.randomInt = (n) -> Math.floor(exports.randomReal() * n)

# Transform a list of server ops by a list of client ops.
# Returns [serverOps', clientOps'].
# This is O(serverOps.length * clientOps.length)
exports.transformLists = (type, serverOps, clientOps) ->
  #p "Transforming #{i serverOps} with #{i clientOps}"
  serverOps = for s in serverOps
    clientOps = for c in clientOps
      #p "X #{i s} by #{i c}"
      [s, c_] = transformX type, s, c
      c_
    s
  
  [serverOps, clientOps]

# Compose a list of ops together
exports.composeList = (type, ops) -> ops.reduce type.compose

# Wait for the function to be called a given number of times, then call the callback.
exports.expectCalls = expectCalls = (n, callback) ->
  remaining = n
  ->
    remaining--
    if remaining == 0
      callback()
    else if remaining < 0
      throw new Error "expectCalls called more than #{n} times"

# Returns a function that calls test.done() after it has been called n times
exports.makePassPart = (test, n) ->
  expectCalls n, -> test.done()

# Callback will be called after all the ops have been applied, with the
# resultant snapshot. Callback format is callback(error, snapshot)
#
# It might be worth moving this to model so others can use this method.
exports.applyOps = applyOps = (model, docName, startVersion, ops, callback) =>
  op = ops.shift()
  model.applyOp docName, {v:startVersion, op:op}, (error, appliedVersion) =>
    if error
      callback error
    else
      if ops.length == 0
        model.getSnapshot docName, callback
      else
        applyOps model, docName, startVersion + 1, ops, callback

# Generate a new, locally unique document name.
exports.newDocName = do ->
  index = 1
  -> 'testing_doc_' + index++

