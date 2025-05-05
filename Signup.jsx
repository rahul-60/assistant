import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  TextField, 
  Button, 
  Container, 
  Typography, 
  Paper,
  Avatar,
  Box
} from '@mui/material';
import axios from 'axios';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import './Signup.css'; // Import the CSS file

const Signup = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:5000/api/register', {
        username,
        password
      });
      
      if (response.status === 201) {
        window.location.href = '/';
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="signup-page-wrapper">
      <Container component="main" maxWidth="xs" className="signup-container">
        <Paper elevation={3} className="signup-paper">
          <Avatar className="signup-avatar">
            <LockOutlinedIcon fontSize="medium" />
          </Avatar>
          <Typography component="h1" variant="h5" className="signup-title">
            Sign Up
          </Typography>
          
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            {error && <Typography className="signup-error">{error}</Typography>}
            
            <TextField
              margin="normal"
              required
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              className="signup-button"
            >
              Register
            </Button>
            <Typography align="center" sx={{ mt: 2 }}>
              Already have an account? <Link to="/" className="signup-link">Sign In</Link>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </div>
  );
};

export default Signup;
