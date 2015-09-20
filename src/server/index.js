import Twit from 'twit';
import _ from 'lodash';
import moment from 'moment';
import pmongo from 'promised-mongo';
import request from 'request';
import cheerio from 'cheerio';
import credentials from '../common/credentials';
import candidateList from '../common/candidates';
import { Server as WebSocketServer } from 'ws';

const db = pmongo('twitter-poll'),
      twitter = db.collection('twitter'),
      markets = db.collection('markets'),
      polls   = db.collection('polls'),
      urls    = {
        prediction : 'http://table-cache1.predictwise.com/latest/table_1498.json',
        // add timestamp as query param
        rcp: 'http://www.realclearpolitics.com/epolls/json/3823_historical.js'
      };

const candidates = candidateList.map(name => {
  const regex = new RegExp(
    name.toLowerCase()
  );
  return { name, in : s => regex.test(s) };
});


const prequest = opts => new Promise((res, rej) => {
  request(opts, (error, response, body) => {
    error ? rej(error) : res(body);
  });
});


async function scrapeRCP() {
  try {
    const $        = cheerio.load(await prequest({ url : urls.rcp })),
          $data    = $('#polling-data-rcp'),
          text     = (i, x) => $(x).text(),
          $headers = $data.find('tr:first-child th').map(text),
          $avgs    = $data.find('.rcpAvg td').map(text),
          results  = $headers.map((i, h) => ({ header: h.trim(), val: $avgs.get(i) }))
                            .toArray();
    return results;
  } catch (error) {
    console.log(error.stack);
  }
}


async function getSeries(date) {
  const results = await twitter.aggregate(
    { $match : {
      'point.date' : { $gt: moment(date).add(-1, 'month').toDate() }
    }},
    { $group : {
      _id : '$name',
      points : { $push : '$point' }
    }},
    { $sort: { 'point.date': 1 }}
  );

  return results.map(candidate => {
    candidate.image = _.last(candidate._id.toLowerCase().split(' ')) + '.png';
    return candidate;
  });
}

async function watchTwitter() {

  try {
    const wss = new WebSocketServer({ port: 8080 }),
          now = () => moment().startOf('minute').toDate(),
          clients = [];

    let date = now();

    wss.on('connection', async(ws) => {
      ws.on('message', () => {
        console.log(`Added connection... (${clients.length} connections open)`);
      });
      // send series on connection
      ws.send(JSON.stringify(await getSeries(date)));
      clients.push(ws);
    });

    wss.broadcast = data => {
      clients.forEach(client => {
        client.send(JSON.stringify(data));
      });
    };

    const T = new Twit(credentials),
          filter = {
            track: candidates.map(c => c.name).join(',')
          },
          stream = T.stream('statuses/filter', filter);

    await* candidates.map(({ name }) => twitter.update(
        { name, 'point.date' : date },
        { $set: { name, 'point.date' : date }, $inc : { 'point.count' : 0 } },
        { upsert: true }
    ));

    console.log('starting websocket broadcast...');
    const interval = setInterval(async() => {
      try {
        wss.broadcast(await getSeries(date));
      } catch (error) {
        wss.broadcast({ error });
        console.log(error.stack || error);
        clearInterval(interval);
      }
    }, 1000);

    console.log('monitoring twitter...');
    stream.on('tweet', tweet => {

      const text = tweet.text.toLowerCase(),
            currentDate = now();

      if (currentDate > date) {
        date = currentDate;
      }

      candidates.forEach(candidate => {
        if(candidate.in(text)) {
          twitter.findAndModify({
            query:  { name: candidate.name, 'point.date' : date },
            update: { $inc: { 'point.count': 1 } },
            upsert: true
          });
        }
      });

    });

  } catch (error) {
    console.log(error.stack || error);
  }

}

watchTwitter();
