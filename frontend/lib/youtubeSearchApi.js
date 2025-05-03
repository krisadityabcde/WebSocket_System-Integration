export const searchYoutubeVideos = async (query, maxResults = 10) => {
  try {
    const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
    
    if (!response.ok) {
      throw new Error('Failed to search YouTube videos');
    }
    
    const data = await response.json();
    return data.items;
  } catch (error) {
    console.error('Error searching YouTube videos:', error);
    return [];
  }
};