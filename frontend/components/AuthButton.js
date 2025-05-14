import { useState, useEffect, useRef } from 'react';
import { AuthModal } from './AuthForms';
import styles from '../styles/AuthButton.module.css';

const AuthButton = ({ user, onLogin, onLogout, className = '' }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  
  // Handle outside clicks to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle successful login
  const handleLogin = (userData) => {
    setIsAuthModalOpen(false);
    onLogin(userData);
  };
  
  // Handle logout
  const handleLogout = () => {
    setShowDropdown(false);
    onLogout();
  };

  return (
    <div className={`${styles.authButtonWrapper} ${className}`} ref={dropdownRef}>
      {/* The main button */}
      <button 
        className={styles.authButton}
        onClick={() => user ? setShowDropdown(!showDropdown) : setIsAuthModalOpen(true)}
      >
        {user ? (
          <>
            <div className={`${styles.avatar} ${user.isAdmin ? styles.adminAvatar : ''}`}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className={styles.username}>{user.username}</span>
            <span className={styles.dropdownArrow}>▼</span>
          </>
        ) : (
          <>
            <span className={styles.loginIcon}>🔐</span>
            <span>Sign In</span>
          </>
        )}
      </button>
      
      {/* Dropdown menu for logged-in users */}
      {user && showDropdown && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <div className={`${styles.largeAvatar} ${user.isAdmin ? styles.adminAvatar : ''}`}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.fullUsername}>{user.username}</span>
              {user.isAdmin && <span className={styles.adminBadge}>Admin</span>}
            </div>
          </div>
          
          <div className={styles.dropdownDivider}></div>
          
          <div className={styles.dropdownMenu}>
            <button onClick={handleLogout} className={styles.logoutButton}>
              <span className={styles.logoutIcon}>⬅️</span>
              Sign Out
            </button>
          </div>
        </div>
      )}
      
      {/* Authentication modal */}
      {isAuthModalOpen && (
        <AuthModal 
          onClose={() => setIsAuthModalOpen(false)}
          onLogin={handleLogin}
        />
      )}
    </div>
  );
};

export default AuthButton;
