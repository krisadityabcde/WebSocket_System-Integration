export default async function handler(req, res) {
  const { q, maxResults = 5 } = req.query;
  const API_KEY = process.env.YOUTUBE_API_KEY;
  
  if (!q) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  
  if (!API_KEY) {
    console.error('YouTube API key is missing');
    return res.status(500).json({ error: 'YouTube API key is not configured' });
  }
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${encodeURIComponent(q)}&type=video&key=${API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.error) {
      console.error('YouTube API returned an error:', data.error);
      throw new Error(data.error.message);
    }
    
    // Format the results
    const formattedResults = data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle
    }));
    
    res.status(200).json({ items: formattedResults });
  } catch (error) {
    console.error('YouTube API error:', error);
    res.status(500).json({ error: 'Error fetching videos from YouTube' });
  }
}