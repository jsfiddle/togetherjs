/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["util", "jquery"], function(util: Util, $: JQueryStatic) {
    let assert = util.assert;

    class ElementFinder {
        public ignoreElement(element: HTMLElement) {
            let el: HTMLElement | null = element;
            while(el) {
                if($(el).hasClass("togetherjs")) {
                    return true;
                }
                el = el.parentElement;
            }
            return false;
        }

        public elementLocation(el: HTMLElement): string {
            if(el === document.documentElement) {
                return "document";
            }
            if(el.id) {
                return "#" + el.id;
            }
            if(el.tagName == "BODY") {
                return "body";
            }
            if(el.tagName == "HEAD") {
                return "head";
            }
            let parent = el.parentElement;
            if((!parent) || parent == el) {
                console.warn("elementLocation(", el, ") has null parent");
                throw new Error("No locatable parent found");
            }
            let parentLocation = this.elementLocation(parent);
            let children = parent.children;
            let _len = children.length;
            let index = 0;
            for(let i = 0; i < _len; i++) {
                if(children[i] == el) {
                    break;
                }
                if(children[i].nodeType == document.ELEMENT_NODE) {
                    if(children[i].className.indexOf("togetherjs") != -1) {
                        // Don't count our UI
                        continue;
                    }
                    // Don't count text or comments
                    index++;
                }
            }
            return parentLocation + ":nth-child(" + (index + 1) + ")";
        }

        public CannotFind = class CannotFind {
            public prefix;
            constructor(
                private location: string,
                private reason: string,
                private context: Element
            ) {
                this.prefix = "";
            }
        }

        public findElement(loc: string, container?: Element): Element {
            // FIXME: should this all just be done with document.querySelector()?
            // But no!  We can't ignore togetherjs elements with querySelector.
            // But maybe!  We *could* make togetherjs elements less obtrusive?
            container = container || document.documentElement;
            let el : Element | null = null;
            let rest: string;
            if(loc === "body") {
                return document.body;
            }
            else if(loc === "head") {
                return document.head;
            }
            else if(loc === "document") {
                return document.documentElement;
            }
            else if(loc.indexOf("body") === 0) {
                el = document.body;
                try {
                    return this.findElement(loc.substr(("body").length), el);
                }
                catch(e) {
                    if(e instanceof this.CannotFind) {
                        e.prefix = "body" + e.prefix;
                    }
                    throw e;
                }
            }
            else if(loc.indexOf("head") === 0) {
                el = document.head;
                try {
                    return this.findElement(loc.substr(("head").length), el);
                }
                catch(e) {
                    if(e instanceof this.CannotFind) {
                        e.prefix = "head" + e.prefix;
                    }
                    throw e;
                }
            }
            else if(loc.indexOf("#") === 0) {
                let id;
                loc = loc.substr(1);
                if(loc.indexOf(":") === -1) {
                    id = loc;
                    rest = "";
                }
                else {
                    id = loc.substr(0, loc.indexOf(":"));
                    rest = loc.substr(loc.indexOf(":"));
                }
                el = document.getElementById(id);
                if(!el) {
                    throw new this.CannotFind("#" + id, "No element by that id", container);
                }
                if(rest) {
                    try {
                        return this.findElement(rest, el);
                    }
                    catch(e) {
                        if(e instanceof this.CannotFind) {
                            e.prefix = "#" + id + e.prefix;
                        }
                        throw e;
                    }
                }
                else {
                    return el;
                }
            }
            else if(loc.indexOf(":nth-child(") === 0) {
                loc = loc.substr((":nth-child(").length);
                if(loc.indexOf(")") == -1) {
                    throw "Invalid location, missing ): " + loc;
                }
                let num = parseInt(loc.substr(0, loc.indexOf(")")), 10);

                let count = num;
                loc = loc.substr(loc.indexOf(")") + 1);
                let children = container.children;
                el = null;
                for(let i = 0; i < children.length; i++) {
                    let child = children[i];
                    if(child.nodeType == document.ELEMENT_NODE) {
                        if(child.className.indexOf("togetherjs") != -1) {
                            continue;
                        }
                        count--;
                        if(count === 0) {
                            // this is the element
                            el = child;
                            break;
                        }
                    }
                }
                if(!el) {
                    throw new this.CannotFind(":nth-child(" + num + ")", "container only has " + (num - count) + " elements", container);
                }
                if(loc) {
                    try {
                        return this.findElement(loc, el);
                    }
                    catch(e) {
                        if(e instanceof this.CannotFind) {
                            e.prefix = ":nth-child(" + num + ")" + e.prefix;
                        }
                        throw e;
                    }
                }
                else {
                    return el;
                }
            }
            else {
                throw new this.CannotFind(loc, "Malformed location", container);
            }
        }

        public elementByPixel(height: number): TogetherJS.ElementFinder.Position {
            /* Returns {location: "...", offset: pixels}
        
               To get the pixel position back, you'd do:
                 $(location).offset().top + offset
            */
            const self = this;
            function search(start: JQuery, height: number): TogetherJS.ElementFinder.Position {
                let last = null;
                let children = start.children();
                children.each(function() {
                    let el = $(self);
                    if(el.hasClass("togetherjs") || el.css("position") == "fixed" || !el.is(":visible")) {
                        return;
                    }
                    const offset = el.offset();
                    if(offset && offset.top > height) {
                        return false;
                    }
                    last = el;
                    return;
                });
                if((!children.length) || (!last)) {
                    // There are no children, or only inapplicable children
                    const offset = start.offset();
                    return {
                        location: self.elementLocation(start[0]),
                        offset: height - offset!.top,
                        absoluteTop: height,
                        documentHeight: $(document).height()
                    }
                }
                return search(last, height);
            }
            return search($(document.body), height);
        }

        public pixelForPosition(position: TogetherJS.ElementFinder.Position) {
            /* Inverse of elementFinder.elementByPixel */
            if(position.location == "body") {
                return position.offset;
            }
            let el: Element;
            try {
                el = this.findElement(position.location);
            }
            catch(e) {
                if(e instanceof this.CannotFind && position.absoluteTop) {
                    // We don't trust absoluteTop to be quite right locally, so we adjust
                    // for the total document height differences:
                    let percent = position.absoluteTop / position.documentHeight;
                    return $(document).height() * percent;
                }
                throw e;
            }
            let top = $(el).offset()?.top || 0;
            // FIXME: maybe here we should test for sanity, like if an element is
            // hidden.  We can use position.absoluteTop to get a sense of where the
            // element roughly should be.  If the sanity check failed we'd use
            // absoluteTop
            return top + position.offset;
        }
    }

    return new ElementFinder();

});
