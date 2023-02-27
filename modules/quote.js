const yahooFinance = require('yahoo-finance2').default;

async function getPrice(ticker) {
	try {
		let rslt = await yahooFinance.quoteCombine({
		  symbol: ticker,
		  modules: ['price']       // optional; default modules.
		});
		return rslt.price.regularMarketPrice;
	} catch (err) {
		return -1.0;
	}
}
async function test() 
{
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
	let rslts = await yahooFinance.quote(
		tickers,
		{return: "object"},
		{ fields: [ "regularMarketPrice" ],  validateResult: false });
		//"3137AK4T5",
		//"31396HFY0",
	console.log(JSON.stringify(rslts));
	for ( let i=0; i < tickers.length; i++ ) {
		let p = rslts[tickers[i]];
		if (p != undefined) {
			p = p.regularMarketPrice;
		}
		console.log(tickers[i]+": "+JSON.stringify(p));
	}
}

(async () => {
	await test();
	process.exit(0);
})();

