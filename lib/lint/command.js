var path = require('path');
var clap = require.main.require('clap');
var common = require('../common/command.js');
var isChildProcess = typeof process.send == 'function'; // child process has send method

function resolveCwd(value){
  return path.resolve(process.env.PWD || process.cwd(), value);
}

function normOptions(options){
  common.normalize(options);

  return options;
}

module.exports = clap.create('lint', '[fileOrPreset]')
  .description('Lint source code and output report')
  .extend(common)

  .init(function(){
    var config = this.context.config = this.root.getConfig(this.values);
    if (config)
    {
      this._configPath = config.path;
      config = common.processConfig(this, config);

      for (var key in config)
        if (key == 'preset')
          this.presets = config.preset.reduce(function(result, preset){
            result[preset.name] = preset.config;
            return result;
          }, {});
        else
          this.setOption(key, config[key]);
    }
  })
  .args(function(args){
    var value = args[0];

    if (this.presets)
    {
      if (this.values.preset)
        throw new clap.Error('Value for --preset option is already set');

      if (value in this.presets == false)
        throw new clap.Error('Preset `' + value + '` doesn\'t found');

      return this.setOption('preset', value);
    }

    this.setOption('file', resolveCwd(value));
  })

  .option('--preset <name>', 'Preset settings to use', { hot: true, beforeInit: true })

  .option('--no-color', 'Suppress color output')
  .option('--silent', 'No any output')

  .option('--filter <filename>', 'Show warnings only for specified file', resolveCwd)
  .option('-r, --reporter <name>', 'Reporter console (default), checkstyle, junit',
    function(reporter){
      var reporters = ['console', 'checkstyle', 'junit'];

      if (reporters.indexOf(reporter) == -1)
        throw 'Wrong value for --reporter: ' + reporter;

      return reporter;
    }
  )

  .action(function(){
    var values = common.processPresets(this, 'lint');

    if (values)
      require('./index.js').lint.call(this, values);
  });

if (isChildProcess)
  module.exports
    .option('--process-config <config>', 'For internal usage only', function(value){
      this.setOptions(JSON.parse(value));
    });

module.exports.norm = normOptions;
module.exports.getParallelOptions = function(){
  var command = this;
  if (command.values.reporter)
    return {
      silent: true,
      callback: function(res){
        var reporter = require(require('./reporter')[command.values.reporter]);
        var data = require('./reporter/parallel-process-warns.js')(res);
        console.log(reporter(data));
      }
    };
};
