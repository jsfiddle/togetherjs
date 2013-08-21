"use strict";

// gutterPointer(codeMirror, highlightClass)
//
// This function creates and returns an SVG shape that looks like this:
//
//   --\
//   |  \
//   |  /
//   --/
// 
// It also puts the shape between the gutter and the content of a
// CodeMirror line. The shape will be vertically stretched to take up the
// entire height of the line.
//
// The shape is given the class gutter-pointer, as well as the same
// class as the highlightClass argument.
//
// Arguments:
// 
//   codeMirror: The CodeMirror instance to apply the pointer to.
//
//   highlightClass: The class name used to "highlight" the desired
//     gutter line via CodeMirror.setMarker().
//
// This function makes some assumptions about the way CodeMirror works,
// as well as the styling applied to the CodeMirror instance, but we
// try where possible to use methods and CSS classes documented in
// the CodeMirror manual at http://codemirror.net/doc/manual.html.

define(["jquery"], function($) {
  var SVG_NS = "http://www.w3.org/2000/svg";
  
  function attrs(element, attributes) {
    for (var name in attributes)
      element.setAttribute(name, attributes[name].toString());
  }
  
  return function gutterPointer(codeMirror, highlightClass) {    
    var wrapper = $(codeMirror.getWrapperElement());
    var highlight = $(".CodeMirror-gutter-text ." + highlightClass, wrapper);
    var svg = document.createElementNS(SVG_NS, "svg");
    var pointer = document.createElementNS(SVG_NS, "polygon");
    var w = ($(".CodeMirror-gutter", wrapper).outerWidth() -
             highlight.width()) * 2;
    var h = highlight[0].getBoundingClientRect().height;
    var pos = highlight.position();
    
    pos.left += highlight.width();
    attrs(svg, {
      'class': "gutter-pointer " + highlightClass,
      viewBox: [0, 0, w, h].join(" ")
    });
    attrs(pointer, {
      points: [
        "0,0",
        (w/2) + ",0",
        w + "," + (h/2),
        (w/2) + "," + h,
        "0," + h
      ].join(" ")
    });
    svg.appendChild(pointer);
    $(svg).css({
      position: 'absolute',
      width: w + "px",
      height: h + "px",
      top: pos.top + "px",
      left: pos.left + "px"
    });

    $(".CodeMirror-scroll", wrapper).append(svg);
    
    return $(svg);
  };
});
