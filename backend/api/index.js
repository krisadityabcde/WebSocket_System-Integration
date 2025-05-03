module.exports = (req, res) => {
  res.json({
    status: 'YouTube Sync Party API is running',
    environment: process.env.NODE_ENV || 'development'
  });
};
