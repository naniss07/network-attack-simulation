const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5028;

// CORS ayarları
app.use(cors());

// Statik dosyaları serve et
app.use(express.static(path.join(__dirname, 'simulation')));

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'simulation', 'index.html'));
});

// Sunucuyu başlat
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
}); 