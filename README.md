# 🎮 GamePod

**Privacy-Preserving Personalized Video Game Recommendation System with Decentralized Personal Data Using Solid Pods**

GamePod is a novel, privacy-preserving recommendation architecture that leverages **Solid Pods** for decentralized personal data management. By structuring user preferences, explicit constraints, and behavioral histories into standardized **RDF Knowledge Graphs (Schema.org)**, GamePod ensures complete user data ownership without centralizing raw interactions.

The system employs a hybrid methodology: **Multi-Hop Knowledge Graph Reasoning** with weighted heuristic scoring for homepage personalization, and **Retrieval-Augmented Generation (RAG)** powered by Large Language Models (LLMs) to interpret complex natural language "vibe" queries.

---

## 🌟 Key Features

- **🔐 Absolute Data Sovereignty**: All user data is stored in the user's personal Solid Pod. No centralized database.
- **🧠 Multi-Hop Knowledge Graph Reasoning**: Advanced inference engine that traverses user interactions across 4 dimensions (Genre, Publisher, Developer, Platform) with weighted scoring and temporal decay.
- **💬 Natural Language "Vibe" Search**: Describe your mood in plain English (e.g., *"challenging open-world RPG with dark fantasy vibes"*), and the system will semantically filter candidates using LLMs.
- **🎯 Explainable AI (XAI)**: Every recommendation comes with a human-readable justification (`schema:reviewBody`) and explicit graph traversal paths (e.g., *"Matches your favored publisher: Nintendo"*).
- **📊 Rich Analytics Dashboard**: Visualize your preference patterns, including favorite genres, publishers, developers, platforms, and rating distributions.
- **🔗 Seed-Based Anchoring**: Select specific games as "ground-truth" anchors to guide the recommendation engine toward highly targeted results.
- **🛡️ Privacy-by-Design**: Built on W3C standards (Solid OIDC, RDF, WebID), ensuring GDPR compliance and zero tracking.

---

## 🏗️ System Architecture

The GamePod system is designed around **four distinct layers**, each with specific responsibilities that work together to deliver personalized recommendations while keeping user data decentralized.

```mermaid
graph TD
    User((User / Player))

    subgraph ClientLayer [1. Client Layer Frontend]
        ReactUI[React.js + Vite + Tailwind CSS]
        SolidAuth[Solid OIDC Authentication]
        StateMgr[Local State and Session Management]
        ReactUI --> SolidAuth
        ReactUI --> StateMgr
    end

    subgraph LogicLayer [2. Logic and Orchestration Layer]
        KGEngine[Multi-Hop KG Reasoning Engine]
        RAGPipeline[RAG Pipeline Vibe Search]
        DataMapper[Schema.org RDF Parser and Mapper]
        KGEngine --> DataMapper
        RAGPipeline --> DataMapper
    end

    subgraph StorageLayer [3. Decentralized Storage Layer Solid POD]
        WebID[User WebID and WAC/ACL Access Control]
        subgraph PODFiles [game-rec-data Namespace]
            Settings[settings.ttl Explicit Preferences]
            Behavior[behavior.ttl LikeAction ViewAction]
            Sessions[sessions.ttl Search Context and Queries]
            Seeds[seeds.ttl Anchor Games]
            Recs[recommendations.ttl AI Output and reviewBody]
        end
        WebID --> PODFiles
    end

    subgraph ExternalLayer [4. External Services Layer]
        RAWG[RAWG Video Games API]
        LLM[OpenRouter API LLM Semantic Filtering]
    end

    User -->|1. Authenticate and Grant Access| SolidAuth
    SolidAuth -->|2. Fetch RDF Triples| WebID
    DataMapper <-->|3. Read/Write Decentralized Data| WebID
    KGEngine -->|4. Fetch Candidates Multi-hop| RAWG
    RAGPipeline -->|5. Semantic Embedding and Generation| LLM
    RAWG -->|6. Enriched Game Metadata| KGEngine
    LLM -->|7. Curated List plus schema:reviewBody| RAGPipeline
    RAGPipeline -->|8. Persist Scored Results| Recs
    ReactUI -->|9. Render Explainable UI| User