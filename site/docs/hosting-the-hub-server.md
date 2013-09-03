# Hosting the Hub Server

We have a server at `https://hub.towtruck.mozillalabs.com` which you are welcome to use for peer-to-peer communications with TowTruck.  But you may wish to host your own.  The server is fairly small and simple, so it should be reasonable.  Note that we haven't really "finished" the story around self-hosting, so the details of this are likely to change.  The server itself is quite stable.

The server is located in `hub/server.js`, and is a simple Node.js application.  You can run this like `node hub/server.js`, and you can use environmental variables to control things like the port (look in `server.js` for references to `process.env`).  You will need to `npm install websocket` to get the websocket library installed.

If you want to use TowTruck on an https site you must host the hub on https.  We don't it setup in `server.js` for Node to do SSL directly, so we recommend a proxy.  [stunnel](https://www.stunnel.org/) is an example of the kind of proxy you'd want – not all proxies support websockets.

Once you have the hub installed you need to configure TowTruck to use the hub, like:

```javascript
TowTruckConfig_hubBase = "https://myhub.com";
```

## Getting a static copy of the client

You may also want a static copy of the client that you can host yourself.  Run `grunt build` to create a static copy of the TowTruck library in `build/` (use `--dest` to control the output location, and `--exclude-tests` to avoid including the tests in your version).

The hub changes quite infrequently, so if you just stability then making a static copy of the client will do it for you.  This option is highly recommended for production!
