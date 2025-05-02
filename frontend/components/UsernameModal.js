import { useState } from 'react';
import styles from '../styles/UsernameModal.module.css';

const UsernameModal = ({ onSubmit, isOpen }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }
    
    onSubmit(username);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Welcome to YouTube Sync Party</h2>
        <p className={styles.subtitle}>Choose a username to get started</p>
        
        {error && <div className={styles.error}>{error}</div>}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className={styles.input}
            maxLength={20}
            autoFocus
          />
          <button type="submit" className={styles.button}>
            Join Party
          </button>
        </form>
      </div>
    </div>
  );
};

export default UsernameModal;
