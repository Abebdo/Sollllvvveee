# Solveya Intelligence Feature Matrix

**Tiers:**
*   **T1:** Local Heuristics (Offline, Fast, Free)
*   **T2:** Public API Dependent (DNS, RDAP, Network)
*   **T3:** Simulated/Advanced (Headless, Historical)
*   **T4:** Platform AI (LLM, Embeddings)

| ID | Feature Name | Tier | Data Source | Confidence | Failure Mode |
|----|--------------|------|-------------|------------|--------------|
| **F01** | Valid IP Syntax | T1 | Regex | 1.0 | N/A |
| **F02** | Bogon IP Check | T1 | Lookuptable | 1.0 | N/A |
| **F03** | Port Scanner (Common) | T2 | Socket | 0.8 | Timeout |
| **F04** | DNS A Record | T2 | DoH | 1.0 | NXDOMAIN |
| **F05** | DNS MX Record | T2 | DoH | 1.0 | Null |
| **F06** | DNS TXT/SPF | T2 | DoH | 0.9 | Null |
| **F07** | Reverse DNS (PTR) | T2 | DoH | 0.9 | Mismatch |
| **F08** | ASN Lookup | T2 | IP-API | 0.9 | Unknown |
| **F09** | Geo-Location | T2 | CF-Headers | 0.8 | Country-Only |
| **F10** | Passive DNS | T3 | Future-API | N/A | Ignored |
| **F11** | WHOIS Creation Date | T2 | RDAP | 0.9 | Redacted |
| **F12** | Domain Age Delta | T3 | Historical | N/A | Ignored |
| **F13** | Registrar Reputation | T1 | List | 0.7 | Unknown |
| **F14** | Abuse Contact Email | T2 | RDAP | 0.9 | Redacted |
| **F15** | Punycode Detection | T1 | Logic | 1.0 | N/A |
| **F16** | TLS Cert Validity | T2 | Handshake | 1.0 | Connection Refused |
| **F17** | TLS Issuer Rep | T1 | List | 0.8 | Unknown |
| **F18** | TLS Age | T2 | Handshake | 1.0 | N/A |
| **F19** | Self-Signed Cert | T2 | Handshake | 1.0 | N/A |
| **F20** | Mixed Content | T3 | Crawler | N/A | Ignored |
| **F21** | HSTS Header | T2 | Fetch | 1.0 | Null |
| **F22** | Cipher Suite Strength | T2 | Handshake | 0.9 | N/A |
| **F23** | URL Length | T1 | Logic | 1.0 | N/A |
| **F24** | Suspicious TLD | T1 | List | 0.8 | N/A |
| **F25** | High Entropy Domain | T1 | Math | 0.7 | N/A |
| **F26** | IP in URL | T1 | Regex | 1.0 | N/A |
| **F27** | At Symbol (@) Usage | T1 | Regex | 1.0 | N/A |
| **F28** | Double Extension | T1 | Regex | 0.9 | N/A |
| **F29** | Redirect Chain | T3 | Fetch | N/A | Ignored |
| **F30** | Subdomain Count | T1 | Logic | 1.0 | N/A |
| **F31** | Keyword: 'Login' | T1 | Regex | 0.6 | N/A |
| **F32** | Keyword: 'Secure' | T1 | Regex | 0.6 | N/A |
| **F33** | Keyword: 'Update' | T1 | Regex | 0.5 | N/A |
| **F34** | Keyword: 'Verify' | T1 | Regex | 0.5 | N/A |
| **F35** | Keyword: 'Bank' | T1 | Regex | 0.6 | N/A |
| **F36** | Keyword: 'Account' | T1 | Regex | 0.6 | N/A |
| **F37** | Keyword: 'Suspended' | T1 | Regex | 0.7 | N/A |
| **F38** | Keyword: 'Urgent' | T1 | Regex | 0.7 | N/A |
| **F39** | Brand Mimicry (Levenshtein)| T1 | Math | 0.8 | N/A |
| **F40** | Homograph Attack | T1 | Logic | 0.9 | N/A |
| **F41** | Shortener Detection | T1 | List | 0.9 | N/A |
| **F42** | JavaScript Obfuscation | T3 | Scanner | N/A | Ignored |
| **F43** | IFrame Detection | T3 | Scanner | N/A | Ignored |
| **F44** | Form Detection | T3 | Scanner | N/A | Ignored |
| **F45** | Email Header Analysis | T1 | Parser | 1.0 | N/A |
| **F46** | Brand Logo Detect | T4 | Vision | 0.8 | Low Conf |
| **F47** | OCR Analysis | T4 | Vision | 0.8 | Low Conf |
| **F48** | Sentiment Analysis | T4 | NLP | 0.7 | N/A |
| **F49** | Intent Classification | T4 | NLP | 0.8 | N/A |
| **F50** | Social Eng. Score | T4 | NLP | 0.7 | N/A |
| **F51** | Language Mismatch | T4 | NLP | 0.6 | N/A |
| **F52** | Style/Tone Analysis | T4 | NLP | 0.5 | N/A |
| **F53** | File Magic Bytes | T1 | Logic | 1.0 | N/A |
| **F54** | Malware Signature | T2 | Ext-API | 0.9 | Unknown |
| **F55** | Ransomware Note | T4 | NLP | 0.9 | N/A |
| **F56** | C2 Pattern Match | T1 | Regex | 0.8 | N/A |
| **F57** | DGA Detection | T4 | ML | 0.8 | N/A |
| **F58** | User-Agent Analysis | T1 | Logic | 0.9 | N/A |
| **F59** | Referer Analysis | T1 | Logic | 0.8 | N/A |
| **F60** | Cookie Analysis | T2 | Fetch | 0.9 | N/A |
