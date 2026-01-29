# Intelligence Feature Matrix

**Security recommendations are probabilistic assessments based on available intelligence. False positives and negatives may occur. Critical decisions should involve human verification.**

## TIER 1: LOCAL HEURISTICS (100% offline, deterministic)
*   **Feature 23-28, 30-32**: URL Analysis (Syntax, Entropy, TLD Reputation)
*   **Feature 33-45**: NLP Patterns (Phishing Keywords, Urgency Indicators)
*   **Confidence**: High (1.0)
*   **Cost**: $0

## TIER 2: PUBLIC API DEPENDENT (external calls, rate limited)
*   **Feature 1-15**: DNS via Cloudflare DoH
*   **Feature 16-22**: TLS via direct connection
*   **Feature 11-14**: WHOIS/RDAP
*   **Confidence**: Medium-High (0.8-1.0)
*   **Cost**: API quota dependent
*   **Failure mode**: Graceful degradation

## TIER 3: SIMULATED/PLANNED (requires future implementation)
*   **Feature 10**: Passive DNS (placeholder)
*   **Feature 12**: Domain age delta (requires historical store)
*   **Feature 29**: Full redirect chain (requires HTTP fetch)
*   **Feature 46-52**: Advanced brand analysis (requires ML training)
*   **Confidence**: N/A (returns explanatory note)
*   **Implementation**: Marked with `// TODO: Implement with [Service]`

## TIER 4: PLATFORM SERVICES (Cloudflare native)
*   **Feature 53-55**: Workers AI Inference
*   **Feature 56-57**: KV Caching Analysis
*   **Feature 58-60**: Durable Objects Rate/Session State
*   **Confidence**: High (managed service)
*   **Cost**: Usage-based
