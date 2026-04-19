from __future__ import annotations

import os
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from services.document_store import store
from services.file_service import extract_text_from_file
from utils.helpers import allowed_file, clean_text, get_upload_folder

upload_bp = Blueprint('upload', __name__)


def get_document_store():
    return store


@upload_bp.post('/upload')
def upload_file():
    files = request.files.getlist('file')
    if not files:
        return jsonify({'success': False, 'error': 'No file provided.'}), 400

    results = []
    for uploaded in files:
        if not uploaded or not uploaded.filename:
            continue
        if not allowed_file(uploaded.filename):
            return jsonify({'success': False, 'error': f'Unsupported file: {uploaded.filename}. Upload PDF, TXT, or MD files only.'}), 400

        filename = secure_filename(uploaded.filename)
        file_path = os.path.join(get_upload_folder(), filename)
        uploaded.save(file_path)

        extracted = extract_text_from_file(file_path)
        cleaned_text = clean_text(extracted.text)
        if not cleaned_text:
            return jsonify({'success': False, 'error': f'Could not extract meaningful text from {filename}.'}), 400

        doc = store.add_document(filename=filename, text=cleaned_text, pages=extracted.pages)
        results.append({
            'document_id': doc.document_id,
            'filename': doc.filename,
            'char_count': doc.char_count,
            'chunk_count': doc.chunk_count,
            'pages': doc.pages,
            'preview': doc.preview,
        })

    if not results:
        return jsonify({'success': False, 'error': 'No valid files were uploaded.'}), 400

    first = results[0]
    return jsonify({
        'success': True,
        'message': f'{len(results)} file(s) uploaded successfully.',
        'filename': first['filename'],
        'char_count': first['char_count'],
        'preview': first['preview'],
        'files': results,
    })


@upload_bp.get('/documents')
def list_documents():
    return jsonify({'success': True, 'documents': store.list_documents()})


@upload_bp.delete('/documents/<path:filename>')
def delete_document(filename: str):
    deleted = store.delete_document(filename)
    if not deleted:
        return jsonify({'success': False, 'error': 'Document not found.'}), 404
    return jsonify({'success': True, 'message': f'{filename} removed.'})
