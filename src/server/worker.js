/*
 *
 * Collect external data sources and monitor twitter, pushing to mongo
 *
 */



import Twit         from 'twit';
import request      from 'request';
import pmongo       from 'promised-mongo';
import candidates   from '../common/candidates';
import credentials  from '../common/credentials';



const db      = pmongo('twitter-poll'),
      twitter = db.collection('twitter'),
      markets = db.collection('markets'),
      polls   = db.collection('polls'),
      urls    = {
        prediction : 'http://table-cache1.predictwise.com/latest/table_1498.json',
        // add timestamp as query param
        rcp: 'http://www.realclearpolitics.com/epolls/json/3823_historical.js'
      };



twitter.createIndex({ date: 1 }, { expireAfterSeconds: 24*60*60 });



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
      date: moment(data.timestamp, 'MM-DD-YYYY hh:mma').toDate()
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
        filter = { track: candidates.join(',') },
        stream = T.stream('statuses/filter', filter);

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
        twitter.insert({ name: candidate.name, date: new Date() });
      }
    });
  });
}



function main() {
  // start websocket + twitter scraper
  watchTwitter();

  updateExternalSources();

  // request new polls + markets every hour
  setInterval(updateExternalSources, 1000*60*60);
}
