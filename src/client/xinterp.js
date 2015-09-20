import d3 from 'd3';

//
// XKCD-style line interpolation. Roughly based on:
//    jakevdp.github.com/blog/2012/10/07/xkcd-style-plots-in-matplotlib
// taken from: http://bl.ocks.org/dfm/3914862
//
export default function xinterp(opts) {

  const {
          x: xscale,
          y: yscale,
          magnitude=0.003
        } = opts;

  return points => {

    const xlim = xscale.domain(),
          ylim = yscale.domain();
          
    // Scale the data.
    const f = [xscale(xlim[1]) - xscale(xlim[0]),
               yscale(ylim[1]) - yscale(ylim[0])],
          z = [xscale(xlim[0]),
               yscale(ylim[0])],
          scaled = points.map(function (p) {
            return [(p[0] - z[0]) / f[0], (p[1] - z[1]) / f[1]];
          });

    // Compute the distance along the path using a map-reduce.
    const dists = scaled.map(function (d, i) {
            if (i === 0) {
              return 0.0;
            }
            const dx = d[0] - scaled[i - 1][0],
                  dy = d[1] - scaled[i - 1][1];
            return Math.sqrt(dx * dx + dy * dy);
          }),
          dist = dists.reduce((tot, curr) => curr + tot, 0.0);

    // Choose the number of interpolation points based on this distance.
    const N = Math.round(200 * dist);

    // Re-sample the line.
    const resampled = [];
    dists.map((d, i) => {
      if (i === 0) {
        return;
      }
      const n = Math.max(3, Math.round(d / dist * N)),
            spline = d3.interpolate(scaled[i - 1][1], scaled[i][1]),
            delta = (scaled[i][0] - scaled[i - 1][0]) / (n - 1);
      for (let j = 0, x = scaled[i - 1][0]; j < n; ++j, x += delta) {
        resampled.push([x, spline(j / (n - 1))]);
      }
    });

    // Compute the gradients.
    let gradients = resampled.map((a, i, d) => {
      if (i === 0) {
        return [d[1][0] - d[0][0], d[1][1] - d[0][1]]
      };
      if (i === resampled.length - 1) {
        return [d[i][0] - d[i - 1][0], d[i][1] - d[i - 1][1]];
      }
      return [0.5 * (d[i + 1][0] - d[i - 1][0]),
              0.5 * (d[i + 1][1] - d[i - 1][1])];
    });

    // Normalize the gradient vectors to be unit vectors.
    gradients = gradients.map(d => {
      const len = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
      return [d[0] / len, d[1] / len];
    });

    // Generate some perturbations.
    const perturbations = smooth(resampled.map(d3.random.normal()), 3);

    // Add in the perturbations and re-scale the re-sampled curve.
    const result = resampled.map(function (d, i) {
      const p = perturbations[i],
            g = gradients[i];
      return [(d[0] + magnitude * g[1] * p) * f[0] + z[0],
              (d[1] - magnitude * g[0] * p) * f[1] + z[1]];
    });

    return result.join('L');
  }
}


// Smooth some data with a given window size.
function smooth(d, w) {
  const result = [];
  for (let i = 0, l = d.length; i < l; ++i) {
    const mn = Math.max(0, i - 5 * w),
          mx = Math.min(d.length - 1, i + 5 * w);
    let s = 0.0;
    result[i] = 0.0;
    for (let j = mn; j < mx; ++j) {
      const wd = Math.exp(-0.5 * (i - j) * (i - j) / w / w);
      result[i] += wd * d[j];
      s += wd;
    }
    result[i] /= s;
  }
  return result;
}
