Test.require("elementFinder");
// => Loaded modules: ...

var els = $(document.body).find("*");
els.each(function (index, el) {
  el = $(el);
  var loc;
  try {
    loc = elementFinder.elementLocation(el);
  } catch (e) {
    console.trace();
    print("Error: cannot get location for", el, ":", e);
    return;
  }
  var result = elementFinder.findElement(loc);
  if (result != el[0]) {
    print("Bad element:", loc, el);
    print("Resolved to:", result);
  } else {
    console.log("Resolved element", loc, el);
  }
});
print("done.");

// => done.
