import d3 from 'd3';
import _ from 'lodash';
import util from './util';

export default class Bar {

  constructor({ id, data }) {
    this.container = d3.select(id);
    this.numberFormat = d3.format(',.0f');
    this.render(data);
  }

  render(data=this.data) {

    this.data = data;

    data = _.sortBy(data, 'value');

    const bbox   = this.container.node().getBoundingClientRect(),
          margin = this.margin = { top: 60, right: 20, bottom: 70, left: 70 },
          width  = this.width = bbox.width - margin.left - margin.right,
          height = this.height = bbox.height - margin.top - margin.bottom;

    // Set the ranges
    const y = this.y = d3.scale.linear().range([height, 0]);

    // Adds the svg canvas
    const svg = this.svg = this.container.html('')
      .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    y.domain([0, d3.max(data, d => d.value)]);

    const barWidth = this.barWidth = width / data.length;

    const bar = svg.append('g').selectAll('g.bar')
        .data(data)
      .enter().append('g')
        .attr('class', d => 'bar ' + d.name.replace(' ', '-').toLowerCase())
        .attr('transform', (d, i) => 'translate(' + i * barWidth + ',0)');

    bar.append('rect')
        .attr('y', d => y(d.value))
        .attr('height', d => height - y(d.value))
        .style('fill', d => util.colors(d.name))
        .attr('width', barWidth - 1);

    bar.append('text')
        .text(d => this.numberFormat(d.value))
        .attr('x', function() { return barWidth/2 - this.getBoundingClientRect().width/2; })
        .attr('y', d => y(d.value) - 5 );

    const headSize = Math.min(barWidth*0.8, margin.bottom*0.8)

    bar.append('image')
        .attr('width', headSize)
        .attr('height', headSize)
        .attr({
          x :  function() { return barWidth/2 - this.getBoundingClientRect().width/2; },
          y : height + 10,
          class: d => d.name.replace(' ', '-').toLowerCase()
        })
       .attr('xlink:href', d => `public/images/${d.name.replace(' ', '_')}.png`);

    return this;
  }

  update(data=this.data) {
    const { y, svg, barWidth, height } = this;

    data = _.sortBy(data, 'value');

    y.domain([0, d3.max(data, d => d.value)]);

    const bar = svg.selectAll('g.bar')
      .data(data);

    bar.select('text')
      .text(d => this.numberFormat(d.value))
      .transition().duration(200)
      .attr('x', function() { return barWidth/2 - this.getBoundingClientRect().width/2; })
      .attr('y', d => y(d.value) - 5 );

    bar.select('rect')
      .style('fill', d => util.colors(d.name))
      .transition().duration(200)
      .attr('y', d => y(d.value))
      .attr('height', d => height - y(d.value));

    bar.select('image')
       .attr('xlink:href', d => `public/images/${d.name.replace(' ', '_')}.png`);

    return this;
  }

}
