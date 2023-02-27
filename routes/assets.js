var express = require('express');
var router = express.Router();
var login = require('./login')
var positions = require('../modules/positions');

var debug_assets = 1;
/*
 * GET monitors.
 */
router.get('/assets/', login.validateUser, async function(req, res) {
	var session = req.session;
	var system_name = req.params.system_name;
	var utils = req.utils;

	if (debug_assets) {
		console.log("ASSETS: get : ");
	}


	var d = utils.get_master_template_data(req);
	d.load_javascript.push( "/js/assets.c.js" );
	d.title = "Assets";
	d.accounts = [
		{
			label: "All accounts",
			titles: ["Ticker","Shares","Price","Value"],
			assets: []
		}
	];
	let posData = await positions.getPositionData();
	for ( let ipos=0; ipos < posData.length; ipos++) {
		let assets = d.accounts[0].assets;
		let pos = posData[ipos];
		assets.push( {
			ticker: pos.symbol,
			descr: pos.descr,
			shares: pos.quantity, 
			price: 0.0,
			basis: pos.basis, 
			account: pos.account 
		});
	}
	res.render("assets", d );
});

module.exports = {
	router: router,
	name: "assets",
};
