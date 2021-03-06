var Console = require('./console');
var FileManager = require('./files');
var initPlugins = require('../common/plugins');
var chalk = require('chalk');
var path = require('path');

function Flow(options){
  this.startTime = Date.now();
  this.options = options;
  this.warns = [];
  this.console = new Console();

  var baseURI = options.base;
  var relBaseURI = path.dirname(path.relative(options.base, options.file));
  this.files = new FileManager(baseURI, relBaseURI, this.console, this);

  // add preprocessor to cut lines starting with /** @cut */ or ;;;
  // TODO: move to proper place or remove at all
  if (options.jsCutDev)
    this.files.preprocess['.js'] = [function(content){
      return content.replace(/(;;;|\/\*\*\s*@cut.*?\*\/).*([\r\n]|$)/g, '$2');
    }];

  this.plugins = initPlugins(this, options.plugins);
}

Flow.prototype = {
  exitOnFatal: false,

  time: function(){
    return Date.now() - this.startTime;
  },

  exit: function(message){
    this.warn({
      fatal: true,
      message: message
    });
    throw new Error(message);
  },

  warn: function(warn){
    this.warns.push(warn);

    if (warn.fatal)
    {
      if (this.exitOnFatal)
      {
        if (typeof process.send == 'function')
          process.send({
            errorType: 'Fatal',
            error: warn.message
          });

        this.console.resetDeep();
        this.console.enabled = true;
      }

      this.console.log.apply(this.console, [chalk.enabled ? chalk.bgRed.white('FATAL') : '[FATAL]'].concat(warn.message));

      if (this.exitOnFatal)
        process.exit(2);
    }
    else
    {
      this.console.log.apply(this.console, [chalk.enabled ? chalk.bgRed.white('WARN') : '[WARN]'].concat(warn.message));
    }
  },
  removeWarn: function(warn){
    var idx = this.warns.indexOf(warn);
    if (idx != -1)
      this.warns.splice(idx, 1);
  },
  hasWarn: function(warn){
    return this.warns.some(function(flowWarn){
      return warn.fatal == flowWarn.fatal &&
             warn.file == flowWarn.file &&
             warn.loc == flowWarn.loc &&
             warn.message == flowWarn.message;
    });
  }
};

module.exports = Flow;
