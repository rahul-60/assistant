from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_cors import cross_origin
import requests
from werkzeug.security import generate_password_hash, check_password_hash
import pymysql
import logging
import os
from dotenv import load_dotenv
import speech_recognition as sr
from pydub import AudioSegment
import tempfile
import io
# import google.generativeai as genai
from google import genai


# Load environment variables
load_dotenv()

# MySQL setup
pymysql.install_as_MySQLdb()

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "supports_credentials": True,  # This is crucial
        "expose_headers": ["Content-Type"],
        "max_age": 600
    }
})

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://root:csnr%403911B@localhost/speech_project'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)

# AI API integration
logging.basicConfig(level=logging.DEBUG)
# import google.generativeai as genai

def get_ai_response(message):
    gemini_api_key = os.getenv('GEMINIAI_API_KEY')

    if not gemini_api_key:
        app.logger.error("Gemini API key is missing from environment variables")
        return "AI services: API key missing"

    try:
        client = genai.Client(api_key="AIzaSyCyR8m5bN7hqCMjfH2Bd1a0jlVB_fzaHSI")
        
        # Corrected way to create the model
        # model = genai.GenerativeModel(model_name="gemini-pro")
        
        # Use the correct method
        response = client.models.generate_content(
        model="gemini-2.0-flash", contents=message)
        # print(response)

        if response and hasattr(response, 'text'):
            return response.text
        else:
            app.logger.error("No valid text response from Gemini API")
            return "No valid response from Gemini AI"

    except Exception as e:
        app.logger.error(f"Unexpected error: {type(e).__name__}: {str(e)}")
        return "Unable to process request (see server logs)"

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
def chat():
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
        
    try:
        data = request.get_json()
        print(data)
        if not data:
            return jsonify({'success': False, 'message': 'JSON body required'}), 400
            
        message = data
        print(message)
        if not message:
            return jsonify({'success': False, 'message': 'Message cannot be empty'}), 400
        if len(message) > 1000:
            return jsonify({'success': False, 'message': 'Message too long'}), 400

        ai_response = get_ai_response(message)
        if not ai_response:
            raise ValueError("Empty response from AI service")
            
        return _corsify_actual_response(jsonify({
            'success': True,
            'response': ai_response
        }))

    except Exception as e:
        app.logger.error(f"🔥 Chat endpoint error: {str(e)}")
        return _corsify_actual_response(jsonify({
            'success': False,
            'message': str(e)
        })), 500


# --- CORS Helpers ---
def _build_cors_preflight_response():
    response = jsonify({'success': True})
    return response

def _corsify_actual_response(response):
    return response
# Audio transcription function
def transcribe_audio(audio_file):
    """Convert audio file to text using Google Speech Recognition"""
    try:
        # Verify file is readable
        audio_bytes = audio_file.read()
        if not audio_bytes:
            raise ValueError("Empty audio file")
            
        # Convert to 16kHz mono WAV
        audio_data = io.BytesIO(audio_bytes)
        try:
            audio_segment = AudioSegment.from_file(audio_data)
            wav_data = io.BytesIO()
            audio_segment.export(
                wav_data, 
                format="wav",
                parameters=["-ar", "16000", "-ac", "1"]  # 16kHz mono
            )
            wav_data.seek(0)
        except Exception as e:
            raise ValueError(f"Invalid audio file: {str(e)}")

        # Transcribe using Google Speech Recognition
        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_data) as source:
            audio = recognizer.record(source)
            return recognizer.recognize_google(audio)
            
    except sr.UnknownValueError:
        raise ValueError("Could not understand audio - poor audio quality or empty recording")
    except sr.RequestError as e:
        raise ConnectionError(f"Speech recognition service error: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Processing error: {str(e)}")
# Routes (unchanged)
@app.route('/')
def home():
    return "Server is running! 🚀"

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Username and password required'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'success': False, 'message': 'Username already exists'}), 400

    hashed_password = generate_password_hash(data['password'], method='pbkdf2:sha256')
    new_user = User(username=data['username'], password=hashed_password)
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'User created successfully'}), 201
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Username and password required'}), 400

    user = User.query.filter_by(username=data['username']).first()
    
    if user and check_password_hash(user.password, data['password']):
        return jsonify({'success': True, 'message': 'Login successful'})
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401




@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file uploaded'}), 400
    
    audio_file = request.files['file']
    
    # Validate file
    if not audio_file.filename:
        return jsonify({'success': False, 'error': 'No selected file'}), 400
        
    if not audio_file.filename.lower().endswith(('.wav', '.mp3', '.ogg', '.m4a')):
        return jsonify({'success': False, 'error': 'Unsupported file type'}), 400

    try:
        # Check file size
        audio_file.seek(0, 2)  # Seek to end
        file_size = audio_file.tell()
        audio_file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({
                'success': False,
                'error': f'File too large (max {MAX_FILE_SIZE//(1024*1024)}MB allowed)'
            }), 400

        # Process file
        transcription = transcribe_audio(audio_file)
        return jsonify({
            'success': True,
            'text': transcription
        })
        
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    except ConnectionError as e:
        return jsonify({'success': False, 'error': str(e)}), 503
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)