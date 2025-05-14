import { useState, useEffect } from 'react';
import styles from '../styles/Layout.module.css';
import { AuthModal } from './AuthForms';
import AuthStatus from './AuthStatus';

const Layout = ({ children, user, setUser, socket }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuthStatus, setShowAuthStatus] = useState(false);

  useEffect(() => {
    if (!socket) return;
    
    // Listen for connection errors
    socket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      if (err.message.includes('Server is full')) {
        setConnectionStatus('Server is full (max 3 connections). Try again later.');
      } else {
        setConnectionStatus(`Connection error: ${err.message}`);
      }
    });
    
    // Clear error when connected
    socket.on('connect', () => {
      setConnectionStatus(null);
      
      // Try to authenticate with token if available
      const token = localStorage.getItem('authToken');
      if (token && !socket.auth?.token) {
        socket.auth = { token };
        socket.disconnect().connect();
      }
    });
    
    // Click outside to close dropdown
    const handleClickOutside = (event) => {
      if (showAccountDropdown && !event.target.closest(`.${styles.authButtonContainer}`)) {
        setShowAccountDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      socket.off('connect_error');
      socket.off('connect');
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [socket, showAccountDropdown]);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthModalOpen(false);
    
    // Set the auth token for socket connection
    if (socket && userData.token) {
      socket.auth = { token: userData.token };
      socket.disconnect().connect(); // Reconnect with token
    }
  };
  
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
    
    setShowAccountDropdown(false);
    
    // Clear socket auth
    if (socket) {
      socket.auth = {};
      socket.disconnect().connect(); // Reconnect without token
    }
  };
  
  const handleShareRoom = () => {
    if (navigator.share) {
      navigator.share({
        title: 'YouTube Sync Party',
        text: 'Join my YouTube Sync Party!',
        url: window.location.href
      })
      .catch(err => console.error('Error sharing:', err));
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('Room link copied to clipboard!'))
        .catch(err => console.error('Failed to copy:', err));
    }
  };

  const toggleAccountDropdown = () => {
    setShowAccountDropdown(prev => !prev);
  };
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  const toggleAuthStatus = () => {
    setShowAuthStatus(prev => !prev);
  };

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>▶</span>
          <h1>YouTube Sync Party</h1>
        </div>
        <div className={styles.headerRight}>
          <button 
            className={styles.createButton}
            onClick={handleShareRoom}
          >
            <span className={styles.buttonIcon}>+</span> Share Room
          </button>
          
          <button
            className={styles.checkAuthButton}
            onClick={toggleAuthStatus}
            title="Check authentication status"
          >
            <span className={styles.buttonIcon}>🔒</span>
          </button>

          {/* Enhanced Authentication Button */}
          <div className={styles.authButtonContainer}>
            <button 
              className={styles.authButton}
              onClick={user ? toggleAccountDropdown : () => setIsAuthModalOpen(true)}
            >
              {user ? (
                <>
                  <span className={`${styles.authButtonIcon} ${user.isAdmin ? styles.adminIcon : ''}`}>
                    {user.isAdmin ? '👑' : '👤'}
                  </span>
                  <span>{user.username}</span>
                </>
              ) : (
                <>
                  <span className={styles.authButtonIcon}>🔐</span>
                  <span>Login / Register</span>
                </>
              )}
            </button>
            
            {user && showAccountDropdown && (
              <div className={styles.accountDropdown}>
                <div className={styles.accountInfo}>
                  <span className={styles.dropdownUsername}>{user.username}</span>
                  {user.isAdmin && <span className={styles.adminBadge}>Admin</span>}
                </div>
                <button 
                  className={styles.logoutButton}
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
          
          {/* Mobile menu button */}
          <button 
            className={styles.mobileAuthButton} 
            onClick={toggleMobileMenu}
          >
            ☰
          </button>
        </div>
      </header>
      
      {/* Auth status panel */}
      {showAuthStatus && (
        <div className={styles.authStatusPanel}>
          <div className={styles.authStatusHeader}>
            <h3>Authentication Status</h3>
            <button onClick={toggleAuthStatus} className={styles.closeAuthStatus}>×</button>
          </div>
          <AuthStatus user={user} socket={socket} />
        </div>
      )}
      
      {/* Mobile side menu */}
      <div className={`${styles.mobileSideMenu} ${mobileMenuOpen ? styles.open : ''}`}>
        {user ? (
          <>
            <div className={styles.mobileUserInfo}>
              <span className={`${styles.mobileUserIcon} ${user.isAdmin ? styles.adminIcon : ''}`}>
                {user.isAdmin ? '👑' : '👤'}
              </span>
              <span className={styles.mobileUsername}>{user.username}</span>
              {user.isAdmin && <span className={styles.mobileAdminBadge}>Admin</span>}
            </div>
            <button 
              className={styles.mobileLogoutButton}
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        ) : (
          <button 
            className={styles.mobileLoginButton}
            onClick={() => {
              setIsAuthModalOpen(true);
              setMobileMenuOpen(false);
            }}
          >
            Login / Register
          </button>
        )}
      </div>
      
      {connectionStatus && (
        <div className={styles.connectionError}>
          {connectionStatus}
        </div>
      )}
      
      <div className={styles.content}>
        <main className={styles.main}>{children}</main>
      </div>
      
      {isAuthModalOpen && (
        <AuthModal 
          onClose={() => setIsAuthModalOpen(false)}
          onLogin={handleLogin}
        />
      )}
    </div>
  );
};

export default Layout;
