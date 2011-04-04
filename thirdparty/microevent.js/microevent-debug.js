/**
 * MicroEvent.js debug
 *
 * # it is the same as MicroEvent.js but it adds checks to help you debug
*/

var MicroEvent	= function(){};
MicroEvent.prototype	= {
	subscribe	: function(event, fct){
		this._events = this._events || {};		
		this._events[event] = this._events[event]	|| [];
		this._events[event].push(fct);
		return this;
	},
	unsubscribe	: function(event, fct){
		console.assert(typeof fct === 'function');
		this._events = this._events || {};		
		if( event in this._events === false  )	return this;
		console.assert(this._events[event].indexOf(fct) !== -1);
		this._events[event].splice(this._events[event].indexOf(fct), 1);
		return this;
	},
	publish	: function(event /* , args... */){
		this._events = this._events || {};		
		if( event in this._events === false  )	return this;
		for(var i = 0; i < this._events[event].length; i++){
			this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
		}
		return this;
	}
};

/**
 * mixin will delegate all MicroEvent.js function in the destination object
 *
 * - require('MicroEvent').mixin(Foobar) will make Foobar able to use MicroEvent
 *
 * @param {Object} the object which will support MicroEvent
*/
MicroEvent.mixin	= function(destObject){
	var props	= ['subscribe', 'unsubscribe', 'publish'];
	for(var i = 0; i < props.length; i ++){
		destObject.prototype[props[i]]	= MicroEvent.prototype[props[i]];
	}
};

// export in common js
if( typeof module !== "undefined" && ('exports' in module)){
	module.exports	= MicroEvent;
}
