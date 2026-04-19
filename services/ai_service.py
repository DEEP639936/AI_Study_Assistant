from __future__ import annotations

import json
import time
from typing import List, Optional

import requests

from utils.config import settings

SYSTEM_PROMPT = """You are StudyAI, a professional AI study tutor.
Your job is to help students understand uploaded notes deeply.
Rules:
1. Base answers primarily on the provided context.
2. If the context is incomplete, say what is missing instead of inventing facts.
3. Be clear, structured, concise, and supportive.
4. Use markdown headings, bullets, and short examples when useful.
5. End answers with a brief "Next Step" or follow-up suggestion when helpful.
"""


class AIServiceError(RuntimeError):
    pass


class GeminiService:
    def __init__(self) -> None:
        self.api_key = settings.get('GEMINI_API_KEY')
        self.groq_key = settings.get('GROQ_API_KEY')
        self.openai_key = settings.get('OPENAI_API_KEY')

    def generate(self, user_prompt: str, temperature: float = 0.4, max_output_tokens: int = 1800) -> str:
        if self.api_key:
            return self._generate_gemini(user_prompt, temperature, max_output_tokens)
        if self.groq_key:
            return self._generate_groq(user_prompt, temperature, max_output_tokens)
        if self.openai_key:
            return self._generate_openai(user_prompt, temperature, max_output_tokens)
        raise AIServiceError('No API key found. Add GEMINI_API_KEY to your .env file.')

    def _generate_gemini(self, user_prompt: str, temperature: float, max_output_tokens: int) -> str:
        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(
            model_name=settings.get('GEMINI_MODEL', 'gemini-1.5-flash'),
            system_instruction=SYSTEM_PROMPT,
        )
        config = {
            'temperature': temperature,
            'max_output_tokens': max_output_tokens,
            'top_p': 0.9,
            'candidate_count': 1,
        }

        last_error = None
        for attempt in range(3):
            try:
                response = model.generate_content(user_prompt, generation_config=config)
                text = getattr(response, 'text', '') or _extract_text_from_gemini_response(response)
                if not text.strip():
                    raise AIServiceError('The model returned an empty response.')
                return text.strip()
            except Exception as exc:
                last_error = exc
                time.sleep(1.2 * (attempt + 1))
        raise AIServiceError(f'Gemini request failed after retries: {last_error}')

    def _generate_groq(self, user_prompt: str, temperature: float, max_output_tokens: int) -> str:
        return _chat_completion(
            url='https://api.groq.com/openai/v1/chat/completions',
            api_key=self.groq_key,
            model=settings.get('GROQ_MODEL', 'llama3-70b-8192'),
            user_prompt=user_prompt,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )

    def _generate_openai(self, user_prompt: str, temperature: float, max_output_tokens: int) -> str:
        return _chat_completion(
            url='https://api.openai.com/v1/chat/completions',
            api_key=self.openai_key,
            model=settings.get('OPENAI_MODEL', 'gpt-4o-mini'),
            user_prompt=user_prompt,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )


def _chat_completion(url: str, api_key: str, model: str, user_prompt: str, temperature: float, max_output_tokens: int) -> str:
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': user_prompt},
        ],
        'temperature': temperature,
        'max_tokens': max_output_tokens,
    }
    last_error = None
    for attempt in range(3):
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=90)
            if response.status_code != 200:
                raise AIServiceError(f'LLM API error {response.status_code}: {response.text[:300]}')
            data = response.json()
            return data['choices'][0]['message']['content'].strip()
        except Exception as exc:
            last_error = exc
            time.sleep(1.2 * (attempt + 1))
    raise AIServiceError(f'LLM request failed after retries: {last_error}')


def _extract_text_from_gemini_response(response) -> str:
    parts = []
    candidates = getattr(response, 'candidates', None) or []
    for candidate in candidates:
        content = getattr(candidate, 'content', None)
        if not content:
            continue
        for part in getattr(content, 'parts', []):
            text = getattr(part, 'text', None)
            if text:
                parts.append(text)
    return '\n'.join(parts).strip()


client = GeminiService()


def build_answer_prompt(question: str, retrieved_chunks: List[dict], chat_history: Optional[List[dict]] = None) -> str:
    history_block = ''
    if chat_history:
        history_lines = []
        for turn in chat_history[-6:]:
            role = 'Student' if turn['role'] == 'user' else 'Assistant'
            history_lines.append(f'{role}: {turn["content"]}')
        history_block = '\n'.join(history_lines)

    context_blocks = []
    for i, chunk in enumerate(retrieved_chunks, start=1):
        context_blocks.append(f'[Source {i} | {chunk["filename"]} | chunk {chunk["index"] + 1}]\n{chunk["content"]}')

    context_text = '\n\n'.join(context_blocks) if context_blocks else 'No matching study context was found.'
    return f"""Answer the student question using the retrieved study materials.

Conversation memory:
{history_block or 'No earlier chat context.'}

Retrieved notes:
{context_text}

Student question:
{question}

Return a markdown answer with this shape:
## Answer
...

## Key Points
- ...

## Based on Your Notes
- Mention the most relevant source chunks briefly

If the notes are insufficient, clearly say that and mention what is missing.
"""


def build_summary_prompt(context: str) -> str:
    return f"""Create a high-quality study summary from these notes.
Use markdown and include:
# Overview
# Core Concepts
# Important Details
# Exam-Focused Key Points
# Quick Revision Summary

Notes:
{context}
"""


# FIX: Strong strict prompt to generate exact number of MCQs
def build_quiz_prompt(context: str, num_questions: int) -> str:
    return f"""
You are an expert AI Study Assistant.

Your task is to generate EXACTLY {num_questions} high-quality multiple-choice questions based ONLY on the provided study material.

STRICT RULES (MUST FOLLOW):
1. Generate exactly {num_questions} questions. Not fewer. Not more.
2. Each question must be complete and meaningful.
3. Each question must have exactly 4 options:
   A)
   B)
   C)
   D)
4. Each question MUST include:
   Correct Answer:
   Explanation:
5. Do NOT stop early.
6. Do NOT generate incomplete questions.
7. Do NOT write anything outside the quiz.
8. Avoid repeating questions.

FORMAT (STRICTLY FOLLOW):

Q1. Question text
A) Option A
B) Option B
C) Option C
D) Option D
Correct Answer: A
Explanation: Short explanation

Q2. Question text
A) Option A
B) Option B
C) Option C
D) Option D
Correct Answer: B
Explanation: Short explanation

Continue until Q{num_questions}.

Study Material:
{context}
"""

def build_flashcards_prompt(context: str, num_cards: int) -> str:
    return f"""Generate exactly {num_cards} study flashcards from the notes.
Return markdown in this repeated format:
### Card 1
**Front:** ...
**Back:** ...

Notes:
{context}
"""


def build_key_points_prompt(context: str) -> str:
    return f"""Extract the most important key points from the notes.
Return markdown with:
# Must Remember
# Definitions
# Short Examples

Notes:
{context}
"""


