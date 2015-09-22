import d3 from 'd3';
import _ from 'lodash';
import util from './util';

window.d3 = d3;

export default class Chart {

  constructor({ id, data }) {
    this.container = d3.select(id);
    this.render(data);
  }

  render(data=this.data) {

    this.data = data;

    const { container } = this;

    const points = _(data).pluck('points').flatten().value();

    // Set the dimensions of the canvas / graph
    const bbox   = this.container.node().getBoundingClientRect(),
          margin = this.margin = { top: 60, right: 50, bottom: 30, left: 70 },
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
    const svg = this.svg = container.html('')
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
            class: 'point',
            r: 4,
            cx : d => x(new Date(_.last(d.points).date)),
            cy : d => y(_.last(d.points).value),
            class: d => d._id.replace(' ', '-').toLowerCase()
          })
          .style({
            stroke: d => util.colors(d._id)
          });

    const tooltipDate = svg.append('g').append('text')
      .attr({
        opacity: 0,
        x: 20,
        y: 20
      });

    svg.append('g').selectAll('text')
      .data(data)
      .enter().append('text')
      .text(d => _.last(d.points).value)
      .attr({
        opacity : 0,
        x : d => x(new Date(_.last(d.points).date)) + util.imageSize/2 + 5,
        y : d => y(_.last(d.points).value) - util.imageSize/2,
        class: d => 'display-number ' + d._id.replace(' ', '-').toLowerCase()
      });

    svg.append('g').selectAll('image')
        .data(data)
        .enter().append('image')
          .attr('width', util.imageSize)
          .attr('height', util.imageSize)
          .attr({
            x : d => x(new Date(_.last(d.points).date)) - util.imageSize/2,
            y : d => y(_.last(d.points).value) - util.imageSize - 10,
            class: d => d._id.replace(' ', '-').toLowerCase()
          })
         .attr('xlink:href', d => `images/${d._id.replace(' ', '_')}.png`);

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

    const plexiglass = svg.append('rect')
      .attr({
        width,
        height,
        opacity: 0
      });

    plexiglass.on('mousemove', () => {
      svg.selectAll('path.candidate.line').each((d, i) => {

        const nameClass   = d._id.replace(' ', '-').toLowerCase(),
              path        = svg.select(`path.candidate.line.${nameClass}`),
              circle      = svg.select(`circle.${nameClass}`),
              image       = svg.select(`image.${nameClass}`),
              displayNum  = svg.select(`.display-number.${nameClass}`),
              pathEl      = path.node(),
              pathLength  = pathEl.getTotalLength(),
              bbox        = container.node().getBoundingClientRect(),
              posx        = d3.event.pageX - bbox.left - margin.left;

        let beginning = posx,
            start = beginning,
            end = pathLength,
            finish = end,
            target,
            pos;

        if (i === 0) {
          tooltipDate.text(x.invert(posx));
        }

        while (true) {
          target = Math.floor((beginning + end) / 2);
          pos = pathEl.getPointAtLength(target);
          if ((target === end || target === beginning) && pos.x !== x) {
            break;
          }
          if (pos.x > posx)      end = target;
          else if (pos.x < posx) beginning = target;
          else                break; //position found
        }

        if (start <= posx && beginning >= posx) {

          circle
            .attr('cx', posx)
            .attr('cy', pos.y);

          image
            .attr({
              x : posx - util.imageSize/2,
              y : pos.y - util.imageSize - 10,
            });

          displayNum
            .text(util.format(y.invert(pos.y)))
            .attr({
              x : posx + util.imageSize/2 + 5,
              y : pos.y - util.imageSize/2 ,
            });
        }

      });
    });
    plexiglass.on('mouseover', () => {
      svg.selectAll('.display-number').attr('opacity', 1);
      tooltipDate.attr('opacity', 1);
      this.hovering = true;
    });
    plexiglass.on('mouseout', () => {
      svg.selectAll('.display-number').attr('opacity', 0);
      tooltipDate.attr('opacity', 0);
      this.hovering = false;
      this.update();
    });

    return this;
  }

  update(data=this.data) {
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


    if (!this.hovering) {

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
    }


    return this;
  }

}
