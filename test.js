var MongoClient = require('mongodb').MongoClient;
MongoClient.connect("mongodb://localhost:27017/finance", function (err, db) {
    
	console.log("HEY: connect: err="+err);
    db.collection('test', function (err, collection) {
		console.log("HEY: collection: err="+err+", collection="+JSON.stringify(collection));
	});
});
