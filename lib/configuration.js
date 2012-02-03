/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * An abstraction which contains various pre-set deployment
 * environments and adjusts runtime configuration appropriate for
 * the current environmnet (specified via the NODE_ENV env var)..
 * Borrowed from the browserid project. -- Thanks @lloyd.
 * (https://github.com/mozilla/browserid)
 *
 * usage is
 *   exports.configure(app);
 */

const
path = require('path'),
urlparse = require('urlparse'),
semver = require('semver'),
fs = require('fs'),
convict = require('convict'),
cjson = require('cjson');

// verify the proper version of node.js is in use
try {
  var required = 'unknown';
  // extract required node version from package.json
  required = JSON.parse(fs.readFileSync(path.join(__dirname, '..', "package.json"))).engines.node;
  if (!semver.satisfies(process.version, required)) throw false;
} catch (e) {
  process.stderr.write("update node! verision " + process.version +
                       " is not " + required +
                       (e ? " (" + e + ")" : "") + "\n");
  process.exit(1);
}

var conf = module.exports = convict({
  env: {
    doc: "What environment are we running in?  Note: all hosted environments are 'production'.  ",
    //TODO: Perhaps unrestrict environment names.
    format: 'string ["production", "development"] = "production"',
    env: 'NODE_ENV'
  },
  redis: {
    ignore_vcap_service_creds: {
      doc: "Ignore creds discovered via VCAP_SERVICES environment variable",
      format: 'boolean = false',
      env: 'REDIS_IGNORE_VCAP_SERVICES'
    },
    host: {
      doc: "The host where redis is listening",
      format: 'string = "localhost"',
      env: 'REDIS_HOST'
    },
    port: {
      doc: "The port that redis is listening on",
      format: 'integer{1,65535} = 6379',
      env: 'REDIS_PORT'
    },
    password: {
      doc: "The password for redis if applicable",
      format: 'string?',
      env: 'REDIS_PASSWORD'
    }
  },
  etherpad: {
    publicUrl: {
      doc: "The publically-available url for etherpad.",
      format: 'string = "http://localhost:9001"',
      env: 'ETHERPAD_PUBLIC_URL'
    },
    apikey: {
      doc: "The apikey for etherpad-lite -- duh",
      format: 'string',
      env: 'ETHERPAD_API_KEY',
    },
    host: {
      doc: "The host where etherpad-lite is found for api use",
      format: 'string = "localhost"',
      env: 'ETHERPAD_HOST'
    },
    port: {
      doc: "The port on which etherpad-lite is listening.",
      format: 'integer{1,65535} = 9001',
      env: 'ETHERPAD_PORT'
    },
  },
  bind_to: {
    host: {
      doc: "The ip address the server should bind to",
      format: 'string = "127.0.0.1"',
      env: 'IP_ADDRESS'
    },
    port: {
      doc: "The port the server should bind",
      format: 'integer{1,65535}?',
      env: 'PORT'
    }
  },
  public_url: {
    doc: "The publically visible URL of the deployment",
    format: 'string = "http://towtruck.mozillalabs.com"',
    env: 'URL'
  }
});


console.log("Initializing TowTruck. Environment: " + conf.get('env'));

// Here we load config/base.json and then overlay config/environments/{{NODE_ENV}}.json
conf.load(cjson.load(path.join(__dirname, '..', 'config', 'base.json')));
conf.load(cjson.load(path.join(__dirname, '..', 'config', 'environments', conf.get('env') + '.json')));


// validate the configuration based on the above specification
conf.validate();

// Replace any settings with those discovered in VCAP_SERVICES 
if (process.env.VCAP_SERVICES){
  
  // Ignore if set.
  if (!conf.get('redis')['ignore_vcap_service_creds']) {
    var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
    var redisConfig = vcapServices['redis-2.2'][0];
    conf.load({
      redis: {
        host: redisConfig.credentials.hostname,
        port: redisConfig.credentials.port,
        password: redisConfig.credentials.password
      }
    });
  }
}

