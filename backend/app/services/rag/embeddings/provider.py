"""
Clinical Embedding Provider: Google Gemini MRL & Multi-tier Fallback.
Adheres to Evidence-Based Engineering & Medical SOTA Standards (Self-MedRAG, Jan 2026; MedRAG, arXiv:2402.13178).
"""
import abc
import asyncio
import hashlib
import logging
import math
import time
from typing import List, Optional, Tuple, Dict, Any

import httpx
import numpy as np

from app.config import settings

logger = logging.getLogger("clinical_embeddings")

# Mô hình Embedding Gemini chuẩn mực (CSDL được index theo không gian vector của model này)
DEFAULT_GEMINI_EMBED_MODEL = "gemini-embedding-2"
DEFAULT_EMBEDDING_DIM = 768
MAX_BATCH_SIZE = 30
MAX_RETRIES = 2
INITIAL_BACKOFF_SEC = 0.25


def cosine_similarity(v1: List[float] | np.ndarray, v2: List[float] | np.ndarray) -> float:
    """Tính toán Cosine Similarity giữa 2 vector chuẩn hóa."""
    a = np.asarray(v1, dtype=np.float32)
    b = np.asarray(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


class BaseEmbeddingProvider(abc.ABC):
    """Abstract Base Class cho các nhà cung cấp vector embedding."""

    @property
    @abc.abstractmethod
    def dimension(self) -> int:
        """Số chiều của vector embedding."""
        pass

    @abc.abstractmethod
    async def embed_query(self, text: str) -> Optional[List[float]]:
        """Tạo vector embedding cho câu hỏi người dùng."""
        pass

    @abc.abstractmethod
    async def batch_embed_chunks(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Tạo vector embedding cho một danh sách tài liệu/chunks."""
        pass

    def embed_query_sync(self, text: str) -> Optional[List[float]]:
        """Gọi đồng bộ embed_query."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Trường hợp đang trong async loop
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    return pool.submit(lambda: asyncio.run(self.embed_query(text))).result()
            return loop.run_until_complete(self.embed_query(text))
        except RuntimeError:
            return asyncio.run(self.embed_query(text))


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """
    Nhà cung cấp Vector Embedding sử dụng Google Gemini API.
    Hỗ trợ Matryoshka Representation Learning (MRL) xuất 768 chiều vector,
    Batching, Exponential Backoff và In-Memory LRU Cache cho truy vấn lặp lại.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        dimension: int = DEFAULT_EMBEDDING_DIM,
        model_name: str = DEFAULT_GEMINI_EMBED_MODEL,
        timeout_sec: float = 3.0,
        cache_capacity: int = 1000
    ):
        self._api_key = api_key
        self._dimension = dimension
        self._model_name = model_name
        self._timeout_sec = timeout_sec
        self._query_cache: Dict[str, List[float]] = {}
        self._cache_capacity = cache_capacity

    @property
    def dimension(self) -> int:
        return self._dimension

    def _resolve_api_key(self) -> Optional[str]:
        if self._api_key and self._api_key != "MY_GEMINI_API_KEY" and len(self._api_key.strip()) >= 10:
            return self._api_key.strip()
        try:
            from app.services.admin_key_vault import get_active_api_key
            key = get_active_api_key("gemini")
            if key and key != "MY_GEMINI_API_KEY" and len(key.strip()) >= 10:
                return key.strip()
        except Exception:
            pass
        key = settings.GEMINI_API_KEY
        if key and key != "MY_GEMINI_API_KEY" and len(key.strip()) >= 10:
            return key.strip()
        return None

    async def embed_query(self, text: str) -> Optional[List[float]]:
        """Embed một câu truy vấn người dùng, có bộ đệm LRU nội bộ."""
        cleaned = text.strip()
        if not cleaned:
            return None

        cache_key = hashlib.sha256(f"{self._dimension}:{cleaned}".encode("utf-8")).hexdigest()
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        api_key = self._resolve_api_key()
        if not api_key:
            logger.warning("[GeminiEmbedding] Thiếu API key hợp lệ, bỏ qua embedding.")
            return None

        # Gọi đúng mô hình vector chuẩn đã đồng bộ với CSDL
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._model_name}:embedContent?key={api_key}"
        payload = {
            "model": f"models/{self._model_name}",
            "content": {"parts": [{"text": cleaned}]},
            "outputDimensionality": self._dimension
        }

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=self._timeout_sec) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        values = data.get("embedding", {}).get("values")
                        if values and len(values) == self._dimension:
                            if len(self._query_cache) >= self._cache_capacity:
                                # Xóa phần tử đầu tiên (FIFO/LRU cơ bản)
                                self._query_cache.pop(next(iter(self._query_cache)))
                            self._query_cache[cache_key] = values
                            return values
                    elif resp.status_code in (429, 503):
                        err_text = resp.text.lower()
                        # Thử xoay API key nếu có Key Vault
                        try:
                            from app.services.admin_key_vault import rotate_to_next_key
                            rotated = rotate_to_next_key(api_key, reason=f"rate_limited_{resp.status_code}")
                            if rotated and rotated != api_key:
                                api_key = rotated
                                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._model_name}:embedContent?key={api_key}"
                                continue
                        except Exception:
                            pass

                        if "quota" in err_text or "exhausted" in err_text:
                            logger.warning(f"[GeminiEmbedding] API Quota Exceeded (429), không thể retry thêm.")
                            break

                        # Rate limit ngắn hạn -> exponential backoff
                        await asyncio.sleep(INITIAL_BACKOFF_SEC * (2 ** attempt))
                        continue
                    else:
                        logger.debug(f"[GeminiEmbedding] Model {self._model_name} HTTP {resp.status_code}: {resp.text[:120]}")
                        break
            except (httpx.TimeoutException, httpx.NetworkError) as e:
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(INITIAL_BACKOFF_SEC * (2 ** attempt))
                else:
                    logger.warning(f"[GeminiEmbedding] Network error calling {self._model_name}: {e}")

        return None

    async def batch_embed_chunks(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Tạo embedding cho nhiều văn bản theo từng batch (tối đa 50 texts/batch)."""
        if not texts:
            return []

        api_key = self._resolve_api_key()
        if not api_key:
            return [None] * len(texts)

        results: List[Optional[List[float]]] = []

        # Chia nhỏ thành các batch
        for i in range(0, len(texts), MAX_BATCH_SIZE):
            batch = texts[i:i + MAX_BATCH_SIZE]
            batch_result = await self._embed_single_batch(batch, api_key)
            results.extend(batch_result)

        return results

    async def _embed_single_batch(self, batch_texts: List[str], api_key: str) -> List[Optional[List[float]]]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._model_name}:batchEmbedContents?key={api_key}"
        requests_payload = [
            {
                "model": f"models/{self._model_name}",
                "content": {"parts": [{"text": txt if txt.strip() else " "}]},
                "outputDimensionality": self._dimension
            }
            for txt in batch_texts
        ]
        payload = {"requests": requests_payload}

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        embeddings_data = data.get("embeddings", [])
                        batch_vectors: List[Optional[List[float]]] = []
                        for item in embeddings_data:
                            vals = item.get("values")
                            if vals and len(vals) == self._dimension:
                                batch_vectors.append(vals)
                            else:
                                batch_vectors.append(None)
                        if len(batch_vectors) == len(batch_texts):
                            return batch_vectors
                    elif resp.status_code in (429, 503):
                        try:
                            from app.services.admin_key_vault import rotate_to_next_key
                            rotated = rotate_to_next_key(api_key, reason="rate_limited_429")
                            if rotated:
                                api_key = rotated
                                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self._model_name}:batchEmbedContents?key={api_key}"
                        except Exception:
                            pass
                        await asyncio.sleep(INITIAL_BACKOFF_SEC * (2 ** attempt))
                        continue
                    else:
                        logger.debug(f"[GeminiEmbedding Batch] HTTP {resp.status_code}: {resp.text[:120]}")
                        break
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(INITIAL_BACKOFF_SEC * (2 ** attempt))

        # Nếu batch API thất bại, fallback thử embed tuần tự từng câu một
        logger.warning("[GeminiEmbedding] Batch API thất bại, chuyển sang embed từng câu đơn lẻ...")
        single_results = []
        for txt in batch_texts:
            v = await self.embed_query(txt)
            single_results.append(v)
        return single_results


class MockEmbeddingProvider(BaseEmbeddingProvider):
    """
    Mock Provider giả lập cho kiểm thử đơn vị độc lập và môi trường không có mạng.
    Tạo vector giả lập dựa trên hàm băm SHA-256 có tính xác thực ngữ nghĩa cơ bản.
    """

    def __init__(self, dimension: int = DEFAULT_EMBEDDING_DIM):
        self._dimension = dimension
        self._query_cache: Dict[str, List[float]] = {}

    @property
    def dimension(self) -> int:
        return self._dimension

    def _generate_pseudo_vector(self, text: str) -> List[float]:
        tokens = set(text.lower().split())
        vec = np.zeros(self._dimension, dtype=np.float32)

        for token in tokens:
            seed = int(hashlib.md5(token.encode("utf-8")).hexdigest()[:8], 16)
            np.random.seed(seed)
            token_vec = np.random.randn(self._dimension).astype(np.float32)
            vec += token_vec

        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    async def embed_query(self, text: str) -> Optional[List[float]]:
        cleaned = text.strip()
        if not cleaned:
            return None
        if cleaned in self._query_cache:
            return self._query_cache[cleaned]
        vec = self._generate_pseudo_vector(cleaned)
        self._query_cache[cleaned] = vec
        return vec

    async def batch_embed_chunks(self, texts: List[str]) -> List[Optional[List[float]]]:
        return [self._generate_pseudo_vector(t) if t.strip() else None for t in texts]


_PROVIDER_INSTANCES: Dict[str, BaseEmbeddingProvider] = {}


def get_embedding_provider(mock: bool = False) -> BaseEmbeddingProvider:
    """
    Singleton Factory function lấy Embedding Provider phù hợp và duy trì bộ đệm toàn cục.
    Tránh khởi tạo lặp lại và chia sẻ bộ nhớ đệm _query_cache giữa Cache và Retriever.
    """
    key = "mock" if mock else "gemini"
    if key not in _PROVIDER_INSTANCES:
        if mock:
            _PROVIDER_INSTANCES[key] = MockEmbeddingProvider(dimension=DEFAULT_EMBEDDING_DIM)
        else:
            _PROVIDER_INSTANCES[key] = GeminiEmbeddingProvider(dimension=DEFAULT_EMBEDDING_DIM)
    return _PROVIDER_INSTANCES[key]
