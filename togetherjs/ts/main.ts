//import type { EventHtmlElement, TogetherJSNS } from "./types/togetherjs";

const requireConfig = {
    context: "togetherjs",
    baseUrl: "./",
    urlArgs: "bust=" + Date.now().toString(),
    paths: {
        jquery: "libs/jquery-1.11.1.min",
        "jquery-private": "libs/jquery-private",
        walkabout: "libs/walkabout/walkabout",
        esprima: "libs/walkabout/lib/esprima",
        falafel: "libs/walkabout/lib/falafel",
        whrandom: "libs/whrandom/random"
    },
    map: {
        '*': { 'jquery': 'jquery-private' },
        'jquery-private': { 'jquery': 'jquery' }
    }
};

require.config(requireConfig);
/*
require(["../libs/jquery-1.11.1.min"])
require(["../main.js"])
tjs.TogetherJS.start()
*/

var tjs;
/**/
//require(["require", "exports"], () => {
    //require(["../init.js"], () => {
        require(["../libs/jquery-1.11.1.min", '../togetherjs'], function(jq: JQueryStatic, a: typeof import("./togetherjs")) {
            //main is loaded, probably don't need to do anything here..
            console.log("========== require togetherjs loaded", a);
            //a.TogetherJS.start()
            tjs = a;
            tjs.TogetherJS.start();
            //starttjs(a.TogetherJS, document.documentElement);
        });
    //});
//});
/**/
