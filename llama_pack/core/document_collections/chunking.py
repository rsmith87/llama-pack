from __future__ import annotations


def chunk_document_text(text: str, max_chars: int, overlap_chars: int) -> list[str]:
    if max_chars <= 0:
        raise ValueError("max_chars must be greater than 0")
    if overlap_chars < 0:
        raise ValueError("overlap_chars must be greater than or equal to 0")
    if overlap_chars >= max_chars:
        raise ValueError("overlap_chars must be less than max_chars")

    words = text.split()
    if not words:
        raise ValueError("Document text must contain non-whitespace content")

    chunks: list[str] = []
    index = 0
    while index < len(words):
        next_index = _chunk_end_index(words, index, max_chars)
        chunk_words = words[index:next_index]
        chunks.append(" ".join(chunk_words))
        if next_index >= len(words):
            break
        index = _overlap_start_index(words, index, next_index, overlap_chars)
    return chunks


def _chunk_end_index(words: list[str], start_index: int, max_chars: int) -> int:
    end_index = start_index
    current_length = 0
    while end_index < len(words):
        word = words[end_index]
        if len(word) > max_chars:
            raise ValueError(f"Document word exceeds max_chars: {word}")
        candidate_length = len(word) if current_length == 0 else current_length + 1 + len(word)
        if candidate_length > max_chars:
            break
        current_length = candidate_length
        end_index += 1
    if end_index == start_index:
        raise ValueError(f"Could not create document chunk at word index {start_index}")
    return end_index


def _overlap_start_index(words: list[str], start_index: int, end_index: int, overlap_chars: int) -> int:
    if overlap_chars == 0:
        return end_index

    overlap_start = end_index
    current_length = 0
    while overlap_start > start_index:
        word = words[overlap_start - 1]
        candidate_length = len(word) if current_length == 0 else current_length + 1 + len(word)
        if candidate_length > overlap_chars:
            break
        current_length = candidate_length
        overlap_start -= 1
    if overlap_start == end_index:
        return end_index
    return overlap_start
