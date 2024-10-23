// src/Chatbot.js
import React, { useState } from 'react';
import { useSpeechRecognition } from 'react-speech-recognition';
import openai from './openai';

const Chatbot = () => {
  const [conversation, setConversation] = useState([]);
  const [listening, setListening] = useState(false);

  const {
    transcript,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  if (!browserSupportsSpeechRecognition) {
    return <span>Your browser doesn't support speech recognition.</span>;
  }

  const startListening = () => {
    setListening(true);
    resetTranscript();
    window.SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new window.SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();

    recognition.onresult = async (event) => {
      const userInput = event.results[0][0].transcript;
      setConversation((prev) => [...prev, { sender: 'user', text: userInput }]);
      await getBotResponse(userInput);
      setListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      setListening(false);
    };
  };

  const getBotResponse = async (userInput) => {
    try {
      const response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: userInput,
        max_tokens: 150,
      });

      const botResponse = response.data.choices[0].text.trim();
      setConversation((prev) => [...prev, { sender: 'bot', text: botResponse }]);
      speak(botResponse);
    } catch (error) {
      console.error('Error fetching response from OpenAI:', error);
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
  };

  return (
    <div>
      <h1>Speech-to-Speech Chatbot</h1>
      <button onClick={startListening} disabled={listening}>
        {listening ? 'Listening...' : 'Speak'}
      </button>
      <div>
        {conversation.map((entry, index) => (
          <p key={index}>
            <strong>{entry.sender}:</strong> {entry.text}
          </p>
        ))}
      </div>
    </div>
  );
};

export default Chatbot;
