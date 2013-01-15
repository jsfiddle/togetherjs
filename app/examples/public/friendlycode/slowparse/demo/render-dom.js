(function(jQuery) {
  "use strict";
  
  var $ = jQuery;

  function makeAttributeList(node) {
    var attribs = $('<ul class="attributes"></ul>');
    for (var i = 0; i < node.attributes.length; i++) {
      var attr = node.attributes[i];
      var name = $('<div class="name"></div>').text(attr.name);
      var value = $('<div class="value"></div>').text(attr.value);
      name.data("linked-node", attr);
      value.data("linked-node", attr);
      attribs.append($('<li></li>').append(name).append(value));
    }
    return attribs;
  }
  
  function renderTextNode(node) {
    var div = $('<div class="text"></div>');
    div.text(node.nodeValue);
    div.data("linked-node", node);
    return div;
  }
  
  function renderElement(node) {
    node = $(node).get(0);
    
    var rendered = $('<div class="element"></div>');
    var start = $('<div class="start"></div>');
    var name = $('<div class="name"></div>');
    if ($(node).isVoidElement())
      rendered.addClass("is-void");
    name.text(node.nodeName.toLowerCase());
    start.append(name);
    var attribs = makeAttributeList(node);
    if (attribs.children().length)
      start.append(attribs);
    rendered.append(start);
    var children = $('<ul class="children"></ul>');
    $(node).contents().each(function() {
      var item = $('<li></li>');
      switch (this.nodeType) {
        case this.TEXT_NODE:
        if (jQuery.trim(this.nodeValue).length) {
          item.append(renderTextNode(this));
          children.append(item);
        }
        break;
        
        case this.ELEMENT_NODE:
        item.append(renderElement(this));
        children.append(item);
        break;

        // TODO: What about other node types?
      }
    });
    if (children.children().length) {
      var end = $('<div class="end"></div>').append(name.clone());
      rendered.append(children).append(end);
    }
    rendered.addClass('tag-' + jQuery.colorForTag(name.text()).slice(1));
    rendered.applyTagColor(node, 0.33);
    rendered.data("linked-node", node);
    return rendered;
  }
    
  jQuery.fn.extend({
    renderDom: function renderDom() {
      return renderElement(this);
    }
  });
})(jQuery);
