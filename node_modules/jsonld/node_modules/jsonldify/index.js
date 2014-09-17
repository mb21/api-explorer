var through  = require('through');
var join     = require('path').join;
var basename = require('path').basename;

module.exports = function(file) {
  if(basename(file) !== 'jsonld.js') {
    return through();
  }

  return through(write, end);

  function write (buf) {
    this.queue(buf);
  }

  function end () {
    this.queue(new Buffer('\nmodule.exports = jsonldjs;'));
    this.queue(null);
  }
}