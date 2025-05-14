import { useState } from 'react';
import styles from '../styles/UsersList.module.css';

const UsersList = ({ users, socket }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const refreshUsersList = () => {
    if (!socket) return;
    
    setIsRefreshing(true);
    socket.emit('requestUsersList');
    setTimeout(() => setIsRefreshing(false), 1000);
  };
  
  if (!users || users.length === 0) {
    return (
      <div className={styles.usersContainer}>
        <h3 className={styles.usersHeader}>Connected Users</h3>
        <p className={styles.noUsers}>No users connected</p>
      </div>
    );
  }
  
  // Check if any admin is in the users list
  const hasAdmin = users.some(user => user.isAdmin);
  
  // Sort users so admin appears first
  const sortedUsers = [...users].sort((a, b) => {
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return a.username.localeCompare(b.username);
  });
  
  return (
    <div className={styles.usersContainer}>
      <div className={styles.usersHeaderContainer}>
        <h3 className={styles.usersHeader}>
          Connected Users
          <span className={styles.userCountBadge}>{users.length}</span>
        </h3>
        
        <button 
          className={styles.refreshButton}
          onClick={refreshUsersList}
          disabled={isRefreshing || !socket}
          title="Refresh users list"
        >
          {isRefreshing ? '⟳' : '↻'}
        </button>
      </div>
      
      {!hasAdmin && (
        <div className={styles.noAdminWarning}>
          ⚠️ No admin is connected
        </div>
      )}
      
      <ul className={styles.usersList}>
        {sortedUsers.map((user) => (
          <li 
            key={user.id} 
            className={`${styles.userItem} ${user.isAdmin ? styles.adminUser : ''}`}
          >
            <div className={styles.userIcon}>
              {user.isAdmin ? '👑' : '👤'}
            </div>
            <div className={styles.userName}>
              {user.username}
              {user.isAdmin && <span className={styles.adminBadge}>Admin</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UsersList;
