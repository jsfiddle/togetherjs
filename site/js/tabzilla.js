/**
 * Tabzilla global navigation for Mozilla projects
 *
 * This code is licensed under the Mozilla Public License 1.1.
 *
 * Portions adapted from the jQuery Easing plugin written by Robert Penner and
 * used under the following license:
 *
 *   Copyright 2001 Robert Penner
 *   All rights reserved.
 *
 *   Redistribution and use in source and binary forms, with or without
 *   modification, are permitted provided that the following conditions are
 *   met:
 *
 *   - Redistributions of source code must retain the above copyright notice,
 *     this list of conditions and the following disclaimer.
 *   - Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *   - Neither the name of the author nor the names of contributors may be
 *     used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 *   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 *   "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 *   TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 *   PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *   CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *   EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *   PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 *   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 *   Media query matchMedia polyfill implementation from Paul Irish
 *   (https://github.com/paulirish/matchMedia.js/) used under the following
 *   license (MIT):
 *
 *   Copyright (c) 2012 Scott Jehl
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to
 *   deal in the Software without restriction, including without limitation the
 *   rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 *   sell copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 *   THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *   DEALINGS IN THE SOFTWARE.
 *
 *
 * @copyright 2012-2013 silverorange Inc.
 * @license   https://www.mozilla.org/MPL/1.1/ Mozilla Public License 1.1
 * @author    Michael Gauthier <mike@silverorange.com>
 * @author    Steven Garrity <steven@silverorange.com>
 * @author    Isac Lagerblad <icaaaq@gmail.com>
 * @author    Kohei Yoshino <kohei.yoshino@gmail.com>
 */

 // Load mwc 2014 strings from mwc2014_promos.lang only for the locales we target

var Tabzilla = (function (Tabzilla) {
    'use strict';
    var minimumJQuery = '1.7.1';
    var panel;
    var nav;
    var headlines;
    var tab;
    var opened = false;
    var hasMediaQueries = ('matchMedia' in window);
    var isIE9 = (document.documentMode === 9);
    var mode = 'wide';
    var negativeTabIndex = '-1';
    var $ = null; // non-version-conflicting jQuery alias for tabzilla
    var jQuery;
    var checkMode = function () {
        var currentMode = getMode();
        if (mode !== currentMode) {
            mode = currentMode;
            setMode();
        }
    };
    var getMode = function() {
        if (hasMediaQueries && matchMedia('(max-width: 719px)').matches) {
            return 'compact';
        }
        return 'wide';
    };
    var setMode = function () {
        if (mode === 'wide') {
            leaveCompactMode();
        } else {
            enterCompactMode();
        }
    };
    var leaveCompactMode = function () {
        removeCompactModeAttributes();
        removeCompactModeEvents();
        panel.focus();
    };
    var enterCompactMode = function () {
        addCompactModeAttributes();
        addCompactModeEvents();
    };
    var addCompactModeAttributes = function () {
        nav.find('>ul').attr('role', 'presentation');

        headlines.each(function (i) {
            $(this).attr({
                'id': 'tab-' + i,
                'aria-controls': 'panel-' + i,
                'tabindex': negativeTabIndex,
                'role': 'tab',
                'aria-expanded': false
            });
        });
        if (!nav.find('h2[tabindex=0]').length) {
            nav.find('h2:first').attr('tabindex', 0);
        }
        nav.find('div').each(function (i) {
            $(this).attr({
                'id': 'panel-' + i,
                'aria-labeledby': 'tab-' + i,
                'role': 'tabpanel'
            }).css('display','none');
        });
    };
    var removeCompactModeAttributes = function () {
        nav.find('>ul').removeAttr('role');
        headlines.removeAttr('id aria-controls tabindex role aria-expanded');
        nav.find('div').removeAttr('id aria-labeledby role style');
    };
    var addCompactModeEvents = function () {
        nav.on('click.submenu', 'h2', function (event) {
            event.preventDefault();
            var div = $(event.target).next('div');
            $(event.target).attr('aria-expanded', div.is(':hidden'));
            div.toggle();
        });
        nav.on('keydown.submenu', function (event) {
            var which = event.which;
            var target = $(event.target);
            // search
            if (target.is('input')) {
                return true;
            }
            // enter or space
            if (which === 13 || which === 32) {
                event.preventDefault();
                target.trigger('click');
            }
            // up or left
            if (which === 37 || which === 38) {
                event.preventDefault();
                headlines.each(function (i) {
                    if (i > 0 && $(this).attr('tabindex') === 0) {
                        $(this).attr('tabindex', negativeTabIndex);
                        $(headlines[i - 1]).attr('tabindex', 0).focus();
                        return false;
                    }
                });
            }
            // down or right
            if (which === 40 || which === 39) {
                event.preventDefault();
                headlines.each(function (i) {
                    if (i < (headlines.length - 1) && $(this).attr('tabindex') === 0) {
                        $(this).attr('tabindex', negativeTabIndex);
                        $(headlines[i + 1]).attr('tabindex', 0).focus();
                        return false;
                    }
                });
            }
            // esc
            if (which === 27 && target.is('a')) {
                event.preventDefault();
                event.stopPropagation();
                target.parents('div').prev('h2').trigger('click').focus();
            }
        });
    };
    var removeCompactModeEvents = function () {
        nav.off('.submenu');
    };
    Tabzilla.open = function () {
        opened = true;
        panel.toggleClass('open');
        var height = $('#tabzilla-contents').height();
        panel.animate({'height': height}, 200, function () {
            panel.css('height', 'auto');
        });
        tab
            .attr({'aria-expanded' : 'true'})
            .addClass('tabzilla-opened')
            .removeClass('tabzilla-closed');

        panel.focus();

        return panel;
    };
    Tabzilla.close = function () {
        opened = false;
        panel.animate({height: 0}, 200, function () {
            panel.toggleClass('open');
        });

        tab
            .attr({'aria-expanded' : 'false'})
            .addClass('tabzilla-closed')
            .removeClass('tabzilla-opened');

        return tab;
    };
    Tabzilla.compareVersion = function (a, b) {
        var num1, num2;
        a = ('' + a).split('.');
        b = ('' + b).split('.');
        while (a.length < b.length) { a.push('0'); }
        while (b.length < a.length) { b.push('0'); }
        for (var i = 0; i < a.length; i++) {
            num1 = parseInt(a[i], 10);
            num2 = parseInt(b[i], 10);
            if (num1 > num2) { return 1; }
            if (num1 < num2) { return -1; }
        }
        return 0;
    };
    // Changing this pref name causes the easter egg to reappear, requires a
    // fresh disable. Might be handy if or when the message is changed.
    Tabzilla.EASTER_EGG_PREF_NAME = 'tabzilla.showEasterEgg.careersTeaser';
    Tabzilla.disableEasterEgg = function () {
        try {
            localStorage.setItem(this.EASTER_EGG_PREF_NAME, 'false');
        } catch (ex) {}
    };
    Tabzilla.enableEasterEgg = function () {
        try {
            localStorage.setItem(this.EASTER_EGG_PREF_NAME, 'true');
        } catch (ex) {}
    };
    Tabzilla.shouldShowEasterEgg = function () {
        try {
            return (localStorage.getItem(this.EASTER_EGG_PREF_NAME) !== 'false');
        } catch (ex) {
            // HACK: If there's an exception in getting a localStorage item,
            // then the support is probably not there. Err on the side of not
            // showing the easter egg, since it can't be turned off.
            return false;
        }
    };
    var Infobar = function (id, name) {
        this.id = id;
        this.name = name;
        this.disabled = false;
        this.prefName = 'tabzilla.infobar.' + id + '.disabled';

        // Read the preference
        try {
            if (sessionStorage.getItem(this.prefName) === 'true') {
                this.disabled = true;
            }
        } catch (ex) {}

        // If there is already another infobar, don't show this
        if ($('#tabzilla-infobar').length) {
            this.disabled = true;
        }
    };
    Infobar.prototype.show = function (str) {
        // A infobar can be disabled by pref.
        // And check the existence of another infobar again
        if (this.disabled || $('#tabzilla-infobar').length) {
            return;
        }

        var self = this;
        var bar = self.element = $(
          '<div id="tabzilla-infobar" class="' + self.id + '" role="dialog"><div>'
        + '<p>' + str.message + '</p><ul>'
        + '<li><button class="btn-accept" type="button">' + str.accept + '</button></li>'
        + '<li><button class="btn-cancel" type="button">' + str.cancel + '</button></li>'
        + '</ul></div></div>').prependTo(panel);

        bar.find('.btn-accept').click(function (event) {
            event.preventDefault();

            if (self.onaccept.callback) {
                self.onaccept.callback();
            }

            self.hide();
        });

        bar.find('.btn-cancel').click(function (event) {
            event.preventDefault();

            if (self.oncancel.callback) {
                self.oncancel.callback();
            }

            self.hide();
            try {
                sessionStorage.setItem(self.prefName, 'true');
            } catch (ex) {}
        });

        panel.trigger('infobar-showing');

        if (self.onshow.callback) {
            self.onshow.callback();
        }

        if (opened) {
            bar.css('height', 0)
               .animate({'height': bar.find('div').outerHeight()}, 200,
                        function () { panel.trigger('infobar-shown'); });
        } else {
            panel.animate({'height': bar.height()}, 200,
                          function () { panel.trigger('infobar-shown'); });
        }

        return bar;
    };
    Infobar.prototype.hide = function () {
        var self = this;
        var target = (opened) ? self.element : panel;

        panel.trigger('infobar-hiding');

        target.animate({'height': 0}, 200, function () {
            self.element.remove();
            panel.trigger('infobar-hidden');
        });
    };
    Infobar.prototype.onshow = {};
    Infobar.prototype.onaccept = {};
    Infobar.prototype.oncancel = {};
    Infobar.translation = function (userLangs, pageLang) {
        var transbar = new Infobar('transbar', 'Translation Bar');

        // Note that navigator.language doesn't always work because it's just
        // the application's locale on some browsers. navigator.languages has
        // not been widely implemented yet, but the new property provides an
        // array of the user's accept languages that we'd like to see.
        userLangs = userLangs || navigator.languages;
        pageLang = pageLang || document.documentElement.lang;

        if (transbar.disabled || !userLangs || !pageLang) {
            return false;
        }

        // Normalize the user language in the form of ab or ab-CD
        var normalize = function (lang) {
            return lang.replace(/^(\w+)(?:-(\w+))?$/, function (m, p1, p2) {
                return p1.toLowerCase() + ((p2) ? '-' + p2.toUpperCase() : '');
            });
        };

        // Normalize every language for easier comparison
        userLangs = $.map(userLangs, function (lang) { return normalize(lang); });
        pageLang = normalize(pageLang);

        // If the page language is the user's primary language, there is nothing
        // to do here
        if (pageLang === userLangs[0]) {
            return false;
        }

        var offeredLang;
        var availableLangs = {};
        var $links = $('link[hreflang]');
        var $options = $('#page-language-select option');

        // Make a dictionary from alternate URLs or a language selector. The key
        // is a language, the value is the relevant <link> or <option> element.
        // If those lists cannot be found, there is nothing to do
        if ($links.length) {
            $links.each(function () {
                availableLangs[normalize(this.hreflang)] = this;
            });
        } else if ($options.length) {
            $options.each(function () {
                availableLangs[normalize(this.value.match(/^\/?([\w\-]+)/)[1])] = this;
            });
        } else {
            return false;
        }

        // Compare the user's accept languages against the page's current
        // language and other available languages to find the best language
        $.each(userLangs, function(index, userLang) {
            if (pageLang === userLang || pageLang === userLang.split('-')[0]) {
                offeredLang = 'self';
                return false; // Break the loop
            }

            if (userLang in availableLangs) {
                offeredLang = userLang;
                return false; // Break the loop
            }
        });

        // If the page language is one of the user's secondary languages and no
        // other higher-priority language cannot be found in the translations,
        // there is nothing to do
        if (offeredLang === 'self') {
            return false;
        }

        // If an offered language cannot be detected, try again with shorter
        // language names, like en-US -> en, fr-FR -> fr
        if (!offeredLang) {
            $.each(userLangs, function(index, userLang) {
                userLang = userLang.split('-')[0];

                if (userLang in availableLangs) {
                    offeredLang = userLang;
                    return false; // Break the loop
                }
            });
        }

        // If there is no offered language yet, there is nothing to do
        if (!offeredLang) {
            return false;
        }

        // Do not show Chrome's built-in Translation Bar
        $('head').append('<meta name="google" value="notranslate">');

        // Log the language of the current page
        transbar.onshow.trackLabel = transbar.oncancel.trackLabel = offeredLang;
        transbar.oncancel.trackAction = 'hide';

        // If the user selects Yes, show the translated page
        transbar.onaccept = {
            trackAction: 'change',
            trackLabel: offeredLang,
            callback: function () {
                var element = availableLangs[offeredLang];

                if (element.form) { // <option>
                    element.selected = true;
                    element.form.submit();
                } else { // <link>
                    location.href = element.href.replace(/^https?\:\/\/[^/]+/, '');
                }
            }
        };

        // Fetch the localized strings and show the Translation Bar
        $.ajax({ url: '/' + offeredLang + '/tabzilla/transbar.jsonp',
                 cache: true, crossDomain: true, dataType: 'jsonp',
                 jsonpCallback: "_", success: function (str) {
            transbar.show(str).attr({
                'lang': offeredLang,
                'dir': ($.inArray(offeredLang, ['he', 'ar', 'fa', 'ur']) > -1) ? 'rtl' : 'ltr'
            });
        }});

        return offeredLang;
    };
    Infobar.update = function (latestVersion, ua, buildID) {
        latestVersion = parseInt(latestVersion || '50.1.0', 10);
        ua = ua || navigator.userAgent;
        buildID = buildID || navigator.buildID;

        var updatebar = new Infobar('updatebar', 'Update Bar');
        var isFirefox = ((/\sFirefox\/\d+/).test(ua) &&
                         !(/like\ Firefox|Iceweasel|SeaMonkey/i).test(ua)); // Exclude Camino and others
        var isMobile = (/Mobile|Tablet|Fennec/i).test(ua);
        var userVersion = (isFirefox) ? parseInt(ua.match(/Firefox\/(\d+)/)[1], 10) : 0;
        var isFirefox31ESR = !isMobile && userVersion === 31 && buildID && buildID !== '20140716183446';
        var showInfobar = function () {
            if ($('body').data('defaultSlug') === 'update-firefox-latest-version') {
                // Don't show the info bar on the page that the info bar sends the user to.
                return;
            }
            // If the user accepts, show the SUMO article
            updatebar.onaccept.callback = function () {
                location.href = 'https://web.archive.org/web/20170131225541/https://support.mozilla.org/en-US/kb/update-firefox-latest-version';
            };

            // Log the used Firefox version
            updatebar.onshow.trackLabel = updatebar.onaccept.trackLabel
                                        = updatebar.oncancel.trackLabel
                                        = String(userVersion);

            // The message and accept strings are the same as /firefox/new/
            updatebar.show({
                message: 'Looks like you\u2019re using an older version of Firefox.',
                accept: 'Update to stay fast and safe.',
                cancel: 'Later'
            });
        };

        if (updatebar.disabled || !isFirefox || isMobile || isFirefox31ESR ||
                userVersion > latestVersion) {
            return false;
        }

        // Show the Update Bar if the user's major version is older than 3 major
        // versions. Once the Mozilla.UITour API starts providing the channel
        // info (Bug 1065525, Firefox 35+), we can show the Bar only to Release
        // channel users. 31 ESR can be detected only with the navigator.buildID
        // property. 20140716183446 is the non-ESR build ID that can be found at
        // https://wiki.mozilla.org/Releases/Firefox_31/Test_Plan
        if (userVersion < latestVersion - 2) {
            showInfobar();

            return true;
        }

        return false;
    };
    // Expose the object for the tests
    Tabzilla.infobar = Infobar;
    var addEaseInOut = function () {
        $.extend($.easing, {
            'easeInOut':  function (x, t, b, c, d) {
                if (( t /= d / 2) < 1) {
                    return c / 2 * t * t + b;
                }
                return -c / 2 * ((--t) * (t - 2) - 1) + b;
            }
        });
    };
    var addMatchMediaPolyfill = function () {
        window.matchMedia = window.matchMedia || (function( doc, undefined ) {
            var bool;
            var docElem = doc.documentElement;
            var refNode = docElem.firstElementChild || docElem.firstChild;
            // fakeBody required for <FF4 when executed in <head>
            var fakeBody = doc.createElement( "body" );
            var div = doc.createElement( "div" );

            div.id = "mq-test-1";
            div.style.cssText = "position:absolute;top:-100em";
            fakeBody.style.background = "none";
            fakeBody.appendChild(div);

            return function(q){
                div.innerHTML = "&shy;<style media=\"" + q + "\"> #mq-test-1 { width: 42px; }</style>";
                docElem.insertBefore( fakeBody, refNode );
                bool = div.offsetWidth === 42;
                docElem.removeChild( fakeBody );
                return {
                    matches: bool,
                    media: q
                };
            };
        }( document ));
    };
    var init = function () {
        $('body').prepend(content);
        tab = $('#tabzilla');
        panel = $('#tabzilla-panel');
        nav = $('#tabzilla-nav');
        headlines = nav.find('h2');

        if (isIE9 && !hasMediaQueries) {
            addMatchMediaPolyfill();
            hasMediaQueries = true;
        }

        addEaseInOut();

        checkMode();
        $(window).on('resize', function () {
            checkMode();
        });

        panel.on('keydown', function (event) {
            if (event.which === 27) {
                event.preventDefault();
                Tabzilla.close();
                tab.focus();
            }
        });

        tab.attr('aria-label', 'Mozilla links');

        tab.on('click', function (event) {
            event.preventDefault();
            if (opened) {
                Tabzilla.close();
            } else {
                Tabzilla.open();
            }
        });

        $.each((tab.data('infobar') || '').split(' '), function (index, value) {
            var setup = Infobar[value];
            if (setup) {
                setup.call();
            }
        });

        // Careers teaser in error console.
        $(window).load(function() {
            try {
                console.log("The version of Tabzilla you are using is deprecated and will be removed in the future.\n\nPlease update to the new static version here: https://github.com/mozilla/tabzilla/");
            } catch(e) {}
        });
    };
    var loadJQuery = function (callback) {
        var noConflictCallback = function() {
            // set non-conflicting version local aliases
            jQuery = window.jQuery.noConflict(true);
            $ = jQuery;
            callback.call();
        };
        var script = document.createElement("script");
        if (script.readyState) {
            script.onreadystatechange = function () {
                if (script.readyState === "loaded" || script.readyState === "complete") {
                    script.onreadystatechange = null;
                    noConflictCallback.call();
                }
            };
        } else {
            script.onload = noConflictCallback;
        }
        script.src = '//web.archive.org/web/20170131225541/https://mozorg.cdn.mozilla.net/media/js/libs/jquery-' + minimumJQuery + '.min.js';
        document.getElementsByTagName('head')[0].appendChild(script);
    };
    // icn=tabz appended to links for Google Analytics purposes
    var content =
      '<div id="tabzilla-panel" class="tabzilla-closed" tabindex="-1">'
    + '  <div id="tabzilla-contents">'
    + '    <div id="tabzilla-promo">'
            + '      <div class="snippet" id="tabzilla-promo-gear">'
    + '        <a href="https://web.archive.org/web/20170131225541/https://gear.mozilla.org/?ref=OMG_launch&amp;utm_campaign=OMG_launch&amp;utm_source=gear.mozilla.org&amp;utm_medium=referral&amp;utm_content=tabzilla">'
    + '          <h4>Official Mozilla gear is here</h4>'
    + '        </a>'
    + '      </div>'
            + '    </div>'
    + '    <div id="tabzilla-nav">'
    + '      <ul>'
    + '        <li><h2>Mozilla</h2>'
    + '          <div>'
    + '            <ul>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://www.mozilla.org/mission/?icn=tabz">Mission</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://www.mozilla.org/about/?icn=tabz">About</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://support.mozilla.org/?icn=tabz">Support</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://developer.mozilla.org/?icn=tabz">Developer Network</a></li>'
    + '            </ul>'
    + '          </div>'
    + '        </li>'
    + '        <li><h2>Products</h2>'
    + '          <div>'
    + '            <ul>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://www.mozilla.org/firefox/products?icn=tabz">Firefox</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://www.mozilla.org/thunderbird/?icn=tabz">Thunderbird</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://www.mozilla.org/firefox/os/?icn=tabz">Firefox OS</a></li>'
    + '            </ul>'
    + '          </div>'
    + '        </li>'
    + '        <li><h2>Innovations</h2>'
    + '          <div>'
    + '            <ul>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://webmaker.org/?icn=tabz">Webmaker</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://www.mozilla.org/research/?icn=tabz">Research</a></li>'
    + '            </ul>'
    + '          </div>'
    + '        </li>'
    + '        <li><h2>Get Involved</h2>'
    + '          <div>'
    + '            <ul>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://www.mozilla.org/contribute/?icn=tabz">Volunteer</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://careers.mozilla.org/?icn=tabz">Careers</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://www.mozilla.org/en-US/about/mozilla-spaces/?icn=tabz">Find us</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://donate.mozilla.org/en-US/?presets=100,50,25,15&amp;amount=50&amp;ref=EOYFR2015&amp;utm_campaign=EOYFR2015&amp;utm_source=mozilla.org&amp;utm_medium=referral&amp;utm_content=mozillaorg_tabzillaTXT&amp;currency=usd&icn=tabz" class="donate">Donate</a></li>'
    + '              <li><a href="https://web.archive.org/web/20170131225541/https://www.mozilla.org/about/partnerships/?icn=tabz">Partner</a></li>'
    + '            </ul>'
    + '          </div>'
    + '        </li>'
    + '        <li id="tabzilla-search">'
    + '          <a href="https://web.archive.org/web/20170131225541/https://wiki.mozilla.org/Websites/Directory?icn=tabz">Website Directory</a>'
    + '          <form title="Search Mozilla sites" role="search" action="https://web.archive.org/web/20170131225541/https://www.google.com/cse">'
    + '            <input type="hidden" value="002443141534113389537:ysdmevkkknw" name="cx">'
    + '            <input type="hidden" value="FORID:0" name="cof">'
    + '            <label for="q">Search</label>'
    + '            <input type="search" placeholder="Search" id="q" name="q">'
    + '          </form>'
    + '        </li>'
    + '      </ul>'
    + '    </div>'
    + '  </div>';
    + '</div>';

    // Self-executing function must be after all vars have been initialized
    (function () {
        if (window.jQuery !== undefined &&
            Tabzilla.compareVersion(window.jQuery.fn.jquery, minimumJQuery) !== -1
        ) {
            // set up local jQuery aliases
            jQuery = window.jQuery;
            $ = jQuery;
            $(document).ready(init);
        } else {
            // no jQuery or older than minimum required jQuery
            loadJQuery(init);
        }
    })();

    return Tabzilla;

})(Tabzilla || {});
/*
     FILE ARCHIVED ON 22:55:41 Jan 31, 2017 AND RETRIEVED FROM THE
     INTERNET ARCHIVE ON 01:33:33 Mar 20, 2019.
     JAVASCRIPT APPENDED BY WAYBACK MACHINE, COPYRIGHT INTERNET ARCHIVE.

     ALL OTHER CONTENT MAY ALSO BE PROTECTED BY COPYRIGHT (17 U.S.C.
     SECTION 108(a)(3)).
*/
/*
playback timings (ms):
  LoadShardBlock: 131.642 (3)
  esindex: 0.01
  captures_list: 558.379
  CDXLines.iter: 41.038 (3)
  PetaboxLoader3.datanode: 131.037 (4)
  exclusion.robots: 0.236
  exclusion.robots.policy: 0.219
  RedisCDXSource: 5.731
  PetaboxLoader3.resolve: 234.332
  load_resource: 245.28
*/