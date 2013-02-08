define(["util"], function (util) {
  function clean(t) {
    t = t.replace(/[<][%]\s*\/\*[\S\s\r\n]*\*\/\s*[%][>]/, "");
    t = util.trim(t);
    t = t.replace(/http:\/\/localhost:8080/g, TowTruck.baseUrl);
    return t;
  }
  return {
    chat: clean("<%- read('chat.tmpl')%>"),
    help: clean("<%- read('help.tmpl')%>"),
    walkabout: clean("<%- read('walkabout.tmpl')%>")
  };
});
