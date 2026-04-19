from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.ai_service import AIServiceError, build_answer_prompt, client
from routes.upload import get_document_store

chat_bp = Blueprint('chat', __name__)


@chat_bp.post('/chat')
def chat():
    data = request.get_json(silent=True) or {}
    question = (data.get('question') or '').strip()
    filename = (data.get('filename') or '').strip()
    if not question:
        return jsonify({'success': False, 'error': 'Please provide a question.'}), 400

    store = get_document_store()
    if not store.documents:
        return jsonify({'success': False, 'error': 'Upload at least one note or PDF first.'}), 400

    chunks, citations = store.retrieve(question, filename=filename, top_k=6)
    prompt = build_answer_prompt(
        question=question,
        retrieved_chunks=[{'filename': c.filename, 'index': c.index, 'content': c.content} for c in chunks],
        chat_history=store.get_chat_window(limit=8),
    )

    try:
        answer = client.generate(prompt, temperature=0.35, max_output_tokens=1600)
        store.append_chat('user', question)
        store.append_chat('assistant', answer)
        return jsonify({
            'success': True,
            'answer': answer,
            'citations': citations,
            'used_chunks': len(chunks),
        })
    except AIServiceError as exc:
        return jsonify({'success': False, 'error': str(exc)}), 502
    except Exception as exc:
        return jsonify({'success': False, 'error': f'Unexpected AI error: {exc}'}), 500


@chat_bp.post('/chat/clear')
def clear_chat():
    get_document_store().clear_chat()
    return jsonify({'success': True, 'message': 'Conversation cleared.'})
