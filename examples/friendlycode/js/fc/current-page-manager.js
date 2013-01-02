define(function() {
  function defaultLoadPage(window) {
    // We don't currently support dynamically changing the URL
    // without a full page reload, unfortunately, so just trigger a
    // reload if the user clicked the 'back' button after we pushed
    // a new URL to it.    
    return function() { window.location.reload() };
  }
  
  return function CurrentPageManager(options) {
    var self = {},
        window = options.window,
        pageToLoad = options.currentPage,
        loadPage = options.loadPage || defaultLoadPage(window),
        supportsPushState = window.history.pushState ? true : false;
    
    if (supportsPushState)
      window.history.replaceState({pageToLoad: pageToLoad}, "",
                                  window.location.href);
    
    // If a URL hash is specified, it should override anything provided by
    // a server.
    if (window.location.hash.slice(1))
      pageToLoad = window.location.hash.slice(1);
    
    window.addEventListener("hashchange", function(event) {
      var newPageToLoad = window.location.hash.slice(1);
      if (newPageToLoad != pageToLoad) {
        pageToLoad = newPageToLoad;
        loadPage(pageToLoad);
      }
    }, false);

    if (supportsPushState)
      window.addEventListener("popstate", function(event) {
        // For some reason Webkit is sending a spurious popstate with
        // state == null on page load, so we want to check that it's
        // non-null first (see #39).
        if (event.state && event.state.pageToLoad != pageToLoad) {
          pageToLoad = event.state.pageToLoad;
          loadPage(pageToLoad);
        }
      }, false);
    
    self.currentPage = function() { return pageToLoad; };
    self.changePage = function(page, url) {
      pageToLoad = page;
      if (supportsPushState)
        window.history.pushState({pageToLoad: page}, "", url);
      else
        window.location.hash = "#" + page;
    };
    
    return self;
  };
});
