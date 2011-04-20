// ShareJS options
module.exports = {
	// Database options
	db: {
		// DB type. Options are 'redis' or 'memory'. 'redis' requires the
		// redis npm package. 'memory' has no dependancies and no options.
		type: 'redis',

		// The prefix for database entries
		prefix: 'ShareJS:',

		// The hostname, port and options to pass to redis.
		// null lets redis decide - redis by default connects to localhost port 6379.
		hostname: null,
		port: null,
		redisOptions: null
	},

	// REST frontend options
	rest: {
		// Allow the DELETE HTTP command to perminantly delete sharejs documents
		delete: false
	},

	// SocketIO frontend options
	socketio: {
	}
}
