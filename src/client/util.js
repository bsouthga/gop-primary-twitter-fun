import d3 from 'd3';
import candidates from '../common/candidates';

export default {
  colors: d3.scale.ordinal()
    .domain(candidates)
    .range([
      '#8dd3c7',
      '#ffffb3',
      '#bebada',
      '#fb8072',
      '#80b1d3',
      '#fdb462',
      '#b3de69',
      '#fccde5',
      '#d9d9d9'
    ]),
  imageSize : 45
}
