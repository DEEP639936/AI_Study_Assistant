from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.ai_service import AIServiceError, build_flashcards_prompt, build_key_points_prompt, client
from routes.upload import get_document_store

study_tools_bp = Blueprint('study_tools', __name__)


def _collect_context(filename: str = '', max_chars: int = 7000) -> str:
    store = get_document_store()
    docs = [store.documents[filename]] if filename and filename in store.documents else list(store.documents.values())
    return '\n\n---\n\n'.join(d.text[:max_chars] for d in docs)


@study_tools_bp.post('/flashcards')
def flashcards():
    data = request.get_json(silent=True) or {}
    filename = (data.get('filename') or '').strip()
    num_cards = max(3, min(int(data.get('num_cards', 8)), 20))
    store = get_document_store()
    if not store.documents:
        return jsonify({'success': False, 'error': 'Upload at least one note or PDF first.'}), 400
    try:
        result = client.generate(build_flashcards_prompt(_collect_context(filename), num_cards), temperature=0.35, max_output_tokens=1500)
        return jsonify({'success': True, 'flashcards': result, 'num_cards': num_cards})
    except AIServiceError as exc:
        return jsonify({'success': False, 'error': str(exc)}), 502


@study_tools_bp.post('/key-points')
def key_points():
    data = request.get_json(silent=True) or {}
    filename = (data.get('filename') or '').strip()
    store = get_document_store()
    if not store.documents:
        return jsonify({'success': False, 'error': 'Upload at least one note or PDF first.'}), 400
    try:
        result = client.generate(build_key_points_prompt(_collect_context(filename)), temperature=0.25, max_output_tokens=1300)
        return jsonify({'success': True, 'key_points': result})
    except AIServiceError as exc:
        return jsonify({'success': False, 'error': str(exc)}), 502
