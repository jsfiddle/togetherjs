"use strict";

// `TreeInspectors` contains functions that inspect a document
// fragment and report interesting things about it.
//
// This library has no required dependencies, though optional Slowparse
// integration is included.
//
// If [RequireJS] is detected, this file is defined as a module via
// `define()`. Otherwise, a global called `TreeInspectors` is exposed.
//
//   [RequireJS]: http://requirejs.org/
var TreeInspectors = (function() {
  // ## Utility Functions
  var utils = {
    // This function calls the given function for every element
    // that matches the given selector.
    each: function each(doc, selector, fn) {
      var all = doc.querySelectorAll(selector);
      for (var i = 0; i < all.length; i++)
        fn(all[i]);
    },
    // This function calls the given function for every attribute
    // in the given DOM node, as well as for every attribute in all
    // its children.
    eachAttr: function eachAttr(node, fn) {
      var i;
      if (node.attributes)
        for (i = 0; i < node.attributes.length; i++)
          fn(node.attributes[i]);
      for (i = 0; i < node.childNodes.length; i++)
        if (node.childNodes[i].nodeType == node.ELEMENT_NODE)
          eachAttr(node.childNodes[i], fn);
    }
  };
  
  var TreeInspectors = {
    // We export our utility functions in case any other scripts want
    // to extend the `TreeInspectors` object with more inspectors.
    utils: utils,
    // ## Finding JavaScript Usage
    //
    // Given a document fragment, this function finds all occurrences
    // of the most common kinds of JavaScript use in it and returns
    // an array containing `{type, node}` objects that describe each
    // use of JavaScript.
    findJS: function(doc) {
      var js = [];
      
      // We want to find `script` elements.
      utils.each(doc, "script", function(script) {
        js.push({type: "SCRIPT_ELEMENT", node: script});
      });
      
      utils.eachAttr(doc, function(attr) {
        // If the attribute name begins with `on`, we can safely assume
        // it's an event handler attribute. We can change this in the
        // future if there are valid non-event-handler attributes that
        // start with `on`.
        if (attr.nodeName.match(/^on/i))
          js.push({type: "EVENT_HANDLER_ATTR", node: attr});
          
        // If the attribute value starts with `javascript:`, regardless
        // of the attribute name, raise an error. We can change this in
        // the future if we only want to make this check on specific
        // attributes.
        if (attr.nodeValue.match(/^javascript:/i))
          js.push({type: "JAVASCRIPT_URL", node: attr});
      });
      
      return js;
    },
    // This is a Slowparse error detector that returns an error object
    // if the given document fragment contains any JS.
    forbidJS: function(html, doc) {
      var js = TreeInspectors.findJS(doc);
      if (!js.length)
        return null;
      var error = JSON.parse(JSON.stringify(js[0].node.parseInfo));
      error.type = js[0].type + "_NOT_ALLOWED";
      return error;
    }
  };
  
  if (typeof(define) == "function") {
    define(function() { return TreeInspectors; });
  } else
    return TreeInspectors;
})();
