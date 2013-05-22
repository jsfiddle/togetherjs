function contentsOnLoad() {
    if (contentsOnLoad.hasRun) {
      return;
    }
    contentsOnLoad.hasRun = true;
    var dest = document.getElementById('contents');
    var toc = [document.createElement('ul')];
    var generatedIds = [];
    dest.appendChild(toc[0]);
    var els = document.querySelectorAll('h3, h4, h5, h6');
    for (var i=0; i<els.length; i++) {
        var el = els[i];
        if (el.className.indexOf('no-toc') != -1) {
          continue;
        }
        var elDepth = ['H3', 'H4', 'H5', 'H6'].indexOf(el.tagName);
        while (elDepth < toc.length-1) {
          toc.splice(toc.length-1, 1);
        }
        while (elDepth >= toc.length) {
          var ul = document.createElement('ul');
          var container = document.createElement('li');
          container.appendChild(ul);
          toc[toc.length-1].appendChild(container);
          toc.push(ul);
        }
        var name = el.getAttribute('id');
        if (! name) {
          name = 'header-'+(i+1);
          generatedIds.push(name);
          el.setAttribute('id', name);
        }
        var li = document.createElement('li');
        var anchor = document.createElement('a');
        if (el.getAttribute('href')) {
          anchor.setAttribute('href', el.getAttribute('href'));
          el.style.display = 'none';
        } else {
          anchor.setAttribute('href', '#'+name);
        }
        li.appendChild(anchor);
        anchor.innerHTML = el.innerHTML;
        toc[toc.length-1].appendChild(li);
    }
    // Re-scroll:
    if (location.hash && generatedIds.indexOf(location.hash.substr(1)) != -1) {
      location.hash = location.hash;
    }
}

document.addEventListener("DOMContentLoaded", contentsOnLoad, false);
window.addEventListener("load", contentsOnLoad, false);
