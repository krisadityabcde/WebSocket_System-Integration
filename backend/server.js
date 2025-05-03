const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Set up CORS
app.use(cors());

// Create Socket.io server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://youtube-sync-party.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store the current video state
let currentState = {
  videoId: 'dQw4w9WgXcQ', // Default video ID
  currentTime: 0,
  isPlaying: false,
  lastUpdate: Date.now()
};

// Store the queue of videos
let videoQueue = [];

// Store connected users with their usernames
const connectedUsers = new Map(); // socketId -> {username, isHost}

// Track the current host
let hostId = null;

// Add this near the beginning of the file, after your other variables
let lastBroadcastTime = Date.now();
const SYNC_DEBOUNCE_TIME = 100; // Minimum time between broadcasts in milliseconds

// Handle socket connections
io.on('connection', (socket) => {
  // First user becomes the host
  const isFirstUser = connectedUsers.size === 0;
  
  // Add user to connected users with default username
  connectedUsers.set(socket.id, {
    username: `User-${socket.id.substring(0, 5)}`,
    isHost: isFirstUser
  });
  
  // Set as host if first user
  if (isFirstUser) {
    hostId = socket.id;
    console.log(`New host: ${socket.id}`);
  }
  
  console.log('User connected:', socket.id);
  console.log(`Total connected users: ${connectedUsers.size}, Host: ${hostId}`);
  
  // Send current state to new user immediately
  socket.emit('initState', {
    ...currentState,
    hostId: hostId,
    isHost: socket.id === hostId
  });
  
  // Then send a refined sync after a short delay to ensure player is ready
  setTimeout(() => {
    socket.emit('syncState', currentState);
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
  
  // Handle play event with host-based synchronization
  socket.on('videoPlay', (time) => {
    console.log(`Play at ${time} from ${socket.id} (Host: ${socket.id === hostId})`);
    
    // Update current state
    currentState.isPlaying = true;
    currentState.currentTime = time;
    currentState.lastUpdate = Date.now();
    
    // If sender is host or there's no host, broadcast to everyone with debounce
    if (socket.id === hostId || !hostId) {
      // Only broadcast if sufficient time has passed since the last broadcast
      if (Date.now() - lastBroadcastTime > SYNC_DEBOUNCE_TIME) {
        io.emit('videoPlay', {
          time: time,
          timestamp: Date.now(),
          fromHost: socket.id === hostId
        });
        io.emit('videoPlayState', true); // Add this line
        lastBroadcastTime = Date.now();
      }
    } else {
      // If sender is not host, only respond to sender
      socket.emit('syncFromHost', currentState);
    }
  });
  
  // Handle pause with host-based synchronization
  socket.on('videoPause', (time) => {
    console.log(`Pause at ${time} from ${socket.id} (Host: ${socket.id === hostId})`);
    
    // Update current state
    currentState.isPlaying = false;
    currentState.currentTime = time;
    currentState.lastUpdate = Date.now();
    
    // If sender is host or there's no host, broadcast to everyone
    if (socket.id === hostId || !hostId) {
      // Always broadcast pause events as they're important and infrequent
      io.emit('videoPause', {
        time: time,
        timestamp: Date.now(),
        fromHost: socket.id === hostId
      });
      io.emit('videoPlayState', false); // Add this line
      lastBroadcastTime = Date.now();
    } else {
      // If sender is not host, only respond to sender with correct state
      socket.emit('syncFromHost', currentState);
    }
  });
  
  // Handle seeking with host-based synchronization
  socket.on('videoSeek', (time) => {
    console.log(`Seek to ${time} from ${socket.id} (Host: ${socket.id === hostId})`);
    
    // If sender is host, update current state and broadcast
    if (socket.id === hostId || !hostId) {
      currentState.currentTime = time;
      currentState.lastUpdate = Date.now();
      
      // Always broadcast seek events immediately as they're critical for synchronization
      io.emit('videoSeek', {
        time: time,
        timestamp: Date.now(),
        fromHost: socket.id === hostId
      });
      lastBroadcastTime = Date.now();
    } else {
      // If sender is not host, allow temporary seeking but then sync back more quickly
      socket.emit('temporarySeek', time);
      
      // Sync back more quickly (2 seconds instead of 5)
      setTimeout(() => {
        socket.emit('syncFromHost', currentState);
      }, 2000);
    }
  });
  
  // Handle video changes - allow anyone to change the video
  socket.on('changeVideo', (videoId) => {
    console.log(`Video changed to ${videoId} by ${socket.id}`);
    
    currentState.videoId = videoId;
    currentState.currentTime = 0;
    currentState.isPlaying = false;
    currentState.lastUpdate = Date.now();
    
    io.emit('changeVideo', {
      videoId: videoId,
      timestamp: Date.now(),
      changedBy: connectedUsers.get(socket.id)?.username || 'Someone'
    });
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
      
      currentState.videoId = nextVideo.id;
      currentState.currentTime = 0;
      currentState.isPlaying = true;
      currentState.lastUpdate = Date.now();
      
      io.emit('changeVideo', {
        videoId: nextVideo.id,
        timestamp: Date.now(),
        changedBy: username
      });
      io.emit('updateQueue', videoQueue);
    }
  });
  
  // Handle chat messages with usernames
  socket.on('chatMessage', (msg) => {
    const username = connectedUsers.get(socket.id)?.username || 'Anonymous';
    const isHost = socket.id === hostId;
    
    console.log(`Chat message from ${username} (${socket.id}): ${msg}`);
    io.emit('chatMessage', {
      user: username,
      text: msg,
      time: new Date().toLocaleTimeString(),
      isHost: isHost
    });
  });
  
  // Handle client requesting current state (for syncing)
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
      hostId: hostId,
      isHost: socket.id === hostId
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
  
  // Handle disconnection
  socket.on('disconnect', () => {
    const username = connectedUsers.get(socket.id)?.username || 'Someone';
    const wasHost = socket.id === hostId;
    
    console.log(`User disconnected: ${username} (${socket.id}), was host: ${wasHost}`);
    
    // Remove from connected users
    connectedUsers.delete(socket.id);
    
    // If the host disconnects, assign a new host
    if (wasHost && connectedUsers.size > 0) {
      // Get the first connected user as new host
      hostId = connectedUsers.keys().next().value;
      
      // Update user info to reflect new host status
      const userInfo = connectedUsers.get(hostId);
      userInfo.isHost = true;
      connectedUsers.set(hostId, userInfo);
      
      console.log(`New host assigned: ${hostId}`);
      
      // Notify new host
      io.to(hostId).emit('becomeHost', true);
      
      // Broadcast host change
      io.emit('hostChanged', {
        hostId: hostId,
        hostname: connectedUsers.get(hostId)?.username || 'New Host'
      });
    }
    
    // Broadcast updated user list
    broadcastUserList();
  });
  
  // Helper function to broadcast user list
  function broadcastUserList() {
    const userList = Array.from(connectedUsers.entries()).map(([id, info]) => ({
      id: id,
      username: info.username,
      isHost: id === hostId
    }));
    
    io.emit('userCount', {
      count: userList.length,
      users: userList,
      hostId: hostId
    });
  }
});

// Basic health check route
app.get('/', (req, res) => {
  res.send('YouTube Sync Party Backend is running');
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
