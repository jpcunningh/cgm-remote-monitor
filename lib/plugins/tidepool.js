'use strict';

var uuidv4 = require('uuid/v4');
var createTidepoolClient = require('tidepool-platform-client');

var tidepool;
var localStore = {};

// Track the most recently seen record
var mostRecentRecords = {
  sgv: null
  , bgCheck: null
  , delivery: null
};

function tidepoolLogin(tidepool, options) {
  var loginPromise = new Promise(function(resolve, reject) {
    tidepool.login({
      username: options.login.userName
      , password: options.login.password
    }
    , { remembered: false }
    , function (err, data) {
      if (err) {
        reject(err)
      } else {
        resolve(data);
      }
    });
  });

  return loginPromise;
}

function engine(tidepool, opts, ctx) {
  console.log('Starting sync engine loop');
}

function init (env) {
  if (env.extendedSettings.tidepool && env.extendedSettings.tidepool.userName && env.extendedSettings.tidepool.password) {
    return create(env);
  } else {
    console.info('Tidepool bridge not enabled');
  }
}

function options (env) {
  var config = {
    userName: env.extendedSettings.tidepool.userName
    , password: env.extendedSettings.tidepool.password
    , host: env.extendedSettings.tidepool.apiUrl
    , uploadApi: env.extendedSettings.tidepool.uploadUrl
    , dataHost: env.extendedSettings.tidepool.dataUrl
  };

  var fetch_config = {
    maxCount: env.extendedSettings.tidepool.maxCount || 1
    , minutes: env.extendedSettings.tidepool.minutes || 1440
  };

  return {
    login: config
    , version: env.version
    , interval: env.extendedSettings.tidepool.interval || 60000 * 2.5
    , fetch: fetch_config
    , nightscout: { }
    , maxFailures: env.extendedSettings.tidepool.maxFailures || 3
    , firstFetchCount: env.extendedSettings.tidepool.firstFetchCount || 3
  };
}

function create (env) {

  var bridge = { };

  var opts = options(env);
  var interval = opts.interval;

  bridge.startEngine = async function startEngine (ctx) {
    tidepool = createTidepoolClient({
      host: opts.login.host
      , uploadApi: opts.login.uploadApi
      , dataHost: opts.login.dataHost
      , log: {
        warn: console.log
        , info: console.log
        , debug: console.log
      }
      , metricsSource: 'nightscout-bridge'
      , metricsVersion: opts.version
      , sessionTrace: uuidv4()
    });

    tidepool.initialize(function (err, sessionData) {
      if (err) {
        console.error('Unable to initialize tidepool: ', err);
      } else if (sessionData) {
        console.error('tidepool initialized? ', sessionData);
      }
    });

    var data = await tidepoolLogin(tidepool, opts)
      .catch( (err) => {
        console.error('Unable to log into tidepool: ', err);
        return;
      });

    console.log('Logged into tidepool ', data);

    setInterval(function () {
      opts.fetch.minutes = parseInt((new Date() - mostRecentRecord) / 60000);
      opts.fetch.maxCount = parseInt((opts.fetch.minutes / 5) + 1);
      opts.firstFetchCount = opts.fetch.maxCount
      console.log("Fetching Share Data: ", 'minutes', opts.fetch.minutes, 'maxCount', opts.fetch.maxCount);
      engine(tidepool, opts, ctx);
    }, interval);
  };

  return bridge;
}

init.create = create;
init.options = options;
exports = module.exports = init;
