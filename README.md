GamePod

**Privacy-Preserving Personalized Video Game Recommendation System with Decentralized Personal Data Using Solid Pods**

GamePod is a novel, privacy-preserving recommendation architecture that leverages **Solid Pods** for decentralized personal data management. By structuring user preferences, explicit constraints, and behavioral histories into standardized **RDF Knowledge Graphs (Schema.org)**, GamePod ensures complete user data ownership without centralizing raw interactions.

The system employs a hybrid methodology: **Multi-Hop Knowledge Graph Reasoning** with weighted heuristic scoring for homepage personalization, and **Retrieval-Augmented Generation (RAG)** powered by Large Language Models (LLMs) to interpret complex natural language "vibe" queries.

---

## Key Features

- **Absolute Data Sovereignty**: All user data is stored in the user's personal Solid Pod. No centralized database.
- **Multi-Hop Knowledge Graph Reasoning**: Advanced inference engine that traverses user interactions across 4 dimensions (Genre, Publisher, Developer, Platform) with weighted scoring and temporal decay.
- **Natural Language "Vibe" Search**: Describe your mood in plain English (e.g., *"challenging open-world RPG with dark fantasy vibes"*), and the system will semantically filter candidates using LLMs.
- **Explainable AI (XAI)**: Every recommendation comes with a human-readable justification (`schema:reviewBody`) and explicit graph traversal paths (e.g., *"Matches your favored publisher: Nintendo"*).
- **Rich Analytics Dashboard**: Visualize your preference patterns, including favorite genres, publishers, developers, platforms, and rating distributions.
- **Seed-Based Anchoring**: Select specific games as "ground-truth" anchors to guide the recommendation engine toward highly targeted results.
- **Privacy-by-Design**: Built on W3C standards (Solid OIDC, RDF, WebID), ensuring GDPR compliance and zero tracking.

---

## 🏗️ System Architecture

The GamePod system is designed around **four distinct layers**, each with specific responsibilities that work together to deliver personalized recommendations while keeping user data decentralized.

```mermaid
graph LR
    subgraph Layer1["User and Decentralized Storage Layer"]
        User((User))
        P1["Player A Pod"]
        P2["Player B Pod"]
        ACL{"WAC and ACL Gateway"}
    end

    subgraph Layer2["GamePod Core Logic Layer"]
        Engine["GamePod Recommendation Engine"]
        KG["Multi-Hop KG Reasoning"]
        RAG["RAG Pipeline"]
        Val["Age and Diversity Validator"]
    end

    subgraph Layer3["External Services Layer"]
        RAWG["RAWG API"]
        Port["OpenRouter LLM Port"]
        L1["LLM Llama 3"]
        L2["LLM Claude 3"]
        Ln["LLM GPT-4o"]
    end

    User --> Engine
    P1 <--> ACL
    P2 <--> ACL
    ACL <--> Engine
    Engine <--> RAWG
    Engine --> Port
    Port <--> L1
    Port <--> L2
    Port <--> Ln
    Port --> Engine