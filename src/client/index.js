import _ from 'lodash';
import io from 'socket.io-client';
import Chart from './Chart';
import moment from 'moment';

angular.module('app', [])
  .controller('main', ['$scope', $scope => {


    const timeAggTypes = ['minute', 'hour'],
          candidateHash = timeAggTypes.reduce(
            (agg, time) => (agg[time] = {}, agg), {}
          ),
          ws = io('http://localhost:8080/');

    $scope.timeAgg = timeAggTypes[0];

    let chart,
        errorCount = 0;


    $scope.$watch('timeAgg', timeAgg => {
      if (!timeAgg || !chart) {
        return;
      }
      chart.render(_.values(candidateHash[$scope.timeAgg]));
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

          chart = new Chart({ id: '#race', data: _.values(candidateHash[$scope.timeAgg]) });

          window.onresize = _.debounce(() => {
            chart.render(_.values(candidateHash[$scope.timeAgg]));
          }, 100);

        } else if (chart && payload.type === 'point') {
          timeAggTypes.forEach(time => {
            payload.data[time].forEach(({ _id, value }) => {
              if (!candidateHash[time][_id]) {
                candidateHash[time][_id] = { _id, points: [] };
              }
              candidateHash[time][_id].points.push({ value, date: new Date() });
            });
          });

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

          chart.update(data);
        }
      }
    });

  }]);
