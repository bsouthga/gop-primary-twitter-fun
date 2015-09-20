import d3 from 'd3';
import _ from 'lodash';
import xinterp from './xinterp';

export default class Chart {

  constructor({ id, data }) {
    this.container = d3.select(id);
    this.render(data);
  }

  render(data) {

    console.log(data);

    const points = _(data).pluck('points').flatten().value();

    // Set the dimensions of the canvas / graph
    const margin = this.margin = { top: 60, right: 20, bottom: 30, left: 50 },
          width  = this.width = 600 - margin.left - margin.right,
          height = this.height = 300 - margin.top - margin.bottom;

    // Set the ranges
    const x = this.x = d3.time.scale().range([0, width]);
    const y = this.y = d3.scale.linear().range([height, 0]);
    const interpolate = this.interpolate = xinterp({ x, y });

    // Scale the range of the data
    x.domain(d3.extent(points, d => new Date(d.date)));
    y.domain([0, d3.max(points, d => (d.count || 0))]);

    // Define the axes
    const xAxis = this.xAxis = d3.svg.axis().scale(x)
        .orient('bottom').ticks(5);

    const yAxis = this.yAxis = d3.svg.axis().scale(y)
        .orient('left').ticks(5);

    // Define the line
    const line = this.line = d3.svg.line()
        .x(d => x(new Date(d.date)))
        .y(d => y(d.count || 0 ))
        .interpolate('basis');

    // Adds the svg canvas
    const svg = this.svg = this.container
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
        });

    const imageSize = this.imageSize = 45;



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
            cy : d => y(_.last(d.points).count)
          });


    svg.append('g').selectAll('image')
        .data(data)
        .enter().append('image')
          .attr('width', imageSize)
          .attr('height', imageSize)
          .attr({
            x : d => x(new Date(_.last(d.points).date)) - imageSize/2,
            y : d => y(_.last(d.points).count) - imageSize - 10
          })
         .attr('xlink:href', d =>  d.image ? `public/images/${d.image}` : '');


    return this;
  }

  update(data) {
    console.log(data);

    const points = _(data).pluck('points').flatten().compact().value();

    // Scale the range of the data
    this.x.domain(d3.extent(points, d => new Date(d.date)));
    this.y.domain([0, d3.max(points, d => (d.count || 0))]);

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
          x : d => this.x(new Date(_.last(d.points).date)) - this.imageSize/2,
          y : d => this.y(_.last(d.points).count) - this.imageSize - 10
        });

    this.svg.selectAll('circle')
        .data(data)
        .transition().duration(200)
        .attr({
          r: 4,
          cx : d => this.x(new Date(_.last(d.points).date)),
          cy : d => this.y(_.last(d.points).count)
        });

    return this;
  }

}
