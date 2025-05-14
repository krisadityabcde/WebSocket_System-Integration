import { useState } from 'react';
import { API_URL } from '../lib/socket';
import styles from '../styles/AuthStatus.module.css';

const AuthStatus = ({ user, socket }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusType, setStatusType] = useState('info'); // 'info', 'success', 'error'

  const checkAuthStatus = async () => {
    setIsChecking(true);
    setStatusMessage('Checking authentication status...');
    setStatusType('info');

    try {
      // Check if we have a token
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        setStatusMessage('No authentication token found. Please log in.');
        setStatusType('error');
        setIsChecking(false);
        return;
      }

      // Check socket connection status
      if (!socket) {
        setStatusMessage('Socket not initialized. Refresh the page to reconnect.');
        setStatusType('error');
        setIsChecking(false);
        return;
      }

      if (!socket.connected) {
        setStatusMessage('Socket disconnected. Attempting to reconnect...');
        setStatusType('error');
        
        // Try to reconnect with auth token
        socket.auth = { token };
        socket.connect();
        
        // Wait for connection
        setTimeout(() => {
          if (socket.connected) {
            setStatusMessage('Socket reconnected successfully!');
            setStatusType('success');
          } else {
            setStatusMessage('Failed to reconnect. Please refresh the page.');
            setStatusType('error');
          }
          setIsChecking(false);
        }, 2000);
        return;
      }

      // If socket is connected, check if we have a valid user
      if (user) {
        setStatusMessage(`Authenticated as ${user.username}${user.isAdmin ? ' (Admin)' : ''}`);
        setStatusType('success');
        setIsChecking(false);
      } else {
        setStatusMessage('Socket connected but user not authenticated. Try logging in again.');
        setStatusType('error');
        setIsChecking(false);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setStatusMessage(`Error checking authentication: ${error.message}`);
      setStatusType('error');
      setIsChecking(false);
    }
  };

  return (
    <div className={styles.authStatus}>
      <button 
        className={`${styles.checkButton} ${isChecking ? styles.checking : ''}`}
        onClick={checkAuthStatus}
        disabled={isChecking}
      >
        {isChecking ? 'Checking...' : 'Check Auth Status'}
      </button>
      
      {statusMessage && (
        <div className={`${styles.statusMessage} ${styles[statusType]}`}>
          <span className={styles.statusIcon}>
            {statusType === 'success' ? '✅' : 
             statusType === 'error' ? '❌' : 'ℹ️'}
          </span>
          {statusMessage}
        </div>
      )}
      
      <div className={styles.connectionInfo}>
        <div className={styles.connectionStatus}>
          Socket: {socket?.connected ? 
            <span className={styles.connected}>Connected</span> : 
            <span className={styles.disconnected}>Disconnected</span>}
        </div>
        <div className={styles.authInfo}>
          Auth: {user ? 
            <span className={styles.authenticated}>Authenticated</span> : 
            <span className={styles.unauthenticated}>Not Authenticated</span>}
        </div>
      </div>
    </div>
  );
};

export default AuthStatus;
