// import microevent.js 
var MicroEvent	= require('../microevent-debug.js');

/**
 * Ticker is a class periodically sending out dummy tick events
*/
var Ticker	= function( interval ){
	var self	= this;
	setInterval(function(){
		self.publish('tick', new Date());
	}, 1000);
};
/**
 * make Ticker support MicroEventjs
*/
MicroEvent.mixin(Ticker);

// create a ticker
var ticker = new Ticker();
// subsribe the 'tick' event
ticker.subscribe('tick', function(date) {
	// display to check
	console.log('notified date', date);
});



