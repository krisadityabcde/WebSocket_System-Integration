import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import Player from '../components/Player';
import Chat from '../components/Chat';
import VideoQueue from '../components/Queue';
import UsersList from '../components/UsersList';
import { AuthModal } from '../components/AuthForms';
import styles from '../styles/Home.module.css';
import { initializeSocket, setAuthErrorHandlers, disconnectSocket } from '../lib/socket';
import { fetchYoutubeVideoTitle } from '../lib/youtubeApi';

export default function Home() {
  // Auth & socket states
  const [user, setUser] = useState(null);
  const [isAuthRequired, setIsAuthRequired] = useState(true);
  const [waitingForAdmin, setWaitingForAdmin] = useState(false);
  const [socket, setSocket] = useState(null);
  
  // Video states
  const [currentVideo, setCurrentVideo] = useState('dQw4w9WgXcQ');
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');
  const [queue, setQueue] = useState([]);
  
  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [userCount, setUserCount] = useState(1);
  const [connectedUsers, setConnectedUsers] = useState([]);
  
  // UI states
  const [showChat, setShowChat] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Set up auth error handlers for the socket
  useEffect(() => {
    setAuthErrorHandlers({
      onAuthError: (message) => {
        console.log('Auth error:', message);
        // Clear user data and redirect to auth screen
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        localStorage.removeItem('isAdmin');
        setUser(null);
        setIsAuthRequired(true);
        disconnectSocket();
      },
      onAdminRequired: () => {
        console.log('Waiting for admin to join');
        setWaitingForAdmin(true);
        setConnectionError('Waiting for an admin to start the room');
      }
    });
  }, []);

  // Check for stored authentication on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUsername = localStorage.getItem('username');
    const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (storedToken && storedUsername) {
      setUser({
        username: storedUsername,
        isAdmin: storedIsAdmin,
        token: storedToken
      });
      setIsAuthRequired(false);
    }
  }, []);
  
  // Handle login success
  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthRequired(false);
    setWaitingForAdmin(false);
    setConnectionAttempts(prev => prev + 1); // Trigger socket reconnection
  }

  useEffect(() => {
    let isMounted = true;
    
    // Only initialize socket if user is authenticated
    if (!user) return;
    
    const setupSocket = async () => {
      try {
        console.log('Initializing socket from Home component...');
        const socketInstance = await initializeSocket();
        
        if (!socketInstance) {
          console.log('Failed to get socket instance');
          return;
        }
        
        if (!isMounted) return;
        
        // Force immediate connection check
        if (socketInstance.connected) {
          console.log('Socket is already connected');
          setIsConnected(true);
          setSocket(socketInstance);
          setWaitingForAdmin(false);
        }
        
        // Set up event listeners for connection
        const onConnect = () => {
          console.log('Connected event fired in Home component');
          if (isMounted) {
            setIsConnected(true);
            setConnectionError(null);
            setSocket(socketInstance);
            setWaitingForAdmin(false);
          }
        };
        
        const onDisconnect = () => {
          console.log('Disconnected from socket server');
          if (isMounted) {
            setIsConnected(false);
          }
        };
        
        const onConnectError = (err) => {
          console.error('Connection error:', err);
          if (isMounted) {
            if (err.message.includes('Waiting for an admin')) {
              setWaitingForAdmin(true);
              setConnectionError('Waiting for an admin to start the room');
            } else {
              setConnectionError(`Connection error: ${err.message}`);
            }
          }
        };
        
        // State update listeners
        const onUpdateQueue = (updatedQueue) => {
          if (isMounted) {
            setQueue(updatedQueue);
          }
        };
        
        const onChangeVideo = (data) => {
          if (isMounted) {
            setCurrentVideo(data.videoId);
            // Set a notification or toast message that video was changed by user
          }
        };
        
        const onUserCount = (data) => {
          if (isMounted) {
            console.log('Received updated user list:', data.users);
            setUserCount(data.count);
            // Ensure we always have the latest user list by creating a new array
            setConnectedUsers(Array.isArray(data.users) ? [...data.users] : []);
          }
        };
        
        const onInitState = (state) => {
          if (isMounted) {
            setCurrentVideo(state.videoId);
            
            // Tambahkan pemrosesan queue
            if (state.queue && Array.isArray(state.queue)) {
              setQueue(state.queue);
            }
          }
        };

        const onSyncState = (state) => {
          // Jika ini adalah listener baru yang perlu ditambahkan
          if (isMounted) {
            // Proses state lainnya...
            
            // Tambahkan pemrosesan queue
            if (state.queue && Array.isArray(state.queue)) {
              setQueue(state.queue);
            }
          }
        };

        const onVideoPlayState = (isPlaying) => {
          setIsVideoPlaying(isPlaying);
        };
        
        // Setup event listeners
        socketInstance.on('connect', onConnect);
        socketInstance.on('disconnect', onDisconnect);
        socketInstance.on('connect_error', onConnectError);
        socketInstance.on('updateQueue', onUpdateQueue);
        socketInstance.on('changeVideo', onChangeVideo);
        socketInstance.on('userCount', onUserCount);
        socketInstance.on('initState', onInitState);
        socketInstance.on('videoPlayState', onVideoPlayState);
        socketInstance.on('syncState', onSyncState);
        
        return () => {
          // Cleanup function
          socketInstance.off('connect', onConnect);
          socketInstance.off('disconnect', onDisconnect);
          socketInstance.off('connect_error', onConnectError);
          socketInstance.off('updateQueue', onUpdateQueue);
          socketInstance.off('changeVideo', onChangeVideo);
          socketInstance.off('userCount', onUserCount);
          socketInstance.off('initState', onInitState);
          socketInstance.off('videoPlayState', onVideoPlayState);
          socketInstance.off('syncState', onSyncState);
        };
      } catch (error) {
        console.error('Error setting up socket:', error);
        if (isMounted) {
          setConnectionError(`Failed to initialize: ${error.message}`);
        }
      }
    };
    
    setupSocket();
    
    return () => {
      isMounted = false;
    };
  }, [connectionAttempts, user]);

  // Function to fetch video title from YouTube API
  const fetchVideoTitle = async (id) => {
    const title = await fetchYoutubeVideoTitle(id);
    setCurrentVideoTitle(title);
  };

  // Update video title when video changes
  useEffect(() => {
    if (currentVideo) {
      fetchVideoTitle(currentVideo);
    }
  }, [currentVideo]);

  const handleAddToQueue = (videoData) => {
    socket?.emit('addToQueue', videoData);
  };

  // Update the handleChangeVideo method to include title
  const handleChangeVideo = (videoId) => {
    const title = currentVideoTitle || 'Unknown Title';
    
    // Send both ID and title to server
    socket?.emit('changeVideo', {
      id: videoId,
      title: title
    });
  };

  const handlePlayNext = () => {
    socket?.emit('playNextInQueue');
  };

  // Add this handler function
  const handleRemoveFromQueue = (index) => {
    socket?.emit('removeFromQueue', index);
  };

  // Add this handler function
  const handleReorderQueue = (oldIndex, newIndex) => {
    socket?.emit('reorderQueue', { oldIndex, newIndex });
  };

  // If authentication is required, show the auth modal
  if (isAuthRequired) {
    return (
      <div className={styles.authContainer}>
        <Head>
          <title>Login - YouTube Sync Party</title>
        </Head>
        <div className={styles.authLogo}>
          <span className={styles.logoIcon}>▶</span>
          <h1>YouTube Sync Party</h1>
        </div>
        
        <div className={styles.authPrompt}>
          <h2>Sign in to continue</h2>
          <p>Please sign in or register to join the party</p>
        </div>
        
        <AuthModal 
          onLogin={handleLogin} 
          forceAuth={true} 
        />
      </div>
    );
  }

  if (waitingForAdmin) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingLogo}>
            <span className={styles.loadingIcon}>▶</span>
            YouTube Sync Party
          </div>
          <p>Waiting for an admin to start the room...</p>
          <p className={styles.hint}>Only an admin can initiate the room</p>
          {user?.isAdmin && (
            <p className={styles.adminNote}>You are an admin - please refresh to try connecting again</p>
          )}
          <button 
            onClick={() => {
              // Log out instead of retrying
              localStorage.removeItem('authToken');
              localStorage.removeItem('username');
              localStorage.removeItem('isAdmin');
              setUser(null);
              setIsAuthRequired(true);
              disconnectSocket();
            }}
            className={styles.button}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingLogo}>
            <span className={styles.loadingIcon}>▶</span>
            YouTube Sync Party
          </div>
          <p>Connecting to server... {connectionAttempts > 0 ? `(Attempt ${connectionAttempts})` : ''}</p>
          {connectionError && <p className={styles.error}>{connectionError}</p>}
          <button 
            onClick={() => setConnectionAttempts(prev => prev + 1)}
            className={styles.button}
          >
            Retry Connection
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('authToken');
              localStorage.removeItem('username');
              localStorage.removeItem('isAdmin');
              setUser(null);
              setIsAuthRequired(true);
              disconnectSocket();
            }}
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout user={user} setUser={setUser} socket={socket}>
      <Head>
        <title>YouTube Sync Party</title>
        <meta name="description" content="Watch YouTube videos together in sync" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.container}>
        <div className={styles.mainContent}>
          <div className={styles.playerSection}>
            {socket && (
              <Player 
                socket={socket} 
                videoId={currentVideo} 
                isAdmin={user?.isAdmin} 
              />
            )}
            
            <div className={styles.videoInfo}>
              <h1 className={styles.videoTitle}>{currentVideoTitle}</h1>
              <div className={styles.viewCount}>
                <span>
                  👥 {userCount} user{userCount !== 1 ? 's' : ''} watching
                  {user?.isAdmin && <span className={styles.adminBadge}> • You are the admin</span>}
                </span>
              </div>
              
              <div className={styles.videoControls}>
                {/* Only show video controls to admin */}
                {user?.isAdmin && (
                  <>
                    <div className={styles.inputWrapper}>
                      <input 
                        type="text" 
                        placeholder="Enter YouTube Video ID or URL"
                        id="videoInput"
                        className={styles.videoInput}
                      />
                      <button 
                        onClick={() => {
                          const input = document.getElementById('videoInput').value.trim();
                          const videoId = extractVideoId(input);
                          if (videoId) {
                            handleChangeVideo(videoId);
                            document.getElementById('videoInput').value = '';
                          }
                        }}
                        className={styles.button}
                      >
                        Change Video
                      </button>
                    </div>
                    <button onClick={handlePlayNext} className={`${styles.button} ${styles.nextButton}`}>
                      Play Next
                    </button>
                  </>
                )}
                {!user?.isAdmin && (
                  <p className={styles.viewerNote}>
                    Only the admin can control video playback
                  </p>
                )}
              </div>
            </div>
            
            <div className={styles.tabContainer}>
              <div 
                className={`${styles.tab} ${showChat ? styles.activeTab : ''}`}
                onClick={() => setShowChat(true)}
              >
                Chat
              </div>
              <div 
                className={`${styles.tab} ${!showChat ? styles.activeTab : ''}`}
                onClick={() => setShowChat(false)}
              >
                About
              </div>
            </div>
            
            <div className={styles.tabContent}>
              {showChat ? (
                <Chat socket={socket} />
              ) : (
                <div className={styles.aboutSection}>
                  <h3>About YouTube Sync Party</h3>
                  <p>Watch YouTube videos in perfect sync with your friends. Share your favorite videos, chat in real-time, and create a queue for continuous playback.</p>
                  <p>Use the input field above to paste any YouTube link or video ID to change what everyone is watching.</p>
                  <p>The first person to join becomes the host, and video playback syncs to their actions. If the host leaves, a new host is automatically assigned.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className={styles.sidePanel}>
          <UsersList users={connectedUsers} socket={socket} />
          
          <VideoQueue 
            queue={queue} 
            onAddToQueue={handleAddToQueue}
            onRemoveFromQueue={handleRemoveFromQueue}
            onReorderQueue={handleReorderQueue}
            currentVideo={currentVideo}
            isAdmin={user?.isAdmin}
          />
        </div>
      </div>
    </Layout>
  );
}

// Extract YouTube video ID from various URL formats
function extractVideoId(input) {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }
  
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = input.match(regex);
  
  return match ? match[1] : null;
}