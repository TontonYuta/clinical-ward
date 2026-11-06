"""Security response headers for the API surface."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(self), geolocation=()")
        response.headers.setdefault("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
        # Caching strategy for API surface:
        # Static authoritative drug registry (DAV 55k) is safe for edge CDN & browser caching
        if request.method in ("GET", "HEAD") and request.url.path.startswith("/api/v1/registry"):
            if "refresh=true" in str(request.query_params):
                response.headers["Cache-Control"] = "no-store"
            else:
                response.headers.setdefault(
                    "Cache-Control",
                    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
                )
        elif request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response
