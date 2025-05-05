import React, { useState, useRef, useEffect } from 'react';
import { 
  TextField, 
  Button, 
  Box, 
  Paper,
  Typography,
  IconButton,
  Badge,
  Avatar,
  Container,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import { Mic, Send, Upload } from '@mui/icons-material';
import axios from 'axios';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Typewriter effect for welcome message
  useEffect(() => {
    const text = "Hi! how can i assist you !!";
    let i = 0;
    const typing = setInterval(() => {
      if (i < text.length) {
        setWelcomeMessage(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(typing);
        setTimeout(() => setShowWelcome(false), 5000);
      }
    }, 100);

    return () => clearInterval(typing);
  }, []);

  // Speech recognition setup
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    startListening,
    stopListening
  } = useSpeechRecognition();

  // Update input with speech transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Auto-scroll to new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    const userMessage = { text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    try {
      const response = await axios.post(
        'http://localhost:5000/api/chat', 
        JSON.stringify(input),
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      const botMessage = { 
        text: response.data.response || response.data.message, 
        sender: 'bot' 
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error.response?.data?.message || 
                         error.response?.data?.error || 
                         "Error getting response";
      setMessages(prev => [...prev, { 
        text: errorMessage, 
        sender: 'error' 
      }]);
      showSnackbar(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showSnackbar(`File too large (max ${MAX_SIZE/1024/1024}MB allowed)`, 'error');
      return;
    }

    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
    if (!validTypes.includes(file.type)) {
      showSnackbar('Unsupported audio format', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setIsLoading(true);
      setUploadProgress(0);
      
      const response = await axios.post(
        'http://localhost:5000/api/transcribe', 
        formData,
        { 
          headers: { 
            'Content-Type': 'multipart/form-data',
          },
          withCredentials: true,
          timeout: 30000,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        }
      );

      const transcription = response.data?.text || 
                          response.data?.transcription || 
                          response.data?.result;
      
      if (!transcription) {
        throw new Error('No transcription returned from server');
      }

      setInput(transcription);
      showSnackbar('Audio successfully transcribed', 'success');
      setMessages(prev => [...prev, {
        text: `Audio transcription: ${transcription}`,
        sender: 'bot'
      }]);
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage = error.response?.data?.error || 
                         error.message || 
                         "Audio processing failed";
      showSnackbar(errorMessage, 'error');
      setMessages(prev => [...prev, {
        text: errorMessage,
        sender: 'error'
      }]);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleListening = () => {
    if (!listening) {
      resetTranscript();
      startListening({ continuous: true });
      showSnackbar('Listening... Speak now', 'info');
    } else {
      stopListening();
      showSnackbar('Stopped listening', 'info');
    }
  };

  if (!browserSupportsSpeechRecognition) {
    return (
      <Container>
        <Typography color="error" sx={{ mt: 2 }}>
          Your browser doesn't support speech recognition. Please use Chrome or Edge.
        </Typography>
      </Container>
    );
  }

  return (
    <Box className="chat-container">
      {/* Chat messages */}
      <Box className="messages-container">
        {/* Welcome message */}
        {showWelcome && (
          <Box className="welcome-message-container">
            <Typography variant="h4" className="welcome-message">
              {welcomeMessage}
              <span className="cursor">|</span>
            </Typography>
          </Box>
        )}
        
        <Container maxWidth="lg" disableGutters>
          {messages.map((msg, index) => (
            <Box key={index} className={`message-container ${msg.sender}`}>
              <Paper className={`message-bubble ${msg.sender}`}>
                <Box className="message-content">
                  <Avatar className={`message-avatar ${msg.sender}`}>
                    {msg.sender === 'user' ? 'U' : 'AI'}
                  </Avatar>
                  <Typography>{msg.text}</Typography>
                </Box>
              </Paper>
            </Box>
          ))}
          {isLoading && uploadProgress > 0 && (
            <Box className="upload-progress">
              <CircularProgress 
                variant="determinate" 
                value={uploadProgress} 
                size={24}
              />
              <Typography variant="body2">
                Uploading: {uploadProgress}%
              </Typography>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Container>
      </Box>

      {/* Input area */}
      <Box className="input-container">
        <Container maxWidth="lg" disableGutters>
          <Box className="input-inner-container">
            <TextField
              fullWidth
              className="text-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or speak your message..."
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
              multiline
              maxRows={4}
              disabled={isLoading}
            />

            <Badge 
              color="error" 
              variant="dot" 
              invisible={!listening}
            >
              <IconButton 
                color={listening ? 'error' : 'default'} 
                onClick={toggleListening}
                disabled={isLoading || !browserSupportsSpeechRecognition}
              >
                <Mic />
              </IconButton>
            </Badge>

            <input
              accept=".wav,.mp3,.ogg,.m4a"
              className="file-input"
              id="audio-upload"
              type="file"
              onChange={handleFileUpload}
              disabled={isLoading}
              ref={fileInputRef}
            />
            <label htmlFor="audio-upload">
              <IconButton component="span" disabled={isLoading}>
                <Upload />
              </IconButton>
            </label>

            <Button 
              variant="contained" 
              className="send-button"
              onClick={handleSendMessage}
              endIcon={isLoading && uploadProgress === 0 ? 
                <CircularProgress size={24} className="loading-spinner" /> : 
                <Send />}
              disabled={!input.trim() || isLoading}
            >
              {isLoading && uploadProgress === 0 ? '' : 'Send'}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({...snackbar, open: false})}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({...snackbar, open: false})}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Chat;
