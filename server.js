// server.js - Fixed Version
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const crypto = require('crypto'); // Use native crypto

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const API_KEY = process.env.API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;

// 🔐 Fixed Signature Generator
const generateSignature = (data) => {
  const message = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHmac('sha256', SECRET_KEY)
               .update(message)
               .digest('hex');
};

// ✅ Fixed Route: Place Buy/Sell Order
app.post('/place-order', async (req, res) => {
  const { market, orderType, side, quantity, price } = req.body;
  
  // Validation
  if (!market || !orderType || !side || !quantity) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const orderPayload = {
      market: market || 'BTCINR',
      order_type: orderType,
      side,
      quantity: parseFloat(quantity),
      ...(orderType === 'limit_order' && { price: parseFloat(price) }),
      timestamp: Date.now(),
      client_order_id: `order_${Date.now()}`
    };

    // Remove undefined fields
    Object.keys(orderPayload).forEach(key => 
      orderPayload[key] === undefined && delete orderPayload[key]
    );

    const signature = generateSignature(JSON.stringify(orderPayload));

    const response = await axios.post(
      'https://api.coindcx.com/exchange/v1/orders/create',
      orderPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-APIKEY': API_KEY,
          'X-AUTH-SIGNATURE': signature
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    const errorDetails = err.response?.data || err.message;
    console.error('Order Error:', errorDetails);
    res.status(500).json({ 
      error: 'Trade failed',
      details: errorDetails 
    });
  }
});

// ✅ Route: Get BTC Balance
app.get('/api/balance', async (req, res) => {
  try {
    const timestamp = Date.now();
    const signature = generateSignature(timestamp.toString());

    const response = await axios.get('https://api.coindcx.com/exchange/v1/users/balances', {
      params: { timestamp },
      headers: {
        'X-AUTH-APIKEY': API_KEY,
        'X-AUTH-SIGNATURE': signature,
      },
    });

    const balances = response.data;
    const btcBalance = balances.find(b => b.currency === 'BTC') || { 
      currency: 'BTC', 
      balance: 0 
    };
    res.json(btcBalance);
  } catch (err) {
    const errorDetails = err.response?.data || err.message;
    console.error('Balance Error:', errorDetails);
    res.status(500).json({ 
      error: 'Failed to fetch BTC balance',
      details: errorDetails 
    });
  }
});

// ✅ Route: Get BTCINR Price
app.get('/api/price', async (req, res) => {
  try {
    const response = await axios.get('https://api.coindcx.com/exchange/ticker');
    const btcTicker = response.data.find(t => t.market === 'BTCINR') || { 
      market: 'BTCINR', 
      last_price: 0 
    };
    res.json(btcTicker);
  } catch (err) {
    const errorDetails = err.response?.data || err.message;
    console.error('Price Error:', errorDetails);
    res.status(500).json({ 
      error: 'Failed to fetch price',
      details: errorDetails 
    });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Fixed CoinDCX backend running on http://localhost:${PORT}`);
});