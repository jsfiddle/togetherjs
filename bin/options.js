// ShareJS options
module.exports = {
	// Port to listen on
	port: 8000,

	// Database options
	db: {
		// DB type. Options are 'redis', 'couchdb' or 'memory'. 'redis' requires the
		// redis npm package. 'memory' has no dependancies and no options.
		type: 'redis',

		// The prefix for database entries
		prefix: 'ShareJS:',

		// The hostname, port and options to pass to redis.
		// null lets redis decide - redis by default connects to localhost port 6379.
		hostname: null,
		port: null,
		redisOptions: null

		// To use CouchDB uncomment this section then run bin/setup_couch:
		// type: 'couchdb',
		// hostname: "http://admin:admin@localhost",
		// port: 5984

	},

	// The server will statically host webclient/ directory at /share/*.
	// (Eg, the web client can be found at /share/share.js).
	// Set staticpath: null to disable.
	staticpath: '/share',

	// REST frontend options. Set rest: null to disable REST frontend.
	rest: {
	},

	// SocketIO frontend options. Set socketio: null to disable socketIO frontend.
	socketio: {
	  // Specify tuples for io.configure:
	  // 'transports': ['xhr-polling', 'flashsocket']
	},

	// Authentication code to test if clients are allowed to perform different actions.
	// See documentation for details.
	//auth: function(client, action) {
	//	action.allow();
	//}
}
