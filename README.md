# LED Wall Controller - Cloud Relay Server

## Overview

This relay server allows the WPF desktop app and browser remote to connect from anywhere in the world via cloud hosting.

## Files Created

- `relay-server/package.json` - Node.js dependencies
- `relay-server/server.js` - Relay server with Socket.IO
- `relay-server/railway.json` - Railway deployment config
- `wwwroot/config.js` - Cloud server configuration

## Deployment to Railway (Free)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub

### Step 2: Deploy
1. Click "New Project" → "Deploy from GitHub repo"
2. Select this repository
3. Choose the `relay-server` directory as root
4. Click "Deploy"

### Step 3: Get Your URL
After deployment, Railway will give you a URL like:
`https://ledwall-relay-xxxxx.railway.app`

### Step 4: Configure Browser
Edit `wwwroot/config.js`:
```javascript
const CLOUD_SERVER_URL = "https://your-railway-url.railway.app";
```

### Step 5: Run WPF App
The WPF app runs locally and connects to your Arduino. The browser remote connects to the cloud, which relays commands to WPF.

## How It Works

```
[Remote Browser] --> [Railway Cloud Server] <-- [WPF App (localhost)]
                           |
                    relays commands
                           |
                    [Arduino Device]
```

## Testing Locally

1. Run relay server locally:
   ```bash
   cd relay-server
   npm install
   npm start
   ```

2. Set `CLOUD_SERVER_URL = "http://localhost:3000"` in config.js

3. Open browser to http://localhost:3000

## API Endpoints (when deployed)

- `GET /health` - Health check
- `POST /api/relay/:id/:state` - Control relay
- `POST /api/led/:id` - Control LED
- `POST /api/auto/:action` - Auto show control
- `POST /api/master/:state` - Master control

## Socket.IO Events

- `register` - Register as 'wpf' or 'browser'
- `stateChanged` - Broadcast state to browsers
- `toWpf` - Send command to WPF
- `toBrowsers` - Send command to browsers
- `wpfStatus` - Notify browsers of WPF connection status