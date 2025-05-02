import styles from '../styles/UsersList.module.css';

const UsersList = ({ users, hostId }) => {
  if (!users || users.length === 0) {
    return (
      <div className={styles.usersContainer}>
        <h3 className={styles.usersHeader}>Connected Users</h3>
        <p className={styles.noUsers}>No users connected</p>
      </div>
    );
  }
  
  return (
    <div className={styles.usersContainer}>
      <h3 className={styles.usersHeader}>Connected Users ({users.length})</h3>
      <ul className={styles.usersList}>
        {users.map((user) => (
          <li 
            key={user.id} 
            className={`${styles.userItem} ${user.isHost ? styles.hostUser : ''}`}
          >
            {user.isHost ? '👑 ' : ''}{user.username}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UsersList;
