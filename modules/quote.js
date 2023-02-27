const yahooFinance = require('yahoo-finance2').default;

async function getPrices(tickers) 
{
	let rslts = await yahooFinance.quote(
		tickers,
		{return: "object"},
		{ fields: [ "regularMarketPrice" ],  validateResult: false });
		//"3137AK4T5",
		//"31396HFY0",
	for ( let i=0; i < tickers.length; i++ ) {
		let p = rslts[tickers[i]];
		if (p != undefined) {
			p = p.regularMarketPrice;
		}
		console.log(tickers[i]+": "+JSON.stringify(p));
	}
}

async function test() {
	let tickers = [
		"QLGN",
		"TLT",
		"CDNS",
		"AGG",
		"SWPPX",
		"MSFT",
		"SNAXX",
		"3136A2WJ8",
	];
	await getPrices(tickers);
}


module.exports = {
    getPrices : getPrices,
	test: test
}
