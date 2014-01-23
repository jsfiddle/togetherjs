define([], function () {
  // FIXME: this could be moved to a different module, it's pretty stand-alone
  /* Finds any links in the text of an element (or its children) and turns them
     into anchors (with target=_blank) */
  function linkify(el) {
    if (el.jquery) {
      el = el[0];
    }
    el.normalize();
    function linkifyNode(node) {
      var _len = node.childNodes.length;
      for (var i=0; i<_len; i++) {
        if (node.childNodes[i].nodeType == document.ELEMENT_NODE) {
          linkifyNode(node.childNodes[i]);
        }
      }
      var texts = [];
      for (i=0; i<_len; i++) {
        if (node.childNodes[i].nodeType == document.TEXT_NODE) {
          texts.push(node.childNodes[i]);
        }
      }
      texts.forEach(function (item) {
        if (item.nodeType == document.ELEMENT_NODE) {
          linkifyNode(item);
        } else if (item.nodeType == document.TEXT_NODE) {
          while (true) {
            var text = item.nodeValue;
            var regex = /\bhttps?:\/\/[a-z0-9\.\-_](:\d+)?[^ \n\t<>()\[\]]*/i;
            var match = regex.exec(text);
            if (! match) {
              break;
            }
            var leadingNode = document.createTextNode(text.substr(0, match.index));
            node.replaceChild(leadingNode, item);
            var anchor = document.createElement("a");
            anchor.setAttribute("target", "_blank");
            anchor.href = match[0];
            anchor.appendChild(document.createTextNode(match[0]));
            node.insertBefore(anchor, leadingNode.nextSibling);
            var trailing = document.createTextNode(text.substr(match.index + match[0].length));
            node.insertBefore(trailing, anchor.nextSibling);
            item = trailing;
          }
        }
      });
    }
    linkifyNode(el);
    return el;
  }

  return linkify;
});
