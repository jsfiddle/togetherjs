# This is a simple switch for the different database implementations.
#
# The interface is the same as the regular database implementations, except
# the options object can have another type:<TYPE> parameter which specifies
# which type of database to use.
#
# Example usage:
#  require('server/db').create {type:'redis'}

defaultType = 'redis'

module.exports = (options) ->
	type = options?.type ? defaultType
	Db = switch type
		when 'redis' then require './redis'
		when 'memory' then require './memory'
		else throw new Error "Invalid or unsupported database type: '#{type}'"
	
	new Db(options)
