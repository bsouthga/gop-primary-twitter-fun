/*
 *
 * Collect external data sources and monitor twitter, pushing to mongo
 *
 */



import Twit from 'twit';
import moment from 'moment';
import request from 'request';
import pmongo from 'promised-mongo';
import candidateList from '../common/candidates';
import credentials from '../../credentials';



const db      = pmongo('twitter-poll'),
      twitter = db.collection('twitter'),
      markets = db.collection('markets'),
      polls   = db.collection('polls'),
      urls    = {
        prediction : 'http://table-cache1.predictwise.com/latest/table_1498.json',
        // add timestamp as query param
        rcp: 'http://www.realclearpolitics.com/epolls/json/3823_historical.js'
      },
      whiteSpace = /\s+/g,
      format = s => s.replace(whiteSpace, '').toLowerCase(),
      candidates = candidateList.map(name => {
        const regex = new RegExp(format(name));
        return { name, in : s => regex.test(s) };
      });


twitter.createIndex({ name: 1 });
twitter.createIndex({ date: 1 }, { expireAfterSeconds: 12*60*60 });
markets.createIndex({ insertDate: 1 }, { expireAfterSeconds: 24*60*60 });
polls.createIndex({ insertDate: 1 }, { expireAfterSeconds: 24*60*60 });


const prequest = url => new Promise((res, rej) => {
  request.get(url, (error, response) => {
    error ? rej(error) : res(response);
  });
});


/*
 *
 *
 * Start data collection
 *
 *
 */
main();



async function retrievePollData() {
  const response = await prequest(urls.rcp + `?${+new Date()}`),
        data = JSON.parse(
          response.body
                  .replace('return_json(', '')
                  .replace(');', '')
        );

  data.insertDate = new Date();
  await polls.insert(data);
}



async function retrieveMarketData() {
  try {
    const response = await prequest(urls.prediction),
          data = JSON.parse(response.body),
          percentages = data.table.reduce((acc, row) => {
            const [ name, percentage ] = row;
            acc[name] = parseFloat(percentage);
            return acc;
          }, {});
    await markets.insert({
      percentages,
      date: moment(data.timestamp, 'MM-DD-YYYY hh:mma').toDate(),
      insertDate: new Date()
    });
  } catch (error) {
    console.log(error.stack || error);
  }
}



async function updateExternalSources() {
  try {
    await* [ retrieveMarketData(), retrievePollData() ];
  } catch (error) {
    console.log(error.stack || error);
  }
}



function watchTwitter() {

  console.log('connecting to twitter api...')
  const T = new Twit(credentials),
        filter = { track: candidateList.join(',') },
        stream = T.stream('statuses/filter', filter);

  stream.on('warning', warning => {
    console.warn(warning);
  });

  stream.on('error', error => {
    console.error(error);
  });

  console.log('monitoring twitter...');
  stream.on('tweet', tweet => {
    const text = format(tweet.text);
    const date = moment().startOf('minute').toDate();
    candidates.forEach(candidate => {
      if(candidate.in(text)) {
        twitter.findAndModify({
          query: { name: candidate.name, date },
          update: {
            $inc: { count: 1 }
          },
          upsert: true
        })
        .catch(error => {
          console.error(error);
        });
      }
    });
  });
}



function main() {
  // start websocket + twitter scraper
  watchTwitter();

  // request new polls + markets every hour
  updateExternalSources();
  setInterval(updateExternalSources, 1000*60*60);
}
