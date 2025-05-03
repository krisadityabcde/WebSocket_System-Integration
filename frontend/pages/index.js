import { useEffect, useState } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import Player from '../components/Player';
import Chat from '../components/Chat';
import VideoQueue from '../components/Queue';
import UsernameModal from '../components/UsernameModal';
import UsersList from '../components/UsersList';
import styles from '../styles/Home.module.css';
import { initializeSocket } from '../lib/socket';
import { fetchYoutubeVideoTitle } from '../lib/youtubeApi';

export default function Home() {
  const [socket, setSocket] = useState(null);
  const [currentVideo, setCurrentVideo] = useState('dQw4w9WgXcQ');
  const [currentVideoTitle, setCurrentVideoTitle] = useState('');
  const [queue, setQueue] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [userCount, setUserCount] = useState(1);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [showChat, setShowChat] = useState(true);
  const [showUsernameModal, setShowUsernameModal] = useState(true);
  const [username, setUsername] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [hostId, setHostId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const setupSocket = async () => {
      try {
        console.log('Initializing socket from Home component...');
        const socketInstance = await initializeSocket();
        
        if (!isMounted) return;
        
        if (socketInstance) {
          console.log('Socket instance received in Home component');
          
          // Force immediate connection check
          if (socketInstance.connected) {
            console.log('Socket is already connected');
            setIsConnected(true);
            setSocket(socketInstance);
          }
          
          // Set up event listeners for connection
          const onConnect = () => {
            console.log('Connected event fired in Home component');
            if (isMounted) {
              setIsConnected(true);
              setConnectionError(null);
              setSocket(socketInstance);
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
              setConnectionError(`Connection error: ${err.message}`);
            }
          };
          
          // Event listener for username confirmation
          const onUsernameSet = (name) => {
            console.log('Username set:', name);
            if (isMounted) {
              setUsername(name);
              setShowUsernameModal(false);
            }
          };
          
          // Event listener for host status changes
          const onBecomeHost = (status) => {
            console.log('Become host:', status);
            if (isMounted) {
              setIsHost(status);
            }
          };
          
          // Event listener for host changes
          const onHostChanged = (data) => {
            console.log('Host changed:', data);
            if (isMounted) {
              setHostId(data.hostId);
              
              // Check if we are the new host
              if (data.hostId === socketInstance.id) {
                setIsHost(true);
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
              setUserCount(data.count);
              setConnectedUsers(data.users || []);
              setHostId(data.hostId);
              
              // Update host status
              if (socketInstance.id === data.hostId) {
                setIsHost(true);
              }
            }
          };
          
          const onInitState = (state) => {
            if (isMounted) {
              setCurrentVideo(state.videoId);
              setIsHost(state.isHost);
              setHostId(state.hostId);
            }
          };
          
          // Remove existing listeners before adding new ones
          socketInstance.off('connect', onConnect);
          socketInstance.off('disconnect', onDisconnect);
          socketInstance.off('connect_error', onConnectError);
          socketInstance.off('usernameSet', onUsernameSet);
          socketInstance.off('becomeHost', onBecomeHost);
          socketInstance.off('hostChanged', onHostChanged);
          socketInstance.off('updateQueue', onUpdateQueue);
          socketInstance.off('changeVideo', onChangeVideo);
          socketInstance.off('userCount', onUserCount);
          socketInstance.off('initState', onInitState);
          
          // Add event listeners
          socketInstance.on('connect', onConnect);
          socketInstance.on('disconnect', onDisconnect);
          socketInstance.on('connect_error', onConnectError);
          socketInstance.on('usernameSet', onUsernameSet);
          socketInstance.on('becomeHost', onBecomeHost);
          socketInstance.on('hostChanged', onHostChanged);
          socketInstance.on('updateQueue', onUpdateQueue);
          socketInstance.on('changeVideo', onChangeVideo);
          socketInstance.on('userCount', onUserCount);
          socketInstance.on('initState', onInitState);
          
          // Setup periodic connection check
          const debugInterval = setInterval(() => {
            console.log('Socket connected state:', socketInstance.connected);
            
            // Force the connected state if socket is connected but UI doesn't show it
            if (socketInstance.connected && !isConnected && isMounted) {
              console.log('Forcing connected state update');
              setIsConnected(true);
              setSocket(socketInstance);
            }
          }, 5000);
          
          return () => {
            clearInterval(debugInterval);
            
            socketInstance.off('connect', onConnect);
            socketInstance.off('disconnect', onDisconnect);
            socketInstance.off('connect_error', onConnectError);
            socketInstance.off('usernameSet', onUsernameSet);
            socketInstance.off('becomeHost', onBecomeHost);
            socketInstance.off('hostChanged', onHostChanged);
            socketInstance.off('updateQueue', onUpdateQueue);
            socketInstance.off('changeVideo', onChangeVideo);
            socketInstance.off('userCount', onUserCount);
            socketInstance.off('initState', onInitState);
          };
        }
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
  }, [connectionAttempts, isConnected]);

  // Function to handle username submission
  const handleUsernameSubmit = (name) => {
    if (socket && name.trim()) {
      socket.emit('setUsername', name);
      setUsername(name);
      setShowUsernameModal(false);
    }
  };

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

  const handleChangeVideo = (videoId) => {
    socket?.emit('changeVideo', videoId);
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
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Head>
        <title>{currentVideoTitle} - YouTube Sync Party</title>
        <meta name="description" content="Watch YouTube videos together in sync" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <UsernameModal 
        isOpen={showUsernameModal}
        onSubmit={handleUsernameSubmit}
      />

      <div className={styles.container}>
        <div className={styles.mainContent}>
          <div className={styles.playerSection}>
            {socket && <Player socket={socket} videoId={currentVideo} isHost={isHost} />}
            
            <div className={styles.videoInfo}>
              <h1 className={styles.videoTitle}>{currentVideoTitle}</h1>
              <div className={styles.viewCount}>
                <span>
                  👥 {userCount} user{userCount !== 1 ? 's' : ''} watching
                  {isHost && <span className={styles.hostBadge}> • You are the host</span>}
                </span>
              </div>
              
              <div className={styles.videoControls}>
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
          <UsersList users={connectedUsers} hostId={hostId} />
          
          <VideoQueue 
            queue={queue} 
            onAddToQueue={handleAddToQueue}
            onRemoveFromQueue={handleRemoveFromQueue}
            onReorderQueue={handleReorderQueue}
            currentVideo={currentVideo}
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