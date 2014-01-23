define(["util"], function (util) {
  var analytics = util.Module("analytics");

  analytics.activate = function () {
    var enable = TogetherJS.config.get("enableAnalytics");
    var code = TogetherJS.config.get("analyticsCode");
    TogetherJS.config.close("enableAnalytics");
    TogetherJS.config.close("analyticsCode");
    if (! (enable && code)) {
      return;
    }
    // This is intended to be global:
    var gaq = window._gaq || [];
    gaq.push(["_setAccount", code]);
    gaq.push(['_setDomainName', location.hostname]);
    gaq.push(["_trackPageview"]);
    window._gaq = gaq;

    (function() {
      var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
      ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
      var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
    })();
  };

  return analytics;
});
