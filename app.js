var express = require("express");
var i18n = require("i18n");

var app = express();
app.use(express.logger());

app.use(function staticsPlaceholder(req, res, next) {
    return next();
});

var server = require("http").createServer(app);
var io = require("socket.io").listen(server);

require("./secret.js");
var socket = require("./socket.js");

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/app');
  //app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.static(__dirname + '/app'));
  //app.use(i18n.init);
  app.use(app.router);
  app.engine('html', require('ejs').renderFile);
});

app.get('/', function(request, response) {
  response.render('index.html')
});

io.configure(function () {
    io.set("authorization", function (handshakeData, callback) {
        i18n.init(handshakeData);
        callback(null, true);
    });
});

io.sockets.on("connection", socket);

exports = module.exports = server;

exports.use = function() {
    app.use.apply(app, arguments);
};

/*
var port = process.env.PORT || 9000;
server.listen(port, function() {
  console.log("Listening on " + port);
});
*/