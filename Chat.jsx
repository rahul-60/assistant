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
import { Mic, Send, Upload, Close } from '@mui/icons-material';
import axios from 'axios';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
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
    console.log("input:",input)
    console.log("message",messages)
    
    try {
      const response = await axios.post(
        'http://localhost:5000/api/chat', 
        JSON.stringify(input),
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            // Add if using JWT:
            // 'Authorization': `Bearer ${localStorage.getItem('token')}`
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
    
    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      showSnackbar(`File too large (max ${MAX_SIZE/1024/1024}MB allowed)`, 'error');
      return;
    }

    // Validate file type
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
            // Add if using JWT:
            // 'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          withCredentials: true,
          timeout: 30000, // 30 second timeout
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        }
      );

      // Handle different response formats
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
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      p: 0,
      m: 0
    }}>
      {/* Chat messages */}
      <Box sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
        bgcolor: '#f5f5f5'
      }}>
        <Container maxWidth="lg" disableGutters>
          {messages.map((msg, index) => (
            <Box key={index} sx={{ 
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              mb: 2
            }}>
              <Paper sx={{
                p: 2,
                maxWidth: '70%',
                bgcolor: msg.sender === 'user' ? 'primary.main' : 'background.paper',
                color: msg.sender === 'user' ? 'primary.contrastText' : 'text.primary',
                borderRadius: 4,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ 
                    width: 32, 
                    height: 32,
                    bgcolor: msg.sender === 'user' ? 'primary.dark' : 'secondary.main'
                  }}>
                    {msg.sender === 'user' ? 'U' : 'AI'}
                  </Avatar>
                  <Typography>{msg.text}</Typography>
                </Box>
              </Paper>
            </Box>
          ))}
          {isLoading && uploadProgress > 0 && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              my: 2
            }}>
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
      <Box sx={{ 
        p: 2,
        bgcolor: 'background.paper',
        borderTop: '1px solid #e0e0e0'
      }}>
        <Container maxWidth="lg" disableGutters>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              fullWidth
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or speak your message..."
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
              multiline
              maxRows={4}
              sx={{ bgcolor: 'background.paper' }}
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
                aria-label={listening ? 'Stop listening' : 'Start listening'}
              >
                <Mic />
              </IconButton>
            </Badge>

            <input
              accept=".wav,.mp3,.ogg,.m4a"
              style={{ display: 'none' }}
              id="audio-upload"
              type="file"
              onChange={handleFileUpload}
              disabled={isLoading}
              ref={fileInputRef}
            />
            <label htmlFor="audio-upload">
              <IconButton 
                component="span" 
                disabled={isLoading}
                aria-label="Upload audio file"
              >
                <Upload />
              </IconButton>
            </label>

            <Button 
              variant="contained" 
              onClick={handleSendMessage}
              endIcon={isLoading && uploadProgress === 0 ? 
                <CircularProgress size={24} color="inherit" /> : 
                <Send />}
              disabled={!input.trim() || isLoading}
              sx={{ height: '56px', minWidth: '100px' }}
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
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Chat;