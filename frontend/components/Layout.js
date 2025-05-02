import styles from '../styles/Layout.module.css';

const Layout = ({ children }) => {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>▶</span>
          <h1>YouTube Sync Party</h1>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.createButton}>
            <span className={styles.buttonIcon}>+</span> Share Room
          </button>
          <div className={styles.userIcon}>👤</div>
        </div>
      </header>
      
      <div className={styles.content}>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
};

export default Layout;
