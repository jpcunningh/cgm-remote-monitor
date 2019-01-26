'use strict';

// Track the most recently seen record
var mostRecentRecords = {
  sgv: null
  , bgCheck: null
  , delivery: null
};

function engine(opts) {
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
    accountName: env.extendedSettings.tidepool.userName
    , password: env.extendedSettings.tidepool.password
  };

  var fetch_config = {
    maxCount: env.extendedSettings.tidepool.maxCount || 1
    , minutes: env.extendedSettings.tidepool.minutes || 1440
  };

  return {
    login: config
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

  mostRecentRecord = new Date().getTime() - opts.fetch.minutes * 60000

  bridge.startEngine = function startEngine (ctx) {

    setInterval(function () {
      opts.fetch.minutes = parseInt((new Date() - mostRecentRecord) / 60000);
      opts.fetch.maxCount = parseInt((opts.fetch.minutes / 5) + 1);
      opts.firstFetchCount = opts.fetch.maxCount
      console.log("Fetching Share Data: ", 'minutes', opts.fetch.minutes, 'maxCount', opts.fetch.maxCount);
      engine(opts);
    }, interval);
  };

  return bridge;
}

init.create = create;
init.options = options;
exports = module.exports = init;
