const express = require('express');
const { exiftool } = require('exiftool-vendored');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const basicAuth = require('express-basic-auth');
const { createProxyMiddleware } = require('http-proxy-middleware');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

const dashboardPort = process.env.DASHBOARD_PORT || 3001;
const apiPort = process.env.API_PORT || 3000;
const configPath = process.env.CONFIG_PATH || './config/config.json';
const dashboardPassword = process.env.DASHBOARD_PASSWORD || 'admin';

// Ensure config dir and file exist
if (!fs.existsSync(path.dirname(configPath))) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
}
if (!fs.existsSync(configPath)) {
  const defaultConfig = {
    deviceMatch: 'necessary',
    softwareCheck: 'necessary',
    timeCheck: 'necessary',
    maxPhotoAgeMonths: 1,
    compressionCheck: 'disabled'
  };
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
}

// Load config
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Dashboard app (public with auth)
const dashboardApp = express();
dashboardApp.use(basicAuth({
  users: { admin: dashboardPassword },
  challenge: true,
  realm: 'Dashboard'
}));
dashboardApp.use(express.json());
dashboardApp.use(express.static('public'));

dashboardApp.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

dashboardApp.get('/config', (req, res) => {
  res.json({ apiPort });
});

// Proxy /api requests to API app
dashboardApp.use('/api', createProxyMiddleware({
  target: `http://localhost:${apiPort}`,
  changeOrigin: true
}));

dashboardApp.listen(dashboardPort, () => {
  logger.info(`Dashboard listening on port ${dashboardPort}`);
});

// API app (LAN only)
const apiApp = express();
apiApp.use(express.json());
apiApp.use(express.static('public'));

// Multer for file uploads
const upload = multer({ dest: 'uploads/' });

apiApp.get('/api/prefs', (req, res) => {
  res.json(config);
});

apiApp.post('/api/prefs', (req, res) => {
  const newConfig = req.body;
  config = { ...config, ...newConfig };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  logger.info('Preferences updated');
  res.send('Preferences saved successfully.');
});



// POST /verify: Upload image and doctorDevice JSON
apiApp.post('/verify', upload.single('image'), async (req, res) => {
  try {
    const { doctorDevice } = req.body;
    const device = JSON.parse(doctorDevice);
    const filePath = req.file.path;
    logger.info(`Verification request for device: ${device.model}`);

    // Extract EXIF
    const exifData = await exiftool.read(filePath);

    // Validation logic
    const reasons = [];
    let status = 'accepted';

    // Device match
    if (config.deviceMatch === 'necessary') {
      const exifModel = exifData.Model || exifData.Make;
      if (exifModel && exifModel.includes(device.model)) {
        reasons.push('Device model matches');
      } else {
        reasons.push('Device model does not match');
        status = 'not accepted';
      }
    } else if (config.deviceMatch === 'not_necessary') {
      const exifModel = exifData.Model || exifData.Make;
      if (!(exifModel && exifModel.includes(device.model))) {
        reasons.push('Device model mismatch (unstable)');
        status = 'unstable';
      } else {
        reasons.push('Device model matches');
      }
    }

    // Software check
    if (config.softwareCheck === 'necessary') {
      const software = exifData.Software;
      if (!software || (!software.toLowerCase().includes('screenshot') && !software.toLowerCase().includes('photoshop'))) {
        reasons.push('No editing software detected');
      } else {
        reasons.push('Editing software detected');
        status = 'not accepted';
      }
    } else if (config.softwareCheck === 'not_necessary') {
      const software = exifData.Software;
      if (software && (software.toLowerCase().includes('screenshot') || software.toLowerCase().includes('photoshop'))) {
        reasons.push('Editing software detected (unstable)');
        status = 'unstable';
      } else {
        reasons.push('No editing software detected');
      }
    }

    // Time check
    if (config.timeCheck === 'necessary') {
      const dateTime = exifData.DateTimeOriginal;
      if (dateTime) {
        const photoDate = new Date(dateTime);
        const now = new Date();
        const monthsDiff = (now - photoDate) / (1000 * 60 * 60 * 24 * 30);
        if (monthsDiff <= config.maxPhotoAgeMonths) {
          reasons.push('Photo is recent');
        } else {
          reasons.push('Photo is too old');
          status = 'not accepted';
        }
      } else {
        reasons.push('No timestamp available');
        status = 'not accepted';
      }
    } else if (config.timeCheck === 'not_necessary') {
      const dateTime = exifData.DateTimeOriginal;
      if (dateTime) {
        const photoDate = new Date(dateTime);
        const now = new Date();
        const monthsDiff = (now - photoDate) / (1000 * 60 * 60 * 24 * 30);
        if (monthsDiff > config.maxPhotoAgeMonths) {
          reasons.push('Photo may be old (unstable)');
          status = 'unstable';
        } else {
          reasons.push('Photo is recent');
        }
      } else {
        reasons.push('No timestamp available (unstable)');
        status = 'unstable';
      }
    }

    // Compression check (placeholder for later)
    if (config.compressionCheck === 'necessary') {
      // TODO: implement compression analysis
      reasons.push('Compression check not implemented yet');
    } else if (config.compressionCheck === 'not_necessary') {
      // TODO
    }

    // Clean up
    fs.unlinkSync(filePath);

    logger.info(`Verification result: ${status}, reasons: ${reasons.join(', ')}`);
    res.json({ status, reasons });
  } catch (error) {
    console.error('Error in verification:', error);
    res.status(500).json({ status: 'error', reasons: ['Internal server error'] });
  }
});

apiApp.listen(apiPort, () => {
  logger.info(`API listening on port ${apiPort}`);
});