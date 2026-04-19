<<<<<<< HEAD
# StudyAI Pro

A production-style AI Study Assistant built with Flask, Gemini, and a modern chat-style interface.

## What was improved
- Robust PDF/TXT/MD extraction with better error handling
- In-memory document pipeline with chunking and lightweight retrieval
- Context-aware chat grounded in uploaded study notes
- Structured summary, quiz, key points, and flashcards tools
- Improved Gemini usage with system prompt, retries, and safer response handling
- Multi-file upload, file history, active document scope, clear chat, and markdown rendering
- Modern glassmorphism UI with dark/light mode and mobile responsiveness

## Run locally
```bash
pip install -r requirements.txt
cp .env.example .env
# add GEMINI_API_KEY=your_key_here
python main.py
```

## Recommended env
```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash
SECRET_KEY=replace-me
PORT=5000
```

## Main routes
- `POST /upload`
- `GET /documents`
- `DELETE /documents/<filename>`
- `POST /chat`
- `POST /chat/clear`
- `POST /summarize`
- `POST /quiz`
- `POST /key-points`
- `POST /flashcards`
"# AI_Study_Assitant_By_Deep" 
=======
# AI_Study_Assistant
>>>>>>> f916f05740c441d258c4072ab930b62d40404ea6
