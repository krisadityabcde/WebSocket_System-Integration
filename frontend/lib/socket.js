import { io } from 'socket.io-client';

let socket = null;
let socketPromise = null;

// Backend URL - use environment variable if available
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

// Export backend URL for API calls
export const API_URL = BACKEND_URL;

// Event handlers for auth-related errors
const authErrorHandlers = {
  onAdminRequired: null,
  onAuthError: null
};

export const setAuthErrorHandlers = (handlers) => {
  if (handlers.onAdminRequired) authErrorHandlers.onAdminRequired = handlers.onAdminRequired;
  if (handlers.onAuthError) authErrorHandlers.onAuthError = handlers.onAuthError;
};

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
    
    // Get authentication token from localStorage
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.warn('No authentication token found');
      if (authErrorHandlers.onAuthError) {
        authErrorHandlers.onAuthError('Authentication required');
      }
      resolve(null);
      return;
    }

    // Create socket with explicit configuration
    socket = io(BACKEND_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnection: true,
      transports: ['websocket', 'polling'],
      auth: { token }
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
      
      if (err.message.includes('Waiting for an admin')) {
        console.log('Waiting for an admin to start the room');
        if (authErrorHandlers.onAdminRequired) {
          authErrorHandlers.onAdminRequired();
        }
      }
      // If error is due to authentication, redirect to login
      else if (err.message.includes('Authentication required') || 
          err.message.includes('Authentication failed')) {
        console.warn('Authentication error detected. Your session may have expired.');
        
        if (authErrorHandlers.onAuthError) {
          authErrorHandlers.onAuthError(err.message);
        }
      }
      
      resolve(null); // Resolve with null to indicate connection failure
    });
    
    // Add special event for admin disconnection
    socket.on('adminLeft', () => {
      console.log('Admin has left the room. You will be disconnected soon.');
      // Show notification to user
      if (typeof window !== 'undefined') {
        alert('The admin has left the room. You will be redirected to the login page.');
        // Redirect to login after the alert is dismissed
        if (authErrorHandlers.onAuthError) {
          authErrorHandlers.onAuthError('Admin left the room');
        }
      }
    });
    
    socket.io.on('error', (err) => {
      console.error('Socket manager error:', err);
    });
    
    // If socket doesn't connect within 5 seconds, resolve anyway to prevent hanging
    setTimeout(() => {
      if (!socket || !socket.connected) {
        console.warn('Socket connection timed out, continuing anyway');
        resolve(null);
      }
    }, 5000);
  });
  
  return socketPromise;
};

// Function to reconnect with token
export const reconnectWithToken = (token) => {
  if (!socket) return null;
  
  socket.auth = { token };
  socket.disconnect().connect();
  
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketPromise = null;
  }
};
