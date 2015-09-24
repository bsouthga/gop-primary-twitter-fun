/*
 *
 * ExpressJS server and websocket
 *
 */



import _ from 'lodash';
import moment from 'moment';
import pmongo         from 'promised-mongo';
import candidates from '../common/candidates';
import socket         from 'socket.io';
import express        from 'express';



const ports   = { express: 8000, socket: 8080 },
      bcint   = 500,
      db      = pmongo('twitter-poll'),
      twitter = db.collection('twitter'),
      markets = db.collection('markets'),
      polls   = db.collection('polls');




/*
 *
 *
 * Start server and socket
 *
 *
 */
server();



function server() {
  const app = express();

  app.use(express.static('public'));
  const server = app.listen(ports.express, function () {
    const { address: host, port } = server.address();

    console.log('Express listening at http://%s:%s', host, port);

    startSocket();
  });
}


async function queryMarketData() {
  const [ data ]  = await markets
      .find({})
      .sort({ _id : -1 })
      .limit(1)
      .toArray();

  const out = candidates.reduce(
    (out, name) => {
      out.data[name] = data.percentages[name];
      return out;
    }, {
      data: {},
      date: data.date
    });

  return out;
}



async function queryPollData() {
  const [ data ]  = await polls
      .find({})
      .sort({ _id : -1 })
      .limit(1)
      .toArray();

  return data.poll.rcp_avg[0];
}



async function seriesPer(time='minute') {

  let lookback;

  switch(time) {
    case 'minute':  lookback = 'hour'; break;
    case 'hour':    lookback = 'day'; break;
    default:        throw new Error('Invalid time for series!');
  }

  const baseline = moment().add(-1, lookback).toDate();

  const series = await twitter.aggregate(
    {$match: {
      'date': { $gt: baseline }
    }},
    {$group: {
      _id: {
        date: { ['$' + time]: '$date' },
        name: '$name'
      },
      value: { $sum: 1 }
    }},
    {$sort: {'_id.date': 1 }}
  );

  const out = {};
  _.each(series, point => {
    const { value, _id: { name, date }} = point;
    if (!out[name]) {
      out[name] = {
        _id: name,
        points: []
      }
    }
    out[name].points.push({
      value,
      // add back baseline to aggregated date
      date: moment(baseline).add(date, time).toDate()
    })
  });

  return _.values(out);
}



async function valuesInLast(time='minute') {
  const sums = await twitter.aggregate(
    {$match: {
      'date': { $gt: moment().add(-1, time).toDate() }
    }},
    {$group: {
      _id: '$name',
      value: { $sum: 1 }
    }}
  );
  return sums;
}



async function startSocket() {

  try {
    let clients = 0,
        cache;

    const updateCachedSeries = async() => {
      cache = await* [
        seriesPer('minute'),
        seriesPer('hour'),
        queryPollData(),
        queryMarketData()
      ];
    };

    // update cache every 5 seconds
    await updateCachedSeries();
    setInterval(updateCachedSeries, 5000);

    console.log('starting websocket...');
    const wss = socket(ports.socket);

    wss.broadcast = (data, type='data') => wss.sockets.emit(
      type, JSON.stringify(data)
    );

    function sendJSON(tag, data) {
      this.emit(tag, JSON.stringify(data));
    }

    wss.on('connect', async(ws) => {

      const [ minute, hour, polls, markets ] = cache;

      ws.sendJSON = sendJSON;

      ws.sendJSON('data',    { type: 'series', data: { minute, hour } });
      ws.sendJSON('polls',   polls);
      ws.sendJSON('markets', markets);

      ws.on('disconnect', () => {
        clients--;
        wss.broadcast({ clients }, 'count');
      });

      clients++;
      wss.broadcast({ clients }, 'count');
    });

    console.log('starting websocket broadcast...');
    const interval = setInterval(async() => {
      try {

        const [ minute, hour ] = await* [
          valuesInLast('minute'),
          valuesInLast('hour')
        ];

        wss.broadcast({
          type: 'point',
          data: { minute, hour }
        });

      } catch (error) {
        wss.broadcast({ error });
        console.log(error.stack || error);
        clearInterval(interval);
      }
    }, bcint);

  } catch (error) {
    console.log(error.stack || error);
  }

}
