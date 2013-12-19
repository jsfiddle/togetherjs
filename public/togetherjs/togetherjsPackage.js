(function() {
/**
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("libs/almond", function(){});

/*! jQuery v1.8.3 jquery.com | jquery.org/license */
(function (){
(function(e,t){function _(e){var t=M[e]={};return v.each(e.split(y),function(e,n){t[n]=!0}),t}function H(e,n,r){if(r===t&&e.nodeType===1){var i="data-"+n.replace(P,"-$1").toLowerCase();r=e.getAttribute(i);if(typeof r=="string"){try{r=r==="true"?!0:r==="false"?!1:r==="null"?null:+r+""===r?+r:D.test(r)?v.parseJSON(r):r}catch(s){}v.data(e,n,r)}else r=t}return r}function B(e){var t;for(t in e){if(t==="data"&&v.isEmptyObject(e[t]))continue;if(t!=="toJSON")return!1}return!0}function et(){return!1}function tt(){return!0}function ut(e){return!e||!e.parentNode||e.parentNode.nodeType===11}function at(e,t){do e=e[t];while(e&&e.nodeType!==1);return e}function ft(e,t,n){t=t||0;if(v.isFunction(t))return v.grep(e,function(e,r){var i=!!t.call(e,r,e);return i===n});if(t.nodeType)return v.grep(e,function(e,r){return e===t===n});if(typeof t=="string"){var r=v.grep(e,function(e){return e.nodeType===1});if(it.test(t))return v.filter(t,r,!n);t=v.filter(t,r)}return v.grep(e,function(e,r){return v.inArray(e,t)>=0===n})}function lt(e){var t=ct.split("|"),n=e.createDocumentFragment();if(n.createElement)while(t.length)n.createElement(t.pop());return n}function Lt(e,t){return e.getElementsByTagName(t)[0]||e.appendChild(e.ownerDocument.createElement(t))}function At(e,t){if(t.nodeType!==1||!v.hasData(e))return;var n,r,i,s=v._data(e),o=v._data(t,s),u=s.events;if(u){delete o.handle,o.events={};for(n in u)for(r=0,i=u[n].length;r<i;r++)v.event.add(t,n,u[n][r])}o.data&&(o.data=v.extend({},o.data))}function Ot(e,t){var n;if(t.nodeType!==1)return;t.clearAttributes&&t.clearAttributes(),t.mergeAttributes&&t.mergeAttributes(e),n=t.nodeName.toLowerCase(),n==="object"?(t.parentNode&&(t.outerHTML=e.outerHTML),v.support.html5Clone&&e.innerHTML&&!v.trim(t.innerHTML)&&(t.innerHTML=e.innerHTML)):n==="input"&&Et.test(e.type)?(t.defaultChecked=t.checked=e.checked,t.value!==e.value&&(t.value=e.value)):n==="option"?t.selected=e.defaultSelected:n==="input"||n==="textarea"?t.defaultValue=e.defaultValue:n==="script"&&t.text!==e.text&&(t.text=e.text),t.removeAttribute(v.expando)}function Mt(e){return typeof e.getElementsByTagName!="undefined"?e.getElementsByTagName("*"):typeof e.querySelectorAll!="undefined"?e.querySelectorAll("*"):[]}function _t(e){Et.test(e.type)&&(e.defaultChecked=e.checked)}function Qt(e,t){if(t in e)return t;var n=t.charAt(0).toUpperCase()+t.slice(1),r=t,i=Jt.length;while(i--){t=Jt[i]+n;if(t in e)return t}return r}function Gt(e,t){return e=t||e,v.css(e,"display")==="none"||!v.contains(e.ownerDocument,e)}function Yt(e,t){var n,r,i=[],s=0,o=e.length;for(;s<o;s++){n=e[s];if(!n.style)continue;i[s]=v._data(n,"olddisplay"),t?(!i[s]&&n.style.display==="none"&&(n.style.display=""),n.style.display===""&&Gt(n)&&(i[s]=v._data(n,"olddisplay",nn(n.nodeName)))):(r=Dt(n,"display"),!i[s]&&r!=="none"&&v._data(n,"olddisplay",r))}for(s=0;s<o;s++){n=e[s];if(!n.style)continue;if(!t||n.style.display==="none"||n.style.display==="")n.style.display=t?i[s]||"":"none"}return e}function Zt(e,t,n){var r=Rt.exec(t);return r?Math.max(0,r[1]-(n||0))+(r[2]||"px"):t}function en(e,t,n,r){var i=n===(r?"border":"content")?4:t==="width"?1:0,s=0;for(;i<4;i+=2)n==="margin"&&(s+=v.css(e,n+$t[i],!0)),r?(n==="content"&&(s-=parseFloat(Dt(e,"padding"+$t[i]))||0),n!=="margin"&&(s-=parseFloat(Dt(e,"border"+$t[i]+"Width"))||0)):(s+=parseFloat(Dt(e,"padding"+$t[i]))||0,n!=="padding"&&(s+=parseFloat(Dt(e,"border"+$t[i]+"Width"))||0));return s}function tn(e,t,n){var r=t==="width"?e.offsetWidth:e.offsetHeight,i=!0,s=v.support.boxSizing&&v.css(e,"boxSizing")==="border-box";if(r<=0||r==null){r=Dt(e,t);if(r<0||r==null)r=e.style[t];if(Ut.test(r))return r;i=s&&(v.support.boxSizingReliable||r===e.style[t]),r=parseFloat(r)||0}return r+en(e,t,n||(s?"border":"content"),i)+"px"}function nn(e){if(Wt[e])return Wt[e];var t=v("<"+e+">").appendTo(i.body),n=t.css("display");t.remove();if(n==="none"||n===""){Pt=i.body.appendChild(Pt||v.extend(i.createElement("iframe"),{frameBorder:0,width:0,height:0}));if(!Ht||!Pt.createElement)Ht=(Pt.contentWindow||Pt.contentDocument).document,Ht.write("<!doctype html><html><body>"),Ht.close();t=Ht.body.appendChild(Ht.createElement(e)),n=Dt(t,"display"),i.body.removeChild(Pt)}return Wt[e]=n,n}function fn(e,t,n,r){var i;if(v.isArray(t))v.each(t,function(t,i){n||sn.test(e)?r(e,i):fn(e+"["+(typeof i=="object"?t:"")+"]",i,n,r)});else if(!n&&v.type(t)==="object")for(i in t)fn(e+"["+i+"]",t[i],n,r);else r(e,t)}function Cn(e){return function(t,n){typeof t!="string"&&(n=t,t="*");var r,i,s,o=t.toLowerCase().split(y),u=0,a=o.length;if(v.isFunction(n))for(;u<a;u++)r=o[u],s=/^\+/.test(r),s&&(r=r.substr(1)||"*"),i=e[r]=e[r]||[],i[s?"unshift":"push"](n)}}function kn(e,n,r,i,s,o){s=s||n.dataTypes[0],o=o||{},o[s]=!0;var u,a=e[s],f=0,l=a?a.length:0,c=e===Sn;for(;f<l&&(c||!u);f++)u=a[f](n,r,i),typeof u=="string"&&(!c||o[u]?u=t:(n.dataTypes.unshift(u),u=kn(e,n,r,i,u,o)));return(c||!u)&&!o["*"]&&(u=kn(e,n,r,i,"*",o)),u}function Ln(e,n){var r,i,s=v.ajaxSettings.flatOptions||{};for(r in n)n[r]!==t&&((s[r]?e:i||(i={}))[r]=n[r]);i&&v.extend(!0,e,i)}function An(e,n,r){var i,s,o,u,a=e.contents,f=e.dataTypes,l=e.responseFields;for(s in l)s in r&&(n[l[s]]=r[s]);while(f[0]==="*")f.shift(),i===t&&(i=e.mimeType||n.getResponseHeader("content-type"));if(i)for(s in a)if(a[s]&&a[s].test(i)){f.unshift(s);break}if(f[0]in r)o=f[0];else{for(s in r){if(!f[0]||e.converters[s+" "+f[0]]){o=s;break}u||(u=s)}o=o||u}if(o)return o!==f[0]&&f.unshift(o),r[o]}function On(e,t){var n,r,i,s,o=e.dataTypes.slice(),u=o[0],a={},f=0;e.dataFilter&&(t=e.dataFilter(t,e.dataType));if(o[1])for(n in e.converters)a[n.toLowerCase()]=e.converters[n];for(;i=o[++f];)if(i!=="*"){if(u!=="*"&&u!==i){n=a[u+" "+i]||a["* "+i];if(!n)for(r in a){s=r.split(" ");if(s[1]===i){n=a[u+" "+s[0]]||a["* "+s[0]];if(n){n===!0?n=a[r]:a[r]!==!0&&(i=s[0],o.splice(f--,0,i));break}}}if(n!==!0)if(n&&e["throws"])t=n(t);else try{t=n(t)}catch(l){return{state:"parsererror",error:n?l:"No conversion from "+u+" to "+i}}}u=i}return{state:"success",data:t}}function Fn(){try{return new e.XMLHttpRequest}catch(t){}}function In(){try{return new e.ActiveXObject("Microsoft.XMLHTTP")}catch(t){}}function $n(){return setTimeout(function(){qn=t},0),qn=v.now()}function Jn(e,t){v.each(t,function(t,n){var r=(Vn[t]||[]).concat(Vn["*"]),i=0,s=r.length;for(;i<s;i++)if(r[i].call(e,t,n))return})}function Kn(e,t,n){var r,i=0,s=0,o=Xn.length,u=v.Deferred().always(function(){delete a.elem}),a=function(){var t=qn||$n(),n=Math.max(0,f.startTime+f.duration-t),r=n/f.duration||0,i=1-r,s=0,o=f.tweens.length;for(;s<o;s++)f.tweens[s].run(i);return u.notifyWith(e,[f,i,n]),i<1&&o?n:(u.resolveWith(e,[f]),!1)},f=u.promise({elem:e,props:v.extend({},t),opts:v.extend(!0,{specialEasing:{}},n),originalProperties:t,originalOptions:n,startTime:qn||$n(),duration:n.duration,tweens:[],createTween:function(t,n,r){var i=v.Tween(e,f.opts,t,n,f.opts.specialEasing[t]||f.opts.easing);return f.tweens.push(i),i},stop:function(t){var n=0,r=t?f.tweens.length:0;for(;n<r;n++)f.tweens[n].run(1);return t?u.resolveWith(e,[f,t]):u.rejectWith(e,[f,t]),this}}),l=f.props;Qn(l,f.opts.specialEasing);for(;i<o;i++){r=Xn[i].call(f,e,l,f.opts);if(r)return r}return Jn(f,l),v.isFunction(f.opts.start)&&f.opts.start.call(e,f),v.fx.timer(v.extend(a,{anim:f,queue:f.opts.queue,elem:e})),f.progress(f.opts.progress).done(f.opts.done,f.opts.complete).fail(f.opts.fail).always(f.opts.always)}function Qn(e,t){var n,r,i,s,o;for(n in e){r=v.camelCase(n),i=t[r],s=e[n],v.isArray(s)&&(i=s[1],s=e[n]=s[0]),n!==r&&(e[r]=s,delete e[n]),o=v.cssHooks[r];if(o&&"expand"in o){s=o.expand(s),delete e[r];for(n in s)n in e||(e[n]=s[n],t[n]=i)}else t[r]=i}}function Gn(e,t,n){var r,i,s,o,u,a,f,l,c,h=this,p=e.style,d={},m=[],g=e.nodeType&&Gt(e);n.queue||(l=v._queueHooks(e,"fx"),l.unqueued==null&&(l.unqueued=0,c=l.empty.fire,l.empty.fire=function(){l.unqueued||c()}),l.unqueued++,h.always(function(){h.always(function(){l.unqueued--,v.queue(e,"fx").length||l.empty.fire()})})),e.nodeType===1&&("height"in t||"width"in t)&&(n.overflow=[p.overflow,p.overflowX,p.overflowY],v.css(e,"display")==="inline"&&v.css(e,"float")==="none"&&(!v.support.inlineBlockNeedsLayout||nn(e.nodeName)==="inline"?p.display="inline-block":p.zoom=1)),n.overflow&&(p.overflow="hidden",v.support.shrinkWrapBlocks||h.done(function(){p.overflow=n.overflow[0],p.overflowX=n.overflow[1],p.overflowY=n.overflow[2]}));for(r in t){s=t[r];if(Un.exec(s)){delete t[r],a=a||s==="toggle";if(s===(g?"hide":"show"))continue;m.push(r)}}o=m.length;if(o){u=v._data(e,"fxshow")||v._data(e,"fxshow",{}),"hidden"in u&&(g=u.hidden),a&&(u.hidden=!g),g?v(e).show():h.done(function(){v(e).hide()}),h.done(function(){var t;v.removeData(e,"fxshow",!0);for(t in d)v.style(e,t,d[t])});for(r=0;r<o;r++)i=m[r],f=h.createTween(i,g?u[i]:0),d[i]=u[i]||v.style(e,i),i in u||(u[i]=f.start,g&&(f.end=f.start,f.start=i==="width"||i==="height"?1:0))}}function Yn(e,t,n,r,i){return new Yn.prototype.init(e,t,n,r,i)}function Zn(e,t){var n,r={height:e},i=0;t=t?1:0;for(;i<4;i+=2-t)n=$t[i],r["margin"+n]=r["padding"+n]=e;return t&&(r.opacity=r.width=e),r}function tr(e){return v.isWindow(e)?e:e.nodeType===9?e.defaultView||e.parentWindow:!1}var n,r,i=e.document,s=e.location,o=e.navigator,u=e.jQuery,a=e.$,f=Array.prototype.push,l=Array.prototype.slice,c=Array.prototype.indexOf,h=Object.prototype.toString,p=Object.prototype.hasOwnProperty,d=String.prototype.trim,v=function(e,t){return new v.fn.init(e,t,n)},m=/[\-+]?(?:\d*\.|)\d+(?:[eE][\-+]?\d+|)/.source,g=/\S/,y=/\s+/,b=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,w=/^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,E=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,S=/^[\],:{}\s]*$/,x=/(?:^|:|,)(?:\s*\[)+/g,T=/\\(?:["\\\/bfnrt]|u[\da-fA-F]{4})/g,N=/"[^"\\\r\n]*"|true|false|null|-?(?:\d\d*\.|)\d+(?:[eE][\-+]?\d+|)/g,C=/^-ms-/,k=/-([\da-z])/gi,L=function(e,t){return(t+"").toUpperCase()},A=function(){i.addEventListener?(i.removeEventListener("DOMContentLoaded",A,!1),v.ready()):i.readyState==="complete"&&(i.detachEvent("onreadystatechange",A),v.ready())},O={};v.fn=v.prototype={constructor:v,init:function(e,n,r){var s,o,u,a;if(!e)return this;if(e.nodeType)return this.context=this[0]=e,this.length=1,this;if(typeof e=="string"){e.charAt(0)==="<"&&e.charAt(e.length-1)===">"&&e.length>=3?s=[null,e,null]:s=w.exec(e);if(s&&(s[1]||!n)){if(s[1])return n=n instanceof v?n[0]:n,a=n&&n.nodeType?n.ownerDocument||n:i,e=v.parseHTML(s[1],a,!0),E.test(s[1])&&v.isPlainObject(n)&&this.attr.call(e,n,!0),v.merge(this,e);o=i.getElementById(s[2]);if(o&&o.parentNode){if(o.id!==s[2])return r.find(e);this.length=1,this[0]=o}return this.context=i,this.selector=e,this}return!n||n.jquery?(n||r).find(e):this.constructor(n).find(e)}return v.isFunction(e)?r.ready(e):(e.selector!==t&&(this.selector=e.selector,this.context=e.context),v.makeArray(e,this))},selector:"",jquery:"1.8.3",length:0,size:function(){return this.length},toArray:function(){return l.call(this)},get:function(e){return e==null?this.toArray():e<0?this[this.length+e]:this[e]},pushStack:function(e,t,n){var r=v.merge(this.constructor(),e);return r.prevObject=this,r.context=this.context,t==="find"?r.selector=this.selector+(this.selector?" ":"")+n:t&&(r.selector=this.selector+"."+t+"("+n+")"),r},each:function(e,t){return v.each(this,e,t)},ready:function(e){return v.ready.promise().done(e),this},eq:function(e){return e=+e,e===-1?this.slice(e):this.slice(e,e+1)},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},slice:function(){return this.pushStack(l.apply(this,arguments),"slice",l.call(arguments).join(","))},map:function(e){return this.pushStack(v.map(this,function(t,n){return e.call(t,n,t)}))},end:function(){return this.prevObject||this.constructor(null)},push:f,sort:[].sort,splice:[].splice},v.fn.init.prototype=v.fn,v.extend=v.fn.extend=function(){var e,n,r,i,s,o,u=arguments[0]||{},a=1,f=arguments.length,l=!1;typeof u=="boolean"&&(l=u,u=arguments[1]||{},a=2),typeof u!="object"&&!v.isFunction(u)&&(u={}),f===a&&(u=this,--a);for(;a<f;a++)if((e=arguments[a])!=null)for(n in e){r=u[n],i=e[n];if(u===i)continue;l&&i&&(v.isPlainObject(i)||(s=v.isArray(i)))?(s?(s=!1,o=r&&v.isArray(r)?r:[]):o=r&&v.isPlainObject(r)?r:{},u[n]=v.extend(l,o,i)):i!==t&&(u[n]=i)}return u},v.extend({noConflict:function(t){return e.$===v&&(e.$=a),t&&e.jQuery===v&&(e.jQuery=u),v},isReady:!1,readyWait:1,holdReady:function(e){e?v.readyWait++:v.ready(!0)},ready:function(e){if(e===!0?--v.readyWait:v.isReady)return;if(!i.body)return setTimeout(v.ready,1);v.isReady=!0;if(e!==!0&&--v.readyWait>0)return;r.resolveWith(i,[v]),v.fn.trigger&&v(i).trigger("ready").off("ready")},isFunction:function(e){return v.type(e)==="function"},isArray:Array.isArray||function(e){return v.type(e)==="array"},isWindow:function(e){return e!=null&&e==e.window},isNumeric:function(e){return!isNaN(parseFloat(e))&&isFinite(e)},type:function(e){return e==null?String(e):O[h.call(e)]||"object"},isPlainObject:function(e){if(!e||v.type(e)!=="object"||e.nodeType||v.isWindow(e))return!1;try{if(e.constructor&&!p.call(e,"constructor")&&!p.call(e.constructor.prototype,"isPrototypeOf"))return!1}catch(n){return!1}var r;for(r in e);return r===t||p.call(e,r)},isEmptyObject:function(e){var t;for(t in e)return!1;return!0},error:function(e){throw new Error(e)},parseHTML:function(e,t,n){var r;return!e||typeof e!="string"?null:(typeof t=="boolean"&&(n=t,t=0),t=t||i,(r=E.exec(e))?[t.createElement(r[1])]:(r=v.buildFragment([e],t,n?null:[]),v.merge([],(r.cacheable?v.clone(r.fragment):r.fragment).childNodes)))},parseJSON:function(t){if(!t||typeof t!="string")return null;t=v.trim(t);if(e.JSON&&e.JSON.parse)return e.JSON.parse(t);if(S.test(t.replace(T,"@").replace(N,"]").replace(x,"")))return(new Function("return "+t))();v.error("Invalid JSON: "+t)},parseXML:function(n){var r,i;if(!n||typeof n!="string")return null;try{e.DOMParser?(i=new DOMParser,r=i.parseFromString(n,"text/xml")):(r=new ActiveXObject("Microsoft.XMLDOM"),r.async="false",r.loadXML(n))}catch(s){r=t}return(!r||!r.documentElement||r.getElementsByTagName("parsererror").length)&&v.error("Invalid XML: "+n),r},noop:function(){},globalEval:function(t){t&&g.test(t)&&(e.execScript||function(t){e.eval.call(e,t)})(t)},camelCase:function(e){return e.replace(C,"ms-").replace(k,L)},nodeName:function(e,t){return e.nodeName&&e.nodeName.toLowerCase()===t.toLowerCase()},each:function(e,n,r){var i,s=0,o=e.length,u=o===t||v.isFunction(e);if(r){if(u){for(i in e)if(n.apply(e[i],r)===!1)break}else for(;s<o;)if(n.apply(e[s++],r)===!1)break}else if(u){for(i in e)if(n.call(e[i],i,e[i])===!1)break}else for(;s<o;)if(n.call(e[s],s,e[s++])===!1)break;return e},trim:d&&!d.call("\ufeff\u00a0")?function(e){return e==null?"":d.call(e)}:function(e){return e==null?"":(e+"").replace(b,"")},makeArray:function(e,t){var n,r=t||[];return e!=null&&(n=v.type(e),e.length==null||n==="string"||n==="function"||n==="regexp"||v.isWindow(e)?f.call(r,e):v.merge(r,e)),r},inArray:function(e,t,n){var r;if(t){if(c)return c.call(t,e,n);r=t.length,n=n?n<0?Math.max(0,r+n):n:0;for(;n<r;n++)if(n in t&&t[n]===e)return n}return-1},merge:function(e,n){var r=n.length,i=e.length,s=0;if(typeof r=="number")for(;s<r;s++)e[i++]=n[s];else while(n[s]!==t)e[i++]=n[s++];return e.length=i,e},grep:function(e,t,n){var r,i=[],s=0,o=e.length;n=!!n;for(;s<o;s++)r=!!t(e[s],s),n!==r&&i.push(e[s]);return i},map:function(e,n,r){var i,s,o=[],u=0,a=e.length,f=e instanceof v||a!==t&&typeof a=="number"&&(a>0&&e[0]&&e[a-1]||a===0||v.isArray(e));if(f)for(;u<a;u++)i=n(e[u],u,r),i!=null&&(o[o.length]=i);else for(s in e)i=n(e[s],s,r),i!=null&&(o[o.length]=i);return o.concat.apply([],o)},guid:1,proxy:function(e,n){var r,i,s;return typeof n=="string"&&(r=e[n],n=e,e=r),v.isFunction(e)?(i=l.call(arguments,2),s=function(){return e.apply(n,i.concat(l.call(arguments)))},s.guid=e.guid=e.guid||v.guid++,s):t},access:function(e,n,r,i,s,o,u){var a,f=r==null,l=0,c=e.length;if(r&&typeof r=="object"){for(l in r)v.access(e,n,l,r[l],1,o,i);s=1}else if(i!==t){a=u===t&&v.isFunction(i),f&&(a?(a=n,n=function(e,t,n){return a.call(v(e),n)}):(n.call(e,i),n=null));if(n)for(;l<c;l++)n(e[l],r,a?i.call(e[l],l,n(e[l],r)):i,u);s=1}return s?e:f?n.call(e):c?n(e[0],r):o},now:function(){return(new Date).getTime()}}),v.ready.promise=function(t){if(!r){r=v.Deferred();if(i.readyState==="complete")setTimeout(v.ready,1);else if(i.addEventListener)i.addEventListener("DOMContentLoaded",A,!1),e.addEventListener("load",v.ready,!1);else{i.attachEvent("onreadystatechange",A),e.attachEvent("onload",v.ready);var n=!1;try{n=e.frameElement==null&&i.documentElement}catch(s){}n&&n.doScroll&&function o(){if(!v.isReady){try{n.doScroll("left")}catch(e){return setTimeout(o,50)}v.ready()}}()}}return r.promise(t)},v.each("Boolean Number String Function Array Date RegExp Object".split(" "),function(e,t){O["[object "+t+"]"]=t.toLowerCase()}),n=v(i);var M={};v.Callbacks=function(e){e=typeof e=="string"?M[e]||_(e):v.extend({},e);var n,r,i,s,o,u,a=[],f=!e.once&&[],l=function(t){n=e.memory&&t,r=!0,u=s||0,s=0,o=a.length,i=!0;for(;a&&u<o;u++)if(a[u].apply(t[0],t[1])===!1&&e.stopOnFalse){n=!1;break}i=!1,a&&(f?f.length&&l(f.shift()):n?a=[]:c.disable())},c={add:function(){if(a){var t=a.length;(function r(t){v.each(t,function(t,n){var i=v.type(n);i==="function"?(!e.unique||!c.has(n))&&a.push(n):n&&n.length&&i!=="string"&&r(n)})})(arguments),i?o=a.length:n&&(s=t,l(n))}return this},remove:function(){return a&&v.each(arguments,function(e,t){var n;while((n=v.inArray(t,a,n))>-1)a.splice(n,1),i&&(n<=o&&o--,n<=u&&u--)}),this},has:function(e){return v.inArray(e,a)>-1},empty:function(){return a=[],this},disable:function(){return a=f=n=t,this},disabled:function(){return!a},lock:function(){return f=t,n||c.disable(),this},locked:function(){return!f},fireWith:function(e,t){return t=t||[],t=[e,t.slice?t.slice():t],a&&(!r||f)&&(i?f.push(t):l(t)),this},fire:function(){return c.fireWith(this,arguments),this},fired:function(){return!!r}};return c},v.extend({Deferred:function(e){var t=[["resolve","done",v.Callbacks("once memory"),"resolved"],["reject","fail",v.Callbacks("once memory"),"rejected"],["notify","progress",v.Callbacks("memory")]],n="pending",r={state:function(){return n},always:function(){return i.done(arguments).fail(arguments),this},then:function(){var e=arguments;return v.Deferred(function(n){v.each(t,function(t,r){var s=r[0],o=e[t];i[r[1]](v.isFunction(o)?function(){var e=o.apply(this,arguments);e&&v.isFunction(e.promise)?e.promise().done(n.resolve).fail(n.reject).progress(n.notify):n[s+"With"](this===i?n:this,[e])}:n[s])}),e=null}).promise()},promise:function(e){return e!=null?v.extend(e,r):r}},i={};return r.pipe=r.then,v.each(t,function(e,s){var o=s[2],u=s[3];r[s[1]]=o.add,u&&o.add(function(){n=u},t[e^1][2].disable,t[2][2].lock),i[s[0]]=o.fire,i[s[0]+"With"]=o.fireWith}),r.promise(i),e&&e.call(i,i),i},when:function(e){var t=0,n=l.call(arguments),r=n.length,i=r!==1||e&&v.isFunction(e.promise)?r:0,s=i===1?e:v.Deferred(),o=function(e,t,n){return function(r){t[e]=this,n[e]=arguments.length>1?l.call(arguments):r,n===u?s.notifyWith(t,n):--i||s.resolveWith(t,n)}},u,a,f;if(r>1){u=new Array(r),a=new Array(r),f=new Array(r);for(;t<r;t++)n[t]&&v.isFunction(n[t].promise)?n[t].promise().done(o(t,f,n)).fail(s.reject).progress(o(t,a,u)):--i}return i||s.resolveWith(f,n),s.promise()}}),v.support=function(){var t,n,r,s,o,u,a,f,l,c,h,p=i.createElement("div");p.setAttribute("className","t"),p.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",n=p.getElementsByTagName("*"),r=p.getElementsByTagName("a")[0];if(!n||!r||!n.length)return{};s=i.createElement("select"),o=s.appendChild(i.createElement("option")),u=p.getElementsByTagName("input")[0],r.style.cssText="top:1px;float:left;opacity:.5",t={leadingWhitespace:p.firstChild.nodeType===3,tbody:!p.getElementsByTagName("tbody").length,htmlSerialize:!!p.getElementsByTagName("link").length,style:/top/.test(r.getAttribute("style")),hrefNormalized:r.getAttribute("href")==="/a",opacity:/^0.5/.test(r.style.opacity),cssFloat:!!r.style.cssFloat,checkOn:u.value==="on",optSelected:o.selected,getSetAttribute:p.className!=="t",enctype:!!i.createElement("form").enctype,html5Clone:i.createElement("nav").cloneNode(!0).outerHTML!=="<:nav></:nav>",boxModel:i.compatMode==="CSS1Compat",submitBubbles:!0,changeBubbles:!0,focusinBubbles:!1,deleteExpando:!0,noCloneEvent:!0,inlineBlockNeedsLayout:!1,shrinkWrapBlocks:!1,reliableMarginRight:!0,boxSizingReliable:!0,pixelPosition:!1},u.checked=!0,t.noCloneChecked=u.cloneNode(!0).checked,s.disabled=!0,t.optDisabled=!o.disabled;try{delete p.test}catch(d){t.deleteExpando=!1}!p.addEventListener&&p.attachEvent&&p.fireEvent&&(p.attachEvent("onclick",h=function(){t.noCloneEvent=!1}),p.cloneNode(!0).fireEvent("onclick"),p.detachEvent("onclick",h)),u=i.createElement("input"),u.value="t",u.setAttribute("type","radio"),t.radioValue=u.value==="t",u.setAttribute("checked","checked"),u.setAttribute("name","t"),p.appendChild(u),a=i.createDocumentFragment(),a.appendChild(p.lastChild),t.checkClone=a.cloneNode(!0).cloneNode(!0).lastChild.checked,t.appendChecked=u.checked,a.removeChild(u),a.appendChild(p);if(p.attachEvent)for(l in{submit:!0,change:!0,focusin:!0})f="on"+l,c=f in p,c||(p.setAttribute(f,"return;"),c=typeof p[f]=="function"),t[l+"Bubbles"]=c;return v(function(){var n,r,s,o,u="padding:0;margin:0;border:0;display:block;overflow:hidden;",a=i.getElementsByTagName("body")[0];if(!a)return;n=i.createElement("div"),n.style.cssText="visibility:hidden;border:0;width:0;height:0;position:static;top:0;margin-top:1px",a.insertBefore(n,a.firstChild),r=i.createElement("div"),n.appendChild(r),r.innerHTML="<table><tr><td></td><td>t</td></tr></table>",s=r.getElementsByTagName("td"),s[0].style.cssText="padding:0;margin:0;border:0;display:none",c=s[0].offsetHeight===0,s[0].style.display="",s[1].style.display="none",t.reliableHiddenOffsets=c&&s[0].offsetHeight===0,r.innerHTML="",r.style.cssText="box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%;",t.boxSizing=r.offsetWidth===4,t.doesNotIncludeMarginInBodyOffset=a.offsetTop!==1,e.getComputedStyle&&(t.pixelPosition=(e.getComputedStyle(r,null)||{}).top!=="1%",t.boxSizingReliable=(e.getComputedStyle(r,null)||{width:"4px"}).width==="4px",o=i.createElement("div"),o.style.cssText=r.style.cssText=u,o.style.marginRight=o.style.width="0",r.style.width="1px",r.appendChild(o),t.reliableMarginRight=!parseFloat((e.getComputedStyle(o,null)||{}).marginRight)),typeof r.style.zoom!="undefined"&&(r.innerHTML="",r.style.cssText=u+"width:1px;padding:1px;display:inline;zoom:1",t.inlineBlockNeedsLayout=r.offsetWidth===3,r.style.display="block",r.style.overflow="visible",r.innerHTML="<div></div>",r.firstChild.style.width="5px",t.shrinkWrapBlocks=r.offsetWidth!==3,n.style.zoom=1),a.removeChild(n),n=r=s=o=null}),a.removeChild(p),n=r=s=o=u=a=p=null,t}();var D=/(?:\{[\s\S]*\}|\[[\s\S]*\])$/,P=/([A-Z])/g;v.extend({cache:{},deletedIds:[],uuid:0,expando:"jQuery"+(v.fn.jquery+Math.random()).replace(/\D/g,""),noData:{embed:!0,object:"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",applet:!0},hasData:function(e){return e=e.nodeType?v.cache[e[v.expando]]:e[v.expando],!!e&&!B(e)},data:function(e,n,r,i){if(!v.acceptData(e))return;var s,o,u=v.expando,a=typeof n=="string",f=e.nodeType,l=f?v.cache:e,c=f?e[u]:e[u]&&u;if((!c||!l[c]||!i&&!l[c].data)&&a&&r===t)return;c||(f?e[u]=c=v.deletedIds.pop()||v.guid++:c=u),l[c]||(l[c]={},f||(l[c].toJSON=v.noop));if(typeof n=="object"||typeof n=="function")i?l[c]=v.extend(l[c],n):l[c].data=v.extend(l[c].data,n);return s=l[c],i||(s.data||(s.data={}),s=s.data),r!==t&&(s[v.camelCase(n)]=r),a?(o=s[n],o==null&&(o=s[v.camelCase(n)])):o=s,o},removeData:function(e,t,n){if(!v.acceptData(e))return;var r,i,s,o=e.nodeType,u=o?v.cache:e,a=o?e[v.expando]:v.expando;if(!u[a])return;if(t){r=n?u[a]:u[a].data;if(r){v.isArray(t)||(t in r?t=[t]:(t=v.camelCase(t),t in r?t=[t]:t=t.split(" ")));for(i=0,s=t.length;i<s;i++)delete r[t[i]];if(!(n?B:v.isEmptyObject)(r))return}}if(!n){delete u[a].data;if(!B(u[a]))return}o?v.cleanData([e],!0):v.support.deleteExpando||u!=u.window?delete u[a]:u[a]=null},_data:function(e,t,n){return v.data(e,t,n,!0)},acceptData:function(e){var t=e.nodeName&&v.noData[e.nodeName.toLowerCase()];return!t||t!==!0&&e.getAttribute("classid")===t}}),v.fn.extend({data:function(e,n){var r,i,s,o,u,a=this[0],f=0,l=null;if(e===t){if(this.length){l=v.data(a);if(a.nodeType===1&&!v._data(a,"parsedAttrs")){s=a.attributes;for(u=s.length;f<u;f++)o=s[f].name,o.indexOf("data-")||(o=v.camelCase(o.substring(5)),H(a,o,l[o]));v._data(a,"parsedAttrs",!0)}}return l}return typeof e=="object"?this.each(function(){v.data(this,e)}):(r=e.split(".",2),r[1]=r[1]?"."+r[1]:"",i=r[1]+"!",v.access(this,function(n){if(n===t)return l=this.triggerHandler("getData"+i,[r[0]]),l===t&&a&&(l=v.data(a,e),l=H(a,e,l)),l===t&&r[1]?this.data(r[0]):l;r[1]=n,this.each(function(){var t=v(this);t.triggerHandler("setData"+i,r),v.data(this,e,n),t.triggerHandler("changeData"+i,r)})},null,n,arguments.length>1,null,!1))},removeData:function(e){return this.each(function(){v.removeData(this,e)})}}),v.extend({queue:function(e,t,n){var r;if(e)return t=(t||"fx")+"queue",r=v._data(e,t),n&&(!r||v.isArray(n)?r=v._data(e,t,v.makeArray(n)):r.push(n)),r||[]},dequeue:function(e,t){t=t||"fx";var n=v.queue(e,t),r=n.length,i=n.shift(),s=v._queueHooks(e,t),o=function(){v.dequeue(e,t)};i==="inprogress"&&(i=n.shift(),r--),i&&(t==="fx"&&n.unshift("inprogress"),delete s.stop,i.call(e,o,s)),!r&&s&&s.empty.fire()},_queueHooks:function(e,t){var n=t+"queueHooks";return v._data(e,n)||v._data(e,n,{empty:v.Callbacks("once memory").add(function(){v.removeData(e,t+"queue",!0),v.removeData(e,n,!0)})})}}),v.fn.extend({queue:function(e,n){var r=2;return typeof e!="string"&&(n=e,e="fx",r--),arguments.length<r?v.queue(this[0],e):n===t?this:this.each(function(){var t=v.queue(this,e,n);v._queueHooks(this,e),e==="fx"&&t[0]!=="inprogress"&&v.dequeue(this,e)})},dequeue:function(e){return this.each(function(){v.dequeue(this,e)})},delay:function(e,t){return e=v.fx?v.fx.speeds[e]||e:e,t=t||"fx",this.queue(t,function(t,n){var r=setTimeout(t,e);n.stop=function(){clearTimeout(r)}})},clearQueue:function(e){return this.queue(e||"fx",[])},promise:function(e,n){var r,i=1,s=v.Deferred(),o=this,u=this.length,a=function(){--i||s.resolveWith(o,[o])};typeof e!="string"&&(n=e,e=t),e=e||"fx";while(u--)r=v._data(o[u],e+"queueHooks"),r&&r.empty&&(i++,r.empty.add(a));return a(),s.promise(n)}});var j,F,I,q=/[\t\r\n]/g,R=/\r/g,U=/^(?:button|input)$/i,z=/^(?:button|input|object|select|textarea)$/i,W=/^a(?:rea|)$/i,X=/^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i,V=v.support.getSetAttribute;v.fn.extend({attr:function(e,t){return v.access(this,v.attr,e,t,arguments.length>1)},removeAttr:function(e){return this.each(function(){v.removeAttr(this,e)})},prop:function(e,t){return v.access(this,v.prop,e,t,arguments.length>1)},removeProp:function(e){return e=v.propFix[e]||e,this.each(function(){try{this[e]=t,delete this[e]}catch(n){}})},addClass:function(e){var t,n,r,i,s,o,u;if(v.isFunction(e))return this.each(function(t){v(this).addClass(e.call(this,t,this.className))});if(e&&typeof e=="string"){t=e.split(y);for(n=0,r=this.length;n<r;n++){i=this[n];if(i.nodeType===1)if(!i.className&&t.length===1)i.className=e;else{s=" "+i.className+" ";for(o=0,u=t.length;o<u;o++)s.indexOf(" "+t[o]+" ")<0&&(s+=t[o]+" ");i.className=v.trim(s)}}}return this},removeClass:function(e){var n,r,i,s,o,u,a;if(v.isFunction(e))return this.each(function(t){v(this).removeClass(e.call(this,t,this.className))});if(e&&typeof e=="string"||e===t){n=(e||"").split(y);for(u=0,a=this.length;u<a;u++){i=this[u];if(i.nodeType===1&&i.className){r=(" "+i.className+" ").replace(q," ");for(s=0,o=n.length;s<o;s++)while(r.indexOf(" "+n[s]+" ")>=0)r=r.replace(" "+n[s]+" "," ");i.className=e?v.trim(r):""}}}return this},toggleClass:function(e,t){var n=typeof e,r=typeof t=="boolean";return v.isFunction(e)?this.each(function(n){v(this).toggleClass(e.call(this,n,this.className,t),t)}):this.each(function(){if(n==="string"){var i,s=0,o=v(this),u=t,a=e.split(y);while(i=a[s++])u=r?u:!o.hasClass(i),o[u?"addClass":"removeClass"](i)}else if(n==="undefined"||n==="boolean")this.className&&v._data(this,"__className__",this.className),this.className=this.className||e===!1?"":v._data(this,"__className__")||""})},hasClass:function(e){var t=" "+e+" ",n=0,r=this.length;for(;n<r;n++)if(this[n].nodeType===1&&(" "+this[n].className+" ").replace(q," ").indexOf(t)>=0)return!0;return!1},val:function(e){var n,r,i,s=this[0];if(!arguments.length){if(s)return n=v.valHooks[s.type]||v.valHooks[s.nodeName.toLowerCase()],n&&"get"in n&&(r=n.get(s,"value"))!==t?r:(r=s.value,typeof r=="string"?r.replace(R,""):r==null?"":r);return}return i=v.isFunction(e),this.each(function(r){var s,o=v(this);if(this.nodeType!==1)return;i?s=e.call(this,r,o.val()):s=e,s==null?s="":typeof s=="number"?s+="":v.isArray(s)&&(s=v.map(s,function(e){return e==null?"":e+""})),n=v.valHooks[this.type]||v.valHooks[this.nodeName.toLowerCase()];if(!n||!("set"in n)||n.set(this,s,"value")===t)this.value=s})}}),v.extend({valHooks:{option:{get:function(e){var t=e.attributes.value;return!t||t.specified?e.value:e.text}},select:{get:function(e){var t,n,r=e.options,i=e.selectedIndex,s=e.type==="select-one"||i<0,o=s?null:[],u=s?i+1:r.length,a=i<0?u:s?i:0;for(;a<u;a++){n=r[a];if((n.selected||a===i)&&(v.support.optDisabled?!n.disabled:n.getAttribute("disabled")===null)&&(!n.parentNode.disabled||!v.nodeName(n.parentNode,"optgroup"))){t=v(n).val();if(s)return t;o.push(t)}}return o},set:function(e,t){var n=v.makeArray(t);return v(e).find("option").each(function(){this.selected=v.inArray(v(this).val(),n)>=0}),n.length||(e.selectedIndex=-1),n}}},attrFn:{},attr:function(e,n,r,i){var s,o,u,a=e.nodeType;if(!e||a===3||a===8||a===2)return;if(i&&v.isFunction(v.fn[n]))return v(e)[n](r);if(typeof e.getAttribute=="undefined")return v.prop(e,n,r);u=a!==1||!v.isXMLDoc(e),u&&(n=n.toLowerCase(),o=v.attrHooks[n]||(X.test(n)?F:j));if(r!==t){if(r===null){v.removeAttr(e,n);return}return o&&"set"in o&&u&&(s=o.set(e,r,n))!==t?s:(e.setAttribute(n,r+""),r)}return o&&"get"in o&&u&&(s=o.get(e,n))!==null?s:(s=e.getAttribute(n),s===null?t:s)},removeAttr:function(e,t){var n,r,i,s,o=0;if(t&&e.nodeType===1){r=t.split(y);for(;o<r.length;o++)i=r[o],i&&(n=v.propFix[i]||i,s=X.test(i),s||v.attr(e,i,""),e.removeAttribute(V?i:n),s&&n in e&&(e[n]=!1))}},attrHooks:{type:{set:function(e,t){if(U.test(e.nodeName)&&e.parentNode)v.error("type property can't be changed");else if(!v.support.radioValue&&t==="radio"&&v.nodeName(e,"input")){var n=e.value;return e.setAttribute("type",t),n&&(e.value=n),t}}},value:{get:function(e,t){return j&&v.nodeName(e,"button")?j.get(e,t):t in e?e.value:null},set:function(e,t,n){if(j&&v.nodeName(e,"button"))return j.set(e,t,n);e.value=t}}},propFix:{tabindex:"tabIndex",readonly:"readOnly","for":"htmlFor","class":"className",maxlength:"maxLength",cellspacing:"cellSpacing",cellpadding:"cellPadding",rowspan:"rowSpan",colspan:"colSpan",usemap:"useMap",frameborder:"frameBorder",contenteditable:"contentEditable"},prop:function(e,n,r){var i,s,o,u=e.nodeType;if(!e||u===3||u===8||u===2)return;return o=u!==1||!v.isXMLDoc(e),o&&(n=v.propFix[n]||n,s=v.propHooks[n]),r!==t?s&&"set"in s&&(i=s.set(e,r,n))!==t?i:e[n]=r:s&&"get"in s&&(i=s.get(e,n))!==null?i:e[n]},propHooks:{tabIndex:{get:function(e){var n=e.getAttributeNode("tabindex");return n&&n.specified?parseInt(n.value,10):z.test(e.nodeName)||W.test(e.nodeName)&&e.href?0:t}}}}),F={get:function(e,n){var r,i=v.prop(e,n);return i===!0||typeof i!="boolean"&&(r=e.getAttributeNode(n))&&r.nodeValue!==!1?n.toLowerCase():t},set:function(e,t,n){var r;return t===!1?v.removeAttr(e,n):(r=v.propFix[n]||n,r in e&&(e[r]=!0),e.setAttribute(n,n.toLowerCase())),n}},V||(I={name:!0,id:!0,coords:!0},j=v.valHooks.button={get:function(e,n){var r;return r=e.getAttributeNode(n),r&&(I[n]?r.value!=="":r.specified)?r.value:t},set:function(e,t,n){var r=e.getAttributeNode(n);return r||(r=i.createAttribute(n),e.setAttributeNode(r)),r.value=t+""}},v.each(["width","height"],function(e,t){v.attrHooks[t]=v.extend(v.attrHooks[t],{set:function(e,n){if(n==="")return e.setAttribute(t,"auto"),n}})}),v.attrHooks.contenteditable={get:j.get,set:function(e,t,n){t===""&&(t="false"),j.set(e,t,n)}}),v.support.hrefNormalized||v.each(["href","src","width","height"],function(e,n){v.attrHooks[n]=v.extend(v.attrHooks[n],{get:function(e){var r=e.getAttribute(n,2);return r===null?t:r}})}),v.support.style||(v.attrHooks.style={get:function(e){return e.style.cssText.toLowerCase()||t},set:function(e,t){return e.style.cssText=t+""}}),v.support.optSelected||(v.propHooks.selected=v.extend(v.propHooks.selected,{get:function(e){var t=e.parentNode;return t&&(t.selectedIndex,t.parentNode&&t.parentNode.selectedIndex),null}})),v.support.enctype||(v.propFix.enctype="encoding"),v.support.checkOn||v.each(["radio","checkbox"],function(){v.valHooks[this]={get:function(e){return e.getAttribute("value")===null?"on":e.value}}}),v.each(["radio","checkbox"],function(){v.valHooks[this]=v.extend(v.valHooks[this],{set:function(e,t){if(v.isArray(t))return e.checked=v.inArray(v(e).val(),t)>=0}})});var $=/^(?:textarea|input|select)$/i,J=/^([^\.]*|)(?:\.(.+)|)$/,K=/(?:^|\s)hover(\.\S+|)\b/,Q=/^key/,G=/^(?:mouse|contextmenu)|click/,Y=/^(?:focusinfocus|focusoutblur)$/,Z=function(e){return v.event.special.hover?e:e.replace(K,"mouseenter$1 mouseleave$1")};v.event={add:function(e,n,r,i,s){var o,u,a,f,l,c,h,p,d,m,g;if(e.nodeType===3||e.nodeType===8||!n||!r||!(o=v._data(e)))return;r.handler&&(d=r,r=d.handler,s=d.selector),r.guid||(r.guid=v.guid++),a=o.events,a||(o.events=a={}),u=o.handle,u||(o.handle=u=function(e){return typeof v=="undefined"||!!e&&v.event.triggered===e.type?t:v.event.dispatch.apply(u.elem,arguments)},u.elem=e),n=v.trim(Z(n)).split(" ");for(f=0;f<n.length;f++){l=J.exec(n[f])||[],c=l[1],h=(l[2]||"").split(".").sort(),g=v.event.special[c]||{},c=(s?g.delegateType:g.bindType)||c,g=v.event.special[c]||{},p=v.extend({type:c,origType:l[1],data:i,handler:r,guid:r.guid,selector:s,needsContext:s&&v.expr.match.needsContext.test(s),namespace:h.join(".")},d),m=a[c];if(!m){m=a[c]=[],m.delegateCount=0;if(!g.setup||g.setup.call(e,i,h,u)===!1)e.addEventListener?e.addEventListener(c,u,!1):e.attachEvent&&e.attachEvent("on"+c,u)}g.add&&(g.add.call(e,p),p.handler.guid||(p.handler.guid=r.guid)),s?m.splice(m.delegateCount++,0,p):m.push(p),v.event.global[c]=!0}e=null},global:{},remove:function(e,t,n,r,i){var s,o,u,a,f,l,c,h,p,d,m,g=v.hasData(e)&&v._data(e);if(!g||!(h=g.events))return;t=v.trim(Z(t||"")).split(" ");for(s=0;s<t.length;s++){o=J.exec(t[s])||[],u=a=o[1],f=o[2];if(!u){for(u in h)v.event.remove(e,u+t[s],n,r,!0);continue}p=v.event.special[u]||{},u=(r?p.delegateType:p.bindType)||u,d=h[u]||[],l=d.length,f=f?new RegExp("(^|\\.)"+f.split(".").sort().join("\\.(?:.*\\.|)")+"(\\.|$)"):null;for(c=0;c<d.length;c++)m=d[c],(i||a===m.origType)&&(!n||n.guid===m.guid)&&(!f||f.test(m.namespace))&&(!r||r===m.selector||r==="**"&&m.selector)&&(d.splice(c--,1),m.selector&&d.delegateCount--,p.remove&&p.remove.call(e,m));d.length===0&&l!==d.length&&((!p.teardown||p.teardown.call(e,f,g.handle)===!1)&&v.removeEvent(e,u,g.handle),delete h[u])}v.isEmptyObject(h)&&(delete g.handle,v.removeData(e,"events",!0))},customEvent:{getData:!0,setData:!0,changeData:!0},trigger:function(n,r,s,o){if(!s||s.nodeType!==3&&s.nodeType!==8){var u,a,f,l,c,h,p,d,m,g,y=n.type||n,b=[];if(Y.test(y+v.event.triggered))return;y.indexOf("!")>=0&&(y=y.slice(0,-1),a=!0),y.indexOf(".")>=0&&(b=y.split("."),y=b.shift(),b.sort());if((!s||v.event.customEvent[y])&&!v.event.global[y])return;n=typeof n=="object"?n[v.expando]?n:new v.Event(y,n):new v.Event(y),n.type=y,n.isTrigger=!0,n.exclusive=a,n.namespace=b.join("."),n.namespace_re=n.namespace?new RegExp("(^|\\.)"+b.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,h=y.indexOf(":")<0?"on"+y:"";if(!s){u=v.cache;for(f in u)u[f].events&&u[f].events[y]&&v.event.trigger(n,r,u[f].handle.elem,!0);return}n.result=t,n.target||(n.target=s),r=r!=null?v.makeArray(r):[],r.unshift(n),p=v.event.special[y]||{};if(p.trigger&&p.trigger.apply(s,r)===!1)return;m=[[s,p.bindType||y]];if(!o&&!p.noBubble&&!v.isWindow(s)){g=p.delegateType||y,l=Y.test(g+y)?s:s.parentNode;for(c=s;l;l=l.parentNode)m.push([l,g]),c=l;c===(s.ownerDocument||i)&&m.push([c.defaultView||c.parentWindow||e,g])}for(f=0;f<m.length&&!n.isPropagationStopped();f++)l=m[f][0],n.type=m[f][1],d=(v._data(l,"events")||{})[n.type]&&v._data(l,"handle"),d&&d.apply(l,r),d=h&&l[h],d&&v.acceptData(l)&&d.apply&&d.apply(l,r)===!1&&n.preventDefault();return n.type=y,!o&&!n.isDefaultPrevented()&&(!p._default||p._default.apply(s.ownerDocument,r)===!1)&&(y!=="click"||!v.nodeName(s,"a"))&&v.acceptData(s)&&h&&s[y]&&(y!=="focus"&&y!=="blur"||n.target.offsetWidth!==0)&&!v.isWindow(s)&&(c=s[h],c&&(s[h]=null),v.event.triggered=y,s[y](),v.event.triggered=t,c&&(s[h]=c)),n.result}return},dispatch:function(n){n=v.event.fix(n||e.event);var r,i,s,o,u,a,f,c,h,p,d=(v._data(this,"events")||{})[n.type]||[],m=d.delegateCount,g=l.call(arguments),y=!n.exclusive&&!n.namespace,b=v.event.special[n.type]||{},w=[];g[0]=n,n.delegateTarget=this;if(b.preDispatch&&b.preDispatch.call(this,n)===!1)return;if(m&&(!n.button||n.type!=="click"))for(s=n.target;s!=this;s=s.parentNode||this)if(s.disabled!==!0||n.type!=="click"){u={},f=[];for(r=0;r<m;r++)c=d[r],h=c.selector,u[h]===t&&(u[h]=c.needsContext?v(h,this).index(s)>=0:v.find(h,this,null,[s]).length),u[h]&&f.push(c);f.length&&w.push({elem:s,matches:f})}d.length>m&&w.push({elem:this,matches:d.slice(m)});for(r=0;r<w.length&&!n.isPropagationStopped();r++){a=w[r],n.currentTarget=a.elem;for(i=0;i<a.matches.length&&!n.isImmediatePropagationStopped();i++){c=a.matches[i];if(y||!n.namespace&&!c.namespace||n.namespace_re&&n.namespace_re.test(c.namespace))n.data=c.data,n.handleObj=c,o=((v.event.special[c.origType]||{}).handle||c.handler).apply(a.elem,g),o!==t&&(n.result=o,o===!1&&(n.preventDefault(),n.stopPropagation()))}}return b.postDispatch&&b.postDispatch.call(this,n),n.result},props:"attrChange attrName relatedNode srcElement altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(e,t){return e.which==null&&(e.which=t.charCode!=null?t.charCode:t.keyCode),e}},mouseHooks:{props:"button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(e,n){var r,s,o,u=n.button,a=n.fromElement;return e.pageX==null&&n.clientX!=null&&(r=e.target.ownerDocument||i,s=r.documentElement,o=r.body,e.pageX=n.clientX+(s&&s.scrollLeft||o&&o.scrollLeft||0)-(s&&s.clientLeft||o&&o.clientLeft||0),e.pageY=n.clientY+(s&&s.scrollTop||o&&o.scrollTop||0)-(s&&s.clientTop||o&&o.clientTop||0)),!e.relatedTarget&&a&&(e.relatedTarget=a===e.target?n.toElement:a),!e.which&&u!==t&&(e.which=u&1?1:u&2?3:u&4?2:0),e}},fix:function(e){if(e[v.expando])return e;var t,n,r=e,s=v.event.fixHooks[e.type]||{},o=s.props?this.props.concat(s.props):this.props;e=v.Event(r);for(t=o.length;t;)n=o[--t],e[n]=r[n];return e.target||(e.target=r.srcElement||i),e.target.nodeType===3&&(e.target=e.target.parentNode),e.metaKey=!!e.metaKey,s.filter?s.filter(e,r):e},special:{load:{noBubble:!0},focus:{delegateType:"focusin"},blur:{delegateType:"focusout"},beforeunload:{setup:function(e,t,n){v.isWindow(this)&&(this.onbeforeunload=n)},teardown:function(e,t){this.onbeforeunload===t&&(this.onbeforeunload=null)}}},simulate:function(e,t,n,r){var i=v.extend(new v.Event,n,{type:e,isSimulated:!0,originalEvent:{}});r?v.event.trigger(i,null,t):v.event.dispatch.call(t,i),i.isDefaultPrevented()&&n.preventDefault()}},v.event.handle=v.event.dispatch,v.removeEvent=i.removeEventListener?function(e,t,n){e.removeEventListener&&e.removeEventListener(t,n,!1)}:function(e,t,n){var r="on"+t;e.detachEvent&&(typeof e[r]=="undefined"&&(e[r]=null),e.detachEvent(r,n))},v.Event=function(e,t){if(!(this instanceof v.Event))return new v.Event(e,t);e&&e.type?(this.originalEvent=e,this.type=e.type,this.isDefaultPrevented=e.defaultPrevented||e.returnValue===!1||e.getPreventDefault&&e.getPreventDefault()?tt:et):this.type=e,t&&v.extend(this,t),this.timeStamp=e&&e.timeStamp||v.now(),this[v.expando]=!0},v.Event.prototype={preventDefault:function(){this.isDefaultPrevented=tt;var e=this.originalEvent;if(!e)return;e.preventDefault?e.preventDefault():e.returnValue=!1},stopPropagation:function(){this.isPropagationStopped=tt;var e=this.originalEvent;if(!e)return;e.stopPropagation&&e.stopPropagation(),e.cancelBubble=!0},stopImmediatePropagation:function(){this.isImmediatePropagationStopped=tt,this.stopPropagation()},isDefaultPrevented:et,isPropagationStopped:et,isImmediatePropagationStopped:et},v.each({mouseenter:"mouseover",mouseleave:"mouseout"},function(e,t){v.event.special[e]={delegateType:t,bindType:t,handle:function(e){var n,r=this,i=e.relatedTarget,s=e.handleObj,o=s.selector;if(!i||i!==r&&!v.contains(r,i))e.type=s.origType,n=s.handler.apply(this,arguments),e.type=t;return n}}}),v.support.submitBubbles||(v.event.special.submit={setup:function(){if(v.nodeName(this,"form"))return!1;v.event.add(this,"click._submit keypress._submit",function(e){var n=e.target,r=v.nodeName(n,"input")||v.nodeName(n,"button")?n.form:t;r&&!v._data(r,"_submit_attached")&&(v.event.add(r,"submit._submit",function(e){e._submit_bubble=!0}),v._data(r,"_submit_attached",!0))})},postDispatch:function(e){e._submit_bubble&&(delete e._submit_bubble,this.parentNode&&!e.isTrigger&&v.event.simulate("submit",this.parentNode,e,!0))},teardown:function(){if(v.nodeName(this,"form"))return!1;v.event.remove(this,"._submit")}}),v.support.changeBubbles||(v.event.special.change={setup:function(){if($.test(this.nodeName)){if(this.type==="checkbox"||this.type==="radio")v.event.add(this,"propertychange._change",function(e){e.originalEvent.propertyName==="checked"&&(this._just_changed=!0)}),v.event.add(this,"click._change",function(e){this._just_changed&&!e.isTrigger&&(this._just_changed=!1),v.event.simulate("change",this,e,!0)});return!1}v.event.add(this,"beforeactivate._change",function(e){var t=e.target;$.test(t.nodeName)&&!v._data(t,"_change_attached")&&(v.event.add(t,"change._change",function(e){this.parentNode&&!e.isSimulated&&!e.isTrigger&&v.event.simulate("change",this.parentNode,e,!0)}),v._data(t,"_change_attached",!0))})},handle:function(e){var t=e.target;if(this!==t||e.isSimulated||e.isTrigger||t.type!=="radio"&&t.type!=="checkbox")return e.handleObj.handler.apply(this,arguments)},teardown:function(){return v.event.remove(this,"._change"),!$.test(this.nodeName)}}),v.support.focusinBubbles||v.each({focus:"focusin",blur:"focusout"},function(e,t){var n=0,r=function(e){v.event.simulate(t,e.target,v.event.fix(e),!0)};v.event.special[t]={setup:function(){n++===0&&i.addEventListener(e,r,!0)},teardown:function(){--n===0&&i.removeEventListener(e,r,!0)}}}),v.fn.extend({on:function(e,n,r,i,s){var o,u;if(typeof e=="object"){typeof n!="string"&&(r=r||n,n=t);for(u in e)this.on(u,n,r,e[u],s);return this}r==null&&i==null?(i=n,r=n=t):i==null&&(typeof n=="string"?(i=r,r=t):(i=r,r=n,n=t));if(i===!1)i=et;else if(!i)return this;return s===1&&(o=i,i=function(e){return v().off(e),o.apply(this,arguments)},i.guid=o.guid||(o.guid=v.guid++)),this.each(function(){v.event.add(this,e,i,r,n)})},one:function(e,t,n,r){return this.on(e,t,n,r,1)},off:function(e,n,r){var i,s;if(e&&e.preventDefault&&e.handleObj)return i=e.handleObj,v(e.delegateTarget).off(i.namespace?i.origType+"."+i.namespace:i.origType,i.selector,i.handler),this;if(typeof e=="object"){for(s in e)this.off(s,n,e[s]);return this}if(n===!1||typeof n=="function")r=n,n=t;return r===!1&&(r=et),this.each(function(){v.event.remove(this,e,r,n)})},bind:function(e,t,n){return this.on(e,null,t,n)},unbind:function(e,t){return this.off(e,null,t)},live:function(e,t,n){return v(this.context).on(e,this.selector,t,n),this},die:function(e,t){return v(this.context).off(e,this.selector||"**",t),this},delegate:function(e,t,n,r){return this.on(t,e,n,r)},undelegate:function(e,t,n){return arguments.length===1?this.off(e,"**"):this.off(t,e||"**",n)},trigger:function(e,t){return this.each(function(){v.event.trigger(e,t,this)})},triggerHandler:function(e,t){if(this[0])return v.event.trigger(e,t,this[0],!0)},toggle:function(e){var t=arguments,n=e.guid||v.guid++,r=0,i=function(n){var i=(v._data(this,"lastToggle"+e.guid)||0)%r;return v._data(this,"lastToggle"+e.guid,i+1),n.preventDefault(),t[i].apply(this,arguments)||!1};i.guid=n;while(r<t.length)t[r++].guid=n;return this.click(i)},hover:function(e,t){return this.mouseenter(e).mouseleave(t||e)}}),v.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(e,t){v.fn[t]=function(e,n){return n==null&&(n=e,e=null),arguments.length>0?this.on(t,null,e,n):this.trigger(t)},Q.test(t)&&(v.event.fixHooks[t]=v.event.keyHooks),G.test(t)&&(v.event.fixHooks[t]=v.event.mouseHooks)}),function(e,t){function nt(e,t,n,r){n=n||[],t=t||g;var i,s,a,f,l=t.nodeType;if(!e||typeof e!="string")return n;if(l!==1&&l!==9)return[];a=o(t);if(!a&&!r)if(i=R.exec(e))if(f=i[1]){if(l===9){s=t.getElementById(f);if(!s||!s.parentNode)return n;if(s.id===f)return n.push(s),n}else if(t.ownerDocument&&(s=t.ownerDocument.getElementById(f))&&u(t,s)&&s.id===f)return n.push(s),n}else{if(i[2])return S.apply(n,x.call(t.getElementsByTagName(e),0)),n;if((f=i[3])&&Z&&t.getElementsByClassName)return S.apply(n,x.call(t.getElementsByClassName(f),0)),n}return vt(e.replace(j,"$1"),t,n,r,a)}function rt(e){return function(t){var n=t.nodeName.toLowerCase();return n==="input"&&t.type===e}}function it(e){return function(t){var n=t.nodeName.toLowerCase();return(n==="input"||n==="button")&&t.type===e}}function st(e){return N(function(t){return t=+t,N(function(n,r){var i,s=e([],n.length,t),o=s.length;while(o--)n[i=s[o]]&&(n[i]=!(r[i]=n[i]))})})}function ot(e,t,n){if(e===t)return n;var r=e.nextSibling;while(r){if(r===t)return-1;r=r.nextSibling}return 1}function ut(e,t){var n,r,s,o,u,a,f,l=L[d][e+" "];if(l)return t?0:l.slice(0);u=e,a=[],f=i.preFilter;while(u){if(!n||(r=F.exec(u)))r&&(u=u.slice(r[0].length)||u),a.push(s=[]);n=!1;if(r=I.exec(u))s.push(n=new m(r.shift())),u=u.slice(n.length),n.type=r[0].replace(j," ");for(o in i.filter)(r=J[o].exec(u))&&(!f[o]||(r=f[o](r)))&&(s.push(n=new m(r.shift())),u=u.slice(n.length),n.type=o,n.matches=r);if(!n)break}return t?u.length:u?nt.error(e):L(e,a).slice(0)}function at(e,t,r){var i=t.dir,s=r&&t.dir==="parentNode",o=w++;return t.first?function(t,n,r){while(t=t[i])if(s||t.nodeType===1)return e(t,n,r)}:function(t,r,u){if(!u){var a,f=b+" "+o+" ",l=f+n;while(t=t[i])if(s||t.nodeType===1){if((a=t[d])===l)return t.sizset;if(typeof a=="string"&&a.indexOf(f)===0){if(t.sizset)return t}else{t[d]=l;if(e(t,r,u))return t.sizset=!0,t;t.sizset=!1}}}else while(t=t[i])if(s||t.nodeType===1)if(e(t,r,u))return t}}function ft(e){return e.length>1?function(t,n,r){var i=e.length;while(i--)if(!e[i](t,n,r))return!1;return!0}:e[0]}function lt(e,t,n,r,i){var s,o=[],u=0,a=e.length,f=t!=null;for(;u<a;u++)if(s=e[u])if(!n||n(s,r,i))o.push(s),f&&t.push(u);return o}function ct(e,t,n,r,i,s){return r&&!r[d]&&(r=ct(r)),i&&!i[d]&&(i=ct(i,s)),N(function(s,o,u,a){var f,l,c,h=[],p=[],d=o.length,v=s||dt(t||"*",u.nodeType?[u]:u,[]),m=e&&(s||!t)?lt(v,h,e,u,a):v,g=n?i||(s?e:d||r)?[]:o:m;n&&n(m,g,u,a);if(r){f=lt(g,p),r(f,[],u,a),l=f.length;while(l--)if(c=f[l])g[p[l]]=!(m[p[l]]=c)}if(s){if(i||e){if(i){f=[],l=g.length;while(l--)(c=g[l])&&f.push(m[l]=c);i(null,g=[],f,a)}l=g.length;while(l--)(c=g[l])&&(f=i?T.call(s,c):h[l])>-1&&(s[f]=!(o[f]=c))}}else g=lt(g===o?g.splice(d,g.length):g),i?i(null,o,g,a):S.apply(o,g)})}function ht(e){var t,n,r,s=e.length,o=i.relative[e[0].type],u=o||i.relative[" "],a=o?1:0,f=at(function(e){return e===t},u,!0),l=at(function(e){return T.call(t,e)>-1},u,!0),h=[function(e,n,r){return!o&&(r||n!==c)||((t=n).nodeType?f(e,n,r):l(e,n,r))}];for(;a<s;a++)if(n=i.relative[e[a].type])h=[at(ft(h),n)];else{n=i.filter[e[a].type].apply(null,e[a].matches);if(n[d]){r=++a;for(;r<s;r++)if(i.relative[e[r].type])break;return ct(a>1&&ft(h),a>1&&e.slice(0,a-1).join("").replace(j,"$1"),n,a<r&&ht(e.slice(a,r)),r<s&&ht(e=e.slice(r)),r<s&&e.join(""))}h.push(n)}return ft(h)}function pt(e,t){var r=t.length>0,s=e.length>0,o=function(u,a,f,l,h){var p,d,v,m=[],y=0,w="0",x=u&&[],T=h!=null,N=c,C=u||s&&i.find.TAG("*",h&&a.parentNode||a),k=b+=N==null?1:Math.E;T&&(c=a!==g&&a,n=o.el);for(;(p=C[w])!=null;w++){if(s&&p){for(d=0;v=e[d];d++)if(v(p,a,f)){l.push(p);break}T&&(b=k,n=++o.el)}r&&((p=!v&&p)&&y--,u&&x.push(p))}y+=w;if(r&&w!==y){for(d=0;v=t[d];d++)v(x,m,a,f);if(u){if(y>0)while(w--)!x[w]&&!m[w]&&(m[w]=E.call(l));m=lt(m)}S.apply(l,m),T&&!u&&m.length>0&&y+t.length>1&&nt.uniqueSort(l)}return T&&(b=k,c=N),x};return o.el=0,r?N(o):o}function dt(e,t,n){var r=0,i=t.length;for(;r<i;r++)nt(e,t[r],n);return n}function vt(e,t,n,r,s){var o,u,f,l,c,h=ut(e),p=h.length;if(!r&&h.length===1){u=h[0]=h[0].slice(0);if(u.length>2&&(f=u[0]).type==="ID"&&t.nodeType===9&&!s&&i.relative[u[1].type]){t=i.find.ID(f.matches[0].replace($,""),t,s)[0];if(!t)return n;e=e.slice(u.shift().length)}for(o=J.POS.test(e)?-1:u.length-1;o>=0;o--){f=u[o];if(i.relative[l=f.type])break;if(c=i.find[l])if(r=c(f.matches[0].replace($,""),z.test(u[0].type)&&t.parentNode||t,s)){u.splice(o,1),e=r.length&&u.join("");if(!e)return S.apply(n,x.call(r,0)),n;break}}}return a(e,h)(r,t,s,n,z.test(e)),n}function mt(){}var n,r,i,s,o,u,a,f,l,c,h=!0,p="undefined",d=("sizcache"+Math.random()).replace(".",""),m=String,g=e.document,y=g.documentElement,b=0,w=0,E=[].pop,S=[].push,x=[].slice,T=[].indexOf||function(e){var t=0,n=this.length;for(;t<n;t++)if(this[t]===e)return t;return-1},N=function(e,t){return e[d]=t==null||t,e},C=function(){var e={},t=[];return N(function(n,r){return t.push(n)>i.cacheLength&&delete e[t.shift()],e[n+" "]=r},e)},k=C(),L=C(),A=C(),O="[\\x20\\t\\r\\n\\f]",M="(?:\\\\.|[-\\w]|[^\\x00-\\xa0])+",_=M.replace("w","w#"),D="([*^$|!~]?=)",P="\\["+O+"*("+M+")"+O+"*(?:"+D+O+"*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|("+_+")|)|)"+O+"*\\]",H=":("+M+")(?:\\((?:(['\"])((?:\\\\.|[^\\\\])*?)\\2|([^()[\\]]*|(?:(?:"+P+")|[^:]|\\\\.)*|.*))\\)|)",B=":(even|odd|eq|gt|lt|nth|first|last)(?:\\("+O+"*((?:-\\d)?\\d*)"+O+"*\\)|)(?=[^-]|$)",j=new RegExp("^"+O+"+|((?:^|[^\\\\])(?:\\\\.)*)"+O+"+$","g"),F=new RegExp("^"+O+"*,"+O+"*"),I=new RegExp("^"+O+"*([\\x20\\t\\r\\n\\f>+~])"+O+"*"),q=new RegExp(H),R=/^(?:#([\w\-]+)|(\w+)|\.([\w\-]+))$/,U=/^:not/,z=/[\x20\t\r\n\f]*[+~]/,W=/:not\($/,X=/h\d/i,V=/input|select|textarea|button/i,$=/\\(?!\\)/g,J={ID:new RegExp("^#("+M+")"),CLASS:new RegExp("^\\.("+M+")"),NAME:new RegExp("^\\[name=['\"]?("+M+")['\"]?\\]"),TAG:new RegExp("^("+M.replace("w","w*")+")"),ATTR:new RegExp("^"+P),PSEUDO:new RegExp("^"+H),POS:new RegExp(B,"i"),CHILD:new RegExp("^:(only|nth|first|last)-child(?:\\("+O+"*(even|odd|(([+-]|)(\\d*)n|)"+O+"*(?:([+-]|)"+O+"*(\\d+)|))"+O+"*\\)|)","i"),needsContext:new RegExp("^"+O+"*[>+~]|"+B,"i")},K=function(e){var t=g.createElement("div");try{return e(t)}catch(n){return!1}finally{t=null}},Q=K(function(e){return e.appendChild(g.createComment("")),!e.getElementsByTagName("*").length}),G=K(function(e){return e.innerHTML="<a href='#'></a>",e.firstChild&&typeof e.firstChild.getAttribute!==p&&e.firstChild.getAttribute("href")==="#"}),Y=K(function(e){e.innerHTML="<select></select>";var t=typeof e.lastChild.getAttribute("multiple");return t!=="boolean"&&t!=="string"}),Z=K(function(e){return e.innerHTML="<div class='hidden e'></div><div class='hidden'></div>",!e.getElementsByClassName||!e.getElementsByClassName("e").length?!1:(e.lastChild.className="e",e.getElementsByClassName("e").length===2)}),et=K(function(e){e.id=d+0,e.innerHTML="<a name='"+d+"'></a><div name='"+d+"'></div>",y.insertBefore(e,y.firstChild);var t=g.getElementsByName&&g.getElementsByName(d).length===2+g.getElementsByName(d+0).length;return r=!g.getElementById(d),y.removeChild(e),t});try{x.call(y.childNodes,0)[0].nodeType}catch(tt){x=function(e){var t,n=[];for(;t=this[e];e++)n.push(t);return n}}nt.matches=function(e,t){return nt(e,null,null,t)},nt.matchesSelector=function(e,t){return nt(t,null,null,[e]).length>0},s=nt.getText=function(e){var t,n="",r=0,i=e.nodeType;if(i){if(i===1||i===9||i===11){if(typeof e.textContent=="string")return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=s(e)}else if(i===3||i===4)return e.nodeValue}else for(;t=e[r];r++)n+=s(t);return n},o=nt.isXML=function(e){var t=e&&(e.ownerDocument||e).documentElement;return t?t.nodeName!=="HTML":!1},u=nt.contains=y.contains?function(e,t){var n=e.nodeType===9?e.documentElement:e,r=t&&t.parentNode;return e===r||!!(r&&r.nodeType===1&&n.contains&&n.contains(r))}:y.compareDocumentPosition?function(e,t){return t&&!!(e.compareDocumentPosition(t)&16)}:function(e,t){while(t=t.parentNode)if(t===e)return!0;return!1},nt.attr=function(e,t){var n,r=o(e);return r||(t=t.toLowerCase()),(n=i.attrHandle[t])?n(e):r||Y?e.getAttribute(t):(n=e.getAttributeNode(t),n?typeof e[t]=="boolean"?e[t]?t:null:n.specified?n.value:null:null)},i=nt.selectors={cacheLength:50,createPseudo:N,match:J,attrHandle:G?{}:{href:function(e){return e.getAttribute("href",2)},type:function(e){return e.getAttribute("type")}},find:{ID:r?function(e,t,n){if(typeof t.getElementById!==p&&!n){var r=t.getElementById(e);return r&&r.parentNode?[r]:[]}}:function(e,n,r){if(typeof n.getElementById!==p&&!r){var i=n.getElementById(e);return i?i.id===e||typeof i.getAttributeNode!==p&&i.getAttributeNode("id").value===e?[i]:t:[]}},TAG:Q?function(e,t){if(typeof t.getElementsByTagName!==p)return t.getElementsByTagName(e)}:function(e,t){var n=t.getElementsByTagName(e);if(e==="*"){var r,i=[],s=0;for(;r=n[s];s++)r.nodeType===1&&i.push(r);return i}return n},NAME:et&&function(e,t){if(typeof t.getElementsByName!==p)return t.getElementsByName(name)},CLASS:Z&&function(e,t,n){if(typeof t.getElementsByClassName!==p&&!n)return t.getElementsByClassName(e)}},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(e){return e[1]=e[1].replace($,""),e[3]=(e[4]||e[5]||"").replace($,""),e[2]==="~="&&(e[3]=" "+e[3]+" "),e.slice(0,4)},CHILD:function(e){return e[1]=e[1].toLowerCase(),e[1]==="nth"?(e[2]||nt.error(e[0]),e[3]=+(e[3]?e[4]+(e[5]||1):2*(e[2]==="even"||e[2]==="odd")),e[4]=+(e[6]+e[7]||e[2]==="odd")):e[2]&&nt.error(e[0]),e},PSEUDO:function(e){var t,n;if(J.CHILD.test(e[0]))return null;if(e[3])e[2]=e[3];else if(t=e[4])q.test(t)&&(n=ut(t,!0))&&(n=t.indexOf(")",t.length-n)-t.length)&&(t=t.slice(0,n),e[0]=e[0].slice(0,n)),e[2]=t;return e.slice(0,3)}},filter:{ID:r?function(e){return e=e.replace($,""),function(t){return t.getAttribute("id")===e}}:function(e){return e=e.replace($,""),function(t){var n=typeof t.getAttributeNode!==p&&t.getAttributeNode("id");return n&&n.value===e}},TAG:function(e){return e==="*"?function(){return!0}:(e=e.replace($,"").toLowerCase(),function(t){return t.nodeName&&t.nodeName.toLowerCase()===e})},CLASS:function(e){var t=k[d][e+" "];return t||(t=new RegExp("(^|"+O+")"+e+"("+O+"|$)"))&&k(e,function(e){return t.test(e.className||typeof e.getAttribute!==p&&e.getAttribute("class")||"")})},ATTR:function(e,t,n){return function(r,i){var s=nt.attr(r,e);return s==null?t==="!=":t?(s+="",t==="="?s===n:t==="!="?s!==n:t==="^="?n&&s.indexOf(n)===0:t==="*="?n&&s.indexOf(n)>-1:t==="$="?n&&s.substr(s.length-n.length)===n:t==="~="?(" "+s+" ").indexOf(n)>-1:t==="|="?s===n||s.substr(0,n.length+1)===n+"-":!1):!0}},CHILD:function(e,t,n,r){return e==="nth"?function(e){var t,i,s=e.parentNode;if(n===1&&r===0)return!0;if(s){i=0;for(t=s.firstChild;t;t=t.nextSibling)if(t.nodeType===1){i++;if(e===t)break}}return i-=r,i===n||i%n===0&&i/n>=0}:function(t){var n=t;switch(e){case"only":case"first":while(n=n.previousSibling)if(n.nodeType===1)return!1;if(e==="first")return!0;n=t;case"last":while(n=n.nextSibling)if(n.nodeType===1)return!1;return!0}}},PSEUDO:function(e,t){var n,r=i.pseudos[e]||i.setFilters[e.toLowerCase()]||nt.error("unsupported pseudo: "+e);return r[d]?r(t):r.length>1?(n=[e,e,"",t],i.setFilters.hasOwnProperty(e.toLowerCase())?N(function(e,n){var i,s=r(e,t),o=s.length;while(o--)i=T.call(e,s[o]),e[i]=!(n[i]=s[o])}):function(e){return r(e,0,n)}):r}},pseudos:{not:N(function(e){var t=[],n=[],r=a(e.replace(j,"$1"));return r[d]?N(function(e,t,n,i){var s,o=r(e,null,i,[]),u=e.length;while(u--)if(s=o[u])e[u]=!(t[u]=s)}):function(e,i,s){return t[0]=e,r(t,null,s,n),!n.pop()}}),has:N(function(e){return function(t){return nt(e,t).length>0}}),contains:N(function(e){return function(t){return(t.textContent||t.innerText||s(t)).indexOf(e)>-1}}),enabled:function(e){return e.disabled===!1},disabled:function(e){return e.disabled===!0},checked:function(e){var t=e.nodeName.toLowerCase();return t==="input"&&!!e.checked||t==="option"&&!!e.selected},selected:function(e){return e.parentNode&&e.parentNode.selectedIndex,e.selected===!0},parent:function(e){return!i.pseudos.empty(e)},empty:function(e){var t;e=e.firstChild;while(e){if(e.nodeName>"@"||(t=e.nodeType)===3||t===4)return!1;e=e.nextSibling}return!0},header:function(e){return X.test(e.nodeName)},text:function(e){var t,n;return e.nodeName.toLowerCase()==="input"&&(t=e.type)==="text"&&((n=e.getAttribute("type"))==null||n.toLowerCase()===t)},radio:rt("radio"),checkbox:rt("checkbox"),file:rt("file"),password:rt("password"),image:rt("image"),submit:it("submit"),reset:it("reset"),button:function(e){var t=e.nodeName.toLowerCase();return t==="input"&&e.type==="button"||t==="button"},input:function(e){return V.test(e.nodeName)},focus:function(e){var t=e.ownerDocument;return e===t.activeElement&&(!t.hasFocus||t.hasFocus())&&!!(e.type||e.href||~e.tabIndex)},active:function(e){return e===e.ownerDocument.activeElement},first:st(function(){return[0]}),last:st(function(e,t){return[t-1]}),eq:st(function(e,t,n){return[n<0?n+t:n]}),even:st(function(e,t){for(var n=0;n<t;n+=2)e.push(n);return e}),odd:st(function(e,t){for(var n=1;n<t;n+=2)e.push(n);return e}),lt:st(function(e,t,n){for(var r=n<0?n+t:n;--r>=0;)e.push(r);return e}),gt:st(function(e,t,n){for(var r=n<0?n+t:n;++r<t;)e.push(r);return e})}},f=y.compareDocumentPosition?function(e,t){return e===t?(l=!0,0):(!e.compareDocumentPosition||!t.compareDocumentPosition?e.compareDocumentPosition:e.compareDocumentPosition(t)&4)?-1:1}:function(e,t){if(e===t)return l=!0,0;if(e.sourceIndex&&t.sourceIndex)return e.sourceIndex-t.sourceIndex;var n,r,i=[],s=[],o=e.parentNode,u=t.parentNode,a=o;if(o===u)return ot(e,t);if(!o)return-1;if(!u)return 1;while(a)i.unshift(a),a=a.parentNode;a=u;while(a)s.unshift(a),a=a.parentNode;n=i.length,r=s.length;for(var f=0;f<n&&f<r;f++)if(i[f]!==s[f])return ot(i[f],s[f]);return f===n?ot(e,s[f],-1):ot(i[f],t,1)},[0,0].sort(f),h=!l,nt.uniqueSort=function(e){var t,n=[],r=1,i=0;l=h,e.sort(f);if(l){for(;t=e[r];r++)t===e[r-1]&&(i=n.push(r));while(i--)e.splice(n[i],1)}return e},nt.error=function(e){throw new Error("Syntax error, unrecognized expression: "+e)},a=nt.compile=function(e,t){var n,r=[],i=[],s=A[d][e+" "];if(!s){t||(t=ut(e)),n=t.length;while(n--)s=ht(t[n]),s[d]?r.push(s):i.push(s);s=A(e,pt(i,r))}return s},g.querySelectorAll&&function(){var e,t=vt,n=/'|\\/g,r=/\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,i=[":focus"],s=[":active"],u=y.matchesSelector||y.mozMatchesSelector||y.webkitMatchesSelector||y.oMatchesSelector||y.msMatchesSelector;K(function(e){e.innerHTML="<select><option selected=''></option></select>",e.querySelectorAll("[selected]").length||i.push("\\["+O+"*(?:checked|disabled|ismap|multiple|readonly|selected|value)"),e.querySelectorAll(":checked").length||i.push(":checked")}),K(function(e){e.innerHTML="<p test=''></p>",e.querySelectorAll("[test^='']").length&&i.push("[*^$]="+O+"*(?:\"\"|'')"),e.innerHTML="<input type='hidden'/>",e.querySelectorAll(":enabled").length||i.push(":enabled",":disabled")}),i=new RegExp(i.join("|")),vt=function(e,r,s,o,u){if(!o&&!u&&!i.test(e)){var a,f,l=!0,c=d,h=r,p=r.nodeType===9&&e;if(r.nodeType===1&&r.nodeName.toLowerCase()!=="object"){a=ut(e),(l=r.getAttribute("id"))?c=l.replace(n,"\\$&"):r.setAttribute("id",c),c="[id='"+c+"'] ",f=a.length;while(f--)a[f]=c+a[f].join("");h=z.test(e)&&r.parentNode||r,p=a.join(",")}if(p)try{return S.apply(s,x.call(h.querySelectorAll(p),0)),s}catch(v){}finally{l||r.removeAttribute("id")}}return t(e,r,s,o,u)},u&&(K(function(t){e=u.call(t,"div");try{u.call(t,"[test!='']:sizzle"),s.push("!=",H)}catch(n){}}),s=new RegExp(s.join("|")),nt.matchesSelector=function(t,n){n=n.replace(r,"='$1']");if(!o(t)&&!s.test(n)&&!i.test(n))try{var a=u.call(t,n);if(a||e||t.document&&t.document.nodeType!==11)return a}catch(f){}return nt(n,null,null,[t]).length>0})}(),i.pseudos.nth=i.pseudos.eq,i.filters=mt.prototype=i.pseudos,i.setFilters=new mt,nt.attr=v.attr,v.find=nt,v.expr=nt.selectors,v.expr[":"]=v.expr.pseudos,v.unique=nt.uniqueSort,v.text=nt.getText,v.isXMLDoc=nt.isXML,v.contains=nt.contains}(e);var nt=/Until$/,rt=/^(?:parents|prev(?:Until|All))/,it=/^.[^:#\[\.,]*$/,st=v.expr.match.needsContext,ot={children:!0,contents:!0,next:!0,prev:!0};v.fn.extend({find:function(e){var t,n,r,i,s,o,u=this;if(typeof e!="string")return v(e).filter(function(){for(t=0,n=u.length;t<n;t++)if(v.contains(u[t],this))return!0});o=this.pushStack("","find",e);for(t=0,n=this.length;t<n;t++){r=o.length,v.find(e,this[t],o);if(t>0)for(i=r;i<o.length;i++)for(s=0;s<r;s++)if(o[s]===o[i]){o.splice(i--,1);break}}return o},has:function(e){var t,n=v(e,this),r=n.length;return this.filter(function(){for(t=0;t<r;t++)if(v.contains(this,n[t]))return!0})},not:function(e){return this.pushStack(ft(this,e,!1),"not",e)},filter:function(e){return this.pushStack(ft(this,e,!0),"filter",e)},is:function(e){return!!e&&(typeof e=="string"?st.test(e)?v(e,this.context).index(this[0])>=0:v.filter(e,this).length>0:this.filter(e).length>0)},closest:function(e,t){var n,r=0,i=this.length,s=[],o=st.test(e)||typeof e!="string"?v(e,t||this.context):0;for(;r<i;r++){n=this[r];while(n&&n.ownerDocument&&n!==t&&n.nodeType!==11){if(o?o.index(n)>-1:v.find.matchesSelector(n,e)){s.push(n);break}n=n.parentNode}}return s=s.length>1?v.unique(s):s,this.pushStack(s,"closest",e)},index:function(e){return e?typeof e=="string"?v.inArray(this[0],v(e)):v.inArray(e.jquery?e[0]:e,this):this[0]&&this[0].parentNode?this.prevAll().length:-1},add:function(e,t){var n=typeof e=="string"?v(e,t):v.makeArray(e&&e.nodeType?[e]:e),r=v.merge(this.get(),n);return this.pushStack(ut(n[0])||ut(r[0])?r:v.unique(r))},addBack:function(e){return this.add(e==null?this.prevObject:this.prevObject.filter(e))}}),v.fn.andSelf=v.fn.addBack,v.each({parent:function(e){var t=e.parentNode;return t&&t.nodeType!==11?t:null},parents:function(e){return v.dir(e,"parentNode")},parentsUntil:function(e,t,n){return v.dir(e,"parentNode",n)},next:function(e){return at(e,"nextSibling")},prev:function(e){return at(e,"previousSibling")},nextAll:function(e){return v.dir(e,"nextSibling")},prevAll:function(e){return v.dir(e,"previousSibling")},nextUntil:function(e,t,n){return v.dir(e,"nextSibling",n)},prevUntil:function(e,t,n){return v.dir(e,"previousSibling",n)},siblings:function(e){return v.sibling((e.parentNode||{}).firstChild,e)},children:function(e){return v.sibling(e.firstChild)},contents:function(e){return v.nodeName(e,"iframe")?e.contentDocument||e.contentWindow.document:v.merge([],e.childNodes)}},function(e,t){v.fn[e]=function(n,r){var i=v.map(this,t,n);return nt.test(e)||(r=n),r&&typeof r=="string"&&(i=v.filter(r,i)),i=this.length>1&&!ot[e]?v.unique(i):i,this.length>1&&rt.test(e)&&(i=i.reverse()),this.pushStack(i,e,l.call(arguments).join(","))}}),v.extend({filter:function(e,t,n){return n&&(e=":not("+e+")"),t.length===1?v.find.matchesSelector(t[0],e)?[t[0]]:[]:v.find.matches(e,t)},dir:function(e,n,r){var i=[],s=e[n];while(s&&s.nodeType!==9&&(r===t||s.nodeType!==1||!v(s).is(r)))s.nodeType===1&&i.push(s),s=s[n];return i},sibling:function(e,t){var n=[];for(;e;e=e.nextSibling)e.nodeType===1&&e!==t&&n.push(e);return n}});var ct="abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",ht=/ jQuery\d+="(?:null|\d+)"/g,pt=/^\s+/,dt=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,vt=/<([\w:]+)/,mt=/<tbody/i,gt=/<|&#?\w+;/,yt=/<(?:script|style|link)/i,bt=/<(?:script|object|embed|option|style)/i,wt=new RegExp("<(?:"+ct+")[\\s/>]","i"),Et=/^(?:checkbox|radio)$/,St=/checked\s*(?:[^=]|=\s*.checked.)/i,xt=/\/(java|ecma)script/i,Tt=/^\s*<!(?:\[CDATA\[|\-\-)|[\]\-]{2}>\s*$/g,Nt={option:[1,"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],area:[1,"<map>","</map>"],_default:[0,"",""]},Ct=lt(i),kt=Ct.appendChild(i.createElement("div"));Nt.optgroup=Nt.option,Nt.tbody=Nt.tfoot=Nt.colgroup=Nt.caption=Nt.thead,Nt.th=Nt.td,v.support.htmlSerialize||(Nt._default=[1,"X<div>","</div>"]),v.fn.extend({text:function(e){return v.access(this,function(e){return e===t?v.text(this):this.empty().append((this[0]&&this[0].ownerDocument||i).createTextNode(e))},null,e,arguments.length)},wrapAll:function(e){if(v.isFunction(e))return this.each(function(t){v(this).wrapAll(e.call(this,t))});if(this[0]){var t=v(e,this[0].ownerDocument).eq(0).clone(!0);this[0].parentNode&&t.insertBefore(this[0]),t.map(function(){var e=this;while(e.firstChild&&e.firstChild.nodeType===1)e=e.firstChild;return e}).append(this)}return this},wrapInner:function(e){return v.isFunction(e)?this.each(function(t){v(this).wrapInner(e.call(this,t))}):this.each(function(){var t=v(this),n=t.contents();n.length?n.wrapAll(e):t.append(e)})},wrap:function(e){var t=v.isFunction(e);return this.each(function(n){v(this).wrapAll(t?e.call(this,n):e)})},unwrap:function(){return this.parent().each(function(){v.nodeName(this,"body")||v(this).replaceWith(this.childNodes)}).end()},append:function(){return this.domManip(arguments,!0,function(e){(this.nodeType===1||this.nodeType===11)&&this.appendChild(e)})},prepend:function(){return this.domManip(arguments,!0,function(e){(this.nodeType===1||this.nodeType===11)&&this.insertBefore(e,this.firstChild)})},before:function(){if(!ut(this[0]))return this.domManip(arguments,!1,function(e){this.parentNode.insertBefore(e,this)});if(arguments.length){var e=v.clean(arguments);return this.pushStack(v.merge(e,this),"before",this.selector)}},after:function(){if(!ut(this[0]))return this.domManip(arguments,!1,function(e){this.parentNode.insertBefore(e,this.nextSibling)});if(arguments.length){var e=v.clean(arguments);return this.pushStack(v.merge(this,e),"after",this.selector)}},remove:function(e,t){var n,r=0;for(;(n=this[r])!=null;r++)if(!e||v.filter(e,[n]).length)!t&&n.nodeType===1&&(v.cleanData(n.getElementsByTagName("*")),v.cleanData([n])),n.parentNode&&n.parentNode.removeChild(n);return this},empty:function(){var e,t=0;for(;(e=this[t])!=null;t++){e.nodeType===1&&v.cleanData(e.getElementsByTagName("*"));while(e.firstChild)e.removeChild(e.firstChild)}return this},clone:function(e,t){return e=e==null?!1:e,t=t==null?e:t,this.map(function(){return v.clone(this,e,t)})},html:function(e){return v.access(this,function(e){var n=this[0]||{},r=0,i=this.length;if(e===t)return n.nodeType===1?n.innerHTML.replace(ht,""):t;if(typeof e=="string"&&!yt.test(e)&&(v.support.htmlSerialize||!wt.test(e))&&(v.support.leadingWhitespace||!pt.test(e))&&!Nt[(vt.exec(e)||["",""])[1].toLowerCase()]){e=e.replace(dt,"<$1></$2>");try{for(;r<i;r++)n=this[r]||{},n.nodeType===1&&(v.cleanData(n.getElementsByTagName("*")),n.innerHTML=e);n=0}catch(s){}}n&&this.empty().append(e)},null,e,arguments.length)},replaceWith:function(e){return ut(this[0])?this.length?this.pushStack(v(v.isFunction(e)?e():e),"replaceWith",e):this:v.isFunction(e)?this.each(function(t){var n=v(this),r=n.html();n.replaceWith(e.call(this,t,r))}):(typeof e!="string"&&(e=v(e).detach()),this.each(function(){var t=this.nextSibling,n=this.parentNode;v(this).remove(),t?v(t).before(e):v(n).append(e)}))},detach:function(e){return this.remove(e,!0)},domManip:function(e,n,r){e=[].concat.apply([],e);var i,s,o,u,a=0,f=e[0],l=[],c=this.length;if(!v.support.checkClone&&c>1&&typeof f=="string"&&St.test(f))return this.each(function(){v(this).domManip(e,n,r)});if(v.isFunction(f))return this.each(function(i){var s=v(this);e[0]=f.call(this,i,n?s.html():t),s.domManip(e,n,r)});if(this[0]){i=v.buildFragment(e,this,l),o=i.fragment,s=o.firstChild,o.childNodes.length===1&&(o=s);if(s){n=n&&v.nodeName(s,"tr");for(u=i.cacheable||c-1;a<c;a++)r.call(n&&v.nodeName(this[a],"table")?Lt(this[a],"tbody"):this[a],a===u?o:v.clone(o,!0,!0))}o=s=null,l.length&&v.each(l,function(e,t){t.src?v.ajax?v.ajax({url:t.src,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0}):v.error("no ajax"):v.globalEval((t.text||t.textContent||t.innerHTML||"").replace(Tt,"")),t.parentNode&&t.parentNode.removeChild(t)})}return this}}),v.buildFragment=function(e,n,r){var s,o,u,a=e[0];return n=n||i,n=!n.nodeType&&n[0]||n,n=n.ownerDocument||n,e.length===1&&typeof a=="string"&&a.length<512&&n===i&&a.charAt(0)==="<"&&!bt.test(a)&&(v.support.checkClone||!St.test(a))&&(v.support.html5Clone||!wt.test(a))&&(o=!0,s=v.fragments[a],u=s!==t),s||(s=n.createDocumentFragment(),v.clean(e,n,s,r),o&&(v.fragments[a]=u&&s)),{fragment:s,cacheable:o}},v.fragments={},v.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(e,t){v.fn[e]=function(n){var r,i=0,s=[],o=v(n),u=o.length,a=this.length===1&&this[0].parentNode;if((a==null||a&&a.nodeType===11&&a.childNodes.length===1)&&u===1)return o[t](this[0]),this;for(;i<u;i++)r=(i>0?this.clone(!0):this).get(),v(o[i])[t](r),s=s.concat(r);return this.pushStack(s,e,o.selector)}}),v.extend({clone:function(e,t,n){var r,i,s,o;v.support.html5Clone||v.isXMLDoc(e)||!wt.test("<"+e.nodeName+">")?o=e.cloneNode(!0):(kt.innerHTML=e.outerHTML,kt.removeChild(o=kt.firstChild));if((!v.support.noCloneEvent||!v.support.noCloneChecked)&&(e.nodeType===1||e.nodeType===11)&&!v.isXMLDoc(e)){Ot(e,o),r=Mt(e),i=Mt(o);for(s=0;r[s];++s)i[s]&&Ot(r[s],i[s])}if(t){At(e,o);if(n){r=Mt(e),i=Mt(o);for(s=0;r[s];++s)At(r[s],i[s])}}return r=i=null,o},clean:function(e,t,n,r){var s,o,u,a,f,l,c,h,p,d,m,g,y=t===i&&Ct,b=[];if(!t||typeof t.createDocumentFragment=="undefined")t=i;for(s=0;(u=e[s])!=null;s++){typeof u=="number"&&(u+="");if(!u)continue;if(typeof u=="string")if(!gt.test(u))u=t.createTextNode(u);else{y=y||lt(t),c=t.createElement("div"),y.appendChild(c),u=u.replace(dt,"<$1></$2>"),a=(vt.exec(u)||["",""])[1].toLowerCase(),f=Nt[a]||Nt._default,l=f[0],c.innerHTML=f[1]+u+f[2];while(l--)c=c.lastChild;if(!v.support.tbody){h=mt.test(u),p=a==="table"&&!h?c.firstChild&&c.firstChild.childNodes:f[1]==="<table>"&&!h?c.childNodes:[];for(o=p.length-1;o>=0;--o)v.nodeName(p[o],"tbody")&&!p[o].childNodes.length&&p[o].parentNode.removeChild(p[o])}!v.support.leadingWhitespace&&pt.test(u)&&c.insertBefore(t.createTextNode(pt.exec(u)[0]),c.firstChild),u=c.childNodes,c.parentNode.removeChild(c)}u.nodeType?b.push(u):v.merge(b,u)}c&&(u=c=y=null);if(!v.support.appendChecked)for(s=0;(u=b[s])!=null;s++)v.nodeName(u,"input")?_t(u):typeof u.getElementsByTagName!="undefined"&&v.grep(u.getElementsByTagName("input"),_t);if(n){m=function(e){if(!e.type||xt.test(e.type))return r?r.push(e.parentNode?e.parentNode.removeChild(e):e):n.appendChild(e)};for(s=0;(u=b[s])!=null;s++)if(!v.nodeName(u,"script")||!m(u))n.appendChild(u),typeof u.getElementsByTagName!="undefined"&&(g=v.grep(v.merge([],u.getElementsByTagName("script")),m),b.splice.apply(b,[s+1,0].concat(g)),s+=g.length)}return b},cleanData:function(e,t){var n,r,i,s,o=0,u=v.expando,a=v.cache,f=v.support.deleteExpando,l=v.event.special;for(;(i=e[o])!=null;o++)if(t||v.acceptData(i)){r=i[u],n=r&&a[r];if(n){if(n.events)for(s in n.events)l[s]?v.event.remove(i,s):v.removeEvent(i,s,n.handle);a[r]&&(delete a[r],f?delete i[u]:i.removeAttribute?i.removeAttribute(u):i[u]=null,v.deletedIds.push(r))}}}}),function(){var e,t;v.uaMatch=function(e){e=e.toLowerCase();var t=/(chrome)[ \/]([\w.]+)/.exec(e)||/(webkit)[ \/]([\w.]+)/.exec(e)||/(opera)(?:.*version|)[ \/]([\w.]+)/.exec(e)||/(msie) ([\w.]+)/.exec(e)||e.indexOf("compatible")<0&&/(mozilla)(?:.*? rv:([\w.]+)|)/.exec(e)||[];return{browser:t[1]||"",version:t[2]||"0"}},e=v.uaMatch(o.userAgent),t={},e.browser&&(t[e.browser]=!0,t.version=e.version),t.chrome?t.webkit=!0:t.webkit&&(t.safari=!0),v.browser=t,v.sub=function(){function e(t,n){return new e.fn.init(t,n)}v.extend(!0,e,this),e.superclass=this,e.fn=e.prototype=this(),e.fn.constructor=e,e.sub=this.sub,e.fn.init=function(r,i){return i&&i instanceof v&&!(i instanceof e)&&(i=e(i)),v.fn.init.call(this,r,i,t)},e.fn.init.prototype=e.fn;var t=e(i);return e}}();var Dt,Pt,Ht,Bt=/alpha\([^)]*\)/i,jt=/opacity=([^)]*)/,Ft=/^(top|right|bottom|left)$/,It=/^(none|table(?!-c[ea]).+)/,qt=/^margin/,Rt=new RegExp("^("+m+")(.*)$","i"),Ut=new RegExp("^("+m+")(?!px)[a-z%]+$","i"),zt=new RegExp("^([-+])=("+m+")","i"),Wt={BODY:"block"},Xt={position:"absolute",visibility:"hidden",display:"block"},Vt={letterSpacing:0,fontWeight:400},$t=["Top","Right","Bottom","Left"],Jt=["Webkit","O","Moz","ms"],Kt=v.fn.toggle;v.fn.extend({css:function(e,n){return v.access(this,function(e,n,r){return r!==t?v.style(e,n,r):v.css(e,n)},e,n,arguments.length>1)},show:function(){return Yt(this,!0)},hide:function(){return Yt(this)},toggle:function(e,t){var n=typeof e=="boolean";return v.isFunction(e)&&v.isFunction(t)?Kt.apply(this,arguments):this.each(function(){(n?e:Gt(this))?v(this).show():v(this).hide()})}}),v.extend({cssHooks:{opacity:{get:function(e,t){if(t){var n=Dt(e,"opacity");return n===""?"1":n}}}},cssNumber:{fillOpacity:!0,fontWeight:!0,lineHeight:!0,opacity:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":v.support.cssFloat?"cssFloat":"styleFloat"},style:function(e,n,r,i){if(!e||e.nodeType===3||e.nodeType===8||!e.style)return;var s,o,u,a=v.camelCase(n),f=e.style;n=v.cssProps[a]||(v.cssProps[a]=Qt(f,a)),u=v.cssHooks[n]||v.cssHooks[a];if(r===t)return u&&"get"in u&&(s=u.get(e,!1,i))!==t?s:f[n];o=typeof r,o==="string"&&(s=zt.exec(r))&&(r=(s[1]+1)*s[2]+parseFloat(v.css(e,n)),o="number");if(r==null||o==="number"&&isNaN(r))return;o==="number"&&!v.cssNumber[a]&&(r+="px");if(!u||!("set"in u)||(r=u.set(e,r,i))!==t)try{f[n]=r}catch(l){}},css:function(e,n,r,i){var s,o,u,a=v.camelCase(n);return n=v.cssProps[a]||(v.cssProps[a]=Qt(e.style,a)),u=v.cssHooks[n]||v.cssHooks[a],u&&"get"in u&&(s=u.get(e,!0,i)),s===t&&(s=Dt(e,n)),s==="normal"&&n in Vt&&(s=Vt[n]),r||i!==t?(o=parseFloat(s),r||v.isNumeric(o)?o||0:s):s},swap:function(e,t,n){var r,i,s={};for(i in t)s[i]=e.style[i],e.style[i]=t[i];r=n.call(e);for(i in t)e.style[i]=s[i];return r}}),e.getComputedStyle?Dt=function(t,n){var r,i,s,o,u=e.getComputedStyle(t,null),a=t.style;return u&&(r=u.getPropertyValue(n)||u[n],r===""&&!v.contains(t.ownerDocument,t)&&(r=v.style(t,n)),Ut.test(r)&&qt.test(n)&&(i=a.width,s=a.minWidth,o=a.maxWidth,a.minWidth=a.maxWidth=a.width=r,r=u.width,a.width=i,a.minWidth=s,a.maxWidth=o)),r}:i.documentElement.currentStyle&&(Dt=function(e,t){var n,r,i=e.currentStyle&&e.currentStyle[t],s=e.style;return i==null&&s&&s[t]&&(i=s[t]),Ut.test(i)&&!Ft.test(t)&&(n=s.left,r=e.runtimeStyle&&e.runtimeStyle.left,r&&(e.runtimeStyle.left=e.currentStyle.left),s.left=t==="fontSize"?"1em":i,i=s.pixelLeft+"px",s.left=n,r&&(e.runtimeStyle.left=r)),i===""?"auto":i}),v.each(["height","width"],function(e,t){v.cssHooks[t]={get:function(e,n,r){if(n)return e.offsetWidth===0&&It.test(Dt(e,"display"))?v.swap(e,Xt,function(){return tn(e,t,r)}):tn(e,t,r)},set:function(e,n,r){return Zt(e,n,r?en(e,t,r,v.support.boxSizing&&v.css(e,"boxSizing")==="border-box"):0)}}}),v.support.opacity||(v.cssHooks.opacity={get:function(e,t){return jt.test((t&&e.currentStyle?e.currentStyle.filter:e.style.filter)||"")?.01*parseFloat(RegExp.$1)+"":t?"1":""},set:function(e,t){var n=e.style,r=e.currentStyle,i=v.isNumeric(t)?"alpha(opacity="+t*100+")":"",s=r&&r.filter||n.filter||"";n.zoom=1;if(t>=1&&v.trim(s.replace(Bt,""))===""&&n.removeAttribute){n.removeAttribute("filter");if(r&&!r.filter)return}n.filter=Bt.test(s)?s.replace(Bt,i):s+" "+i}}),v(function(){v.support.reliableMarginRight||(v.cssHooks.marginRight={get:function(e,t){return v.swap(e,{display:"inline-block"},function(){if(t)return Dt(e,"marginRight")})}}),!v.support.pixelPosition&&v.fn.position&&v.each(["top","left"],function(e,t){v.cssHooks[t]={get:function(e,n){if(n){var r=Dt(e,t);return Ut.test(r)?v(e).position()[t]+"px":r}}}})}),v.expr&&v.expr.filters&&(v.expr.filters.hidden=function(e){return e.offsetWidth===0&&e.offsetHeight===0||!v.support.reliableHiddenOffsets&&(e.style&&e.style.display||Dt(e,"display"))==="none"},v.expr.filters.visible=function(e){return!v.expr.filters.hidden(e)}),v.each({margin:"",padding:"",border:"Width"},function(e,t){v.cssHooks[e+t]={expand:function(n){var r,i=typeof n=="string"?n.split(" "):[n],s={};for(r=0;r<4;r++)s[e+$t[r]+t]=i[r]||i[r-2]||i[0];return s}},qt.test(e)||(v.cssHooks[e+t].set=Zt)});var rn=/%20/g,sn=/\[\]$/,on=/\r?\n/g,un=/^(?:color|date|datetime|datetime-local|email|hidden|month|number|password|range|search|tel|text|time|url|week)$/i,an=/^(?:select|textarea)/i;v.fn.extend({serialize:function(){return v.param(this.serializeArray())},serializeArray:function(){return this.map(function(){return this.elements?v.makeArray(this.elements):this}).filter(function(){return this.name&&!this.disabled&&(this.checked||an.test(this.nodeName)||un.test(this.type))}).map(function(e,t){var n=v(this).val();return n==null?null:v.isArray(n)?v.map(n,function(e,n){return{name:t.name,value:e.replace(on,"\r\n")}}):{name:t.name,value:n.replace(on,"\r\n")}}).get()}}),v.param=function(e,n){var r,i=[],s=function(e,t){t=v.isFunction(t)?t():t==null?"":t,i[i.length]=encodeURIComponent(e)+"="+encodeURIComponent(t)};n===t&&(n=v.ajaxSettings&&v.ajaxSettings.traditional);if(v.isArray(e)||e.jquery&&!v.isPlainObject(e))v.each(e,function(){s(this.name,this.value)});else for(r in e)fn(r,e[r],n,s);return i.join("&").replace(rn,"+")};var ln,cn,hn=/#.*$/,pn=/^(.*?):[ \t]*([^\r\n]*)\r?$/mg,dn=/^(?:about|app|app\-storage|.+\-extension|file|res|widget):$/,vn=/^(?:GET|HEAD)$/,mn=/^\/\//,gn=/\?/,yn=/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,bn=/([?&])_=[^&]*/,wn=/^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,En=v.fn.load,Sn={},xn={},Tn=["*/"]+["*"];try{cn=s.href}catch(Nn){cn=i.createElement("a"),cn.href="",cn=cn.href}ln=wn.exec(cn.toLowerCase())||[],v.fn.load=function(e,n,r){if(typeof e!="string"&&En)return En.apply(this,arguments);if(!this.length)return this;var i,s,o,u=this,a=e.indexOf(" ");return a>=0&&(i=e.slice(a,e.length),e=e.slice(0,a)),v.isFunction(n)?(r=n,n=t):n&&typeof n=="object"&&(s="POST"),v.ajax({url:e,type:s,dataType:"html",data:n,complete:function(e,t){r&&u.each(r,o||[e.responseText,t,e])}}).done(function(e){o=arguments,u.html(i?v("<div>").append(e.replace(yn,"")).find(i):e)}),this},v.each("ajaxStart ajaxStop ajaxComplete ajaxError ajaxSuccess ajaxSend".split(" "),function(e,t){v.fn[t]=function(e){return this.on(t,e)}}),v.each(["get","post"],function(e,n){v[n]=function(e,r,i,s){return v.isFunction(r)&&(s=s||i,i=r,r=t),v.ajax({type:n,url:e,data:r,success:i,dataType:s})}}),v.extend({getScript:function(e,n){return v.get(e,t,n,"script")},getJSON:function(e,t,n){return v.get(e,t,n,"json")},ajaxSetup:function(e,t){return t?Ln(e,v.ajaxSettings):(t=e,e=v.ajaxSettings),Ln(e,t),e},ajaxSettings:{url:cn,isLocal:dn.test(ln[1]),global:!0,type:"GET",contentType:"application/x-www-form-urlencoded; charset=UTF-8",processData:!0,async:!0,accepts:{xml:"application/xml, text/xml",html:"text/html",text:"text/plain",json:"application/json, text/javascript","*":Tn},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText"},converters:{"* text":e.String,"text html":!0,"text json":v.parseJSON,"text xml":v.parseXML},flatOptions:{context:!0,url:!0}},ajaxPrefilter:Cn(Sn),ajaxTransport:Cn(xn),ajax:function(e,n){function T(e,n,s,a){var l,y,b,w,S,T=n;if(E===2)return;E=2,u&&clearTimeout(u),o=t,i=a||"",x.readyState=e>0?4:0,s&&(w=An(c,x,s));if(e>=200&&e<300||e===304)c.ifModified&&(S=x.getResponseHeader("Last-Modified"),S&&(v.lastModified[r]=S),S=x.getResponseHeader("Etag"),S&&(v.etag[r]=S)),e===304?(T="notmodified",l=!0):(l=On(c,w),T=l.state,y=l.data,b=l.error,l=!b);else{b=T;if(!T||e)T="error",e<0&&(e=0)}x.status=e,x.statusText=(n||T)+"",l?d.resolveWith(h,[y,T,x]):d.rejectWith(h,[x,T,b]),x.statusCode(g),g=t,f&&p.trigger("ajax"+(l?"Success":"Error"),[x,c,l?y:b]),m.fireWith(h,[x,T]),f&&(p.trigger("ajaxComplete",[x,c]),--v.active||v.event.trigger("ajaxStop"))}typeof e=="object"&&(n=e,e=t),n=n||{};var r,i,s,o,u,a,f,l,c=v.ajaxSetup({},n),h=c.context||c,p=h!==c&&(h.nodeType||h instanceof v)?v(h):v.event,d=v.Deferred(),m=v.Callbacks("once memory"),g=c.statusCode||{},b={},w={},E=0,S="canceled",x={readyState:0,setRequestHeader:function(e,t){if(!E){var n=e.toLowerCase();e=w[n]=w[n]||e,b[e]=t}return this},getAllResponseHeaders:function(){return E===2?i:null},getResponseHeader:function(e){var n;if(E===2){if(!s){s={};while(n=pn.exec(i))s[n[1].toLowerCase()]=n[2]}n=s[e.toLowerCase()]}return n===t?null:n},overrideMimeType:function(e){return E||(c.mimeType=e),this},abort:function(e){return e=e||S,o&&o.abort(e),T(0,e),this}};d.promise(x),x.success=x.done,x.error=x.fail,x.complete=m.add,x.statusCode=function(e){if(e){var t;if(E<2)for(t in e)g[t]=[g[t],e[t]];else t=e[x.status],x.always(t)}return this},c.url=((e||c.url)+"").replace(hn,"").replace(mn,ln[1]+"//"),c.dataTypes=v.trim(c.dataType||"*").toLowerCase().split(y),c.crossDomain==null&&(a=wn.exec(c.url.toLowerCase()),c.crossDomain=!(!a||a[1]===ln[1]&&a[2]===ln[2]&&(a[3]||(a[1]==="http:"?80:443))==(ln[3]||(ln[1]==="http:"?80:443)))),c.data&&c.processData&&typeof c.data!="string"&&(c.data=v.param(c.data,c.traditional)),kn(Sn,c,n,x);if(E===2)return x;f=c.global,c.type=c.type.toUpperCase(),c.hasContent=!vn.test(c.type),f&&v.active++===0&&v.event.trigger("ajaxStart");if(!c.hasContent){c.data&&(c.url+=(gn.test(c.url)?"&":"?")+c.data,delete c.data),r=c.url;if(c.cache===!1){var N=v.now(),C=c.url.replace(bn,"$1_="+N);c.url=C+(C===c.url?(gn.test(c.url)?"&":"?")+"_="+N:"")}}(c.data&&c.hasContent&&c.contentType!==!1||n.contentType)&&x.setRequestHeader("Content-Type",c.contentType),c.ifModified&&(r=r||c.url,v.lastModified[r]&&x.setRequestHeader("If-Modified-Since",v.lastModified[r]),v.etag[r]&&x.setRequestHeader("If-None-Match",v.etag[r])),x.setRequestHeader("Accept",c.dataTypes[0]&&c.accepts[c.dataTypes[0]]?c.accepts[c.dataTypes[0]]+(c.dataTypes[0]!=="*"?", "+Tn+"; q=0.01":""):c.accepts["*"]);for(l in c.headers)x.setRequestHeader(l,c.headers[l]);if(!c.beforeSend||c.beforeSend.call(h,x,c)!==!1&&E!==2){S="abort";for(l in{success:1,error:1,complete:1})x[l](c[l]);o=kn(xn,c,n,x);if(!o)T(-1,"No Transport");else{x.readyState=1,f&&p.trigger("ajaxSend",[x,c]),c.async&&c.timeout>0&&(u=setTimeout(function(){x.abort("timeout")},c.timeout));try{E=1,o.send(b,T)}catch(k){if(!(E<2))throw k;T(-1,k)}}return x}return x.abort()},active:0,lastModified:{},etag:{}});var Mn=[],_n=/\?/,Dn=/(=)\?(?=&|$)|\?\?/,Pn=v.now();v.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var e=Mn.pop()||v.expando+"_"+Pn++;return this[e]=!0,e}}),v.ajaxPrefilter("json jsonp",function(n,r,i){var s,o,u,a=n.data,f=n.url,l=n.jsonp!==!1,c=l&&Dn.test(f),h=l&&!c&&typeof a=="string"&&!(n.contentType||"").indexOf("application/x-www-form-urlencoded")&&Dn.test(a);if(n.dataTypes[0]==="jsonp"||c||h)return s=n.jsonpCallback=v.isFunction(n.jsonpCallback)?n.jsonpCallback():n.jsonpCallback,o=e[s],c?n.url=f.replace(Dn,"$1"+s):h?n.data=a.replace(Dn,"$1"+s):l&&(n.url+=(_n.test(f)?"&":"?")+n.jsonp+"="+s),n.converters["script json"]=function(){return u||v.error(s+" was not called"),u[0]},n.dataTypes[0]="json",e[s]=function(){u=arguments},i.always(function(){e[s]=o,n[s]&&(n.jsonpCallback=r.jsonpCallback,Mn.push(s)),u&&v.isFunction(o)&&o(u[0]),u=o=t}),"script"}),v.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/javascript|ecmascript/},converters:{"text script":function(e){return v.globalEval(e),e}}}),v.ajaxPrefilter("script",function(e){e.cache===t&&(e.cache=!1),e.crossDomain&&(e.type="GET",e.global=!1)}),v.ajaxTransport("script",function(e){if(e.crossDomain){var n,r=i.head||i.getElementsByTagName("head")[0]||i.documentElement;return{send:function(s,o){n=i.createElement("script"),n.async="async",e.scriptCharset&&(n.charset=e.scriptCharset),n.src=e.url,n.onload=n.onreadystatechange=function(e,i){if(i||!n.readyState||/loaded|complete/.test(n.readyState))n.onload=n.onreadystatechange=null,r&&n.parentNode&&r.removeChild(n),n=t,i||o(200,"success")},r.insertBefore(n,r.firstChild)},abort:function(){n&&n.onload(0,1)}}}});var Hn,Bn=e.ActiveXObject?function(){for(var e in Hn)Hn[e](0,1)}:!1,jn=0;v.ajaxSettings.xhr=e.ActiveXObject?function(){return!this.isLocal&&Fn()||In()}:Fn,function(e){v.extend(v.support,{ajax:!!e,cors:!!e&&"withCredentials"in e})}(v.ajaxSettings.xhr()),v.support.ajax&&v.ajaxTransport(function(n){if(!n.crossDomain||v.support.cors){var r;return{send:function(i,s){var o,u,a=n.xhr();n.username?a.open(n.type,n.url,n.async,n.username,n.password):a.open(n.type,n.url,n.async);if(n.xhrFields)for(u in n.xhrFields)a[u]=n.xhrFields[u];n.mimeType&&a.overrideMimeType&&a.overrideMimeType(n.mimeType),!n.crossDomain&&!i["X-Requested-With"]&&(i["X-Requested-With"]="XMLHttpRequest");try{for(u in i)a.setRequestHeader(u,i[u])}catch(f){}a.send(n.hasContent&&n.data||null),r=function(e,i){var u,f,l,c,h;try{if(r&&(i||a.readyState===4)){r=t,o&&(a.onreadystatechange=v.noop,Bn&&delete Hn[o]);if(i)a.readyState!==4&&a.abort();else{u=a.status,l=a.getAllResponseHeaders(),c={},h=a.responseXML,h&&h.documentElement&&(c.xml=h);try{c.text=a.responseText}catch(p){}try{f=a.statusText}catch(p){f=""}!u&&n.isLocal&&!n.crossDomain?u=c.text?200:404:u===1223&&(u=204)}}}catch(d){i||s(-1,d)}c&&s(u,f,c,l)},n.async?a.readyState===4?setTimeout(r,0):(o=++jn,Bn&&(Hn||(Hn={},v(e).unload(Bn)),Hn[o]=r),a.onreadystatechange=r):r()},abort:function(){r&&r(0,1)}}}});var qn,Rn,Un=/^(?:toggle|show|hide)$/,zn=new RegExp("^(?:([-+])=|)("+m+")([a-z%]*)$","i"),Wn=/queueHooks$/,Xn=[Gn],Vn={"*":[function(e,t){var n,r,i=this.createTween(e,t),s=zn.exec(t),o=i.cur(),u=+o||0,a=1,f=20;if(s){n=+s[2],r=s[3]||(v.cssNumber[e]?"":"px");if(r!=="px"&&u){u=v.css(i.elem,e,!0)||n||1;do a=a||".5",u/=a,v.style(i.elem,e,u+r);while(a!==(a=i.cur()/o)&&a!==1&&--f)}i.unit=r,i.start=u,i.end=s[1]?u+(s[1]+1)*n:n}return i}]};v.Animation=v.extend(Kn,{tweener:function(e,t){v.isFunction(e)?(t=e,e=["*"]):e=e.split(" ");var n,r=0,i=e.length;for(;r<i;r++)n=e[r],Vn[n]=Vn[n]||[],Vn[n].unshift(t)},prefilter:function(e,t){t?Xn.unshift(e):Xn.push(e)}}),v.Tween=Yn,Yn.prototype={constructor:Yn,init:function(e,t,n,r,i,s){this.elem=e,this.prop=n,this.easing=i||"swing",this.options=t,this.start=this.now=this.cur(),this.end=r,this.unit=s||(v.cssNumber[n]?"":"px")},cur:function(){var e=Yn.propHooks[this.prop];return e&&e.get?e.get(this):Yn.propHooks._default.get(this)},run:function(e){var t,n=Yn.propHooks[this.prop];return this.options.duration?this.pos=t=v.easing[this.easing](e,this.options.duration*e,0,1,this.options.duration):this.pos=t=e,this.now=(this.end-this.start)*t+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),n&&n.set?n.set(this):Yn.propHooks._default.set(this),this}},Yn.prototype.init.prototype=Yn.prototype,Yn.propHooks={_default:{get:function(e){var t;return e.elem[e.prop]==null||!!e.elem.style&&e.elem.style[e.prop]!=null?(t=v.css(e.elem,e.prop,!1,""),!t||t==="auto"?0:t):e.elem[e.prop]},set:function(e){v.fx.step[e.prop]?v.fx.step[e.prop](e):e.elem.style&&(e.elem.style[v.cssProps[e.prop]]!=null||v.cssHooks[e.prop])?v.style(e.elem,e.prop,e.now+e.unit):e.elem[e.prop]=e.now}}},Yn.propHooks.scrollTop=Yn.propHooks.scrollLeft={set:function(e){e.elem.nodeType&&e.elem.parentNode&&(e.elem[e.prop]=e.now)}},v.each(["toggle","show","hide"],function(e,t){var n=v.fn[t];v.fn[t]=function(r,i,s){return r==null||typeof r=="boolean"||!e&&v.isFunction(r)&&v.isFunction(i)?n.apply(this,arguments):this.animate(Zn(t,!0),r,i,s)}}),v.fn.extend({fadeTo:function(e,t,n,r){return this.filter(Gt).css("opacity",0).show().end().animate({opacity:t},e,n,r)},animate:function(e,t,n,r){var i=v.isEmptyObject(e),s=v.speed(t,n,r),o=function(){var t=Kn(this,v.extend({},e),s);i&&t.stop(!0)};return i||s.queue===!1?this.each(o):this.queue(s.queue,o)},stop:function(e,n,r){var i=function(e){var t=e.stop;delete e.stop,t(r)};return typeof e!="string"&&(r=n,n=e,e=t),n&&e!==!1&&this.queue(e||"fx",[]),this.each(function(){var t=!0,n=e!=null&&e+"queueHooks",s=v.timers,o=v._data(this);if(n)o[n]&&o[n].stop&&i(o[n]);else for(n in o)o[n]&&o[n].stop&&Wn.test(n)&&i(o[n]);for(n=s.length;n--;)s[n].elem===this&&(e==null||s[n].queue===e)&&(s[n].anim.stop(r),t=!1,s.splice(n,1));(t||!r)&&v.dequeue(this,e)})}}),v.each({slideDown:Zn("show"),slideUp:Zn("hide"),slideToggle:Zn("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(e,t){v.fn[e]=function(e,n,r){return this.animate(t,e,n,r)}}),v.speed=function(e,t,n){var r=e&&typeof e=="object"?v.extend({},e):{complete:n||!n&&t||v.isFunction(e)&&e,duration:e,easing:n&&t||t&&!v.isFunction(t)&&t};r.duration=v.fx.off?0:typeof r.duration=="number"?r.duration:r.duration in v.fx.speeds?v.fx.speeds[r.duration]:v.fx.speeds._default;if(r.queue==null||r.queue===!0)r.queue="fx";return r.old=r.complete,r.complete=function(){v.isFunction(r.old)&&r.old.call(this),r.queue&&v.dequeue(this,r.queue)},r},v.easing={linear:function(e){return e},swing:function(e){return.5-Math.cos(e*Math.PI)/2}},v.timers=[],v.fx=Yn.prototype.init,v.fx.tick=function(){var e,n=v.timers,r=0;qn=v.now();for(;r<n.length;r++)e=n[r],!e()&&n[r]===e&&n.splice(r--,1);n.length||v.fx.stop(),qn=t},v.fx.timer=function(e){e()&&v.timers.push(e)&&!Rn&&(Rn=setInterval(v.fx.tick,v.fx.interval))},v.fx.interval=13,v.fx.stop=function(){clearInterval(Rn),Rn=null},v.fx.speeds={slow:600,fast:200,_default:400},v.fx.step={},v.expr&&v.expr.filters&&(v.expr.filters.animated=function(e){return v.grep(v.timers,function(t){return e===t.elem}).length});var er=/^(?:body|html)$/i;v.fn.offset=function(e){if(arguments.length)return e===t?this:this.each(function(t){v.offset.setOffset(this,e,t)});var n,r,i,s,o,u,a,f={top:0,left:0},l=this[0],c=l&&l.ownerDocument;if(!c)return;return(r=c.body)===l?v.offset.bodyOffset(l):(n=c.documentElement,v.contains(n,l)?(typeof l.getBoundingClientRect!="undefined"&&(f=l.getBoundingClientRect()),i=tr(c),s=n.clientTop||r.clientTop||0,o=n.clientLeft||r.clientLeft||0,u=i.pageYOffset||n.scrollTop,a=i.pageXOffset||n.scrollLeft,{top:f.top+u-s,left:f.left+a-o}):f)},v.offset={bodyOffset:function(e){var t=e.offsetTop,n=e.offsetLeft;return v.support.doesNotIncludeMarginInBodyOffset&&(t+=parseFloat(v.css(e,"marginTop"))||0,n+=parseFloat(v.css(e,"marginLeft"))||0),{top:t,left:n}},setOffset:function(e,t,n){var r=v.css(e,"position");r==="static"&&(e.style.position="relative");var i=v(e),s=i.offset(),o=v.css(e,"top"),u=v.css(e,"left"),a=(r==="absolute"||r==="fixed")&&v.inArray("auto",[o,u])>-1,f={},l={},c,h;a?(l=i.position(),c=l.top,h=l.left):(c=parseFloat(o)||0,h=parseFloat(u)||0),v.isFunction(t)&&(t=t.call(e,n,s)),t.top!=null&&(f.top=t.top-s.top+c),t.left!=null&&(f.left=t.left-s.left+h),"using"in t?t.using.call(e,f):i.css(f)}},v.fn.extend({position:function(){if(!this[0])return;var e=this[0],t=this.offsetParent(),n=this.offset(),r=er.test(t[0].nodeName)?{top:0,left:0}:t.offset();return n.top-=parseFloat(v.css(e,"marginTop"))||0,n.left-=parseFloat(v.css(e,"marginLeft"))||0,r.top+=parseFloat(v.css(t[0],"borderTopWidth"))||0,r.left+=parseFloat(v.css(t[0],"borderLeftWidth"))||0,{top:n.top-r.top,left:n.left-r.left}},offsetParent:function(){return this.map(function(){var e=this.offsetParent||i.body;while(e&&!er.test(e.nodeName)&&v.css(e,"position")==="static")e=e.offsetParent;return e||i.body})}}),v.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(e,n){var r=/Y/.test(n);v.fn[e]=function(i){return v.access(this,function(e,i,s){var o=tr(e);if(s===t)return o?n in o?o[n]:o.document.documentElement[i]:e[i];o?o.scrollTo(r?v(o).scrollLeft():s,r?s:v(o).scrollTop()):e[i]=s},e,i,arguments.length,null)}}),v.each({Height:"height",Width:"width"},function(e,n){v.each({padding:"inner"+e,content:n,"":"outer"+e},function(r,i){v.fn[i]=function(i,s){var o=arguments.length&&(r||typeof i!="boolean"),u=r||(i===!0||s===!0?"margin":"border");return v.access(this,function(n,r,i){var s;return v.isWindow(n)?n.document.documentElement["client"+e]:n.nodeType===9?(s=n.documentElement,Math.max(n.body["scroll"+e],s["scroll"+e],n.body["offset"+e],s["offset"+e],s["client"+e])):i===t?v.css(n,r,i,u):v.style(n,r,i,u)},n,o?i:t,o,null)}})}),e.jQuery=e.$=v,typeof define=="function"&&define.amd&&define.amd.jQuery&&define("jquery",[],function(){return v})})(window);
jQuery.noConflict(true);
})();

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('jqueryPlugins',["jquery"], function ($) {
  // This isn't really a "module" since it just patches jQuery itself

  // FIX ME Animations TO DO
  // walkthrough animations go here
  // animate participant cursor and box popping in when they enter the session
  // animate participant cursor and box popping out when they leave the session
  // animate the participant cursor -> rotate down when they're down the page
  $.fn.rotateCursorDown = function () {
    $('svg').animate({borderSpacing: -150, opacity: 1}, {
      step: function(now, fx) {
        if (fx.prop == "borderSpacing") {
          $(this).css('-webkit-transform', 'rotate('+now+'deg)')
            .css('-moz-transform', 'rotate('+now+'deg)')
            .css('-ms-transform', 'rotate('+now+'deg)')
            .css('-o-transform', 'rotate('+now+'deg)')
            .css('transform', 'rotate('+now+'deg)');
        } else {
          $(this).css(fx.prop, now);
        }
      },
      duration: 500
    }, 'linear').promise().then(function () {
      this.css('-webkit-transform', '');
      this.css('-moz-transform', '');
      this.css('-ms-transform', '');
      this.css('-o-transform', '');
      this.css('transform', '');
      this.css("opacity", "");
    });
  };

  // animate the participant cursor -> rotate up when they're on the same frame as the user
  $.fn.rotateCursorDown = function () {
    $('.togetherjs-cursor svg').animate({borderSpacing: 0, opacity: 1}, {
      step: function(now, fx) {
        if (fx.prop == "borderSpacing") {
          $(this).css('-webkit-transform', 'rotate('+now+'deg)')
            .css('-moz-transform', 'rotate('+now+'deg)')
            .css('-ms-transform', 'rotate('+now+'deg)')
            .css('-o-transform', 'rotate('+now+'deg)')
            .css('transform', 'rotate('+now+'deg)');
        } else {
          $(this).css(fx.prop, now);
        }
      },
      duration: 500
    }, 'linear').promise().then(function () {
      this.css('-webkit-transform', '');
      this.css('-moz-transform', '');
      this.css('-ms-transform', '');
      this.css('-o-transform', '');
      this.css('transform', '');
      this.css("opacity", "");
    });
  };

  // Move notification when another notification slides in //


  /* Pop in window from dock button: */
  $.fn.popinWindow = function () {

    //mobile popout window with no animation
    if($.browser.mobile) {

       //starting position
        this.css({
          left: "0px",
          opacity: 1,
          "zIndex": 8888
        });

        //starting position for arrow
        $('#togetherjs-window-pointer-right').css({
          left: "+=74px",
          opacity: 1,
          "zIndex": 8888
        });

        //animate arrow out
        $('#togetherjs-window-pointer-right').animate({
          opacity: 1,
          left: "-=78px"
        }, {
          duration:60, easing:"linear"
        });
        $('#togetherjs-window-pointer-right').queue();

        //bounce arrow back
        $('#togetherjs-window-pointer-right').animate({
          left:'+=4px'
        }, {
          duration:60, easing:"linear"
        });

        //animate window out
        this.animate({
          opacity: 1,
          left: "0px"
        }, {
          duration:60, easing:"linear"
        });
        this.queue();

        //bounce window back
        this.animate({
          left:'0px'
        }, {
          duration:60, easing:"linear"
        });
    }

    else {

      //starting position
      this.css({
        left: "+=74px",
        opacity: 1,
        "zIndex": 8888
      });

      //starting position for arrow
      $('#togetherjs-window-pointer-right').css({
        left: "+=74px",
        opacity: 1,
        "zIndex": 8888
      });

      //animate arrow out
      $('#togetherjs-window-pointer-right').animate({
        opacity: 1,
        left: "-=78px"
      }, {
        duration:60, easing:"linear"
      });
      $('#togetherjs-window-pointer-right').queue();

      //bounce arrow back
      $('#togetherjs-window-pointer-right').animate({
        left:'+=4px'
      }, {
        duration:60, easing:"linear"
      });

      //animate window out
      this.animate({
        opacity: 1,
        left: "-=78px"
      }, {
        duration:60, easing:"linear"
      });
      this.queue();

      //bounce window back
      this.animate({
        left:'+=4px'
      }, {
        duration:60, easing:"linear"
      });

    }

  };

  /* Slide in notification window: */
  $.fn.slideIn = function () {
    this.css({
      //top: "240px",
      left: "+=74px",
      opacity: 0,
      "zIndex": 8888
    });
    return this.animate({
      "left": "-=74px",
      opacity: 1,
      "zIndex": 9999
    }, "fast");
  };

  /* Used to fade away notification windows + flip the bottom of them out: */
  $.fn.fadeOut = function () {
    this.animate({borderSpacing: -90, opacity: 0.5}, {
      step: function(now, fx) {
        if (fx.prop == "borderSpacing") {
          $(this).css('-webkit-transform', 'perspective( 600px ) rotateX('+now+'deg)')
            .css('-moz-transform', 'perspective( 600px ) rotateX('+now+'deg)')
            .css('-ms-transform', 'perspective( 600px ) rotateX('+now+'deg)')
            .css('-o-transform', 'perspective( 600px ) rotateX('+now+'deg)')
            .css('transform', 'perspective( 600px ) rotateX('+now+'deg)');
        } else {
          $(this).css(fx.prop, now);
        }
      },
      duration: 500
    }, 'linear').promise().then(function () {
      this.css('-webkit-transform', '');
      this.css('-moz-transform', '');
      this.css('-ms-transform', '');
      this.css('-o-transform', '');
      this.css('transform', '');
      this.css("opacity", "");
    });
    return this;
  };

  /* used when user goes down to participant cursor location on screen */
  $.fn.easeTo = function (y) {
    return this.animate({
      scrollTop: y
    }, {
      duration: 400,
      easing: "swing"
    });
  };

  // avatar animate in
  $.fn.animateDockEntry = function () {
    var height = this.height();
    var width = this.width();
    var backgroundSize = height + 4;
    var margin = parseInt(this.css("marginLeft"), 10);

    // set starting position CSS for avatar
    this.css({
      marginLeft: margin + width/2,
      height: 0,
      width: 0,
      backgroundSize: "0 0"
    });

    var self = this;

    //then animate avatar to the actual dimensions, and reset the values
    this.animate({
      marginLeft: margin,
      height: height,
      width: width,
      backgroundSize: backgroundSize
    }, {
      duration: 600
    }).promise().then(function () {
      self.css({
        marginLeft: "",
        height: "",
        width: "",
        backgroundSize: ""
      });
    });
    return this;
  };

  // avatar animate out, reverse of above
  $.fn.animateDockExit = function () {

    // get the current avatar dimenensions
    var height = this.height();
    var width = this.width();
    var backgroundSize = height + 4;
    var margin = parseInt(this.css("marginLeft"), 10);

    //then animate avatar to shrink to nothing, and reset the values again
    // FIXME this needs to animate from the CENTER
    this.animate({
      marginLeft: margin + width/2,
      height: 0,
      width: 0,
      backgroundSize: "0 0",
      opacity: 0
    }, 600 );

    return this;

  };

  $.fn.animateCursorEntry = function () {
    // Make the cursor bubble pop in
  };

  // keyboard typing animation
  $.fn.animateKeyboard = function () {
    var one = this.find(".togetherjs-typing-ellipse-one");
    var two = this.find(".togetherjs-typing-ellipse-two");
    var three = this.find(".togetherjs-typing-ellipse-three");
    var count = -1;
    var run = (function () {
      count = (count+1) % 4;
      if (count === 0) {
        one.css("opacity", 0.5);
        two.css("opacity", 0.5);
        three.css("opacity", 0.5);
      } else if (count == 1) {
        one.css("opacity", 1);
      } else if (count == 2) {
        two.css("opacity", 1);
      } else { // count==3
        three.css("opacity", 1);
      }
    }).bind(this);
    run();
    var interval = setInterval(run, 300);
    this.data("animateKeyboard", interval);
  };

  $.fn.stopKeyboardAnimation = function () {
    clearTimeout(this.data("animateKeyboard"));
    this.data("animateKeyboard", null);
  };

  // FIXME: not sure if this is legit, but at least the modern mobile devices we
  // care about should have this defined:
  if (! $.browser) {
    $.browser = {};
  }
  $.browser.mobile = window.orientation !== undefined;
  if (navigator.userAgent.search(/mobile/i) != -1) {
    // FIXME: At least on the Firefox OS simulator I need this
    $.browser.mobile = true;
  }

  if ($.browser.mobile && window.matchMedia && ! window.matchMedia("screen and (max-screen-width: 480px)").matches) {
    // FIXME: for Firefox OS simulator really:
    document.body.className += " togetherjs-mobile-browser";
  }

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('util',["jquery", "jqueryPlugins"], function ($) {
  var util = {};

  util.Deferred = $.Deferred;
  TogetherJS.$ = $;

  /* A simple class pattern, use like:

    var Foo = util.Class({
      constructor: function (a, b) {
        init the class
      },
      otherMethod: ...
    });

  You can also give a superclass as the optional first argument.

  Instantiation does not require "new"

  */
  util.Class = function (superClass, prototype) {
    var a;
    if (prototype === undefined) {
      prototype = superClass;
    } else {
      if (superClass.prototype) {
        superClass = superClass.prototype;
      }
      var newPrototype = Object.create(superClass);
      for (a in prototype) {
        if (prototype.hasOwnProperty(a)) {
          newPrototype[a] = prototype[a];
        }
      }
      prototype = newPrototype;
    }
    var ClassObject = function () {
      var obj = Object.create(prototype);
      obj.constructor.apply(obj, arguments);
      obj.constructor = ClassObject;
      return obj;
    };
    ClassObject.prototype = prototype;
    if (prototype.constructor.name) {
      ClassObject.className = prototype.constructor.name;
      ClassObject.toString = function () {
        return '[Class ' + this.className + ']';
      };
    }
    if (prototype.classMethods) {
      for (a in prototype.classMethods) {
        if (prototype.classMethods.hasOwnProperty(a)) {
          ClassObject[a] = prototype.classMethods[a];
        }
      }
    }
    return ClassObject;
  };

  /* Extends obj with other, or copies obj if no other is given. */
  util.extend = TogetherJS._extend;

  util.forEachAttr = function (obj, callback, context) {
    context = context || obj;
    for (var a in obj) {
      if (obj.hasOwnProperty(a)) {
        callback.call(context, obj[a], a);
      }
    }
  };

  /* Trim whitespace from a string */
  util.trim = function trim(s) {
    return s.replace(/^\s+/, "").replace(/\s+$/, "");
  };

  /* Convert a string into something safe to use as an HTML class name */
  util.safeClassName = function safeClassName(name) {
    return name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "class";
  };

  util.AssertionError = function (message) {
    if (! this instanceof util.AssertionError) {
      return new util.AssertionError(message);
    }
    this.message = message;
    this.name = "AssertionError";
  };
  util.AssertionError.prototype = Error.prototype;

  util.assert = function (cond) {
    if (! cond) {
      var args = ["Assertion error:"].concat(Array.prototype.slice.call(arguments, 1));
      console.error.apply(console, args);
      if (console.trace) {
        console.trace();
      }
      throw new util.AssertionError(args.join(" "));
    }
  };

  /* Generates a random ID */
  util.generateId = function (length) {
    length = length || 10;
    var letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789';
    var s = '';
    for (var i=0; i<length; i++) {
      s += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return s;
  };

  util.pickRandom = function (array) {
    return array[Math.floor(Math.random() * array.length)];
  };

  util.mixinEvents = TogetherJS._mixinEvents;

  util.Module = util.Class({
    constructor: function (name) {
      this._name = name;
    },
    toString: function () {
      return '[Module ' + this._name + ']';
    }
  });

  util.blobToBase64 = function (blob) {
    // Oh this is just terrible
    var binary = '';
    var bytes = new Uint8Array(blob);
    var len = bytes.byteLength;
    for (var i=0; i<len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  util.truncateCommonDomain = function (url, base) {
    /* Remove the scheme and domain from url, if it matches the scheme and domain
       of base */
    if (! base) {
      return url;
    }
    var regex = /^https?:\/\/[^\/]*/i;
    var match = regex.exec(url);
    var matchBase = regex.exec(base);
    if (match && matchBase && match[0] == matchBase[0]) {
      // There is a common scheme and domain
      return url.substr(match[0].length);
    }
    return url;
  };

  util.makeUrlAbsolute = function (url, base) {
    if (url.search(/^(http|https|ws|wss):/i) === 0) {
      // Absolute URL
      return url;
    }
    if (url.search(/^\/\/[^\/]/) === 0) {
      var scheme = (/^(http|https|ws|wss):/i).exec(base);
      util.assert(scheme, "No scheme on base URL", base);
      return scheme[1] + ":" + url;
    }
    if (url.search(/^\//) === 0) {
      var domain = (/^(http|https|ws|wss):\/\/[^\/]+/i).exec(base);
      util.assert(domain, "No scheme/domain on base URL", base);
      return domain[0] + url;
    }
    var last = (/[^\/]+$/).exec(base);
    util.assert(last, "Does not appear to be a URL?", base);
    var lastBase = base.substr(0, last.index);
    return lastBase + url;
  };

  util.assertValidUrl = function (url) {
    /* This does some simple assertions that the url is valid:
       - it must be a string
       - it must be http(s)://... or data:...
       - it must not contain a space, quotation, or close paren
    */
    util.assert(typeof url == "string", "URLs must be a string:", url);
    util.assert(url.search(/^(http:\/\/|https:\/\/|\/\/|data:)/i) === 0,
                "URL must have an http, https, data, or // scheme:", url);
    util.assert(url.search(/[\)\'\"\ ]/) === -1,
                "URLs cannot contain ), ', \", or spaces:", JSON.stringify(url));
  };

  util.resolver = function (deferred, func) {
    util.assert(deferred.then, "Bad deferred:", deferred);
    util.assert(typeof func == "function", "Not a function:", func);
    return function () {
      var result;
      try {
        result = func.apply(this, arguments);
      } catch (e) {
        deferred.reject(e);
        throw e;
      }
      if (result && result.then) {
        result.then(function () {
          deferred.resolveWith(this, arguments);
        }, function () {
          deferred.rejectWith(this, arguments);
        });
        // FIXME: doesn't pass progress through
      } else if (result === undefined) {
        deferred.resolve();
      } else {
        deferred.resolve(result);
      }
      return result;
    };
  };

  /* Detects if a value is a promise.  Right now the presence of a
     `.then()` method is the best we can do.
  */
  util.isPromise = function (obj) {
    return typeof obj == "object" && obj.then;
  };

  /* Makes a value into a promise, by returning an already-resolved
     promise if a non-promise objectx is given.
  */
  util.makePromise = function (obj) {
    if (util.isPromise(obj)) {
      return obj;
    } else {
      return $.Deferred(function (def) {
        def.resolve(obj);
      });
    }
  };

  /* Resolves several promises (the promises are the arguments to the function)
     or the first argument may be an array of promises.

     Returns a promise that will resolve with the results of all the
     promises.  If any promise fails then the returned promise fails.

     FIXME: if a promise has more than one return value (like with
     promise.resolve(a, b)) then the latter arguments will be lost.
     */
  util.resolveMany = function () {
    var args;
    var oneArg = false;
    if (arguments.length == 1 && Array.isArray(arguments[0])) {
      oneArg = true;
      args = arguments[0];
    } else {
      args = Array.prototype.slice.call(arguments);
    }
    return util.Deferred(function (def) {
      var count = args.length;
      if (! count) {
        def.resolve();
        return;
      }
      var allResults = [];
      var anyError = false;
      args.forEach(function (arg, index) {
        arg.then(function (result) {
          allResults[index] = result;
          count--;
          check();
        }, function (error) {
          allResults[index] = error;
          anyError = true;
          count--;
          check();
        });
      });
      function check() {
        if (! count) {
          if (anyError) {
            if (oneArg) {
              def.reject(allResults);
            } else {
              def.reject.apply(def, allResults);
            }
          } else {
            if (oneArg) {
              def.resolve(allResults);
            } else {
              def.resolve.apply(def, allResults);
            }
          }
        }
      }
    });
  };

  util.readFileImage = function (el) {
    return util.Deferred(function (def) {
      var reader = new FileReader();
      reader.onload = function () {
        def.resolve("data:image/jpeg;base64," + util.blobToBase64(this.result));
      };
      reader.onerror = function () {
        def.reject(this.error);
      };
      reader.readAsArrayBuffer(el.files[0]);
    });
  };

  util.matchElement = function(el, selector) {
    var res = selector;
    if (selector === true || ! selector) {
      return !!selector;
    }
    try {
      return $(el).is(selector);
    } catch (e) {
      console.warn("Bad selector:", selector, "error:", e);
      return false;
    }

  };

  util.testExpose = function (objs) {
    if (typeof TogetherJSTestSpy == "undefined") {
      return;
    }
    util.forEachAttr(objs, function (value, attr) {
      TogetherJSTestSpy[attr] = value;
    });
  };

  return util;
});

define('analytics',["util"], function (util) {
  var analytics = util.Module("analytics");

  analytics.activate = function () {
    var enable = TogetherJS.config.get("enableAnalytics");
    var code = TogetherJS.config.get("analyticsCode");
    TogetherJS.config.close("enableAnalytics");
    TogetherJS.config.close("analyticsCode");
    if (! (enable && code)) {
      return;
    }
    // This is intended to be global:
    var gaq = window._gaq || [];
    gaq.push(["_setAccount", code]);
    gaq.push(['_setDomainName', location.hostname]);
    gaq.push(["_trackPageview"]);
    window._gaq = gaq;

    (function() {
      var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
      ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
      var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
    })();
  };

  return analytics;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Channel abstraction.  Supported channels:

- WebSocket to an address
- postMessage between windows

In the future:

- XMLHttpRequest to a server (with some form of queuing)

The interface:

  channel = new ChannelName(parameters)

The instantiation is specific to the kind of channel

Methods:

  onmessage: set to function (jsonData)
  rawdata: set to true if you want onmessage to receive raw string data
  onclose: set to function ()
  send: function (string or jsonData)
  close: function ()

.send() will encode the data if it is not a string.

(should I include readyState as an attribute?)

Channels must accept messages immediately, caching if the connection
is not fully established yet.

*/

define('channels',["util"], function (util) {

var channels = util.Module("channels");
/* Subclasses must define:

- ._send(string)
- ._setupConnection()
- ._ready()
- .close() (and must set this.closed to true)

And must call:

- ._flush() on open
- ._incoming(string) on incoming message
- onclose() (not onmessage - instead _incoming)
- emit("close")
*/

var AbstractChannel = util.mixinEvents({
  onmessage: null,
  rawdata: false,
  onclose: null,
  closed: false,

  baseConstructor: function () {
    this._buffer = [];
    this._setupConnection();
  },

  send: function (data) {
    if (this.closed) {
      throw 'Cannot send to a closed connection';
    }
    if (typeof data != "string") {
      data = JSON.stringify(data);
    }
    if (! this._ready()) {
      this._buffer.push(data);
      return;
    }
    this._send(data);
  },

  _flush: function () {
    for (var i=0; i<this._buffer.length; i++) {
      this._send(this._buffer[i]);
    }
    this._buffer = [];
  },

  _incoming: function (data) {
    if (! this.rawdata) {
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error("Got invalid JSON data:", data.substr(0, 40));
        throw e;
      }
    }
    if (this.onmessage) {
      this.onmessage(data);
    }
    this.emit("message", data);
  }

});


channels.WebSocketChannel = util.Class(AbstractChannel, {

  constructor: function (address) {
    if (address.search(/^https?:/i) === 0) {
      address = address.replace(/^http/i, 'ws');
    }
    this.address = address;
    this.socket = null;
    this._reopening = false;
    this._lastConnectTime = 0;
    this._backoff = 0;
    this.baseConstructor();
  },

  backoffTime: 50, // Milliseconds to add to each reconnect time
  maxBackoffTime: 1500,
  backoffDetection: 2000, // Amount of time since last connection attempt that shows we need to back off

  toString: function () {
    var s = '[WebSocketChannel to ' + this.address;
    if (! this.socket) {
      s += ' (socket unopened)';
    } else {
      s += ' readyState: ' + this.socket.readyState;
    }
    if (this.closed) {
      s += ' CLOSED';
    }
    return s + ']';
  },

  close: function () {
    this.closed = true;
    if (this.socket) {
      // socket.onclose will call this.onclose:
      this.socket.close();
    } else {
      if (this.onclose) {
        this.onclose();
      }
      this.emit("close");
    }
  },

  _send: function (data) {
    this.socket.send(data);
  },

  _ready: function () {
    return this.socket && this.socket.readyState == this.socket.OPEN;
  },

  _setupConnection: function () {
    if (this.closed) {
      return;
    }
    this._lastConnectTime = Date.now();
    this.socket = new WebSocket(this.address);
    this.socket.onopen = (function () {
      this._flush();
      this._reopening = false;
    }).bind(this);
    this.socket.onclose = (function (event) {
      this.socket = null;
      var method = "error";
      if (event.wasClean) {
        // FIXME: should I even log clean closes?
        method = "log";
      }
      console[method]('WebSocket close', event.wasClean ? 'clean' : 'unclean',
                      'code:', event.code, 'reason:', event.reason || 'none');
      if (! this.closed) {
        this._reopening = true;
        if (Date.now() - this._lastConnectTime > this.backoffDetection) {
          this._backoff = 0;
        } else {
          this._backoff++;
        }
        var time = Math.min(this._backoff * this.backoffTime, this.maxBackoffTime);
        setTimeout((function () {
          this._setupConnection();
        }).bind(this), time);
      }
    }).bind(this);
    this.socket.onmessage = (function (event) {
      this._incoming(event.data);
    }).bind(this);
    this.socket.onerror = (function (event) {
      console.error('WebSocket error:', event.data);
    }).bind(this);
  }

});


/* Sends TO a window or iframe */
channels.PostMessageChannel = util.Class(AbstractChannel, {
  _pingPollPeriod: 100, // milliseconds
  _pingPollIncrease: 100, // +100 milliseconds for each failure
  _pingMax: 2000, // up to a max of 2000 milliseconds

  constructor: function (win, expectedOrigin) {
    this.expectedOrigin = expectedOrigin;
    this._pingReceived = false;
    this._receiveMessage = this._receiveMessage.bind(this);
    if (win) {
      this.bindWindow(win, true);
    }
    this._pingFailures = 0;
    this.baseConstructor();
  },

  toString: function () {
    var s = '[PostMessageChannel';
    if (this.window) {
      s += ' to window ' + this.window;
    } else {
      s += ' not bound to a window';
    }
    if (this.window && ! this._pingReceived) {
      s += ' still establishing';
    }
    return s + ']';
  },

  bindWindow: function (win, noSetup) {
    if (this.window) {
      this.close();
      // Though we deinitialized everything, we aren't exactly closed:
      this.closed = false;
    }
    if (win && win.contentWindow) {
      win = win.contentWindow;
    }
    this.window = win;
    // FIXME: The distinction between this.window and window seems unimportant
    // in the case of postMessage
    var w = this.window;
    // In a Content context we add the listener to the local window
    // object, but in the addon context we add the listener to some
    // other window, like the one we were given:
    if (typeof window != "undefined") {
      w = window;
    }
    w.addEventListener("message", this._receiveMessage, false);
    if (! noSetup) {
      this._setupConnection();
    }
  },

  _send: function (data) {
    this.window.postMessage(data, this.expectedOrigin || "*");
  },

  _ready: function () {
    return this.window && this._pingReceived;
  },

  _setupConnection: function () {
    if (this.closed || this._pingReceived || (! this.window)) {
      return;
    }
    this._pingFailures++;
    this._send("hello");
    // We'll keep sending ping messages until we get a reply
    var time = this._pingPollPeriod + (this._pingPollIncrease * this._pingFailures);
    time = time > this._pingPollMax ? this._pingPollMax : time;
    this._pingTimeout = setTimeout(this._setupConnection.bind(this), time);
  },

  _receiveMessage: function (event) {
    if (event.source !== this.window) {
      return;
    }
    if (this.expectedOrigin && event.origin != this.expectedOrigin) {
      console.info("Expected message from", this.expectedOrigin,
                   "but got message from", event.origin);
      return;
    }
    if (! this.expectedOrigin) {
      this.expectedOrigin = event.origin;
    }
    if (event.data == "hello") {
      this._pingReceived = true;
      if (this._pingTimeout) {
        clearTimeout(this._pingTimeout);
        this._pingTimeout = null;
      }
      this._flush();
      return;
    }
    this._incoming(event.data);
  },

  close: function () {
    this.closed = true;
    this._pingReceived = false;
    if (this._pingTimeout) {
      clearTimeout(this._pingTimeout);
    }
    window.removeEventListener("message", this._receiveMessage, false);
    if (this.onclose) {
      this.onclose();
    }
    this.emit("close");
  }

});


/* Handles message FROM an exterior window/parent */
channels.PostMessageIncomingChannel = util.Class(AbstractChannel, {

  constructor: function (expectedOrigin) {
    this.source = null;
    this.expectedOrigin = expectedOrigin;
    this._receiveMessage = this._receiveMessage.bind(this);
    window.addEventListener("message", this._receiveMessage, false);
    this.baseConstructor();
  },

  toString: function () {
    var s = '[PostMessageIncomingChannel';
    if (this.source) {
      s += ' bound to source ' + s;
    } else {
      s += ' awaiting source';
    }
    return s + ']';
  },

  _send: function (data) {
    this.source.postMessage(data, this.expectedOrigin);
  },

  _ready: function () {
    return !!this.source;
  },

  _setupConnection: function () {
  },

  _receiveMessage: function (event) {
    if (this.expectedOrigin && this.expectedOrigin != "*" &&
        event.origin != this.expectedOrigin) {
      // FIXME: Maybe not worth mentioning?
      console.info("Expected message from", this.expectedOrigin,
                   "but got message from", event.origin);
      return;
    }
    if (! this.expectedOrigin) {
      this.expectedOrigin = event.origin;
    }
    if (! this.source) {
      this.source = event.source;
    }
    if (event.data == "hello") {
      // Just a ping
      this.source.postMessage("hello", this.expectedOrigin);
      return;
    }
    this._incoming(event.data);
  },

  close: function () {
    this.closed = true;
    window.removeEventListener("message", this._receiveMessage, false);
    if (this._pingTimeout) {
      clearTimeout(this._pingTimeout);
    }
    if (this.onclose) {
      this.onclose();
    }
    this.emit("close");
  }

});

channels.Router = util.Class(util.mixinEvents({

  constructor: function (channel) {
    this._channelMessage = this._channelMessage.bind(this);
    this._channelClosed = this._channelClosed.bind(this);
    this._routes = Object.create(null);
    if (channel) {
      this.bindChannel(channel);
    }
  },

  bindChannel: function (channel) {
    if (this.channel) {
      this.channel.removeListener("message", this._channelMessage);
      this.channel.removeListener("close", this._channelClosed);
    }
    this.channel = channel;
    this.channel.on("message", this._channelMessage.bind(this));
    this.channel.on("close", this._channelClosed.bind(this));
  },

  _channelMessage: function (msg) {
    if (msg.type == "route") {
      var id = msg.routeId;
      var route = this._routes[id];
      if (! route) {
        console.warn("No route with the id", id);
        return;
      }
      if (msg.close) {
        this._closeRoute(route.id);
      } else {
        if (route.onmessage) {
          route.onmessage(msg.message);
        }
        route.emit("message", msg.message);
      }
    }
  },

  _channelClosed: function () {
    for (var id in this._routes) {
      this._closeRoute(id);
    }
  },

  _closeRoute: function (id) {
    var route = this._routes[id];
    if (route.onclose) {
      route.onclose();
    }
    route.emit("close");
    delete this._routes[id];
  },

  makeRoute: function (id) {
    id = id || util.generateId();
    var route = Route(this, id);
    this._routes[id] = route;
    return route;
  }
}));

var Route = util.Class(util.mixinEvents({
  constructor: function (router, id) {
    this.router = router;
    this.id = id;
  },

  send: function (msg) {
    this.router.channel.send({
      type: "route",
      routeId: this.id,
      message: msg
    });
  },

  close: function () {
    if (this.router._routes[this.id] !== this) {
      // This route instance has been overwritten, so ignore
      return;
    }
    delete this.router._routes[this.id];
  }

}));

return channels;

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('storage',["util"], function (util) {
  var assert = util.assert;
  var Deferred = util.Deferred;
  var DEFAULT_SETTINGS = {
    name: "",
    defaultName: "",
    avatar: null,
    stickyShare: null,
    color: null,
    seenIntroDialog: false,
    seenWalkthrough: false,
    dontShowRtcInfo: false
  };

  var DEBUG_STORAGE = false;

  var Storage = util.Class({
    constructor: function (name, storage, prefix) {
      this.name = name;
      this.storage = storage;
      this.prefix = prefix;
    },

    get: function (key, defaultValue) {
      var self = this;
      return Deferred(function (def) {
        // Strictly this isn't necessary, but eventually I want to move to something more
        // async for the storage, and this simulates that much better.
        setTimeout(util.resolver(def, function () {
          key = self.prefix + key;
          var value = self.storage.getItem(key);
          if (! value) {
            value = defaultValue;
            if (DEBUG_STORAGE) {
              console.debug("Get storage", key, "defaults to", value);
            }
          } else {
            value = JSON.parse(value);
            if (DEBUG_STORAGE) {
              console.debug("Get storage", key, "=", value);
            }
          }
          return value;
        }));
      });
    },

    set: function (key, value) {
      var self = this;
      if (value !== undefined) {
        value = JSON.stringify(value);
      }
      return Deferred(function (def) {
        key = self.prefix + key;
        if (value === undefined) {
          self.storage.removeItem(key);
          if (DEBUG_STORAGE) {
            console.debug("Delete storage", key);
          }
        } else {
          self.storage.setItem(key, value);
          if (DEBUG_STORAGE) {
            console.debug("Set storage", key, value);
          }
        }
        setTimeout(def.resolve);
      });
    },

    clear: function () {
      var self = this;
      var promises = [];
      return Deferred((function (def) {
        this.keys().then(function (keys) {
          keys.forEach(function (key) {
            // FIXME: technically we're ignoring the promise returned by all
            // these sets:
            promises.push(self.set(key, undefined));
          });
          util.resolveMany(promises).then(function () {
            def.resolve();
          });
        });
      }).bind(this));
    },

    keys: function (prefix, excludePrefix) {
      // Returns a list of keys, potentially with the given prefix
      var self = this;
      return Deferred(function (def) {
        setTimeout(util.resolver(def, function () {
          prefix = prefix || "";
          var result = [];
          for (var i = 0; i < self.storage.length; i++) {
            var key = self.storage.key(i);
            if (key.indexOf(self.prefix + prefix) === 0) {
              var shortKey = key.substr(self.prefix.length);
              if (excludePrefix) {
                shortKey = shortKey.substr(prefix.length);
              }
              result.push(shortKey);
            }
          }
          return result;
        }));
      });
    },

    toString: function () {
      return '[storage for ' + this.name + ']';
    }

  });

  var namePrefix = TogetherJS.config.get("storagePrefix");
  TogetherJS.config.close("storagePrefix");

  var storage = Storage('localStorage', localStorage, namePrefix + ".");

  storage.settings = util.mixinEvents({
    defaults: DEFAULT_SETTINGS,

    get: function (name) {
      assert(storage.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
      return storage.get("settings." + name, storage.settings.defaults[name]);
    },

    set: function (name, value) {
      assert(storage.settings.defaults.hasOwnProperty(name), "Unknown setting:", name);
      return storage.set("settings." + name, value);
    }

  });

  storage.tab = Storage('sessionStorage', sessionStorage, namePrefix + "-session.");

  return storage;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('session',["require", "util", "channels", "jquery", "storage"], function (require, util, channels, $, storage) {

  var DEBUG = true;
  // This is the amount of time in which a hello-back must be received after a hello
  // for us to respect a URL change:
  var HELLO_BACK_CUTOFF = 1500;

  var session = util.mixinEvents(util.Module("session"));
  var assert = util.assert;

  // We will load this module later (there's a circular import):
  var peers;

  // This is the hub we connect to:
  session.shareId = null;
  // This is the ID that identifies this client:
  session.clientId = null;
  session.router = channels.Router();
  // Indicates if TogetherJS has just started (not continuing from a saved session):
  session.firstRun = false;

  // This is the key we use for localStorage:
  var localStoragePrefix = "togetherjs.";
  // This is the channel to the hub:
  var channel = null;

  // Setting, essentially global:
  session.AVATAR_SIZE = 90;

  var MAX_SESSION_AGE = 30*24*60*60*1000; // 30 days

  /****************************************
   * URLs
   */
  var includeHashInUrl = TogetherJS.config.get("includeHashInUrl");
  TogetherJS.config.close("includeHashInUrl");
  var currentUrl = (location.href + "").replace(/\#.*$/, "");
  if (includeHashInUrl) {
    currentUrl = location.href;
  }

  session.hubUrl = function (id) {
    id = id || session.shareId;
    assert(id, "URL cannot be resolved before TogetherJS.shareId has been initialized");
    TogetherJS.config.close("hubBase");
    var hubBase = TogetherJS.config.get("hubBase");
    return hubBase.replace(/\/*$/, "") + "/hub/" + id;
  };

  session.shareUrl = function () {
    assert(session.shareId, "Attempted to access shareUrl() before shareId is set");
    var hash = location.hash;
    var m = /\?[^#]*/.exec(location.href);
    var query = "";
    if (m) {
      query = m[0];
    }
    hash = hash.replace(/&?togetherjs-[a-zA-Z0-9]+/, "");
    hash = hash || "#";
    return location.protocol + "//" + location.host + location.pathname + query +
           hash + "&togetherjs=" + session.shareId;
  };

  session.recordUrl = function () {
    assert(session.shareId);
    var url = TogetherJS.baseUrl.replace(/\/*$/, "") + "/togetherjs/recorder.html";
    url += "#&togetherjs=" + session.shareId + "&hubBase=" + TogetherJS.config.get("hubBase");
    return url;
  };

  /* location.href without the hash */
  session.currentUrl = function () {
    if (includeHashInUrl) {
      return location.href;
    } else {
      return location.href.replace(/#.*/, "");
    }
  };

  /****************************************
   * Message handling/dispatching
   */

  session.hub = util.mixinEvents({});

  var IGNORE_MESSAGES = ["cursor-update", "keydown", "scroll-update"];
  // These are messages sent by clients who aren't "part" of the TogetherJS session:
  var MESSAGES_WITHOUT_CLIENTID = ["who", "invite", "init-connection"];

  // We ignore incoming messages from the channel until this is true:
  var readyForMessages = false;

  function openChannel() {
    assert(! channel, "Attempt to re-open channel");
    console.info("Connecting to", session.hubUrl(), location.href);
    var c = channels.WebSocketChannel(session.hubUrl());
    c.onmessage = function (msg) {
      if (! readyForMessages) {
        if (DEBUG) {
          console.info("In (but ignored for being early):", msg);
        }
        return;
      }
      if (DEBUG && IGNORE_MESSAGES.indexOf(msg.type) == -1) {
        console.info("In:", msg);
      }
      if (! peers) {
        // We're getting messages before everything is fully initialized
        console.warn("Message received before all modules loaded (ignoring):", msg);
        return;
      }
      if ((! msg.clientId) && MESSAGES_WITHOUT_CLIENTID.indexOf(msg.type) == -1) {
        console.warn("Got message without clientId, where clientId is required", msg);
        return;
      }
      if (msg.clientId) {
        msg.peer = peers.getPeer(msg.clientId, msg);
      }
      if (msg.type == "hello" || msg.type == "hello-back" || msg.type == "peer-update") {
        // We do this here to make sure this is run before any other
        // hello handlers:
        msg.peer.updateFromHello(msg);
      }
      if (msg.peer) {
        msg.sameUrl = msg.peer.url == currentUrl;
        if (!msg.peer.isSelf) {
          msg.peer.updateMessageDate(msg);
        }
      }
      session.hub.emit(msg.type, msg);
      TogetherJS._onmessage(msg);
    };
    channel = c;
    session.router.bindChannel(channel);
  }

  session.send = function (msg) {
    if (DEBUG && IGNORE_MESSAGES.indexOf(msg.type) == -1) {
      console.info("Send:", msg);
    }
    msg.clientId = session.clientId;
    channel.send(msg);
  };

  session.appSend = function (msg) {
    var type = msg.type;
    if (type.search(/^togetherjs\./) === 0) {
      type = type.substr("togetherjs.".length);
    } else if (type.search(/^app\./) === -1) {
      type = "app." + type;
    }
    msg.type = type;
    session.send(msg);
  };

  /****************************************
   * Standard message responses
   */

  /* Always say hello back, and keep track of peers: */
  session.hub.on("hello hello-back", function (msg) {
    if (msg.type == "hello") {
      sendHello(true);
    }
    if (session.isClient && (! msg.isClient) &&
        session.firstRun && session.timeHelloSent &&
        Date.now() - session.timeHelloSent < HELLO_BACK_CUTOFF) {
      processFirstHello(msg);
    }
  });

  session.hub.on("who", function (msg) {
    sendHello(true);
  });

  function processFirstHello(msg) {
    if (! msg.sameUrl) {
      var url = msg.url;
      if (msg.urlHash) {
        url += msg.urlHash;
      }
      require("ui").showUrlChangeMessage(msg.peer, url);
      location.href = url;
    }
  }

  session.timeHelloSent = null;

  function sendHello(helloBack) {
    var msg = session.makeHelloMessage(helloBack);
    if (! helloBack) {
      session.timeHelloSent = Date.now();
      peers.Self.url = msg.url;
    }
    session.send(msg);
  }

  session.makeHelloMessage = function (helloBack) {
    var msg = {
      name: peers.Self.name || peers.Self.defaultName,
      avatar: peers.Self.avatar,
      color: peers.Self.color,
      url: session.currentUrl(),
      urlHash: location.hash,
      // FIXME: titles update, we should track those changes:
      title: document.title,
      rtcSupported: session.RTCSupported,
      isClient: session.isClient
    };
    if (helloBack) {
      msg.type = "hello-back";
    } else {
      msg.type = "hello";
      msg.clientVersion = TogetherJS.version;
    }
    if (! TogetherJS.startup.continued) {
      msg.starting = true;
    }
    // This is a chance for other modules to effect the hello message:
    session.emit("prepare-hello", msg);
    return msg;
  };
  /****************************************
   * Lifecycle (start and end)
   */

  // These are Javascript files that implement features, and so must
  // be injected at runtime because they aren't pulled in naturally
  // via define().
  // ui must be the first item:
  var features = ["peers", "ui", "chat", "webrtc", "cursor", "startup", "videos", "forms", "visibilityApi", "youtubeVideos"];

  function getRoomName(prefix, maxSize) {
    var findRoom = TogetherJS.config.get("hubBase").replace(/\/*$/, "") + "/findroom";
    return $.ajax({
      url: findRoom,
      dataType: "json",
      data: {prefix: prefix, max: maxSize}
    }).then(function (resp) {
      return resp.name;
    });
  }

  function initIdentityId() {
    return util.Deferred(function (def) {
      if (session.identityId) {
        def.resolve();
        return;
      }
      storage.get("identityId").then(function (identityId) {
        if (! identityId) {
          identityId = util.generateId();
          storage.set("identityId", identityId);
        }
        session.identityId = identityId;
        // We don't actually have to wait for the set to succede, so
        // long as session.identityId is set
        def.resolve();
      });
    });
  }

  initIdentityId.done = initIdentityId();

  function initShareId() {
    return util.Deferred(function (def) {
      var hash = location.hash;
      var shareId = session.shareId;
      var isClient = true;
      var set = true;
      var sessionId;
      session.firstRun = ! TogetherJS.startup.continued;
      if (! shareId) {
        if (TogetherJS.startup._joinShareId) {
          // Like, below, this *also* means we got the shareId from the hash
          // (in togetherjs.js):
          shareId = TogetherJS.startup._joinShareId;
        }
      }
      if (! shareId) {
        // FIXME: I'm not sure if this will ever happen, because togetherjs.js should
        // handle it
        var m = /&?togetherjs=([^&]*)/.exec(hash);
        if (m) {
          isClient = ! m[1];
          shareId = m[2];
          var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
          location.hash = newHash;
        }
      }
      return storage.tab.get("status").then(function (saved) {
        var findRoom = TogetherJS.config.get("findRoom");
        TogetherJS.config.close("findRoom");
        if (findRoom && saved && findRoom != saved.shareId) {
          console.info("Ignoring findRoom in lieu of continued session");
        } else if (findRoom && TogetherJS.startup._joinShareId) {
          console.info("Ignoring findRoom in lieu of explicit invite to session");
        }
        if (findRoom && typeof findRoom == "string" && (! saved) && (! TogetherJS.startup._joinShareId)) {
          isClient = true;
          shareId = findRoom;
          sessionId = util.generateId();
        } else if (findRoom && (! saved) && (! TogetherJS.startup._joinShareId)) {
          assert(findRoom.prefix && typeof findRoom.prefix == "string", "Bad findRoom.prefix", findRoom);
          assert(findRoom.max && typeof findRoom.max == "number" && findRoom.max > 0,
                 "Bad findRoom.max", findRoom);
          sessionId = util.generateId();
          if (findRoom.prefix.search(/[^a-zA-Z0-9]/) != -1) {
            console.warn("Bad value for findRoom.prefix:", JSON.stringify(findRoom.prefix));
          }
          getRoomName(findRoom.prefix, findRoom.max).then(function (shareId) {
            // FIXME: duplicates code below:
            session.clientId = session.identityId + "." + sessionId;
            storage.tab.set("status", {reason: "joined", shareId: shareId, running: true, date: Date.now(), sessionId: sessionId});
            session.isClient = true;
            session.shareId = shareId;
            session.emit("shareId");
            def.resolve(session.shareId);
          });
          return;
        } else if (TogetherJS.startup._launch) {
          if (saved) {
            isClient = saved.reason == "joined";
            if (! shareId) {
              shareId = saved.shareId;
            }
            sessionId = saved.sessionId;
          } else {
            isClient = TogetherJS.startup.reason == "joined";
            assert(! sessionId);
            sessionId = util.generateId();
          }
          if (! shareId) {
            shareId = util.generateId();
          }
        } else if (saved) {
          isClient = saved.reason == "joined";
          TogetherJS.startup.reason = saved.reason;
          TogetherJS.startup.continued = true;
          shareId = saved.shareId;
          sessionId = saved.sessionId;
          // The only case when we don't need to set the storage status again is when
          // we're already set to be running
          set = ! saved.running;
        } else {
          throw new util.AssertionError("No saved status, and no startup._launch request; why did TogetherJS start?");
        }
        assert(session.identityId);
        session.clientId = session.identityId + "." + sessionId;
        if (set) {
          storage.tab.set("status", {reason: TogetherJS.startup.reason, shareId: shareId, running: true, date: Date.now(), sessionId: sessionId});
        }
        session.isClient = isClient;
        session.shareId = shareId;
        session.emit("shareId");
        def.resolve(session.shareId);
      });
    });
  }

  function initStartTarget() {
    var id;
    if (TogetherJS.startup.button) {
      id = TogetherJS.startup.button.id;
      if (id) {
        storage.set("startTarget", id);
      }
      return;
    }
    storage.get("startTarget").then(function (id) {
      var el = document.getElementById(id);
      if (el) {
        TogetherJS.startup.button = el;
      }
    });
  }
  session.start = function () {
    initStartTarget();
    initIdentityId().then(function () {
      initShareId().then(function () {
        readyForMessages = false;
        openChannel();
        require(["ui"], function (ui) {
          TogetherJS.running = true;
          ui.prepareUI();
          require(features, function () {
            $(function () {
              peers = require("peers");
              var startup = require("startup");
              session.emit("start");
              session.once("ui-ready", function () {
                readyForMessages = true;
                startup.start();
              });
              ui.activateUI();
              TogetherJS.config.close("enableAnalytics");
              if (TogetherJS.config.get("enableAnalytics")) {
                require(["analytics"], function (analytics) {
                  analytics.activate();
                });
              }
              peers._SelfLoaded.then(function () {
                sendHello(false);
              });
              TogetherJS.emit("ready");
            });
          });
        });
      });
    });
  };

  session.close = function (reason) {
    TogetherJS.running = false;
    var msg = {type: "bye"};
    if (reason) {
      msg.reason = reason;
    }
    session.send(msg);
    session.emit("close");
    var name = window.name;
    storage.tab.get("status").then(function (saved) {
      if (! saved) {
        console.warn("No session information saved in", "status." + name);
      } else {
        saved.running = false;
        saved.date = Date.now();
        storage.tab.set("status", saved);
      }
      channel.close();
      channel = null;
      session.shareId = null;
      session.emit("shareId");
      TogetherJS.emit("close");
      TogetherJS._teardown();
    });
  };

  session.on("start", function () {
    $(window).on("resize", resizeEvent);
    if (includeHashInUrl) {
      $(window).on("hashchange", hashchangeEvent);
    }
  });

  session.on("close", function () {
    $(window).off("resize", resizeEvent);
    if (includeHashInUrl) {
      $(window).off("hashchange", hashchangeEvent);
    }
  });

  function hashchangeEvent() {
    // needed because when message arives from peer this variable will be checked to
    // decide weather to show actions or not
    sendHello(false);
  }

  function resizeEvent() {
    session.emit("resize");
  }

  if (TogetherJS.startup._launch) {
    setTimeout(session.start);
  }

  util.testExpose({
    getChannel: function () {
      return channel;
    }
  });

  return session;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('templates',["util"], function (util) {
  function clean(t) {
    // Removes <% /* ... */ %> comments:
    t = t.replace(/[<][%]\s*\/\*[\S\s\r\n]*\*\/\s*[%][>]/, "");
    t = util.trim(t);
    t = t.replace(/http:\/\/localhost:8080/g, TogetherJS.baseUrl);
    return t;
  }
  return {
    "interface": clean("<% /*\n   This is basically all the markup and interface for TogetherJS.\n   Note all links should be like http://localhost:8080/togetherjs/*\n   these links are rewritten with the location where TogetherJS was deployed.\n\n   This file is inlined into togetherjs/templates.js\n*/ %>\n<div id=\"togetherjs-container\" class=\"togetherjs\">\n\n  <!-- This is the main set of buttons: -->\n  <div id=\"togetherjs-dock\" class=\"togetherjs-dock-right\">\n    <div id=\"togetherjs-dock-anchor\" title=\"Move the dock\">\n      <span id=\"togetherjs-dock-anchor-horizontal\">\n        <img src=\"http://localhost:8080/togetherjs/images/icn-handle-circle@2x.png\" alt=\"drag\">\n      </span>\n      <span id=\"togetherjs-dock-anchor-vertical\">\n        <img src=\"http://localhost:8080/togetherjs/images/icn-handle-circle@2x.png\" alt=\"drag\">\n      </span>\n    </div>\n    <div id=\"togetherjs-buttons\">\n      <div style=\"display: none\">\n        <button id=\"togetherjs-template-dock-person\" class=\"togetherjs-button togetherjs-dock-person\">\n          <div class=\"togetherjs-tooltip togetherjs-dock-person-tooltip\">\n            <span class=\"togetherjs-person-name\"></span>\n            <span class=\"togetherjs-person-tooltip-arrow-r\"></span>\n          </div>\n          <div class=\"togetherjs-person togetherjs-person-status-overlay\"></div>\n        </button>\n      </div>\n      <button id=\"togetherjs-profile-button\" class=\"togetherjs-button\" title=\"This is you\">\n        <div class=\"togetherjs-person togetherjs-person-self\"></div>\n        <div id=\"togetherjs-profile-arrow\"></div>\n      </button>\n      <button id=\"togetherjs-share-button\" class=\"togetherjs-button\" title=\"Add a friend\"></button>\n      <button id=\"togetherjs-audio-button\" class=\"togetherjs-button\" title=\"Turn on microphone\">\n        <span id=\"togetherjs-audio-unavailable\" class=\"togetherjs-audio-set\" data-toggles=\".togetherjs-audio-set\">\n        </span>\n        <span id=\"togetherjs-audio-ready\" class=\"togetherjs-audio-set\" data-toggles=\".togetherjs-audio-set\" style=\"display: none\">\n        </span>\n        <span id=\"togetherjs-audio-outgoing\" class=\"togetherjs-audio-set\" data-toggles=\".togetherjs-audio-set\" style=\"display: none\">\n        </span>\n        <span id=\"togetherjs-audio-incoming\" class=\"togetherjs-audio-set\" data-toggles=\".togetherjs-audio-set\" style=\"display: none\">\n        </span>\n        <span id=\"togetherjs-audio-active\" class=\"togetherjs-audio-set\" data-toggles=\".togetherjs-audio-set\" style=\"display: none\">\n        </span>\n        <span id=\"togetherjs-audio-muted\" class=\"togetherjs-audio-set\" data-toggles=\".togetherjs-audio-set\" style=\"display: none\">\n        </span>\n        <span id=\"togetherjs-audio-error\" class=\"togetherjs-audio-set\" data-toggles=\".togetherjs-audio-set\" style=\"display: none\">\n        </span>\n      </button>\n      <button id=\"togetherjs-chat-button\" class=\"togetherjs-button\" title=\"Chat\"></button>\n      <div id=\"togetherjs-dock-participants\"></div>\n    </div>\n  </div>\n\n  <!-- The window for editing the avatar: -->\n  <div id=\"togetherjs-avatar-edit\" class=\"togetherjs-modal\"\n       style=\"display: none\">\n    <header> Update avatar </header>\n    <section>\n      <div class=\"togetherjs-avatar-preview togetherjs-person togetherjs-person-self\"></div>\n      <div id=\"togetherjs-avatar-buttons\">\n        <input type=\"file\" class=\"togetherjs-upload-avatar\">\n        <!--<button id=\"togetherjs-upload-avatar\" class=\"togetherjs-primary\">Upload a picture</button>-->\n        <!--<button id=\"togetherjs-camera-avatar\" class=\"togetherjs-default\">Take a picture</button>-->\n      </div>\n    </section>\n    <section class=\"togetherjs-buttons\">\n      <button class=\"togetherjs-cancel togetherjs-dismiss\">Cancel</button>\n      <span class=\"togetherjs-alt-text\">or</span>\n      <button class=\"togetherjs-avatar-save togetherjs-primary\">Save</button>\n    </section>\n  </div>\n\n  <!-- The window for sharing the link: -->\n  <div id=\"togetherjs-share\" class=\"togetherjs-window\"\n       data-bind-to=\"#togetherjs-share-button\" style=\"display: none\">\n    <header> Invite a friend </header>\n    <section>\n      <div class=\"togetherjs-not-mobile\">\n        <p>Copy and paste this link over IM or email:</p>\n        <input type=\"text\" class=\"togetherjs-share-link\">\n      </div>\n      <div class=\"togetherjs-only-mobile\">\n        <p>Copy and paste this link over IM or email:</p>\n        <input type=\"text\" class=\"togetherjs-share-link\">\n        <!-- <a class=\"togetherjs-share-link\" href=\"#\">Press your thumb here.</a> -->\n      </div>\n    </section>\n  </div>\n\n  <!-- Participant Full List view template: -->\n  <div id=\"togetherjs-participantlist\" class=\"togetherjs-window\"\n       data-bind-to=\"#togetherjs-participantlist-button\" style=\"display: none\">\n    <header> Participants </header>\n    <section>\n      <div class=\"togetherjs-not-mobile\">\n        <ul>\n          <li id=\"togetherjs-participant-item\">\n            <img class=\"togetherjs-person togetherjs-person-small\" src=\"http://localhost:8080/togetherjs/images/btn-menu-change-avatar.png\">\n            <span class=\"tj-name togetherjs-person-name\">Useronewith alongname</span>\n            <span class=\"tj-status\">&#9679;</span>\n            <p class=\"tj-urllocation\">Currently at: <a class=\"togetherjs-person-url togetherjs-person-url-title\" href=\"\">http://www.location.comwww.location.comwww.location.comasdfsafd</a></p>\n            <p class=\"tj-follow\">Follow:\n              <label class=\"togetherjs-follow-question\" for=\"togetherjs-person-status-follow\">\n                <input type=\"checkbox\" id=\"togetherjs-person-status-follow\">\n              </label>\n            </p>\n            <section class=\"togetherjs-buttons\">\n              <!-- Displayed when the peer is at a different URL: -->\n              <div class=\"togetherjs-different-url\">\n                <a class=\"togetherjs-nudge togetherjs-default tj-btn-sm\">Nudge them</a>\n                <a href=\"#\" class=\"togetherjs-follow togetherjs-person-url togetherjs-primary tj-btn-sm\">Join them</a>\n              </div>\n              <!-- Displayed when the peer is at your same URL: -->\n              <div class=\"togetherjs-same-url\" style=\"display: none\">\n                <span class=\"togetherjs-person-name\"></span> is on the same page as you.\n              </div>\n            </section>\n          </li>\n        </ul>\n    </section>\n  </div>\n\n  <!-- Participant detail template: -->\n  <div id=\"togetherjs-template-participant-window\" class=\"togetherjs-window\" style=\"display: none\">\n    <header><div class=\"togetherjs-person togetherjs-person-small\"></div><span class=\"togetherjs-person-name\"></span></header>\n\n    <section class=\"togetherjs-participant-window-main\">\n      <p class=\"togetherjs-participant-window-row\"><strong>Role:</strong>\n        <span class=\"togetherjs-person-role\"></span>\n      </p>\n\n      <p class=\"togetherjs-participant-window-row\"><strong>Currently at:</strong>\n        <a class=\"togetherjs-person-url togetherjs-person-url-title\"></a>\n      </p>\n\n      <p class=\"togetherjs-participant-window-row\"><strong>Status:</strong>\n        <span class=\"togetherjs-person-status\"></span>\n      </p>\n\n      <p class=\"togetherjs-participant-window-row\"><strong class=\"togetherjs-float-left\">Follow this participant:</strong>\n        <label class=\"togetherjs-follow-question togetherjs-float-left\" for=\"togetherjs-person-status-follow\">\n          <input type=\"checkbox\" id=\"togetherjs-person-status-follow\">\n        </label>\n        <span class=\"togetherjs-clear\"></span>\n      </p>\n\n    </section>\n\n    <section class=\"togetherjs-buttons\">\n      <!-- Displayed when the peer is at a different URL: -->\n      <div class=\"togetherjs-different-url\">\n        <a class=\"togetherjs-nudge togetherjs-default\">Nudge them</a>\n        <a href=\"#\" class=\"togetherjs-follow togetherjs-person-url togetherjs-primary\">Join them</a>\n      </div>\n      <!-- Displayed when the peer is at your same URL: -->\n      <div class=\"togetherjs-same-url\" style=\"display: none\">\n        <span class=\"togetherjs-person-name\"></span> is on the same page as you.\n      </div>\n    </section>\n  </div>\n\n  <!-- The chat screen: -->\n  <div id=\"togetherjs-chat\" class=\"togetherjs-window\" data-bind-to=\"#togetherjs-chat-button\"\n       style=\"display: none\">\n    <header> Chat </header>\n    <section class=\"togetherjs-subtitle\">\n      <div id=\"togetherjs-chat-participants\" data-toggles=\"#togetherjs-chat-no-participants\" style=\"display: none\">\n        <span id=\"togetherjs-chat-participant-list\"></span>\n        &amp; You\n      </div>\n      <div id=\"togetherjs-chat-no-participants\" data-toggles=\"#togetherjs-chat-participants\">\n        No one else is here.\n      </div>\n    </section>\n\n    <div style=\"display: none\">\n\n      <!-- Template for one message: -->\n      <div id=\"togetherjs-template-chat-message\" class=\"togetherjs-chat-item togetherjs-chat-message\">\n        <div class=\"togetherjs-person\"></div>\n        <div class=\"togetherjs-timestamp\"><span class=\"togetherjs-time\">HH:MM</span> <span class=\"togetherjs-ampm\">AM/PM</span></div>\n        <div class=\"togetherjs-person-name-abbrev\"></div>\n        <div class=\"togetherjs-chat-content togetherjs-sub-content\"></div>\n      </div>\n\n      <!-- Template for when a person leaves: -->\n      <div id=\"togetherjs-template-chat-left\" class=\"togetherjs-chat-item togetherjs-chat-left-item\">\n        <div class=\"togetherjs-person\"></div>\n        <div class=\"togetherjs-ifnot-declinedJoin\">\n          <div class=\"togetherjs-inline-text\"><span class=\"togetherjs-person-name\"></span> left the session.</div>\n        </div>\n        <div class=\"togetherjs-if-declinedJoin\">\n          <div class=\"togetherjs-inline-text\"><span class=\"togetherjs-person-name\"></span> declined to join the session.</div>\n        </div>\n        <div class=\"togetherjs-clear\"></div>\n      </div>\n\n      <!-- Template when a person joins the session: -->\n      <div id=\"togetherjs-template-chat-joined\" class=\"togetherjs-chat-item togetherjs-chat-join-item\">\n        <div class=\"togetherjs-person\"></div>\n        <div class=\"togetherjs-inline-text\"><span class=\"togetherjs-person-name\"></span> joined the session.</div>\n        <div class=\"togetherjs-clear\"></div>\n      </div>\n\n      <!-- Template for system-derived messages: -->\n      <div id=\"togetherjs-template-chat-system\" class=\"togetherjs-chat-item\">\n        <span class=\"togetherjs-chat-content togetherjs-sub-content\"></span>\n      </div>\n\n      <!-- Template when a person joins the session: -->\n      <!-- <div id=\"togetherjs-template-chat-joined\" class=\"togetherjs-chat-item togetherjs-chat-join-item\">\n        <div class=\"togetherjs-person\"></div>\n        <div class=\"togetherjs-inline-text\"><span class=\"togetherjs-person-name\"></span> joined the session.</div>\n        <div class=\"togetherjs-clear\"></div>\n      </div> -->\n\n      <!-- Template for when someone goes to a new URL: -->\n      <div id=\"togetherjs-template-url-change\" class=\"togetherjs-chat-item togetherjs-chat-url-change\">\n        <div class=\"togetherjs-person\"></div>\n        <div class=\"togetherjs-inline-text\">\n          <div class=\"togetherjs-if-sameUrl\">\n            <span class=\"togetherjs-person-name\"></span>\n            is on the same page as you.\n          </div>\n          <div class=\"togetherjs-ifnot-sameUrl\">\n            <span class=\"togetherjs-person-name\"></span>\n            has gone to: <a href=\"#\" class=\"togetherjs-person-url togetherjs-person-url-title\" target=\"_self\"></a>\n            <section class=\"togetherjs-buttons togetherjs-buttons-notification-diff-url\">\n              <!-- Displayed when the peer is at a different URL: -->\n              <div class=\"togetherjs-different-url togetherjs-notification-diff-url\">\n                <a class=\"togetherjs-nudge togetherjs-default\">Nudge them</a>\n                <a href=\"#\" class=\"togetherjs-follow togetherjs-person-url togetherjs-primary\">Join them</a>\n              </div>\n            </section>\n\n            <!-- <div>\n              <a class=\"togetherjs-nudge togetherjs-secondary\">Nudge them</a>\n              <a href=\"\" class=\"togetherjs-person-url togetherjs-follow togetherjs-primary\">Join them</a>\n            </div> -->\n\n          </div>\n        </div>\n        <div class=\"togetherjs-clear\"></div>\n      </div>\n    </div>\n\n    <section id=\"togetherjs-chat-messages\">\n      <!-- FIX ME// need to have some dialogue that says something like - There are no chats yet! -->\n    </section>\n    <section id=\"togetherjs-chat-input-box\">\n      <textarea id=\"togetherjs-chat-input\" placeholder=\"Type your message here\"></textarea>\n    </section>\n  </div>\n\n  <!-- this is a kind of warning popped up when you (successfully) start RTC: -->\n  <div id=\"togetherjs-rtc-info\" class=\"togetherjs-window\"\n       data-bind-to=\"#togetherjs-audio-button\"\n       style=\"display: none\">\n\n    <header> Audio Chat </header>\n    <section>\n      <p>\n        Activate your <strong>browser microphone</strong> near your URL bar above.\n      </p>\n      <p>\n        Talking on your microphone through your web browser is an experimental feature.\n      </p>\n      <p>\n        Read more about Audio Chat <a href=\"https://github.com/mozilla/togetherjs/wiki/About-Audio-Chat-and-WebRTC\" target=\"_blank\">here</a>.\n      </p>\n    </section>\n\n    <section class=\"togetherjs-buttons\">\n      <label for=\"togetherjs-rtc-info-dismiss\" style=\"display: inline;\">\n        <input class=\"togetherjs-dont-show-again\" id=\"togetherjs-rtc-info-dismiss\" type=\"checkbox\">\n        Don't show again.\n      </label>\n      <button class=\"togetherjs-default togetherjs-dismiss\" type=\"button\">Close</button>\n    </section>\n  </div>\n\n  <!-- this is popped up when you hit the audio button, but RTC isn't\n  supported: -->\n  <div id=\"togetherjs-rtc-not-supported\" class=\"togetherjs-window\"\n       data-bind-to=\"#togetherjs-audio-button\"\n       style=\"display: none\">\n    <header> Audio Chat </header>\n\n    <section>\n      <p>Audio chat requires you to use a <a href=\"https://github.com/mozilla/togetherjs/wiki/About-Audio-Chat-and-WebRTC\" target=\"_blank\">\n        newer browser\n      </a>!</p>\n      <p>\n        Live audio chat requires a newer (or different) browser than you're using.\n      </p>\n      <p>\n        See\n        <a href=\"https://github.com/mozilla/togetherjs/wiki/About-Audio-Chat-and-WebRTC\" target=\"_blank\">\n          this page\n        </a>\n        for more information and a list of supported browsers.\n      </p>\n    </section>\n\n    <section class=\"togetherjs-buttons\">\n      <div class=\"togetherjs-rtc-dialog-btn\">\n        <button class=\"togetherjs-default togetherjs-dismiss\" type=\"button\">Close</button>\n      </div>\n    </section>\n  </div>\n\n  <!-- The popup when a chat message comes in and the #togetherjs-chat window isn't open -->\n  <div id=\"togetherjs-chat-notifier\" class=\"togetherjs-notification\"\n       data-bind-to=\"#togetherjs-chat-button\"\n       style=\"display: none\">\n    <img src=\"http://localhost:8080/togetherjs/images/notification-togetherjs-logo.png\" class=\"togetherjs-notification-logo\" alt=\"\">\n    <img src=\"http://localhost:8080/togetherjs/images/notification-btn-close.png\" class=\"togetherjs-notification-closebtn togetherjs-dismiss\" alt=\"[close]\">\n    <section id=\"togetherjs-chat-notifier-message\">\n    </section>\n  </div>\n\n  <!-- The menu when you click on the profile: -->\n  <div id=\"togetherjs-menu\" class=\"togetherjs-menu\" style=\"display: none\">\n    <div class=\"togetherjs-menu-item togetherjs-menu-disabled\" id=\"togetherjs-menu-profile\">\n      <img id=\"togetherjs-menu-avatar\">\n      <span class=\"togetherjs-person-name-self\" id=\"togetherjs-self-name-display\" data-toggles=\"#togetherjs-menu .togetherjs-self-name\"></span>\n      <input class=\"togetherjs-self-name\" type=\"text\" data-toggles=\"#togetherjs-self-name-display\" style=\"display: none\" placeholder=\"Enter your name\">\n    </div>\n    <div class=\"togetherjs-menu-hr-avatar\"></div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-update-name\"><img src=\"http://localhost:8080/togetherjs/images/button-pencil.png\" alt=\"\"> Update your name</div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-update-avatar\"><img src=\"http://localhost:8080/togetherjs/images/btn-menu-change-avatar.png\" alt=\"\"> Change avatar</div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-update-color\"><span class=\"togetherjs-person-bgcolor-self\"></span> Pick profile color</div>\n    <div class=\"togetherjs-hr\"></div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-help\">Help</div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-feedback\">Feedback</div>\n    <div id=\"togetherjs-invite\" style=\"display: none\">\n      <div class=\"togetherjs-hr\"></div>\n      <div id=\"togetherjs-invite-users\"></div>\n      <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-refresh-invite\">Refresh users</div>\n      <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-invite-anyone\">Invite anyone</div>\n    </div>\n    <div class=\"togetherjs-hr\"></div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-end\"><img src=\"http://localhost:8080/togetherjs/images/button-end-session.png\" alt=\"\"> End <span class=\"togetherjs-tool-name\">TogetherJS</span></div>\n  </div>\n\n  <!-- template for one person in the invite-users list -->\n  <div style=\"display: none\">\n    <div id=\"togetherjs-template-invite-user-item\" class=\"togetherjs-menu-item\">\n      <!-- FIXME: should include avatar in some way -->\n      <span class=\"togetherjs-person-name\"></span>\n    </div>\n  </div>\n\n  <!-- A window version of #togetherjs-menu, for use on mobile -->\n  <div id=\"togetherjs-menu-window\" class=\"togetherjs-window\" style=\"display: none\">\n    <header>Settings and Profile</header>\n    <section>\n    <div class=\"togetherjs-menu-item\">\n      <img class=\"togetherjs-menu-avatar\">\n      <span class=\"togetherjs-person-name-self\" id=\"togetherjs-self-name-display\"></span>\n    </div>\n    <div class=\"togetherjs-menu-hr-avatar\"></div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-update-name-button\"><img src=\"http://localhost:8080/togetherjs/images/button-pencil.png\" alt=\"\"> Update your name</div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-update-avatar-button\"><img src=\"http://localhost:8080/togetherjs/images/btn-menu-change-avatar.png\" alt=\"\"> Change avatar</div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-update-color-button\"><span class=\"togetherjs-person-bgcolor-self\"></span> Pick profile color</div>\n    <div class=\"togetherjs-hr\"></div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-help-button\">Help</div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-feedback-button\">Feedback</div>\n    <div class=\"togetherjs-hr\"></div>\n    <div class=\"togetherjs-menu-item\" id=\"togetherjs-menu-end-button\"><img src=\"http://localhost:8080/togetherjs/images/button-end-session.png\" alt=\"\"> End <span class=\"togetherjs-tool-name\">TogetherJS</span></div>\n    </section>\n    <section class=\"togetherjs-buttons\">\n      <button class=\"togetherjs-dismiss togetherjs-primary\">OK</button>\n    </section>\n  </div>\n\n  <!-- The name editor, for use on mobile -->\n  <div id=\"togetherjs-edit-name-window\" class=\"togetherjs-window\" style=\"display: none\">\n    <header>Update Name</header>\n    <section>\n      <div>\n        <input class=\"togetherjs-self-name\" type=\"text\" placeholder=\"Enter your name\">\n      </div>\n    </section>\n    <section class=\"togetherjs-buttons\">\n      <button class=\"togetherjs-dismiss togetherjs-primary\">OK</button>\n    </section>\n  </div>\n\n  <div class=\"togetherjs-menu\" id=\"togetherjs-pick-color\" style=\"display: none\">\n    <div class=\"togetherjs-triangle-up\"><img src=\"http://localhost:8080/togetherjs/images/icn-triangle-up.png\"></div>\n    <div style=\"display: none\">\n      <div id=\"togetherjs-template-swatch\" class=\"togetherjs-swatch\">\n      </div>\n    </div>\n  </div>\n\n  <!-- Invisible elements that handle the RTC audio: -->\n  <audio id=\"togetherjs-audio-element\"></audio>\n  <audio id=\"togetherjs-local-audio\" muted=\"true\" volume=\"0.3\"></audio>\n  <audio id=\"togetherjs-notification\" src=\"http://localhost:8080/togetherjs/images/notification.ogg\"></audio>\n\n  <!-- The intro screen for someone who joins a session the first time: -->\n  <div id=\"togetherjs-intro\" class=\"togetherjs-modal\" style=\"display: none\">\n    <header>Join <span class=\"togetherjs-tool-name\">TogetherJS</span> session?</header>\n    <section>\n      <p>Your friend has asked you to join their <a href=\"https://togetherjs.mozillalabs.com/\" target=\"_blank\"><span class=\"togetherjs-tool-name\">TogetherJS</span></a> browser session to collaborate in real-time!</p>\n\n      <p>Would you like to join their session?</p>\n    </section>\n\n    <section class=\"togetherjs-buttons\">\n      <button class=\"togetherjs-destructive togetherjs-modal-dont-join\">No, don't join</button>\n      <button class=\"togetherjs-primary togetherjs-dismiss\">Yes, join session</button>\n    </section>\n  </div>\n\n  <!-- Shown when a web browser is completely incapable of running TogetherJS: -->\n  <div id=\"togetherjs-browser-broken\" class=\"togetherjs-modal\" style=\"display: none\">\n    <header> Sorry </header>\n\n    <section>\n      <p>\n        We're sorry, <span class=\"togetherjs-tool-name\">TogetherJS</span> doesn't work with this browser.  Please\n        <a href=\"https://github.com/mozilla/togetherjs/wiki/Supported-Browsers#supported-browsers\">upgrade\n          to a supported browser</a> to try <span class=\"togetherjs-tool-name\">TogetherJS</span>.\n      </p>\n\n      <p id=\"togetherjs-browser-broken-is-ie\" style=\"display: none\">\n        We need your help fixing TogetherJS on Internet Explorer!  Here are a list of IE <a href=\"https://github.com/mozilla/togetherjs/issues?labels=IE&milestone=&page=1&state=open\" target=\"_blank\">GitHub issues</a> we need fixed that you can work on.\n        Internet Explorer <a href=\"https://github.com/mozilla/togetherjs/wiki/Supported-Browsers#internet-explorer\">is\n          currently not supported</a>.  If you do want to try out TogetherJS, we'd suggest using Firefox or Chrome.\n      </p>\n    </section>\n\n    <section class=\"togetherjs-buttons\">\n      <button class=\"togetherjs-dismiss togetherjs-primary\">End <span class=\"togetherjs-tool-name\">TogetherJS</span></button>\n    </section>\n\n  </div>\n\n  <!-- Shown when the browser has WebSockets, but is IE (i.e., IE10) -->\n  <div id=\"togetherjs-browser-unsupported\" class=\"togetherjs-modal\" style=\"display: none\">\n    <header> Unsupported Browser </header>\n\n    <section>\n      <p>\n        We need your help fixing TogetherJS on Internet Explorer!  Here are a list of IE <a href=\"https://github.com/mozilla/togetherjs/issues?labels=IE&milestone=&page=1&state=open\" target=\"_blank\">GitHub issues</a> we need fixed that you can work on.\n        Internet Explorer <a href=\"https://github.com/mozilla/togetherjs/wiki/Supported-Browsers#internet-explorer\">is not supported</a>\n        at this time.  While we may add support later, adding support is\n        not currently on our roadmap.  If you do want to try out TogetherJS, we'd suggest using Firefox or Chrome.\n      </p>\n\n      <p>You can continue to try to use <span class=\"togetherjs-tool-name\">TogetherJS</span>, but you are likely to hit\n        lots of bugs.  So be warned.</p>\n\n    </section>\n\n    <section class=\"togetherjs-buttons\">\n      <button class=\"togetherjs-dismiss togetherjs-primary\">End <span class=\"togetherjs-tool-name\">TogetherJS</span></button>\n      <button class=\"togetherjs-dismiss togetherjs-secondary togetherjs-browser-unsupported-anyway\">Try <span class=\"togetherjs-tool-name\">TogetherJS</span> Anyway</button>\n    </section>\n\n  </div>\n\n  <div id=\"togetherjs-confirm-end\" class=\"togetherjs-modal\" style=\"display: none\">\n    <header> End session? </header>\n    <section>\n      <p>\n        Are you sure you'd like to end your <span class=\"togetherjs-tool-name\">TogetherJS</span> session?\n      </p>\n    </section>\n    <section class=\"togetherjs-buttons\">\n      <button class=\"togetherjs-cancel togetherjs-dismiss\">Cancel</button>\n      <span class=\"togetherjs-alt-text\">or</span>\n      <button id=\"togetherjs-end-session\" class=\"togetherjs-destructive\">End session</button>\n    </section>\n  </div>\n\n  <div id=\"togetherjs-feedback-form\" class=\"togetherjs-modal\" style=\"display: none;\">\n    <header> Feedback </header>\n    <iframe src=\"https://docs.google.com/a/mozilla.com/forms/d/1lVE7JyRo_tjakN0mLG1Cd9X9vseBX9wci153z9JcNEs/viewform?embedded=true\" width=\"400\" height=\"300\" frameborder=\"0\" marginheight=\"0\" marginwidth=\"0\">Loading form...</iframe>\n    <!-- <p><button class=\"togetherjs-modal-close\">Close</button></p> -->\n  </div>\n\n  <div style=\"display: none\">\n    <!-- This is when you join a session and the other person has already changed to another URL: -->\n    <div id=\"togetherjs-template-url-change\" class=\"togetherjs-modal\">\n      <header> Following to new URL... </header>\n      <section>\n        <div class=\"togetherjs-person\"></div>\n        Following\n        <span class=\"togetherjs-person-name\"></span>\n        to <a href=\"\" class=\"togetherjs-person-url togetherjs-person-url-title\"></a>\n      </section>\n    </div>\n\n    <!-- This is when someone invites you to their session: -->\n    <div id=\"togetherjs-template-invite\" class=\"togetherjs-chat-item\">\n      <div class=\"togetherjs-person\"></div>\n      <div>\n        <span class=\"togetherjs-person-name\"></span>\n        has invited <strong class=\"togetherjs-if-forEveryone\">anyone</strong>\n        <strong class=\"togetherjs-ifnot-forEveryone\">you</strong>\n        to <a href=\"\" data-togetherjs-subattr-href=\"href\" class=\"togetherjs-sub-hrefTitle\" target=\"_blank\"></a>\n      </div>\n    </div>\n\n  </div>\n\n  <!-- The pointer at the side of a window: -->\n  <div id=\"togetherjs-window-pointer-right\" style=\"display: none\"></div>\n  <div id=\"togetherjs-window-pointer-left\" style=\"display: none\"></div>\n\n  <!-- The element that overlaps the background of the page during a modal dialog: -->\n  <div id=\"togetherjs-modal-background\" style=\"display: none\"></div>\n\n  <!-- Some miscellaneous templates -->\n  <div style=\"display: none\">\n\n    <!-- This is the cursor: -->\n    <div id=\"togetherjs-template-cursor\" class=\"togetherjs-cursor togetherjs\">\n      <!-- Note: images/cursor.svg is a copy of this (for editing): -->\n      <!-- crossbrowser svg dropshadow http://demosthenes.info/blog/600/Creating-a-True-CrossBrowser-Drop-Shadow- -->\n      <svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\n      \t width=\"15px\" height=\"22.838px\" viewBox=\"96.344 146.692 15 22.838\" enable-background=\"new 96.344 146.692 15 22.838\"\n      \t xml:space=\"preserve\">\n      <path fill=\"#231F20\" d=\"M98.984,146.692c2.167,1.322,1.624,6.067,3.773,7.298c-0.072-0.488,2.512-0.931,3.097,0\n      \tc0.503,0.337,1.104-0.846,2.653,0.443c0.555,0.593,3.258,2.179,1.001,8.851c-0.446,1.316,2.854,0.135,1.169,2.619\n      \tc-3.748,5.521-9.455,2.787-9.062,1.746c1.06-2.809-6.889-4.885-4.97-9.896c0.834-2.559,2.898,0.653,2.923,0.29\n      \tc-0.434-1.07-2.608-5.541-2.923-6.985C96.587,150.793,95.342,147.033,98.984,146.692z\"/>\n      </svg>\n      <!-- <img class=\"togetherjs-cursor-img\" src=\"http://localhost:8080/togetherjs/images/cursor.svg\"> -->\n      <span class=\"togetherjs-cursor-container\">\n        <span class=\"togetherjs-cursor-name\"></span>\n        <span style=\"display:none\" class=\"togetherjs-cursor-typing\" id=\"togetherjs-cursor-typebox\">\n          <span class=\"togetherjs-typing-ellipse-one\">&#9679;</span><span class=\"togetherjs-typing-ellipse-two\">&#9679;</span><span class=\"togetherjs-typing-ellipse-three\">&#9679;</span>\n        </span>\n        <!-- Displayed when the cursor is below the screen: -->\n        <span class=\"togetherjs-cursor-down\">\n\n        </span>\n        <!-- Displayed when the cursor is above the screen: -->\n        <span class=\"togetherjs-cursor-up\">\n\n        </span>\n      </span>\n    </div>\n\n    <!-- This is the element that goes around focused form elements: -->\n    <div id=\"togetherjs-template-focus\">\n      <div class=\"togetherjs-focus togetherjs-person-bordercolor\"></div>\n    </div>\n\n    <!-- This is a click: -->\n    <div id=\"togetherjs-template-click\" class=\"togetherjs-click togetherjs\">\n    </div>\n  </div>\n</div>\n"),
    help: clean("<% /*\n  This is used to show the help when you type /help.  Used in\n  TogetherJS.localChatMessage().\n\n*/ %>\n/help : this message\n/test : run an automated/randomized test (or stop one that is in progress)\n  /test start N : run N times (instead of default 100)\n  /test show : show what kind of actions the random test would take (or stop showing)\n  /test describe : describe the possible actions (instead of showing them)\n/clear : clear the chat area\n/record : open up a recorder for the session\n/playback URL : play back a session that was recorded (it's up to you to figure out how to host it)\n  /playback local:NAME : play a locally saved log\n/savelogs NAME : save the currently recorded logs under NAME (recorder must be open)\n/baseurl : set a local baseUrl to load TogetherJS from, for debugging a development version of TogetherJS.\n/config : override some TogetherJS configuration parameters\n  /config VAR VALUE : set TogetherJS.config(\"VAR\", VALUE).  VALUE must be a legal Javascript/JSON literal.\n  /config clear : remove all overridden configuration\n"),
    walkthrough: clean("<!--\n    Any elements with .togetherjs-walkthrough-firsttime will only be\n    displayed on during the first-time experience.  Any elements with\n    .togetherjs-walkthrough-not-firsttime will only be displayed when\n    the walkthrough is accessed through the Help menu.\n\n    Note you *cannot* use <section class=\"togetherjs-walkthrough-slide\n    togetherjs-walkthrough-firsttime\">: the number of sections must be the\n    same regardless.\n  -->\n<div id=\"togetherjs-walkthrough\" class=\"togetherjs-modal togetherjs-modal-wide\">\n  <header>You're using <span class=\"togetherjs-tool-name\">TogetherJS</span>!<button class=\"togetherjs-close\"></button></header>\n\n  <div id=\"togetherjs-walkthrough-previous\"></div>\n  <div id=\"togetherjs-walkthrough-next\"></div>\n\n  <section class=\"togetherjs-walkthrough-slide\">\n    <p class=\"togetherjs-walkthrough-main-image\"><img src=\"http://localhost:8080/togetherjs/images/walkthrough-images-intro.png\"></p>\n\t<p><span class=\"togetherjs-tool-name\">TogetherJS</span> is a service for your website that makes it easy to collaborate in real-time on: <strong class=\"togetherjs-site-name\">[site name]</strong></p>\n  </section>\n\n  <section class=\"togetherjs-walkthrough-slide\">\n    <div class=\"togetherjs-walkthrough-firsttime\">\n      <div class=\"togetherjs-walkthrough-main-image\">\n        <div class=\"togetherjs-walkthrough-avatar-section\">\n          <div class=\"togetherjs-avatar-preview togetherjs-person togetherjs-person-self\"></div>\n          <div class=\"togetherjs-avatar-upload-input\"><input type=\"file\" class=\"togetherjs-upload-avatar\"></div>\n        </div>\n        <input class=\"togetherjs-self-name\" type=\"text\" placeholder=\"Enter your name\">\n        <div class=\"togetherjs-swatch togetherjs-person-bgcolor-self\"></div>\n        <div class=\"togetherjs-save-settings\">\n          <button class=\"togetherjs-avatar-save togetherjs-primary\">\n            <span id=\"togetherjs-avatar-when-unsaved\">Save</span>\n            <span id=\"togetherjs-avatar-when-saved\" style=\"display: none\">Saved!</span>\n          </button>\n        </div>\n      </div>\n      <p>Set up your avatar, name and user color above.  If you'd like to update it later, you can click your Profile button.</p>\n    </div>\n    <div class=\"togetherjs-walkthrough-not-firsttime\">\n      <p class=\"togetherjs-walkthrough-main-image\"><img src=\"http://localhost:8080/togetherjs/images/walkthrough-images-profile.png\"></p>\n      <p>Change your avatar, name and user color using the Profile button.</p>\n    </div>\n  </section>\n\n  <section class=\"togetherjs-walkthrough-slide\">\n    <p class=\"togetherjs-walkthrough-main-image togetherjs-ifnot-creator\"><img src=\"http://localhost:8080/togetherjs/images/walkthrough-images-invite.png\">\n    </p>\n    <p class=\"togetherjs-ifnot-creator\">You can invite more friends to the session by sending the invite link in the <span class=\"togetherjs-tool-name\">TogetherJS</span> dock.</p>\n    <p class=\"togetherjs-walkthrough-main-image togetherjs-if-creator\">\n      <span class=\"togetherjs-walkthrough-sendlink\">\n        Copy and paste this link into IM or email to invite friends.\n      </span>\n      <input type=\"text\" class=\"togetherjs-share-link\">\n    </p>\n    <p class=\"togetherjs-if-creator\">Send the above link to a friend so they can join your session!  You can find this invite link on the <span class=\"togetherjs-tool-name\">TogetherJS</span> dock as well.</p>\n  </section>\n\n  <section class=\"togetherjs-walkthrough-slide\">\n    <p class=\"togetherjs-walkthrough-main-image\"><img src=\"http://localhost:8080/togetherjs/images/walkthrough-images-participant.png\"></p>\n    <p>Friends who join your <span class=\"togetherjs-tool-name\">TogetherJS</span> session will appear here.  You can click their avatars to see more.</p>\n  </section>\n\n  <section class=\"togetherjs-walkthrough-slide\">\n    <p class=\"togetherjs-walkthrough-main-image\"><img src=\"http://localhost:8080/togetherjs/images/walkthrough-images-chat.png\"></p>\n    <p>When your friends join you in your <span class=\"togetherjs-tool-name\">TogetherJS</span> session, you can chat with them here!</p>\n  </section>\n\n  <section class=\"togetherjs-walkthrough-slide\">\n    <p class=\"togetherjs-walkthrough-main-image\"><img src=\"http://localhost:8080/togetherjs/images/walkthrough-images-rtc.png\"></p>\n    <p>If your browser supports it, click the microphone icon to begin a audio chat. Learn more about this experimental feature <a href=\"https://github.com/mozilla/togetherjs/wiki/About-Audio-Chat-and-WebRTC\" target=\"_blank\">here</a>.</p>\n  </section>\n\n  <section class=\"togetherjs-walkthrough-slide\">\n    <p class=\"togetherjs-walkthrough-main-image\"><img src=\"http://localhost:8080/togetherjs/images/walkthrough-images-logo.png\"></p>\n    <p>Alright, you're ready to use <span class=\"togetherjs-tool-name\">TogetherJS</span>. Now start collaborating on <strong class=\"togetherjs-site-name\">[site name]</strong>!</p>\n  </section>\n\n  <div style=\"display: none\">\n    <!-- There is one of these created for each slide: -->\n    <span id=\"togetherjs-template-walkthrough-slide-progress\" class=\"togetherjs-walkthrough-slide-progress\">&#9679;</span>\n  </div>\n  <section id=\"togetherjs-walkthrough-progress\">\n  </section>\n\n  <section class=\"togetherjs-buttons\">\n    <button class=\"togetherjs-primary togetherjs-dismiss\">I'm ready!</button>\n  </section>\n\n</div><!-- /.togetherjs-modal -->\n")
  };
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('peers',["util", "session", "storage", "require"], function (util, session, storage, require) {
  var peers = util.Module("peers");
  var assert = util.assert;
  var CHECK_ACTIVITY_INTERVAL = 10*1000; // Every 10 seconds see if someone has gone idle
  var IDLE_TIME = 3*60*1000; // Idle time is 3 minutes
  var TAB_IDLE_TIME = 2*60*1000; // When you tab away, after two minutes you'll say you are idle
  var BYE_TIME = 10*60*1000; // After 10 minutes of inactivity the person is considered to be "gone"

  var ui;
  require(["ui"], function (uiModule) {
    ui = uiModule;
  });

  var DEFAULT_NICKNAMES = [
    "Friendly Fox",
    "Brilliant Beaver",
    "Observant Owl",
    "Gregarious Giraffe",
    "Wild Wolf",
    "Silent Seal",
    "Wacky Whale",
    "Curious Cat",
    "Intelligent Iguana"
  ];

  var Peer = util.Class({

    isSelf: false,

    constructor: function (id, attrs) {
      attrs = attrs || {};
      assert(id);
      assert(! Peer.peers[id]);
      this.id = id;
      this.identityId = attrs.identityId || null;
      this.status = attrs.status || "live";
      this.idle = attrs.status || "active";
      this.name = attrs.name || null;
      this.avatar = attrs.avatar || null;
      this.color = attrs.color || "#00FF00";
      this.view = ui.PeerView(this);
      this.lastMessageDate = 0;
      this.following = attrs.following || false;
      Peer.peers[id] = this;
      var joined = attrs.joined || false;
      if (attrs.fromHelloMessage) {
        this.updateFromHello(attrs.fromHelloMessage);
        if (attrs.fromHelloMessage.type == "hello") {
          joined = true;
        }
      }
      peers.emit("new-peer", this);
      if (joined) {
        this.view.notifyJoined();
      }
      this.view.update();
    },

    repr: function () {
      return "Peer(" + JSON.stringify(this.id) + ")";
    },

    serialize: function () {
      return {
        id: this.id,
        status: this.status,
        idle: this.idle,
        url: this.url,
        hash: this.hash,
        title: this.title,
        identityId: this.identityId,
        rtcSupported: this.rtcSupported,
        name: this.name,
        avatar: this.avatar,
        color: this.color,
        following: this.following
      };
    },

    destroy: function () {
      this.view.destroy();
      delete Peer.peers[this.id];
    },

    updateMessageDate: function (msg) {
      if (this.idle == "inactive") {
        this.update({idle: "active"});
      }
      if (this.status == "bye") {
        this.unbye();
      }
      this.lastMessageDate = Date.now();
    },

    updateFromHello: function (msg) {
      var urlUpdated = false;
      var activeRTC = false;
      var identityUpdated = false;
      if (msg.url && msg.url != this.url) {
        this.url = msg.url;
        this.hash = null;
        this.title = null;
        urlUpdated = true;
      }
      if (msg.hash != this.hash) {
        this.hash = msg.urlHash;
        urlUpdated = true;
      }
      if (msg.title != this.title) {
        this.title = msg.title;
        urlUpdated = true;
      }
      if (msg.rtcSupported !== undefined) {
        this.rtcSupported = msg.rtcSupported;
      }
      if (msg.identityId !== undefined) {
        this.identityId = msg.identityId;
      }
      if (msg.name && msg.name != this.name) {
        this.name = msg.name;
        identityUpdated = true;
      }
      if (msg.avatar && msg.avatar != this.avatar) {
        util.assertValidUrl(msg.avatar);
        this.avatar = msg.avatar;
        identityUpdated = true;
      }
      if (msg.color && msg.color != this.color) {
        this.color = msg.color;
        identityUpdated = true;
      }
      if (msg.isClient !== undefined) {
        this.isCreator = ! msg.isClient;
      }
      if (this.status != "live") {
        this.status = "live";
        peers.emit("status-updated", this);
      }
      if (this.idle != "active") {
        this.idle = "active";
        peers.emit("idle-updated", this);
      }
      if (msg.rtcSupported) {
        peers.emit("rtc-supported", this);
      }
      if (urlUpdated) {
        peers.emit("url-updated", this);
      }
      if (identityUpdated) {
        peers.emit("identity-updated", this);
      }
      // FIXME: I can't decide if this is the only time we need to emit
      // this message (and not .update() or other methods)
      if (this.following) {
        session.emit("follow-peer", this);
      }
    },

    update: function (attrs) {
      // FIXME: should probably test that only a couple attributes are settable
      // particularly status and idle
      if (attrs.idle) {
        this.idle = attrs.idle;
      }
      if (attrs.status) {
        this.status = attrs.status;
      }
      this.view.update();
    },

    className: function (prefix) {
      prefix = prefix || "";
      return prefix + util.safeClassName(this.id);
    },

    bye: function () {
      if (this.status != "bye") {
        this.status = "bye";
        peers.emit("status-updated", this);
      }
      this.view.update();
    },

    unbye: function () {
      if (this.status == "bye") {
        this.status = "live";
        peers.emit("status-updated", this);
      }
      this.view.update();
    },

    nudge: function () {
      session.send({
        type: "url-change-nudge",
        url: location.href,
        to: this.id
      });
    },

    follow: function () {
      if (this.following) {
        return;
      }
      peers.getAllPeers().forEach(function (p) {
        if (p.following) {
          p.unfollow();
        }
      });
      this.following = true;
      // We have to make sure we remember this, even if we change URLs:
      storeSerialization();
      this.view.update();
      session.emit("follow-peer", this);
    },

    unfollow: function () {
      this.following = false;
      storeSerialization();
      this.view.update();
    }

  });

  // FIXME: I can't decide where this should actually go, seems weird
  // that it is emitted and handled in the same module
  session.on("follow-peer", function (peer) {
    if (peer.url != session.currentUrl()) {
      var url = peer.url;
      if (peer.urlHash) {
        url += peer.urlHash;
      }
      location.href = url;
    }
  });

  Peer.peers = {};

  Peer.deserialize = function (obj) {
    obj.fromStorage = true;
    var peer = Peer(obj.id, obj);
  };

  peers.Self = undefined;

  session.on("start", function () {
    if (peers.Self) {
      return;
    }
    /* Same interface as Peer, represents oneself (local user): */
    peers.Self = util.mixinEvents({
      isSelf: true,
      id: session.clientId,
      identityId: session.identityId,
      status: "live",
      idle: "active",
      name: null,
      avatar: null,
      color: null,
      defaultName: null,
      loaded: false,
      isCreator: ! session.isClient,

      update: function (attrs) {
        var updatePeers = false;
        var updateIdle = false;
        var updateMsg = {type: "peer-update"};
        if (typeof attrs.name == "string" && attrs.name != this.name) {
          this.name = attrs.name;
          updateMsg.name = this.name;
          if (! attrs.fromLoad) {
            storage.settings.set("name", this.name);
            updatePeers = true;
          }
        }
        if (attrs.avatar && attrs.avatar != this.avatar) {
          util.assertValidUrl(attrs.avatar);
          this.avatar = attrs.avatar;
          updateMsg.avatar = this.avatar;
          if (! attrs.fromLoad) {
            storage.settings.set("avatar", this.avatar);
            updatePeers = true;
          }
        }
        if (attrs.color && attrs.color != this.color) {
          this.color = attrs.color;
          updateMsg.color = this.color;
          if (! attrs.fromLoad) {
            storage.settings.set("color", this.color);
            updatePeers = true;
          }
        }
        if (attrs.defaultName && attrs.defaultName != this.defaultName) {
          this.defaultName = attrs.defaultName;
          if (! attrs.fromLoad) {
            storage.settings.set("defaultName", this.defaultName);
            updatePeers = true;
          }
        }
        if (attrs.status && attrs.status != this.status) {
          this.status = attrs.status;
          peers.emit("status-updated", this);
        }
        if (attrs.idle && attrs.idle != this.idle) {
          this.idle = attrs.idle;
          updateIdle = true;
          peers.emit("idle-updated", this);
        }
        this.view.update();
        if (updatePeers && ! attrs.fromLoad) {
          session.emit("self-updated");
          session.send(updateMsg);
        }
        if (updateIdle && ! attrs.fromLoad) {
          session.send({
            type: "idle-status",
            idle: this.idle
          });
        }
      },

      className: function (prefix) {
        prefix = prefix || "";
        return prefix + "self";
      },

      _loadFromSettings: function () {
        return util.resolveMany(
          storage.settings.get("name"),
          storage.settings.get("avatar"),
          storage.settings.get("defaultName"),
          storage.settings.get("color")).then((function (name, avatar, defaultName, color) {
            if (! defaultName) {
              defaultName = util.pickRandom(DEFAULT_NICKNAMES);
              storage.settings.set("defaultName", defaultName);
            }
            if (! color) {
              color = Math.floor(Math.random() * 0xffffff).toString(16);
              while (color.length < 6) {
                color = "0" + color;
              }
              color = "#" + color;
              storage.settings.set("color", color);
            }
            if (! avatar) {
              avatar = TogetherJS.baseUrl + "/togetherjs/images/default-avatar.png";
            }
            this.update({
              name: name,
              avatar: avatar,
              defaultName: defaultName,
              color: color,
              fromLoad: true
            });
            peers._SelfLoaded.resolve();
          }).bind(this)); // FIXME: ignoring error
      },

      _loadFromApp: function () {
        // FIXME: I wonder if these should be optionally functions?
        // We could test typeof==function to distinguish between a getter and a concrete value
        var getUserName = TogetherJS.config.get("getUserName");
        var getUserColor = TogetherJS.config.get("getUserColor");
        var getUserAvatar = TogetherJS.config.get("getUserAvatar");
        var name, color, avatar;
        if (getUserName) {
          if (typeof getUserName == "string") {
            name = getUserName;
          } else {
            name = getUserName();
          }
          if (name && typeof name != "string") {
            // FIXME: test for HTML safe?  Not that we require it, but
            // <>'s are probably a sign something is wrong.
            console.warn("Error in getUserName(): should return a string (got", name, ")");
            name = null;
          }
        }
        if (getUserColor) {
          if (typeof getUserColor == "string") {
            color = getUserColor;
          } else {
            color = getUserColor();
          }
          if (color && typeof color != "string") {
            // FIXME: would be nice to test for color-ness here.
            console.warn("Error in getUserColor(): should return a string (got", color, ")");
            color = null;
          }
        }
        if (getUserAvatar) {
          if (typeof getUserAvatar == "string") {
            avatar = getUserAvatar;
          } else {
            avatar = getUserAvatar();
          }
          if (avatar && typeof avatar != "string") {
            console.warn("Error in getUserAvatar(): should return a string (got", avatar, ")");
            avatar = null;
          }
        }
        if (name || color || avatar) {
          this.update({
            name: name,
            color: color,
            avatar: avatar
          });
        }
      }
    });

    peers.Self.view = ui.PeerView(peers.Self);
    storage.tab.get("peerCache").then(deserialize);
    peers.Self._loadFromSettings().then(function() {
      peers.Self._loadFromApp();
      peers.Self.view.update();
      session.emit("self-updated");
    });
  });

  session.on("refresh-user-data", function () {
    if (peers.Self) {
      peers.Self._loadFromApp();
    }
  });

  TogetherJS.config.track(
    "getUserName",
    TogetherJS.config.track(
      "getUserColor",
      TogetherJS.config.track(
        "getUserAvatar",
        function () {
          if (peers.Self) {
            peers.Self._loadFromApp();
          }
        }
      )
    )
  );

  peers._SelfLoaded = util.Deferred();

  function serialize() {
    var peers = [];
    util.forEachAttr(Peer.peers, function (peer) {
      peers.push(peer.serialize());
    });
    return {
      peers: peers
    };
  }

  function deserialize(obj) {
    if (! obj) {
      return;
    }
    obj.peers.forEach(function (peer) {
      Peer.deserialize(peer);
    });
  }

  peers.getPeer = function getPeer(id, message) {
    assert(id);
    var peer = Peer.peers[id];
    if (id === session.clientId) {
      return peers.Self;
    }
    if (message && ! peer) {
      peer = Peer(id, {fromHelloMessage: message});
      return peer;
    }
    assert(peer, "No peer with id:", id);
    if (message &&
        (message.type == "hello" || message.type == "hello-back" ||
         message.type == "peer-update")) {
      peer.updateFromHello(message);
      peer.view.update();
    }
    return Peer.peers[id];
  };

  peers.getAllPeers = function (liveOnly) {
    var result = [];
    util.forEachAttr(Peer.peers, function (peer) {
      if (liveOnly && peer.status != "live") {
        return;
      }
      result.push(peer);
    });
    return result;
  };

  function checkActivity() {
    var ps = peers.getAllPeers();
    var now = Date.now();
    ps.forEach(function (p) {
      if (p.idle == "active" && now - p.lastMessageDate > IDLE_TIME) {
        p.update({idle: "inactive"});
      }
      if (p.status != "bye" && now - p.lastMessageDate > BYE_TIME) {
        p.bye();
      }
    });
  }

  session.hub.on("bye", function (msg) {
    var peer = peers.getPeer(msg.clientId);
    peer.bye();
  });

  var checkActivityTask = null;

  session.on("start", function () {
    if (checkActivityTask) {
      console.warn("Old peers checkActivityTask left over?");
      clearTimeout(checkActivityTask);
    }
    checkActivityTask = setInterval(checkActivity, CHECK_ACTIVITY_INTERVAL);
  });

  session.on("close", function () {
    util.forEachAttr(Peer.peers, function (peer) {
      peer.destroy();
    });
    storage.tab.set("peerCache", undefined);
    clearTimeout(checkActivityTask);
    checkActivityTask = null;
  });

  var tabIdleTimeout = null;

  session.on("visibility-change", function (hidden) {
    if (hidden) {
      if (tabIdleTimeout) {
        clearTimeout(tabIdleTimeout);
      }
      tabIdleTimeout = setTimeout(function () {
        peers.Self.update({idle: "inactive"});
      }, TAB_IDLE_TIME);
    } else {
      if (tabIdleTimeout) {
        clearTimeout(tabIdleTimeout);
      }
      if (peers.Self.idle == "inactive") {
        peers.Self.update({idle: "active"});
      }
    }
  });

  session.hub.on("idle-status", function (msg) {
    msg.peer.update({idle: msg.idle});
  });

  // Pings are a straight alive check, and contain no more information:
  session.hub.on("ping", function () {
    session.send({type: "ping-back"});
  });

  window.addEventListener("pagehide", function () {
    // FIXME: not certain if this should be tab local or not:
    storeSerialization();
  }, false);

  function storeSerialization() {
    storage.tab.set("peerCache", serialize());
  }

  util.mixinEvents(peers);

  util.testExpose({
    setIdleTime: function (time) {
      IDLE_TIME = time;
      CHECK_ACTIVITY_INTERVAL = time / 2;
      if (TogetherJS.running) {
        clearTimeout(checkActivityTask);
        checkActivityTask = setInterval(checkActivity, CHECK_ACTIVITY_INTERVAL);
      }
    }
  });

  util.testExpose({
    setByeTime: function (time) {
      BYE_TIME = time;
      CHECK_ACTIVITY_INTERVAL = Math.min(CHECK_ACTIVITY_INTERVAL, time / 2);
      if (TogetherJS.running) {
        clearTimeout(checkActivityTask);
        checkActivityTask = setInterval(checkActivity, CHECK_ACTIVITY_INTERVAL);
      }
    }
  });

  return peers;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define('windowing',["jquery", "util", "peers", "session"], function ($, util, peers, session) {
  var assert = util.assert;
  var windowing = util.Module("windowing");
  var $window = $(window);
  // This is also in togetherjs.less, under .togetherjs-animated
  var ANIMATION_DURATION = 1000;

  /* Displays one window.  A window must already exist.  This hides other windows, and
     positions the window according to its data-bound-to attributes */
  windowing.show = function (element, options) {
    element = $(element);
    options = options || {};
    options.bind = options.bind || element.attr("data-bind-to");
    var notification = element.hasClass("togetherjs-notification");
    var modal = element.hasClass("togetherjs-modal");
    if (options.bind) {
      options.bind = $(options.bind);
    }
    windowing.hide();
    element.stop();
    element.show();
    // In addition to being hidden, the window can be faded out, which we want to undo:
    element.css({opacity: "1"});
    if (options.bind) {
      assert(! modal, "Binding does not currently work with modals");
      bind(element, options.bind);
    }
    if (notification) {
      element.slideIn();
    } else if (! modal) {
      element.popinWindow();
    }
    if (modal) {
      getModalBackground().show();
      modalEscape.bind();
    }
    onClose = options.onClose || null;
    session.emit("display-window", element.attr("id"), element);
  };

  var onClose = null;

  /* Moves a window to be attached to data-bind-to, e.g., the button
     that opened the window. Or you can provide an element that it should bind to. */
  function bind(win, bound) {
    if ($.browser.mobile) {
      return;
    }
    win = $(win);
    assert(bound.length, "Cannot find binding:", bound.selector, "from:", win.selector);
    // FIXME: hardcoding
    var ifacePos = "right";
    //var ifacePos = panelPosition();
    var boundPos = bound.offset();
    boundPos.height = bound.height();
    boundPos.width = bound.width();
    var windowHeight = $window.height();
    boundPos.top -= $window.scrollTop();
    boundPos.left -= $window.scrollLeft();
    // FIXME: I appear to have to add the padding to the width to get a "true"
    // width.  But it's still not entirely consistent.
    var height = win.height() + 5;
    var width = win.width() + 20;
    var left, top;
    if (ifacePos == "right") {
      left = boundPos.left - 11 - width;
      top = boundPos.top + (boundPos.height / 2) - (height / 2);
    } else if (ifacePos == "left") {
      left = boundPos.left + boundPos.width + 15;
      top = boundPos.top + (boundPos.height / 2) - (height / 2);
    } else if (ifacePos == "bottom") {
      left = (boundPos.left + boundPos.width / 2) - (width / 2);
      top = boundPos.top - 10 - height;
    }
    top = Math.min(windowHeight - 10 - height, Math.max(10, top));
    win.css({
      top: top + "px",
      left: left + "px"
    });
    if (win.hasClass("togetherjs-window")) {
      $("#togetherjs-window-pointer-right, #togetherjs-window-pointer-left").hide();
      var pointer = $("#togetherjs-window-pointer-" + ifacePos);
      pointer.show();
      if (ifacePos == "right") {
        pointer.css({
          top: boundPos.top + Math.floor(boundPos.height / 2) + "px",
          left: left + win.width() + 9 + "px"
        });
      } else if (ifacePos == "left") {
        pointer.css({
          top: boundPos.top + Math.floor(boundPos.height / 2) + "px",
          left: (left - 5) + "px"
        });
      } else {
        console.warn("don't know how to deal with position:", ifacePos);
      }
    }
    win.data("boundTo", bound.selector || "#" + bound.attr("id"));
    bound.addClass("togetherjs-active");
  }

  session.on("resize", function () {
    var win = $(".togetherjs-modal:visible, .togetherjs-window:visible");
    if (! win.length) {
      return;
    }
    var boundTo = win.data("boundTo");
    if (! boundTo) {
      return;
    }
    boundTo = $(boundTo);
    bind(win, boundTo);
  });

  windowing.hide = function (els) {
    // FIXME: also hide modals?
    els = els || ".togetherjs-window, .togetherjs-modal, .togetherjs-notification";
    els = $(els);
    els = els.filter(":visible");
    els.filter(":not(.togetherjs-notification)").hide();
    getModalBackground().hide();
    var windows = [];
    els.each(function (index, element) {
      element = $(element);
      windows.push(element);
      var bound = element.data("boundTo");
      if (! bound) {
        return;
      }
      bound = $(bound);
      bound.addClass("togetherjs-animated").addClass("togetherjs-color-pulse");
      setTimeout(function () {
        bound.removeClass("togetherjs-color-pulse").removeClass("togetherjs-animated");
      }, ANIMATION_DURATION+10);
      element.data("boundTo", null);
      bound.removeClass("togetherjs-active");
      if (element.hasClass("togetherjs-notification")) {
        element.fadeOut().promise().then(function () {
          this.hide();
        });
      }
    });
    $("#togetherjs-window-pointer-right, #togetherjs-window-pointer-left").hide();
    if (onClose) {
      onClose();
      onClose = null;
    }
    if (windows.length) {
      session.emit("hide-window", windows);
    }
  };

  windowing.showNotification = function (element, options) {
    element = $(element);
    options = options || {};
    assert(false);
  };

  windowing.toggle = function (el) {
    el = $(el);
    if (el.is(":visible")) {
      windowing.hide(el);
    } else {
      windowing.show(el);
    }
  };

  function bindEvents(el) {
    el.find(".togetherjs-close, .togetherjs-dismiss").click(function (event) {
      var w = $(event.target).closest(".togetherjs-window, .togetherjs-modal, .togetherjs-notification");
      windowing.hide(w);
      event.stopPropagation();
      return false;
    });
  }

  function getModalBackground() {
    if (getModalBackground.element) {
      return getModalBackground.element;
    }
    var background = $("#togetherjs-modal-background");
    assert(background.length);
    getModalBackground.element = background;
    background.click(function () {
      windowing.hide();
    });
    return background;
  }

  var modalEscape = {
    bind: function () {
      $(document).keydown(modalEscape.onKeydown);
    },
    unbind: function () {
      $(document).unbind("keydown", modalEscape.onKeydown);
    },
    onKeydown: function (event) {
      if (event.which == 27) {
        windowing.hide();
      }
    }
  };

  session.on("close", function () {
    modalEscape.unbind();
  });

  session.on("new-element", function (el) {
    bindEvents(el);
  });

  return windowing;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define('templating',["jquery", "util", "peers", "windowing", "session"], function ($, util, peers, windowing, session) {
  var assert = util.assert;
  var templating = util.Module("templating");

  templating.clone = function (templateId) {
    templateId = "#togetherjs-template-" + templateId;
    var template = $(templateId);
    assert(template.length, "No template found with id:", templateId);
    template = template.clone();
    template.attr("id", null);
    // FIXME: if called directly, doesn't emit new-element event:
    return template;
  };

  templating.sub = function (templateId, variables) {
    var template = templating.clone(templateId);
    variables = variables || {};
    util.forEachAttr(variables, function (value, attr) {
      // FIXME: do the substitution... somehow?
      var subs = template.find(".togetherjs-sub-" + attr).removeClass("togetherjs-sub-" + attr);
      if (subs.length) {
        if (typeof value == "string") {
          subs.text(value);
        } else if (value instanceof $) {
          subs.append(value);
        } else {
          assert(false, "Unknown variable value type:", attr, "=", value);
        }
      }
      var ifs = template.find(".togetherjs-if-" + attr).removeClass("togetherjs-sub-" + attr);
      if (! value) {
        ifs.hide();
      }
      ifs = template.find(".togetherjs-ifnot-" + attr).removeClass("togetherjs-ifnot-" + attr);
      if (value) {
        ifs.hide();
      }
      var attrName = "data-togetherjs-subattr-" + attr;
      var attrs = template.find("[" + attrName + "]");
      attrs.each(function (index, element) {
        assert(typeof value == "string");
        element = $(element);
        var subAttribute = element.attr(attrName);
        element.attr(attrName, null);
        element.attr(subAttribute, value);
      });
    });
    if (variables.peer) {
      variables.peer.view.setElement(template);
    }
    if (variables.date) {
      var date = variables.date;
      if (typeof date == "number") {
        date = new Date(date);
      }
      var ampm = "AM";
      var hour = date.getHours();
      if (hour > 12) {
        hour -= 12;
        ampm = "PM";
      }
      var minute = date.getMinutes();
      var t = hour + ":";
      if (minute < 10) {
        t += "0";
      }
      t += minute;
      template.find(".togetherjs-time").text(t);
      template.find(".togetherjs-ampm").text(ampm);
    }

    // FIXME: silly this is on session:
    session.emit("new-element", template);
    return template;
  };

  return templating;
});

define('linkify',[], function () {
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

// TinyColor v0.9.13
// https://github.com/bgrins/TinyColor
// 2012-11-28, Brian Grinstead, MIT License

(function(root) {

var trimLeft = /^[\s,#]+/,
    trimRight = /\s+$/,
    tinyCounter = 0,
    math = Math,
    mathRound = math.round,
    mathMin = math.min,
    mathMax = math.max,
    mathRandom = math.random;

function tinycolor (color, opts) {

    color = (color) ? color : '';

    // If input is already a tinycolor, return itself
    if (typeof color == "object" && color.hasOwnProperty("_tc_id")) {
       return color;
    }

    var rgb = inputToRGB(color);
    var r = rgb.r,
        g = rgb.g,
        b = rgb.b,
        a = rgb.a,
        roundA = mathRound(100*a) / 100,
        format = rgb.format;

    // Don't let the range of [0,255] come back in [0,1].
    // Potentially lose a little bit of precision here, but will fix issues where
    // .5 gets interpreted as half of the total, instead of half of 1
    // If it was supposed to be 128, this was already taken care of by `inputToRgb`
    if (r < 1) { r = mathRound(r); }
    if (g < 1) { g = mathRound(g); }
    if (b < 1) { b = mathRound(b); }

    return {
        ok: rgb.ok,
        format: format,
        _tc_id: tinyCounter++,
        alpha: a,
        toHsv: function() {
            var hsv = rgbToHsv(r, g, b);
            return { h: hsv.h * 360, s: hsv.s, v: hsv.v, a: a };
        },
        toHsvString: function() {
            var hsv = rgbToHsv(r, g, b);
            var h = mathRound(hsv.h * 360), s = mathRound(hsv.s * 100), v = mathRound(hsv.v * 100);
            return (a == 1) ?
              "hsv("  + h + ", " + s + "%, " + v + "%)" :
              "hsva(" + h + ", " + s + "%, " + v + "%, "+ roundA + ")";
        },
        toHsl: function() {
            var hsl = rgbToHsl(r, g, b);
            return { h: hsl.h * 360, s: hsl.s, l: hsl.l, a: a };
        },
        toHslString: function() {
            var hsl = rgbToHsl(r, g, b);
            var h = mathRound(hsl.h * 360), s = mathRound(hsl.s * 100), l = mathRound(hsl.l * 100);
            return (a == 1) ?
              "hsl("  + h + ", " + s + "%, " + l + "%)" :
              "hsla(" + h + ", " + s + "%, " + l + "%, "+ roundA + ")";
        },
        toHex: function() {
            return rgbToHex(r, g, b);
        },
        toHexString: function() {
            return '#' + rgbToHex(r, g, b);
        },
        toRgb: function() {
            return { r: mathRound(r), g: mathRound(g), b: mathRound(b), a: a };
        },
        toRgbString: function() {
            return (a == 1) ?
              "rgb("  + mathRound(r) + ", " + mathRound(g) + ", " + mathRound(b) + ")" :
              "rgba(" + mathRound(r) + ", " + mathRound(g) + ", " + mathRound(b) + ", " + roundA + ")";
        },
        toPercentageRgb: function() {
            return { r: mathRound(bound01(r, 255) * 100) + "%", g: mathRound(bound01(g, 255) * 100) + "%", b: mathRound(bound01(b, 255) * 100) + "%", a: a };
        },
        toPercentageRgbString: function() {
            return (a == 1) ?
              "rgb("  + mathRound(bound01(r, 255) * 100) + "%, " + mathRound(bound01(g, 255) * 100) + "%, " + mathRound(bound01(b, 255) * 100) + "%)" :
              "rgba(" + mathRound(bound01(r, 255) * 100) + "%, " + mathRound(bound01(g, 255) * 100) + "%, " + mathRound(bound01(b, 255) * 100) + "%, " + roundA + ")";
        },
        toName: function() {
            return hexNames[rgbToHex(r, g, b)] || false;
        },
        toFilter: function() {
            var hex = rgbToHex(r, g, b);
            var secondHex = hex;
            var alphaHex = Math.round(parseFloat(a) * 255).toString(16);
            var secondAlphaHex = alphaHex;
            var gradientType = opts && opts.gradientType ? "GradientType = 1, " : "";

            if (secondColor) {
                var s = tinycolor(secondColor);
                secondHex = s.toHex();
                secondAlphaHex = Math.round(parseFloat(s.alpha) * 255).toString(16);
            }

            return "progid:DXImageTransform.Microsoft.gradient("+gradientType+"startColorstr=#" + pad2(alphaHex) + hex + ",endColorstr=#" + pad2(secondAlphaHex) + secondHex + ")";
        },
        toString: function(format) {
            format = format || this.format;
            var formattedString = false;
            if (format === "rgb") {
                formattedString = this.toRgbString();
            }
            if (format === "prgb") {
                formattedString = this.toPercentageRgbString();
            }
            if (format === "hex") {
                formattedString = this.toHexString();
            }
            if (format === "name") {
                formattedString = this.toName();
            }
            if (format === "hsl") {
                formattedString = this.toHslString();
            }
            if (format === "hsv") {
                formattedString = this.toHsvString();
            }

            return formattedString || this.toHexString();
        }
    };
}

// If input is an object, force 1 into "1.0" to handle ratios properly
// String input requires "1.0" as input, so 1 will be treated as 1
tinycolor.fromRatio = function(color) {
    if (typeof color == "object") {
        var newColor = {};
        for (var i in color) {
            newColor[i] = convertToPercentage(color[i]);
        }
        color = newColor;
    }

    return tinycolor(color);
};

// Given a string or object, convert that input to RGB
// Possible string inputs:
//
//     "red"
//     "#f00" or "f00"
//     "#ff0000" or "ff0000"
//     "rgb 255 0 0" or "rgb (255, 0, 0)"
//     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
//     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
//     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
//     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
//     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
//     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
//
function inputToRGB(color) {

    var rgb = { r: 255, g: 255, b: 255 };
    var a = 1;
    var ok = false;
    var format = false;

    if (typeof color == "string") {
        color = stringInputToObject(color);
    }

    if (typeof color == "object") {
        if (color.hasOwnProperty("r") && color.hasOwnProperty("g") && color.hasOwnProperty("b")) {
            rgb = rgbToRgb(color.r, color.g, color.b);
            ok = true;
            format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
        }
        else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("v")) {
            color.s = convertToPercentage(color.s);
            color.v = convertToPercentage(color.v);
            rgb = hsvToRgb(color.h, color.s, color.v);
            ok = true;
            format = "hsv";
        }
        else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("l")) {
            color.s = convertToPercentage(color.s);
            color.l = convertToPercentage(color.l);
            rgb = hslToRgb(color.h, color.s, color.l);
            ok = true;
            format = "hsl";
        }

        if (color.hasOwnProperty("a")) {
            a = color.a;
        }
    }

    a = parseFloat(a);

    // Handle invalid alpha characters by setting to 1
    if (isNaN(a) || a < 0 || a > 1) {
        a = 1;
    }

    return {
        ok: ok,
        format: color.format || format,
        r: mathMin(255, mathMax(rgb.r, 0)),
        g: mathMin(255, mathMax(rgb.g, 0)),
        b: mathMin(255, mathMax(rgb.b, 0)),
        a: a
    };
}



// Conversion Functions
// --------------------

// `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
// <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

// `rgbToRgb`
// Handle bounds / percentage checking to conform to CSS color spec
// <http://www.w3.org/TR/css3-color/>
// *Assumes:* r, g, b in [0, 255] or [0, 1]
// *Returns:* { r, g, b } in [0, 255]
function rgbToRgb(r, g, b){
    return {
        r: bound01(r, 255) * 255,
        g: bound01(g, 255) * 255,
        b: bound01(b, 255) * 255
    };
}

// `rgbToHsl`
// Converts an RGB color value to HSL.
// *Assumes:* r, g, and b are contained in [0, 255] or [0, 1]
// *Returns:* { h, s, l } in [0,1]
function rgbToHsl(r, g, b) {

    r = bound01(r, 255);
    g = bound01(g, 255);
    b = bound01(b, 255);

    var max = mathMax(r, g, b), min = mathMin(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min) {
        h = s = 0; // achromatic
    }
    else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
    }

    return { h: h, s: s, l: l };
}

// `hslToRgb`
// Converts an HSL color value to RGB.
// *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
// *Returns:* { r, g, b } in the set [0, 255]
function hslToRgb(h, s, l) {
    var r, g, b;

    h = bound01(h, 360);
    s = bound01(s, 100);
    l = bound01(l, 100);

    function hue2rgb(p, q, t) {
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }

    if(s === 0) {
        r = g = b = l; // achromatic
    }
    else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return { r: r * 255, g: g * 255, b: b * 255 };
}

// `rgbToHsv`
// Converts an RGB color value to HSV
// *Assumes:* r, g, and b are contained in the set [0, 255] or [0, 1]
// *Returns:* { h, s, v } in [0,1]
function rgbToHsv(r, g, b) {

    r = bound01(r, 255);
    g = bound01(g, 255);
    b = bound01(b, 255);

    var max = mathMax(r, g, b), min = mathMin(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max === 0 ? 0 : d / max;

    if(max == min) {
        h = 0; // achromatic
    }
    else {
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h, s: s, v: v };
}

// `hsvToRgb`
// Converts an HSV color value to RGB.
// *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
// *Returns:* { r, g, b } in the set [0, 255]
 function hsvToRgb(h, s, v) {

    h = bound01(h, 360) * 6;
    s = bound01(s, 100);
    v = bound01(v, 100);

    var i = math.floor(h),
        f = h - i,
        p = v * (1 - s),
        q = v * (1 - f * s),
        t = v * (1 - (1 - f) * s),
        mod = i % 6,
        r = [v, q, p, p, t, v][mod],
        g = [t, v, v, q, p, p][mod],
        b = [p, p, t, v, v, q][mod];

    return { r: r * 255, g: g * 255, b: b * 255 };
}

// `rgbToHex`
// Converts an RGB color to hex
// Assumes r, g, and b are contained in the set [0, 255]
// Returns a 3 or 6 character hex
function rgbToHex(r, g, b) {
    var hex = [
        pad2(mathRound(r).toString(16)),
        pad2(mathRound(g).toString(16)),
        pad2(mathRound(b).toString(16))
    ];

    // Return a 3 character hex if possible
    if (hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
        return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
    }

    return hex.join("");
}

// `equals`
// Can be called with any tinycolor input
tinycolor.equals = function (color1, color2) {
    if (!color1 || !color2) { return false; }
    return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
};
tinycolor.random = function() {
    return tinycolor.fromRatio({
        r: mathRandom(),
        g: mathRandom(),
        b: mathRandom()
    });
};


// Modification Functions
// ----------------------
// Thanks to less.js for some of the basics here
// <https://github.com/cloudhead/less.js/blob/master/lib/less/functions.js>


tinycolor.desaturate = function (color, amount) {
    var hsl = tinycolor(color).toHsl();
    hsl.s -= ((amount || 10) / 100);
    hsl.s = clamp01(hsl.s);
    return tinycolor(hsl);
};
tinycolor.saturate = function (color, amount) {
    var hsl = tinycolor(color).toHsl();
    hsl.s += ((amount || 10) / 100);
    hsl.s = clamp01(hsl.s);
    return tinycolor(hsl);
};
tinycolor.greyscale = function(color) {
    return tinycolor.desaturate(color, 100);
};
tinycolor.lighten = function(color, amount) {
    var hsl = tinycolor(color).toHsl();
    hsl.l += ((amount || 10) / 100);
    hsl.l = clamp01(hsl.l);
    return tinycolor(hsl);
};
tinycolor.darken = function (color, amount) {
    var hsl = tinycolor(color).toHsl();
    hsl.l -= ((amount || 10) / 100);
    hsl.l = clamp01(hsl.l);
    return tinycolor(hsl);
};
tinycolor.complement = function(color) {
    var hsl = tinycolor(color).toHsl();
    hsl.h = (hsl.h + 180) % 360;
    return tinycolor(hsl);
};


// Combination Functions
// ---------------------
// Thanks to jQuery xColor for some of the ideas behind these
// <https://github.com/infusion/jQuery-xcolor/blob/master/jquery.xcolor.js>

tinycolor.triad = function(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [
        tinycolor(color),
        tinycolor({ h: (h + 120) % 360, s: hsl.s, l: hsl.l }),
        tinycolor({ h: (h + 240) % 360, s: hsl.s, l: hsl.l })
    ];
};
tinycolor.tetrad = function(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [
        tinycolor(color),
        tinycolor({ h: (h + 90) % 360, s: hsl.s, l: hsl.l }),
        tinycolor({ h: (h + 180) % 360, s: hsl.s, l: hsl.l }),
        tinycolor({ h: (h + 270) % 360, s: hsl.s, l: hsl.l })
    ];
};
tinycolor.splitcomplement = function(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [
        tinycolor(color),
        tinycolor({ h: (h + 72) % 360, s: hsl.s, l: hsl.l}),
        tinycolor({ h: (h + 216) % 360, s: hsl.s, l: hsl.l})
    ];
};
tinycolor.analogous = function(color, results, slices) {
    results = results || 6;
    slices = slices || 30;

    var hsl = tinycolor(color).toHsl();
    var part = 360 / slices;
    var ret = [tinycolor(color)];

    for (hsl.h = ((hsl.h - (part * results >> 1)) + 720) % 360; --results; ) {
        hsl.h = (hsl.h + part) % 360;
        ret.push(tinycolor(hsl));
    }
    return ret;
};
tinycolor.monochromatic = function(color, results) {
    results = results || 6;
    var hsv = tinycolor(color).toHsv();
    var h = hsv.h, s = hsv.s, v = hsv.v;
    var ret = [];
    var modification = 1 / results;

    while (results--) {
        ret.push(tinycolor({ h: h, s: s, v: v}));
        v = (v + modification) % 1;
    }

    return ret;
};
// Readability based on W3C recommendations: http://www.w3.org/TR/AERT#color-contrast
// Returns object with two properties:
//   .brightness: the difference in brightness between the two colors
//   .color: the difference in color/hue between the two colors
// An "acceptable" color is considered to have a brightness difference of 125 and a
// color difference of 500
tinycolor.readability = function(color1, color2) {
    var a = tinycolor(color1).toRgb(), b = tinycolor(color2).toRgb();
    var brightnessA = (a.r * 299 + a.g * 587 + a.b * 114) / 1000;
    var brightnessB = (b.r * 299 + b.g * 587 + b.b * 114) / 1000;
    var colorDiff = (
        Math.max(a.r, b.r) - Math.min(a.r, b.r) +
        Math.max(a.g, b.g) - Math.min(a.g, b.g) +
        Math.max(a.b, b.b) - Math.min(a.b, b.b));
    return {
        brightness: Math.abs(brightnessA - brightnessB),
        color: colorDiff
    };
};
// True if using color1 over color2 (or vice versa) is "readable"
// Based on: http://www.w3.org/TR/AERT#color-contrast
// Example:
//   tinycolor.readable("#000", "#111") => false
tinycolor.readable = function(color1, color2) {
    var readability = tinycolor.readability(color1, color2);
    return readability.brightness > 125 && readability.color > 500;
};
// Given a base color and a list of possible foreground or background
// colors for that base, returns the most readable color.
// Example:
//   tinycolor.mostReadable("#123", ["#fff", "#000"]) => "#000"
tinycolor.mostReadable = function(baseColor, colorList) {
    var bestColor;
    var bestScore = 0;
    var bestIsReadable = false;
    for (var i=0; i < colorList.length; i++) {
        var readability = tinycolor.readability(baseColor, colorList[i]);
        var readable = readability.brightness > 125 && readability.color > 500;
        // We normalize both around the "acceptable" breaking point,
        // but rank brightness constrast higher than hue.  Why?  I'm
        // not sure, seems reasonable.
        var score = 3 * (readability.brightness / 125) + (readability.color / 500);
        if ((readable && ! bestIsReadable) ||
            (readable && bestIsReadable && score > bestScore) ||
            ((! readable) && (! bestIsReadable) && score > bestScore)) {
            bestIsReadable = readable;
            bestScore = score;
            bestColor = colorList[i];
        }
    }
    return bestColor;
};


// Big List of Colors
// ---------
// <http://www.w3.org/TR/css3-color/#svg-color>
var names = tinycolor.names = {
    aliceblue: "f0f8ff",
    antiquewhite: "faebd7",
    aqua: "0ff",
    aquamarine: "7fffd4",
    azure: "f0ffff",
    beige: "f5f5dc",
    bisque: "ffe4c4",
    black: "000",
    blanchedalmond: "ffebcd",
    blue: "00f",
    blueviolet: "8a2be2",
    brown: "a52a2a",
    burlywood: "deb887",
    burntsienna: "ea7e5d",
    cadetblue: "5f9ea0",
    chartreuse: "7fff00",
    chocolate: "d2691e",
    coral: "ff7f50",
    cornflowerblue: "6495ed",
    cornsilk: "fff8dc",
    crimson: "dc143c",
    cyan: "0ff",
    darkblue: "00008b",
    darkcyan: "008b8b",
    darkgoldenrod: "b8860b",
    darkgray: "a9a9a9",
    darkgreen: "006400",
    darkgrey: "a9a9a9",
    darkkhaki: "bdb76b",
    darkmagenta: "8b008b",
    darkolivegreen: "556b2f",
    darkorange: "ff8c00",
    darkorchid: "9932cc",
    darkred: "8b0000",
    darksalmon: "e9967a",
    darkseagreen: "8fbc8f",
    darkslateblue: "483d8b",
    darkslategray: "2f4f4f",
    darkslategrey: "2f4f4f",
    darkturquoise: "00ced1",
    darkviolet: "9400d3",
    deeppink: "ff1493",
    deepskyblue: "00bfff",
    dimgray: "696969",
    dimgrey: "696969",
    dodgerblue: "1e90ff",
    firebrick: "b22222",
    floralwhite: "fffaf0",
    forestgreen: "228b22",
    fuchsia: "f0f",
    gainsboro: "dcdcdc",
    ghostwhite: "f8f8ff",
    gold: "ffd700",
    goldenrod: "daa520",
    gray: "808080",
    green: "008000",
    greenyellow: "adff2f",
    grey: "808080",
    honeydew: "f0fff0",
    hotpink: "ff69b4",
    indianred: "cd5c5c",
    indigo: "4b0082",
    ivory: "fffff0",
    khaki: "f0e68c",
    lavender: "e6e6fa",
    lavenderblush: "fff0f5",
    lawngreen: "7cfc00",
    lemonchiffon: "fffacd",
    lightblue: "add8e6",
    lightcoral: "f08080",
    lightcyan: "e0ffff",
    lightgoldenrodyellow: "fafad2",
    lightgray: "d3d3d3",
    lightgreen: "90ee90",
    lightgrey: "d3d3d3",
    lightpink: "ffb6c1",
    lightsalmon: "ffa07a",
    lightseagreen: "20b2aa",
    lightskyblue: "87cefa",
    lightslategray: "789",
    lightslategrey: "789",
    lightsteelblue: "b0c4de",
    lightyellow: "ffffe0",
    lime: "0f0",
    limegreen: "32cd32",
    linen: "faf0e6",
    magenta: "f0f",
    maroon: "800000",
    mediumaquamarine: "66cdaa",
    mediumblue: "0000cd",
    mediumorchid: "ba55d3",
    mediumpurple: "9370db",
    mediumseagreen: "3cb371",
    mediumslateblue: "7b68ee",
    mediumspringgreen: "00fa9a",
    mediumturquoise: "48d1cc",
    mediumvioletred: "c71585",
    midnightblue: "191970",
    mintcream: "f5fffa",
    mistyrose: "ffe4e1",
    moccasin: "ffe4b5",
    navajowhite: "ffdead",
    navy: "000080",
    oldlace: "fdf5e6",
    olive: "808000",
    olivedrab: "6b8e23",
    orange: "ffa500",
    orangered: "ff4500",
    orchid: "da70d6",
    palegoldenrod: "eee8aa",
    palegreen: "98fb98",
    paleturquoise: "afeeee",
    palevioletred: "db7093",
    papayawhip: "ffefd5",
    peachpuff: "ffdab9",
    peru: "cd853f",
    pink: "ffc0cb",
    plum: "dda0dd",
    powderblue: "b0e0e6",
    purple: "800080",
    red: "f00",
    rosybrown: "bc8f8f",
    royalblue: "4169e1",
    saddlebrown: "8b4513",
    salmon: "fa8072",
    sandybrown: "f4a460",
    seagreen: "2e8b57",
    seashell: "fff5ee",
    sienna: "a0522d",
    silver: "c0c0c0",
    skyblue: "87ceeb",
    slateblue: "6a5acd",
    slategray: "708090",
    slategrey: "708090",
    snow: "fffafa",
    springgreen: "00ff7f",
    steelblue: "4682b4",
    tan: "d2b48c",
    teal: "008080",
    thistle: "d8bfd8",
    tomato: "ff6347",
    turquoise: "40e0d0",
    violet: "ee82ee",
    wheat: "f5deb3",
    white: "fff",
    whitesmoke: "f5f5f5",
    yellow: "ff0",
    yellowgreen: "9acd32"
};

// Make it easy to access colors via `hexNames[hex]`
var hexNames = tinycolor.hexNames = flip(names);


// Utilities
// ---------

// `{ 'name1': 'val1' }` becomes `{ 'val1': 'name1' }`
function flip(o) {
    var flipped = { };
    for (var i in o) {
        if (o.hasOwnProperty(i)) {
            flipped[o[i]] = i;
        }
    }
    return flipped;
}

// Take input from [0, n] and return it as [0, 1]
function bound01(n, max) {
    if (isOnePointZero(n)) { n = "100%"; }

    var processPercent = isPercentage(n);
    n = mathMin(max, mathMax(0, parseFloat(n)));

    // Automatically convert percentage into number
    if (processPercent) {
        n = parseInt(n * max, 10) / 100;
    }

    // Handle floating point rounding errors
    if ((math.abs(n - max) < 0.000001)) {
        return 1;
    }

    // Convert into [0, 1] range if it isn't already
    return (n % max) / parseFloat(max);
}

// Force a number between 0 and 1
function clamp01(val) {
    return mathMin(1, mathMax(0, val));
}

// Parse an integer into hex
function parseHex(val) {
    return parseInt(val, 16);
}

// Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
// <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
function isOnePointZero(n) {
    return typeof n == "string" && n.indexOf('.') != -1 && parseFloat(n) === 1;
}

// Check to see if string passed in is a percentage
function isPercentage(n) {
    return typeof n === "string" && n.indexOf('%') != -1;
}

// Force a hex value to have 2 characters
function pad2(c) {
    return c.length == 1 ? '0' + c : '' + c;
}

// Replace a decimal with it's percentage value
function convertToPercentage(n) {
    if (n <= 1) {
        n = (n * 100) + "%";
    }

    return n;
}

var matchers = (function() {

    // <http://www.w3.org/TR/css3-values/#integers>
    var CSS_INTEGER = "[-\\+]?\\d+%?";

    // <http://www.w3.org/TR/css3-values/#number-value>
    var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

    // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
    var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

    // Actual matching.
    // Parentheses and commas are optional, but not required.
    // Whitespace can take the place of commas or opening paren
    var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
    var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";

    return {
        rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
        rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
        hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
        hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
        hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
        hex3: /^([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
        hex6: /^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
    };
})();

// `stringInputToObject`
// Permissive string parsing.  Take in a number of formats, and output an object
// based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
function stringInputToObject(color) {

    color = color.replace(trimLeft,'').replace(trimRight, '').toLowerCase();
    var named = false;
    if (names[color]) {
        color = names[color];
        named = true;
    }
    else if (color == 'transparent') {
        return { r: 0, g: 0, b: 0, a: 0 };
    }

    // Try to match string input using regular expressions.
    // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
    // Just return an object and let the conversion functions handle that.
    // This way the result will be the same whether the tinycolor is initialized with string or object.
    var match;
    if ((match = matchers.rgb.exec(color))) {
        return { r: match[1], g: match[2], b: match[3] };
    }
    if ((match = matchers.rgba.exec(color))) {
        return { r: match[1], g: match[2], b: match[3], a: match[4] };
    }
    if ((match = matchers.hsl.exec(color))) {
        return { h: match[1], s: match[2], l: match[3] };
    }
    if ((match = matchers.hsla.exec(color))) {
        return { h: match[1], s: match[2], l: match[3], a: match[4] };
    }
    if ((match = matchers.hsv.exec(color))) {
        return { h: match[1], s: match[2], v: match[3] };
    }
    if ((match = matchers.hex6.exec(color))) {
        return {
            r: parseHex(match[1]),
            g: parseHex(match[2]),
            b: parseHex(match[3]),
            format: named ? "name" : "hex"
        };
    }
    if ((match = matchers.hex3.exec(color))) {
        return {
            r: parseHex(match[1] + '' + match[1]),
            g: parseHex(match[2] + '' + match[2]),
            b: parseHex(match[3] + '' + match[3]),
            format: named ? "name" : "hex"
        };
    }

    return false;
}

// Node: Export function
if (typeof module !== "undefined" && module.exports) {
    module.exports = tinycolor;
}
// AMD/requirejs: Define the module
else if (typeof define !== "undefined") {
    define('tinycolor',[],function () {return tinycolor;});
}
// Browser: Expose to window
else {
    root.tinycolor = tinycolor;
}

})(this);

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('elementFinder',["util", "jquery"], function (util, $) {
  var elementFinder = util.Module("elementFinder");
  var assert = util.assert;

  elementFinder.ignoreElement = function ignoreElement(el) {
    if (el instanceof $) {
      el = el[0];
    }
    while (el) {
      if ($(el).hasClass("togetherjs")) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  };

  elementFinder.elementLocation = function elementLocation(el) {
    assert(el !== null, "Got null element");
    if (el instanceof $) {
      // a jQuery element
      el = el[0];
    }
    if (el[0] && el.attr && el[0].nodeType == 1) {
      // Or a jQuery element not made by us
      el = el[0];
    }
    if (el.id) {
      return "#" + el.id;
    }
    if (el.tagName == "BODY") {
      return "body";
    }
    if (el.tagName == "HEAD") {
      return "head";
    }
    if (el === document) {
      return "document";
    }
    var parent = el.parentNode;
    if ((! parent) || parent == el) {
      console.warn("elementLocation(", el, ") has null parent");
      throw new Error("No locatable parent found");
    }
    var parentLocation = elementLocation(parent);
    var children = parent.childNodes;
    var _len = children.length;
    var index = 0;
    for (var i=0; i<_len; i++) {
      if (children[i] == el) {
        break;
      }
      if (children[i].nodeType == document.ELEMENT_NODE) {
        if (children[i].className.indexOf("togetherjs") != -1) {
          // Don't count our UI
          continue;
        }
        // Don't count text or comments
        index++;
      }
    }
    return parentLocation + ":nth-child(" + (index+1) + ")";
  };

  elementFinder.CannotFind = util.Class({
    constructor: function CannotFind(location, reason, context) {
      this.prefix = "";
      this.location = location;
      this.reason = reason;
      this.context = context;
    },
    toString: function () {
      var loc;
      try {
        loc = elementFinder.elementLocation(this.context);
      } catch (e) {
        loc = this.context;
      }
      return (
        "[CannotFind " + this.prefix +
          "(" + this.location + "): " +
          this.reason + " in " +
          loc + "]");
    }
  });

  elementFinder.findElement = function findElement(loc, container) {
    // FIXME: should this all just be done with document.querySelector()?
    // But no!  We can't ignore togetherjs elements with querySelector.
    // But maybe!  We *could* make togetherjs elements less obtrusive?
    container = container || document;
    var el, rest;
    if (loc === "body") {
      return document.body;
    } else if (loc === "head") {
      return document.head;
    } else if (loc === "document") {
      return document;
    } else if (loc.indexOf("body") === 0) {
      el = document.body;
      try {
        return findElement(loc.substr(("body").length), el);
      } catch (e) {
        if (e instanceof elementFinder.CannotFind) {
          e.prefix = "body" + e.prefix;
        }
        throw e;
      }
    } else if (loc.indexOf("head") === 0) {
      el = document.head;
      try {
        return findElement(loc.substr(("head").length), el);
      } catch (e) {
        if (e instanceof elementFinder.CannotFind) {
          e.prefix = "head" + e.prefix;
        }
        throw e;
      }
    } else if (loc.indexOf("#") === 0) {
      var id;
      loc = loc.substr(1);
      if (loc.indexOf(":") === -1) {
        id = loc;
        rest = "";
      } else {
        id = loc.substr(0, loc.indexOf(":"));
        rest = loc.substr(loc.indexOf(":"));
      }
      el = document.getElementById(id);
      if (! el) {
        throw elementFinder.CannotFind("#" + id, "No element by that id", container);
      }
      if (rest) {
        try {
          return findElement(rest, el);
        } catch (e) {
          if (e instanceof elementFinder.CannotFind) {
            e.prefix = "#" + id + e.prefix;
          }
          throw e;
        }
      } else {
        return el;
      }
    } else if (loc.indexOf(":nth-child(") === 0) {
      loc = loc.substr((":nth-child(").length);
      if (loc.indexOf(")") == -1) {
        throw "Invalid location, missing ): " + loc;
      }
      var num = loc.substr(0, loc.indexOf(")"));
      num = parseInt(num, 10);
      var count = num;
      loc = loc.substr(loc.indexOf(")") + 1);
      var children = container.childNodes;
      el = null;
      for (var i=0; i<children.length; i++) {
        var child = children[i];
        if (child.nodeType == document.ELEMENT_NODE) {
          if (child.className.indexOf("togetherjs") != -1) {
            continue;
          }
          count--;
          if (count === 0) {
            // this is the element
            el = child;
            break;
          }
        }
      }
      if (! el) {
        throw elementFinder.CannotFind(":nth-child(" + num + ")", "container only has " + (num - count) + " elements", container);
      }
      if (loc) {
        try {
          return elementFinder.findElement(loc, el);
        } catch (e) {
          if (e instanceof elementFinder.CannotFind) {
            e.prefix = ":nth-child(" + num + ")" + e.prefix;
          }
          throw e;
        }
      } else {
        return el;
      }
    } else {
      throw elementFinder.CannotFind(loc, "Malformed location", container);
    }
  };

  elementFinder.elementByPixel = function (height) {
    /* Returns {location: "...", offset: pixels}

       To get the pixel position back, you'd do:
         $(location).offset().top + offset
     */
    function search(start, height) {
      var last = null;
      var children = start.children();
      children.each(function () {
        var el = $(this);
        if (el.hasClass("togetherjs") || el.css("position") == "fixed" || ! el.is(":visible")) {
          return;
        }
        if (el.offset().top > height) {
          return false;
        }
        last = el;
      });
      if ((! children.length) || (! last)) {
        // There are no children, or only inapplicable children
        return {
          location: elementFinder.elementLocation(start[0]),
          offset: height - start.offset().top,
          absoluteTop: height,
          documentHeight: $(document).height()
        };
      }
      return search(last, height);
    }
    return search($(document.body), height);
  };

  elementFinder.pixelForPosition = function (position) {
    /* Inverse of elementFinder.elementByPixel */
    if (position.location == "body") {
      return position.offset;
    }
    var el;
    try {
      el = elementFinder.findElement(position.location);
    } catch (e) {
      if (e instanceof elementFinder.CannotFind && position.absoluteTop) {
        // We don't trust absoluteTop to be quite right locally, so we adjust
        // for the total document height differences:
        var percent = position.absoluteTop / position.documentHeight;
        return $(document).height() * percent;
      }
      throw e;
    }
    var top = $(el).offset().top;
    // FIXME: maybe here we should test for sanity, like if an element is
    // hidden.  We can use position.absoluteTop to get a sense of where the
    // element roughly should be.  If the sanity check failed we'd use
    // absoluteTop
    return top + position.offset;
  };

  return elementFinder;

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Loading this module will cause, when TogetherJS is active, the
   session object to emit visibility-change with a `hidden` argument
   whenever the visibility changes, on browsers where we can detect
   it.
   */

define('visibilityApi',["util", "session"], function (util, session) {
  var visibilityApi = util.Module("visibilityApi");
  var hidden;
  var visibilityChange;
  if (document.hidden !== undefined) { // Opera 12.10 and Firefox 18 and later support
    hidden = "hidden";
    visibilityChange = "visibilitychange";
  } else if (document.mozHidden !== undefined) {
    hidden = "mozHidden";
    visibilityChange = "mozvisibilitychange";
  } else if (document.msHidden !== undefined) {
    hidden = "msHidden";
    visibilityChange = "msvisibilitychange";
  } else if (document.webkitHidden !== undefined) {
    hidden = "webkitHidden";
    visibilityChange = "webkitvisibilitychange";
  }

  session.on("start", function () {
    document.addEventListener(visibilityChange, change, false);
  });

  session.on("close", function () {
    document.removeEventListener(visibilityChange, change, false);
  });

  function change() {
    session.emit("visibility-change", document[hidden]);
  }

  visibilityApi.hidden = function () {
    return document[hidden];
  };

  return visibilityApi;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('ui',["require", "jquery", "util", "session", "templates", "templating", "linkify", "peers", "windowing", "tinycolor", "elementFinder", "visibilityApi"], function (require, $, util, session, templates, templating, linkify, peers, windowing, tinycolor, elementFinder, visibilityApi) {
  var ui = util.Module('ui');
  var assert = util.assert;
  var AssertionError = util.AssertionError;
  var chat;
  var $window = $(window);
  // This is also in togetherjs.less, as @button-height:
  var BUTTON_HEIGHT = 60 + 1; // 60 is button height, 1 is border
  // chat TextArea
  var TEXTAREA_LINE_HEIGHT = 20; // in pixels
  var TEXTAREA_MAX_LINES = 5;
  // This is also in togetherjs.less, under .togetherjs-animated
  var ANIMATION_DURATION = 1000;
  // Time the new user window sticks around until it fades away:
  var NEW_USER_FADE_TIMEOUT = 5000;
  // This is set when an animation will keep the UI from being ready
  // (until this time):
  var finishedAt = null;
  // Time in milliseconds for the dock to animate out:
  var DOCK_ANIMATION_TIME = 300;
  // If two chat messages come from the same person in this time
  // (milliseconds) then they are collapsed into one message:
  var COLLAPSE_MESSAGE_LIMIT = 5000;

  var COLORS = [
    "#8A2BE2", "#7FFF00", "#DC143C", "#00FFFF", "#8FBC8F", "#FF8C00", "#FF00FF",
    "#FFD700", "#F08080", "#90EE90", "#FF6347"];

  // This would be a circular import, but we just need the chat module sometime
  // after everything is loaded, and this is sure to complete by that time:
  require(["chat"], function (c) {
    chat = c;
  });

  /* Displays some toggleable element; toggleable elements have a
     data-toggles attribute that indicates what other elements should
     be hidden when this element is shown. */
  ui.displayToggle = function (el) {
    el = $(el);
    assert(el.length, "No element", arguments[0]);
    var other = $(el.attr("data-toggles"));
    assert(other.length, "Cannot toggle", el[0], "selector", other.selector);
    other.hide();
    el.show();
  };

  function panelPosition() {
    var iface = $("#togetherjs-dock");
    if (iface.hasClass("togetherjs-dock-right")) {
      return "right";
    } else if (iface.hasClass("togetherjs-dock-left")) {
      return "left";
    } else if (iface.hasClass("togetherjs-dock-bottom")) {
      return "bottom";
    } else {
      throw new AssertionError("#togetherjs-dock doesn't have positioning class");
    }
  }

  ui.container = null;

  // This is used for some signalling when ui.prepareUI and/or
  // ui.activateUI is called before the DOM is fully loaded:
  var deferringPrepareUI = null;

  function deferForContainer(func) {
    /* Defers any calls to func() until after ui.container is set
       Function cannot have a return value (as sometimes the call will
       become async).  Use like:

       method: deferForContainer(function (args) {...})
       */
    return function () {
      if (ui.container) {
        func.apply(this, arguments);
      }
      var self = this;
      var args = Array.prototype.slice.call(arguments);
      session.once("ui-ready", function () {
        func.apply(self, args);
      });
    };
  }

  // This is called before activateUI; it doesn't bind anything, but does display
  // the dock
  // FIXME: because this module has lots of requirements we can't do
  // this before those requirements are loaded.  Maybe worth splitting
  // this out?  OTOH, in production we should have all the files
  // combined so there's not much problem loading those modules.
  ui.prepareUI = function () {
    if (! (document.readyState == "complete" || document.readyState == "interactive")) {
      // Too soon!  Wait a sec...
      deferringPrepareUI = "deferring";
      document.addEventListener("DOMContentLoaded", function () {
        var d = deferringPrepareUI;
        deferringPrepareUI = null;
        ui.prepareUI();
        // This happens when ui.activateUI is called before the document has been
        // loaded:
        if (d == "activate") {
          ui.activateUI();
        }
      });
      return;
    }
    var container = ui.container = $(templates["interface"]);
    assert(container.length);
    $("body").append(container);
    fixupAvatars(container);
    if (session.firstRun && TogetherJS.startTarget) {
      // Time at which the UI will be fully ready:
      // (We have to do this because the offset won't be quite right
      // until the animation finishes - attempts to calculate the
      // offset without taking into account CSS transforms have so far
      // failed.)
      var timeoutSeconds = DOCK_ANIMATION_TIME / 1000;
      finishedAt = Date.now() + DOCK_ANIMATION_TIME + 50;
      setTimeout(function () {
        finishedAt = Date.now() + DOCK_ANIMATION_TIME + 40;
        var iface = container.find("#togetherjs-dock");
        var start = iface.offset();
        var pos = $(TogetherJS.startTarget).offset();
        pos.top = Math.floor(pos.top - start.top);
        pos.left = Math.floor(pos.left - start.left);
        var translate = "translate(" + pos.left + "px, " + pos.top + "px)";
        iface.css({
          MozTransform: translate,
          WebkitTransform: translate,
          transform: translate,
          opacity: "0.0"
        });
        setTimeout(function () {
          // We keep recalculating because the setTimeout times aren't always so accurate:
          finishedAt = Date.now() + DOCK_ANIMATION_TIME + 20;
          var transition = "transform " + timeoutSeconds + "s ease-out, ";
          transition += "opacity " + timeoutSeconds + "s ease-out";
          iface.css({
            opacity: "1.0",
            MozTransition: "-moz-" + transition,
            MozTransform: "translate(0, 0)",
            WebkitTransition: "-webkit-" + transition,
            WebkitTransform: "translate(0, 0)",
            transition: transition,
            transform: "translate(0, 0)"
          });
          setTimeout(function () {
            finishedAt = null;
            iface.attr("style", "");
          }, 510);
        }, 5);
      }, 5);
    }
    if (TogetherJS.startTarget) {
      var el = $(TogetherJS.startTarget);
      var text = el.text().toLowerCase().replace(/\s+/g, " ");
      text = text.replace(/^\s*/, "").replace(/\s*$/, "");
      if (text == "start togetherjs") {
        el.attr("data-end-togetherjs-html", "End TogetherJS");
      }
      if (el.attr("data-end-togetherjs-html")) {
        el.attr("data-start-togetherjs-html", el.html());
        el.html(el.attr("data-end-togetherjs-html"));
      }
      el.addClass("togetherjs-started");
    }
    ui.container.find(".togetherjs-window > header, .togetherjs-modal > header").each(function () {
      $(this).append($('<button class="togetherjs-close"></button>'));
    });

    TogetherJS.config.track("disableWebRTC", function (hide, previous) {
      if (hide && ! previous) {
        ui.container.find("#togetherjs-audio-button").hide();
        adjustDockSize(-1);
      } else if ((! hide) && previous) {
        ui.container.find("#togetherjs-audio-button").show();
        adjustDockSize(1);
      }
    });

  };

  // After prepareUI, this actually makes the interface live.  We have
  // to do this later because we call prepareUI when many components
  // aren't initialized, so we don't even want the user to be able to
  // interact with the interface.  But activateUI is called once
  // everything is loaded and ready for interaction.
  ui.activateUI = function () {
    if (deferringPrepareUI) {
      console.warn("ui.activateUI called before document is ready; waiting...");
      deferringPrepareUI = "activate";
      return;
    }
    if (! ui.container) {
      ui.prepareUI();
    }
    var container = ui.container;

    //create the overlay
    if($.browser.mobile) {
      // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: 0; background-color: rgba(0,0,0,0); width: 120%; height: 100%; z-index: 1000; margin: -10px'>\x3c/div>" );
    }

    // The share link:
    ui.prepareShareLink(container);
    container.find("input.togetherjs-share-link").on("keydown", function (event) {
      if (event.which == 27) {
        windowing.hide("#togetherjs-share");
        return false;
      }
      return undefined;
    });
    session.on("shareId", updateShareLink);

    // The chat input element:
    var input = container.find("#togetherjs-chat-input");
    input.bind("keydown", function (event) {
      if (event.which == 13 && !event.shiftKey) { // Enter without Shift pressed
        submitChat();
        return false;
      }
      if (event.which == 27) { // Escape
        windowing.hide("#togetherjs-chat");
        return false;
      }
    });

    function submitChat() {
      var val = input.val();
      if ($.trim(val)) {
        input.val("");
        // triggering the event manually to avoid the addition of newline character to the textarea:
        input.trigger("input").trigger("propertychange");
        chat.submit(val);
      }
    }
    // auto-resize textarea:
    input.on("input propertychange", function () {
      var $this = $(this);
      var actualHeight = $this.height();
      // reset the height of textarea to remove trailing empty space (used for shrinking):
      $this.height(TEXTAREA_LINE_HEIGHT);
      this.scrollTop = 0;
      // scroll to bottom:
      this.scrollTop = 9999;
      var newHeight = this.scrollTop + $this.height();
      var maxHeight = TEXTAREA_MAX_LINES * TEXTAREA_LINE_HEIGHT;
      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        this.style.overflowY = "scroll";
      } else {
        this.style.overflowY = "hidden";
      }
      this.style.height = newHeight + "px";
      var diff = newHeight - actualHeight;
      $("#togetherjs-chat-input-box").height($("#togetherjs-chat-input-box").height() + diff);
      $("#togetherjs-chat-messages").height($("#togetherjs-chat-messages").height() - diff);
      return false;
    });

    util.testExpose({submitChat: submitChat});

    // Moving the window:
    // FIXME: this should probably be stickier, and not just move the window around
    // so abruptly
    var anchor = container.find("#togetherjs-dock-anchor");
    assert(anchor.length);
    // FIXME: This is in place to temporarily disable dock dragging:
    anchor = container.find("#togetherjs-dock-anchor-disabled");
    anchor.mousedown(function (event) {
      var iface = $("#togetherjs-dock");
      // FIXME: switch to .offset() and pageX/Y
      var startPos = panelPosition();
      function selectoff() {
        return false;
      }
      function mousemove(event2) {
        var fromRight = $window.width() + window.pageXOffset - event2.pageX;
        var fromLeft = event2.pageX - window.pageXOffset;
        var fromBottom = $window.height() + window.pageYOffset - event2.pageY;
        // FIXME: this is to temporarily disable the bottom view:
        fromBottom = 10000;

        var pos;
        if (fromLeft < fromRight && fromLeft < fromBottom) {
          pos = "left";
        } else if (fromRight < fromLeft && fromRight < fromBottom) {
          pos = "right";
        } else {
          pos = "bottom";
        }
        iface.removeClass("togetherjs-dock-left");
        iface.removeClass("togetherjs-dock-right");
        iface.removeClass("togetherjs-dock-bottom");
        iface.addClass("togetherjs-dock-" + pos);
        if (startPos && pos != startPos) {
          windowing.hide();
          startPos = null;
        }
      }
      $(document).bind("mousemove", mousemove);
      // If you don't turn selection off it will still select text, and show a
      // text selection cursor:
      $(document).bind("selectstart", selectoff);
      // FIXME: it seems like sometimes we lose the mouseup event, and it's as though
      // the mouse is stuck down:
      $(document).one("mouseup", function () {
        $(document).unbind("mousemove", mousemove);
        $(document).unbind("selectstart", selectoff);
      });
      return false;
    });

    function openDock() {
      $('.togetherjs-window').animate({
        opacity: 1
      });
      $('#togetherjs-dock-participants').animate({
        opacity: 1
      });
      $('#togetherjs-dock #togetherjs-buttons').animate({
        opacity: 1
      });

      //for iphone
      if($(window).width() < 480) {
        $('.togetherjs-dock-right').animate({
          width: "204px"
        }, {
          duration:60, easing:"linear"
        });
      }

      //for ipad
      else {
        $('.togetherjs-dock-right').animate({
          width: "27%"
        }, {
          duration:60, easing:"linear"
        });
      }


      // add bg overlay
      // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: -2px; background-color: rgba(0,0,0,0.5); width: 200%; height: 400%; z-index: 1000; margin: 0px;'>\x3c/div>" );

      //disable vertical scrolling
      // $("body").css({
      //   "position": "fixed",
      //   top: 0,
      //   left: 0
      // });

      //replace the anchor icon
      var src = "/togetherjs/images/togetherjs-logo-close.png";
      $("#togetherjs-dock-anchor #togetherjs-dock-anchor-horizontal img").attr("src", src);
    }

    function closeDock() {
      //enable vertical scrolling
      $("body").css({
        "position": "",
        top: "",
        left: ""
      });

      //replace the anchor icon
      var src = "/togetherjs/images/togetherjs-logo-open.png";
      $("#togetherjs-dock-anchor #togetherjs-dock-anchor-horizontal img").attr("src", src);

      $('.togetherjs-window').animate({
        opacity: 0
      });
      $('#togetherjs-dock-participants').animate({
        opacity: 0
      });
      $('#togetherjs-dock #togetherjs-buttons').animate({
        opacity: 0
      });
      $('.togetherjs-dock-right').animate({
        width: "40px"
      }, {
        duration:60, easing:"linear"
      });

      // remove bg overlay
      //$(".overlay").remove();
    }

    // Setting the anchor button + dock mobile actions
    if($.browser.mobile) {

      // toggle the audio button
      $("#togetherjs-audio-button").click(function () {
        windowing.toggle("#togetherjs-rtc-not-supported");
      });

      // toggle the profile button
      $("#togetherjs-profile-button").click(function () {
        windowing.toggle("#togetherjs-menu-window");
      });

      // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: -2px; background-color: rgba(0,0,0,0.5); width: 200%; height: 400%; z-index: 1000; margin: 0px'>\x3c/div>" );

      //disable vertical scrolling
      // $("body").css({
      //   "position": "fixed",
      //   top: 0,
      //   left: 0
      // });

      //replace the anchor icon
      var src = "/togetherjs/images/togetherjs-logo-close.png";
      $("#togetherjs-dock-anchor #togetherjs-dock-anchor-horizontal img").attr("src", src);

      $("#togetherjs-dock-anchor").toggle(function() {
          closeDock();
        },function(){
          openDock();
      });
    }

    $("#togetherjs-share-button").click(function () {
      windowing.toggle("#togetherjs-share");
    });

    $("#togetherjs-profile-button").click(function (event) {
      if ($.browser.mobile) {
        windowing.show("#togetherjs-menu-window");
        return false;
      }
      toggleMenu();
      event.stopPropagation();
      return false;
    });

    $("#togetherjs-menu-feedback, #togetherjs-menu-feedback-button").click(function(){
      windowing.hide();
      hideMenu();
      windowing.show("#togetherjs-feedback-form");
    });

    $("#togetherjs-menu-help, #togetherjs-menu-help-button").click(function () {
      windowing.hide();
      hideMenu();
      require(["walkthrough"], function (walkthrough) {
        windowing.hide();
        walkthrough.start(false);
      });
    });

    $("#togetherjs-menu-update-name").click(function () {
      var input = $("#togetherjs-menu .togetherjs-self-name");
      input.css({
        width: $("#togetherjs-menu").width() - 32 + "px"
      });
      ui.displayToggle("#togetherjs-menu .togetherjs-self-name");
      $("#togetherjs-menu .togetherjs-self-name").focus();
    });

    $("#togetherjs-menu-update-name-button").click(function () {
      windowing.show("#togetherjs-edit-name-window");
      $("#togetherjs-edit-name-window input").focus();
    });

    $("#togetherjs-menu .togetherjs-self-name").bind("keyup change", function (event) {
      console.log("alrighty", event);
      if (event.which == 13) {
        ui.displayToggle("#togetherjs-self-name-display");
        return;
      }
      var val = $("#togetherjs-menu .togetherjs-self-name").val();
      console.log("values!!", val);
      if (val) {
        peers.Self.update({name: val});
      }
    });

    $("#togetherjs-menu-update-avatar, #togetherjs-menu-update-avatar-button").click(function () {
      hideMenu();
      windowing.show("#togetherjs-avatar-edit");
    });

    $("#togetherjs-menu-end, #togetherjs-menu-end-button").click(function () {
      hideMenu();
      windowing.show("#togetherjs-confirm-end");
    });

    $("#togetherjs-end-session").click(function () {
      session.close();
      //$(".overlay").remove();

    });

    $("#togetherjs-menu-update-color").click(function () {
      var picker = $("#togetherjs-pick-color");
      if (picker.is(":visible")) {
        picker.hide();
        return;
      }
      picker.show();
      bindPicker();
      picker.find(".togetherjs-swatch-active").removeClass("togetherjs-swatch-active");
      picker.find(".togetherjs-swatch[data-color=\"" + peers.Self.color + "\"]").addClass("togetherjs-swatch-active");
    });

    $("#togetherjs-pick-color").click(".togetherjs-swatch", function (event) {
      var swatch = $(event.target);
      var color = swatch.attr("data-color");
      peers.Self.update({
        color: color
      });
      event.stopPropagation();
      return false;
    });

    $("#togetherjs-pick-color").click(function (event) {
      $("#togetherjs-pick-color").hide();
      event.stopPropagation();
      return false;
    });

    COLORS.forEach(function (color) {
      var el = templating.sub("swatch");
      el.attr("data-color", color);
      var darkened = tinycolor.darken(color);
      el.css({
        backgroundColor: color,
        borderColor: darkened
      });
      $("#togetherjs-pick-color").append(el);
    });

    $("#togetherjs-chat-button").click(function () {
      windowing.toggle("#togetherjs-chat");
    });

    session.on("display-window", function (id, element) {
      if (id == "togetherjs-chat") {
        if (! $.browser.mobile) {
          $("#togetherjs-chat-input").focus();
        }
      } else if (id == "togetherjs-share") {
        var link = element.find("input.togetherjs-share-link");
        if (link.is(":visible")) {
          link.focus().select();
        }
      }
    });

    container.find("#togetherjs-chat-notifier").click(function (event) {
      if ($(event.target).is("a") || container.is(".togetherjs-close")) {
        return;
      }
      windowing.show("#togetherjs-chat");
    });

    // FIXME: Don't think this makes sense
    $(".togetherjs header.togetherjs-title").each(function (index, item) {
      var button = $('<button class="togetherjs-minimize"></button>');
      button.click(function (event) {
        var window = button.closest(".togetherjs-window");
        windowing.hide(window);
      });
      $(item).append(button);
    });

    $("#togetherjs-avatar-done").click(function () {
      ui.displayToggle("#togetherjs-no-avatar-edit");
    });

    $("#togetherjs-self-color").css({backgroundColor: peers.Self.color});

    var avatar = peers.Self.avatar;
    if (avatar) {
      $("#togetherjs-self-avatar").attr("src", avatar);
    }

    var starterButton = $("#togetherjs-starter button");
    starterButton.click(function () {
      windowing.show("#togetherjs-about");
    }).addClass("togetherjs-running");
    if (starterButton.text() == "Start TogetherJS") {
      starterButton.attr("data-start-text", starterButton.text());
      starterButton.text("End TogetherJS Session");
    }

    ui.activateAvatarEdit(container, {
      onSave: function () {
        windowing.hide("#togetherjs-avatar-edit");
      }
    });

    TogetherJS.config.track("inviteFromRoom", function (inviter, previous) {
      if (inviter) {
        container.find("#togetherjs-invite").show();
      } else {
        container.find("#togetherjs-invite").hide();
      }
    });

    container.find("#togetherjs-menu-refresh-invite").click(refreshInvite);
    container.find("#togetherjs-menu-invite-anyone").click(function () {
      invite(null);
    });

    // The following lines should be at the end of this function
    // (new code goes above)
    session.emit("new-element", ui.container);

    if (finishedAt && finishedAt > Date.now()) {
      setTimeout(function () {
        finishedAt = null;
        session.emit("ui-ready", ui);
      }, finishedAt - Date.now());
    } else {
      session.emit("ui-ready", ui);
    }

  }; // End ui.activateUI()

  ui.activateAvatarEdit = function (container, options) {
    options = options || {};
    var pendingImage = null;

    container.find(".togetherjs-avatar-save").prop("disabled", true);

    container.find(".togetherjs-avatar-save").click(function () {
      if (pendingImage) {
        peers.Self.update({avatar: pendingImage});
        container.find(".togetherjs-avatar-save").prop("disabled", true);
        if (options.onSave) {
          options.onSave();
        }
      }
    });

    container.find(".togetherjs-upload-avatar").on("change", function () {
      util.readFileImage(this).then(function (url) {
        sizeDownImage(url).then(function (smallUrl) {
          pendingImage = smallUrl;
          container.find(".togetherjs-avatar-preview").css({
            backgroundImage: 'url(' + pendingImage + ')'
          });
          container.find(".togetherjs-avatar-save").prop("disabled", false);
          if (options.onPending) {
            options.onPending();
          }
        });
      });
    });

  };

  function sizeDownImage(imageUrl) {
    return util.Deferred(function (def) {
      var $canvas = $("<canvas>");
      $canvas[0].height = session.AVATAR_SIZE;
      $canvas[0].width = session.AVATAR_SIZE;
      var context = $canvas[0].getContext("2d");
      var img = new Image();
      img.src = imageUrl;
      // Sometimes the DOM updates immediately to call
      // naturalWidth/etc, and sometimes it doesn't; using setTimeout
      // gives it a chance to catch up
      setTimeout(function () {
        var width = img.naturalWidth || img.width;
        var height = img.naturalHeight || img.height;
        width = width * (session.AVATAR_SIZE / height);
        height = session.AVATAR_SIZE;
        context.drawImage(img, 0, 0, width, height);
        def.resolve($canvas[0].toDataURL("image/png"));
      });
    });
  }

  function fixupAvatars(container) {
    /* All <div class="togetherjs-person" /> elements need an element inside,
       so we add that element here */
    container.find(".togetherjs-person").each(function () {
      var $this = $(this);
      var inner = $this.find(".togetherjs-person-avatar-swatch");
      if (! inner.length) {
        $this.append('<div class="togetherjs-person-avatar-swatch"></div>');
      }
    });
  }

  ui.prepareShareLink = function (container) {
    container.find("input.togetherjs-share-link").click(function () {
      $(this).select();
    }).change(function () {
      updateShareLink();
    });
    container.find("a.togetherjs-share-link").click(function () {
      // FIXME: this is currently opening up Bluetooth, not sharing a link
      if (false && window.MozActivity) {
        var activity = new MozActivity({
          name: "share",
          data: {
            type: "url",
            url: $(this).attr("href")
          }
        });
      }
      // FIXME: should show some help if you actually try to follow the link
      // like this, instead of simply suppressing it
      return false;
    });
    updateShareLink();
  };

  // Menu

  function showMenu(event) {
    var el = $("#togetherjs-menu");
    assert(el.length);
    el.show();
    bindMenu();
    $(document).bind("click", maybeHideMenu);
  }

  function bindMenu() {
    var el = $("#togetherjs-menu:visible");
    if (el.length) {
      var bound = $("#togetherjs-profile-button");
      var boundOffset = bound.offset();
      el.css({
        top: boundOffset.top + bound.height() - $window.scrollTop() + "px",
        left: (boundOffset.left + bound.width() - 10 - el.width() - $window.scrollLeft()) + "px"
      });
    }
  }

  function bindPicker() {
    var picker = $("#togetherjs-pick-color:visible");
    if (picker.length) {
      var menu = $("#togetherjs-menu-update-color");
      var menuOffset = menu.offset();
      picker.css({
        top: menuOffset.top + menu.height(),
        left: menuOffset.left
      });
    }
  }

  session.on("resize", function () {
    bindMenu();
    bindPicker();
  });

  function toggleMenu() {
    if ($("#togetherjs-menu").is(":visible")) {
      hideMenu();
    } else {
      showMenu();
    }
  }

  function hideMenu() {
    var el = $("#togetherjs-menu");
    el.hide();
    $(document).unbind("click", maybeHideMenu);
    ui.displayToggle("#togetherjs-self-name-display");
    $("#togetherjs-pick-color").hide();
  }

  function maybeHideMenu(event) {
    var t = event.target;
    while (t) {
      if (t.id == "togetherjs-menu") {
        // Click inside the menu, ignore this
        return;
      }
      t = t.parentNode;
    }
    hideMenu();
  }

  function adjustDockSize(buttons) {
    /* Add or remove spots from the dock; positive number to
       add button(s), negative number to remove button(s)
       */
    assert(typeof buttons == "number");
    assert(buttons && Math.floor(buttons) == buttons);
    var iface = $("#togetherjs-dock");
    var newHeight = iface.height() + (BUTTON_HEIGHT * buttons);
    assert(newHeight >= BUTTON_HEIGHT * 3, "Height went too low (", newHeight,
           "), should never be less than 3 buttons high (", BUTTON_HEIGHT * 3, ")");
    iface.css({
      height: newHeight + "px"
    });
  }

  // Misc

  function updateShareLink() {
    var input = $("input.togetherjs-share-link");
    var link = $("a.togetherjs-share-link");
    var display = $("#togetherjs-session-id");
    if (! session.shareId) {
      input.val("");
      link.attr("href", "#");
      display.text("(none)");
    } else {
      input.val(session.shareUrl());
      link.attr("href", session.shareUrl());
      display.text(session.shareId);
    }
  }

  session.on("close", function () {

    if($.browser.mobile) {
      // remove bg overlay
      //$(".overlay").remove();

      //after hitting End, reset window draggin
      $("body").css({
        "position": "",
        top: "",
        left: ""
      });

    }

    if (ui.container) {
      ui.container.remove();
      ui.container = null;
    }
    // Clear out any other spurious elements:
    $(".togetherjs").remove();
    var starterButton = $("#togetherjs-starter button");
    starterButton.removeClass("togetherjs-running");
    if (starterButton.attr("data-start-text")) {
      starterButton.text(starterButton.attr("data-start-text"));
      starterButton.attr("data-start-text", "");
    }
    if (TogetherJS.startTarget) {
      var el = $(TogetherJS.startTarget);
      if (el.attr("data-start-togetherjs-html")) {
        el.html(el.attr("data-start-togetherjs-html"));
      }
      el.removeClass("togetherjs-started");
    }
  });

  ui.chat = {
    text: function (attrs) {
      assert(typeof attrs.text == "string");
      assert(attrs.peer);
      assert(attrs.messageId);
      var date = attrs.date || Date.now();
      var lastEl = ui.container.find("#togetherjs-chat .togetherjs-chat-message");
      if (lastEl.length) {
        lastEl = $(lastEl[lastEl.length-1]);
      }
      var lastDate = null;
      if (lastEl) {
        lastDate = parseInt(lastEl.attr("data-date"), 10);
      }
      if (lastEl && lastEl.attr("data-person") == attrs.peer.id &&
          lastDate && date < lastDate + COLLAPSE_MESSAGE_LIMIT) {
        lastEl.attr("data-date", date);
        var content = lastEl.find(".togetherjs-chat-content");
        assert(content.length);
        attrs.text = content.text() + "\n" + attrs.text;
        attrs.messageId = lastEl.attr("data-message-id");
        lastEl.remove();
      }
      var el = templating.sub("chat-message", {
        peer: attrs.peer,
        content: attrs.text,
        date: date
      });
      linkify(el.find(".togetherjs-chat-content"));
      el.attr("data-person", attrs.peer.id)
        .attr("data-date", date)
        .attr("data-message-id", attrs.messageId);
      ui.chat.add(el, attrs.messageId, attrs.notify);
    },

    joinedSession: function (attrs) {
      assert(attrs.peer);
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-joined", {
        peer: attrs.peer,
        date: date
      });
      // FIXME: should bind the notification to the dock location
      ui.chat.add(el, attrs.peer.className("join-message-"), 4000);
    },

    leftSession: function (attrs) {
      assert(attrs.peer);
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-left", {
        peer: attrs.peer,
        date: date,
        declinedJoin: attrs.declinedJoin
      });
      // FIXME: should bind the notification to the dock location
      ui.chat.add(el, attrs.peer.className("join-message-"), 4000);
    },

    system: function (attrs) {
      assert(! attrs.peer);
      assert(typeof attrs.text == "string");
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-system", {
        content: attrs.text,
        date: date
      });
      ui.chat.add(el, undefined, true);
    },

    clear: deferForContainer(function () {
      var container = ui.container.find("#togetherjs-chat-messages");
      container.empty();
    }),

    urlChange: function (attrs) {
      assert(attrs.peer);
      assert(typeof attrs.url == "string");
      assert(typeof attrs.sameUrl == "boolean");
      var messageId = attrs.peer.className("url-change-");
      // FIXME: duplicating functionality in .add():
      var realId = "togetherjs-chat-" + messageId;
      var date = attrs.date || Date.now();
      var title;
      // FIXME: strip off common domain from msg.url?  E.g., if I'm on
      // http://example.com/foobar, and someone goes to http://example.com/baz then
      // show only /baz
      // FIXME: truncate long titles
      if (attrs.title) {
        title = attrs.title + " (" + attrs.url + ")";
      } else {
        title = attrs.url;
      }
      var el = templating.sub("url-change", {
        peer: attrs.peer,
        date: date,
        href: attrs.url,
        title: title,
        sameUrl: attrs.sameUrl
      });
      el.find(".togetherjs-nudge").click(function () {
        attrs.peer.nudge();
        return false;
      });
      el.find(".togetherjs-follow").click(function () {
        var url = attrs.peers.url;
        if (attrs.peer.urlHash) {
          url += attrs.peer.urlHash;
        }
        location.href = url;
      });
      var notify = ! attrs.sameUrl;
      if (attrs.sameUrl && ! $("#" + realId).length) {
        // Don't bother showing a same-url notification, if no previous notification
        // had been shown
        return;
      }
      ui.chat.add(el, messageId, notify);
    },

    invite: function (attrs) {
      assert(attrs.peer);
      assert(typeof attrs.url == "string");
      var messageId = attrs.peer.className("invite-");
      var date = attrs.date || Date.now();
      var hrefTitle = attrs.url.replace(/\#?&togetherjs=.*/, "").replace(/^\w+:\/\//, "");
      var el = templating.sub("invite", {
        peer: attrs.peer,
        date: date,
        href: attrs.url,
        hrefTitle: hrefTitle,
        forEveryone: attrs.forEveryone
      });
      if (attrs.forEveryone) {
        el.find("a").click(function () {
          // FIXME: hacky way to do this:
          chat.submit("Followed link to " + attrs.url);
        });
      }
      ui.chat.add(el, messageId, true);
    },

    hideTimeout: null,

    add: deferForContainer(function (el, id, notify) {
      if (id) {
        el.attr("id", "togetherjs-chat-" + util.safeClassName(id));
      }
      var container = ui.container.find("#togetherjs-chat-messages");
      assert(container.length);
      var popup = ui.container.find("#togetherjs-chat-notifier");
      container.append(el);
      ui.chat.scroll();
      var doNotify = !! notify;
      var section = popup.find("#togetherjs-chat-notifier-message");
      if (notify && visibilityApi.hidden()) {
        ui.container.find("#togetherjs-notification")[0].play();
      }
      if (id && section.data("message-id") == id) {
        doNotify = true;
      }
      if (container.is(":visible")) {
        doNotify = false;
      }
      if (doNotify) {
        section.empty();
        section.append(el.clone(true, true));
        if (section.data("message-id") != id)  {
          section.data("message-id", id || "");
          windowing.show(popup);
        } else if (! popup.is(":visible")) {
          windowing.show(popup);
        }
        if (typeof notify == "number") {
          // This is the amount of time we're supposed to notify
          if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
          }
          this.hideTimeout = setTimeout((function () {
            windowing.hide(popup);
            this.hideTimeout = null;
          }).bind(this), notify);
        }
      }
    }),

    scroll: deferForContainer(function () {
      var container = ui.container.find("#togetherjs-chat-messages")[0];
      container.scrollTop = container.scrollHeight;
    })

  };

  session.on("display-window", function (id, win) {
    if (id == "togetherjs-chat") {
      ui.chat.scroll();
      windowing.hide("#togetherjs-chat-notifier");
    }
  });

  /* This class is bound to peers.Peer instances as peer.view.
     The .update() method is regularly called by peer objects when info changes. */
  ui.PeerView = util.Class({

    constructor: function (peer) {
      assert(peer.isSelf !== undefined, "PeerView instantiated with non-Peer object");
      this.peer = peer;
      this.dockClick = this.dockClick.bind(this);
    },

    /* Takes an element and sets any person-related attributes on the element
       Different from updates, which use the class names we set here: */
    setElement: function (el) {
      var count = 0;
      var classes = ["togetherjs-person", "togetherjs-person-status",
                     "togetherjs-person-name", "togetherjs-person-name-abbrev",
                     "togetherjs-person-bgcolor", "togetherjs-person-swatch",
                     "togetherjs-person-status", "togetherjs-person-role",
                     "togetherjs-person-url", "togetherjs-person-url-title",
                     "togetherjs-person-bordercolor"];
      classes.forEach(function (cls) {
        var els = el.find("." + cls);
        els.addClass(this.peer.className(cls + "-"));
        count += els.length;
      }, this);
      if (! count) {
        console.warn("setElement(", el, ") doesn't contain any person items");
      }
      this.updateDisplay(el);
    },

    updateDisplay: deferForContainer(function (container) {
      container = container || ui.container;
      var abbrev = this.peer.name;
      if (this.peer.isSelf) {
        abbrev = "me";
      }
      container.find("." + this.peer.className("togetherjs-person-name-")).text(this.peer.name || "");
      container.find("." + this.peer.className("togetherjs-person-name-abbrev-")).text(abbrev);
      var avatarEl = container.find("." + this.peer.className("togetherjs-person-"));
      if (this.peer.avatar) {
        util.assertValidUrl(this.peer.avatar);
        avatarEl.css({
          backgroundImage: "url(" + this.peer.avatar + ")"
        });
      }
      if (this.peer.idle == "inactive") {
        avatarEl.addClass("togetherjs-person-inactive");
      } else {
        avatarEl.removeClass("togetherjs-person-inactive");
      }
      avatarEl.attr("title", this.peer.name);
      if (this.peer.color) {
        avatarEl.css({
          borderColor: this.peer.color
        });
        avatarEl.find(".togetherjs-person-avatar-swatch").css({
          borderTopColor: this.peer.color,
          borderRightColor: this.peer.color
        });
      }
      if (this.peer.color) {
        var colors = container.find("." + this.peer.className("togetherjs-person-bgcolor-"));
        colors.css({
          backgroundColor: this.peer.color
        });
        colors = container.find("." + this.peer.className("togetherjs-person-bordercolor-"));
        colors.css({
          borderColor: this.peer.color
        });
      }
      container.find("." + this.peer.className("togetherjs-person-role-"))
        .text(this.peer.isCreator ? "Creator" : "Participant");
      var urlName = this.peer.title || "";
      if (this.peer.title) {
        urlName += " (";
      }
      urlName += util.truncateCommonDomain(this.peer.url, location.href);
      if (this.peer.title) {
        urlName += ")";
      }
      container.find("." + this.peer.className("togetherjs-person-url-title-"))
        .text(urlName);
      var url = this.peer.url;
      if (this.peer.urlHash) {
        url += this.peer.urlHash;
      }
      container.find("." + this.peer.className("togetherjs-person-url-"))
        .attr("href", url);
      // FIXME: should have richer status:
      container.find("." + this.peer.className("togetherjs-person-status-"))
        .text(this.peer.idle == "active" ? "Active" : "Inactive");
      if (this.peer.isSelf) {
        // FIXME: these could also have consistent/reliable class names:
        var selfName = $(".togetherjs-self-name");
        selfName.each((function (index, el) {
          el = $(el);
          if (el.val() != this.peer.name) {
            el.val(this.peer.name);
          }
        }).bind(this));
        $("#togetherjs-menu-avatar").attr("src", this.peer.avatar);
        if (! this.peer.name) {
          $("#togetherjs-menu .togetherjs-person-name-self").text(this.peer.defaultName);
        }
      }
      if (this.peer.url != session.currentUrl()) {
        container.find("." + this.peer.className("togetherjs-person-"))
            .addClass("togetherjs-person-other-url");
      } else {
        container.find("." + this.peer.className("togetherjs-person-"))
            .removeClass("togetherjs-person-other-url");
      }
      if (this.peer.following) {
        if (this.followCheckbox) {
          this.followCheckbox.prop("checked", true);
        }
      } else {
        if (this.followCheckbox) {
          this.followCheckbox.prop("checked", false);
        }
      }
      // FIXME: add some style based on following?
      updateChatParticipantList();
      this.updateFollow();
    }),

    update: function () {
      if (! this.peer.isSelf) {
        if (this.peer.status == "live") {
          this.dock();
        } else {
          this.undock();
        }
      }
      this.updateDisplay();
      this.updateUrlDisplay();
    },

    updateUrlDisplay: function (force) {
      var url = this.peer.url;
      if ((! url) || (url == this._lastUpdateUrlDisplay && ! force)) {
        return;
      }
      this._lastUpdateUrlDisplay = url;
      var sameUrl = url == session.currentUrl();
      ui.chat.urlChange({
        peer: this.peer,
        url: this.peer.url,
        title: this.peer.title,
        sameUrl: sameUrl
      });
    },

    urlNudge: function () {
      // FIXME: do something more distinct here
      this.updateUrlDisplay(true);
    },

    notifyJoined: function () {
      ui.chat.joinedSession({
        peer: this.peer
      });
    },

    // when there are too many participants in the dock, consolidate the participants to one avatar, and on mouseOver, the dock expands down to reveal the rest of the participants
    // if there are X users in the session
    // then hide the users in the dock
    // and shrink the size of the dock
    // and if you rollover the dock, it expands and reveals the rest of the participants in the dock

    //if users hit X then show the participant button with the consol

    dock: deferForContainer(function () {

      var numberOfUsers = peers.getAllPeers().length;

      // collapse the Dock if too many users
      function CollapsedDock() {
        // decrease/reset dock height
        $("#togetherjs-dock").css("height", 260);
        //replace participant button
        $("#togetherjs-dock-participants").replaceWith("<button id='togetherjs-participantlist-button' class='togetherjs-button'><div class='togetherjs-tooltip togetherjs-dock-person-tooltip'><span class='togetherjs-person-name'>Participants</span><span class='togetherjs-person-tooltip-arrow-r'></span></div><div class='togetherjs-person togetherjs-person-status-overlay' title='Participant List' style='background-image: url(http://localhost:8888/togetherjs/images/robot-avatar.png); border-color: rgb(255, 0, 0);'></div></button>");
        // new full participant window created on toggle
        $("#togetherjs-participantlist-button").click(function () {
          windowing.toggle("#togetherjs-participantlist");
        });
      }

      // FIXME: turned off for now
      if( numberOfUsers >= 5 && false) {
        CollapsedDock();
      } else {
        // reset

      }


      if (this.dockElement) {
        return;
      }
      this.dockElement = templating.sub("dock-person", {
        peer: this.peer
      });
      this.dockElement.attr("id", this.peer.className("togetherjs-dock-element-"));
      ui.container.find("#togetherjs-dock-participants").append(this.dockElement);
      this.dockElement.find(".togetherjs-person").animateDockEntry();
      adjustDockSize(1);
      this.detailElement = templating.sub("participant-window", {
        peer: this.peer
      });
      var followId = this.peer.className("togetherjs-person-status-follow-");
      this.detailElement.find('[for="togetherjs-person-status-follow"]').attr("for", followId);
      this.detailElement.find('#togetherjs-person-status-follow').attr("id", followId);
      this.detailElement.find(".togetherjs-follow").click(function () {
        location.href = $(this).attr("href");
      });
      this.detailElement.find(".togetherjs-nudge").click((function () {
        this.peer.nudge();
      }).bind(this));
      this.followCheckbox = this.detailElement.find("#" + followId);
      this.followCheckbox.change(function () {
        if (! this.checked) {
          this.peer.unfollow();
        }
        // Following doesn't happen until the window is closed
        // FIXME: should we tell the user this?
      });
      this.maybeHideDetailWindow = this.maybeHideDetailWindow.bind(this);
      session.on("hide-window", this.maybeHideDetailWindow);
      ui.container.append(this.detailElement);
      this.dockElement.click((function () {
        if (this.detailElement.is(":visible")) {
          windowing.hide(this.detailElement);
        } else {
          windowing.show(this.detailElement, {bind: this.dockElement});
          this.scrollTo();
          this.cursor().element.animate({
            opacity:0.3
          }).animate({
            opacity:1
          }).animate({
            opacity:0.3
          }).animate({
            opacity:1
          });
        }
      }).bind(this));
      this.updateFollow();
    }),

    undock: function () {
      if (! this.dockElement) {
        return;
      }
      this.dockElement.animateDockExit().promise().then((function () {
        this.dockElement.remove();
        this.dockElement = null;
        this.detailElement.remove();
        this.detailElement = null;
        adjustDockSize(-1);
      }).bind(this));
    },

    scrollTo: function () {
      if (this.peer.url != session.currentUrl()) {
        return;
      }
      var pos = this.peer.scrollPosition;
      if (! pos) {
        console.warn("Peer has no scroll position:", this.peer);
        return;
      }
      pos = elementFinder.pixelForPosition(pos);
      $("html, body").easeTo(pos);
    },

    updateFollow: function () {
      if (! this.peer.url) {
        return;
      }
      if (! this.detailElement) {
        return;
      }
      var same = this.detailElement.find(".togetherjs-same-url");
      var different = this.detailElement.find(".togetherjs-different-url");
      if (this.peer.url == session.currentUrl()) {
        same.show();
        different.hide();
      } else {
        same.hide();
        different.show();
      }
    },

    maybeHideDetailWindow: function (windows) {
      if (this.detailElement && windows[0] && windows[0][0] === this.detailElement[0]) {
        if (this.followCheckbox[0].checked) {
          this.peer.follow();
        } else {
          this.peer.unfollow();
        }
      }
    },

    dockClick: function () {
      // FIXME: scroll to person
    },

    cursor: function () {
      return require("cursor").getClient(this.peer.id);
    },

    destroy: function () {
      // FIXME: should I get rid of the dockElement?
      session.off("hide-window", this.maybeHideDetailWindow);
    }
  });

  function updateChatParticipantList() {
    var live = peers.getAllPeers(true);
    if (live.length) {
      ui.displayToggle("#togetherjs-chat-participants");
      $("#togetherjs-chat-participant-list").text(
        live.map(function (p) {return p.name;}).join(", "));
    } else {
      ui.displayToggle("#togetherjs-chat-no-participants");
    }
  }

  function inviteHubUrl() {
    var base = TogetherJS.config.get("inviteFromRoom");
    assert(base);
    return util.makeUrlAbsolute(base, session.hubUrl());
  }

  var inRefresh = false;

  function refreshInvite() {
    if (inRefresh) {
      return;
    }
    inRefresh = true;
    require(["who"], function (who) {
      var def = who.getList(inviteHubUrl());
      function addUser(user, before) {
        var item = templating.sub("invite-user-item", {peer: user});
        item.attr("data-clientid", user.id);
        if (before) {
          item.insertBefore(before);
        } else {
          $("#togetherjs-invite-users").append(item);
        }
        item.click(function() {
          invite(user.clientId);
        });
      }
      function refresh(users, finished) {
        var sorted = [];
        for (var id in users) {
          if (users.hasOwnProperty(id)) {
            sorted.push(users[id]);
          }
        }
        sorted.sort(function (a, b) {
          return a.name < b.name ? -1 : 1;
        });
        var pos = 0;
        ui.container.find("#togetherjs-invite-users .togetherjs-menu-item").each(function () {
          var $this = $(this);
          if (finished && ! users[$this.attr("data-clientid")]) {
            $this.remove();
            return;
          }
          if (pos >= sorted.length) {
            return;
          }
          while (pos < sorted.length && $this.attr("data-clientid") !== sorted[pos].id) {
            addUser(sorted[pos], $this);
            pos++;
          }
          while (pos < sorted.length && $this.attr("data-clientid") == sorted[pos].id) {
            pos++;
          }
        });
        for (var i=pos; i<sorted.length; i++) {
          addUser(sorted[pos]);
        }
      }
      def.then(function (users) {
        refresh(users, true);
        inRefresh = false;
      });
      def.progress(refresh);
    });
  }

  session.hub.on("invite", function (msg) {
    if (msg.forClientId && msg.clientId != peers.Self.id) {
      return;
    }
    require(["who"], function (who) {
      var peer = who.ExternalPeer(msg.userInfo.clientId, msg.userInfo);
      ui.chat.invite({peer: peer, url: msg.url, forEveryone: ! msg.forClientId});
    });
  });

  function invite(clientId) {
    require(["who"], function (who) {
      // FIXME: use the return value of this to give a signal that
      // the invite has been successfully sent:
      who.invite(inviteHubUrl(), clientId).then(function () {
        hideMenu();
      });
    });
  }

  ui.showUrlChangeMessage = deferForContainer(function (peer, url) {
    var window = templating.sub("url-change", {peer: peer});
    ui.container.append(window);
    windowing.show(window);
  });

  session.hub.on("url-change-nudge", function (msg) {
    if (msg.to && msg.to != session.clientId) {
      // Not directed to us
      return;
    }
    msg.peer.urlNudge();
  });

  session.on("new-element", function (el) {
    if (TogetherJS.config.get("toolName")) {
      ui.updateToolName(el);
    }
  });

  var setToolName = false;
  ui.updateToolName = function (container) {
    container = container || $(document.body);
    var name = TogetherJS.config.get("toolName");
    if (setToolName && ! name) {
      name = "TogetherJS";
    }
    if (name) {
      container.find(".togetherjs-tool-name").text(name);
      setToolName = true;
    }
  };

  TogetherJS.config.track("toolName", function (name) {
    ui.updateToolName(ui.container);
  });

  return ui;

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('playback',["jquery", "util", "session", "storage", "require"], function ($, util, session, storage, require) {
  var playback = util.Module("playback");
  var assert = util.assert;

  var ALWAYS_REPLAY = {
    "cursor-update": true,
    "scroll-update": true
  };

  playback.getLogs = function (url) {
    if (url.search(/^local:/) === 0) {
      return $.Deferred(function (def) {
        storage.get("recording." + url.substr("local:".length)).then(function (logs) {
          if (! logs) {
            def.resolve(null);
            return;
          }
          logs = parseLogs(logs);
          def.resolve(logs);
        }, function (error) {
          def.reject(error);
        });
      });
    }
    return $.Deferred(function (def) {
      $.ajax({
        url: url,
        dataType: "text"
      }).then(
        function (logs) {
          logs = parseLogs(logs);
          def.resolve(logs);
        },
        function (error) {
          def.reject(error);
        });
    });
  };

  function parseLogs(logs) {
    logs = logs.replace(/\r\n/g, '\n');
    logs = logs.split(/\n/g);
    var result = [];
    for (var i=0; i<logs.length; i++) {
      var line = logs[i];
      line = line.replace(/^\s+/, "").replace(/\s+$/, "");
      if (line.search(/\/\*/) === 0) {
        var last = line.search(/\*\//);
        if (last == -1) {
          console.warn("bad line:", line);
          continue;
        }
        line = line.substr(last+2);
      }
      line = line.replace(/^\s+/, "");
      if (! line) {
        continue;
      }
      line = JSON.parse(line);
      result.push(line);
    }
    return Logs(result);
  }

  var Logs = util.Class({
    constructor: function (logs, fromStorage) {
      this.logs = logs;
      this.fromStorage = fromStorage;
      this.pos = 0;
    },

    play: function () {
      this.start = Date.now();
      if (this.pos >= this.logs.length) {
        this.unload();
        return;
      }
      if (this.pos !== 0) {
        // First we need to play the hello
        var toReplay = [];
        var foundHello = false;
        for (var i=this.pos-1; i>=0; i--) {
          var item = this.logs[i];
          if (ALWAYS_REPLAY[item.type]) {
            toReplay.push(item);
          }
          if (item.type == "hello" || item.type == "hello-back") {
            this.playItem(item);
            foundHello = true;
            break;
          }
        }
        if (! foundHello) {
          console.warn("No hello message found before position", this.pos);
        }
        toReplay.reverse();
        for (i=0; i<toReplay.length; i++) {
          this.playItem(toReplay[i]);
        }
      }
      this.playOne();
    },

    cancel: function () {
      if (this.playTimer) {
        clearTimeout(this.playTimer);
        this.playTimer = null;
      }
      this.start = null;
      this.pos = 0;
      this.unload();
    },

    pause: function () {
      if (this.playTimer) {
        clearTimeout(this.playTimer);
        this.playTimer = null;
      }
    },

    playOne: function () {
      this.playTimer = null;
      if (this.pos >= this.logs.length) {
        this.unload();
        return;
      }
      var item = this.logs[this.pos];
      this.playItem(item);
      this.pos++;
      if (this.pos >= this.logs.length) {
        this.unload();
        return;
      }
      var next = this.logs[this.pos];
      var pause = next.date - item.date;
      this.playTimer = setTimeout(this.playOne.bind(this), pause);
      if (this.fromStorage) {
        this.savePos();
      }
    },

    playItem: function (item) {
      if (item.type == "hello") {
        // We may need to pause here
        if (item.url != (location.href+"").replace(/\#.*/, "")) {
          this.pause();
        }
      }
      try {
        session._getChannel().onmessage(item);
      } catch (e) {
        console.warn("Could not play back message:", item, "error:", e);
      }
    },

    save: function () {
      this.fromStorage = true;
      storage.set("playback.logs", this.logs);
      this.savePos();
    },

    savePos: function () {
      storage.set("playback.pos", this.pos);
    },

    unload: function () {
      if (this.fromStorage) {
        storage.set("playback.logs", undefined);
        storage.set("playback.pos", undefined);
      }
      // FIXME: should do a bye message here
    }

  });

  playback.getRunningLogs = function () {
    return storage.get("playback.logs").then(function (value) {
      if (! value) {
        return null;
      }
      var logs = Logs(value, true);
      return storage.get("playback.pos").then(function (pos) {
        pos = pos || 0;
        logs.pos = pos;
        return logs;
      });
    });
  };

  return playback;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
/*jshint evil:true */
define('chat',["require", "jquery", "util", "session", "ui", "templates", "playback", "storage", "peers", "windowing"], function (require, $, util, session, ui, templates, playback, storage, peers, windowing) {
  var chat = util.Module("chat");
  var assert = util.assert;
  var Walkabout;

  session.hub.on("chat", function (msg) {
    ui.chat.text({
      text: msg.text,
      peer: msg.peer,
      // FIXME: a little unsure of trusting this (maybe I should prefix it?)
      messageId: msg.messageId,
      notify: true
    });
    saveChatMessage({
      text: msg.text,
      date: Date.now(),
      peerId: msg.peer.id,
      messageId: msg.messageId
    });
  });

  // FIXME: this doesn't really belong in this module:
  session.hub.on("bye", function (msg) {
    ui.chat.leftSession({
      peer: msg.peer,
      declinedJoin: msg.reason == "declined-join"
    });
  });

  chat.submit = function (message) {
    var parts = message.split(/ /);
    if (parts[0].charAt(0) == "/") {
      var name = parts[0].substr(1).toLowerCase();
      var method = commands["command_" + name];
      if (method) {
        method.apply(null, parts.slice(1));
        return;
      }
    }
    var messageId = session.clientId + "-" + Date.now();
    session.send({
      type: "chat",
      text: message,
      messageId: messageId
    });
    ui.chat.text({
      text: message,
      peer: peers.Self,
      messageId: messageId,
      notify: false
    });
    saveChatMessage({
      text: message,
      date: Date.now(),
      peerId: peers.Self.id,
      messageId: messageId
    });
  };

  var commands = {
    command_help: function () {
      var msg = util.trim(templates.help);
      ui.chat.system({
        text: msg
      });
    },

    command_test: function (args) {
      if (! Walkabout) {
        require(["walkabout"], (function (WalkaboutModule) {
          Walkabout = WalkaboutModule;
          this.command_test(args);
        }).bind(this));
        return;
      }
      args = util.trim(args || "").split(/\s+/g);
      if (args[0] === "" || ! args.length) {
        if (this._testCancel) {
          args = ["cancel"];
        } else {
          args = ["start"];
        }
      }
      if (args[0] == "cancel") {
        ui.chat.system({
          text: "Aborting test"
        });
        this._testCancel();
        this._testCancel = null;
        return;
      }
      if (args[0] == "start") {
        var times = parseInt(args[1], 10);
        if (isNaN(times) || ! times) {
          times = 100;
        }
        ui.chat.system({
          text: "Testing with walkabout.js"
        });
        var tmpl = $(templates.walkabout);
        var container = ui.container.find(".togetherjs-test-container");
        container.empty();
        container.append(tmpl);
        container.show();
        var statusContainer = container.find(".togetherjs-status");
        statusContainer.text("starting...");
        this._testCancel = Walkabout.runManyActions({
          ondone: function () {
            statusContainer.text("done");
            statusContainer.one("click", function () {
              container.hide();
            });
            this._testCancel = null;
          },
          onstatus: function (status) {
            var note = "actions: " + status.actions.length + " running: " +
              (status.times - status.remaining) + " / " + status.times;
            statusContainer.text(note);
          }
        });
        return;
      }
      if (args[0] == "show") {
        if (this._testShow.length) {
          this._testShow.forEach(function (item) {
            if (item) {
              item.remove();
            }
          }, this);
          this._testShow = [];
        } else {
          var actions = Walkabout.findActions();
          actions.forEach(function (action) {
            this._testShow.push(action.show());
          }, this);
        }
        return;
      }
      if (args[0] == "describe") {
        Walkabout.findActions().forEach(function (action) {
          ui.chat.system({
            text: action.description()
          });
        }, this);
        return;
      }
      ui.chat.system({
        text: "Did not understand: " + args.join(" ")
      });
    },

    _testCancel: null,
    _testShow: [],

    command_clear: function () {
      ui.chat.clear();
    },

    command_exec: function () {
      var expr = Array.prototype.slice.call(arguments).join(" ");
      var result;
      // We use this to force global eval (not in this scope):
      var e = eval;
      try {
        result = e(expr);
      } catch (error) {
        ui.chat.system({
          text: "Error: " + error
        });
      }
      if (result !== undefined) {
        ui.chat.system({
          text: "" + result
        });
      }
    },

    command_record: function () {
      ui.chat.system({
        text: "When you see the robot appear, the recording will have started"
      });
      window.open(
        session.recordUrl(), "_blank",
        "left,width=" + ($(window).width() / 2));
    },

    playing: null,

    command_playback: function (url) {
      if (this.playing) {
        this.playing.cancel();
        this.playing.unload();
        this.playing = null;
        ui.chat.system({
          text: "playback cancelled"
        });
        return;
      }
      if (! url) {
        ui.chat.system({
          text: "Nothing is playing"
        });
        return;
      }
      var logLoader = playback.getLogs(url);
      logLoader.then(
        (function (logs) {
          if (! logs) {
            ui.chat.system({
              text: "No logs found."
            });
            return;
          }
          logs.save();
          this.playing = logs;
          logs.play();
        }).bind(this),
        function (error) {
          ui.chat.system({
            text: "Error fetching " + url + ":\n" + JSON.stringify(error, null, "  ")
          });
        });
      windowing.hide("#togetherjs-chat");
    },

    command_savelogs: function (name) {
      session.send({
        type: "get-logs",
        forClient: session.clientId,
        saveAs: name
      });
      function save(msg) {
        if (msg.request.forClient == session.clientId && msg.request.saveAs == name) {
          storage.set("recording." + name, msg.logs).then(function () {
            session.hub.off("logs", save);
            ui.chat.system({
              text: "Saved as local:" + name
            });
          });
        }
      }
      session.hub.on("logs", save);
    },

    command_baseurl: function (url) {
      if (! url) {
        storage.get("baseUrlOverride").then(function (b) {
          if (b) {
            ui.chat.system({
              text: "Set to: " + b.baseUrl
            });
          } else {
            ui.chat.system({
              text: "No baseUrl override set"
            });
          }
        });
        return;
      }
      url = url.replace(/\/*$/, "");
      ui.chat.system({
        text: "If this goes wrong, do this in the console to reset:\n  localStorage.setItem('togetherjs.baseUrlOverride', null)"
      });
      storage.set("baseUrlOverride", {
        baseUrl: url,
        expiresAt: Date.now() + (1000 * 60 * 60 * 24)
      }).then(function () {
        ui.chat.system({
          text: "baseUrl overridden (to " + url + "), will last for one day."
        });
      });
    },

    command_config: function (variable, value) {
      if (! (variable || value)) {
        storage.get("configOverride").then(function (c) {
          if (c) {
            util.forEachAttr(c, function (value, attr) {
              if (attr == "expiresAt") {
                return;
              }
              ui.chat.system({
                text: "  " + attr + " = " + JSON.stringify(value)
              });
            });
            ui.chat.system({
              text: "Config expires at " + (new Date(c.expiresAt))
            });
          } else {
            ui.chat.system({
              text: "No config override"
            });
          }
        });
        return;
      }
      if (variable == "clear") {
        storage.set("configOverride", undefined);
        ui.chat.system({
          text: "Clearing all overridden configuration"
        });
        return;
      }
      console.log("config", [variable, value]);
      if (! (variable && value)) {
        ui.chat.system({
          text: "Error: must provide /config VAR VALUE"
        });
        return;
      }
      try {
        value = JSON.parse(value);
      } catch (e) {
        ui.chat.system({
          text: "Error: value (" + value + ") could not be parsed: " + e
        });
        return;
      }
      if (! TogetherJS._defaultConfiguration.hasOwnProperty(variable)) {
        ui.chat.system({
          text: "Warning: variable " + variable + " is unknown"
        });
      }
      storage.get("configOverride").then(function (c) {
        c = c || {};
        c[variable] = value;
        c.expiresAt = Date.now() + (1000 * 60 * 60 * 24);
        storage.set("configOverride", c).then(function () {
          ui.chat.system({
            text: "Variable " + variable + " = " + JSON.stringify(value) + "\nValue will be set for one day."
          });
        });
      });
    }

  };

  // this section deal with saving/restoring chat history as long as session is alive
  var chatStorageKey = "chatlog";
  var maxLogMessages = 100;

  function saveChatMessage(obj) {
    assert(obj.peerId);
    assert(obj.messageId);
    assert(obj.date);
    assert(typeof obj.text == "string");

    loadChatLog().then(function (log) {
      for (var i = log.length - 1; i >= 0; i--) {
        if (log[i].messageId === obj.messageId) {
          return;
        }
      }
      log.push(obj);
      if (log.length > maxLogMessages) {
        log.splice(0, log.length - maxLogMessages);
      }
      storage.tab.set(chatStorageKey, log);
    });
  }

  function loadChatLog() {
    return storage.tab.get(chatStorageKey, []);
  }

  session.once("ui-ready", function () {
    loadChatLog().then(function (log) {
      if (! log) {
        return;
      }
      for (var i = 0; i < log.length; i++) {
        // peers should already be loaded from sessionStorage by the peers module
        // maybe i should use a try catch block here
        var currentPeer = peers.getPeer(log[i].peerId);
        ui.chat.text({
          text: log[i].text,
          date: log[i].date,
          peer: currentPeer,
          messageId: log[i].messageId
        });
      }
    });
  });
  //delete chat log
  session.on("close", function(){
    storage.tab.set(chatStorageKey, undefined);
  });

  return chat;

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define('console',["util"], function (util) {

  var console = window.console || {log: function () {}};

  var Console = util.Class({
    constructor: function () {
      this.messages = [];
      this.level = this.levels.log;
    },

    messageLimit: 100,

    levels: {
      debug: 1,
      // FIXME: I'm considering *not* wrapping console.log, and strictly keeping
      // it as a debugging tool; also line numbers would be preserved
      log: 2,
      info: 3,
      notify: 4,
      warn: 5,
      error: 6,
      fatal: 7
    },

    // Gets set below:
    maxLevel: 0,

    consoleLevels: [
      [],
      console.debug || [],
      console.log || [],
      console.info || [],
      console.notify || [],
      console.warn || [],
      console.error || [],
      console.fatal || []
    ],

    levelNames: {},

    setLevel: function (l) {
      var number;
      if (typeof l == "string") {
        number = this.levels[l];
        if (number === undefined) {
          throw new Error("Tried to set Console level to unknown level string: " + l);
        }
        l = number;
      }
      if (typeof l == "function") {
        number = this.consoleLevels.indexOf(l);
        if (number == -1) {
          throw new Error("Tried to set Console level based on unknown console function: " + l);
        }
        l = number;
      }
      if (typeof l == "number") {
        if (l < 0) {
          throw new Error("Console level must be 0 or larger: " + l);
        } else if (l > this.maxLevel) {
          throw new Error("Console level must be " + this.maxLevel + " or smaller: " + l);
        }
      }
      this.level = l;
    },

    write: function (level) {
      try {
        this.messages.push([
          Date.now(),
          level,
          this._stringify(Array.prototype.slice.call(arguments, 1))
        ]);
      } catch (e) {
        console.warn("Error stringifying argument:", e);
      }
      if (level != "suppress" && this.level <= level) {
        var method = console[this.levelNames[level]];
        if (! method) {
          method = console.log;
        }
        method.apply(console, Array.prototype.slice.call(arguments, 1));
      }
    },

    suppressedWrite: function () {
      this.write.apply(this, ["suppress"].concat(Array.prototype.slice.call(arguments)));
    },

    trace: function (level) {
      level = level || 'log';
      if (console.trace) {
        level = "suppressedWrite";
      }
      try {
        throw new Error();
      } catch (e) {
        // FIXME: trim this frame
        var stack = e.stack;
        stack = stack.replace(/^[^\n]*\n/, "");
        this[level](stack);
      }
      if (console.trace) {
        console.trace();
      }
    },

    _browserInfo: function () {
      // FIXME: add TogetherJS version and
      return [
        "TogetherJS base URL: " + TogetherJS.baseUrl,
        "User Agent: " + navigator.userAgent,
        "Page loaded: " + this._formatDate(TogetherJS.pageLoaded),
        "Age: " + this._formatMinutes(Date.now() - TogetherJS.pageLoaded) + " minutes",
        // FIXME: make this right:
        //"Window: height: " + window.screen.height + " width: " + window.screen.width
        "URL: " + location.href,
        "------+------+----------------------------------------------"
      ];
    },

    _stringify: function (args) {
      var s = "";
      for (var i=0; i<args.length; i++) {
        if (s) {
          s += " ";
        }
        s += this._stringifyItem(args[i]);
      }
      return s;
    },

    _stringifyItem: function (item) {
      if (typeof item == "string") {
        if (item === "") {
          return '""';
        }
        return item;
      }
      if (typeof item == "object" && item.repr) {
        try {
          return item.repr();
        } catch (e) {
          console.warn("Error getting object repr:", item, e);
        }
      }
      if (item !== null && typeof item == "object") {
        // FIXME: this can drop lots of kinds of values, like a function or undefined
        item = JSON.stringify(item);
      }
      return item.toString();
    },

    _formatDate: function (timestamp) {
      return (new Date(timestamp)).toISOString();
    },

    _formatTime: function (timestamp) {
      return ((timestamp - TogetherJS.pageLoaded) / 1000).toFixed(2);
    },

    _formatMinutes: function (milliseconds) {
      var m = Math.floor(milliseconds / 1000 / 60);
      var remaining = milliseconds - (m * 1000 * 60);
      if (m > 10) {
        // Over 10 minutes, just ignore the seconds
        return m;
      }
      var seconds = Math.floor(remaining / 1000) + "";
      m += ":";
      seconds = lpad(seconds, 2, "0");
      m += seconds;
      if (m == "0:00") {
        m += ((remaining / 1000).toFixed(3) + "").substr(1);
      }
      return m;
    },

    _formatLevel: function (l) {
      if (l === "suppress") {
        return "";
      }
      return this.levelNames[l];
    },

    toString: function () {
      try {
        var lines = this._browserInfo();
        this.messages.forEach(function (m) {
          lines.push(lpad(this._formatTime(m[0]), 6) + " " + rpad(this._formatLevel(m[1]), 6) + " " + lpadLines(m[2], 14));
        }, this);
        return lines.join("\n");
      } catch (e) {
        // toString errors can otherwise be swallowed:
        console.warn("Error running console.toString():", e);
        throw e;
      }
    },

    submit: function (options) {
      // FIXME: friendpaste is broken for this
      // (and other pastebin sites aren't really Browser-accessible)
      return util.Deferred(function (def) {
        options = options || {};
        var site = options.site || TogetherJS.config.get("pasteSite") || "https://www.friendpaste.com/";
        var req = new XMLHttpRequest();
        req.open("POST", site);
        req.setRequestHeader("Content-Type", "application/json");
        req.send(JSON.stringify({
          "title": options.title || "TogetherJS log file",
          "snippet": this.toString(),
          "language": "text"
        }));
        req.onreadystatechange = function () {
          if (req.readyState === 4) {
            var data = JSON.parse(req.responseText);
          }
        };
      });
    }

  });

  function rpad(s, len, pad) {
    s = s + "";
    pad = pad || " ";
    while (s.length < len) {
      s += pad;
    }
    return s;
  }

  function lpad(s, len, pad) {
    s = s + "";
    pad = pad || " ";
    while (s.length < len) {
      s = pad + s;
    }
    return s;
  }

  function lpadLines(s, len, pad) {
    var i;
    s = s + "";
    if (s.indexOf("\n") == -1) {
      return s;
    }
    pad = pad || " ";
    var fullPad = "";
    for (i=0; i<len; i++) {
      fullPad += pad;
    }
    s = s.split(/\n/g);
    for (i=1; i<s.length; i++) {
      s[i] = fullPad + s[i];
    }
    return s.join("\n");
  }



  // This is a factory that creates `Console.prototype.debug`, `.error` etc:
  function logFunction(name, level) {
    return function () {
      this.write.apply(this, [level].concat(Array.prototype.slice.call(arguments)));
    };
  }

  util.forEachAttr(Console.prototype.levels, function (value, name) {
    Console.prototype[name] = logFunction(name, value);
    Console.prototype.maxLevel = Math.max(Console.prototype.maxLevel, value);
  });

  util.forEachAttr(Console.prototype.levels, function (value, name) {
    Console.prototype.levelNames[value] = name;
  });

  var appConsole = Console();

  appConsole.ConsoleClass = Console;

  return appConsole;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('eventMaker',["jquery", "util"], function ($, util) {
  var eventMaker = util.Module("eventMaker");

  eventMaker.performClick = function (target) {
    // FIXME: should accept other parameters, like Ctrl/Alt/etc
    var event = document.createEvent("MouseEvents");
    event.initMouseEvent(
      "click", // type
      true, // canBubble
      true, // cancelable
      window, // view
      0, // detail
      0, // screenX
      0, // screenY
      0, // clientX
      0, // clientY
      false, // ctrlKey
      false, // altKey
      false, // shiftKey
      false, // metaKey
      0, // button
      null // relatedTarget
    );
    // FIXME: I'm not sure this custom attribute always propagates?
    // seems okay in Firefox/Chrome, but I've had problems with
    // setting attributes on keyboard events in the past.
    event.togetherjsInternal = true;
    target = $(target)[0];
    var cancelled = target.dispatchEvent(event);
    if (cancelled) {
      return;
    }
    if (target.tagName == "A") {
      var href = target.href;
      if (href) {
        location.href = href;
        return;
      }
    }
    // FIXME: should do button clicks (like a form submit)
    // FIXME: should run .onclick() as well
  };

  eventMaker.fireChange = function (target) {
    target = $(target)[0];
    var event = document.createEvent("HTMLEvents");
    event.initEvent("change", true, true);
    target.dispatchEvent(event);
  };

  return eventMaker;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Cursor viewing support

define('cursor',["jquery", "ui", "util", "session", "elementFinder", "tinycolor", "eventMaker", "peers", "templating"], function ($, ui, util, session, elementFinder, tinycolor, eventMaker, peers, templating) {
  var assert = util.assert;
  var cursor = util.Module("cursor");

  var FOREGROUND_COLORS = ["#111", "#eee"];
  var CURSOR_HEIGHT = 50;
  var CURSOR_ANGLE = (35 / 180) * Math.PI;
  var CURSOR_WIDTH = Math.ceil(Math.sin(CURSOR_ANGLE) * CURSOR_HEIGHT);
  // Number of milliseconds after page load in which a scroll-update
  // related hello-back message will be processed:
  var SCROLL_UPDATE_CUTOFF = 2000;

  session.hub.on("cursor-update", function (msg) {
    if (msg.sameUrl) {
      Cursor.getClient(msg.clientId).updatePosition(msg);
    } else {
      // FIXME: This should be caught even before the cursor-update message,
      // when the peer goes to another URL
      Cursor.getClient(msg.clientId).hideOtherUrl();
    }
  });

  // FIXME: should check for a peer leaving and remove the cursor object
  var Cursor = util.Class({

    constructor: function (clientId) {
      this.clientId = clientId;
      this.element = templating.clone("cursor");
      this.elementClass = "togetherjs-scrolled-normal";
      this.element.addClass(this.elementClass);
      this.updatePeer(peers.getPeer(clientId));
      this.lastTop = this.lastLeft = null;
      $(document.body).append(this.element);
      this.element.animateCursorEntry();
      this.keydownTimeout = null;
      this.clearKeydown = this.clearKeydown.bind(this);
      this.atOtherUrl = false;
    },

    // How long after receiving a setKeydown call that we should show the
    // user typing.  This should be more than MIN_KEYDOWN_TIME:
    KEYDOWN_WAIT_TIME: 2000,

    updatePeer: function (peer) {
      // FIXME: can I use peer.setElement()?
      this.element.css({color: peer.color});
      var img = this.element.find("img.togetherjs-cursor-img");
      img.attr("src", makeCursor(peer.color));
      var name = this.element.find(".togetherjs-cursor-name");
      var nameContainer = this.element.find(".togetherjs-cursor-container");
      assert(name.length);
      name.text(peer.name);
      nameContainer.css({
        backgroundColor: peer.color,
        color: tinycolor.mostReadable(peer.color, FOREGROUND_COLORS)
      });
      var path = this.element.find("svg path");
      path.attr("fill", peer.color);
      // FIXME: should I just remove the element?
      if (peer.status != "live") {
        //this.element.hide();
        this.element.find("svg").animate({
          opacity: 0
        }, 350);
        this.element.find(".togetherjs-cursor-container").animate({
                width: 34,
                height: 20,
                padding: 12,
                margin: 0
            }, 200).animate({
                width: 0,
                height: 0,
                padding: 0,
                opacity: 0
                }, 200);
      } else {
        //this.element.show();
        this.element.animate({
          opacity:0.3
        }).animate({
          opacity:1
        });
      }
    },

    setClass: function (name) {
      if (name != this.elementClass) {
        this.element.removeClass(this.elementClass).addClass(name);
        this.elementClass = name;
      }
    },

    updatePosition: function (pos) {
      var top, left;
      if (this.atOtherUrl) {
        this.element.show();
        this.atOtherUrl = false;
      }
      if (pos.element) {
        var target = $(elementFinder.findElement(pos.element));
        var offset = target.offset();
        top = offset.top + pos.offsetY;
        left = offset.left + pos.offsetX;
      } else {
        // No anchor, just an absolute position
        top = pos.top;
        left = pos.left;
      }
      // These are saved for use by .refresh():
      this.lastTop = top;
      this.lastLeft = left;
      this.setPosition(top, left);
    },

    hideOtherUrl: function () {
      if (this.atOtherUrl) {
        return;
      }
      this.atOtherUrl = true;
      // FIXME: should show away status better:
      this.element.hide();
    },

    // place Cursor rotate function down here FIXME: this doesnt do anything anymore.  This is in the CSS as an animation
    rotateCursorDown: function(){
      var e = $(this.element).find('svg');
        e.animate({borderSpacing: -150, opacity: 1}, {
        step: function(now, fx) {
          if (fx.prop == "borderSpacing") {
            e.css('-webkit-transform', 'rotate('+now+'deg)')
              .css('-moz-transform', 'rotate('+now+'deg)')
              .css('-ms-transform', 'rotate('+now+'deg)')
              .css('-o-transform', 'rotate('+now+'deg)')
              .css('transform', 'rotate('+now+'deg)');
          } else {
            e.css(fx.prop, now);
          }
        },
        duration: 500
      }, 'linear').promise().then(function () {
        e.css('-webkit-transform', '')
          .css('-moz-transform', '')
          .css('-ms-transform', '')
          .css('-o-transform', '')
          .css('transform', '')
          .css("opacity", "");
      });
    },

    setPosition: function (top, left) {
      var wTop = $(window).scrollTop();
      var height = $(window).height();

      if (top < wTop) {
        // FIXME: this is a totally arbitrary number, but is meant to be big enough
        // to keep the cursor name from being off the top of the screen.
        top = 25;
        this.setClass("togetherjs-scrolled-above");
      } else if (top > wTop + height - CURSOR_HEIGHT) {
        top = height - CURSOR_HEIGHT - 5;
        this.setClass("togetherjs-scrolled-below");
      } else {
        this.setClass("togetherjs-scrolled-normal");
      }
      this.element.css({
        top: top,
        left: left
      });
    },

    refresh: function () {
      if (this.lastTop !== null) {
        this.setPosition(this.lastTop, this.lastLeft);
      }
    },

    setKeydown: function () {
      if (this.keydownTimeout) {
        clearTimeout(this.keydownTimeout);
      } else {
        this.element.find(".togetherjs-cursor-typing").show().animateKeyboard();
      }
      this.keydownTimeout = setTimeout(this.clearKeydown, this.KEYDOWN_WAIT_TIME);
    },

    clearKeydown: function () {
      this.keydownTimeout = null;
      this.element.find(".togetherjs-cursor-typing").hide().stopKeyboardAnimation();
    },

    _destroy: function () {
      this.element.remove();
      this.element = null;
    }
  });

  Cursor._cursors = {};

  cursor.getClient = Cursor.getClient = function (clientId) {
    var c = Cursor._cursors[clientId];
    if (! c) {
      c = Cursor._cursors[clientId] = Cursor(clientId);
    }
    return c;
  };

  Cursor.forEach = function (callback, context) {
    context = context || null;
    for (var a in Cursor._cursors) {
      if (Cursor._cursors.hasOwnProperty(a)) {
        callback.call(context, Cursor._cursors[a], a);
      }
    }
  };

  Cursor.destroy = function (clientId) {
    Cursor._cursors[clientId]._destroy();
    delete Cursor._cursors[clientId];
  };

  peers.on("new-peer identity-updated status-updated", function (peer) {
    var c = Cursor.getClient(peer.id);
    c.updatePeer(peer);
  });

  var lastTime = 0;
  var MIN_TIME = 100;
  var lastPosX = -1;
  var lastPosY = -1;
  var lastMessage = null;
  function mousemove(event) {
    var now = Date.now();
    if (now - lastTime < MIN_TIME) {
      return;
    }
    lastTime = now;
    var pageX = event.pageX;
    var pageY = event.pageY;
    if (Math.abs(lastPosX - pageX) < 3 && Math.abs(lastPosY - pageY) < 3) {
      // Not a substantial enough change
      return;
    }
    lastPosX = pageX;
    lastPosY = pageY;
    var target = event.target;
    var parent = $(target).closest(".togetherjs-window, .togetherjs-popup, #togetherjs-dock");
    if (parent.length) {
      target = parent[0];
    } else if (elementFinder.ignoreElement(target)) {
      target = null;
    }
    if ((! target) || target == document.documentElement || target == document.body) {
      lastMessage = {
        type: "cursor-update",
        top: pageY,
        left: pageX
      };
      session.send(lastMessage);
      return;
    }
    target = $(target);
    var offset = target.offset();
    if (! offset) {
      // FIXME: this really is walkabout.js's problem to fire events on the
      // document instead of a specific element
      console.warn("Could not get offset of element:", target[0]);
      return;
    }
    var offsetX = pageX - offset.left;
    var offsetY = pageY - offset.top;
    lastMessage = {
      type: "cursor-update",
      element: elementFinder.elementLocation(target),
      offsetX: Math.floor(offsetX),
      offsetY: Math.floor(offsetY)
    };
    session.send(lastMessage);
  }

  function makeCursor(color) {
    var canvas = $("<canvas></canvas>");
    canvas.attr("height", CURSOR_HEIGHT);
    canvas.attr("width", CURSOR_WIDTH);
    var context = canvas[0].getContext('2d');
    context.fillStyle = color;
    context.moveTo(0, 0);
    context.beginPath();
    context.lineTo(0, CURSOR_HEIGHT/1.2);
    context.lineTo(Math.sin(CURSOR_ANGLE/2) * CURSOR_HEIGHT / 1.5,
                   Math.cos(CURSOR_ANGLE/2) * CURSOR_HEIGHT / 1.5);
    context.lineTo(Math.sin(CURSOR_ANGLE) * CURSOR_HEIGHT / 1.2,
                   Math.cos(CURSOR_ANGLE) * CURSOR_HEIGHT / 1.2);
    context.lineTo(0, 0);
    context.shadowColor = 'rgba(0,0,0,0.3)';
    context.shadowBlur = 2;
    context.shadowOffsetX = 1;
    context.shadowOffsetY = 2;
	context.strokeStyle = "#ffffff";
	context.stroke();
    context.fill();
    return canvas[0].toDataURL("image/png");
  }

  var scrollTimeout = null;
  var scrollTimeoutSet = 0;
  var SCROLL_DELAY_TIMEOUT = 75;
  var SCROLL_DELAY_LIMIT = 300;

  function scroll() {
    var now = Date.now();
    if (scrollTimeout) {
      if (now - scrollTimeoutSet < SCROLL_DELAY_LIMIT) {
        clearTimeout(scrollTimeout);
      } else {
        // Just let it progress anyway
        return;
      }
    }
    scrollTimeout = setTimeout(_scrollRefresh, SCROLL_DELAY_TIMEOUT);
    if (! scrollTimeoutSet) {
      scrollTimeoutSet = now;
    }
  }

  var lastScrollMessage = null;
  function _scrollRefresh() {
    scrollTimeout = null;
    scrollTimeoutSet = 0;
    Cursor.forEach(function (c) {
      c.refresh();
    });
    lastScrollMessage = {
      type: "scroll-update",
      position: elementFinder.elementByPixel($(window).scrollTop())
    };
    session.send(lastScrollMessage);
  }

  // FIXME: do the same thing for cursor position?  And give up on the
  // ad hoc update-on-hello?
  session.on("prepare-hello", function (helloMessage) {
    if (lastScrollMessage) {
      helloMessage.scrollPosition = lastScrollMessage.position;
    }
  });

  session.hub.on("scroll-update", function (msg) {
    msg.peer.scrollPosition = msg.position;
    if (msg.peer.following) {
      msg.peer.view.scrollTo();
    }
  });

  // In case there are multiple peers, we track that we've accepted one of their
  // hello-based scroll updates, just so we don't bounce around (we don't intelligently
  // choose which one to use, just the first that comes in)
  var acceptedScrollUpdate = false;
  session.hub.on("hello-back hello", function (msg) {
    if (msg.type == "hello") {
      // Once a hello comes in, a bunch of hello-backs not intended for us will also
      // come in, and we should ignore them
      acceptedScrollUpdate = true;
    }
    if (! msg.scrollPosition) {
      return;
    }
    msg.peer.scrollPosition = msg.scrollPosition;
    if ((! acceptedScrollUpdate) &&
        msg.sameUrl &&
        Date.now() - session.timeHelloSent < SCROLL_UPDATE_CUTOFF) {
      acceptedScrollUpdate = true;
      msg.peer.view.scrollTo();
    }
  });

  session.on("ui-ready", function () {
    $(document).mousemove(mousemove);
    document.addEventListener("click", documentClick, true);
    document.addEventListener("keydown", documentKeydown, true);
    $(window).scroll(scroll);
    scroll();
  });

  session.on("close", function () {
    Cursor.forEach(function (c, clientId) {
      Cursor.destroy(clientId);
    });
    $(document).unbind("mousemove", mousemove);
    document.removeEventListener("click", documentClick, true);
    document.removeEventListener("keydown", documentKeydown, true);
    $(window).unbind("scroll", scroll);
  });

  session.hub.on("hello", function (msg) {
    // Immediately get our cursor onto this new person's screen:
    if (lastMessage) {
      session.send(lastMessage);
    }
    if (lastScrollMessage) {
      session.send(lastScrollMessage);
    }
  });

  function documentClick(event) {
    if (event.togetherjsInternal) {
      // This is an artificial internal event
      return;
    }
    // FIXME: this might just be my imagination, but somehow I just
    // really don't want to do anything at this stage of the event
    // handling (since I'm catching every click), and I'll just do
    // something real soon:
    setTimeout(function () {
      if (! TogetherJS.running) {
        // This can end up running right after TogetherJS has been closed, often
        // because TogetherJS was closed with a click...
        return;
      }
      var element = event.target;
      if (element == document.documentElement) {
        // For some reason clicking on <body> gives the <html> element here
        element = document.body;
      }
      if (elementFinder.ignoreElement(element)) {
        return;
      }
      //Prevent click events on video objects to avoid conflicts with
      //togetherjs's own video events
      if (element.nodeName.toLowerCase() === 'video'){
        return;
      }

      var dontShowClicks = TogetherJS.config.get("dontShowClicks");
      var cloneClicks = TogetherJS.config.get("cloneClicks");
      // If you dont want to clone the click for this element
      // and you dont want to show the click for this element or you dont want to show any clicks
      // then return to avoid sending a useless click
      if ((! util.matchElement(element, cloneClicks)) && util.matchElement(element, dontShowClicks)) {
        return;
      }
      var location = elementFinder.elementLocation(element);
      var offset = $(element).offset();
      var offsetX = event.pageX - offset.left;
      var offsetY = event.pageY - offset.top;
      session.send({
        type: "cursor-click",
        element: location,
        offsetX: offsetX,
        offsetY: offsetY
      });
      if (util.matchElement(element, dontShowClicks)) {
        return;
      }
      displayClick({top: event.pageY, left: event.pageX}, peers.Self.color);
    });
  }

  var CLICK_TRANSITION_TIME = 3000;

  session.hub.on("cursor-click", function (pos) {
    // When the click is calculated isn't always the same as how the
    // last cursor update was calculated, so we force the cursor to
    // the last location during a click:
    if (! pos.sameUrl) {
      // FIXME: if we *could have* done a local click, but we follow along
      // later, we'll be in different states if that click was important.
      // Mostly click cloning just won't work.
      return;
    }
    Cursor.getClient(pos.clientId).updatePosition(pos);
    var target = $(elementFinder.findElement(pos.element));
    var offset = target.offset();
    var top = offset.top + pos.offsetY;
    var left = offset.left + pos.offsetX;
    var cloneClicks = TogetherJS.config.get("cloneClicks");
    if (util.matchElement(target, cloneClicks)) {
      eventMaker.performClick(target);
    }
    var dontShowClicks = TogetherJS.config.get("dontShowClicks");
    if (util.matchElement(target, dontShowClicks)) {
      return;
    }
    displayClick({top: top, left: left}, pos.peer.color);
  });

  function displayClick(pos, color) {
    // FIXME: should we hide the local click if no one else is going to see it?
    // That means tracking who might be able to see our screen.
    var element = templating.clone("click");
    $(document.body).append(element);
    element.css({
      top: pos.top,
      left: pos.left,
      borderColor: color
    });
    setTimeout(function () {
      element.addClass("togetherjs-clicking");
    }, 100);
    setTimeout(function () {
      element.remove();
    }, CLICK_TRANSITION_TIME);
  }

  var lastKeydown = 0;
  var MIN_KEYDOWN_TIME = 500;

  function documentKeydown(event) {
    setTimeout(function () {
      var now = Date.now();
      if (now - lastKeydown < MIN_KEYDOWN_TIME) {
        return;
      }
      lastKeydown = now;
      // FIXME: is event.target interesting here?  That is, *what* the
      // user is typing into, not just that the user is typing?  Also
      // I'm assuming we don't care if the user it typing into a
      // togetherjs-related field, since chat activity is as interesting
      // as any other activity.
      session.send({type: "keydown"});
    });
  }

  session.hub.on("keydown", function (msg) {
    // FIXME: when the cursor is hidden there's nothing to show with setKeydown().
    var cursor = Cursor.getClient(msg.clientId);
    cursor.setKeydown();
  });

  util.testExpose({Cursor: Cursor});

  return cursor;

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('ot',["util"], function (util) {

  var ot = util.Module("ot");
  var assert = util.assert;

  var StringSet = util.Class({
    /* Set that only supports string items */
    constructor: function () {
      this._items = {};
      this._count = 0;
    },
    contains: function (k) {
      assert(typeof k == "string");
      return this._items.hasOwnProperty(k);
    },
    add: function (k) {
      assert(typeof k == "string");
      if (this.contains(k)) {
        return;
      }
      this._items[k] = null;
      this._count++;
    },
    remove: function (k) {
      assert(typeof k == "string");
      if (! this.contains(k)) {
        return;
      }
      delete this._items[k];
      this._count++;
    },
    isEmpty: function () {
      return ! this._count;
    }
  });

  var Queue = util.Class({

    constructor: function (size) {
      this._q = [];
      this._size = size;
      this._deleted = 0;
    },

    _trim: function () {
      if (this._size) {
        if (this._q.length > this._size) {
          this._q.splice(0, this._q.length - this._size);
          this._deleted += this._q.length - this._size;
        }
      }
    },

    push: function (item) {
      this._q.push(item);
      this._trim();
    },

    last: function () {
      return this._q[this._q.length-1];
    },

    walkBack: function (callback, context) {
      var result = true;
      for (var i=this._q.length-1; i >= 0; i--) {
        var item = this._q[i];
        result = callback.call(context, item, i + this._deleted);
        if (result === false) {
          return result;
        } else if (! result) {
          result = true;
        }
      }
      return result;
    },

    walkForward: function (index, callback, context) {
      var result = true;
      for (var i=index; i<this._q.length; i++) {
        var item = this._q[i-this._deleted];
        result = callback.call(context, item, i);
        if (result === false) {
          return result;
        } else if (! result) {
          result = true;
        }
      }
      return result;
    },

    insert: function (index, item) {
      this._q.splice(index-this._deleted, 0, item);
    }

  });

  var Change = util.Class({

    constructor: function (version, clientId, delta, known, outOfOrder) {
      this.version = version;
      this.clientId = clientId;
      this.delta = delta;
      this.known = known;
      this.outOfOrder = !! outOfOrder;
      assert(typeof version == "number" && typeof clientId == "string",
             "Bad Change():", version, clientId);
    },

    toString: function () {
      var s = "[Change " + this.version + "." + this.clientId + ": ";
      s += this.delta + " ";
      if (this.outOfOrder) {
        s += "(out of order) ";
      }
      var cids = [];
      for (var a in this.known) {
        if (this.known.hasOwnProperty(a)) {
          cids.push(a);
        }
      }
      cids.sort();
      s += "{";
      if (! cids.length) {
        s += "nothing known";
      } else {
        cids.forEach(function (a, index) {
          if (index) {
            s += ";";
          }
          s += a + ":" + this.known[a];
        }, this);
      }
      return s + "}]";
    },

    clone: function () {
      return Change(this.version, this.clientId, this.delta.clone(), util.extend(this.known), this.outOfOrder);
    },

    isBefore: function (otherChange) {
      assert(otherChange !== this, "Tried to compare a change to itself", this);
      return otherChange.version > this.version ||
          (otherChange.version == this.version && otherChange.clientId > this.clientId);
    },

    knowsAboutAll: function (versions) {
      for (var clientId in versions) {
        if (! versions.hasOwnProperty(clientId)) {
          continue;
        }
        if (! versions[clientId]) {
          continue;
        }
        if ((! this.known[clientId]) || this.known[clientId] < versions[clientId]) {
          return false;
        }
      }
      return true;
    },

    knowsAboutChange: function (change) {
      return change.clientId == this.clientId ||
          (this.known[change.clientId] && this.known[change.clientId] >= change.version);
    },

    knowsAboutVersion: function (version, clientId) {
      if ((! version) || clientId == this.clientId) {
        return true;
      }
      return this.known[clientId] && this.known[clientId] >= version;
    },

    maybeMissingChanges: function (mostRecentVersion, clientId) {
      if (! mostRecentVersion) {
        // No actual changes for clientId exist
        return false;
      }
      if (! this.known[clientId]) {
        // We don't even know about clientId, so we are definitely missing something
        return true;
      }
      if (this.known[clientId] >= mostRecentVersion) {
        // We know about all versions through mostRecentVersion
        return false;
      }
      if ((clientId > this.clientId && this.known[clientId] >= this.version-1) ||
          (clientId < this.clientId && this.known[clientId] == this.version)) {
        // We know about all versions from clientId that could exist before this
        // version
        return false;
      }
      // We may or may not be missing something
      return true;
    }
  });

  /* SimpleHistory synchronizes peers by relying on the server to serialize
   * the order of all updates.  Each client maintains a queue of patches
   * which have not yet been 'committed' (by being echoed back from the
   * server).  The client is responsible for transposing its own queue
   * if 'earlier' patches are heard from the server.
   *
   * Let's say that A's edit "1" and B's edit "2" occur and get put in
   * their respective SimpleHistory queues.  The server happens to
   * handle 1 first, then 2, so those are the order that all peers
   * (both A and B) see the messages.
   *
   * A sees 1, and has 1 on its queue, so everything's fine. It
   * updates the 'committed' text to match its current text and drops
   * the patch from its queue. It then sees 2, but the basis number
   * for 2 no longer matches the committed basis, so it throws it
   * away.
   *
   * B sees 1, and has 2 on its queue. It does the OT transpose thing,
   * updating the committed text to include 1 and the 'current' text
   * to include 1+2. It updates its queue with the newly transposed
   * version of 2 (call it 2prime) and updates 2prime's basis
   * number. It them resends 2prime to the server. It then receives 2
   * (the original) but the basis number no longer matches the
   * committed basis, so it throws it away.
   *
   * Now the server sees 2prime and rebroadcasts it to both A and B.
   *
   * A is seeing it for the first time, and the basis number matches,
   * so it applies it to the current and committed text.
   *
   * B sees that 2prime matches what's on the start of its queue,
   * shifts it off, and updates the committed text to match the
   * current text.
   *
   * Note that no one tries to keep an entire history of changes,
   * which is the main difference with ot.History.  Everyone applies
   * the same patches in the same order.
   */
  ot.SimpleHistory = util.Class({

    constructor: function(clientId, initState, initBasis) {
      this.clientId = clientId;
      this.committed = initState;
      this.current = initState;
      this.basis = initBasis;
      this.queue = [];
      this.deltaId = 1;
      this.selection = null;
    },

    // Use a fake change to represent the selection.
    // (This is the only bit that hard codes ot.TextReplace as the delta
    // representation; override this in a subclass (or don't set the
    // selection) if you are using a different delta representation.
    setSelection: function(selection) {
      if (selection) {
        this.selection = ot.TextReplace(selection[0],
                                        selection[1] - selection[0], '@');
      } else {
        this.selection = null;
      }
    },

    // Decode the fake change to reconstruct the updated selection.
    getSelection: function() {
      if (! this.selection) {
        return null;
      }
      return [this.selection.start, this.selection.start + this.selection.del];
    },

    // Add this delta to this client's queue.
    add: function(delta) {
      var change = {
        id: this.clientId + '.' + (this.deltaId++),
        delta: delta
      };
      if (! this.queue.length) {
        change.basis = this.basis;
      }
      this.queue.push(change);
      this.current = delta.apply(this.current);
      return !!change.basis;
    },

    // Apply a delta received from the server.
    // Return true iff the current text changed as a result.
    commit: function(change) {

      // ignore it if the basis doesn't match (this patch doesn't apply)
      // if so, this delta is out of order; we expect the original client
      // to retransmit an updated delta.
      if (change.basis !== this.basis) {
        return false; // 'current' text did not change
      }

      // is this the first thing on the queue?
      if (this.queue.length && this.queue[0].id === change.id) {
        assert(change.basis === this.queue[0].basis);
        // good, apply this to commit state & remove it from queue
        this.committed = this.queue.shift().delta.apply(this.committed);
        this.basis++;
        if (this.queue.length) {
          this.queue[0].basis = this.basis;
        }
        return false; // 'current' text did not change
      }

      // Transpose all bits on the queue to put this patch first.
      var inserted = change.delta;
      this.queue = this.queue.map(function(qchange) {
        var tt = qchange.delta.transpose(inserted);
        inserted = tt[1];
        return {
          id: qchange.id,
          delta: tt[0]
        };
      });
      if (this.selection) {
        // update the selection!
        this.selection = this.selection.transpose(inserted)[0];
      }
      this.committed = change.delta.apply(this.committed);
      this.basis++;
      if (this.queue.length) {
        this.queue[0].basis = this.basis;
      }
      // Update current by replaying queued changes starting from 'committed'
      this.current = this.committed;
      this.queue.forEach(function(qchange) {
        this.current = qchange.delta.apply(this.current);
      }.bind(this));
      return true; // The 'current' text changed.
    },

    // Return the next change to transmit to the server, or null if there
    // isn't one.
    getNextToSend: function() {
      var qchange = this.queue[0];
      if (! qchange) {
        /* nothing to send */
        return null;
      }
      if (qchange.sent) {
        /* already sent */
        return null;
      }
      assert(qchange.basis);
      qchange.sent = true;
      return qchange;
    }
  });

  ot.History = util.Class({

    constructor: function (clientId, initState) {
      this._history = Queue();
      this._history.push({
        clientId: "init", state: initState
      });
      this.clientId = clientId;
      this.known = {};
      this.mostRecentLocalChange = null;
    },

    add: function (change) {
      // Simplest cast, it is our change:
      if (change.clientId == this.clientId) {
        this._history.push(change);
        this.mostRecentLocalChange = change.version;
        return change.delta;
      }
      assert((! this.known[change.clientId]) || this.known[change.clientId] < change.version,
            "Got a change", change, "that appears older (or same as) a known change", this.known[change.clientId]);
      // Second simplest case, we get a change that we can add to our
      // history without modification:
      var last = this._history.last();
      if ((last.clientId == "init" || last.isBefore(change)) &&
          change.knowsAboutAll(this.known) &&
          change.knowsAboutVersion(this.mostRecentLocalChange, this.clientId)) {
        this._history.push(change);
        this.known[change.clientId] = change.version;
        return change.delta;
      }
      // We must do work!

      this.logHistory("//");

      // First we check if we need to modify this change because we
      // know about changes that it should know about (changes that
      // preceed it that are in our local history).
      var clientsToCheck = StringSet();
      for (var clientId in this.known) {
        if (! this.known.hasOwnProperty(clientId)) {
          continue;
        }
        if (change.maybeMissingChanges(this.known[clientId], clientId)) {
          clientsToCheck.add(clientId);
        }
      }
      if (change.maybeMissingChanges(this.mostRecentLocalChange, this.clientId)) {
        clientsToCheck.add(this.clientId);
      }
      if (! clientsToCheck.isEmpty()) {
        var indexToCheckFrom = null;
        this._history.walkBack(function (c, index) {
          indexToCheckFrom = index;
          if (c.clientId == "init") {
            return false;
          }
          if (clientsToCheck.contains(c.clientId) &&
              ! change.maybeMissingChanges(c.version, c.clientId)) {
            clientsToCheck.remove(c.clientId);
            if (clientsToCheck.isEmpty()) {
              return false;
            }
          }
          return true;
        }, this);
        this._history.walkForward(indexToCheckFrom, function (c, index) {
          if (c.clientId == "init") {
            return true;
          }
          if (change.isBefore(c)) {
            return false;
          }
          if (! change.knowsAboutChange(c)) {
            var presentDelta = this.promoteDelta(c.delta, index, change);
            if (! presentDelta.equals(c.delta)) {
              //console.log("->rebase delta rewrite", presentDelta+"");
            }
            this.logChange("->rebase", change, function () {
              var result = change.delta.transpose(presentDelta);
              change.delta = result[0];
              change.known[c.clientId] = c.version;
            }, "with:", c);
          }
          return true;
        }, this);
      }

      // Next we insert the change into its proper location
      var indexToInsert = null;
      this._history.walkBack(function (c, index) {
        if (c.clientId == "init" || c.isBefore(change)) {
          indexToInsert = index+1;
          return false;
        }
        return true;
      }, this);
      assert(indexToInsert);
      this._history.insert(indexToInsert, change);

      // Now we fix up any forward changes
      var fixupDelta = change.delta;
      this._history.walkForward(indexToInsert+1, function (c, index) {
        if (! c.knowsAboutChange(change)) {
          var origChange = c.clone();
          this.logChange("^^fix", c, function () {
            var fixupResult = c.delta.transpose(fixupDelta);
            console.log("  ^^real");
            var result = c.delta.transpose(fixupDelta);
            c.delta = result[0];
            c.known[change.clientId] = change.version;
            fixupDelta = fixupResult[1];
          }, "clone:", change.delta+"");
          console.log("(trans)", fixupDelta+"");
          assert(c.knowsAboutChange(change));
        }
      }, this);

      // Finally we return the transformed delta that represents
      // changes that should be made to the state:

      this.logHistory("!!");
      return fixupDelta;
    },

    promoteDelta: function (delta, deltaIndex, untilChange) {
      this._history.walkForward(deltaIndex+1, function (c, index) {
        if (untilChange.isBefore(c)) {
          return false;
        }
        // FIXME: not sure if this clientId check here is right.  Maybe
        // if untilChange.knowsAbout(c)?
        if (untilChange.knowsAboutChange(c)) {
          var result = c.delta.transpose(delta);
          delta = result[1];
        }
        return true;
      });
      return delta;
    },

    logHistory: function (prefix) {
      prefix = prefix || "";
      var postfix = Array.prototype.slice.call(arguments, 1);
      console.log.apply(console, [prefix + "history", this.clientId, ":"].concat(postfix));
      console.log(prefix + " state:", JSON.stringify(this.getStateSafe()));
      var hstate;
      this._history.walkForward(0, function (c, index) {
        if (! index) {
          assert(c.clientId == "init");
          console.log(prefix + " init:", JSON.stringify(c.state));
          hstate = c.state;
        } else {
          try {
            hstate = c.delta.apply(hstate);
          } catch (e) {
            hstate = "Error: " + e;
          }
          console.log(prefix + "  ", index, c+"", JSON.stringify(hstate));
        }
      });
    },

    logChange: function (prefix, change, callback) {
      prefix = prefix || "before";
      var postfix = Array.prototype.slice.call(arguments, 3);
      console.log.apply(
        console,
        [prefix, this.clientId, ":", change+""].concat(postfix).concat([JSON.stringify(this.getStateSafe(true))]));
      try {
        callback();
      } finally {
        console.log(prefix + " after:", change+"", JSON.stringify(this.getStateSafe()));
      }
    },

    addDelta: function (delta) {
      var version = this._createVersion();
      var change = Change(version, this.clientId, delta, util.extend(this.knownVersions));
      this.add(change);
      return change;
    },

    _createVersion: function () {
      var max = 1;
      for (var id in this.knownVersions) {
        max = Math.max(max, this.knownVersions[id]);
      }
      max = Math.max(max, this.mostRecentLocalChange);
      return max+1;
    },

    fault: function (change) {
      throw new Error('Fault');
    },

    getState: function () {
      var state;
      this._history.walkForward(0, function (c) {
        if (c.clientId == "init") {
          // Initialization, has the state
          state = c.state;
        } else {
          state = c.delta.apply(state);
        }
      }, this);
      return state;
    },

    getStateSafe: function () {
      try {
        return this.getState();
      } catch (e) {
        return 'Error: ' + e;
      }
    }

  });

  ot.TextReplace = util.Class({

    constructor: function (start, del, text) {
      assert(typeof start == "number" && typeof del == "number" && typeof text == "string", start, del, text);
      assert(start >=0 && del >= 0, start, del);
      this.start = start;
      this.del = del;
      this.text = text;
    },

    toString: function () {
      if (this.empty()) {
        return '[no-op]';
      }
      if (! this.del) {
        return '[insert ' + JSON.stringify(this.text) + ' @' + this.start + ']';
      } else if (! this.text) {
        return '[delete ' + this.del + ' chars @' + this.start + ']';
      } else {
        return '[replace ' + this.del + ' chars with ' + JSON.stringify(this.text) + ' @' + this.start + ']';
      }
    },

    equals: function (other) {
      return other.constructor === this.constructor &&
          other.del === this.del &&
          other.start === this.start &&
          other.text === this.text;
    },

    clone: function (start, del, text) {
      if (start === undefined) {
        start = this.start;
      }
      if (del === undefined) {
        del = this.del;
      }
      if (text === undefined) {
        text = this.text;
      }
      return ot.TextReplace(start, del, text);
    },

    empty: function () {
      return (! this.del) && (! this.text);
    },

    apply: function (text) {
      if (this.empty()) {
        return text;
      }
      if (this.start > text.length) {
        console.trace();
        throw new util.AssertionError("Start after end of text (" + JSON.stringify(text) + "/" + text.length + "): " + this);
      }
      if (this.start + this.del > text.length) {
        throw new util.AssertionError("Start+del after end of text (" + JSON.stringify(text) + "/" + text.length + "): " + this);
      }
      return text.substr(0, this.start) + this.text + text.substr(this.start+this.del);
    },

    transpose: function (delta) {
      /* Transform this delta as though the other delta had come before it.
         Returns a [new_version_of_this, transformed_delta], where transformed_delta
         satisfies:

         result1 = new_version_of_this.apply(delta.apply(text));
         result2 = transformed_delta.apply(this.apply(text));
         assert(result1 == result2);

         Does not modify this object.
      */
      var overlap;
      assert(delta instanceof ot.TextReplace, "Transposing with non-TextReplace:", delta);
      if (this.empty()) {
        //console.log("  =this is empty");
        return [this.clone(), delta.clone()];
      }
      if (delta.empty()) {
        //console.log("  =other is empty");
        return [this.clone(), delta.clone()];
      }
      if (delta.before(this)) {
        //console.log("  =this after other");
        return [this.clone(this.start + delta.text.length - delta.del),
                delta.clone()];
      } else if (this.before(delta)) {
        //console.log("  =this before other");
        return [this.clone(), delta.clone(delta.start + this.text.length - this.del)];
      } else if (delta.sameRange(this)) {
        //console.log("  =same range");
        return [this.clone(this.start+delta.text.length, 0),
                delta.clone(undefined, 0)];
      } else if (delta.contains(this)) {
        //console.log("  =other contains this");
        return [this.clone(delta.start+delta.text.length, 0, this.text),
                delta.clone(undefined, delta.del - this.del + this.text.length, delta.text + this.text)];
      } else if (this.contains(delta)) {
        //console.log("  =this contains other");
        return [this.clone(undefined, this.del - delta.del + delta.text.length, delta.text + this.text),
                delta.clone(this.start, 0, delta.text)];
      } else if (this.overlapsStart(delta)) {
        //console.log("  =this overlaps start of other");
        overlap = this.start + this.del - delta.start;
        return [this.clone(undefined, this.del - overlap),
                delta.clone(this.start + this.text.length, delta.del - overlap)];
      } else {
        //console.log("  =this overlaps end of other");
        assert(delta.overlapsStart(this), delta+"", "does not overlap start of", this+"", delta.before(this));
        overlap = delta.start + delta.del - this.start;
        return [this.clone(delta.start + delta.text.length, this.del - overlap),
                delta.clone(undefined, delta.del - overlap)];
      }
      throw 'Should not happen';
    },

    before: function (other) {
      return this.start + this.del <= other.start;
    },

    contains: function (other) {
      return other.start >= this.start && other.start + other.del < this.start + this.del;
    },

    sameRange: function (other) {
      return other.start == this.start && other.del == this.del;
    },

    overlapsStart: function (other) {
      return this.start < other.start && this.start + this.del > other.start;
    },

    classMethods: {

      /* Make a new ot.TextReplace that converts oldValue to newValue. */
      fromChange: function(oldValue, newValue) {
        assert(typeof oldValue == "string");
        assert(typeof newValue == "string");
        var commonStart = 0;
        while (commonStart < newValue.length &&
               newValue.charAt(commonStart) == oldValue.charAt(commonStart)) {
          commonStart++;
        }
        var commonEnd = 0;
        while (commonEnd < (newValue.length - commonStart) &&
               commonEnd < (oldValue.length - commonStart) &&
               newValue.charAt(newValue.length - commonEnd - 1) ==
               oldValue.charAt(oldValue.length - commonEnd - 1)) {
          commonEnd++;
        }
        var removed = oldValue.substr(commonStart, oldValue.length - commonStart - commonEnd);
        var inserted = newValue.substr(commonStart, newValue.length - commonStart - commonEnd);
        if (! (removed.length || inserted)) {
          return null;
        }
        return this(commonStart, removed.length, inserted);
      },

      random: function (source, generator) {
        var text, start, len;
        var ops = ["ins", "del", "repl"];
        if (! source.length) {
          ops = ["ins"];
        }
        switch (generator.pick(ops)) {
        case "ins":
          if (! generator.number(2)) {
            text = generator.string(1);
          } else {
            text = generator.string(generator.number(3)+1);
          }
          if (! generator.number(4)) {
            start = 0;
          } else if (! generator.number(3)) {
            start = source.length-1;
          } else {
            start = generator.number(source.length);
          }
          return this(start, 0, text);

        case "del":
          if (! generator.number(20)) {
            return this(0, source.length, "");
          }
          start = generator.number(source.length-1);
          if (! generator.number(2)) {
            len = 1;
          } else {
            len = generator.number(5)+1;
          }
          len = Math.min(len, source.length - start);
          return this(start, len, "");

        case "repl":
          start = generator.number(source.length-1);
          len = generator.number(5);
          len = Math.min(len, source.length - start);
          text = generator.string(generator.number(2)+1);
          return this(start, len, text);
        }
        throw 'Unreachable';
      }
    }
  });

  return ot;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('forms',["jquery", "util", "session", "elementFinder", "eventMaker", "templating", "ot"], function ($, util, session, elementFinder, eventMaker, templating, ot) {
  var forms = util.Module("forms");
  var assert = util.assert;

  // This is how much larger the focus element is than the element it surrounds
  // (this is padding on each side)
  var FOCUS_BUFFER = 5;

  var inRemoteUpdate = false;

  function suppressSync(element) {
    return $(element).is(":password");
  }

  function maybeChange(event) {
    // Called when we get an event that may or may not indicate a real change
    // (like keyup in a textarea)
    var tag = event.target.tagName;
    if (tag == "TEXTAREA" || tag == "INPUT") {
      change(event);
    }
  }

  function change(event) {
    sendData({
      element: event.target,
      value: getValue(event.target)
    });
  }

  function sendData(attrs) {
    var el = $(attrs.element);
    assert(el);
    var tracker = attrs.tracker;
    var value = attrs.value;
    if (inRemoteUpdate) {
      return;
    }
    if (elementFinder.ignoreElement(el) ||
        (elementTracked(el) && !tracker) ||
        suppressSync(el)) {
      return;
    }
    var location = elementFinder.elementLocation(el);
    var msg = {
      type: "form-update",
      element: location
    };
    if (isText(el) || tracker) {
      var history = el.data("togetherjsHistory");
      if (history) {
        if (history.current == value) {
          return;
        }
        var delta = ot.TextReplace.fromChange(history.current, value);
        assert(delta);
        history.add(delta);
        maybeSendUpdate(msg.element, history, tracker);
        return;
      } else {
        msg.value = value;
        msg.basis = 1;
        el.data("togetherjsHistory", ot.SimpleHistory(session.clientId, value, 1));
      }
    } else {
      msg.value = value;
    }
    session.send(msg);
  }

  function isCheckable(el) {
    el = $(el);
    var type = (el.prop("type") || "text").toLowerCase();
    if (el.prop("tagName") == "INPUT" && ["radio", "checkbox"].indexOf(type) != -1) {
      return true;
    }
    return false;
  }

  var editTrackers = {};
  var liveTrackers = [];

  TogetherJS.addTracker = function (TrackerClass, skipSetInit) {
    assert(typeof TrackerClass === "function", "You must pass in a class");
    assert(typeof TrackerClass.prototype.trackerName === "string",
           "Needs a .prototype.trackerName string");
    // Test for required instance methods.
    "destroy update init makeInit tracked".split(/ /).forEach(function(m) {
      assert(typeof TrackerClass.prototype[m] === "function",
             "Missing required tracker method: "+m);
    });
    // Test for required class methods.
    "scan tracked".split(/ /).forEach(function(m) {
      assert(typeof TrackerClass[m] === "function",
             "Missing required tracker class method: "+m);
    });
    editTrackers[TrackerClass.prototype.trackerName] = TrackerClass;
    if (!skipSetInit) {
      setInit();
    }
  };

  var AceEditor = util.Class({

    trackerName: "AceEditor",

    constructor: function (el) {
      this.element = $(el)[0];
      assert($(this.element).hasClass("ace_editor"));
      this._change = this._change.bind(this);
      this._editor().document.on("change", this._change);
    },

    tracked: function (el) {
      return this.element === $(el)[0];
    },

    destroy: function (el) {
      this._editor().document.removeListener("change", this._change);
    },

    update: function (msg) {
      this._editor().document.setValue(msg.value);
    },

    init: function (update, msg) {
      this.update(update);
    },

    makeInit: function () {
      return {
        element: this.element,
        tracker: this.trackerName,
        value: this._editor().document.getValue()
      };
    },

    _editor: function () {
      return this.element.env;
    },

    _change: function (e) {
      // FIXME: I should have an internal .send() function that automatically
      // asserts !inRemoteUpdate, among other things
      if (inRemoteUpdate) {
        return;
      }
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    getContent: function() {
      return this._editor().document.getValue();
    }
  });

  AceEditor.scan = function () {
    return $(".ace_editor");
  };

  AceEditor.tracked = function (el) {
    return !! $(el).closest(".ace_editor").length;
  };

  TogetherJS.addTracker(AceEditor, true /* skip setInit */);

  var CodeMirrorEditor = util.Class({
    trackerName: "CodeMirrorEditor",

    constructor: function (el) {
      this.element = $(el)[0];
      assert(this.element.CodeMirror);
      this._change = this._change.bind(this);
      this._editor().on("change", this._change);
    },

    tracked: function (el) {
      return this.element === $(el)[0];
    },

    destroy: function (el) {
      this._editor().off("change", this._change);
    },

    update: function (msg) {
      this._editor().setValue(msg.value);
    },

    init: function (msg) {
      if (msg.value) {
        this.update(msg);
      }
    },

    makeInit: function () {
      return {
        element: this.element,
        tracker: this.trackerName,
        value: this._editor().getValue()
      };
    },

    _change: function (editor, change) {
      if (inRemoteUpdate) {
        return;
      }
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    _editor: function () {
      return this.element.CodeMirror;
    },

    getContent: function() {
      return this._editor().getValue();
    }
  });

  CodeMirrorEditor.scan = function () {
    var result = [];
    var els = document.body.getElementsByTagName("*");
    var _len = els.length;
    for (var i=0; i<_len; i++) {
      var el = els[i];
      if (el.CodeMirror) {
        result.push(el);
      }
    }
    return $(result);
  };

  CodeMirrorEditor.tracked = function (el) {
    el = $(el)[0];
    while (el) {
      if (el.CodeMirror) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  };

  TogetherJS.addTracker(CodeMirrorEditor, true /* skip setInit */);


  var CKEditor = util.Class({
    trackerName: "CKEditor",

    constructor: function (el) {
      this.element = $(el)[0];
      assert(CKEDITOR);
      assert(CKEDITOR.dom.element.get(this.element));
      this._change = this._change.bind(this);
      // FIXME: change event is available since CKEditor 4.2
      this._editor().on("change", this._change);
    },
    tracked: function (el) {
      return this.element === $(el)[0];
    },
    destroy: function (el) {
      this._editor().removeListener("change", this._change);
    },

    update: function (msg) {
      //FIXME: use setHtml instead of setData to avoid frame reloading overhead
      this._editor().editable().setHtml(msg.value);
    },

    init: function (update, msg) {
      this.update(update);
    },

    makeInit: function () {
      return {
        element: this.element,
        tracker: this.trackerName,
        value: this.getContent()
      };
    },

    _change: function (e) {
      if (inRemoteUpdate) {
        return;
      }
      sendData({
        tracker: this.trackerName,
        element: this.element,
        value: this.getContent()
      });
    },

    _editor: function () {
      return CKEDITOR.dom.element.get(this.element).getEditor();
    },
    
    getContent: function () {
      return this._editor().getData();
    }
  });

  CKEditor.scan = function () {
    var result = [];
    if (typeof CKEDITOR == "undefined") {
      return;
    }
    var editorInstance;
    for (var instanceIdentifier in CKEDITOR.instances) {
      editorInstance = document.getElementById(instanceIdentifier) || document.getElementsByName(instanceIdentifier)[0];
      if (editorInstance) {
        result.push(editorInstance);
      }
    }
    return $(result);
  };

  CKEditor.tracked = function (el) {
    if (typeof CKEDITOR == "undefined") {
      return false;
    }
    el = $(el)[0];
    return !! (CKEDITOR.dom.element.get(el) && CKEDITOR.dom.element.get(el).getEditor());
  };

  TogetherJS.addTracker(CKEditor, true /* skip setInit */);


  function buildTrackers() {
    assert(! liveTrackers.length);
    util.forEachAttr(editTrackers, function (TrackerClass) {
      var els = TrackerClass.scan();
      if (els) {
        $.each(els, function () {
          var tracker = new TrackerClass(this);
          $(this).data("togetherjsHistory", ot.SimpleHistory(session.clientId, tracker.getContent(), 1));
          liveTrackers.push(tracker);
        });
      }
    });
  }

  function destroyTrackers() {
    liveTrackers.forEach(function (tracker) {
      tracker.destroy();
    });
    liveTrackers = [];
  }

  function elementTracked(el) {
    var result = false;
    util.forEachAttr(editTrackers, function (TrackerClass) {
      if (TrackerClass.tracked(el)) {
        result = true;
      }
    });
    return result;
  }

  function getTracker(el, name) {
    el = $(el)[0];
    for (var i=0; i<liveTrackers.length; i++) {
      var tracker = liveTrackers[i];
      if (tracker.tracked(el)) {
        assert((! name) || name == tracker.trackerName, "Expected to map to a tracker type", name, "but got", tracker.trackerName);
        return tracker;
      }
    }
    return null;
  }

  var TEXT_TYPES = (
    "color date datetime datetime-local email " +
        "tel text time week").split(/ /g);

  function isText(el) {
    el = $(el);
    var tag = el.prop("tagName");
    var type = (el.prop("type") || "text").toLowerCase();
    if (tag == "TEXTAREA") {
      return true;
    }
    if (tag == "INPUT" && TEXT_TYPES.indexOf(type) != -1) {
      return true;
    }
    return false;
  }

  function getValue(el) {
    el = $(el);
    if (isCheckable(el)) {
      return el.prop("checked");
    } else {
      return el.val();
    }
  }

  function getElementType(el) {
    el = $(el)[0];
    if (el.tagName == "TEXTAREA") {
      return "textarea";
    }
    if (el.tagName == "SELECT") {
      return "select";
    }
    if (el.tagName == "INPUT") {
      return (el.getAttribute("type") || "text").toLowerCase();
    }
    return "?";
  }

  function setValue(el, value) {
    el = $(el);
    var changed = false;
    if (isCheckable(el)) {
      var checked = !! el.prop("checked");
      value = !! value;
      if (checked != value) {
        changed = true;
        el.prop("checked", value);
      }
    } else {
      if (el.val() != value) {
        changed = true;
        el.val(value);
      }
    }
    if (changed) {
      eventMaker.fireChange(el);
    }
  }

  /* Send the top of this history queue, if it hasn't been already sent. */
  function maybeSendUpdate(element, history, tracker) {
    var change = history.getNextToSend();
    if (! change) {
      /* nothing to send */
      return;
    }
    var msg = {
      type: "form-update",
      element: element,
      "server-echo": true,
      replace: {
        id: change.id,
        basis: change.basis,
        delta: {
          start: change.delta.start,
          del: change.delta.del,
          text: change.delta.text
        }
      }
    };
    if (tracker) {
      msg.tracker = tracker;
    }
    session.send(msg);
  }

  session.hub.on("form-update", function (msg) {
    if (! msg.sameUrl) {
      return;
    }
    var el = $(elementFinder.findElement(msg.element));
    var tracker;
    if (msg.tracker) {
      tracker = getTracker(el, msg.tracker);
      assert(tracker);
    }
    var focusedEl = el[0].ownerDocument.activeElement;
    var focusedElSelection;
    if (isText(focusedEl)) {
      focusedElSelection = [focusedEl.selectionStart, focusedEl.selectionEnd];
    }
    var selection;
    if (isText(el)) {
      selection = [el[0].selectionStart, el[0].selectionEnd];
    }
    var value;
    if (msg.replace) {
      var history = el.data("togetherjsHistory");
      if (!history) {
        console.warn("form update received for uninitialized form element");
        return;
      }
      history.setSelection(selection);
      // make a real TextReplace object.
      msg.replace.delta = ot.TextReplace(msg.replace.delta.start,
                                         msg.replace.delta.del,
                                         msg.replace.delta.text);
      // apply this change to the history
      var changed = history.commit(msg.replace);
      var trackerName = null;
      if (typeof tracker != "undefined") {
        trackerName = tracker.trackerName;
      }
      maybeSendUpdate(msg.element, history, trackerName);
      if (! changed) {
        return;
      }
      value = history.current;
      selection = history.getSelection();
    } else {
      value = msg.value;
    }
    inRemoteUpdate = true;
    try {
      if(tracker) {
        tracker.update({value:value});
      } else {
        setValue(el, value);
      }
      if (isText(el)) {
        el[0].selectionStart = selection[0];
        el[0].selectionEnd = selection[1];
      }
      // return focus to original input:
      if (focusedEl != el[0]) {
        focusedEl.focus();
        if (isText(focusedEl)) {
          focusedEl.selectionStart = focusedElSelection[0];
          focusedEl.selectionEnd = focusedElSelection[1];
        }
      }
    } finally {
      inRemoteUpdate = false;
    }
  });

  var initSent = false;

  function sendInit() {
    initSent = true;
    var msg = {
      type: "form-init",
      pageAge: Date.now() - TogetherJS.pageLoaded,
      updates: []
    };
    var els = $("textarea, input, select");
    els.each(function () {
      if (elementFinder.ignoreElement(this) || elementTracked(this) ||
          suppressSync(this)) {
        return;
      }
      var el = $(this);
      var value = getValue(el);
      var upd = {
        element: elementFinder.elementLocation(this),
        value: value,
        elementType: getElementType(el)
      };
      if (isText(el)) {
        var history = el.data("togetherjsHistory");
        if (history) {
          upd.value = history.committed;
          upd.basis = history.basis;
        }
      }
      msg.updates.push(upd);
    });
    liveTrackers.forEach(function (tracker) {
      var init = tracker.makeInit();
      assert(tracker.tracked(init.element));
      var history = $(init.element).data("togetherjsHistory");
      if (history) {
        init.value = history.committed;
        init.basis = history.basis;
      }
      init.element = elementFinder.elementLocation($(init.element));
      msg.updates.push(init);
    });
    if (msg.updates.length) {
      session.send(msg);
    }
  }

  function setInit() {
    var els = $("textarea, input, select");
    els.each(function () {
      if (elementTracked(this)) {
        return;
      }
      if (elementFinder.ignoreElement(this)) {
        return;
      }
      var el = $(this);
      var value = getValue(el);
      el.data("togetherjsHistory", ot.SimpleHistory(session.clientId, value, 1));
    });
    destroyTrackers();
    buildTrackers();
  }

  session.on("reinitialize", setInit);

  session.on("ui-ready", setInit);

  session.on("close", destroyTrackers);

  session.hub.on("form-init", function (msg) {
    if (! msg.sameUrl) {
      return;
    }
    if (initSent) {
      // In a 3+-peer situation more than one client may init; in this case
      // we're probably the other peer, and not the peer that needs the init
      // A quick check to see if we should init...
      var myAge = Date.now() - TogetherJS.pageLoaded;
      if (msg.pageAge < myAge) {
        // We've been around longer than the other person...
        return;
      }
    }
    // FIXME: need to figure out when to ignore inits
    msg.updates.forEach(function (update) {
      var el;
      try {
        el = elementFinder.findElement(update.element);
      } catch (e) {
        /* skip missing element */
        console.warn(e);
        return;
      }
        inRemoteUpdate = true;
        try {
          if (update.tracker) {
            var tracker = getTracker(el, update.tracker);
            assert(tracker);
            tracker.init(update, msg);
          } else {
            setValue(el, update.value);
          }
          if (update.basis) {
            var history = $(el).data("togetherjsHistory");
            // don't overwrite history if we're already up to date
            // (we might have outstanding queued changes we don't want to lose)
            if (!(history && history.basis === update.basis &&
                  // if history.basis is 1, the form could have lingering
                  // edits from before togetherjs was launched.  that's too bad,
                  // we need to erase them to resynchronize with the peer
                  // we just asked to join.
                  history.basis !== 1)) {
              $(el).data("togetherjsHistory", ot.SimpleHistory(session.clientId, update.value, update.basis));
            }
          }
        } finally {
          inRemoteUpdate = false;
        }
    });
  });

  var lastFocus = null;

  function focus(event) {
    var target = event.target;
    if (elementFinder.ignoreElement(target) || elementTracked(target)) {
      blur(event);
      return;
    }
    if (target != lastFocus) {
      lastFocus = target;
      session.send({type: "form-focus", element: elementFinder.elementLocation(target)});
    }
  }

  function blur(event) {
    var target = event.target;
    if (lastFocus) {
      lastFocus = null;
      session.send({type: "form-focus", element: null});
    }
  }

  var focusElements = {};

  session.hub.on("form-focus", function (msg) {
    var current = focusElements[msg.peer.id];
    if (current) {
      current.remove();
      current = null;
    }
    if (! msg.element) {
      // A blur
      return;
    }
    var element = elementFinder.findElement(msg.element);
    var el = createFocusElement(msg.peer, element);
    if (el) {
      focusElements[msg.peer.id] = el;
    }
  });

  session.hub.on("hello", function (msg) {
    if (lastFocus) {
      setTimeout(function () {
        if (lastFocus) {
          session.send({type: "form-focus", element: elementFinder.elementLocation(lastFocus)});
        }
      });
    }
  });

  function createFocusElement(peer, around) {
    around = $(around);
    var aroundOffset = around.offset();
    if (! aroundOffset) {
      console.warn("Could not get offset of element:", around[0]);
      return null;
    }
    var el = templating.sub("focus", {peer: peer});
    el = el.find(".togetherjs-focus");
    el.css({
      top: aroundOffset.top-FOCUS_BUFFER + "px",
      left: aroundOffset.left-FOCUS_BUFFER + "px",
      width: around.outerWidth() + (FOCUS_BUFFER*2) + "px",
      height: around.outerHeight() + (FOCUS_BUFFER*2) + "px"
    });
    $(document.body).append(el);
    return el;
  }

  session.on("ui-ready", function () {
    $(document).on("change", change);
    // note that textInput, keydown, and keypress aren't appropriate events
    // to watch, since they fire *before* the element's value changes.
    $(document).on("input keyup cut paste", maybeChange);
    $(document).on("focusin", focus);
    $(document).on("focusout", blur);
  });

  session.on("close", function () {
    $(document).off("change", change);
    $(document).off("input keyup cut paste", maybeChange);
    $(document).off("focusin", focus);
    $(document).off("focusout", blur);
  });

  session.hub.on("hello", function (msg) {
    if (msg.sameUrl) {
      setTimeout(sendInit);
    }
  });

  return forms;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This module handles all the different UI that happens (sometimes in order) when
   TogetherJS is started:

   - Introduce the session when you've been invited
   - Show any browser compatibility indicators
   - Show the walkthrough the first time
   - Show the share link window

   When everything is done it fires session.emit("startup-ready")

*/
define('startup',["util", "require", "jquery", "windowing", "storage"], function (util, require, $, windowing, storage) {
  var assert = util.assert;
  var startup = util.Module("startup");
  // Avoid circular import:
  var session = null;

  var STEPS = [
    "browserBroken",
    "browserUnsupported",
    "sessionIntro",
    "walkthrough",
    // Look in the share() below if you add anything after here:
    "share"
    ];

  var currentStep = null;

  startup.start = function () {
    if (! session) {
      require(["session"], function (sessionModule) {
        session = sessionModule;
        startup.start();
      });
      return;
    }
    var index = -1;
    if (currentStep) {
      index = STEPS.indexOf(currentStep);
    }
    index++;
    if (index >= STEPS.length) {
      session.emit("startup-ready");
      return;
    }
    currentStep = STEPS[index];
    handlers[currentStep](startup.start);
  };

  var handlers = {

    browserBroken: function (next) {
      if (window.WebSocket) {
        next();
        return;
      }
      windowing.show("#togetherjs-browser-broken", {
        onClose: function () {
          session.close();
        }
      });
      if ($.browser.msie) {
        $("#togetherjs-browser-broken-is-ie").show();
      }
    },

    browserUnsupported: function (next) {
      if (! $.browser.msie) {
        next();
        return;
      }
      var cancel = true;
      windowing.show("#togetherjs-browser-unsupported", {
        onClose: function () {
          if (cancel) {
            session.close();
          } else {
            next();
          }
        }
      });
      $("#togetherjs-browser-unsupported-anyway").click(function () {
        cancel = false;
      });
    },

    sessionIntro: function (next) {
      if ((! session.isClient) || ! session.firstRun) {
        next();
        return;
      }
      TogetherJS.config.close("suppressJoinConfirmation");
      if (TogetherJS.config.get("suppressJoinConfirmation")) {
        next();
        return;
      }
      var cancelled = false;
      windowing.show("#togetherjs-intro", {
        onClose: function () {
          if (! cancelled) {
            next();
          }
        }
      });
      $("#togetherjs-intro .togetherjs-modal-dont-join").click(function () {
        cancelled = true;
        windowing.hide();
        session.close("declined-join");
      });
    },

    walkthrough: function (next) {
      storage.settings.get("seenIntroDialog").then(function (seenIntroDialog) {
        if (seenIntroDialog) {
          next();
          return;
        }
        require(["walkthrough"], function (walkthrough) {
          walkthrough.start(true, function () {
            storage.settings.set("seenIntroDialog", true);
            next();
          });
        });
      });
    },

    share: function (next) {
      TogetherJS.config.close("suppressInvite");
      if (session.isClient || (! session.firstRun) ||
          TogetherJS.config.get("suppressInvite")) {
        next();
        return;
      }
      require(["windowing"], function (windowing) {
        windowing.show("#togetherjs-share");
        // FIXME: no way to detect when the window is closed
        // If there was a next() step then it would not work
      });
    }

  };

  return startup;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('videos',["jquery", "util", "session", "elementFinder"],
function ($, util, session, elementFinder) {

  var listeners = [];

  var TIME_UPDATE = 'timeupdate';
  var MIRRORED_EVENTS = ['play', 'pause'];

  var TOO_FAR_APART = 3000;

  session.on("reinitialize", function () {
    unsetListeners();
    setupListeners();
  });

  session.on("ui-ready", setupListeners);

  function setupListeners() {
    var videos = $('video');
    setupMirroredEvents(videos);
    setupTimeSync(videos);
  }

  function setupMirroredEvents(videos) {
    var currentListener;
    MIRRORED_EVENTS.forEach(function (eventName) {
      currentListener = makeEventSender(eventName);
      videos.on(eventName, currentListener);
      listeners.push({
        name: eventName,
        listener: currentListener
      });
    });
  }

  function makeEventSender(eventName) {
    return function (event, options) {
      var element = event.target;
      options || (options = {});
      if (!options.silent) {
        session.send({
          type: ('video-'+eventName),
          location: elementFinder.elementLocation(element),
          position: element.currentTime
        });
      }
    };
  }

  function setupTimeSync(videos) {
    videos.each(function(i, video) {
      var onTimeUpdate = makeTimeUpdater();
      $(video).on(TIME_UPDATE, onTimeUpdate);
      listeners.push({
        name: TIME_UPDATE,
        listener: onTimeUpdate
      });
    });
  }

  function makeTimeUpdater() {
    var last = 0;
    return function (event) {
      var currentTime = event.target.currentTime;
      if(areTooFarApart(currentTime, last)){
        makeEventSender(TIME_UPDATE)(event);
      }
      last = currentTime;
    };
  }

  function areTooFarApart(currentTime, lastTime) {
    var secDiff = Math.abs(currentTime - lastTime);
    var milliDiff = secDiff * 1000;
    return milliDiff > TOO_FAR_APART;
  }

  session.on("close", unsetListeners);

  function unsetListeners() {
    var videos = $('video');
    listeners.forEach(function (event) {
        videos.off(event.name, event.listener);
    });
    listeners = [];
  }


  session.hub.on('video-timeupdate', function (msg) {
    var element = $findElement(msg.location);
    var oldTime = element.prop('currentTime');
    var newTime = msg.position;

    //to help throttle uneccesary position changes
    if(areTooFarApart(oldTime, newTime)){
      setTime(element, msg.position);
    }
  });

  MIRRORED_EVENTS.forEach( function (eventName) {
    session.hub.on("video-"+eventName, function (msg) {
      var element = $findElement(msg.location);

      setTime(element, msg.position);

      element.trigger(eventName, {silent: true});
    });
  });

  //Currently does not discriminate between visible and invisible videos
  function $findElement(location) {
    return $(elementFinder.findElement(location));
  }

  function setTime(video, time) {
    video.prop('currentTime', time);
  }

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define('walkthrough',["util", "ui", "jquery", "windowing", "templates", "templating", "session", "peers"], function (util, ui, $, windowing, templates, templating, session, peers) {
  var assert = util.assert;
  var walkthrough = util.Module("walkthrough");
  var onHideAll = null;
  var container = null;

  var slides = null;

  walkthrough.start = function (firstTime, doneCallback) {
    if (! container) {
      container = $(templates.walkthrough);
      container.hide();
      ui.container.append(container);
      slides = container.find(".togetherjs-walkthrough-slide");
      slides.hide();
      var progress = $("#togetherjs-walkthrough-progress");
      slides.each(function (index) {
        var bullet = templating.sub("walkthrough-slide-progress");
        progress.append(bullet);
        bullet.click(function () {
          show(index);
        });
      });
      container.find("#togetherjs-walkthrough-previous").click(previous);
      container.find("#togetherjs-walkthrough-next").click(next);
      ui.prepareShareLink(container);
      container.find(".togetherjs-self-name").bind("keyup", function (event) {
        var val = $(event.target).val();
        peers.Self.update({name: val});
      });
      container.find(".togetherjs-swatch").click(function () {
        var picker = $("#togetherjs-pick-color");
        if (picker.is(":visible")) {
          picker.hide();
          return;
        }
        picker.show();
        picker.find(".togetherjs-swatch-active").removeClass("togetherjs-swatch-active");
        picker.find(".togetherjs-swatch[data-color=\"" + peers.Self.color + "\"]").addClass("togetherjs-swatch-active");
        var location = container.find(".togetherjs-swatch").offset();
        picker.css({
          top: location.top,
          // The -7 comes out of thin air, but puts it in the right place:
          left: location.left-7
        });
      });
      if (session.isClient) {
        container.find(".togetherjs-if-creator").remove();
        container.find(".togetherjs-ifnot-creator").show();
      } else {
        container.find(".togetherjs-if-creator").show();
        container.find(".togetherjs-ifnot-creator").remove();
      }
      TogetherJS.config.track("siteName", function (value) {
        value = value || document.title;
        container.find(".togetherjs-site-name").text(value);
      });
      ui.activateAvatarEdit(container, {
        onSave: function () {
          container.find("#togetherjs-avatar-when-saved").show();
          container.find("#togetherjs-avatar-when-unsaved").hide();
        },
        onPending: function () {
          container.find("#togetherjs-avatar-when-saved").hide();
          container.find("#togetherjs-avatar-when-unsaved").show();
        }
      });
      // This triggers substititions in the walkthrough:
      peers.Self.update({});
      session.emit("new-element", container);
    }
    assert(typeof firstTime == "boolean", "You must provide a firstTime boolean parameter");
    if (firstTime) {
      container.find(".togetherjs-walkthrough-firsttime").show();
      container.find(".togetherjs-walkthrough-not-firsttime").hide();
    } else {
      container.find(".togetherjs-walkthrough-firsttime").hide();
      container.find(".togetherjs-walkthrough-not-firsttime").show();
    }
    onHideAll = doneCallback;
    show(0);
    windowing.show(container);
  };

  function show(index) {
    slides.hide();
    $(slides[index]).show();
    var bullets = container.find("#togetherjs-walkthrough-progress .togetherjs-walkthrough-slide-progress");
    bullets.removeClass("togetherjs-active");
    $(bullets[index]).addClass("togetherjs-active");
    var $next = $("#togetherjs-walkthrough-next").removeClass("togetherjs-disabled");
    var $previous = $("#togetherjs-walkthrough-previous").removeClass("togetherjs-disabled");
    if (index == slides.length - 1) {
      $next.addClass("togetherjs-disabled");
    } else if (index === 0) {
      $previous.addClass("togetherjs-disabled");
    }
  }

  function previous() {
    var index = getIndex();
    index--;
    if (index < 0) {
      index = 0;
    }
    show(index);
  }

  function next() {
    var index = getIndex();
    index++;
    if (index >= slides.length) {
      index = slides.length-1;
    }
    show(index);
  }

  function getIndex() {
    var active = slides.filter(":visible");
    if (! active.length) {
      return 0;
    }
    for (var i=0; i<slides.length; i++) {
      if (slides[i] == active[0]) {
        return i;
      }
    }
    return 0;
  }

  walkthrough.stop = function () {
    windowing.hide(container);
    if (onHideAll) {
      onHideAll();
      onHideAll = null;
    }
  };

  session.on("hide-window", function () {
    if (onHideAll) {
      onHideAll();
      onHideAll = null;
    }
  });

  return walkthrough;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// WebRTC support -- Note that this relies on parts of the interface code that usually goes in ui.js

define('webrtc',["require", "jquery", "util", "session", "ui", "peers", "storage", "windowing"], function (require, $, util, session, ui, peers, storage, windowing) {
  var webrtc = util.Module("webrtc");
  var assert = util.assert;

  session.RTCSupported = !!(window.mozRTCPeerConnection ||
                            window.webkitRTCPeerConnection ||
                            window.RTCPeerConnection);

  if (session.RTCSupported && $.browser.mozilla && parseInt($.browser.version, 10) <= 19) {
    // In a few versions of Firefox (18 and 19) these APIs are present but
    // not actually usable
    // See: https://bugzilla.mozilla.org/show_bug.cgi?id=828839
    // Because they could be pref'd on we'll do a quick check:
    try {
      (function () {
        var conn = new window.mozRTCPeerConnection();
      })();
    } catch (e) {
      session.RTCSupported = false;
    }
  }

  var mediaConstraints = {
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: false
    }
  };
  if (window.mozRTCPeerConnection) {
    mediaConstraints.mandatory.MozDontOfferDataChannel = true;
  }

  var URL = window.webkitURL || window.URL;
  var RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
  var RTCIceCandidate = window.mozRTCIceCandidate || window.webkitRTCIceCandidate || window.RTCIceCandidate;

  function makePeerConnection() {
    // Based roughly off: https://github.com/firebase/gupshup/blob/gh-pages/js/chat.js
    if (window.webkitRTCPeerConnection) {
      return new webkitRTCPeerConnection({
        "iceServers": [{"url": "stun:stun.l.google.com:19302"}]
      }, {
        "optional": [{"DtlsSrtpKeyAgreement": true}]
      });
    }
    if (window.mozRTCPeerConnection) {
      return new mozRTCPeerConnection({
        // Or stun:124.124.124..2 ?
        "iceServers": [{"url": "stun:23.21.150.121"}]
      }, {
        "optional": []
      });
    }
    throw new util.AssertionError("Called makePeerConnection() without supported connection");
  }

  function ensureCryptoLine(sdp) {
    if (! window.mozRTCPeerConnection) {
      return sdp;
    }

    var sdpLinesIn = sdp.split('\r\n');
    var sdpLinesOut = [];

    // Search for m line.
    for (var i = 0; i < sdpLinesIn.length; i++) {
      sdpLinesOut.push(sdpLinesIn[i]);
      if (sdpLinesIn[i].search('m=') !== -1) {
        sdpLinesOut.push("a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
      }
    }

    sdp = sdpLinesOut.join('\r\n');
    return sdp;
  }

  function getUserMedia(options, success, failure) {
    failure = failure || function (error) {
      console.error("Error in getUserMedia:", error);
    };
    (navigator.getUserMedia ||
     navigator.mozGetUserMedia ||
     navigator.webkitGetUserMedia ||
     navigator.msGetUserMedia).call(navigator, options, success, failure);
  }

  /****************************************
   * getUserMedia Avatar support
   */

  session.on("ui-ready", function () {
    $("#togetherjs-self-avatar").click(function () {
      var avatar = peers.Self.avatar;
      if (avatar) {
        $preview.attr("src", avatar);
      }
      ui.displayToggle("#togetherjs-avatar-edit");
    });
    if (! session.RTCSupported) {
      $("#togetherjs-avatar-edit-rtc").hide();
    }

    var avatarData = null;
    var $preview = $("#togetherjs-self-avatar-preview");
    var $accept = $("#togetherjs-self-avatar-accept");
    var $cancel = $("#togetherjs-self-avatar-cancel");
    var $takePic = $("#togetherjs-avatar-use-camera");
    var $video = $("#togetherjs-avatar-video");
    var $upload = $("#togetherjs-avatar-upload");

    $takePic.click(function () {
      if (! streaming) {
        startStreaming();
        return;
      }
      takePicture();
    });

    function savePicture(dataUrl) {
      avatarData = dataUrl;
      $preview.attr("src", avatarData);
      $accept.attr("disabled", null);
    }

    $accept.click(function () {
      peers.Self.update({avatar:  avatarData});
      ui.displayToggle("#togetherjs-no-avatar-edit");
      // FIXME: these probably shouldn't be two elements:
      $("#togetherjs-participants-other").show();
      $accept.attr("disabled", "1");
    });

    $cancel.click(function () {
      ui.displayToggle("#togetherjs-no-avatar-edit");
      // FIXME: like above:
      $("#togetherjs-participants-other").show();
    });

    var streaming = false;
    function startStreaming() {
      getUserMedia({
          video: true,
          audio: false
        },
        function(stream) {
          streaming = true;
          $video[0].src = URL.createObjectURL(stream);
          $video[0].play();
        },
        function(err) {
          // FIXME: should pop up help or something in the case of a user
          // cancel
          console.error("getUserMedia error:", err);
        }
      );
    }

    function takePicture() {
      assert(streaming);
      var height = $video[0].videoHeight;
      var width = $video[0].videoWidth;
      width = width * (session.AVATAR_SIZE / height);
      height = session.AVATAR_SIZE;
      var $canvas = $("<canvas>");
      $canvas[0].height = session.AVATAR_SIZE;
      $canvas[0].width = session.AVATAR_SIZE;
      var context = $canvas[0].getContext("2d");
      context.arc(session.AVATAR_SIZE/2, session.AVATAR_SIZE/2, session.AVATAR_SIZE/2, 0, Math.PI*2);
      context.closePath();
      context.clip();
      context.drawImage($video[0], (session.AVATAR_SIZE - width) / 2, 0, width, height);
      savePicture($canvas[0].toDataURL("image/png"));
    }

    $upload.on("change", function () {
      var reader = new FileReader();
      reader.onload = function () {
        // FIXME: I don't actually know it's JPEG, but it's probably a
        // good enough guess:
        var url = "data:image/jpeg;base64," + util.blobToBase64(this.result);
        convertImage(url, function (result) {
          savePicture(result);
        });
      };
      reader.onerror = function () {
        console.error("Error reading file:", this.error);
      };
      reader.readAsArrayBuffer(this.files[0]);
    });

    function convertImage(imageUrl, callback) {
      var $canvas = $("<canvas>");
      $canvas[0].height = session.AVATAR_SIZE;
      $canvas[0].width = session.AVATAR_SIZE;
      var context = $canvas[0].getContext("2d");
      var img = new Image();
      img.src = imageUrl;
      // Sometimes the DOM updates immediately to call
      // naturalWidth/etc, and sometimes it doesn't; using setTimeout
      // gives it a chance to catch up
      setTimeout(function () {
        var width = img.naturalWidth || img.width;
        var height = img.naturalHeight || img.height;
        width = width * (session.AVATAR_SIZE / height);
        height = session.AVATAR_SIZE;
        context.drawImage(img, 0, 0, width, height);
        callback($canvas[0].toDataURL("image/png"));
      });
    }

  });

  /****************************************
   * RTC support
   */

  function audioButton(selector) {
    ui.displayToggle(selector);
    if (selector == "#togetherjs-audio-incoming") {
      $("#togetherjs-audio-button").addClass("togetherjs-animated").addClass("togetherjs-color-alert");
    } else {
      $("#togetherjs-audio-button").removeClass("togetherjs-animated").removeClass("togetherjs-color-alert");
    }
  }

  session.on("ui-ready", function () {
    $("#togetherjs-audio-button").click(function () {
      if ($("#togetherjs-rtc-info").is(":visible")) {
        windowing.hide();
        return;
      }
      if (session.RTCSupported) {
        enableAudio();
      } else {
        windowing.show("#togetherjs-rtc-not-supported");
      }
    });

    if (! session.RTCSupported) {
      audioButton("#togetherjs-audio-unavailable");
      return;
    }
    audioButton("#togetherjs-audio-ready");

    var audioStream = null;
    var accepted = false;
    var connected = false;
    var $audio = $("#togetherjs-audio-element");
    var offerSent = null;
    var offerReceived = null;
    var offerDescription = false;
    var answerSent = null;
    var answerReceived = null;
    var answerDescription = false;
    var _connection = null;
    var iceCandidate = null;

    function enableAudio() {
      accepted = true;
      storage.settings.get("dontShowRtcInfo").then(function (dontShow) {
        if (! dontShow) {
          windowing.show("#togetherjs-rtc-info");
        }
      });
      if (! audioStream) {
        startStreaming(connect);
        return;
      }
      if (! connected) {
        connect();
      }
      toggleMute();
    }

    ui.container.find("#togetherjs-rtc-info .togetherjs-dont-show-again").change(function () {
      storage.settings.set("dontShowRtcInfo", this.checked);
    });

    function error() {
      console.warn.apply(console, arguments);
      var s = "";
      for (var i=0; i<arguments.length; i++) {
        if (s) {
          s += " ";
        }
        var a = arguments[i];
        if (typeof a == "string") {
          s += a;
        } else {
          var repl;
          try {
            repl = JSON.stringify(a);
          } catch (e) {
          }
          if (! repl) {
            repl = "" + a;
          }
          s += repl;
        }
      }
      audioButton("#togetherjs-audio-error");
      // FIXME: this title doesn't seem to display?
      $("#togetherjs-audio-error").attr("title", s);
    }

    function startStreaming(callback) {
      getUserMedia(
        {
          video: false,
          audio: true
        },
        function (stream) {
          audioStream = stream;
          attachMedia("#togetherjs-local-audio", stream);
          if (callback) {
            callback();
          }
        },
        function (err) {
          // FIXME: handle cancel case
          if (err && err.code == 1) {
            // User cancel
            return;
          }
          error("getUserMedia error:", err);
        }
      );
    }

    function attachMedia(element, media) {
      element = $(element)[0];
      console.log("Attaching", media, "to", element);
      if (window.mozRTCPeerConnection) {
        element.mozSrcObject = media;
        element.play();
      } else {
        element.autoplay = true;
        element.src = URL.createObjectURL(media);
      }
    }

    function getConnection() {
      assert(audioStream);
      if (_connection) {
        return _connection;
      }
      try {
        _connection = makePeerConnection();
      } catch (e) {
        error("Error creating PeerConnection:", e);
        throw e;
      }
      _connection.onaddstream = function (event) {
        console.log("got event", event, event.type);
        attachMedia($audio, event.stream);
        audioButton("#togetherjs-audio-active");
      };
      _connection.onstatechange = function () {
        // FIXME: this doesn't seem to work:
        // Actually just doesn't work on Firefox
        console.log("state change", _connection.readyState);
        if (_connection.readyState == "closed") {
          audioButton("#togetherjs-audio-ready");
        }
      };
      _connection.onicecandidate = function (event) {
        if (event.candidate) {
          session.send({
            type: "rtc-ice-candidate",
            candidate: {
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
              candidate: event.candidate.candidate
            }
          });
        }
      };
      _connection.addStream(audioStream);
      return _connection;
    }

    function addIceCandidate() {
      if (iceCandidate) {
        console.log("adding ice", iceCandidate);
        _connection.addIceCandidate(new RTCIceCandidate(iceCandidate));
      }
    }

    function connect() {
      var connection = getConnection();
      if (offerReceived && (! offerDescription)) {
        connection.setRemoteDescription(
          new RTCSessionDescription({
            type: "offer",
            sdp: offerReceived
          }),
          function () {
            offerDescription = true;
            addIceCandidate();
            connect();
          },
          function (err) {
            error("Error doing RTC setRemoteDescription:", err);
          }
        );
        return;
      }
      if (! (offerSent || offerReceived)) {
        connection.createOffer(function (offer) {
          console.log("made offer", offer);
          offer.sdp = ensureCryptoLine(offer.sdp);
          connection.setLocalDescription(
            offer,
            function () {
              session.send({
                type: "rtc-offer",
                offer: offer.sdp
              });
              offerSent = offer;
              audioButton("#togetherjs-audio-outgoing");
            },
            function (err) {
              error("Error doing RTC setLocalDescription:", err);
            },
            mediaConstraints
          );
        }, function (err) {
          error("Error doing RTC createOffer:", err);
        });
      } else if (! (answerSent || answerReceived)) {
        // FIXME: I might have only needed this due to my own bugs, this might
        // not actually time out
        var timeout = setTimeout(function () {
          if (! answerSent) {
            error("createAnswer Timed out; reload or restart browser");
          }
        }, 2000);
        connection.createAnswer(function (answer) {
          answer.sdp = ensureCryptoLine(answer.sdp);
          clearTimeout(timeout);
          connection.setLocalDescription(
            answer,
            function () {
              session.send({
                type: "rtc-answer",
                answer: answer.sdp
              });
              answerSent = answer;
            },
            function (err) {
              clearTimeout(timeout);
              error("Error doing RTC setLocalDescription:", err);
            },
            mediaConstraints
          );
        }, function (err) {
          error("Error doing RTC createAnswer:", err);
        });
      }
    }

    function toggleMute() {
      // FIXME: implement.  Actually, wait for this to be implementable - currently
      // muting of localStreams isn't possible
      // FIXME: replace with hang-up?
    }

    session.hub.on("rtc-offer", function (msg) {
      if (offerReceived || answerSent || answerReceived || offerSent) {
        abort();
      }
      offerReceived = msg.offer;
      if (! accepted) {
        audioButton("#togetherjs-audio-incoming");
        return;
      }
      function run() {
        var connection = getConnection();
        connection.setRemoteDescription(
          new RTCSessionDescription({
            type: "offer",
            sdp: offerReceived
          }),
          function () {
            offerDescription = true;
            addIceCandidate();
            connect();
          },
          function (err) {
            error("Error doing RTC setRemoteDescription:", err);
          }
        );
      }
      if (! audioStream) {
        startStreaming(run);
      } else {
        run();
      }
    });

    session.hub.on("rtc-answer", function (msg) {
      if (answerSent || answerReceived || offerReceived || (! offerSent)) {
        abort();
        // Basically we have to abort and try again.  We'll expect the other
        // client to restart when appropriate
        session.send({type: "rtc-abort"});
        return;
      }
      answerReceived = msg.answer;
      assert(offerSent);
      assert(audioStream);
      var connection = getConnection();
      connection.setRemoteDescription(
        new RTCSessionDescription({
          type: "answer",
          sdp: answerReceived
        }),
        function () {
          answerDescription = true;
          // FIXME: I don't think this connect is ever needed?
          connect();
        },
        function (err) {
          error("Error doing RTC setRemoteDescription:", err);
        }
      );
    });

    session.hub.on("rtc-ice-candidate", function (msg) {
      iceCandidate = msg.candidate;
      if (offerDescription || answerDescription) {
        addIceCandidate();
      }
    });

    session.hub.on("rtc-abort", function (msg) {
      abort();
      if (! accepted) {
        return;
      }
      if (! audioStream) {
        startStreaming(function () {
          connect();
        });
      } else {
        connect();
      }
    });

    session.hub.on("hello", function (msg) {
      // FIXME: displayToggle should be set due to
      // _connection.onstatechange, but that's not working, so
      // instead:
      audioButton("#togetherjs-audio-ready");
      if (accepted && (offerSent || answerSent)) {
        abort();
        connect();
      }
    });

    function abort() {
      answerSent = answerReceived = offerSent = offerReceived = null;
      answerDescription = offerDescription = false;
      _connection = null;
      $audio[0].removeAttribute("src");
    }

  });

  return webrtc;

});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
define('who',["util", "channels", "session", "ui"], function (util, channels, session, ui) {
  var assert = util.assert;
  var who = util.Module("who");
  var MAX_RESPONSE_TIME = 5000;
  var MAX_LATE_RESPONSE = 2000;

  who.getList = function (hubUrl) {
    return util.Deferred(function (def) {
      var expected;
      var channel = channels.WebSocketChannel(hubUrl);
      var users = {};
      var responded = 0;
      var firstResponse = 0;
      var lateResponseTimeout;
      channel.onmessage = function (msg) {
        if (msg.type == "init-connection") {
          expected = msg.peerCount;
        }
        if (msg.type == "who") {
          // Our message back to ourselves probably
          firstResponse = setTimeout(function () {
            close();
          }, MAX_LATE_RESPONSE);
        }
        if (msg.type == "hello-back") {
          if (! users[msg.clientId]) {
            users[msg.clientId] = who.ExternalPeer(msg.clientId, msg);
            responded++;
            if (expected && responded >= expected) {
              close();
            } else {
              def.notify(users);
            }
          }
        }
        console.log("users", users);
      };
      channel.send({
        type: "who",
        "server-echo": true,
        clientId: null
      });
      var timeout = setTimeout(function () {
        close();
      }, MAX_RESPONSE_TIME);
      function close() {
        if (timeout) {
          clearTimeout(timeout);
        }
        if (lateResponseTimeout) {
          clearTimeout(lateResponseTimeout);
        }
        channel.close();
        def.resolve(users);
      }
    });
  };

  who.invite = function (hubUrl, clientId) {
    return util.Deferred(function (def) {
      var channel = channels.WebSocketChannel(hubUrl);
      var id = util.generateId();
      channel.onmessage = function (msg) {
        if (msg.type == "invite" && msg.inviteId == id) {
          channel.close();
          def.resolve();
        }
      };
      var userInfo = session.makeHelloMessage(false);
      delete userInfo.type;
      userInfo.clientId = session.clientId;
      channel.send({
        type: "invite",
        inviteId: id,
        url: session.shareUrl(),
        userInfo: userInfo,
        forClientId: clientId,
        clientId: null,
        "server-echo": true
      });
    });
  };

  who.ExternalPeer = util.Class({
    isSelf: false,
    isExternal: true,
    constructor: function (id, attrs) {
      attrs = attrs || {};
      assert(id);
      this.id = id;
      this.identityId = attrs.identityId || null;
      this.status = attrs.status || "live";
      this.idle = attrs.status || "active";
      this.name = attrs.name || null;
      this.avatar = attrs.avatar || null;
      this.color = attrs.color || "#00FF00";
      this.lastMessageDate = 0;
      this.view = ui.PeerView(this);
    },

    className: function (prefix) {
      prefix = prefix || "";
      return prefix + util.safeClassName(this.id);
    }

  });

  return who;
});

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http:// mozilla.org/MPL/2.0/. */

define('youtubeVideos',["jquery", "util", "session", "elementFinder"],
function ($, util, session, elementFinder) {

  // constant var to indicate whether two players are too far apart in sync
  var TOO_FAR_APART = 3000;
  // embedded youtube iframes
  var youTubeIframes = [];
  // youtube API load delay
  var API_LOADING_DELAY = 2000;

  session.on("reinitialize", function () {
    if (TogetherJS.config.get("youtube")) {
      prepareYouTube();
    }
  });

  session.on("close", function () {
    $(youTubeIframes).each(function (i, iframe) {
      // detach players from iframes
      $(iframe).removeData("togetherjs-player");
      $(iframe).removeData("dontPublish");
      $(iframe).removeData("currentVideoId");
      // disable iframeAPI
      $(iframe).removeAttr("enablejsapi");
      // remove unique youtube iframe indicators
      var id = $(iframe).attr("id") || "";
      if (id.indexOf("youtube-player") === 0) {
        // An id we added
        $(iframe).removeAttr("id");
      }
      youTubeIframes = [];
    });
  });

  TogetherJS.config.track("youtube", function (track, previous) {
    if (track && ! previous) {
      prepareYouTube();
      // You can enable youtube dynamically, but can't turn it off:
      TogetherJS.config.close("youtube");
    }
  });

  function prepareYouTube() {
    // setup iframes first
    setupYouTubeIframes();

    // this function should be global so it can be called when API is loaded
    window.onYouTubeIframeAPIReady = function() {
      // YouTube API is ready
      $(youTubeIframes).each(function (i, iframe) {
        var player = new YT.Player(iframe.id, { // get the reference to the already existing iframe
          events: {
            'onReady': insertPlayer,
            'onStateChange': publishPlayerStateChange
          }
        });
      });
    };

    if (window.YT === undefined) {
      // load necessary API
      // it calls onYouTubeIframeAPIReady automatically when the API finishes loading
      var tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      // manually invoke APIReady function when the API was already loaded by user
      onYouTubeIframeAPIReady();
    }

    // give each youtube iframe a unique id and set its enablejsapi param to true
    function setupYouTubeIframes() {
      var iframes = $('iframe');
      iframes.each(function (i, iframe) {
        // if the iframe's unique id is already set, skip it
        // FIXME: what if the user manually sets an iframe's id (i.e. "#my-youtube")?
        // maybe we should set iframes everytime togetherjs is reinitialized?
        if (($(iframe).attr("src") || "").indexOf("youtube") != -1 && !$(iframe).attr("id")) {
          $(iframe).attr("id", "youtube-player"+i);
          $(iframe).attr("enablejsapi", 1);
          youTubeIframes[i] = iframe;
        }
      });
    } // iframes are ready

    function insertPlayer(event) {
      // only when it is READY, attach a player to its iframe
      var currentPlayer = event.target;
      var currentIframe = currentPlayer.a;
      // check if a player is already attached in case of being reinitialized
      if (!$(currentIframe).data("togetherjs-player")) {
        $(currentIframe).data("togetherjs-player", currentPlayer);
        // initialize its dontPublish flag as well
        $(currentIframe).data("dontPublish", false);
        // store its current video's id
        var currentVideoId = getVideoIdFromUrl(currentPlayer.getVideoUrl());
        $(currentIframe).data("currentVideoId", currentVideoId);
      }
    }
  } // end of prepareYouTube

  function publishPlayerStateChange(event) {
    var target = event.target; 
    var currentIframe = target.a;
    // FIXME: player object retrieved from event.target has an incomplete set of essential functions
    // this is most likely due to a recently-introduced problem with current YouTube API as others have been reporting the same issue (12/18/`13)
    //var currentPlayer = target;
    //var currentTime = currentPlayer.getCurrentTime();
    var currentPlayer = $(currentIframe).data("togetherjs-player");
    var currentTime = target.k.currentTime;
    var iframeLocation = elementFinder.elementLocation(currentIframe);

    if ($(currentPlayer).data("seek")) {
      $(currentPlayer).removeData("seek");
      return;
    }

    // do not publish if playerState was changed by other users
    if ($(currentIframe).data("dontPublish")) {
      // make it false again so it can start publishing events of its own state changes
      $(currentIframe).data("dontPublish", false);
      return;
    }

    // notify other people that I changed the player state
    if (event.data == YT.PlayerState.PLAYING) {

      var currentVideoId = isDifferentVideoLoaded(currentIframe);
      if (currentVideoId) {
        // notify that I just loaded another video
        publishDifferentVideoLoaded(iframeLocation, currentVideoId);
        // update current video id
        $(currentIframe).data("currentVideoId", currentVideoId);
      } else {
        session.send({
          type: "playerStateChange",
          element: iframeLocation,
          playerState: 1,
          playerTime: currentTime
        });
      }
    } else if (event.data == YT.PlayerState.PAUSED) {
      session.send({
        type: "playerStateChange",
        element: iframeLocation,
        playerState: 2,
        playerTime: currentTime
      });
    } else {
      // do nothing when the state is buffering, cued, or ended
      return;
    }
  }

  function publishDifferentVideoLoaded(iframeLocation, videoId) {
    session.send({
      type: "differentVideoLoaded",
      videoId: videoId,
      element: iframeLocation
    });
  }

  session.hub.on('playerStateChange', function (msg) {
    var iframe = elementFinder.findElement(msg.element);
    var player = $(iframe).data("togetherjs-player");
    var currentTime = player.getCurrentTime();
    var currentState = player.getPlayerState();

    if (currentState != msg.playerState) {
      $(iframe).data("dontPublish", true);
    }

    if (msg.playerState == 1) {
      player.playVideo();
      // seekTo() updates the video's time and plays it if it was already playing
      // and pauses it if it was already paused
      if (areTooFarApart(currentTime, msg.playerTime)) {
        player.seekTo(msg.playerTime, true);
      }
    } else if (msg.playerState == 2) {
      // When YouTube videos are advanced while playing,
      // Chrome: pause -> pause -> play (onStateChange is called even when it is from pause to pause)
      // FireFox: buffering -> play -> buffering -> play
      // We must prevent advanced videos from going out of sync
      player.pauseVideo();
      if (areTooFarApart(currentTime, msg.playerTime)) {
        // "seek" flag will help supress publishing unwanted state changes
        $(player).data("seek", true);
        player.seekTo(msg.playerTime, true);
      }
    }
  });

  // if a late user joins a channel, synchronize his videos
  session.hub.on('hello', function () {
    // wait a couple seconds to make sure the late user has finished loading API
    setTimeout(synchronizeVideosOfLateGuest, API_LOADING_DELAY);
  });

  session.hub.on('synchronizeVideosOfLateGuest', function (msg) {
    var iframe = elementFinder.findElement(msg.element);
    var player = $(iframe).data("togetherjs-player");
    // check if another video had been loaded to an existing iframe before I joined
    var currentVideoId = $(iframe).data("currentVideoId");
    if (msg.videoId != currentVideoId) {
      $(iframe).data("currentVideoId", msg.videoId);
      player.loadVideoById(msg.videoId, msg.playerTime, 'default');
    } else {
      // if the video is only cued, I do not have to do anything to sync
      if (msg.playerState != 5) {
        player.seekTo(msg.playerTime, true);
      }
    }
  });

  session.hub.on('differentVideoLoaded', function (msg) {
    // load a new video if the host has loaded one
    var iframe = elementFinder.findElement(msg.element);
    var player = $(iframe).data("togetherjs-player");
    player.loadVideoById(msg.videoId, 0, 'default');
    $(iframe).data("currentVideoId", msg.videoId);

  });

  function synchronizeVideosOfLateGuest() {
    youTubeIframes.forEach(function (iframe) {
      var currentPlayer = $(iframe).data("togetherjs-player");
      var currentVideoId = getVideoIdFromUrl(currentPlayer.getVideoUrl());
      var currentState = currentPlayer.getPlayerState();
      var currentTime = currentPlayer.getCurrentTime();
      var iframeLocation = elementFinder.elementLocation(iframe);
      session.send({
        type: "synchronizeVideosOfLateGuest",
        element: iframeLocation,
        videoId: currentVideoId,
        playerState: currentState, //this might be necessary later
        playerTime: currentTime
      });
    });
  }

  function isDifferentVideoLoaded(iframe) {
    var lastVideoId = $(iframe).data("currentVideoId");
    var currentPlayer = $(iframe).data("togetherjs-player");
    var currentVideoId = getVideoIdFromUrl(currentPlayer.getVideoUrl());

    // since url forms of iframe src and player's video url are different,
    // I have to compare the video ids
    if (currentVideoId != lastVideoId) {
      return currentVideoId;
    } else {
      return false;
    }
  }

  // parses videoId from the url returned by getVideoUrl function
  function getVideoIdFromUrl(videoUrl) {
    var videoId = videoUrl.split('v=')[1];
    //Chrome and Firefox have different positions for parameters
    var ampersandIndex = videoId.indexOf('&');
    if (ampersandIndex != -1) {
      videoId = videoId.substring(0, ampersandIndex);
    }
    return videoId;
  }

  function areTooFarApart(myTime, theirTime) {
    var secDiff = Math.abs(myTime - theirTime);
    var milliDiff = secDiff * 1000;
    return milliDiff > TOO_FAR_APART;
  }
});
TogetherJS.require = TogetherJS._requireObject = require;
TogetherJS._loaded = true;
require(["session"]);
}());