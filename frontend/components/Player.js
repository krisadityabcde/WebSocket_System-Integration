import { useEffect, useRef, useState } from 'react';
import styles from '../styles/Player.module.css';

const Player = ({ socket, videoId, isHost }) => {
  const playerRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isControlledUpdate, setIsControlledUpdate] = useState(false);
  const lastSyncTimeRef = useRef(0);
  const syncInProgressRef = useRef(false);
  
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
          'controls': 1,
          'rel': 0,
          'fs': 1, // Enables fullscreen button
          'modestbranding': 1 // Hides YouTube logo
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

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !playerReady) return;

    // Enhanced sync handling
    socket.on('initState', (state) => {
      console.log('Received initial state:', state);
      handleStateUpdate(state);
    });
    
    // Handle sync state with improved timing
    socket.on('syncState', (state) => {
      console.log('Received sync state:', state);
      handleStateUpdate(state);
    });
    
    // Handle sync from host (for non-host users)
    socket.on('syncFromHost', (state) => {
      console.log('Forced sync from host:', state);
      handleStateUpdate(state);
    });
    
    // Handle temporary seek (for non-host users)
    socket.on('temporarySeek', (time) => {
      console.log('Temporary seek allowed to:', time);
      setIsControlledUpdate(true);
      playerRef.current.seekTo(time, true);
      setTimeout(() => setIsControlledUpdate(false), 500);
    });

    // Handle become host event
    socket.on('becomeHost', (status) => {
      console.log('You are now the host!');
      // No need to do anything here, parent component will update isHost prop
    });
    
    // Improved play event handling
    socket.on('videoPlay', (data) => {
      console.log('Received play command at time:', data.time);
      syncInProgressRef.current = true;
      setIsControlledUpdate(true);
      
      // Calculate time adjustment for network delay
      const networkDelay = (Date.now() - data.timestamp) / 1000;
      const adjustedTime = data.time + networkDelay;
      
      const currentTime = playerRef.current.getCurrentTime();
      
      // Only seek if time difference is significant
      if (Math.abs(currentTime - adjustedTime) > 2) {
        playerRef.current.seekTo(adjustedTime, true);
      }
      
      playerRef.current.playVideo();
      
      // Reset control flags after a short delay
      setTimeout(() => {
        syncInProgressRef.current = false;
        setIsControlledUpdate(false);
      }, 500);
    });

    // Improved pause event handling
    socket.on('videoPause', (data) => {
      console.log('Received pause command at time:', data.time);
      syncInProgressRef.current = true;
      setIsControlledUpdate(true);
      
      // Seek to the exact time then pause
      playerRef.current.seekTo(data.time, true);
      playerRef.current.pauseVideo();
      
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

    // Set up sync interval based on host status
    const syncInterval = setInterval(() => {
      // Only the host regularly broadcasts their state
      if (isHost && playerReady && playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        const playerState = playerRef.current.getPlayerState();
        
        // YT.PlayerState.PLAYING = 1
        if (playerState === 1) {
          console.log('Host syncing play state at time:', currentTime);
          socket.emit('videoPlay', currentTime);
          lastSyncTimeRef.current = Date.now();
        } 
        // Only emit pause state once to avoid spamming
        else if (playerState === 2 && (Date.now() - lastSyncTimeRef.current > 5000)) {
          console.log('Host syncing pause state at time:', currentTime);
          socket.emit('videoPause', currentTime);
          lastSyncTimeRef.current = Date.now();
        }
      }
    }, isHost ? 5000 : 10000); // Host syncs more frequently than clients

    // Request initial sync
    socket.emit('requestSync');

    return () => {
      socket.off('initState');
      socket.off('syncState');
      socket.off('syncFromHost');
      socket.off('temporarySeek');
      socket.off('becomeHost');
      socket.off('videoPlay');
      socket.off('videoPause');
      socket.off('videoSeek');
      socket.off('changeVideo');
      clearInterval(syncInterval);
    };
  }, [socket, playerReady, videoId, isHost]);

  function onPlayerReady(event) {
    console.log('Player ready');
    setPlayerReady(true);
    
    // Request sync when player is ready
    if (socket) {
      socket.emit('requestSync');
    }
  }

  function onPlayerStateChange(event) {
    if (!playerReady || !socket) return;
    
    // Don't emit events if this update was caused by another user or sync
    if (isControlledUpdate || syncInProgressRef.current) {
      return;
    }
    
    const currentTime = playerRef.current.getCurrentTime();
    lastSyncTimeRef.current = Date.now();
    
    // YT.PlayerState enum values: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
    if (event.data === 1) { // Playing
      console.log('Emitting play event at time:', currentTime);
      socket.emit('videoPlay', currentTime);
    } else if (event.data === 2) { // Paused
      console.log('Emitting pause event at time:', currentTime);
      socket.emit('videoPause', currentTime);
    } else if (event.data === 0) { // Ended
      console.log('Video ended, requesting next in queue');
      socket.emit('playNextInQueue');
    }
  }

  return (
    <div className={styles.playerContainer}>
      <div id="youtube-player" className={styles.player}></div>
      <div className={styles.playerOverlay}>
        <div className={styles.syncIndicator}>
          {syncInProgressRef.current ? '🔄 Syncing...' : isHost ? '👑 Host' : '✓ In sync'}
        </div>
      </div>
    </div>
  );
};

export default Player;