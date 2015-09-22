import d3 from 'd3';
import util from './util';
import moment from 'moment';

export default class Scatter {

  constructor({ id, data, xTitle }) {
    this.container = d3.select(id);
    this.xTitle = xTitle;
    this.render(data);
  }

  render(data=this.data) {

    this.data = data;

    const bbox   = this.container.node().getBoundingClientRect(),
          margin = this.margin = { top: 60, right: 20, bottom: 70, left: 70 },
          width  = this.width = bbox.width - margin.left - margin.right,
          height = this.height = bbox.height - margin.top - margin.bottom;

    // Set the ranges
    const x = this.x = d3.scale.linear().range([0, width]);
    const y = this.y = d3.scale.linear().range([height, 0]);

    // Scale the range of the data
    const max = Math.max(d3.max(data.series, d => d.x), d3.max(data.series, d => d.y));
    x.domain([0, max]);
    y.domain([0, max]);

    // Define the axes
    const xAxis = this.xAxis = d3.svg.axis().scale(x)
        .tickFormat(d => `${d}%`)
        .orient('bottom')
        .ticks(5);

    const yAxis = this.yAxis = d3.svg.axis().scale(y)
        .tickFormat(d => `${d}%`)
        .orient('left').ticks(5);

    // Adds the svg canvas
    const svg = this.svg = this.container.html('')
      .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add the X Axis
    this.xAxisG = svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')');

    this.xAxisG.call(xAxis);

    // Add the Y Axis
    this.yAxisG = svg.append('g')
        .attr('class', 'y axis');

    this.yAxisG.call(yAxis);

    const [ xMin, xMax ] = x.domain();
    const [ yMin, yMax ] = y.domain();

    svg.append('g').append('line')
      .attr({
        class: 'divider',
        x1: x(xMin),
        y1: y(yMin),
        x2: x(xMax),
        y2: y(yMax)
      });

    const displayDate = moment(data.date).format('MMMM Do YYYY');


    svg.append('text')
      .text(`${this.xTitle} (updated: ${displayDate})`)
      .attr({
        class : 'x axis-title',
        y: function() {
          const bb = this.getBoundingClientRect();
          return height + margin.bottom - bb.height;
        },
        x: function() {
          const bb = this.getBoundingClientRect();
          return width/2 - bb.width/2;
        }
      });


    svg.append('text')
      .text(`Percentage of Tweets in the last ${data.timeAgg}`)
      .attr({
        class : 'y axis-title',
        x: function() {
          const bb = this.getBoundingClientRect();
          return -height + bb.width/2;
        },
        y: function() {
          const bb = this.getBoundingClientRect();
          return - margin.left + bb.height;
        },
        transform: 'rotate(270)'
      });


    svg.append('text')
      .text(`(Excess Twitter love)`)
      .attr({
        y: function() {
          const bb = this.getBoundingClientRect();
          return height/4 - bb.height;
        },
        x: function() {
          const bb = this.getBoundingClientRect();
          return width/4 - bb.width/2;
        }
      });


    svg.append('text')
      .text(`(Not enough Twitter love)`)
      .attr({
        y: function() {
          const bb = this.getBoundingClientRect();
          return height*3/4 - bb.height;
        },
        x: function() {
          const bb = this.getBoundingClientRect();
          return width*3/4  - bb.width/2;
        }
      });


    svg.append('g').selectAll('circle')
        .data(data.series)
      .enter().append('circle')
        .attr('class', 'scatter-point')
        .attr({
          cx: d => x(d.x),
          cy: d => y(d.y),
          r: 4,
          class: d => d.name.replace(' ', '-').toLowerCase()
        })
        .style({
          stroke: d => util.colors(d.name)
        });


    svg.append('g').selectAll('image')
        .data(data.series)
        .enter().append('image')
          .attr('width', util.imageSize)
          .attr('height', util.imageSize)
          .attr({
            x : d => x(d.x) - util.imageSize/2,
            y : d => y(d.y) - util.imageSize - 10,
            class: d => d.name.replace(' ', '-').toLowerCase()
          })
         .attr('xlink:href', d => `/images/${d.name.replace(' ', '_')}.png`);



    return this;
  }

  update(data=this.data) {

    const { x, y, svg } = this;

    // Scale the range of the data
    const max = Math.max(d3.max(data.series, d => d.x), d3.max(data.series, d => d.y));
    x.domain([0, max]);
    y.domain([0, max]);

    svg.selectAll('circle')
        .data(data.series)
        .transition()
        .duration(200)
        .attr({
          cx: d => x(d.x),
          cy: d => y(d.y)
        });

    svg.selectAll('image')
        .data(data.series)
        .transition()
        .duration(200)
        .attr({
          x : d => x(d.x) - util.imageSize/2,
          y : d => y(d.y) - util.imageSize - 10
        });

    this.xAxisG
      .transition().duration(200)
      .call(this.xAxis);

    this.yAxisG
      .transition().duration(200)
      .call(this.yAxis);

    return this;
  }
}
