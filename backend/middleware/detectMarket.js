const { detectMarketFromAcceptLanguage } = require('../config/markets');
const { detectCountryFromRequest } = require('../config/geoPricing');

function detectMarket(req, res, next) {
  req.detectedMarket = detectMarketFromAcceptLanguage(req.headers['accept-language'] || '');
  req.detectedCountry = detectCountryFromRequest(req);
  next();
}

module.exports = detectMarket;
