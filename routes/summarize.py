from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.ai_service import AIServiceError, build_summary_prompt, client
from routes.upload import get_document_store

summarize_bp = Blueprint('summarize', __name__)


@summarize_bp.post('/summarize')
def summarize():
    data = request.get_json(silent=True) or {}
    filename = (data.get('filename') or '').strip()
    store = get_document_store()

    if not store.documents:
        return jsonify({'success': False, 'error': 'Upload at least one note or PDF first.'}), 400

    docs = [store.documents[filename]] if filename and filename in store.documents else list(store.documents.values())
    context = '\n\n---\n\n'.join(d.text[:8000] for d in docs)
    prompt = build_summary_prompt(context)

    try:
        summary = client.generate(prompt, temperature=0.3, max_output_tokens=1800)
        return jsonify({'success': True, 'summary': summary})
    except AIServiceError as exc:
        return jsonify({'success': False, 'error': str(exc)}), 502
