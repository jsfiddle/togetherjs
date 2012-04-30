jQuery.fn.extend({
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
          cb();
        }
      });
      loadsLeft++;
    });
  }
});
