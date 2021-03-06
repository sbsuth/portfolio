var SHA256 = require("crypto-js/sha256");
var argv = process.argv;
var username = argv[2];
var pwd = argv[3];
if (!username || !pwd) {
	console.log("ERROR: Must specify username and password.");
	process.exit(1);
}
console.log("start="+pwd);
console.log("1="+SHA256(pwd));
hashed = SHA256(String(SHA256(pwd)));
console.log("2="+hashed);
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/finance');
	var users = db.get('users');
	users.find({username: username}).then( (doc) => {
		if (doc.length == 1) {
			console.log("Updating password for "+username);
			users.update( {username: username}, {$set: {password: String(hashed)}}, function(err,doc,next) {
				if (err) {
					console.log("ERROR: "+err);
				}
				process.exit();
			});
		} else {
			console.log("ERROR: Unrecognized user \'"+username+"\'");
			process.exit();
		}
    });
