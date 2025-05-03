export async function fetchYoutubeVideoTitle(id) {
  const fallbackTitle = `Video ${id}`;
  
  try {
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('YouTube API key is missing');
      return fallbackTitle;
    }
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${id}&key=${apiKey}&part=snippet`
    );
    const data = await response.json();
    
    if (data.items && data.items[0]) {
      return data.items[0].snippet.title;
    } else {
      return fallbackTitle;
    }
  } catch (error) {
    console.error('Error fetching video title:', error);
    return fallbackTitle;
  }
}