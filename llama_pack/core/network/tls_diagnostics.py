from __future__ import annotations

import ssl

import httpx


TLS_RECOVERY_DOC = "docs/caddy-local-tls.md#recovering-from-expired-certificates"


def ssl_diagnostic_message(exc: BaseException) -> str | None:
    """Return an operator-facing TLS diagnostic when an exception is cert-related."""
    chain = _exception_chain(exc)
    text = " ".join(str(item).lower() for item in chain)
    if any(isinstance(item, ssl.SSLCertVerificationError) for item in chain):
        if _contains_any(text, ("certificate has expired", "certificate expired", "expired")):
            return (
                "TLS certificate verification failed: the certificate appears to be expired. "
                f"Re-issue and reinstall the Caddy certificate, then reload Caddy. See {TLS_RECOVERY_DOC}."
            )
        if _contains_any(
            text,
            (
                "hostname mismatch",
                "ip address mismatch",
                "not valid for",
                "certificate is valid for",
            ),
        ):
            return (
                "TLS certificate verification failed: the URL hostname does not match the certificate SAN. "
                "Reissue the certificate for the exact hostname used in the Llama Pack URL."
            )
        if _contains_any(
            text,
            (
                "self-signed certificate",
                "unable to get local issuer certificate",
                "unable to get issuer certificate",
                "certificate verify failed",
                "unknown ca",
                "untrusted",
            ),
        ):
            return (
                "TLS certificate verification failed: the certificate authority is not trusted by this process. "
                "Install the local CA root and set SSL_CERT_FILE/REQUESTS_CA_BUNDLE to the Llama Pack CA chain."
            )
    if isinstance(exc, httpx.HTTPError) and _contains_any(text, ("certificate verify failed", "ssl")):
        return f"TLS connection failed: {exc}"
    return None


def network_error_text(exc: Exception) -> str:
    diagnostic = ssl_diagnostic_message(exc)
    if diagnostic:
        return diagnostic
    if isinstance(exc, httpx.HTTPStatusError):
        return f"upstream http {exc.response.status_code}: {exc.response.text}"
    if isinstance(exc, httpx.HTTPError):
        return f"upstream transport error: {exc}"
    return f"unexpected upstream error: {exc}"


def _exception_chain(exc: BaseException) -> list[BaseException]:
    chain: list[BaseException] = []
    current: BaseException | None = exc
    while current is not None and current not in chain:
        chain.append(current)
        current = current.__cause__ or current.__context__
    return chain


def _contains_any(text: str, needles: tuple[str, ...]) -> bool:
    return any(needle in text for needle in needles)
