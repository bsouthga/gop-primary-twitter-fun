import Twit from 'twit';
import _ from 'lodash';
import moment from 'moment';
import pmongo from 'promised-mongo';
import credentials from '../common/credentials';
import candidateList from '../common/candidates';
import socket from 'socket.io';

const db      = pmongo('twitter-poll'),
      twitter = db.collection('twitter');
      // markets = db.collection('markets'),
      // polls   = db.collection('polls'),
      // urls    = {
      //   prediction : 'http://table-cache1.predictwise.com/latest/table_1498.json',
      //   // add timestamp as query param
      //   rcp: 'http://www.realclearpolitics.com/epolls/json/3823_historical.js'
      // };

const candidates = candidateList.map(name => {
  const regex = new RegExp(
    name.toLowerCase()
  );
  return { name, in : s => regex.test(s) };
});


/*
 * Get series for given time length
 */
async function seriesPer(time='minute') {

  let lookback;

  switch(time) {
  case 'minute': lookback = 'hour'; break;
  case 'hour':   lookback = 'day'; break;
  default: throw new Error('Invalid time for series!');
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

async function watchTwitter() {

  try {
    console.log('starting socket.io...');
    const wss = socket(8080);

    let clients = 0;

    wss.on('connect', async(ws) => {
      console.log();
      // send minute and hour level aggregations
      const [ minute, hour ] = await* [seriesPer('minute'), seriesPer('hour')];
      ws.emit('data', JSON.stringify({
        type: 'series',
        data: { minute, hour }
      }));
      clients++;
      ws.on('disconnect', () => {
        clients--;
        console.log(`Client disconnected... (${clients} connections open)`);
      });
      console.log(`Client connected... (${clients} connections open)`);
    });

    wss.broadcast = data => wss.sockets.emit('data', JSON.stringify(data));

    console.log('connecting to twitter api...')
    const T = new Twit(credentials),
          filter = { track: candidates.map(c => c.name).join(',') },
          stream = T.stream('statuses/filter', filter);

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
    }, 1000);

    stream.on('warning', warning => {
      console.warn(warning);
    });

    stream.on('error', error => {
      console.error(error);
    });

    console.log('monitoring twitter...');
    stream.on('tweet', tweet => {
      const text = tweet.text.toLowerCase();
      candidates.forEach(candidate => {
        if(candidate.in(text)) {
          twitter.insert({
            name: candidate.name,
            date: new Date()
          });
        }
      });
    });

  } catch (error) {
    console.log(error.stack || error);
  }

}

watchTwitter();
