var express = require('express');
var router = express.Router();
var login = require('./login')

var debug_assets = 1;
/*
 * GET monitors.
 */
router.get('/assets/', login.validateUser, function(req, res) {
	var session = req.session;
	var system_name = req.params.system_name;
	var utils = req.utils;

	if (debug_assets) {
		console.log("ASSETS: get : ");
	}


	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/assets.c.js" );
	d.title = "Assets";
	res.render("assets", d );
});

module.exports = {
	router: router,
	name: "assets",
};
