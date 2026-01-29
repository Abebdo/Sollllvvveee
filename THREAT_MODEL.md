# Threat Model - Cloudflare-Native Cyber Intelligence Platform

**This system implements defense-in-depth controls. Security is a continuous process requiring regular updates, threat modeling, and incident response capabilities. No system is impervious to determined adversaries.**

## ASSETS
*   **A1**: Analysis API endpoints (availability, integrity)
*   **A2**: User submission data (confidentiality via TLS)
*   **A3**: Intelligence results (integrity, non-repudiation)
*   **A4**: KV cache data (confidentiality of cached results)
*   **A5**: Rate limit state (availability)

## TRUST BOUNDARIES
*   **TB1**: Internet <-> Cloudflare Edge (untrusted)
*   **TB2**: Cloudflare Edge <-> Worker (semi-trusted)
*   **TB3**: Worker <-> KV/Durable Objects (trusted internal)
*   **TB4**: Worker <-> Workers AI (trusted internal)

## ENTRY POINTS
*   **EP1**: POST /analyze (primary attack surface)
*   **EP2**: GET /analyze/:id (information disclosure)
*   **EP3**: Queue consumer (async processing)

## ABUSE CASES
*   **AC1**: Prompt injection via message content
*   **AC2**: ReDoS via crafted regex patterns
*   **AC3**: Cache poisoning via hash collision
*   **AC4**: Rate limit bypass via IP spoofing (mitigated by CF)
*   **AC5**: Resource exhaustion via large inputs

## STRIDE ANALYSIS
*   **S (Spoofing)**: Identity via correlation ID (low risk)
*   **T (Tampering)**: Input validation prevents (medium control)
*   **R (Repudiation)**: Audit logging via correlation IDs (medium control)
*   **I (Info Disclosure)**: KV encryption at rest (high control)
*   **D (DoS)**: Rate limiting + CF DDoS protection (high control)
*   **E (Elevation)**: No privilege levels in design (N/A)

## ACCEPTED RISKS
*   **AR1**: Passive DNS unavailable in free tier (degraded intel)
*   **AR2**: ASN lookup relies on external API (availability risk)
*   **AR3**: ML inference on Workers AI (vendor lock-in)
*   **AR4**: No persistent audit log in free tier (compliance gap)
