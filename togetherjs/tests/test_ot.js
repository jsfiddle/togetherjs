// =SECTION Setup expand-on-failure

Test.require("ot", "util", "randomutil");
// => Loaded...

var generator = randomutil(1);

var Client = util.Class({

  constructor: function (clientId, hub, text) {
    this.clientId = clientId;
    this.hub = hub;
    this.text = text || "";
    this.history = ot.History(clientId, this.text);
    this.queuedChanges = [];
    this.hub.addClient(this);
  },

  makeChange: function () {
    var delta = ot.TextReplace.random(this.text, generator);
    var orig = this.text;
    this.text = delta.apply(this.text);
    var change = this.history.addDelta(delta);
    this.text = this.history.getState();
    this.queuedChanges.push(change);
    console.log("internal:", change+"", this.clientId);
    console.log("    from:", orig);
    console.log("      to:", this.text);
  },

  incoming: function (change) {
    console.log("incoming change", change);
    var delta = this.history.add(change);
    console.log("resulting delta", delta+"");
    var orig = this.text;
    console.log("applying", JSON.stringify(this.text), delta+"");
    this.text = delta.apply(this.text);
    this.text = this.history.getState();
    console.log("  change:", change+"", this.clientId);
    console.log("    from:", orig);
    console.log("      to:", this.text);
    if (this.text != this.history.getState()) {
      console.log("INVALID FORWARD DELTA");
      console.log("Delta applied:", delta+"");
      console.log("Produces", JSON.stringify(this.text), "instead of", JSON.stringify(this.history.getState()), "from", JSON.stringify(orig));
    }
  },

  flush: function () {
    this.queuedChanges.forEach(function (c) {
      this.hub.send(c, this);
    }, this);
    this.queuedChanges = [];
  }
});

var hub = {

  clients: [],

  addClient: function (client) {
    this.clients.push(client);
  },

  send: function (change, client) {
    util.assert(client);
    for (var i=0; i<this.clients.length; i++) {
      var c = this.clients[i];
      if (c !== client) {
        console.log("send change:", change+"", "from:", client.clientId, "to:", c.clientId);
        c.incoming(change.clone());
      }
    }
  },

  flushAll: function () {
    this.clients.forEach(function (c) {
      c.flush();
      c.history.logHistory();
    }, this);
  },

  clear: function () {
    this.clients = [];
  }
};

// =>

// =SECTION Test fixture expand-on-failure

var error;

function check() {
  hub.flushAll();
  var text;
  var textId;
  var history;
  hub.clients.forEach(function (c) {
    console.log("----------------------------------------");
    c.history.logHistory();
  });
  for (var i=0; i<hub.clients.length; i++) {
    var client = hub.clients[i];
    if (text === undefined) {
      text = client.text;
      textId = client.clientId;
      history = client.history;
    } else {
      if (text != client.text) {
        print("Error: mismatch in client", client.clientId, "in run", run, first, second);
        print("Basis text:", JSON.stringify(text), textId);
        print("Found text:", JSON.stringify(client.text), client.clientId);
        throw 'Error';
      }
    }
  }
}

function runExample(first, second) {
  generator = randomutil((run+1) * (first+1) * (second+1));
  generator.defaultChars = "XYZ/_ ";
  var text = "abcdef";
  console.log("Text:", JSON.stringify(text));
  hub.clear();
  var clients = [Client("a", hub, text), Client("b", hub, text)];
  for (var i=0; i<first; i++) {
    hub.clients[0].makeChange();
  }
  generator.defaultChars = "SRT+:-";
  for (i=0; i<second; i++) {
    hub.clients[1].makeChange();
  }
  console.log("--Starting state--------------------------------------------");
  hub.clients[0].history.logHistory();
  hub.clients[1].history.logHistory();
  console.log("------------------------------------------------------------");
}

// =SECTION Test

var start = doctest.params.startRun;
start = start ? parseInt(start, 10) : 0;
for (var run=start; run<100; run++) {
  for (var first=0; first<4; first++) {
    for (var second=0; second<4; second++) {
      if (! (first || second)) {
        // Boring case
        continue;
      }
      console.log("Run:", run, "First:", first, "Second:", second);
      runExample(first, second);
      check();
      console.clear();
    }
  }
}
print("done.");


// => done.
