# This is the implementation of the JSON OT type.
#
# Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

exports ?= {}

exports.name = 'json'

exports.initialVersion = -> {}

# Move paths can be relative - ie, {p:[1,2,3], m:4} is the equivalent of
# {p:[1,2,3], m:[1,2,4]}. This method expands relative paths
# Makes sure a path is a list.
normalizeMovePath = (path, newPath) ->


invertComponent = (c) ->

exports.invert = (op) -> invertComponent for c in op


exports.apply = (snapshot, op) ->

exports.compose = (op1, op2) ->

exports.normalize = (op) ->
	op

transformComponent = (c, otherC, type) ->

exports.transformX = ->

exports.transform = ->


