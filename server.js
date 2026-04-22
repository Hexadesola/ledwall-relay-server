const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files from wwwroot folder
app.use(express.static(path.join(__dirname, '../wwwroot')));
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API endpoints that WPF would normally handle
app.post('/api/relay/:id/:state', (req, res) => {
  const { id, state } = req.params;
  // Forward to WPF if connected
  if (wpfClient) {
    wpfClient.emit('fromBrowser', { type: 'relay', id: parseInt(id), state: state });
    res.json({ success: true });
  } else {
    res.status(503).json({ error: 'WPF controller not connected' });
  }
});

app.post('/api/led/:id', express.json(), (req, res) => {
  const { id } = req.params;
  if (wpfClient) {
    wpfClient.emit('fromBrowser', { type: 'led', id: parseInt(id), data: req.body });
    res.json({ success: true });
  } else {
    res.status(503).json({ error: 'WPF controller not connected' });
  }
});

app.post('/api/auto/:action', express.json(), (req, res) => {
  if (wpfClient) {
    wpfClient.emit('fromBrowser', { type: 'auto', action: req.params.action, data: req.body });
    res.json({ success: true });
  } else {
    res.status(503).json({ error: 'WPF controller not connected' });
  }
});

app.post('/api/master/:state', (req, res) => {
  if (wpfClient) {
    wpfClient.emit('fromBrowser', { type: 'master', state: req.params.state });
    res.json({ success: true });
  } else {
    res.status(503).json({ error: 'WPF controller not connected' });
  }
});

// Track connected clients
let wpfClient = null;
let browserClients = new Set();

console.log('LED Wall Relay Server starting...');
console.log('Serving static files from wwwroot folder');

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Client registers as WPF or Browser
  socket.on('register', (clientType) => {
    if (clientType === 'wpf') {
      wpfClient = socket;
      console.log('WPF client registered');
      socket.emit('registered', { type: 'wpf' });
      
      // Notify browsers that WPF is connected
      browserClients.forEach(client => {
        client.emit('wpfStatus', { connected: true });
      });
    } else if (clientType === 'browser') {
      browserClients.add(socket);
      console.log(`Browser client registered (${browserClients.size} browsers)`);
      socket.emit('wpfStatus', { connected: wpfClient !== null });
    }
  });

  // Handle relay commands from WPF to browsers
  socket.on('toBrowsers', (data) => {
    console.log('Relaying to browsers:', data.type || 'state');
    browserClients.forEach(client => {
      client.emit('fromWpf', data);
    });
  });

  // Handle relay commands from browsers to WPF
  socket.on('toWpf', (data) => {
    console.log('Relaying to WPF:', data.type || 'command');
    if (wpfClient) {
      wpfClient.emit('fromBrowser', data);
    } else {
      socket.emit('error', { message: 'WPF controller not connected' });
    }
  });

  // Handle state updates from WPF
  socket.on('stateChanged', (state) => {
    browserClients.forEach(client => {
      client.emit('stateChanged', state);
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    if (wpfClient === socket) {
      wpfClient = null;
      console.log('WPF client disconnected');
      browserClients.forEach(client => {
        client.emit('wpfStatus', { connected: false });
      });
    } else {
      browserClients.delete(socket);
      console.log(`Browser disconnected (${browserClients.size} remaining)`);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LED Wall Relay Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Web interface: http://localhost:${PORT}/`);
});