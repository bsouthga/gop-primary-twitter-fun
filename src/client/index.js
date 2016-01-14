import _ from 'lodash';
import io from 'socket.io-client';
import Chart from './Chart';
import Bar from './Bar';
import Scatter from './Scatter';
import moment from 'moment';
import candidates from '../common/candidates';
import config from '../common/config';

/*
  TODO:
    - yAxis gridlines
    - BarChart for time period
    x scatterplots for polls + prediction
    - mouseover uses interpolated estimate of value, faces "say" number
    - expire tweet data after one day
*/

angular.module('app', [])
  .controller('main', ['$scope', $scope => {

    const timeAggTypes = ['minute', 'hour'],
          exclude = new Set,
          candidateHash = timeAggTypes.reduce(
            (agg, time) => (agg[time] = {}, agg), {}
          ),
          bar = {
            data: {},
            draw(method='render') {
              this.chart && this.chart[method](this.data[$scope.timeAgg]);
            }
          },
          draw = function(method='render') {
            this.chart && this.chart[method]({
              timeAgg: $scope.timeAgg,
              date: this.date,
              series: this.series[$scope.timeAgg]
            });
            return this;
          },
          polls = { data: {}, series: {}, draw },
          markets = { data: {}, series: {}, draw },
          ws = io(`${config.socket.url}:${config.ports.socket}`);

    let chart,
        errorCount = 0;

    $scope.timeAgg = timeAggTypes[0];

    $scope.$watch('timeAgg', timeAgg => {
      if (!timeAgg || !chart) {
        return;
      }
      chart.render({
        series: _.values(candidateHash[$scope.timeAgg]),
        timeAgg : $scope.timeAgg
      });
      polls.draw();
      markets.draw();
      bar.draw('update');
    });

    ws.on('error', () => {
      console.log('connection error, retrying in 1 second...');
      if (errorCount < 5) {
        errorCount++;
        setTimeout(() => {
          ws.socket.reconnect();
        }, 1000);
      } else {
        console.log('Unable to reconnect!');
      }
    });


    ws.on('connection', () => {
      console.log('Connected to socket!');
    });

    ws.on('count', data => {
      const { clients } = JSON.parse(data);
      $scope.$apply(() => {
        $scope.clients = clients;
      })
    });

    ws.on('markets', jsonString => {
      const results = JSON.parse(jsonString)
      markets.data = results.data;
      markets.date = results.date;
    });

    ws.on('polls', jsonString => {
      const data = JSON.parse(jsonString),
            lastNameHash = _.reduce(data.candidate, (acc, candidate) => {
              acc[candidate.name.toLowerCase()] = parseFloat(candidate.value);
              return acc;
            }, {});
      polls.date = new Date(data.date);
      candidates.forEach(candidate => {
        const last = _.last(candidate.toLowerCase().split(' '));
        polls.data[candidate] = lastNameHash[last];
      });
    });

    ws.on('data', jsonString => {
      if (jsonString) {
        const payload = JSON.parse(jsonString);

        if (!chart && payload.type === 'series') {

          timeAggTypes.forEach(time => {
            _.reduce(payload.data[time], (obj, value) => {
              value.points.forEach(point => {
                point.date = moment(point.date).toDate();
              });
              return obj[value._id] = value, obj;
            }, candidateHash[time]);
          })

          chart = new Chart({
            id: '#race',
            data: {
              series: _.values(candidateHash[$scope.timeAgg]),
              timeAgg : $scope.timeAgg
            } ,
            initTime: new Date(),
            exclude
          });

          window.onresize = _.debounce(() => {
            chart.render({
              series: _.values(candidateHash[$scope.timeAgg]),
              timeAgg : $scope.timeAgg
            });
            polls.draw();
            markets.draw();
            bar.draw();
          }, 100);

        } else if (chart && payload.type === 'point') {

          timeAggTypes.forEach(time => {

            const pointHash = {};

            let pointTotal = 0;

            payload.data[time].forEach(({ _id, value }) => {
              if (!candidateHash[time][_id]) {
                candidateHash[time][_id] = { _id, points: [] };
              }
              pointHash[_id] = value;
              pointTotal += value;
              candidateHash[time][_id].points.push({ value, date: new Date() });
            });

            bar.data[time] = _.map(candidates, candidate => {
              return {
                name: candidate,
                value: pointHash[candidate] || 0
              };
            });

            polls.series[time] = _.map(polls.data, (value, name) => {
              return { name, x: value, y: (pointHash[name]*100 || 0) / pointTotal };
            });

            markets.series[time] = _.map(markets.data, (value, name) => {
              return { name, x: value, y: (pointHash[name]*100 || 0) / pointTotal };
            });

          });


          if (!bar.chart) {
            bar.chart = new Bar({
              id: '#race-bar',
              data: bar.data[$scope.timeAgg],
              exclude
            });
          } else {
            bar.draw('update')
          }


          if (!polls.chart) {
            polls.chart = new Scatter({
              id: '#poll-scatter', data: {
                timeAgg: $scope.timeAgg,
                date: polls.date,
                series: polls.series[$scope.timeAgg]
              },
              xTitle: 'Real Clear Politics Poll Average',
              exclude
            });
          } else {
            polls.draw('update');
          }


          if (!markets.chart) {
            markets.chart = new Scatter({
              id: '#market-scatter', data: {
                timeAgg: $scope.timeAgg,
                date: markets.date,
                series: markets.series[$scope.timeAgg]
              },
              xTitle: 'PredictWise Estimates',
              exclude
            });
          } else {
            markets.draw('update');
          }

          let lookback = 'day';
          if ($scope.timeAgg === 'minute') {
            lookback = 'hour';
          }

          const data = _.values(candidateHash[$scope.timeAgg]),
                oneHourBack = moment().add(-1, lookback).toDate();

          // if the last points are less than the time period being observed
          // dequeue until within window
          _.each(data, candidate => {
            while(candidate.points.length && candidate.points[0].date < oneHourBack) {
              candidate.points.shift();
            }
          });

          chart.update({ series: data, timeAgg: $scope.timeAgg });
        }
      }
    });

  }]);
