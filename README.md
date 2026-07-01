# SagaSpun — AI Dungeon Master for D&D-Style RPGs

An intelligent AI-powered Dungeon Master for tabletop role-playing games (D&D, Pathfinder, etc.). SagaSpun uses advanced LLMs (Mistral 7B via Ollama) running 100% offline to generate immersive, adaptive narratives for interactive storytelling.

**Status:** 🚀 In active development for production deployment

---

## What It Does

SagaSpun creates a complete interactive RPG experience:

- 🎲 **AI Dungeon Master** — Mistral 7B generates immersive narratives
- 🎯 **Player Actions** — process & respond to player decisions in real-time
- 🗺️ **Dynamic World** — persistent game state, branching narratives
- 🎨 **React Native Frontend** — cross-platform mobile/web support (Expo)
- ⚡ **Flask Backend** — RESTful API, game logic, Ollama integration
- 🔌 **100% Offline** — Ollama runs locally, no internet required
- 🧠 **Context-Aware** — maintains character, setting, and campaign continuity

Perfect for tabletop gaming enthusiasts, solo players, and collaborative storytelling.

---

## Why SagaSpun?

- **Never stuck without a DM** — AI handles everything
- **Truly offline** — zero cloud dependency, 100% privacy
- **Highly customizable** — modify rules, settings, tones
- **Scalable** — from quick encounters to full campaigns
- **Experimental AI** — explore LLM capabilities for creative tasks

---

## Tech Stack

### Frontend
- **React Native + Expo** — iOS/Android/Web
- **TypeScript** — type-safe components
- **State Management** — Redux or Context API

### Backend
- **Python Flask** — lightweight REST API
- **Ollama Integration** — local Mistral 7B LLM
- **WebSockets** — real-time streaming responses
- **SQLite/PostgreSQL** — game state persistence

### AI/ML
- **Mistral 7B** — via Ollama (local inference)
- **Prompt Engineering** — DM-specific prompts
- **Context Management** — token optimization

---

## Architecture

```
┌─────────────────────────────────────┐
│   React Native Frontend (Expo)      │
│   - Game UI, player input           │
└──────────────┬──────────────────────┘
               │ HTTP/WebSocket
               ↓
┌──────────────────────────────────────┐
│   Flask Backend API                  │
│   - Game logic, state management     │
│   - Ollama orchestration             │
└──────────────┬───────────────────────┘
               │ Local Process
               ↓
┌──────────────────────────────────────┐
│   Ollama + Mistral 7B LLM            │
│   - Narrative generation             │
│   - Context-aware responses          │
└──────────────────────────────────────┘
```

---

## Setup & Installation

### Prerequisites

- **Node.js 18+** (for Expo/React Native)
- **Python 3.9+** (for Flask backend)
- **Ollama** (for local LLM inference)
- **Mistral 7B model** (downloaded via Ollama)

### 1. Clone Repository

```bash
git clone https://github.com/EuphoRiya37/SagaSpun---AI-Dungeon-Master-for-Dungeons-and-Dragons.git
cd SagaSpun
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Setup Ollama

```bash
# Install Ollama from https://ollama.ai
# Pull Mistral 7B model
ollama pull mistral

# Run Ollama server (keeps running in background)
ollama serve
```

### 4. Start Backend

```bash
cd backend
flask run --port 5000
# Backend available at http://localhost:5000
```

### 5. Frontend Setup

```bash
cd frontend
npm install
npx expo start
# Scan QR code with Expo app (iOS/Android) or press 'w' for web
```

---

## Usage

### Starting a Campaign

1. **Open the app**
2. **Create new campaign** — set world, setting, tone
3. **Create character** — name, class, backstory
4. **Describe your action** — "I enter the tavern"
5. **AI responds** — Mistral 7B generates narrative
6. **Repeat** — continuous interactive storytelling

### Example Interaction

```
Player: "I want to talk to the mysterious stranger in the corner"

AI: "The hooded figure looks up from their drink. In the dim tavern light,
you catch a glimpse of an intricate scar running down their left cheek.
Their eyes narrow with interest. 'I don't usually talk to outsiders,' 
they say, their voice gravelly and measured. 'What brings you to this place?'

What do you do?"
```

---

## Project Structure

```
SagaSpun/
├── backend/
│   ├── app.py                 - Flask app entry point
│   ├── routes/
│   │   ├── game.py            - Game API endpoints
│   │   └── ollama.py          - LLM integration
│   ├── models/
│   │   ├── campaign.py        - Campaign data model
│   │   ├── player.py          - Player data model
│   │   └── story.py           - Story state management
│   ├── prompts/
│   │   └── dm_prompts.py      - Dungeon Master prompts
│   ├── requirements.txt        - Python dependencies
│   └── config.py              - Configuration
│
├── frontend/
│   ├── app.json               - Expo config
│   ├── App.tsx                - Root component
│   ├── screens/
│   │   ├── CampaignScreen.tsx - Campaign selection
│   │   ├── GameScreen.tsx     - Main game UI
│   │   └── CharacterScreen.tsx- Character creation
│   ├── components/
│   │   ├── NarrativeBox.tsx   - Story display
│   │   ├── ActionInput.tsx    - Player input
│   │   └── CharacterCard.tsx  - Character display
│   ├── services/
│   │   └── api.ts             - Backend API calls
│   ├── package.json
│   └── tsconfig.json
│
├── README.md                  - This file
├── LICENSE                    - Proprietary license
└── CONTRIBUTING.md            - Contributing guidelines
```

---

## Features Implemented

- ✅ Ollama integration for local LLM
- ✅ Campaign creation & management
- ✅ Character creation system
- ✅ Real-time narrative generation
- ✅ Game state persistence
- ✅ Multi-turn conversations
- ✅ Cross-platform (iOS/Android/Web)

## Planned Features

- 🚀 Custom rule systems (D&D 5e, Pathfinder, etc.)
- 🚀 Multiplayer mode (multiple players, one AI DM)
- 🚀 Campaign sharing & publishing
- 🚀 Custom LLM fine-tuning
- 🚀 Voice input/output
- 🚀 In-game dice rolling
- 🚀 Character sheets & inventory
- 🚀 Image generation for scenes

---

## Performance & Optimization

- **LLM Response Time:** ~5-15 seconds (Mistral 7B on consumer GPU)
- **Token Limit:** Context window optimized for story coherence
- **Streaming:** Real-time narrative delivery via WebSockets
- **Caching:** Frequently used prompts cached for speed

---

## Troubleshooting

### Ollama not responding
```bash
# Ensure Ollama is running
ollama serve

# Check if Mistral is available
ollama list
```

### Backend connection errors
```bash
# Verify backend is running on port 5000
curl http://localhost:5000/health
```

### Frontend WebSocket timeout
- Increase timeout in `frontend/services/api.ts`
- Check network connectivity
- Restart Ollama

---

## License & Usage

**⚠️ PROPRIETARY PROJECT**

This project is **NOT open source**. It is proprietary software under active development for commercial deployment.

- ❌ **Not licensed for public use, distribution, or modification**
- ✅ **For portfolio/internship evaluation purposes only**
- 📧 Contact for licensing inquiries: riyamehers@gmail.com

See [LICENSE](LICENSE) for full terms.

---

## Contributing

This is a proprietary project. See [CONTRIBUTING.md](CONTRIBUTING.md) for details on collaboration.

---

## References & Resources

- [Ollama Documentation](https://ollama.ai)
- [Mistral AI Model Card](https://huggingface.co/mistralai/Mistral-7B)
- [React Native Documentation](https://reactnative.dev/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [D&D 5e Ruleset](https://www.dndbeyond.com/)

---

## Contact

📧 **Questions or opportunities:** riyamehers@gmail.com

---

**Made with ❤️ by EuphoRiya37**
