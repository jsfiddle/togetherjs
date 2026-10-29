var fixture = document.getElementById("fixture");
var modal = document.getElementById("modal");
var underlay = document.getElementById("underlay");

Walkabout.addEventListener(underlay, function (event) {
  print("clicked");
}, false);

function show(el) {
  el.style.display = "";
}

function hide(el) {
  el.style.display = "none";
}

print(Walkabout.visible(modal));
print(Walkabout.visible(underlay));
print(Walkabout.clickable(underlay));
hide(modal);
print(Walkabout.visible(modal));
show(modal);

/* =>
true
true
true
false
*/

hide(underlay);
print(Walkabout.clickable(underlay));
show(underlay);

// => false

modal.style.position = "absolute";
modal.style.width = "100px";
modal.style.height = "100px";
modal.style.top = "0px";
modal.style.right = "0px";
modal.style.zIndex = 10;
underlay.style.position = "absolute";
underlay.style.width = "90px";
underlay.style.height = "90px";
underlay.style.top = "5px";
underlay.style.right = "5px";
underlay.style.zIndex = 5;

print(getComputedStyle(modal).getPropertyValue("position"));

// => absolute

var rect = modal.getBoundingClientRect();

print(rect.bottom, rect.top, rect.height);
print(rect.left, rect.right, rect.width);

/* =>
100 0 100
? ? 100
*/

print(Walkabout.clickable(underlay));

// => false

underlay.style.zIndex = 15;
print(Walkabout.clickable(underlay));

// => true

underlay.style.zIndex = 5;
underlay.style.right = "20px";
print(Walkabout.clickable(underlay));

// => true
