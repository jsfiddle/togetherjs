// ShareJS options
module.exports = {
	// Port to listen on
	port: 8000,

	// Database options
	db: {
		// DB type. Options are 'redis', 'couchdb' or 'none'. 'redis' requires the
		// redis npm package.
    //
    // If you don't want a database, you can also say db: null. With no database,
    // all documents are deleted when the server restarts.

    // By default, sharejs tries to use the redis DB backend.
		type: 'redis',
   
		// The prefix for database entries
		prefix: 'ShareJS:',

		// The hostname, port and options to pass to redis.
		// null lets the database decide - redis by default connects to localhost port 6379.
		//hostname: null,
		//port: null,
		//redisOptions: null


		// To use CouchDB uncomment this section then run bin/setup_couch.
    // Database URI Defaults to http://localhost:5984/sharejs .
		//type: 'couchdb',
		//uri: "http://admin:admin@localhost:5984/ot",


    // To use postgresql uncomment this section then run bin/setup_pg
    //type: 'pg',
    //uri: 'tcp://josephg:@localhost/postgres',

    // By default, sharejs will create its tables in a schema called 'sharejs'.
    //schema: 'sharejs',
    //operations_table: 'ops',
    //snapshot_table: 'snapshots',

    // sharejs will automatically try and create the DB tables if they don't exist. You
    // can create the database tables manually using bin/setup_pg.
    //create_tables_automatically: true,
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

  // Browserchannel server options. Set browserChannel:null to disable browserchannel.
  browserChannel: {},

	// Authentication code to test if clients are allowed to perform different actions.
	// See documentation for details.
	//auth: function(client, action) {
	//	action.allow();
	//}
}
