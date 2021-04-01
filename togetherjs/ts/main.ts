import type { EventHtmlElement, TogetherJSNS } from "./types/togetherjs";

let min = false;
const baseUrl = "../../../";
let cacheBust = Date.now() + "";
let styleSheet = "/togetherjs/togetherjs.css";

function addScriptInner(url: string) {
    var script = document.createElement("script");
    script.src = baseUrl + url + (cacheBust ? ("?bust=" + cacheBust) : '');
    document.head.appendChild(script);
}

function clone<T>(o: T): T {
    return extend(o as any) as unknown as T; // TODO all those casts!!!!!
}

/** Can also be used to clone an object */
function extend(base: { [key: string]: unknown }, extensions?: any) {
    if(!extensions) {
        extensions = base;
        base = {};
    }
    for(let a in extensions) {
        if(extensions.hasOwnProperty(a)) {
            base[a] = extensions[a];
        }
    }
    return base;
}

function addStyle() {
    var existing = document.getElementById("togetherjs-stylesheet");
    if(!existing) {
        var link = document.createElement("link");
        link.id = "togetherjs-stylesheet";
        link.setAttribute("rel", "stylesheet");
        link.href = baseUrl + styleSheet + (cacheBust ? ("?bust=" + cacheBust) : '');
        document.head.appendChild(link);
    }
}

function starttjs(tjs: TogetherJSNS.TogetherJSClass, event?: EventHtmlElement | HTMLElement | HTMLElement[]) {
    let session;
    if(tjs.running) {
        session = tjs.require("session");
        session.close();
        return;
    }

    try {
        if(event && typeof event == "object") {
            if("target" in event && event.target && typeof event) {
                tjs.startup.button = event.target;
            }
            else if("nodeType" in event && event.nodeType == 1) {
                tjs.startup.button = event;
            }
            else if(Array.isArray(event) && event[0] && event[0].nodeType == 1) {
                // TODO What?
                // Probably a jQuery element
                tjs.startup.button = event[0];
            }
        }
    }
    catch(e) {
        console.warn("Error determining starting button:", e);
    }
    if(window.TowTruckConfig) {
        console.warn("TowTruckConfig is deprecated; please use TogetherJSConfig");
        if(window.TogetherJSConfig) {
            console.warn("Ignoring TowTruckConfig in favor of TogetherJSConfig");
        }
        else {
            window.TogetherJSConfig = window.TowTruckConfig;
        }
    }
    if(window.TogetherJSConfig && (!window.TogetherJSConfig.loaded)) {
        tjs.config(window.TogetherJSConfig);
        window.TogetherJSConfig.loaded = true;
    }

    // This handles loading configuration from global variables.  This
    // includes TogetherJSConfig_on_*, which are attributes folded into
    // the "on" configuration value.
    let attr;
    let attrName: keyof TogetherJSNS.Config;
    let globalOns: TogetherJSNS.Ons<unknown> = {};
    for(attr in window) {
        if(attr.indexOf("TogetherJSConfig_on_") === 0) {
            attrName = attr.substr(("TogetherJSConfig_on_").length) as keyof TogetherJSNS.Config;
            globalOns[attrName] = window[attr] as unknown as TogetherJSNS.CallbackForOn<unknown>;
        }
        else if(attr.indexOf("TogetherJSConfig_") === 0) {
            attrName = attr.substr(("TogetherJSConfig_").length) as keyof TogetherJSNS.Config;
            tjs.config(attrName, window[attr]);
        }
        else if(attr.indexOf("TowTruckConfig_on_") === 0) {
            attrName = attr.substr(("TowTruckConfig_on_").length) as keyof TogetherJSNS.Config;
            console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to TogetherJSConfig_on_" + attrName);
            globalOns[attrName] = window[attr] as unknown as TogetherJSNS.CallbackForOn<unknown>;
        }
        else if(attr.indexOf("TowTruckConfig_") === 0) {
            attrName = attr.substr(("TowTruckConfig_").length) as keyof TogetherJSNS.Config;
            console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to TogetherJSConfig_" + attrName);
            tjs.config(attrName, window[attr]);
        }
    }
    // FIXME: copy existing config?
    // FIXME: do this directly in tjs.config() ?
    // FIXME: close these configs?
    let ons: TogetherJSNS.Ons<unknown> = tjs.config.get("on") || {};
    for(attr in globalOns) {
        if(globalOns.hasOwnProperty(attr)) {
            // FIXME: should we avoid overwriting?  Maybe use arrays?
            ons[attr] = globalOns[attr];
        }
    }
    tjs.config("on", ons);
    for(attr in ons) {
        tjs.on(attr as keyof TogetherJSNS.On.Map, ons[attr]); // TODO check cast
    }
    let hubOns = tjs.config.get("hub_on");
    if(hubOns) {
        for(attr in hubOns) {
            if(hubOns.hasOwnProperty(attr)) {
                tjs.hub.on(attr as keyof TogetherJSNS.On.Map, hubOns[attr]); // TODO check cast
            }
        }
    }
    if(!tjs.config.close('cacheBust')) {
        cacheBust = '';
        delete tjs.requireConfig.urlArgs;
    }

    if(!tjs.startup.reason) {
        // Then a call to TogetherJS() from a button must be started TogetherJS
        tjs.startup.reason = "started";
    }

    // FIXME: maybe I should just test for tjs.require:
    if(tjs._loaded) {
        session = tjs.require("session");
        addStyle();
        session.start();
        return;
    }
    // A sort of signal to session.js to tell it to actually
    // start itself (i.e., put up a UI and try to activate)
    tjs.startup._launch = true;

    addStyle();
    let minSetting = tjs.config.get("useMinimizedCode");
    tjs.config.close("useMinimizedCode");
    if(minSetting !== undefined) {
        min = !!minSetting;
    }
    let requireConfig: RequireConfig = clone(tjs.requireConfig);
    let deps = ["session", "jquery"];
    let lang = tjs.getConfig("lang");
    // [igoryen]: We should generate this value in Gruntfile.js, based on the available translations
    let availableTranslations = {
        "en-US": true,
        "en": "en-US",
        "es": "es-BO",
        "es-BO": true,
        "ru": true,
        "ru-RU": "ru",
        "pl": "pl-PL",
        "pl-PL": true,
        "de-DE": true,
        "de": "de-DE"
    };

    if(!lang) {
        // BCP 47 mandates hyphens, not underscores, to separate lang parts
        lang = navigator.language.replace(/_/g, "-");
    }

    // TODO check if the updates of those conditions is right
    // if(/-/.test(lang) && !availableTranslations[lang]) {
    if(/-/.test(lang) && (!("lang" in availableTranslations) || !availableTranslations[lang])) {
        lang = lang.replace(/-.*$/, '');
    }
    // if(!availableTranslations[lang]) {
    if(!("lang" in availableTranslations) || !availableTranslations[lang]) {
        lang = tjs.config.get("fallbackLang");
    }
    // else if(availableTranslations[lang] !== true) {
    else if(availableTranslations[lang] !== true) {
        lang = availableTranslations[lang];
    }
    tjs.config("lang", lang);

    let localeTemplates = "templates-" + lang;
    deps.splice(0, 0, localeTemplates);
    const callback = (_session: TogetherJSNS.Session, _jquery: JQuery) => {
        tjs._loaded = true;
        if(!min) {
            tjs.require = require.config({ context: "togetherjs" });
            tjs._requireObject = require;
        }
    }
    if(!min) {
        if(typeof require == "function") {
            if(!require.config) {
                console.warn("The global require (", require, ") is not requirejs; please use togetherjs-min.js");
                //throw new Error("Conflict with window.require");
            }
            tjs.require = require.config(requireConfig);
        }
    }
    if(typeof tjs.require == "function") {
        // This is an already-configured version of require
        tjs.require(deps, callback);
    }
    else {
        requireConfig.deps = deps;
        requireConfig.callback = callback;
        if(!min) {
            // TODO I really don't know what happens here... note that this is only executed if !min which means that at some point addScriptInner("/togetherjs/libs/require.js"); (see below) will be executed
            //@ts-expect-error weird stuff
            window.require = requireConfig;
        }
    }
    if(min) {
        addScriptInner("/togetherjs/togetherjsPackage.js");
    }
    else {
        addScriptInner("/togetherjs/libs/require.js");
    }
}

/**/
//require(["require", "exports"], () => {
    //require(["../init.js"], () => {
        require(['../togetherjs'], function(a: typeof import("./togetherjs")) {
            //main is loaded, probably don't need to do anything here..
            console.log("========== require togetherjs loaded", a);
            //a.TogetherJS.start()
            starttjs(a.TogetherJS, document.documentElement);
        });
    //});
//});
/**/
