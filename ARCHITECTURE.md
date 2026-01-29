# Architecture - Cloudflare-Native Cyber Intelligence Platform

## System Context

```mermaid
graph TD
    User[Client / User] -->|HTTPS| CF[Cloudflare Edge]
    CF -->|Route| Worker[Worker Entry Point]

    subgraph "Cloudflare Ecosystem"
        Worker -->|Read/Write| KV[KV Store - Cache]
        Worker -->|Coordination| DO[Durable Object - Session/RateLimit]
        Worker -->|Inference| AI[Workers AI - LLM]
        Worker -->|Async| Queue[Cloudflare Queues]
    end

    subgraph "External Services"
        Worker -->|DNS/RDAP| ExtDNS[External DNS/Whois]
    end
```

## Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Worker
    participant V as Validator
    participant C as KV Cache
    participant E as Intelligence Engine
    participant R as Risk Scorer

    U->>W: POST /analyze
    W->>V: Validate Input
    alt Invalid
        V-->>W: Error
        W-->>U: 400 Bad Request
    end

    W->>C: Check Cache (Hash)
    alt Cache Hit
        C-->>W: Cached Result
        W-->>U: 200 OK (Cached)
    end

    W->>E: Run Tier 1 (Local)
    W->>E: Run Tier 2 (External APIs)
    W->>E: Run Tier 4 (AI Inference)
    E->>R: Aggregate Evidence
    R->>R: Calculate Risk Score
    R->>C: Store Result
    R-->>W: Final Assessment
    W-->>U: 200 OK (Fresh)
```

## Disclaimer
This system implements defense-in-depth controls. Security is a continuous process requiring regular updates, threat modeling, and incident response capabilities. No system is impervious to determined adversaries.
