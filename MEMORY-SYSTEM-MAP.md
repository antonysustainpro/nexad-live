# 7-LAYER MEMORY SYSTEM MAP

## Overview
The NexusAD backend implements a sophisticated 7-layer memory system designed to provide comprehensive user context and personalization. While the full 7-layer brain architecture is referenced in the codebase, the current backend implements a subset through vault profiles, personas, and conversation history.

## The 7 Cognitive Layers (0-6)

Based on the brain API structure and cognitive architecture patterns:

### Layer 0: Sensory Memory (Immediate Context)
- **Purpose**: Real-time conversation context and immediate state
- **Implementation**: `messages` array in ChatRequest
- **Retention**: Current conversation only
- **Backend**: Built into chat endpoints

### Layer 1: Working Memory (Session Context)
- **Purpose**: Active session state, current goals, temporary preferences
- **Implementation**: Session cookies and temporary state
- **Retention**: Session duration (15 min idle, 24 hour absolute)
- **Backend**: Session management in middleware

### Layer 2: Episodic Memory (Conversation History)
- **Purpose**: Past conversations, interactions, and outcomes
- **Implementation**: Not directly implemented (planned: brain/conversations)
- **Retention**: Long-term storage of all conversations
- **Backend**: Referenced in brainApi.ts but not active

### Layer 3: Semantic Memory (Knowledge Base)
- **Purpose**: User's domain knowledge, learned facts, RAG context
- **Implementation**: Vault documents and search
- **Retention**: Permanent until deleted
- **Backend**: `/api/v1/vault/*` endpoints

### Layer 4: Procedural Memory (Behavioral Patterns)
- **Purpose**: User preferences, interaction patterns, personas
- **Implementation**: Persona settings and user profile
- **Retention**: Permanent, user-editable
- **Backend**: `/api/v1/user/{userId}/persona`

### Layer 5: Emotional Memory (Sentiment & State)
- **Purpose**: Emotional context, mood patterns, empathy data
- **Implementation**: `emotion_state` in chat requests
- **Retention**: Per-conversation, not persisted
- **Backend**: Part of chat request but not stored

### Layer 6: Meta-Cognitive Memory (Self-Reflection)
- **Purpose**: System's understanding of its own performance, user satisfaction
- **Implementation**: Planned in brain dashboard summary
- **Retention**: Aggregated metrics over time
- **Backend**: Referenced in brainApi.ts as health metrics

## Current Backend Implementation

### Implemented Endpoints

#### Vault Profile System
- `POST /api/v1/vault/profile` - Create user profile
- `GET /api/v1/vault/profile/{user_id}` - Get profile
- `PUT /api/v1/vault/profile/{user_id}` - Update profile

Profile stores:
- Entity information (name, type, jurisdictions)
- Investment preferences (risk appetite, asset focus, budget)
- Goals and competitive landscape
- Report preferences and language settings

#### Persona System
- `GET /api/v1/user/{userId}/persona` - Get persona settings
- `PUT /api/v1/user/{userId}/persona` - Update persona

Persona includes:
- Communication style preferences
- Personality settings (professional, friendly, direct, adaptive)

#### Vault Knowledge Base
- `POST /api/v1/vault/ingest` - Store knowledge chunks
- `POST /api/v1/vault/upload` - Upload documents
- `POST /api/v1/vault/search` - Semantic search
- `GET /api/v1/vault/documents` - List documents
- `DELETE /api/v1/vault/document/{doc_id}` - Delete document

### Not Yet Implemented (From Brain API)

#### Conversation Memory
- `POST /brain/conversations` - Create conversation
- `GET /brain/conversations` - List conversations
- `GET /brain/conversations/{id}` - Get conversation with messages
- `PATCH /brain/conversations/{id}` - Update conversation
- `DELETE /brain/conversations/{id}` - Delete conversation

#### Semantic Memory Search
- `POST /brain/memory/search` - Search past interactions
- `POST /brain/memory/entities/search` - Search entities
- `GET /brain/memory/stats` - Memory statistics
- `POST /brain/memory/reindex` - Reindex memories

#### Brain Dashboard
- `GET /brain/dashboard/summary` - 7-layer health and metrics

## Memory Flow in Chat

1. **Pre-Chat Context Loading**:
   - Load user profile from vault
   - Load persona preferences
   - (Future: Load recent conversation summaries)

2. **During Chat**:
   - Layer 0: Current messages array
   - Layer 3: RAG search against vault documents
   - Layer 4: Apply persona preferences
   - Layer 5: Track emotion state

3. **Post-Chat**:
   - (Future: Store conversation in Layer 2)
   - (Future: Update behavioral patterns in Layer 4)
   - (Future: Update meta-cognitive metrics in Layer 6)

## What's Already Wired

### Frontend API (src/lib/api.ts)
- ✅ Vault operations (upload, search, delete)
- ✅ User profile get/update
- ✅ Persona get/update
- ✅ Chat with emotion state
- ✅ Briefing generation

### Missing Integrations
- ❌ Conversation persistence
- ❌ Memory search across conversations
- ❌ Brain health dashboard
- ❌ Cross-layer memory synthesis
- ❌ Memory visualization in UI

## Implementation Priority

1. **Phase 1: Complete Profile Integration**
   - Wire profile creation during onboarding
   - Show profile data in settings
   - Use profile context in chat

2. **Phase 2: Enhance Chat Context**
   - Load profile before each chat
   - Show active memory layers in UI
   - Display which knowledge is being used

3. **Phase 3: Conversation Persistence**
   - Implement conversation storage
   - Add conversation history view
   - Enable cross-conversation search

4. **Phase 4: Full 7-Layer Dashboard**
   - Implement brain health metrics
   - Visualize all 7 layers
   - Show memory growth over time