# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"醉加損友" (Cheers) is a drinking game application with two game modes:
- **闔家歡模式 (Family Mode)**: Score-based game with 5 rounds
- **無乃酒鬼模式 (Alcoholic Mode)**: Direct elimination - first to drink 3 cups loses

The project has a **branch-based architecture** with separate branches for frontend and backend:
- `main`: Empty base branch
- `frontend`: Contains the complete game UI (single HTML file)
- `backend`: Contains Python backend structure (placeholder files)

## Branch Architecture

### Frontend Branch (`frontend`)
Contains a complete, self-contained single-page application:
- **File**: `game.html` - Standalone HTML file with embedded CSS and JavaScript
- **Assets**: `wine.png`, `quetion.png` - Game images
- **Tech Stack**: Vanilla JavaScript, HTML5 Canvas for wheel animation, CSS3 with gradient effects

The frontend is fully functional and does not require a build process. Simply open `game.html` in a browser.

### Backend Branch (`backend`)
Contains Python backend structure (currently placeholder files):
```
backend/
├── main.py              # Entry point
├── model/
│   └── player.py        # Player data model
├── service/
│   ├── dice.py          # Dice rolling logic
│   ├── game_mode.py     # Game mode handlers
│   └── score.py         # Score management
├── route/
│   ├── game.py          # Game API routes
│   └── player.py        # Player API routes
└── util/
    └── question.py      # LSA questions utility
```

**Note**: All Python files in the backend branch are currently empty placeholders defining the intended architecture.

## Game Mechanics

### Core Components
1. **Wheel Selection**: HTML5 Canvas-based spinning wheel for turn order
2. **Dice System**: Two dice with visual 3x3 grid representation
3. **Base Wine System**: Color-coded wine stack (red/blue/yellow) that accumulates during gameplay
4. **Event System**: Different events trigger based on dice sum (3-11) or doubles

### Game Modes

**Family Mode (闔家歡)**:
- 5 rounds, score-based
- Events: LSA quiz questions (3,5), random color addition (4,8), rock-paper-scissors (6), player choice (7), drink & reset (9 or doubles), truth or dare (10,11)

**Alcoholic Mode (無乃酒鬼)**:
- No round limit, first to 3 drinks loses
- Events: "Never Have I Ever" (3), random color (4,8), arm wrestling (5), rock-paper-scissors (6), player choice (7), dragon gate card game (9), drink on doubles, truth or dare (10,11)

## Development Workflow

### Working with Branches

To work on frontend:
```bash
git checkout frontend
# Open game.html in browser to test
```

To work on backend:
```bash
git checkout backend
# Backend files are currently empty - implementation needed
```

### Frontend Modifications
- All frontend code is in a single `game.html` file
- No build process or dependencies required
- CSS uses CSS custom properties (`:root` variables) for theming
- JavaScript uses vanilla ES5+ syntax
- Modal system for game events uses `.modal-overlay` and `.modal-content` classes

### Backend Implementation Notes
When implementing the backend:
- Consider adding `requirements.txt` for Python dependencies
- Likely dependencies: Flask/FastAPI for API routes
- The structure suggests RESTful API design with separate routes for game and player management
- Models should handle player state and game state persistence

## Code Style Observations

### Frontend
- Chinese language UI (Traditional Chinese - zh-TW)
- Neon/gradient aesthetic with custom CSS properties
- Event-driven architecture with global state variables
- Functions follow camelCase naming convention
- Modal-based user interactions for game events
