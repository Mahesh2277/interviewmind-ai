import numpy as np
from typing import List, Tuple

# Optional imports with safe fallbacks
try:
    from sentence_transformers import SentenceTransformer
    # Initialize the small MiniLM model (under 100MB, fast CPU performance)
    model = SentenceTransformer('all-MiniLM-L6-v2')
    has_transformers = True
    print("NLP ENGINE: Loaded sentence-transformers 'all-MiniLM-L6-v2' successfully.")
except Exception as e:
    model = None
    has_transformers = False
    print("NLP ENGINE WARNING: sentence-transformers failed to load, falling back to TF-IDF. Error:", e)

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    has_sklearn = True
except Exception as e:
    has_sklearn = False
    print("NLP ENGINE WARNING: scikit-learn failed to load. Fallback similarity scoring will be active. Error:", e)


def calculate_semantic_similarity(text1: str, text2: str) -> float:
    """
    Computes cosine similarity between two text fields using SentenceTransformers
    or TF-IDF fallback if transformers are unavailable.
    """
    if not text1.strip() or not text2.strip():
        return 0.0

    # 1. Primary method: Sentence Transformers
    if has_transformers and model is not None:
        try:
            embeddings = model.encode([text1, text2])
            # Cosine similarity formula: dot(a, b) / (norm(a) * norm(b))
            emb1, emb2 = embeddings[0], embeddings[1]
            dot_product = np.dot(emb1, emb2)
            norm_a = np.linalg.norm(emb1)
            norm_b = np.linalg.norm(emb2)
            if norm_a == 0 or norm_b == 0:
                return 0.0
            similarity = float(dot_product / (norm_a * norm_b))
            return max(0.0, min(1.0, similarity)) # clamp between 0 and 1
        except Exception as err:
            print("NLP ENGINE ERROR: SentenceTransformer encoding error:", err)
            # Fall back to next method

    # 2. Secondary method: TF-IDF + Cosine Similarity
    if has_sklearn:
        try:
            vectorizer = TfidfVectorizer()
            tfidf = vectorizer.fit_transform([text1, text2])
            sim_matrix = cosine_similarity(tfidf[0:1], tfidf[1:2])
            return max(0.0, min(1.0, float(sim_matrix[0][0])))
        except Exception as err:
            print("NLP ENGINE ERROR: TF-IDF fallback error:", err)

    # 3. Last-resort fallback: Keyword overlap ratio
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    if not words1 or not words2:
        return 0.0
    overlap = words1.intersection(words2)
    return float(len(overlap)) / max(len(words1), len(words2))


def check_concept_coverage(answer: str, concepts: List[str]) -> Tuple[List[str], List[str]]:
    """
    Scans candidate answer for required keywords or phrases.
    Returns a list of matched concepts and missing concepts.
    """
    matched = []
    missing = []
    answer_lower = answer.lower()
    
    for concept in concepts:
        concept_clean = concept.strip()
        if not concept_clean:
            continue
        if concept_clean.lower() in answer_lower:
            matched.append(concept_clean)
        else:
            missing.append(concept_clean)
            
    return matched, missing
