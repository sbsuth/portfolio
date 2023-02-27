var fs = require('fs');
const utils = require('./utils');
const csv = require('csv-parser')
const {NodeSSH} = require('node-ssh')
const ssh = new NodeSSH();

const username = "sbsuth"; // get from session eventually

// Create a Date from the date strings found in schwab CSV dumps.
// Example: "08:06 PM ET, 01/30/2022"
// We parse it and create a date string for the constructor.
// Presume its GMT-5
function schwabDateStringToDate( ds )
{
	let fields=ds.split(" ");
	let hm = fields[0].split(":");
	hm[0] = parseInt(hm[0]);
	hm[1] = parseInt(hm[1]);
	if (fields[1] == "PM") {
		hm[0] = hm[0] + 12;
	}
	let mdy = fields[3].split("/");

	const t = new Date();
	t.setMonth(mdy[0] - 1);
	mdy[0] = t.toLocaleString('en-US', { month: 'short' });


	let ds2 = mdy[0]+" "+mdy[1]+" "+mdy[2]+" "+hm[0]+":"+hm[1]+":00 GMT-5";
	return new Date(ds2);
}

// Parses a Schwab positions CSV.
// This is an older version that uses the node csv parser, which no longer works with newer schwab csv files.
// Replacement is parseSchwabPositions()
async function parseSchwabPositionsUsingCSVParser( file)
{
	const path = utils.dataFilePath(file);
	if (path == "") {
		throw new Error("Position file \'"+file+"\' not found");
	}
	
    const strm = utils.genForCSV( path );
	let account = "";
	let colIndexes = {};
	let rslt = { date: undefined,
				 positions : []
			   }
    for await (const row of strm) {
		let keys = Object.keys(row);
		// We get a row with one cell and a fullsized set of empty string columns
		// that gives us 2 keys, where the second one is an empty string.
		// Make that one key.
		if ((keys.length == 2) && (keys[0] != "") && (keys[1] == "")) {
			keys = [keys[0]];
		}
		let len = keys.length;
		let cell = keys[0];
		if (!rslt.date && cell) {
			// The top left cell has the date of the dump.  It ends up being
			// the key for every row.
			let prefix = "Positions for All-Accounts as of ";
			if ((cell.length > prefix.length) && (cell.substr(0,prefix.length) == prefix)) {
				rslt.date = schwabDateStringToDate(cell.replace(prefix,""));
			}
		}
		if (keys.length == 0) {
			colIndexes = {};
			continue;
		} else if (keys.length == "1") {
			// Each account is preceded by a 1-column row giving the name.
			let label = row[keys[0]];
			let acc_info = await utils.db.get('accounts').find( 
							{label: label});
			if (acc_info.length > 0) {
				account = acc_info[0].number;
			} else {
				account = "";
			}
			colIndexes = {};
		} else if (account != "") {
			if (row[keys[0]] == "Symbol") {
				// These are column headings
				for ( let i=0; i < keys.length; i++ ) {
					colIndexes[row[keys[i]]] = i;
				}
			} else if (row[keys[0]] == "Account Total") {
			} else {
				let record = {
					symbol : row[keys[colIndexes.Symbol]].replace('Cash & Cash Investments','CASH'),
					descr : row[keys[colIndexes.Description]].replace('--',''),
					quantity : row[keys[colIndexes.Quantity]].replace(',','').replace('--',''),
					basis : row[keys[colIndexes["Cost Basis"]]].replace(',','').replace('--',''),
					account : account
				};
				rslt.positions.push(record);
			}
		}
	}
	return rslt;
}
// Parse CSV file with Schwab positions.
// This version doesn't use the csv parser as it stopped working with the schwab data files.
//
// The file's first row has a title that includes a date, which we use as the date field of the result.
// There is then a section for each account, separated by an empty row, and headed by a 1-column 
// row containing an account label.  We match these to an account's label field in the database.
// At the start of each account is a set of rows with column headers.  We identify the columns
// we want by matching these headers.
// Data for each security is on a subsequent row, with data for each column.
//
// Returns a date, and an array of position records containing:
//  {symbol: descr: quantity: basis: account:}
//
// where account is its number.
async function parseSchwabPositions( file)
{
	const path = utils.dataFilePath(file);
	if (path == "") {
		throw new Error("Position file \'"+file+"\' not found");
	}
	
    const strm = utils.genForFile( path );
	let account = "";
	let colIndexes = {};
	let rslt = { date: undefined,
				 positions : []
			   }
    for await (const rawRow of strm) {
		let row = rawRow.replace(/\",\"/g,"|").replace(/^\"/,"").replace(/\"$/,"");
		let cells = row.split("|");
		let cell0 = cells[0];
		let ndata = 0;
		for ( let icell=0; icell < cells.length; icell++) {
			if (cells[icell] != "") {
				ndata++;
			}
		}
		if (ndata == 0) {
			// Between accounts.
			colIndexes = {};
			continue;
		} else if (ndata == 1) {
			let prefix = "Positions for All-Accounts as of ";
			if (!rslt.date && (cell0.startsWith(prefix))) {
				// The top left cell has the date of the dump.
				rslt.date = schwabDateStringToDate(cell0.replace(prefix,""));
				continue;
			}
			let acc_info = await utils.db.get('accounts').find( 
							{label: cell0});
			if (acc_info.length > 0) {
				account = acc_info[0].number;
			} else {
				account = "";
			}
			colIndexes = {};
		} else if (account != "") {
			if (cell0 == "Symbol") {
				// These are column headings
				for ( let i=0; i < cells.length; i++ ) {
					colIndexes[cells[i]] = i;
				}
			} else if (cell0 == "Account Total") {
			} else {
				let record = {
					symbol : cells[colIndexes.Symbol].replace('Cash & Cash Investments','CASH'),
					descr : cells[colIndexes.Description].replace('--',''),
					quantity : cells[colIndexes.Quantity].replace(',','').replace('--',''),
					basis : cells[colIndexes["Cost Basis"]].replace(',','').replace('--',''),
					account : account
				};
				rslt.positions.push(record);
			}
		}
	}
	return rslt;
}

// Imports positions data from the given CSV file to the database, replacing any 
// with the same date stamp if replace is true.
async function importSchwabPositions( username, file, replace=false )
{
	let data = await parseSchwabPositions( file );
	data.username = username;
	let positions_coll = utils.db.get("positions");
	let query = {username: username, date: data.date};
	if (!replace) {
		// Look for an existing one if we're not replacing.
		let existing = await positions_coll.find(query);
		if (existing.length > 0) {
			console.log("returnnig existing");
			return existing[0]._id;
		}
	}
	// Do an upsert.
	let rslt = await positions_coll.findOneAndUpdate( query, {$set: data}, {upsert: true, new: true} );
	console.log("id is "+rslt._id);
	return rslt._id;
}

// Gets the newest All-Accounts-Positions*.csv file on the PC stored
// for the current user and imports it.  Replaces a file for the same date
// only if 'replace' is true.
async function importNewestSchwabPositionsCSV( username, replace=false )
{
    let userData = await utils.db.get('users').find({username: username});
	let pc_name = userData[0].pc_name;
	let pc_username = userData[0].pc_username;
	let pc_download_dir = userData[0].pc_download_dir;

	let dirContents = "";
	let aaPrefix = "All-Accounts-Positions";
	try {
		await ssh.connect({
			host: pc_name,
			username: pc_username,
			privateKeyPath: "/home/sbs/.ssh/id_rsa"
		});
		dirContents = await ssh.execCommand("dir /d "+pc_download_dir+"\\"+aaPrefix+"*.csv");
	} catch (err) {
		throw new Error("Error reading Schwab positions CSV from PC: "+err.message);
	}
	var lines = dirContents.stdout.split(/\r?\n|\r|\n/g);
	let newest = "";
	lines.forEach( (line) => {
	  if (line.startsWith(aaPrefix)) {
		newest = line;
	  }
	});
	if (newest == "") {
		throw new Error("No Schwab positions files found");
	}
	let localPath = "./data_files/"+newest;
	try {
		await ssh.getFile( localPath, pc_download_dir+"\\"+newest);
	} catch (err) {
		throw new Error("Error copying Schwab positions CSV \'"+newest+"\' from PC: "+err.message);
	}
	try {
		await importSchwabPositions( username, newest, replace );
	} catch (err) {
		throw new Error("Error importing Schwab positions CSV \'"+newest+"\': "+err.message);
	}
	console.log("Imported "+newest);
}

// Returns an array of dates for positions records, sorted from newest to oldest.
async function getPositionDates()
{
	let posCol = utils.db.get("positions");
	let options = {sort: {date: -1}};
	let pos = await posCol.find( {}, options );
	let rslt = [];
	for ( let i=0; i < pos.length; i++) {
		rslt.push( pos[i].date );
	}
	return rslt;
}

// Gets a single positions record.
// If a date is given, gets any matching that date.
// If no date is given, returns the latest.
async function getPositions(date)
{
	let posCol = utils.db.get("positions");
	let options = {sort: {date: -1}, limit: 1};
	let query = {};
	if (date) {
		query.date = date;
	}
	let rslt = await posCol.find( query, options );
	if (!rslt || (rslt.length < 1)) {
		throw new Error("No positions for date \'"+date+"\' found");
	}
	return rslt[0];
}

// Returns a positions data record, which includes a date, and a positions array.
// If no date is given, returns the most recent.
async function getPositionData(date)
{
	let pos = await getPositions(date);
	if (pos) {
		return pos.positions;
	} else {
		return undefined;
	}
}

async function getOverall(name,date)
{
	let stratCol = utils.db.get("strategies");
	let options = {sort: {date: -1}, limit: 1};
	let query = {kind: "overall"};
	if (date) {
		query.date = date;
	}
	if (name) {
		query.name = name;
	}
	let rslt = await stratCol.find( query, options );
	if (!rslt || (rslt.length != 1)) {
		throw new Error("No overall strategy named \'"+name+"\' found");
	}
	return rslt[0];
}

async function getAllocsForOverall(overall,name,date)
{
	let rslt = [];
	for ( let i=0; i < overall.allocations.length; i++ ) {
		let alloc = overall.allocations[i];
		let stratCol = utils.db.get("strategies");
		let options = {sort: {date: -1}, limit: 1};
		let query = {name: alloc.strategy_name};
		if (date) {
			query.date = date;
		}
		let strat = await stratCol.find( query, options );
		if (!strat || (strat.length != 1)) {
			throw new Error("No strategy named \'"+alloc.strategy_name+"\' found, query="+JSON.stringify(query)+", options="+JSON.stringify(options));
		}
		rslt.push(strat[0]);
	}
	return rslt;
}

async function resolveAllocsToPositions( overall, allocs, positions )
{
	// Build an array of resolutions, indexed by position ticker name.
	// This will include 
	let resolutions = {};
	for ( let ipos=0; ipos < positions.positions.length; ipos++) {
		let pos = positions.positions[ipos];
		let res = resolutions[pos.symbol];
		if (res == undefined) {
			// May not be undefined since one security may be in multiple accounts.
			res = {
				total_shares: 0,
				alloc_refs: [],
				pos_refs: []
			};
		}
		res.total_shares += Number(pos.quantity);
		res.pos_refs.push(pos);
		resolutions[pos.symbol] = res;
	}

	// Traverse allocations and resolve.
	for ( ialloc=0; ialloc < allocs.length; ialloc++) {
		let alloc = allocs[ialloc];
		for ( let ipos=0; ipos < alloc.allocations.length; ipos++ ) {
			let alloc_pos = alloc.allocations[ipos];
			let res = resolutions[alloc_pos.symbol];
			if (res == undefined) {
				res = {
					total_shares: 0,
					alloc_refs: [],
					pos_refs: []
				}
				resolutions[alloc_pos.symbol] = res;
			}
			if ((alloc.kind == "target") && (alloc_pos.pct_target != undefined)) {
				// Targets give percents, not number of shares.
				// Set quantity based on pct_target of the total shares in the position.
				alloc_pos.shares = Number(res.total_shares) * (Number(alloc_pos.pct_target)/100.0);
			} else if ((alloc.kind == "ignore") && (alloc_pos.shares == undefined)) {
				// For ignored positions, the shares are set to how many we have.
				alloc_pos.shares = res.total_shares;
			} else {
			}

			// Each reference record has a reference to the alloc, and diff value.
			// The diff is against the total shares, so if a position is to be divided
			// between allocations, there will be a large positive diff at this point.
			let diff = {
				alloc: alloc,
				diff: res.total_shares - alloc_pos.shares
			};
			res.alloc_refs.push(diff);
		}
	}
	for (const [symbol, ares] of Object.entries(resolutions)) {
		console.log(symbol+": "+ares.total_shares+" shares: "+ares.alloc_refs.length+" allocs refd, "+ares.pos_refs.length+" accts refd");
		for ( let iref=0; iref < ares.alloc_refs.length; iref++ ) {
			let alloc_ref = ares.alloc_refs[iref];
			console.log("    "+alloc_ref.alloc.name+": "+alloc_ref.diff+" diff");
		}
		for ( let iref=0; iref < ares.pos_refs.length; iref++ ) {
			let pos_ref = ares.pos_refs[iref];
			console.log("    "+pos_ref.account+": "+pos_ref.quantity);
		}
	}
}

async function test(name,date)
{
	try {
		if (0) {
		let overall = await getOverall(name,date);
		if (!overall) {
			return undefined;
		}
		let allocs = await getAllocsForOverall(overall);
		let positions = await getPositions();
		for ( let ipos=0; ipos < positions.positions.length; ipos++) {
			console.log("HEY: position: "+JSON.stringify(positions.positions[ipos]));
		}
		//console.log("HEY: positions="+JSON.stringify(positions));
		//let diffs = await resolveAllocsToPositions( overall, allocs, positions );
		}
		if (1) {
		await importNewestSchwabPositionsCSV(username,true);
		await getPositions();
		}

	} catch (err) {
		console.log("ERROR: " + err.message);
		//console.log(err);
		process.exit();
	}
	return undefined;
}

module.exports = {
    importSchwabPositions: importSchwabPositions,
    parseSchwabPositions: parseSchwabPositions,
	importNewestSchwabPositionsCSV: importNewestSchwabPositionsCSV,
	getPositionData: getPositionData,
	getPositionDates: getPositionDates,
	test: test
}
