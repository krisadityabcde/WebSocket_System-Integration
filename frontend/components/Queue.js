import { useState } from 'react';
import styles from '../styles/Queue.module.css';

const VideoQueue = ({ queue = [], onAddToQueue, currentVideo }) => {
  const [videoInput, setVideoInput] = useState('');
  const [titleInput, setTitleInput] = useState('');

  const handleAddToQueue = () => {
    if (!videoInput) return;
    
    const videoId = extractVideoId(videoInput);
    if (videoId) {
      onAddToQueue({
        id: videoId,
        title: titleInput || `Video ${videoId}`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      });
      setVideoInput('');
      setTitleInput('');
    } else {
      alert('Invalid YouTube URL or ID');
    }
  };

  function extractVideoId(input) {
    // Check if it's already an ID (assuming YouTube IDs are 11 characters)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input;
    }
    
    // Try to extract from URL
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = input.match(regex);
    
    return match ? match[1] : null;
  }

  return (
    <div className={styles.queueContainer}>
      <h2 className={styles.queueHeader}>Up Next</h2>
      
      <div className={styles.addToQueue}>
        <input
          type="text"
          value={videoInput}
          onChange={(e) => setVideoInput(e.target.value)}
          placeholder="Enter YouTube URL or ID"
          className={styles.input}
        />
        <input
          type="text"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          placeholder="Video title (optional)"
          className={styles.input}
        />
        <button 
          onClick={handleAddToQueue}
          className={styles.addButton}
        >
          Add to Queue
        </button>
      </div>
      
      <div className={styles.queueList}>
        {queue.length === 0 ? (
          <p className={styles.emptyQueue}>Queue is empty</p>
        ) : (
          <div className={styles.videoList}>
            {queue.map((video, index) => (
              <div key={index} className={styles.queueItem}>
                <div className={styles.thumbnailContainer}>
                  <img 
                    src={video.thumbnail || `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`} 
                    alt={video.title}
                    className={styles.thumbnail}
                  />
                  <span className={styles.queuePosition}>{index + 1}</span>
                </div>
                <div className={styles.videoInfo}>
                  <h3 className={styles.videoTitle}>{video.title || `Video ${video.id}`}</h3>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className={styles.recommendedHeader}>
          <h3>Recommended</h3>
        </div>
        
        <div className={styles.videoList}>
          <div className={styles.queueItem}>
            <div className={styles.thumbnailContainer}>
              <img 
                src="https://img.youtube.com/vi/ZZ5LpwO-An4/mqdefault.jpg" 
                alt="He-Man Sings"
                className={styles.thumbnail}
              />
            </div>
            <div className={styles.videoInfo}>
              <h3 className={styles.videoTitle}>HEYYEYAAEYAAAEYAEYAA</h3>
            </div>
          </div>
          <div className={styles.queueItem}>
            <div className={styles.thumbnailContainer}>
              <img 
                src="https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg" 
                alt="Gangnam Style"
                className={styles.thumbnail}
              />
            </div>
            <div className={styles.videoInfo}>
              <h3 className={styles.videoTitle}>PSY - GANGNAM STYLE</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoQueue;