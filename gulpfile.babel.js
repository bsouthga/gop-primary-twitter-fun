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


gulp.task('build', ['compile', 'browserify']);


gulp.task('compile', () => asyncHelpers.parallel([
  cb => gulp
    .src(['./src/server/**/*.js'])
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./dist/server/'))
    .on('end', cb),
  cb => gulp
    .src(['./src/common/**/*.js'])
    .pipe(sourcemaps.init())
    .pipe(babel())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./dist/common/'))
    .on('end', cb)
]));





gulp.task('browserify', () => {

  const bundle = browserify('./src/client/index.js', { debug: true })
        .transform(babelify)
        .bundle()
        .on('error', function(err) { console.error(err); this.emit('end'); });

  const dest = gulp.dest('./dist/client/');

  return asyncHelpers.parallel([

    cb => bundle
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(sourcemaps.write('./'))
        .pipe(dest)
        .on('end', cb),

    cb => bundle
        .pipe(source('bundle.min.js'))
        .pipe(buffer())
        .pipe(uglify({mangle : true}))
        .pipe(dest)
        .on('end', cb)

  ]);
});

function reload() {
  return gulp.src(['./dist/client/**/*.js', './index.html'])
    .pipe(livereload());
}

gulp.task('reload', ['browserify'], reload);


gulp.task('webserver', ['build'], () => {
  gulp.src('./')
    .pipe(webserver({ open: true, livereload: false }));
});

gulp.task('watch', ['webserver'], () => {
  livereload.listen();
  gulp.watch(['./src/**/*.js', 'index.html'], ['build']);
  nodemon({
    script: 'dist/server/index.js',
    ext: 'js html',
    env: { 'NODE_ENV': 'development' }
  })
  .on('restart', reload);
});


gulp.task('default', ['watch']);
