from __future__ import annotations

import math
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class Chunk:
    chunk_id: str
    document_id: str
    filename: str
    content: str
    page_range: Optional[str] = None
    index: int = 0
    token_count: int = 0
    terms: set[str] = field(default_factory=set)


@dataclass
class Document:
    document_id: str
    filename: str
    text: str
    preview: str
    char_count: int
    chunk_count: int
    uploaded_at: float
    pages: int = 0


@dataclass
class ChatTurn:
    role: str
    content: str
    ts: float


class InMemoryStudyStore:
    def __init__(self) -> None:
        self.documents: Dict[str, Document] = {}
        self.chunks: Dict[str, List[Chunk]] = {}
        self.chat_history: List[ChatTurn] = []

    def add_document(self, filename: str, text: str, pages: int = 0) -> Document:
        document_id = str(uuid.uuid4())
        preview = text[:320] + ('...' if len(text) > 320 else '')
        chunk_objects = self._chunk_text(document_id, filename, text)

        doc = Document(
            document_id=document_id,
            filename=filename,
            text=text,
            preview=preview,
            char_count=len(text),
            chunk_count=len(chunk_objects),
            uploaded_at=time.time(),
            pages=pages,
        )
        self.documents[filename] = doc
        self.chunks[filename] = chunk_objects
        return doc

    def delete_document(self, filename: str) -> bool:
        existed = filename in self.documents
        self.documents.pop(filename, None)
        self.chunks.pop(filename, None)
        return existed

    def list_documents(self) -> List[dict]:
        return [
            {
                'document_id': d.document_id,
                'filename': d.filename,
                'char_count': d.char_count,
                'chunk_count': d.chunk_count,
                'preview': d.preview,
                'pages': d.pages,
                'uploaded_at': d.uploaded_at,
            }
            for d in sorted(self.documents.values(), key=lambda x: x.uploaded_at, reverse=True)
        ]

    def clear_chat(self) -> None:
        self.chat_history.clear()

    def append_chat(self, role: str, content: str) -> None:
        self.chat_history.append(ChatTurn(role=role, content=content, ts=time.time()))
        if len(self.chat_history) > 20:
            self.chat_history = self.chat_history[-20:]

    def get_chat_window(self, limit: int = 8) -> List[dict]:
        return [{'role': t.role, 'content': t.content} for t in self.chat_history[-limit:]]

    def retrieve(self, query: str, filename: str = '', top_k: int = 6) -> Tuple[List[Chunk], List[str]]:
        target_files = [filename] if filename and filename in self.chunks else list(self.chunks.keys())
        if not target_files:
            return [], []

        query_terms = _tokenize(query)
        scored: List[Tuple[float, Chunk]] = []
        for file in target_files:
            for chunk in self.chunks.get(file, []):
                overlap = len(chunk.terms & query_terms)
                density = overlap / max(1, math.sqrt(len(chunk.terms)))
                semantic_hint = _phrase_bonus(query.lower(), chunk.content.lower())
                score = (overlap * 2.2) + density + semantic_hint
                if score > 0:
                    scored.append((score, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        selected = [chunk for _, chunk in scored[:top_k]]
        citations = [f"{c.filename} · chunk {c.index + 1}" for c in selected]
        return selected, citations

    def _chunk_text(self, document_id: str, filename: str, text: str) -> List[Chunk]:
        paragraphs = [p.strip() for p in re.split(r'\n\s*\n+', text) if p.strip()]
        chunks: List[Chunk] = []
        current: List[str] = []
        current_len = 0
        max_chars = 1600
        overlap_tail = 220

        def flush() -> None:
            nonlocal current, current_len
            if not current:
                return
            content = '\n\n'.join(current).strip()
            idx = len(chunks)
            chunks.append(Chunk(
                chunk_id=f'{document_id}-{idx}',
                document_id=document_id,
                filename=filename,
                content=content,
                index=idx,
                token_count=max(1, len(content) // 4),
                terms=_tokenize(content),
            ))
            tail = content[-overlap_tail:].strip()
            current = [tail] if tail else []
            current_len = len(tail)

        for para in paragraphs:
            if len(para) > max_chars:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sent in sentences:
                    if current_len + len(sent) + 1 > max_chars:
                        flush()
                    current.append(sent)
                    current_len += len(sent) + 1
                continue

            if current_len + len(para) + 2 > max_chars:
                flush()
            current.append(para)
            current_len += len(para) + 2

        flush()
        return chunks or [Chunk(
            chunk_id=f'{document_id}-0',
            document_id=document_id,
            filename=filename,
            content=text[:max_chars],
            index=0,
            token_count=max(1, len(text[:max_chars]) // 4),
            terms=_tokenize(text[:max_chars]),
        )]


_WORD_RE = re.compile(r"[a-zA-Z0-9_]{2,}")
_STOP = {
    'the','and','for','that','with','from','this','your','have','into','when','where','what','which',
    'will','their','then','than','were','been','being','about','there','these','those','them','they',
    'you','are','can','not','but','use','using','used','how','why','who','his','her','its','our','out',
    'all','any','may','such','more','most','like','does','did','has','had','was','is','to','of','in','on',
    'at','by','or','an','as','it','be','if'
}


def _tokenize(text: str) -> set[str]:
    return {w for w in _WORD_RE.findall(text.lower()) if w not in _STOP}


def _phrase_bonus(query: str, content: str) -> float:
    bonus = 0.0
    for phrase in [p.strip() for p in query.split() if len(p.strip()) > 5][:4]:
        if phrase and phrase in content:
            bonus += 0.45
    return bonus


store = InMemoryStudyStore()
