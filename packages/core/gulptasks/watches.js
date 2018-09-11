const gulp = require("gulp");
const { options } = require("./config");

gulp.task("watch", () => {
  gulp.watch("src/**/*", [options.watch_task]);
});
