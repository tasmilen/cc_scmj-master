var pomelo = require('pomelo');

/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'server_pomelo');

// 加载mysql的配置
app.loadConfig("mysqlConfig", app.getBase() + "/config/mysql.json");

// app configuration
app.configure('production|development', 'connector', function(){

  // 加载 knex
  const mysqlConfig = app.get('mysqlConfig');

  // TODO 单独引入不挂载到 app
  const db = require('./app/utils/db');
  const knex = db.init(mysqlConfig);
  app.set("knex", knex);// app.get("knex") 来使用

  app.set('connectorConfig',
    {
      connector : pomelo.connectors.hybridconnector,
      heartbeat: 20,
      timeout: 40,
      useDict : true,
      useProtobuf : true
    });
});

// start app
app.start();

process.on('uncaughtException', function (err) {
  console.error(' Caught exception: ' + err.stack);
});
