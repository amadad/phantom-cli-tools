# Brand-Aware Content Generation & Evaluation Pipeline

```mermaid
flowchart TD
    A[Start: Topic Input] --> B[Load Brand Config]
    B --> C[brands/givecare.yml]
    C --> D[Content Generation]
    
    D --> E[Azure OpenAI GPT-4.5]
    E --> F[Brand Voice Application]
    F --> G[Platform Optimization]
    G --> H[Generated Content]
    
    H --> I[Visual Prompt Generation]
    I --> J[Brand Visual Context]
    J --> K[Visual Mode Selection]
    K --> L[Image Generation]
    
    L --> M[Replicate FLUX-schnell]
    M --> N[Brand Styling Applied]
    N --> O[Generated Image]
    
    H --> P[Verdict Evaluation]
    O --> P
    P --> Q[Azure OpenAI o4-mini Judge]
    Q --> R{Verdict Analysis}
    
    R --> S[Brand Alignment Check]
    R --> T[Platform Optimization Check]
    R --> U[Engagement Potential Check]
    R --> V[Content Quality Check]
    
    S --> W[Final Score 1-5]
    T --> W
    U --> W
    V --> W
    
    W --> X{Score >= 4?}
    X -->|Yes| Y[✅ High Quality Content]
    X -->|No| Z[❌ Needs Improvement]
    
    Z --> AA[Feedback Loop]
    AA --> AB[Content Regeneration]
    AB --> D
    
    Y --> AC[Save to Output]
    AC --> AD[Complete Result]
    
    subgraph "Brand Configuration"
        C1[Voice & Tone]
        C2[Visual Style]
        C3[Topics]
        C4[Negative Prompts]
        C5[Technical Specs]
        C6[Platform Rules]
    end
    
    subgraph "Evaluation Criteria"
        E1[Brand Voice Match]
        E2[Topic Relevance]
        E3[Platform Format]
        E4[Engagement Quality]
        E5[Authenticity]
        E6[Visual-Text Harmony]
    end
    
    C --> C1
    C --> C2
    C --> C3
    C --> C4
    C --> C5
    C --> C6
    
    R --> E1
    R --> E2
    R --> E3
    R --> E4
    R --> E5
    R --> E6
    
    style A fill:#e1f5fe
    style Y fill:#c8e6c9
    style Z fill:#ffcdd2
    style Q fill:#fff3e0
    style M fill:#f3e5f5
```

## Pipeline Components Breakdown

### 1. **Input Layer**
- Topic selection
- Platform targeting (Twitter, LinkedIn, etc.)
- Brand configuration loading

### 2. **Content Generation Layer**
- Azure OpenAI GPT-4.5 for text generation
- Brand voice application from YAML config
- Platform-specific optimization
- Hashtag generation

### 3. **Visual Generation Layer**
- Brand-aware visual prompt creation
- Visual mode selection (framed_portrait, lifestyle_scene, illustrative_concept)
- Replicate FLUX image generation
- Brand styling application (colors, borders, composition)

### 4. **Evaluation Layer**
- Verdict AI framework with Azure OpenAI o4-mini
- Multi-criteria assessment:
  - Brand alignment scoring
  - Platform optimization check
  - Engagement potential analysis
  - Content quality evaluation

### 5. **Quality Control Layer**
- Intelligent feedback loop
- Content regeneration for low scores
- Human-in-the-loop approval
- Output archival

### 6. **Brand Configuration System**
- Voice & tone guidelines
- Visual style specifications
- Topic focus areas
- Negative prompt lists
- Technical specifications
- Platform-specific rules

## Key Features

- **Brand-Agnostic Architecture**: All styling from YAML configuration
- **AI-Powered Evaluation**: Real LLM judging with Verdict framework
- **Multi-Modal Generation**: Text + visual content creation
- **Quality Feedback Loops**: Automatic improvement cycles
- **Platform Optimization**: Twitter vs LinkedIn adaptation
- **Scalable Design**: Works with any brand configuration