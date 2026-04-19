from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.ai_service import AIServiceError, build_quiz_prompt, client
from routes.upload import get_document_store

quiz_bp = Blueprint('quiz', __name__)


@quiz_bp.post('/quiz')
def quiz():
    data = request.get_json(silent=True) or {}
    filename = (data.get('filename') or '').strip()
    num_questions = max(1, min(int(data.get('num_questions', 5)), 10))
    store = get_document_store()

    if not store.documents:
        return jsonify({'success': False, 'error': 'Upload at least one note or PDF first.'}), 400

    docs = [store.documents[filename]] if filename and filename in store.documents else list(store.documents.values())
    context = '\n\n---\n\n'.join(d.text[:7000] for d in docs)

    try:
        quiz_content = client.generate(build_quiz_prompt(context, num_questions), temperature=0.45, max_output_tokens=1800)
        return jsonify({'success': True, 'quiz': quiz_content, 'num_questions': num_questions})
    except AIServiceError as exc:
        return jsonify({'success': False, 'error': str(exc)}), 502
