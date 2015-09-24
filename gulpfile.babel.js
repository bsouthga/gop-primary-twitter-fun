import gulp         from 'gulp';
import sourcemaps   from 'gulp-sourcemaps';
import babel        from 'gulp-babel';
import uglify       from 'gulp-uglify';
import livereload   from 'gulp-livereload';
import nodemon      from 'gulp-nodemon';
import webserver    from 'gulp-webserver';
import browserify   from 'browserify';
import babelify     from 'babelify';
import asyncHelpers from 'async';
import source       from 'vinyl-source-stream';
import buffer       from 'vinyl-buffer';
import arg          from 'yargs';

const args = arg.argv;

gulp.task('build', ['compile', 'browserify']);


gulp.task('compile', () => asyncHelpers.parallel([
  cb => gulp
    .src(['./src/server/**/*.js'])
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./public/dist/server/'))
    .on('end', cb),
  cb => gulp
    .src(['./src/common/**/*.js'])
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./public/dist/common/'))
    .on('end', cb)
]));



gulp.task('browserify', () => {

  const bundle = browserify('./src/client/index.js', { debug: true })
        .transform(babelify)
        .bundle()
        .on('error', function(err) { console.error(err); this.emit('end'); });

  const dest = gulp.dest('./public/dist/client/');

  const b = bundle
    .pipe(source('bundle.js'))
    .pipe(buffer())

  if (args.prod) {
    return b.pipe(uglify({mangle : true}))
            .pipe(dest);
  }

  return b.pipe(sourcemaps.init({ loadMaps: true }))
          .pipe(sourcemaps.write('./'))
          .pipe(dest);
});

function reload() {
  return gulp.src(['./public/dist/client/**/*.js', './index.html'])
    .pipe(livereload());
}

gulp.task('reload', ['browserify'], reload);


gulp.task('watch', ['build'], () => {
  livereload.listen();
  gulp.watch(['./src/client/**/*.js', 'index.html'], ['browserify']);
  gulp.watch(['./src/server/**/*.js'], ['compile']);
  nodemon({
    script: 'public/dist/server/index.js',
    ext: 'js html',
    env: { 'NODE_ENV': 'development' }
  })
  .on('restart', reload);
});



gulp.task('default', ['watch']);
