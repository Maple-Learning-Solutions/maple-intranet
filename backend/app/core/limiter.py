import logging
from fastapi import Request
from slowapi import Limiter

logger = logging.getLogger(__name__)

def get_client_ip(request: Request) -> str:
    """
    Safely extract the real client IP address across local environments
    and reverse proxies (Render, Cloudflare, Nginx, Vercel).
    
    Reverse proxies prepend or provide the client IP in standard headers:
    1. 'x-render-client-ip': Render-provided client IP
    2. 'cf-connecting-ip': Cloudflare-provided client IP
    3. 'x-forwarded-for': Standard proxy header (leftmost IP is the original client)
    4. request.client.host: Direct socket connection
    """
    # 1. Render proxy header
    render_ip = request.headers.get("x-render-client-ip")
    if render_ip and render_ip.strip():
        return render_ip.strip()

    # 2. Cloudflare header
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and cf_ip.strip():
        return cf_ip.strip()

    # 3. Standard X-Forwarded-For header
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[0]

    # 4. Direct socket connection fallback
    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


# Global limiter instance configured with safe reverse-proxy IP identification
limiter = Limiter(key_func=get_client_ip)
