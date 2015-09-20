import d3 from 'd3';


export default class Scatter {
  constructor({ id, data }) {
    this.container = d3.select(id);
    this.render(data);
  }
  render(data=this.data) {
    
    this.data = data;

    // Set the dimensions of the canvas / graph
    const bbox   = this.container.node().getBoundingClientRect(),
          margin = this.margin = { top: 60, right: 20, bottom: 30, left: 50 },
          width  = this.width = bbox.width - margin.left - margin.right,
          height = this.height = bbox.height - margin.top - margin.bottom;

    // Set the ranges
    const x = this.x = d3.scale.linear().range([0, width]);
    const y = this.y = d3.scale.linear().range([height, 0]);


    // Define the axes
    const xAxis = this.xAxis = d3.svg.axis().scale(x)
        .orient('bottom').ticks(5);

    const yAxis = this.yAxis = d3.svg.axis().scale(y)
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

    svg.append('g').selectAll('circle')
      .data(data)
      .enter().append('circle')
        .attr('class', 'scatter-point')
        .attr({
          cx: d => x(d.x),
          cy: d => y(d.y),
          r: 4
        });

    return this;
  }
  update(data=this.data) {

  }
}
