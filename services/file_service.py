"""Robust file extraction for PDF, TXT, and MD files."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Tuple


@dataclass
class ExtractionResult:
    text: str
    pages: int = 0
    meta: dict | None = None


SUPPORTED_EXTENSIONS = {'.pdf', '.txt', '.md'}


def extract_text_from_file(file_path: str) -> ExtractionResult:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.pdf':
        return _extract_from_pdf(file_path)
    if ext in {'.txt', '.md'}:
        return ExtractionResult(text=_extract_from_text(file_path), pages=0, meta={})
    raise ValueError(f'Unsupported file type: {ext}')


def _extract_from_pdf(file_path: str) -> ExtractionResult:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError('Missing dependency: pypdf') from exc

    try:
        reader = PdfReader(file_path)
        text_parts = []
        total_pages = len(reader.pages)
        for index, page in enumerate(reader.pages):
            page_text = (page.extract_text() or '').strip()
            if page_text:
                text_parts.append(f'[Page {index + 1}]\n{page_text}')
        text = '\n\n'.join(text_parts).strip()
        if not text:
            raise ValueError('The PDF was read successfully, but no selectable text was found. It may be image-based or scanned.')
        return ExtractionResult(text=text, pages=total_pages, meta={'source_type': 'pdf'})
    except Exception as exc:
        raise RuntimeError(f'Failed to read PDF: {exc}') from exc


def _extract_from_text(file_path: str) -> str:
    encodings = ['utf-8', 'utf-8-sig', 'latin-1']
    last_error = None
    for encoding in encodings:
        try:
            with open(file_path, 'r', encoding=encoding, errors='ignore') as file:
                text = file.read().strip()
            if text:
                return text
        except Exception as exc:  # pragma: no cover
            last_error = exc
    raise RuntimeError(f'Failed to read text file: {last_error}')
