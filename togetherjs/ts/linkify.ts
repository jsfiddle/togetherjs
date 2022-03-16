// FIXME: this could be moved to a different module, it's pretty stand-alone
/* Finds any links in the text of an element (or its children) and turns them into anchors (with target=_blank) */

export function linkify(el: JQuery | Node): Node {
    if("jquery" in el) {
        el = el[0];
    }
    el.normalize();
    function linkifyNode(node: Node) {
        const _len = node.childNodes.length;
        for(let i = 0; i < _len; i++) {
            if(node.childNodes[i].nodeType == document.ELEMENT_NODE) {
                linkifyNode(node.childNodes[i]);
            }
        }
        const texts: Node[] = [];
        for(let i = 0; i < _len; i++) {
            if(node.childNodes[i].nodeType == document.TEXT_NODE) {
                texts.push(node.childNodes[i]);
            }
        }
        texts.forEach(function(item: Node) {
            if(item.nodeType == document.ELEMENT_NODE) {
                linkifyNode(item);
            }
            else if(item.nodeType == document.TEXT_NODE) {
                // eslint-disable-next-line no-constant-condition
                while(true) {
                    const text = item.nodeValue;
                    if(text == null) {
                        continue;
                    }
                    const regex = /\bhttps?:\/\/[a-z0-9.\-_](:\d+)?[^ \n\t<>()[\]]*/i;
                    const match = regex.exec(text);
                    if(!match) {
                        break;
                    }
                    const leadingNode = document.createTextNode(text.substr(0, match.index));
                    node.replaceChild(leadingNode, item);
                    const anchor = document.createElement("a");
                    anchor.setAttribute("target", "_blank");
                    anchor.href = match[0];
                    anchor.appendChild(document.createTextNode(match[0]));
                    node.insertBefore(anchor, leadingNode.nextSibling);
                    const trailing = document.createTextNode(text.substr(match.index + match[0].length));
                    node.insertBefore(trailing, anchor.nextSibling);
                    item = trailing;
                }
            }
        });
    }
    linkifyNode(el);
    return el;
}
