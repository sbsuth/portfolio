var fs = require('fs');
const utils = require('./utils');
const csv = require('csv-parser')

// Parses a Schwab positions CSV.
//
// The column name feature is useless since there is a single title in the first cell.
// Each account has a separate section. Account labels appear on rows with no other values.
// Each account's positions is preceded by a row of titles.  We parse each of these to get
// the position of our desired data, so we only need to update if they change titles,
// not column positions.
// Validates account labels against DB, and ignores those not in the DB.
//
// Returns an array of position records containing:
//  {symbol: descr: quantity: basic: account:}
//
// where account is its number.
async function importSchwabPositions( file, utils )
{
	const path = utils.dataFilePath(file);
	if (path == "") {
		throw new Error("Position file \'"+file+"\' not found");
	}
	
    const strm = utils.genForCSV( path );
	let account = "";
	let colIndexes = {};
	let rslt = [];
	let date = undefined;
    for await (const row of strm) {
		let keys = Object.keys(row);
		let len = keys.length;
		let cell = keys[0];
		if (!date && cell) {
			// The top left cell has the date of the dump.  It ends up being
			// the key for every row.
			let prefix = "Positions for All-Accounts as of ";
			if ((cell.length > prefix.length) && (cell.substr(0,prefix.length) == prefix)) {
				date = cell.replace(prefix,"");
				console.log(date);
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
				rslt.push(record);
			}
		}
	}
	return rslt;
}

module.exports = {
    importSchwabPositions: importSchwabPositions
}
