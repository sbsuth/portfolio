var createError = require('http-errors');
var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var logger = require('morgan');
var session = require('express-session')
var MongoStore = require('connect-mongo')
var positions = require('./modules/positions');
var utils = require("./modules/utils");

var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/finance');

var index = require('./routes/index');
var users = require('./routes/users');
var login = require('./routes/login');
var strategies = require('./routes/strategies');
var assets = require('./routes/assets');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
var dust = require('dustjs-linkedin')
var cons = require('consolidate')
app.engine('dust', cons.dust);
app.set('view engine', 'dust');

utils.db = db;

// Session setup.
app.use(session({
	secret: 'IBelieve',
	saveUninitialized: false, // don't create session until something stored
	resave: false, //don't save session if unmodified
	store: MongoStore.create({
		mongoUrl: 'mongodb://localhost/finance?w=1',
		touchAfter: 24 * 3600 // time period in seconds
	})
}));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/js', express.static(__dirname + '/public/javascripts')); 
app.use('/css', express.static(__dirname + '/public/stylesheets')); 

// bootstrap and jquery links
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js')); // redirect bootstrap JS
app.use('/js', express.static(__dirname + '/node_modules/jquery/dist')); // redirect JS jQuery
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css')); // redirect CSS bootstrap
app.use('/js', express.static(__dirname + '/node_modules/bootstrap-checkbox/dist/js')); // redirect bootstrap JS
app.use('/js', express.static(__dirname + '/node_modules/bootstrap-select/dist/js')); // redirect bootstrap JS
app.use('/fonts', express.static(__dirname + '/node_modules/bootstrap/fonts')); 
app.use('/js', express.static(__dirname + '/bower_components/crypto-js')); // redirect crypto-js
app.use('/js', express.static(__dirname + '/node_modules/chart.js/dist')); // chart.js
app.use('/js', express.static(__dirname + '/node_modules/chart.js/node_modules/moment')); // moment.js
// Filter to add app-level objects to the request.
app.use(function(req,res,next){
    req.db = db;

	req.dust = dust;
	req.utils = utils;
	utils.init_session(req,next);
});

app.use('/', index);
app.use('/users', users);
app.use('/', login.router);
app.use('/', strategies.router);
app.use('/', assets.router);

utils.addDataDir("./data_files");
//utils.getTickers().then(rslt=>{console.log(rslt)});
//utils.importTickers("etfs.csv");
//positions.test().then(rslt=>{process.exit()});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

console.log("Ready");

module.exports = app;
