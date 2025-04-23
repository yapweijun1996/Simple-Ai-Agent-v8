/**
 * Simple Express server for the AI Chat Agent
 * Serves the web app on localhost:3005
 */

const express = require('express');
const path = require('path');
const app = express();
const PORT = 3005;

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '/')));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`
=================================================
  AI Chat Agent server running!
  
  → Access the app at: http://localhost:${PORT}
  → Press Ctrl+C to stop the server
=================================================
  `);
}); 