import { io } from 'socket.io-client';

let socket = null;
let socketPromise = null;

// Backend URL - use environment variable if available
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export const initializeSocket = async () => {
  if (socketPromise) return socketPromise;
  
  socketPromise = new Promise((resolve) => {
    // If socket already exists, return it
    if (socket && socket.connected) {
      console.log('Socket already connected, reusing existing connection');
      resolve(socket);
      return;
    }
    
    console.log(`Creating new socket connection to ${BACKEND_URL}...`);
    
    // Create socket with explicit configuration
    socket = io(BACKEND_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnection: true,
      transports: ['websocket', 'polling']
    });
    
    // Add event listeners for debugging
    socket.on('connect', () => {
      console.log('Socket connected successfully!', socket.id);
      // Request synchronization immediately after connecting
      socket.emit('requestSync');
      resolve(socket); // Resolve the promise when connected
    });
    
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });
    
    socket.io.on('error', (err) => {
      console.error('Socket manager error:', err);
    });
    
    // If socket doesn't connect within 5 seconds, resolve anyway to prevent hanging
    setTimeout(() => {
      if (!socket.connected) {
        console.warn('Socket connection timed out, continuing anyway');
        resolve(socket);
      }
    }, 5000);
  });
  
  return socketPromise;
};

export const getSocket = () => socket;
