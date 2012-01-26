Tow Truck - Who you call when you get stuck
===========================================

Installation
------------

### Pre-requisites:

1. [Node JS](http://nodejs.org/)
2. [npm](http://npmjs.org/)
3. [Redis](http://redis.io/)
4. [Etherpad Lite](http://etherpad.org/download/)

### Sync submodule (Twitter bootstrap)

$ git submodule update --init --recursive

Running the Server
------------------

./app.js

Data Keys
---------

global:last_bundle_id - Used to keep track of total docs in the system in order to get the next short url


### License

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/).