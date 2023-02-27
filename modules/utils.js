var request = require('request');
var mongo = require("mongodb");
var fs = require('fs');
const readline = require('readline');
const csv = require('csv-parser')

// File-scoped variables.
var dust = 0;


// Called from an early filter to initialize the session.
// Initializes the data in the session if its not already initialized.
function init_session( req, next )
{
	var session = req.session;
	if (session.user != undefined) {
		next();
	} else {
		next();
	}

}

// Clear out the session when logging out.
function clear_session( session )
{
	session.user = undefined;
}

// Fill an object with the basic info needed from the session
// for the master template.
function get_master_template_data( req ) {

	var d = { session: req.session,
			  load_javascript: [],
			};
	return d;
}

function send_error( res, msg ) 
{
	console.log( "ERROR returned: \'"+msg+"\'");
    res.send({
      message: msg,
      msg: msg,
      error: 400
    });
}

function json_resp_header() {
	var header = "HTTP/1.1 200 OK\r\n";
	header += "Content-Type: application/jsonrequest\r\n";
	header += "Content-Length: ";
	return header;
}

function http_wrap (msg) {
	var jmsg = json_resp_header() + msg.length + "\r\n\r\n" + msg;
	return jmsg;
}



function send_text_msg( title, content )
{
	var mail = cp.spawn('mail', ["-s", title, "4254177661@txt.att.net"]);
	mail.stdin.write(content);
	mail.stdin.end();
}

// Interprets a string given a type.
// Retuns {val,err} where val is the typed value, and err is set if there was a problem.
function decode_value( str, type ) {
	var value = undefined;
	var err = undefined;
	switch (type) {
		case "bool":
			if ((str == "1") || (str == "true")) {
				value = true;
			} else if ((str == "0") || (str == "false")) {
				value = false;
			} else {
				err = "Must specify true, false, 1, or 0";
			}
			break;
		case "int":
			value = Number.parseInt(str);
			if (Number.isNaN(value)) {
				err = "Must specify an integer.";
			}
			break;
		case "int_arr":
			value = [];
			if (str != "none") {
				var values = str.split(',');
				for (var i=0; i < values.length; i++ ) {
					var ival = Number.parseInt(values[i]);
					if (Number.isNaN(value)) {
						err = "Must specify an integer.";
					} else {
						value.push(ival);
					}
				}
			}
			break;
		case 'real':
			value = Number.parseFloat(str);
			if (Number.isNaN(value)) {
				err = "Must specify real number";
			}
			break;
		case 'int10':
			// Specified as real, mult by 10 and store as int. 
			value = Number.parseFloat(str);
			if (Number.isNaN(value)) {
				err = "Must specify real number";
			} else {
				value = Math.floor(value * 10.0);
			}
			
			break;
		case 'str':
			value = str;
			break;
		case 'time':
			// A time from Date() in ms.
			value = new Date(str).toLocaleString();
			break;
		case 'tod':
			// Value is [hour,min], format is hour:min
			var vals = str.split(":");
			if (vals.length != 2)  {
				err = "Must specify \'hour:min\'";
			} else {
				var hour = Number.parseInt(vals[0]);
				var min = Number.parseInt(vals[1]);
				if ( Number.isNaN(hour) || (hour < 0) || (hour > 23)) {
					err = "Hours must be from 0-23.";
				} else if ( Number.isNaN(hour) || (min < 0) || (min > 59)) {
					err = "Minutes must be from 0-59."
				} else {
					value = [hour,min];
				}
			}
			break;
		case 'hms':
			// Value is 'sec', format is hour:min[:sec]
			var vals = str.split(":");
			if (vals.length < 2)  {
				// Take value directly as seconds.
				var sec = Number.parseInt(vals[0]);
				value = sec;
			} else {
				var hour = Number.parseInt(vals[0]);
				var min = Number.parseInt(vals[1]);
				var sec = (vals.length > 2) ? Number.parseInt(vals[2]) : 0;
				if ( Number.isNaN(hour) || (hour < 0) || (hour > 23)) {
					err = "Hours must be from 0-23.";
				} else if ( Number.isNaN(hour) || (min < 0) || (min > 59)) {
					err = "Minutes must be from 0-59."
				} else {
					value = hour*3600 + min*60 + sec;
				}
			}
			break;
		default: 
			err = "Unrecognized type \'"+type+"\'";
			break;
	}
	return {value: value, err: err};
}

// returns a mongo ObjectID for a Date.
function mongo_id_for_time( t ) {
	var hexSeconds = Math.floor(t/1000).toString(16);
	var objt = new mongo.ObjectID(hexSeconds + "0000000000000000");
	return objt;
}


async function* genForStream(strm) {
  for await (const chunk of strm) {
    yield chunk;
  }
}

// Returns an async generator with rows from the CSV file at the given path.
async function* genForCSV(csvPath) {
  const strm = genForStream( fs.createReadStream(csvPath).pipe(csv()) );
  for await (const chunk of strm) {
    yield chunk;
  }
}

// Returns an async generator with lines from the file at the given path.
async function* genForFile(path) {
	const rl = readline.createInterface({
		input: fs.createReadStream(path),
		crlfDelay: Infinity
	});
	for await (const line of rl) {
		yield line;
	}
}

var dataDirs = [];

function addDataDir(dir) {
    dataDirs.push(dir);
}


function dataFilePath(file) {
	for ( var i=0; i < dataDirs.length; i++) {
		var path = dataDirs[i] + "/" + file;
		if (fs.existsSync(path)) {
			return path;
		}
	}
    return "";
}

function tickerCsvPath(ticker) {
    return dataFilePath(ticker + ".csv");
}


// Import a CSV file containing ticker data from my ETF sheet.
// This should be replaced by direct access to the sheet.
async function importTickers(file) {
	let utils = this;
	const path = utils.dataFilePath(file);
	if (path == "") {
		throw new Error("Tickers file \'"+file+"\' not found");
	}
	
    const strm = utils.genForCSV( path );
	let rslt = { date: undefined,
				 positions : []
			   }
	let tickers = utils.db.get("tickers");
    for await (const row of strm) {
		let ticker = row['Ticker'];
		let val = {	'ticker': ticker,
					'name': row['Name'], 
					'class': row['Class'], 
					'subclass': row['Sub class']
				  };
		let query = { "ticker": ticker };
		await tickers.update( query, val, {'replaceOne': true, 'upsert': true} );
	}
}

// Load ticker data into an object whose keys are tickers.
async function getTickers(refresh) {
	var utils = this;
	if (utils.tickers && !refresh) {
		return utils.tickers;
	}
	let tickers = utils.db.get("tickers");
	let data = await tickers.find();
	let rslt = {};
	for ( let i=0; i < data.length; i++ ) {
		let d = Object.assign({},data[i]);
		rslt[d.ticker] = d;
		delete d._id;
		delete d.ticker;
	}
	utils.tickers = rslt;
	return rslt;
}

module.exports = {
	init_session: init_session,
	clear_session: clear_session,
	get_master_template_data: get_master_template_data,
	send_error: send_error,
	send_text_msg: send_text_msg,
	decode_value: decode_value,
	mongo_id_for_time: mongo_id_for_time,
    genForStream: genForStream,
    genForCSV: genForCSV,
    genForFile: genForFile,
	addDataDir: addDataDir,
	tickerCsvPath: tickerCsvPath,
	dataFilePath: dataFilePath,
	importTickers: importTickers,
	getTickers: getTickers
}
