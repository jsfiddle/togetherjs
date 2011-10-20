
# Testing tool tests
module.exports = {
  'create new doc name with each invocation of newDocName()': (test) ->
    test.notStrictEqual newDocName(), newDocName()
    test.strictEqual typeof newDocName(), 'string'
    test.done()
  
  'makePassPart': (test) ->
    timesCalled = 0
    faketest = {
      done: ->
        test.strictEqual timesCalled, 3
        test.done()
    }
    
    passPart = makePassPart test, 3
    passPart()
    passPart()
    passPart()
}

