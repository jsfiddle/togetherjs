/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

Number.prototype.seconds = function(){return this * 1000};
Number.prototype.second = Number.prototype.seconds;
Number.prototype.minutes = function(){return this.seconds() * 60};
Number.prototype.minute = Number.prototype.minutes;
Number.prototype.hours = function(){return this.minutes() * 60};
Number.prototype.hour = Number.prototype.hours;
Number.prototype.days = function(){return this.hours() * 24};
Number.prototype.day = Number.prototype.days
