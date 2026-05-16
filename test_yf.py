import yfinance as yf
t = yf.Ticker('026960.KS')
print(t.info.get('sharesOutstanding'))
hist = yf.download('026960.KS', period='5y', auto_adjust=True, actions=True)
print(hist[hist['Dividends'] > 0]['Dividends'])
