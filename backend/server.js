const express = require('express');
const http = require('http');
const https = require('https'); // Added for secure WebSocket
const fs = require('fs'); // Added for reading certificates
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt'); // For password hashing
const jwt = require('jsonwebtoken'); // For JWT tokens

const app = express();

// For secure WebSocket (WSS), use HTTPS
let server;
try {
  // Try to use HTTPS with certificates
  const options = {
    key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
  };
  server = https.createServer(options, app);
  console.log('HTTPS server created successfully');
} catch (error) {
  // Fallback to HTTP if certificates not found
  console.log('Certificates not found, using HTTP server instead:', error.message);
  server = http.createServer(app);
}

// Set up CORS
app.use(cors());
app.use(express.json());

// Create Socket.io server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000, // Timeout for ping-pong
  pingInterval: 25000  // Send ping every 25s
});

// User limits
const USER_LIMITS = {
  ADMIN_LIMIT: 1,
  REGULAR_USER_LIMIT: 2
};

// Track connected users by type
let connectedAdmins = 0;
let connectedRegularUsers = 0;

// Store the current video state
let currentState = {
  videoId: 'dQw4w9WgXcQ', // Default video ID
  currentTime: 0,
  isPlaying: false,
  lastUpdate: Date.now(),
  adminInitiatedPlayback: false // Track if admin has started video at least once
};

// Store the queue of videos
let videoQueue = [];

// Store connected users with their usernames
const connectedUsers = new Map(); // socketId -> {username, isHost, isAdmin}

// User database (in a real app, this would be in a database)
const users = new Map(); // username -> {passwordHash, isAdmin}

// Secret for JWT
const JWT_SECRET = 'your-secret-key-should-be-stored-in-env-var';

// Track the current admin - remove hostId variable
let adminId = null;

// Remove hostId variable and references

// Connection count and limit
let connectionCount = 0;
const MAX_CONNECTIONS = 3;

// Add admin presence check flag
let adminConnected = false;

// Add this near the beginning of the file, after your other variables
let lastBroadcastTime = Date.now();
const SYNC_DEBOUNCE_TIME = 100; // Minimum time between broadcasts in milliseconds

// Authentication middleware
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, isAdmin } = req.body;
    
    // Check if username already exists
    if (users.has(username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Check admin limit
    if (isAdmin) {
      const adminCount = Array.from(users.values()).filter(user => user.isAdmin).length;
      if (adminCount >= USER_LIMITS.ADMIN_LIMIT) {
        return res.status(400).json({ error: 'Maximum admin accounts reached' });
      }
    }
    
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Store the user
    users.set(username, { passwordHash, isAdmin: !!isAdmin });
    
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user exists
    const user = users.get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check connection limits before allowing login
    if (user.isAdmin && connectedAdmins >= USER_LIMITS.ADMIN_LIMIT) {
      return res.status(403).json({ error: 'Maximum admin connections reached' });
    }
    
    if (!user.isAdmin && connectedRegularUsers >= USER_LIMITS.REGULAR_USER_LIMIT) {
      return res.status(403).json({ error: 'Maximum user connections reached' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { username, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({ token, isAdmin: user.isAdmin });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Heartbeat mechanism to handle idle connections
function setupHeartbeat() {
  setInterval(() => {
    io.emit('serverMessage', {
      message: "ping! i'm still alive",
      timestamp: Date.now(),
      isHeartbeat: true
    });
    console.log('💓 Heartbeat sent to all clients');
  }, 10000); // Send every 10 seconds instead of 30 seconds
}

// Server to client broadcast message
function broadcastServerMessage(message) {
  io.emit('serverMessage', {
    message,
    timestamp: Date.now()
  });
}

// Setup the heartbeat
setupHeartbeat();

// Handle socket connections
io.use((socket, next) => {
  // Connection limit check
  if (connectionCount >= MAX_CONNECTIONS) {
    return next(new Error('Server is full (max 3 connections)'));
  }
  
  // Authentication check
  const token = socket.handshake.auth.token;
  if (!token) {
    // Reject connections without token
    return next(new Error('Authentication required'));
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    
    // Only allow admin connections if no admin is connected
    // Or regular user connections if an admin is already connected
    if (decoded.isAdmin) {
      if (connectedAdmins >= USER_LIMITS.ADMIN_LIMIT) {
        return next(new Error('Maximum admin connections reached'));
      }
    } else {
      // If no admin is connected, don't allow regular users to connect
      if (!adminConnected) {
        return next(new Error('Waiting for an admin to start the room'));
      }
      
      // Check regular user limit
      if (connectedRegularUsers >= USER_LIMITS.REGULAR_USER_LIMIT) {
        return next(new Error('Maximum user connections reached'));
      }
    }
    
    return next();
  } catch (err) {
    console.log('Invalid token:', err.message);
    return next(new Error('Authentication failed: ' + err.message));
  }
}).on('connection', (socket) => {
  // Increment connection count
  connectionCount++;
  
  // Increment user type count and update admin connection status
  if (socket.user?.isAdmin) {
    connectedAdmins++;
    adminConnected = true;
    adminId = socket.id; // Set this admin as the admin
  } else {
    connectedRegularUsers++;
  }
  
  console.log(`Connection count: ${connectionCount}/${MAX_CONNECTIONS} (Admins: ${connectedAdmins}, Users: ${connectedRegularUsers})`);
  
  // Admin becomes the sync source - remove all host logic
  const isAdmin = socket.user?.isAdmin === true;
  
  // Add user to connected users with default username
  connectedUsers.set(socket.id, {
    username: socket.user?.username || `User-${socket.id.substring(0, 5)}`,
    isAdmin: isAdmin
  });
  
  // Broadcast that a user has connected (admin or regular user)
  const username = socket.user?.username || `User-${socket.id.substring(0, 5)}`;
  broadcastServerMessage(`${username} ${isAdmin ? '(Admin)' : ''} has joined the room.`);
  
  // Broadcast updated user list immediately after a user connects
  broadcastUserList();
  
  // Set as admin if authenticated as admin
  if (isAdmin) {
    console.log(`New admin connected: ${socket.id}`);
    
    // Force sync to all clients when admin joins
    setTimeout(() => {
      // Calculate current state
      if (currentState.isPlaying) {
        const elapsedSeconds = (Date.now() - currentState.lastUpdate) / 1000;
        currentState.currentTime += elapsedSeconds;
        currentState.lastUpdate = Date.now();
      }
      
      // Broadcast current state to all users
      io.emit('syncFromAdmin', {
        ...currentState,
        adminId: adminId,
        isAdmin: false,
        queue: videoQueue,
        forceSync: true
      });
      
      // If video is playing, emit play command
      if (currentState.isPlaying) {
        io.emit('videoPlay', {
          time: currentState.currentTime,
          timestamp: Date.now(),
          fromAdmin: true
        });
      }
    }, 2000); // Delay to ensure player is ready
  }
  
  console.log('User connected:', socket.id, isAdmin ? '(Admin)' : '');
  console.log(`Total connected users: ${connectedUsers.size}, Admin: ${adminId}`);
  
  // Send current state to new user immediately - remove host references
  socket.emit('initState', {
    ...currentState,
    adminId: adminId,
    isAdmin: isAdmin,
    queue: videoQueue
  });
  
  // Then send a refined sync after a short delay to ensure player is ready
  setTimeout(() => {
    socket.emit('syncState', {
      ...currentState,
      queue: videoQueue
    });
  }, 200);
  
  // Handle username setting
  socket.on('setUsername', (username) => {
    const sanitizedName = username.trim().substring(0, 20); // Limit username length
    
    if (sanitizedName.length > 0) {
      const userInfo = connectedUsers.get(socket.id);
      userInfo.username = sanitizedName;
      connectedUsers.set(socket.id, userInfo);
      
      console.log(`User ${socket.id} set username to ${sanitizedName}`);
      
      // Confirm to the user
      socket.emit('usernameSet', sanitizedName);
      
      // Broadcast updated user list
      broadcastUserList();
    }
  });
  
  // Handle ping request (ping-pong functionality)
  socket.on('ping', () => {
    console.log(`Ping received from ${socket.id}`);
    const startTime = Date.now();
    
    // Send pong response with latency info
    socket.emit('pong', {
      time: startTime,
      latency: Date.now() - startTime
    });
  });
  
  // Handle heartbeat acknowledgment
  socket.on('heartbeatAck', () => {
    console.log(`💓 Heartbeat acknowledged by ${socket.id}`);
    
    // Update the last activity time for this user
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      userInfo.lastActivity = Date.now();
      connectedUsers.set(socket.id, userInfo);
    }
  });
  
  // Enhance the play event handler for admins
  socket.on('videoPlay', (time) => {
    console.log(`Play at ${time} from ${socket.id} (Admin: ${socket.id === adminId})`);
    
    // If sender is admin, update adminInitiatedPlayback flag and broadcast to everyone
    if (socket.id === adminId) {
      // Set admin initiated flag
      currentState.adminInitiatedPlayback = true;
      
      // Update current state
      currentState.isPlaying = true;
      currentState.currentTime = time;
      currentState.lastUpdate = Date.now();
      
      // Always broadcast admin play events immediately to force sync for everyone
      console.log('Admin started playback, forcing play for all users');
      io.emit('videoPlay', {
        time: time,
        timestamp: Date.now(),
        fromAdmin: true,
        adminInitiatedPlayback: true,
        forcePlay: true // Add this flag to indicate this is a forced play from admin
      });
      io.emit('videoPlayState', true);
      lastBroadcastTime = Date.now();
    } 
    else {
      // Non-admin play events
      
      // Update current state
      currentState.isPlaying = true;
      currentState.currentTime = time;
      currentState.lastUpdate = Date.now();
      
      // If admin has initiated playback, allow others to play
      if (currentState.adminInitiatedPlayback) {
        // Only broadcast if sufficient time has passed since the last broadcast
        if (Date.now() - lastBroadcastTime > SYNC_DEBOUNCE_TIME) {
          io.emit('videoPlay', {
            time: time,
            timestamp: Date.now(),
            fromAdmin: false,
            adminInitiatedPlayback: currentState.adminInitiatedPlayback
          });
          io.emit('videoPlayState', true);
          lastBroadcastTime = Date.now();
        }
      } else {
        // If admin hasn't initiated playback yet, don't allow regular users to play
        socket.emit('videoPause', {
          time: currentState.currentTime,
          timestamp: Date.now(),
          message: 'Waiting for admin to start video first'
        });
        socket.emit('syncFromAdmin', {
          ...currentState,
          adminId: adminId,
          isAdmin: false
        });
      }
    }
  });
  
  // Handle pause with admin-based synchronization - remove host references
  socket.on('videoPause', (time) => {
    console.log(`Pause at ${time} from ${socket.id} (Admin: ${socket.id === adminId})`);
    
    // Update current state
    currentState.isPlaying = false;
    currentState.currentTime = time;
    currentState.lastUpdate = Date.now();
    
    // If sender is admin or there's no admin, broadcast to everyone
    if (socket.id === adminId || !adminId) {
      // Always broadcast pause events as they're important and infrequent
      io.emit('videoPause', {
        time: time,
        timestamp: Date.now(),
        fromAdmin: socket.id === adminId
      });
      io.emit('videoPlayState', false);
      lastBroadcastTime = Date.now();
    } else {
      // If sender is not the admin, only respond to sender with correct state
      socket.emit('syncFromAdmin', currentState);
    }
  });
  
  // Handle seeking with admin-based synchronization
  socket.on('videoSeek', (time) => {
    console.log(`Seek to ${time} from ${socket.id} (Admin: ${socket.id === adminId})`);
    
    // If sender is admin, update current state and broadcast
    if (socket.id === adminId || !adminId) {
      currentState.currentTime = time;
      currentState.lastUpdate = Date.now();
      
      // Always broadcast seek events immediately as they're critical for synchronization
      io.emit('videoSeek', {
        time: time,
        timestamp: Date.now(),
        fromAdmin: socket.id === adminId
      });
      lastBroadcastTime = Date.now();
    } else {
      // If sender is not admin, allow temporary seeking but then sync back more quickly
      socket.emit('temporarySeek', time);
      
      // Sync back more quickly
      setTimeout(() => {
        socket.emit('syncFromAdmin', currentState);
      }, 2000);
    }
  });
  
  // Handle video changes - allow anyone to change the video
  socket.on('changeVideo', (videoData) => {
    // Allow both videoId string or object with id and title
    let videoId, videoTitle;
    
    if (typeof videoData === 'string') {
      videoId = videoData;
      videoTitle = 'Unknown title'; // Default if no title provided
    } else {
      videoId = videoData.id || videoData;
      videoTitle = videoData.title || 'Unknown title';
    }
    
    console.log(`Video changed to ${videoId} by ${socket.id}`);
    
    // Update current state
    currentState.videoId = videoId;
    currentState.currentTime = 0;
    currentState.isPlaying = false;
    currentState.lastUpdate = Date.now();
    currentState.adminInitiatedPlayback = false; // Reset adminInitiatedPlayback when changing video
    
    // Get username
    const username = connectedUsers.get(socket.id)?.username || 'Someone';
    
    // Broadcast video change
    io.emit('changeVideo', {
      videoId: videoId,
      timestamp: Date.now(),
      changedBy: username
    });
    
    // Send notification about video change with title
    broadcastServerMessage(`${username} changed the video to: ${videoTitle}`);
  });
  
  // Handle adding to queue - allow anyone to add to queue
  socket.on('addToQueue', (videoData) => {
    const username = connectedUsers.get(socket.id)?.username || 'Someone';
    console.log(`Video added to queue: ${videoData.id} by ${username}`);
    
    // Add username and thumbnail
    videoData.addedBy = username;
    if (!videoData.thumbnail) {
      videoData.thumbnail = `https://img.youtube.com/vi/${videoData.id}/mqdefault.jpg`;
    }
    
    videoQueue.push(videoData);
    io.emit('updateQueue', videoQueue);
  });
  
  // Handle playing next in queue
  socket.on('playNextInQueue', () => {
    if (videoQueue.length > 0) {
      const nextVideo = videoQueue.shift();
      const username = connectedUsers.get(socket.id)?.username || 'Someone';
      console.log(`Playing next video: ${nextVideo.id} (requested by ${username})`);
      
      // Update current state
      currentState.videoId = nextVideo.id;
      currentState.currentTime = 0;
      currentState.isPlaying = true;
      currentState.lastUpdate = Date.now();
      
      // Broadcast video change
      io.emit('changeVideo', {
        videoId: nextVideo.id,
        timestamp: Date.now(),
        changedBy: username
      });
      
      // Send notification about video change with title
      broadcastServerMessage(`${username} started playing: ${nextVideo.title || nextVideo.id}`);
      
      // Update queue
      io.emit('updateQueue', videoQueue);
    }
  });
  
  // Handle chat messages with usernames - remove host references
  socket.on('chatMessage', (msg) => {
    const username = connectedUsers.get(socket.id)?.username || 'Anonymous';
    const isAdmin = socket.id === adminId;
    
    console.log(`Chat message from ${username} (${socket.id}): ${msg}`);
    io.emit('chatMessage', {
      user: username,
      text: msg,
      time: new Date().toLocaleTimeString(),
      isAdmin: isAdmin
    });
  });
  
  // Handle client requesting current state (for syncing) - remove host references
  socket.on('requestSync', () => {
    console.log(`Sync requested by ${socket.id}`);
    
    // Calculate actual current time based on elapsed time since last update
    if (currentState.isPlaying) {
      const elapsedSeconds = (Date.now() - currentState.lastUpdate) / 1000;
      currentState.currentTime += elapsedSeconds;
      currentState.lastUpdate = Date.now();
    }
    
    socket.emit('syncState', {
      ...currentState,
      adminId: adminId,
      isAdmin: socket.id === adminId,
      queue: videoQueue
    });
  });
  
  // Add this new socket event handler in the connection section
  socket.on('removeFromQueue', (index) => {
    const username = connectedUsers.get(socket.id)?.username || 'Someone';
    console.log(`Video removed from queue at position ${index} by ${username}`);
    
    if (index >= 0 && index < videoQueue.length) {
      videoQueue.splice(index, 1);
      io.emit('updateQueue', videoQueue);
    }
  });
  
  // Add this new socket event handler in the connection section
  socket.on('reorderQueue', ({ oldIndex, newIndex }) => {
    const username = connectedUsers.get(socket.id)?.username || 'Someone';
    console.log(`Queue reordered by ${username}: moving item from position ${oldIndex} to ${newIndex}`);
    
    if (oldIndex >= 0 && oldIndex < videoQueue.length && newIndex >= 0 && newIndex < videoQueue.length) {
      // Remove the item from the old position and save it
      const [movedItem] = videoQueue.splice(oldIndex, 1);
      
      // Insert the item at the new position
      videoQueue.splice(newIndex, 0, movedItem);
      
      // Broadcast updated queue to all clients
      io.emit('updateQueue', videoQueue);
    }
  });
  
  // Add handler for direct play state events
  socket.on('videoPlayState', (isPlaying) => {
    io.emit('videoPlayState', isPlaying);
  });
  
  // Add this event handler in the connection section
  socket.on('requestUsersList', () => {
    console.log(`User list requested by ${socket.id}`);
    broadcastUserList();
  });
  
  // Handle disconnection - remove host logic
  socket.on('disconnect', () => {
    // Decrement connection count
    connectionCount--;
    
    // Decrement user type count
    if (socket.user?.isAdmin) {
      connectedAdmins--;
      if (connectedAdmins === 0) {
        adminConnected = false;
      }
      
      // If this was the admin, clear adminId
      if (socket.id === adminId) {
        adminId = null;
      }
    } else {
      connectedRegularUsers--;
    }
    
    console.log(`Connection count after disconnect: ${connectionCount}/${MAX_CONNECTIONS} (Admins: ${connectedAdmins}, Users: ${connectedRegularUsers})`);
    
    const username = connectedUsers.get(socket.id)?.username || 'Someone';
    const wasAdmin = socket.id === adminId;
    
    console.log(`User disconnected: ${username} (${socket.id}), was admin: ${wasAdmin}`);
    
    // Remove from connected users
    connectedUsers.delete(socket.id);
    
    // If the admin disconnects, notify and disconnect all users
    if (wasAdmin) {
      adminId = null;
      broadcastServerMessage(`Admin ${username} has left. Room will close.`);
      
      // Notify all users that the admin has left and they will be disconnected
      io.emit('adminLeft');
      
      // Disconnect all remaining clients after a delay to allow message to be seen
      setTimeout(() => {
        for (const [clientId, client] of io.sockets.sockets) {
          if (clientId !== socket.id) {  // Don't disconnect the admin that's already leaving
            client.disconnect(true);
          }
        }
      }, 5000);
    }
    
    // Broadcast server message about available connection slots
    if (connectionCount === MAX_CONNECTIONS - 1) {
      broadcastServerMessage('A connection slot is now available.');
    }
    
    // Broadcast updated user list
    broadcastUserList();
    
    broadcastServerMessage(`${username} ${wasAdmin ? '(Admin)' : ''} has left the room.`);
  });
  
  // Helper function to broadcast user list - remove host references
  function broadcastUserList() {
    // Filter out any invalid entries (defensive programming)
    const validUsers = Array.from(connectedUsers.entries())
      .filter(([id, info]) => id && info && info.username)
      .map(([id, info]) => ({
        id: id,
        username: info.username,
        isAdmin: info.isAdmin || false
      }));
    
    console.log(`Broadcasting updated user list: ${validUsers.length} users`);
    
    io.emit('userCount', {
      count: validUsers.length,
      users: validUsers,
      adminId: adminId
    });
  }
});

// Server can send messages to clients via this API endpoint
app.post('/api/broadcast', (req, res) => {
  try {
    const { message, secret } = req.body;
    
    // Simple authorization check
    if (secret !== 'server-broadcast-secret') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    broadcastServerMessage(message);
    return res.json({ success: true, message: 'Message broadcast successfully' });
  } catch (error) {
    console.error('Broadcast error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Basic health check route
app.get('/', (req, res) => {
  res.send('YouTube Sync Party Backend is running');
});

// Di server.js, tambahkan ini untuk menyajikan frontend
// Serve static files from Next.js build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/.next')));
  
  // Handle all routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/.next/server/pages/index.html'));
  });
}

// Import modul yang diperlukan jika belum ada
const next = require('next');
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: path.join(__dirname, '../frontend') });
const nextHandler = nextApp.getRequestHandler();

// Tambahkan kode ini SEBELUM pendefinisian route API lainnya
if (process.env.NODE_ENV === 'production') {
  // Untuk Next.js, kita perlu melakukan dua hal:
  
  // 1. Serve file statis dari direktori frontend/.next
  app.use('/_next', express.static(path.join(__dirname, '../frontend/.next/_next')));
  app.use('/static', express.static(path.join(__dirname, '../frontend/.next/static')));
  
  // 2. Setup handler untuk Next.js route menggunakan next-handler
  
  // Persiapkan aplikasi Next.js
  nextApp.prepare().then(() => {
    console.log('Next.js app is ready');
    
    // Tangani semua request yang tidak ditangani oleh rute API
    app.all('*', (req, res) => {
      return nextHandler(req, res);
    });
  });
}

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${server instanceof https.Server ? 'HTTPS' : 'HTTP'})`);
});
