import d3 from 'd3';
import _ from 'lodash';
import util from './util';

export default class Chart {

  constructor({ id, data }) {
    this.container = d3.select(id);
    this.render(data);
  }

  render(data=this.data) {

    this.data = data;

    const points = _(data).pluck('points').flatten().value();

    // Set the dimensions of the canvas / graph
    const bbox   = this.container.node().getBoundingClientRect(),
          margin = this.margin = { top: 60, right: 20, bottom: 30, left: 70 },
          width  = this.width = bbox.width - margin.left - margin.right,
          height = this.height = bbox.height - margin.top - margin.bottom;


    // Set the ranges
    const x = this.x = d3.time.scale().range([0, width]);
    const y = this.y = d3.scale.linear().range([height, 0]);

    // Scale the range of the data
    x.domain(d3.extent(points, d => new Date(d.date)));
    y.domain([0, d3.max(points, d => (d.value || 0))]);

    // Define the axes
    const xAxis = this.xAxis = d3.svg.axis().scale(x)
        .orient('bottom').ticks(5);

    const yAxis = this.yAxis = d3.svg.axis().scale(y)
        .orient('left').ticks(5);

    // Define the line
    const line = this.line = d3.svg.line()
        .x(d => x(new Date(d.date)))
        .y(d => y(d.value || 0 ))
        .interpolate('basis');

    // Adds the svg canvas
    const svg = this.svg = this.container.html('')
      .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    svg.append('g').selectAll('path')
        .data(data)
      .enter().append('path')
        .attr({
          class: d => `candidate line ${d._id.toLowerCase().replace(' ', '-')}`,
          d: d => line(d.points)
        })
        .style({
          stroke: d => util.colors(d._id)
        });

    // Add the X Axis
    this.xAxisG = svg.append('g')
        .attr('class', 'x axis')
        .attr('transform', 'translate(0,' + height + ')');

    this.xAxisG.call(xAxis);

    // Add the Y Axis
    this.yAxisG = svg.append('g')
        .attr('class', 'y axis');

    this.yAxisG.call(yAxis);

    svg.append('g').selectAll('circle')
        .data(data)
        .enter().append('circle')
          .attr({
            r: 4,
            cx : d => x(new Date(_.last(d.points).date)),
            cy : d => y(_.last(d.points).value)
          })
          .style({
            stroke: d => util.colors(d._id)
          });


    svg.append('g').selectAll('image')
        .data(data)
        .enter().append('image')
          .attr('width', util.imageSize)
          .attr('height', util.imageSize)
          .attr({
            x : d => x(new Date(_.last(d.points).date)) - util.imageSize/2,
            y : d => y(_.last(d.points).value) - util.imageSize - 10
          })
         .attr('xlink:href', d => `public/images/${d._id.replace(' ', '_')}.png`);

    svg.append('text')
     .text(`Tweet Count`)
     .attr({
       class : 'y axis-title',
       x: function() {
         const bb = this.getBoundingClientRect();
         return -height/2 - bb.width/2;
       },
       y: function() {
         const bb = this.getBoundingClientRect();
         return - margin.left + bb.height;
       },
       transform: 'rotate(270)'
     });

    return this;
  }

  update(data) {
    this.data = data;

    const points = _(data).pluck('points').flatten().compact().value();

    // Scale the range of the data
    this.x.domain(d3.extent(points, d => new Date(d.date)));
    this.y.domain([0, d3.max(points, d => (d.value || 0))]);

    this.svg.selectAll('path.candidate.line')
        .data(data)
      .transition().duration(200)
      .attr({
        d: d => this.line(d.points)
      });

    this.xAxisG
      .transition().duration(200)
      .call(this.xAxis);

    this.yAxisG
      .transition().duration(200)
      .call(this.yAxis);

    this.svg.selectAll('image')
        .data(data)
        .transition().duration(200)
        .attr({
          x : d => this.x(new Date(_.last(d.points).date)) - util.imageSize/2,
          y : d => this.y(_.last(d.points).value) - util.imageSize - 10
        });

    this.svg.selectAll('circle')
        .data(data)
        .transition().duration(200)
        .attr({
          r: 4,
          cx : d => this.x(new Date(_.last(d.points).date)),
          cy : d => this.y(_.last(d.points).value)
        });

    return this;
  }

}
