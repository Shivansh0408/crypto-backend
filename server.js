// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const { HmacSHA256 } = require('crypto-js');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;

// 🔐 Signature Generator
const generateSignature = (data) => {
  const message = typeof data === 'string' ? data : JSON.stringify(data);
  return HmacSHA256(message, SECRET_KEY).toString();
};

// ✅ Route: Get BTC Balance
app.get('/api/balance', async (req, res) => {
  try {
    const timestamp = Date.now().toString();
    const signature = generateSignature(timestamp);

    const response = await axios.get(`https://api.coindcx.com/exchange/v1/users/balances?timestamp=${timestamp}`, {
      headers: {
        'X-AUTH-APIKEY': API_KEY,
        'X-AUTH-SIGNATURE': signature,
      },
    });

    const balances = response.data;
    const btcBalance = balances.find(b => b.currency === 'BTC');
    res.json(btcBalance || { currency: 'BTC', balance: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch BTC balance', details: err.message });
  }
});

// ✅ Route: Place Buy/Sell Order for BTCINR
app.post('/api/order', async (req, res) => {
  // Accept both the original parameters and the new reference-style parameters
  const { side, qty, quantity, price } = req.body;
  
  // Use qty if provided, otherwise use quantity (for reference-style orders)
  const finalQty = qty || quantity;
  
  if (!side || !finalQty) {
    return res.status(400).json({ error: 'side and quantity/qty required' });
  }

  try {
    const orderPayload = {
      side: side,
      order_type: "market_order",
      market: "BTCINR",
      total_quantity: parseFloat(finalQty),
      timestamp: Date.now()
    };

    const signature = generateSignature(JSON.stringify(orderPayload));

    const response = await axios.post('https://api.coindcx.com/exchange/v1/orders/create', orderPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': API_KEY,
        'X-AUTH-SIGNATURE': signature
      }
    });

    res.json({ success: true, data: response.data });
  } catch (err) {
    res.status(500).json({ error: 'Trade failed', details: err.response?.data || err.message });
  }
});


// ✅ Route: Get BTCINR Price
app.get('/api/price', async (req, res) => {
  try {
    const response = await axios.get('https://api.coindcx.com/exchange/ticker');
    const btcTicker = response.data.find(t => t.market === 'BTCINR');
    res.json(btcTicker || { market: 'BTCINR', last_price: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch price', details: err.message });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ CoinDCX backend running on http://localhost:${PORT}`);
});
