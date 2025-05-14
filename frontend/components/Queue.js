import { useState, useRef, useEffect } from 'react';
import styles from '../styles/Queue.module.css';
import { fetchYoutubeVideoTitle } from '../lib/youtubeApi';
import { searchYoutubeVideos } from '../lib/youtubeSearchApi';
import { FaTimes, FaSearch } from 'react-icons/fa';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const VideoQueue = ({ queue = [], onAddToQueue, onRemoveFromQueue, onReorderQueue, currentVideo, isAdmin }) => {
  const [videoInput, setVideoInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchResultsRef = useRef(null);

  // Handle input change and trigger search
  const handleInputChange = (e) => {
    const value = e.target.value;
    setVideoInput(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (value.length > 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(() => {
        searchVideos(value);
      }, 500);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };
  
  // Search for videos using the YouTube API
  const searchVideos = async (query) => {
    if (!query) return;
    
    try {
      const results = await searchYoutubeVideos(query);
      setSearchResults(results);
      setShowResults(results.length > 0);
      setIsSearching(false);
    } catch (error) {
      console.error('Error searching videos:', error);
      setIsSearching(false);
    }
  };
  
  // Handle adding a video from search results
  const handleAddFromSearch = (video) => {
    onAddToQueue({
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail
    });
    setVideoInput('');
    setTitleInput('');
    setSearchResults([]);
    setShowResults(false);
  };
  
  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target)) {
        setShowResults(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      
      {/* Only show add to queue for admin users */}
      {isAdmin && (
        <div className={styles.addToQueue}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              value={videoInput}
              onChange={handleInputChange}
              placeholder="Search YouTube or paste video URL"
              className={styles.searchInput}
            />
            <FaSearch className={styles.searchIcon} />
            
            {/* Search results dropdown */}
            {showResults && (
              <div className={styles.searchResults} ref={searchResultsRef}>
                {searchResults.map((video) => (
                  <div 
                    key={video.id} 
                    className={styles.searchResultItem}
                    onClick={() => handleAddFromSearch(video)}
                  >
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className={styles.searchResultThumbnail} 
                    />
                    <div className={styles.searchResultInfo}>
                      <div className={styles.searchResultTitle}>{video.title}</div>
                      <div className={styles.searchResultChannel}>{video.channelTitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {isSearching && (
              <div className={styles.searchingIndicator}>Searching...</div>
            )}
          </div>
          
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Custom title (optional)"
            className={styles.titleInput}
          />
          
          <button 
            onClick={handleAddToQueue} 
            disabled={isLoading}
            className={styles.addButton}
          >
            {isLoading ? 'Adding...' : 'Add to Queue'}
          </button>
        </div>
      )}
      
      <div className={styles.queueList}>
        {queue.length === 0 ? (
          <p className={styles.emptyQueue}>Queue is empty</p>
        ) : (
          <DragDropContext onDragEnd={isAdmin ? handleDragEnd : () => {}}>
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
                      isDragDisabled={!isAdmin}
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
                            {video.addedBy && <span className={styles.addedBy}>Added by: {video.addedBy}</span>}
                          </div>
                          {isAdmin && (
                            <button 
                              className={styles.removeButton}
                              onClick={() => onRemoveFromQueue(index)}
                              aria-label="Remove video"
                            >
                              <FaTimes />
                            </button>
                          )}
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
      </div>
      
      {!isAdmin && queue.length > 0 && (
        <p className={styles.adminNote}>Only the admin can modify the queue</p>
      )}
    </div>
  );
};

export default VideoQueue;