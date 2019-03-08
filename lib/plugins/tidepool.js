'use strict';

var uuidv4 = require('uuid/v4');
var createTidepoolClient = require('tidepool-platform-client');
var moment = require('moment');

var tidepool;
var localStore = {
  sgvs: []
  , pumpData: []
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

function tidepoolCreateDataset(tidepool, userId, info) {
  var datasetPromise = new Promise(function(resolve, reject) {
    tidepool.createDatasetForUser(userId, info, function (err, dataset) {
      if (err) {
        reject(err);
      }

      resolve(dataset);
    });
  });

  return datasetPromise;
}

const sgvGaps = (sgvs) => {
  const now = moment().valueOf();
  const minDate = moment().subtract(24, 'hours').valueOf();

  const tpGaps = [];

  if (sgvs && (sgvs.length > 0)) {
    let prevTime = sgvs[0].readDateMills;

    for (let i = 1; i < sgvs.length; i += 1) {
      // Add 1 minute to gapStart and subtract 1 minute from gapEnd to prevent duplicats
      const gap = {
        gapStart: moment(prevTime + 60000),
        gapEnd: moment(sgvs[i].readDateMills - 60000),
      };
      if ((sgvs[i].readDateMills - prevTime) > 6 * 60000) {
        tpGaps.push(gap);
    }

      prevTime = sgvs[i].readDateMills;
    }

    if ((now - prevTime) > 6 * 60000) {
    // Add 1 minute to gapStart to prevent duplicats
    tpGaps.push({ gapStart: moment(prevTime + 60000), gapEnd: moment(now) });
    }
  } else {
    // Add 1 minute to gapStart to prevent duplicats
    tpGaps.push({ gapStart: moment(minDate + 60000), gapEnd: moment(now) });
  }

  return tpGaps;
};

function engine(tidepool, opts, ctx) {
  console.log('Starting sync engine loop');

  var tpGaps = sgvGaps(localStore.sgvs);

  for (var i=0; i < tpGaps.length; i += 1) {
    var options = {
      startDate: tpGaps[i].gapStart.valueOf()
      , endDate: tpGaps[i].gapEnd.valueOf()
    };

    var resp = tidepool.getDeviceDataForUser(opts.userid, { }, function (err, handler) {
      console.log('getDeviceData cb err: ', err, ' handler: ', handler);
    });

    console.log('Device Data: ', resp);
  }

  // Figure out how to process response and prune list of gaps

  // Start tidepool upload session
  await tidepoolCreateDataset(tidepool, opts.userid, info);

  console.log('Remaining tidepool gaps: \n', tpGaps);

  for (var i=0; i < tpGaps.length; i += 1) {
    var sgvs = ctx.store.collection(opts.entries_collection).find({
      $and: [
        { dateString: { $gte: tpGaps[i].gapStart.toISOString() } }
        , { dateString: { $lte: tpGaps[i].gapEnd.toISOString() } } ]
    });

    // Upload SGVs returned
    console.log('SGVs: \n', sgvs);
  }

  // Finalize tidepool upload session
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
    , entries_collection: env.entries_collection
    , treatments_collection: env.treatments_collection
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

    opts.userid = data.user.userid;

    console.log('Logged into tidepool ', data);

    engine(tidepool, opts, ctx, true);

    setInterval(function () {
      engine(tidepool, opts, ctx);
    }, interval);
  };

  return bridge;
}

init.create = create;
init.options = options;
exports = module.exports = init;
