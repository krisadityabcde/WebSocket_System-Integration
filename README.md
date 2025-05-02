# YouTube Watch Together

A Next.js application that allows users to watch YouTube videos together with synchronized playback, real-time chat, and a shared video queue.

## Features

- **Synchronized Video Playback**: When one user plays, pauses, or seeks in a video, all connected users experience the same action
- **Real-Time Chat**: Chat with other viewers while watching videos
- **Video Queue**: Add videos to a shared queue for continuous playback
- **Modern React UI**: Built with Next.js for a responsive and fast user experience

## Technologies Used

- Frontend: Next.js, React, YouTube IFrame Player API
- Backend: Next.js API Routes
- Real-time Communication: Socket.io

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Share the URL with friends to join the same party
2. Enter a YouTube video URL or ID and click "Change Video" to start watching
3. Use the chat box to communicate with other viewers
4. Add videos to the queue for continuous playback
5. Click "Play Next" to skip to the next video in the queue

## Building for Production

```
npm run build
npm start
```

## License

MIT
