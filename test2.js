var mongo = require('mongodb');
var monk = require('monk');
//var db = monk('192.168.227.150:27017/finance');
var db = monk('localhost:27017/finance');

async function testDB() {
	var test = db.get('test');
	var rslt = await test.find({});
	console.log( "HEY: rslt="+JSON.stringify(rslt));
}

(async () => {
	await testDB();
	process.exit(0);
})();

 
