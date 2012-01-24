(function(exports){

var benches = {

  string: {
    source:  "Hello World!",
    context: {}
  },

  replace: {
    source:  "Hello {name}! You have {count} new messages.",
    context: { name: "Mick", count: 30 }
  },

  array: {
    source:  "{for name in names}{name.name}{/for}",
    context: { names: [{name: "Moe"}, {name: "Larry"}, {name: "Curly"}, {name: "Shemp"}] }
  },

  object: {
    source:  "{person.name}{person.age}",
    context: { person: { name: "Larry", age: 45 } }
  },

  partial: {
    source:   "{for peep in peeps}{>replace}{/for}",
    context:  { peeps: [{name: "Moe", count: 15}, {name: "Larry", count: 5}, {name: "Curly", count: 1}] },
    partials: { replace: "Hello {peep.name}! You have {peep.count} new messages." }
  },

  complex: {
    source:  "<h1>{header}</h1>{if items}<ul>{for item in items}{if item.current}" +
             "<li><strong>{item.name}</strong></li>{/if}{if not item.current}" +
             "<li><a href=\"{item.url}\">{item.name}</a></li>{/if}" +
             "{/for}</ul>{/if}{if not items}<p>The list is empty.</p>{/if}",
    context: {
               header: function() {
                 return "Colors";
               },
               items: [
                 {name: "red", current: true, url: "#Red"},
                 {name: "green", current: false, url: "#Green"},
                 {name: "blue", current: false, url: "#Blue"}
               ]
             }
  }
}

exports.whiskersBench = function(suite, name, id) {
  var bench = benches[name],
      src = bench.source,
      ctx = bench.context,
      partials = bench.partials;

  suite.bench(id || name, function(next) {
    whiskers.render(src, ctx, partials);
    next();
  });
}

exports.whiskersBench.benches = benches;

})(typeof exports !== "undefined" ? exports : window);
