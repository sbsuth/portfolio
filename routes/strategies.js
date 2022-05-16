var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_strategies = 1;
/*
 * GET monitors.
 */
router.get('/strategies/', login.validateUser, function(req, res) {
	var session = req.session;
	var system_name = req.params.system_name;
	var utils = req.utils;

	if (debug_strategies) {
		console.log("STRATEGIES: get : ");
	}


	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/strategies.c.js" );
	d.title = "Strategies";
	res.render("strategies", d );
});

module.exports = {
	router: router,
	name: "strategies",
};
