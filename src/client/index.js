import WebSocket from 'ws';
import Chart from './Chart';

const ws = new WebSocket('ws://localhost:8080/');

let chart;
ws.onmessage = function(message) {
  const data = JSON.parse(message.data);
  if (!chart) {
    chart = new Chart({ id: '#race', data })
  } else {
    chart.update(data);
  }
};
