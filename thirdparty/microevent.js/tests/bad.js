var MicroEvent = require('../microevent.js');
var Foo = function() {};
MicroEvent.mixin(Foo);
f = new Foo;
b = new Foo;
f.subscribe("blerg", function(val){ console.log("f got blerg", val); });

console.log("You should see 'f got blerg yes' and nothing more:");
console.log("");

f.publish("blerg", "yes");
b.publish("blerg", "no");