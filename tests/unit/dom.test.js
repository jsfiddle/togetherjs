/* The DOM helper replaces jQuery across the whole client, so it carries the
   weight of ~500 call sites. These tests pin the behaviours those call sites
   depend on — especially the ones where jQuery's semantics are surprising
   (attr returning undefined, return-false handlers, .end(), .data()). */

import { describe, it, expect, beforeEach, vi } from "vitest";
import $ from "../../src/dom/dom.js";

const FIXTURE = `
  <div id="root" class="a b">
    <p class="one">first</p>
    <p class="two">second <span id="nested">deep</span></p>
    <ul id="list"><li>a</li><li>b</li><li>c</li></ul>
    <input id="text-input" type="text" value="hello">
    <input id="check" type="checkbox" checked>
    <select id="sel"><option value="x">x</option><option value="y" selected>y</option></select>
    <div id="hidden" style="display: none">hidden</div>
  </div>
`;

beforeEach(() => {
  document.body.innerHTML = FIXTURE;
});

describe("selection", () => {
  it("selects by CSS selector", () => {
    expect($("#root").length).toBe(1);
    expect($("li").length).toBe(3);
  });

  it("wraps an element", () => {
    expect($(document.getElementById("root"))[0].id).toBe("root");
  });

  it("parses markup", () => {
    const el = $("<span class='made'>hi</span>");
    expect(el.length).toBe(1);
    expect(el[0].className).toBe("made");
  });

  it("scopes with a context argument", () => {
    expect($("li", "#list").length).toBe(3);
  });

  it("gives an empty list for no match", () => {
    expect($("#nothing").length).toBe(0);
    expect($("#nothing")[0]).toBeUndefined();
  });

  it("supports indexed access and .get()", () => {
    expect($("li").get(0).textContent).toBe("a");
    expect($("li").get(-1).textContent).toBe("c");
    expect($("li")[1].textContent).toBe("b");
    expect($("li").get().length).toBe(3);
  });
});

describe("traversal", () => {
  it("finds descendants without duplicates", () => {
    expect($("#root").find("p").length).toBe(2);
    expect($("p").find("span").length).toBe(1);
  });

  it("restores the previous set with .end()", () => {
    const result = $("#root").find("p").end();
    expect(result[0].id).toBe("root");
  });

  it("filters by selector and by function", () => {
    expect($("p").filter(".one").length).toBe(1);
    expect($("li").filter((i) => i > 0).length).toBe(2);
  });

  it("tests membership with .is()", () => {
    expect($("#root").is(".a")).toBe(true);
    expect($("#root").is(".zzz")).toBe(false);
  });

  it("reports visibility with :visible and :hidden", () => {
    // jsdom has no layout, so offsetWidth is always 0; only the inline
    // display:none case is meaningfully testable here.
    expect($("#hidden").is(":hidden")).toBe(true);
  });

  it("walks up with .closest() and .parent()", () => {
    expect($("#nested").closest("p")[0].className).toBe("two");
    expect($("#nested").parent()[0].className).toBe("two");
  });

  it("collects children and siblings", () => {
    expect($("#list").children().length).toBe(3);
    expect($("#list").children().first().siblings().length).toBe(2);
  });

  it("unions with .add() and skips duplicates", () => {
    expect($(".one").add(".two").length).toBe(2);
    expect($(".one").add(".one").length).toBe(1);
  });
});

describe("classes and attributes", () => {
  it("adds, removes and tests classes", () => {
    const el = $("#root");
    el.addClass("c d");
    expect(el.hasClass("c")).toBe(true);
    el.removeClass("c");
    expect(el.hasClass("c")).toBe(false);
    el.toggleClass("e");
    expect(el.hasClass("e")).toBe(true);
  });

  it("returns undefined, not null, for a missing attribute", () => {
    // The client relies on this: `if (el.attr("data-toggles"))`.
    expect($("#root").attr("data-nope")).toBeUndefined();
  });

  it("reads and writes attributes", () => {
    $("#root").attr("data-x", "1");
    expect($("#root").attr("data-x")).toBe("1");
    $("#root").attr({ "data-y": "2", "data-z": "3" });
    expect($("#root").attr("data-z")).toBe("3");
  });

  it("removes an attribute when set to null", () => {
    $("#root").attr("data-x", "1").attr("data-x", null);
    expect($("#root").attr("data-x")).toBeUndefined();
  });

  it("reads and writes properties", () => {
    expect($("#check").prop("checked")).toBe(true);
    $("#check").prop("checked", false);
    expect($("#check")[0].checked).toBe(false);
  });

  it("stores arbitrary values with .data()", () => {
    const value = { nested: true };
    $("#root").data("thing", value);
    // Non-string values must round-trip identically.
    expect($("#root").data("thing")).toBe(value);
    $("#root").removeData("thing");
    expect($("#root").data("thing")).toBeUndefined();
  });

  it("falls back to data-* attributes", () => {
    $("#root").attr("data-from-markup", "yes");
    expect($("#root").data("from-markup")).toBe("yes");
  });
});

describe("content", () => {
  it("reads and writes text", () => {
    expect($(".one").text()).toBe("first");
    $(".one").text("changed");
    expect($(".one")[0].textContent).toBe("changed");
  });

  it("concatenates text across a set", () => {
    expect($("#list").find("li").text()).toBe("abc");
  });

  it("reads and writes values", () => {
    expect($("#text-input").val()).toBe("hello");
    $("#text-input").val("bye");
    expect($("#text-input")[0].value).toBe("bye");
  });

  it("treats checkbox values as checked state", () => {
    expect($("#check").val()).toBe(true);
    $("#check").val(false);
    expect($("#check")[0].checked).toBe(false);
  });
});

describe("manipulation", () => {
  it("appends and removes", () => {
    $("#list").append("<li>d</li>");
    expect($("#list li").length).toBe(4);
    $("#list li").last().remove();
    expect($("#list li").length).toBe(3);
  });

  it("prepends in order", () => {
    $("#list").prepend("<li>z</li>");
    expect($("#list li").first().text()).toBe("z");
  });

  it("inserts before a reference node", () => {
    $("<li>new</li>").insertBefore($("#list li").eq(1));
    expect(
      $("#list li")
        .toArray()
        .map((el) => el.textContent),
    ).toEqual(["a", "new", "b", "c"]);
  });

  it("empties a container", () => {
    $("#list").empty();
    expect($("#list").children().length).toBe(0);
  });

  it("clones deeply without sharing nodes", () => {
    const copy = $("#list").clone();
    expect(copy[0]).not.toBe($("#list")[0]);
    expect(copy.find("li").length).toBe(3);
  });

  it("replaces a node", () => {
    $(".one").replaceWith("<p class='replaced'>x</p>");
    expect($(".one").length).toBe(0);
    expect($(".replaced").length).toBe(1);
  });
});

describe("style", () => {
  it("adds px to numeric values but not unitless properties", () => {
    $("#root").css("width", 100);
    expect($("#root")[0].style.width).toBe("100px");
    $("#root").css("opacity", 0.5);
    expect($("#root")[0].style.opacity).toBe("0.5");
  });

  it("accepts an object and camelCases hyphenated names", () => {
    $("#root").css({ "background-color": "red", zIndex: 5 });
    expect($("#root")[0].style.backgroundColor).toBe("red");
    expect($("#root")[0].style.zIndex).toBe("5");
  });

  it("hides and shows", () => {
    const el = $(".one");
    el.hide();
    expect(el[0].style.display).toBe("none");
    el.show();
    expect(el[0].style.display).not.toBe("none");
  });
});

describe("events", () => {
  it("binds and fires", () => {
    const spy = vi.fn();
    $("#root").on("click", spy);
    $("#root")[0].click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("unbinds with .off()", () => {
    const spy = vi.fn();
    const el = $("#root");
    el.on("click", spy);
    el.off("click", spy);
    el[0].click();
    expect(spy).not.toHaveBeenCalled();
  });

  it("unbinds every handler for a type when none is named", () => {
    const a = vi.fn();
    const b = vi.fn();
    const el = $("#root");
    el.on("click", a).on("click", b);
    el.off("click");
    el[0].click();
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("delegates to descendants matching a selector", () => {
    const spy = vi.fn();
    $("#list").on("click", "li", spy);
    $("#list li")[1].click();
    expect(spy).toHaveBeenCalledTimes(1);
    // The handler's `this` is the delegate target, not the bound element.
    expect(spy.mock.instances[0].textContent).toBe("b");
  });

  it("treats a false return as preventDefault + stopPropagation", () => {
    const outer = vi.fn();
    $("#root").on("click", outer);
    $(".one").on("click", () => false);
    $(".one")[0].click();
    expect(outer).not.toHaveBeenCalled();
  });

  it("binds multiple types at once", () => {
    const spy = vi.fn();
    $("#root").on("click keydown", spy);
    $("#root")[0].click();
    $("#root")[0].dispatchEvent(new Event("keydown"));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("fires once with .one()", () => {
    const spy = vi.fn();
    $("#root").one("click", spy);
    $("#root")[0].click();
    $("#root")[0].click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("supports the .click(fn) shorthand and .click() to fire", () => {
    const spy = vi.fn();
    $("#root").click(spy);
    $("#root").click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("runs a $(fn) ready callback asynchronously", async () => {
    const spy = vi.fn();
    $(spy);
    expect(spy).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(spy).toHaveBeenCalled();
  });
});
