const express = require('express');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 3099;

const app = express();
app.use(cors());

// Static files (like mir-bl-server)
app.use(express.static(path.join(__dirname, '..', 'public')));

// JSON body parser
app.use(express.json());

// Health check
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// Echo endpoint
app.post('/api/echo', (req, res) => {
  res.json({ ok: true, received: req.body });
});

// Start server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Test] Server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
