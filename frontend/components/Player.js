import { useEffect, useRef, useState } from 'react';
import styles from '../styles/Player.module.css';

const Player = ({ socket, videoId, isAdmin }) => {
  const playerRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isControlledUpdate, setIsControlledUpdate] = useState(false);
  const lastSyncTimeRef = useRef(0);
  const syncInProgressRef = useRef(false);
  const [seekThrottleTimer, setSeekThrottleTimer] = useState(null);
  const [connectionQuality, setConnectionQuality] = useState('good'); // good, fair, poor
  const [lastPingTime, setLastPingTime] = useState(null);
  const [adminInitiatedPlayback, setAdminInitiatedPlayback] = useState(false);
  const [waitingForAdmin, setWaitingForAdmin] = useState(true);
  const [adminInitiatedFirstPlay, setAdminInitiatedFirstPlay] = useState(false);
  
  useEffect(() => {
    // Initialize YouTube player when component mounts
    if (!window.YT) {
      // If YouTube API isn't loaded yet, wait
      const interval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(interval);
          initPlayer();
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      initPlayer();
    }

    function initPlayer() {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          'playsinline': 1,
          'autoplay': 0,
          // Enable controls for all users
          'controls': 1,
          'rel': 0,
          'fs': 1,
          'modestbranding': 1
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
        }
      });
    }

    return () => {
      // Cleanup player on unmount
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  // Handle video ID changes
  useEffect(() => {
    if (playerReady && playerRef.current && videoId) {
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId, playerReady]);

  // Set up heartbeat ping to measure connection quality
  useEffect(() => {
    if (!socket || !playerReady) return;
    
    let pingInterval;
    
    // Set up ping to check connection quality every 10 seconds
    pingInterval = setInterval(() => {
      const start = Date.now();
      setLastPingTime(start);
      
      socket.emit('ping');
      
      // If we don't get a response in 5 seconds, mark connection as poor
      const timeout = setTimeout(() => {
        setConnectionQuality('poor');
      }, 5000);
      
      // Listen for pong response
      const handlePong = () => {
        clearTimeout(timeout);
        const latency = Date.now() - start;
        
        // Update connection quality based on latency
        if (latency < 150) {
          setConnectionQuality('good');
        } else if (latency < 500) {
          setConnectionQuality('fair');
        } else {
          setConnectionQuality('poor');
        }
      };
      
      socket.once('pong', handlePong);
      
      return () => {
        socket.off('pong', handlePong);
        clearTimeout(timeout);
      };
    }, 10000);
    
    return () => {
      clearInterval(pingInterval);
    };
  }, [socket, playerReady]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !playerReady) return;

    // Enhanced sync handling
    socket.on('initState', (state) => {
      console.log('Received initial state:', state);
      setAdminInitiatedPlayback(state.adminInitiatedPlayback || false);
      handleStateUpdate(state);
      setAdminInitiatedFirstPlay(state.adminInitiatedFirstPlay);
      if (!isAdmin && !state.adminInitiatedFirstPlay) {
        setWaitingForAdmin(true);
      }
    });
    
    // Handle sync state with improved timing
    socket.on('syncState', (state) => {
      console.log('Received sync state:', state);
      setAdminInitiatedPlayback(state.adminInitiatedPlayback || false);
      handleStateUpdate(state);
    });
    
    // Rename to syncFromAdmin
    socket.on('syncFromAdmin', (state) => {
      console.log('Forced sync from admin:', state);
      setAdminInitiatedPlayback(state.adminInitiatedPlayback || false);
      
      // Always handle the state update, even if it's mid-playback
      if (state.forceSync || !isAdmin) {
        handleStateUpdate(state);
      }
    });
    
    // Handle temporary seek (for non-admin users)
    socket.on('temporarySeek', (time) => {
      console.log('Temporary seek allowed to:', time);
      setIsControlledUpdate(true);
      playerRef.current.seekTo(time, true);
      setTimeout(() => setIsControlledUpdate(false), 500);
    });

    // Handle become host/admin event
    socket.on('becomeHost', (status) => {
      console.log('You are now the host!');
    });
    
    // Improved play event handling
    socket.on('videoPlay', (data) => {
      console.log('Received play command at time:', data.time);
      
      // Update adminInitiatedPlayback flag
      if (data.fromAdmin) {
        setAdminInitiatedPlayback(true);
        setWaitingForAdmin(false);
      }
      
      syncInProgressRef.current = true;
      setIsControlledUpdate(true);
      
      // Calculate time adjustment for network delay
      const networkDelay = (Date.now() - data.timestamp) / 1000;
      const adjustedTime = data.time + networkDelay;
      
      const currentTime = playerRef.current.getCurrentTime();
      
      // Only seek if time difference is significant
      if (Math.abs(currentTime - adjustedTime) > 1) {
        playerRef.current.seekTo(adjustedTime, true);
      }
      
      // Explicitly play the video for ALL users, regardless of who sent the command
      // Add an immediate play attempt
      const playPromise = playerRef.current.playVideo();
      
      // Handle any errors from the play attempt (browsers might block autoplay)
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Play was prevented:', error);
          // If play was prevented, try again with user interaction simulation
          setTimeout(() => {
            playerRef.current.playVideo();
          }, 100);
        });
      }
      
      // Reset control flags after a short delay
      setTimeout(() => {
        syncInProgressRef.current = false;
        setIsControlledUpdate(false);
      }, 500);
    });

    // Enhanced the videoPause handler
    socket.on('videoPause', (data) => {
      console.log('Received pause command at time:', data.time);
      syncInProgressRef.current = true;
      setIsControlledUpdate(true);
      
      // Seek to the exact time then pause
      playerRef.current.seekTo(data.time, true);
      playerRef.current.pauseVideo();
      
      // If this is a forced pause due to waiting for admin, update UI accordingly
      if (data.forcePause) {
        setWaitingForAdmin(true);
      }
      
      // Reset control flags after a short delay
      setTimeout(() => {
        syncInProgressRef.current = false;
        setIsControlledUpdate(false);
      }, 500);
    });

    // Improved seek event handling
    socket.on('videoSeek', (data) => {
      console.log('Received seek command to time:', data.time);
      syncInProgressRef.current = true;
      setIsControlledUpdate(true);
      
      playerRef.current.seekTo(data.time, true);
      
      // Reset control flags after a short delay
      setTimeout(() => {
        syncInProgressRef.current = false;
        setIsControlledUpdate(false);
      }, 500);
    });

    // Improved video change handling
    socket.on('changeVideo', (data) => {
      console.log('Received change video command:', data);
      syncInProgressRef.current = true;
      setIsControlledUpdate(true);
      
      playerRef.current.loadVideoById(data.videoId);
      
      // Reset control flags after a short delay
      setTimeout(() => {
        syncInProgressRef.current = false;
        setIsControlledUpdate(false);
      }, 1000);
    });

    // Helper function for state updates
    function handleStateUpdate(state) {
      if (!playerReady) return;
      
      syncInProgressRef.current = true;
      setIsControlledUpdate(true);
      
      // Load video only if it's different
      if (state.videoId !== videoId) {
        playerRef.current.loadVideoById(state.videoId, state.currentTime);
      } else {
        // Just seek to the time
        playerRef.current.seekTo(state.currentTime, true);
      }
      
      // Match play/pause state
      if (state.isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
      
      // Reset control flags after a short delay
      setTimeout(() => {
        syncInProgressRef.current = false;
        setIsControlledUpdate(false);
      }, 1000);
    }

    // Set up sync interval based on admin status only
    const syncInterval = setInterval(() => {
      if (playerRef.current && playerReady) {
        const playerState = playerRef.current.getPlayerState();
        const currentTime = playerRef.current.getCurrentTime();
        
        // Only admin sends sync info
        if (isAdmin && playerState === 1 && (Date.now() - lastSyncTimeRef.current > 500)) {
          console.log('Admin syncing play state at time:', currentTime);
          socket.emit('videoPlay', currentTime);
          lastSyncTimeRef.current = Date.now();
        } 
        // Only emit pause state once to avoid spamming
        else if (isAdmin && playerState === 2 && (Date.now() - lastSyncTimeRef.current > 1000)) {
          console.log('Admin syncing pause state at time:', currentTime);
          socket.emit('videoPause', currentTime);
          lastSyncTimeRef.current = Date.now();
        }
      }
    }, isAdmin ? 200 : 1000);

    // Request initial sync
    socket.emit('requestSync');

    socket.on('forceInitialState', (data) => {
      if (playerRef.current && playerRef.current.pauseVideo) {
        console.log('Forcing initial state:', data);
        setIsControlledUpdate(true);
        
        // Force video to beginning and pause
        playerRef.current.seekTo(data.currentTime, true);
        playerRef.current.pauseVideo();
        
        setWaitingForAdmin(true);
        
        setTimeout(() => {
          setIsControlledUpdate(false);
        }, 500);
      }
    });
    
    // Add listener for admin first play status
    socket.on('adminInitiatedFirstPlay', (status) => {
      console.log('Admin initiated first play:', status);
      setAdminInitiatedFirstPlay(status);
      if (status) {
        setWaitingForAdmin(false);
      } else {
        setWaitingForAdmin(true);
      }
    });

    return () => {
      // Cleanup event listeners
      socket.off('initState');
      socket.off('syncState');
      socket.off('syncFromAdmin');
      socket.off('temporarySeek');
      socket.off('videoPlay');
      socket.off('videoPause');
      socket.off('videoSeek');
      socket.off('changeVideo');
      clearInterval(syncInterval);
    };
  }, [socket, playerReady, videoId, isAdmin]);

  function onPlayerReady(event) {
    console.log('Player ready');
    setPlayerReady(true);
    
    // Request sync when player is ready
    if (socket) {
      socket.emit('requestSync');
    }
  }

  // Enhanced the onPlayerStateChange function to be stricter
  function onPlayerStateChange(event) {
    if (!playerReady || !socket) return;
    
    // Don't emit events if this update was caused by another user or sync
    if (isControlledUpdate || syncInProgressRef.current) {
      return;
    }
    
    const currentTime = playerRef.current.getCurrentTime();
    lastSyncTimeRef.current = Date.now();
    
    if (!isAdmin) {
      // For non-admin users, ALWAYS check if admin has initiated playback before allowing play
      if (event.data === 1 && !adminInitiatedPlayback) { // Trying to play
        console.log('Cannot play until admin starts playback');
        // Immediately pause the video
        playerRef.current.pauseVideo();
        setWaitingForAdmin(true);
        return; // Important! Return early to prevent any other actions
      }
    }
    
    // Only allow admin to control playback for all users
    if (isAdmin) {
      if (event.data === 1) { // Playing
        console.log('Emitting play event at time:', currentTime);
        socket.emit('videoPlay', currentTime);
        socket.emit('videoPlayState', true);
      } else if (event.data === 2) { // Paused
        console.log('Emitting pause event at time:', currentTime);
        socket.emit('videoPause', currentTime);
        socket.emit('videoPlayState', false);
      } else if (event.data === 0) { // Ended
        console.log('Video ended, requesting next in queue');
        socket.emit('videoPlayState', false);
        socket.emit('playNextInQueue');
      }
      
      // When seeking, throttle the seek events
      if (event.data === 3) {
        if (seekThrottleTimer) clearTimeout(seekThrottleTimer);
        
        const timer = setTimeout(() => {
          if (playerRef.current) {
            const currentTime = playerRef.current.getCurrentTime();
            socket.emit('videoSeek', currentTime);
          }
        }, 250);
        
        setSeekThrottleTimer(timer);
      }
    } else {
      // For non-admin users, only allow play if admin has started playback before
      if (event.data === 1 && !adminInitiatedPlayback) { // Trying to play
        console.log('Cannot play until admin starts playback');
        // Immediately pause the video
        playerRef.current.pauseVideo();
        setWaitingForAdmin(true);
      } else if (event.data === 1 && adminInitiatedPlayback) {
        // Allow regular playback if admin has initiated before
        socket.emit('videoPlay', currentTime);
      } else if (event.data === 2) { // Paused
        socket.emit('videoPause', currentTime);
      } else if (event.data === 0) { // Ended
        socket.emit('videoPlayState', false);
      }
      
      // Non-admin users can send temporary seek requests
      // but the server might sync them back
      if (event.data === 3) {
        if (seekThrottleTimer) clearTimeout(seekThrottleTimer);
        
        const timer = setTimeout(() => {
          if (playerRef.current) {
            socket.emit('temporarySeek', playerRef.current.getCurrentTime());
          }
        }, 250);
        
        setSeekThrottleTimer(timer);
      }
    }
  }

  return (
    <div className={styles.playerContainer}>
      <div id="youtube-player" className={styles.player}></div>
      <div className={styles.playerOverlay}>
        <div className={`${styles.syncIndicator} ${styles[connectionQuality]}`}>
          {syncInProgressRef.current ? '🔄 Syncing...' : 
            isAdmin ? '👑 Admin' : 
            `✓ In sync (${connectionQuality})`}
        </div>
        
        {/* Only show waiting overlay when needed */}
        {!isAdmin && waitingForAdmin && (
          <div className={styles.waitingOverlay}>
            <div className={styles.waitingMessage}>
              <div className={styles.waitingIcon}>⏳</div>
              Waiting for admin to start playback
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Player;