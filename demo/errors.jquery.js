(function(jQuery, _) {
  var $ = jQuery;
  var errors = $();
  
  jQuery.extend({
    loadErrors: function(basePath, names, cb) {
      var urls = names.map(function(name) {
        return basePath + "errors." + name + ".html";
      });
      errors = $('<div></div>').loadMany(urls, cb);
    }
  });
  
  jQuery.fn.extend({
    errorHighlightInterval: function() {
      var interval = $(this).attr("data-highlight").split(",");
      var start = parseInt(interval[0]);
      var end = interval[1] ? parseInt(interval[1]) : undefined;
      return {start: start, end: end};
    },
    eachErrorHighlight: function(cb) {
      $("[data-highlight]", this).each(function(i) {
        var interval = $(this).errorHighlightInterval();
        cb.call(this, interval.start, interval.end, i);
      });
      return this;
    },
    fillError: function(error) {
      var template = $(".error-msg." + error.type, errors);
      this.html(_.template(template.html(), error)).show();
      return this;
    },
    // This is like jQuery.load(), but it loads the content of multiple
    // URLs into the selection, appending their contents in the order
    // in which they are listed.
    loadMany: function(urls, cb) {
      var self = $(this);
      var loadsLeft = 0;
      var divs = $();
      urls.forEach(function(url) {
        var div = $('<div></div>');
        divs = divs.add(div);
        div.load(url, function() {
          if (--loadsLeft == 0) {
            self.append(divs);
            cb.apply(this, []);
          }
        });
        loadsLeft++;
      });
      return this;
    }
  });
})(jQuery, _);
