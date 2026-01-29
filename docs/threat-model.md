# Solveya Threat Model v1.0

**Classification:** CONFIDENTIAL  
**System:** Cyber Intelligence Platform  
**Architecture:** Cloudflare Workers (Serverless/Edge)

---

## 1. System Assets (What we protect)

| Asset ID | Description | Security Property | Criticality |
|----------|-------------|-------------------|-------------|
| **A1** | Analysis API | Availability | High |
| **A2** | User Submissions | Confidentiality (Transit) | Medium |
| **A3** | Intelligence Results | Integrity | High |
| **A4** | KV Cache Data | Confidentiality/Integrity | Medium |
| **A5** | Rate Limit State | Availability/Integrity | High |
| **A6** | ML Models (Workers AI) | Availability | Medium |

## 2. Trust Boundaries

*   **TB1 (Untrusted):** Public Internet <-> Cloudflare Edge (WAF)
*   **TB2 (Semi-Trusted):** Cloudflare Edge <-> Analysis Worker
*   **TB3 (Trusted):** Analysis Worker <-> Workers KV / Durable Objects
*   **TB4 (Trusted):** Analysis Worker <-> Workers AI Service

## 3. STRIDE Analysis

### S - Spoofing
*   **Threat:** Attacker impersonates a legitimate user to bypass rate limits or pollute data.
*   **Mitigation:** 
    *   Strict IP-based rate limiting at the Edge (Cloudflare).
    *   API Key requirement for non-public tiers.
    *   Correlation IDs logged for all requests.

### T - Tampering
*   **Threat:** Attacker modifies analysis requests or cache data.
*   **Mitigation:**
    *   TLS 1.3 enforced for all transit.
    *   Input validation (NFKC normalization) prevents injection attacks.
    *   Cache keys hashed (SHA-256) to prevent collision attacks.

### R - Repudiation
*   **Threat:** User denies submitting malicious content.
*   **Mitigation:**
    *   Cloudflare HTTP Logs.
    *   Internal Audit Logging (via Durable Objects) for compliance tiers.

### I - Information Disclosure
*   **Threat:** Leaking internal error stacks, environment variables, or cached PII.
*   **Mitigation:**
    *   Global Error Handler sanitizes all output.
    *   Environment variables stored in Encrypted Secrets.
    *   Cache TTL policies ensure data is not retained indefinitely.

### D - Denial of Service (DoS)
*   **Threat:** Exhausting worker CPU time or API quotas (ReDoS, large payloads).
*   **Mitigation:**
    *   Input size limit (10KB).
    *   Cloudflare WAF / DDoS shield.
    *   Worker CPU time limits (platform enforced).
    *   Regex timeout wrappers.

### E - Elevation of Privilege
*   **Threat:** Unauthorized access to admin endpoints.
*   **Mitigation:**
    *   No user accounts in Phase 1 (Stateless API).
    *   Admin functions (cache purge) protected by mTLS or specific Cloudflare Access policies.

## 4. Accepted Risks

1.  **Dependency on External Signals:** Tier 2/3 features rely on availability of public DNS/RDAP.
2.  **Probabilistic ML:** Tier 4 (AI) may hallucinate. All AI outputs are labeled "confidence < 1.0".
3.  **Ephemeral Logs:** Free tier logs are ephemeral (Cloudflare tail).

## 5. Security Requirements (Phase 2 Implementation)

- [ ] Implement NFKC Normalization for all text inputs.
- [ ] Implement `safeRegex` wrapper.
- [ ] Enforce Content-Type `application/json`.
- [ ] Set strict Content-Security-Policy (CSP) headers.
