import os
import re
from pathlib import Path

ALLOWED_EXTENSIONS = {'pdf', 'txt', 'md'}


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def clean_text(text: str) -> str:
    text = text.replace('\x00', ' ')
    text = re.sub(r'\r\n?', '\n', text)
    text = re.sub(r'[\t\f\v]+', ' ', text)
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def get_upload_folder() -> str:
    folder = Path(__file__).resolve().parent.parent / 'uploads'
    folder.mkdir(parents=True, exist_ok=True)
    return str(folder)
