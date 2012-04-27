// `Slowparse.NoscriptDOMBuilder` is a subclass of `DOMBuilder`
// which provides additional error reporting on the use of JavaScript.
// It's intended for clients who want to inform users in real-time that
// their JavaScript code can't be published or shared.
//
// Note that this is *not* a sanitizer. It's merely intended as a mechanism
// to pre-emptively warn users that their JS will be stripped by a
// remote server or other agent.
//
// You can use this DOM builder like this:
//
//     var builder = new Slowparse.NoscriptDOMBuilder(document);
//     var result = Slowparse.HTML(builder, someHTMLString);

(function(Slowparse) {
  Slowparse.NoscriptDOMBuilder = function(document) {
    Slowparse.DOMBuilder.call(this, document);
    
    // This helper calls a method on our DOMBuilder superclass.
    this._super = function(name, args) {
      Slowparse.DOMBuilder.prototype[name].apply(this, args);
    }
    
    this.pushElement = function(tagName, parseInfo) {
      // We want to blanketly disallow any `script` tags.
      if (tagName == "script")
        throw {
          parseInfo: {
            type: "SCRIPT_ELEMENT_NOT_ALLOWED",
            start: parseInfo.openTag.start,
            end: parseInfo.openTag.start + "<script".length
          }
        };
      this._super("pushElement", [tagName, parseInfo]);
    };
    
    this.attribute = function(name, value, parseInfo) {
      // If the attribute value starts with `javascript:`, regardless
      // of the attribute name, raise an error. We can change this in
      // the future if we only want to make this check on specific
      // attributes.
      if (value.match(/^javascript:/i))
        throw {
          parseInfo: {
            type: "JAVASCRIPT_URL_NOT_ALLOWED",
            name: parseInfo.name,
            value: parseInfo.value
          }
        };
      // If the attribute name begins with `on`, we can safely assume
      // it's an event handler attribute. We can change this in the
      // future if there are valid non-event-handler attributes that
      // start with `on`.
      if (name.match(/^on/))
        throw {
          parseInfo: {
            type: "EVENT_HANDLER_ATTR_NOT_ALLOWED",
            name: parseInfo.name,
            value: parseInfo.value
          }
        };
      this._super("attribute", [name, value, parseInfo]);
    };
  };
  
  Slowparse.NoscriptDOMBuilder.prototype = Slowparse.DOMBuilder.prototype;
})(Slowparse);
