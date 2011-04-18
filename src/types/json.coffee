# The document is a plain JSON object.
#
# Ops are lists of op components.
# Op components have 2 parts:
#  - Path
#  - Operation
#
# The path is a list of string keys describing how to reach the affected element.
#
# Op components are:
# - Move {p:OLDPATH, m:NEWPATH} Moves the element from OLDPATH to NEWPATH. NEWPATH
#    can instead be a single value (not a list) and in this case, it specifies the new
#    position in the current object. You can only move objects into arrays and dictionaries.
# - Strings:
#    {p:[2], si:'hello'} inserts 'hello' at position 2
#    {p:[2, 10], sd:'world'} deletes 'world' at position 10 in the string at position 2
# - Numbers:
#    {p:[1,3,'k'], na:X} adds X to a numeric component
# - Lists:
#   - {p:[3], li:[]} inserts an empty list at position 3.
#   - {p:[3], ld:41} deletes the list element at position 3 (41). For invertability, deleted
#                 elements are repeated in the op. Everything after position 3 is shuffled back.
# - Objects:
#   - {p:['key'], oi:'newvalue', od:'oldvalue'} sets doc['key'] = 'newvalue'. od = the old
#           (deleted) value. oi is optional - if not set, the value is deleted.
#           od MUST be set to the previous value.
#
# The document is created containing undefined. Use object set to set the value of the whole object.
# You will probably want to do this once.
#  Eg: {p:[], oi:{}} to make the document contain an empty dictionary.
#
# (Maybe make object creation take an initial value?)


exports ?= {}

exports.name = 'json'

exports.initialVersion = -> ''

# Move paths can be 
# Makes sure a path is a list.
normalizeMovePath = (path, newPath) ->


exports.invert = 

exports.apply = (snapshot, op) ->

exports.compose = (op1, op2) ->

exports.normalize = (op) ->
	op

transformComponent = (c, otherC, type) ->

exports.transformX = ->

exports.transform = ->


