import React, { useState, useEffect, useRef } from 'react';

// WebSocket URL for your local proxy (no API key in the URL)
const WS_URL = `ws://localhost:8080/realtime`;

const RealTimeSpeechBot = () => {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const ws = useRef(null);

  // Function to convert Float32Array to PCM16
  const floatTo16BitPCM = (float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  // Function to encode audio in base64
  const base64EncodeAudio = (float32Array) => {
    const arrayBuffer = floatTo16BitPCM(float32Array);
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Initialize WebSocket connection
  useEffect(() => {
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log('WebSocket connection established.');
    };

    ws.current.onmessage = (event) => {
      // Check if the message is a Blob
      if (event.data instanceof Blob) {
        // Convert the Blob to text
        event.data.text().then((text) => {
          try {
            const data = JSON.parse(text);
            if (data.item && data.item.content && data.item.content[0].type === 'text') {
              setMessage(data.item.content[0].text);
            }
          } catch (error) {
            console.error('Error parsing message as JSON:', error);
          }
        });
      } else {
        // Handle text messages
        try {
          const data = JSON.parse(event.data);
          if (data.item && data.item.content && data.item.content[0].type === 'text') {
            setMessage(data.item.content[0].text);
          }
        } catch (error) {
          console.error('Error parsing message as JSON:', error);
        }
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error); // Log the full error object
      setError('WebSocket error: ' + (error.message || 'Unknown error'));
    };
    

    ws.current.onclose = () => {
      console.log('WebSocket connection closed.');
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  // Function to send audio data as base64-encoded PCM16
  const sendAudio = async (audioBuffer) => {
    const channelData = audioBuffer.getChannelData(0);
    const base64Audio = base64EncodeAudio(channelData);
    ws.current.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio,
      })
    );

    // Commit audio buffer after appending
    ws.current.send(
      JSON.stringify({
        type: 'input_audio_buffer.commit',
      })
    );
  };

  // Function to capture and send audio
  const captureAudio = async () => {
    if (navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        let audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const audioArrayBuffer = await audioBlob.arrayBuffer();
          const audioContext = new AudioContext();
          const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);

          // Send audio to WebSocket
          sendAudio(audioBuffer);
        };

        mediaRecorder.start();

        // Stop recording after 5 seconds (you can adjust this duration)
        setTimeout(() => {
          mediaRecorder.stop();
        }, 5000);
      } catch (err) {
        console.error('Error capturing audio:', err);
        setError('Error capturing audio');
      }
    }
  };

  return (
    <div>
      <h1>Real-Time Speech Bot</h1>
      {error ? <p>Error: {error}</p> : <p>{message}</p>}
      <button onClick={captureAudio}>Speak Now</button>
    </div>
  );
};

export default RealTimeSpeechBot;
