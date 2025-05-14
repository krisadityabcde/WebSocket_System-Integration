import { useState } from 'react';
import styles from '../styles/AuthForms.module.css';
import { API_URL } from '../lib/socket';

export const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // Use the correct API URL
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      // Check if the response is valid JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Please try again.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Save token to localStorage
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('username', username);
      localStorage.setItem('isAdmin', data.isAdmin);
      
      // Call the onLogin callback with user info
      onLogin({ 
        username, 
        isAdmin: data.isAdmin,
        token: data.token
      });
      
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Login</h2>
      {error && <div className={styles.error}>{error}</div>}
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            className={styles.input}
          />
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className={styles.input}
          />
        </div>
        
        <button 
          type="submit" 
          className={styles.submitButton}
          disabled={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export const RegisterForm = ({ onRegister, showAdminOption = false }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Please fill all required fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // Use the correct API URL
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password, isAdmin }),
      });

      // Check if the response is valid JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Please try again.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Call the onRegister callback
      onRegister({ success: true, message: 'Registration successful. You can now login.' });
      
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2 className={styles.formTitle}>Register</h2>
      {error && <div className={styles.error}>{error}</div>}
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="reg-username">Username</label>
          <input
            type="text"
            id="reg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            className={styles.input}
          />
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="reg-password">Password</label>
          <input
            type="password"
            id="reg-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose a password"
            className={styles.input}
          />
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            className={styles.input}
          />
        </div>
        
        {showAdminOption && (
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              Register as Admin
            </label>
          </div>
        )}
        
        <button 
          type="submit" 
          className={styles.submitButton}
          disabled={isLoading}
        >
          {isLoading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export const AuthModal = ({ onClose, onLogin, forceAuth = false }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [registrationMessage, setRegistrationMessage] = useState('');

  const handleRegisterSuccess = (data) => {
    setRegistrationMessage(data.message);
    setActiveTab('login');
  };

  return (
    <div className={`${styles.modalOverlay} ${forceAuth ? styles.forceAuth : ''}`}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'login' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('login')}
          >
            Login
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'register' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('register')}
          >
            Register
          </button>
          {!forceAuth && (
            <button className={styles.closeButton} onClick={onClose}>×</button>
          )}
        </div>
        
        {registrationMessage && (
          <div className={styles.successMessage}>{registrationMessage}</div>
        )}
        
        {activeTab === 'login' ? (
          <LoginForm onLogin={onLogin} />
        ) : (
          <RegisterForm onRegister={handleRegisterSuccess} showAdminOption={true} />
        )}
      </div>
    </div>
  );
};
