import { useState } from 'react';
import styles from '../styles/Queue.module.css';
import { fetchYoutubeVideoTitle } from '../lib/youtubeApi';
import { FaTimes } from 'react-icons/fa';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// Add onReorderQueue to props destructuring
const VideoQueue = ({ queue = [], onAddToQueue, onRemoveFromQueue, onReorderQueue, currentVideo }) => {
  const [videoInput, setVideoInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToQueue = async () => {
    if (!videoInput) return;
    
    const videoId = extractVideoId(videoInput);
    if (videoId) {
      setIsLoading(true);
      
      // Use user-provided title or fetch from YouTube
      let title = titleInput;
      if (!title) {
        title = await fetchYoutubeVideoTitle(videoId);
      }
      
      onAddToQueue({
        id: videoId,
        title: title,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      });
      
      setVideoInput('');
      setTitleInput('');
      setIsLoading(false);
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
  
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const oldIndex = result.source.index;
    const newIndex = result.destination.index;
    
    if (oldIndex === newIndex) return;
    
    // Emit event to reorder queue
    onReorderQueue(oldIndex, newIndex);
  };

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
          disabled={isLoading}
        >
          {isLoading ? 'Adding...' : 'Add to Queue'}
        </button>
      </div>
      
      <div className={styles.queueList}>
        {queue.length === 0 ? (
          <p className={styles.emptyQueue}>Queue is empty</p>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="videoQueue">
              {(provided) => (
                <div 
                  className={styles.videoList}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {queue.map((video, index) => (
                    <Draggable 
                      key={`${video.id}-${index}`}
                      draggableId={`${video.id}-${index}`}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`${styles.queueItem} ${snapshot.isDragging ? styles.dragging : ''}`}
                        >
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
                          <button 
                            className={styles.removeButton}
                            onClick={() => onRemoveFromQueue(index)}
                            aria-label="Remove video"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
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