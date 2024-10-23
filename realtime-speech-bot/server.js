const WebSocket = require('ws');
const express = require('express');
const expressWs = require('express-ws'); // Import express-ws
const dotenv = require('dotenv');

dotenv.config();

const app = express();
expressWs(app); // Initialize WebSocket support in Express

const PORT = process.env.PORT || 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-realtime-preview-2024-10-01';

// Handle WebSocket connections
app.ws('/realtime', (wsClient) => {
  const wsOpenAI = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${MODEL}`,
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    }
  );

  wsOpenAI.on('open', () => {
    console.log('Connected to OpenAI WebSocket');
  });

  wsOpenAI.on('message', (data) => {
    wsClient.send(data);
  });

  wsOpenAI.on('error', (error) => {
    console.error('OpenAI WebSocket error:', error);
  });

  wsOpenAI.on('close', (code, reason) => {
    console.log('OpenAI WebSocket closed with code:', code);
    console.log('Reason for closure:', reason ? reason.toString() : 'No reason provided');
  });
  

  // Forward messages from the client to OpenAI WebSocket
  wsClient.on('message', (message) => {
    wsOpenAI.send(message);
  });

  wsClient.on('close', () => {
    console.log('Client WebSocket closed');
    wsOpenAI.close();
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
