(function(uubench){

function Bench(id, test, options, callback) {
  this.id = id;
  this.options = options;
  this.test = test;
  this.loop = test.length > 1;
  this.callback = callback;
}

Bench.prototype.run = function(iter) {
  var self = this, fn = self.test,
      checkfn = self.options.type === "adaptive" ? adaptive : fixed,
      i = iter, pend = i,
      min = self.options.min, start;

  if (self.loop) {
    pend = 1;
    start = new Date();
    fn(checkfn, i);
  } else {
    start = new Date();
    while (i--) {
      fn(checkfn);
    }
  }

  function fixed() {
    if (--pend === 0) {
      var elapsed = new Date() - start;
      self.callback({iterations: iter, elapsed: elapsed});
    }
  }

  function adaptive() {
    if (--pend === 0) {
      var elapsed = new Date() - start;
      if (elapsed < min) {
        self.run(iter*2);
      } else {
        self.callback({iterations: iter, elapsed: elapsed});
      }
    }
  }
}

uubench.Bench = Bench;

uubench.defaults = {
  type:       "adaptive", // adaptive or fixed
  iterations: 10,         // starting iterations
  min:        100,        // minimum run time (ms) - adaptive only
  delay:      100         // delay between tests (ms)
}

function Suite(opts) {
  for (var key in uubench.defaults) {
    if (opts[key] === undefined) {
      opts[key] = uubench.defaults[key];
    }
  }
  this.options = opts;
  this.tests = [];
}

Suite.prototype.bench = function(name, fn) {
  var self = this;
  self.tests.push(new Bench(name, fn, this.options, function(stats) {
    self.emit("result", name, stats);
    self.pending--;
    self.check();
  }));
}

Suite.prototype.run = function() {
  if (this.pending) return;
  var self = this, len = self.tests.length;
  self.emit("start", self.tests);
  self.start = new Date().getTime();
  self.pending = len;
  for (var i=0; i<len; i++) {
    self.runOne(i);
  }
}

Suite.prototype.runOne = function(idx) {
  var self = this;
  setTimeout(function() {
    self.tests[idx].run(self.options.iterations);
  }, self.options.delay);
}

Suite.prototype.check = function() {
  if (this.pending) return;
  this.emit("done", new Date().getTime() - this.start);
}

Suite.prototype.emit = function(type) {
  var event = this.options[type];
  if (event) {
    event.apply(this, Array.prototype.slice.call(arguments, 1));
  }
}

uubench.Suite = Suite;

})(typeof exports !== 'undefined' ? exports : window.uubench = {});
