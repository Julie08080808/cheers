# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multiplayer party drinking game system running on Raspberry Pi with hardware pump controls. The game supports multiple players, turn-based gameplay with dice rolls, questions (Truth/Dare/LSA), and automated drink dispensing through GPIO-controlled pumps.

**Tech Stack:**
- Backend: FastAPI (Python)
- Frontend: Vanilla JavaScript with HTML/CSS
- Hardware: Raspberry Pi with GPIO-controlled pumps (4 pumps via L298N motor drivers)
- Deployment: Docker (ARM64)

## Development Commands

### Running the Application

```bash
# Start the FastAPI server (development mode with auto-reload)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Or run directly
python main.py
```

### Docker Commands

```bash
# Build the Docker image (ARM64)
docker build -t party-game .

# Run the container with GPIO access
docker run --privileged -p 8000:8000 party-game

# Run with volume mounting for development
docker run --privileged -p 8000:8000 -v /home/pi/final_project:/app party-game
```

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Note: RPi.GPIO requires root permissions or user in gpio group
sudo usermod -a -G gpio $USER
```

## Architecture

### Core Components

**main.py** - FastAPI application with game room management
- `GameRoom` class: Manages multiplayer game state, player queue, turn order, scoring
- `Player` class: Tracks player info and heartbeat for connection management
- RESTful API endpoints for room management, game actions, and hardware control
- Polls for inactive players (10-minute timeout)
- Supports both "family" and "drunk" game modes

**game_logic.py** - Pure game rule engine (hardware-agnostic)
- `resolve_game_event()`: Maps game events to pump actions (pump_id + duration)
- Defines rules for both game modes (different durations/scoring thresholds)
- Events: `game_start`, `score`, `after_drink`
- Returns decision dictionaries with pump instructions

**pump_controller.py** - Hardware abstraction layer
- `PumpController` class: GPIO control for 4 pumps
- Auto-detects simulation mode if RPi.GPIO unavailable
- Each pump has 2 GPIO pins (IN1/IN2) for L298N motor driver control
- Emergency stop functionality for all pumps

**db.py** - Question database
- Static lists of Truth, Dare, and LSA (Linux System Administration) questions
- LSA questions include multiple choice with answers

**PartyGame/** - Frontend static files
- Multi-page SPA: index.html (landing) → mode.html → setup.html (room) → game.html
- script.js: Client-side game logic, WebSocket-style polling, wheel animation
- Polling-based synchronization (no WebSockets)

### Game Flow Architecture

1. **Room Setup Phase** (setup.html)
   - Players join via `/api/room/join` (returns player_id cookie)
   - Host starts game → triggers wheel spin screen
   - Queue system for >6 players (max_players=6, min_players=2)
   - Heartbeat system (`/api/room/heartbeat`) keeps players alive

2. **Wheel Spin Phase** (embedded in game flow)
   - Host calls `/api/wheel/spin` → backend generates random seed
   - All clients sync animation using shared seed + winner_index
   - `/api/wheel/finish` establishes player turn order
   - Wheel uses snapshot of players to prevent mid-spin changes

3. **Game Phase** (game.html)
   - Turn-based: current player rolls dice, gets questions, performs actions
   - Shared game state (all clients see same dice/questions/wine colors)
   - Game modes:
     - **Family Mode**: 5 rounds, highest score wins
     - **Drunk Mode**: First to 3 drinks loses
   - Pump triggering via `/api/game/event` → calls `game_logic.resolve_game_event()`

### Hardware Integration

**GPIO Pin Mapping** (pump_controller.py:22-27):
```
Pump 1: IN1=GPIO22, IN2=GPIO27
Pump 2: IN1=GPIO17, IN2=GPIO4
Pump 3: IN1=GPIO19, IN2=GPIO13
Pump 4: IN1=GPIO6,  IN2=GPIO5
```

**Pump Control Logic:**
- `pump_out(pump_id, duration)`: Activates pump for N seconds
- Motor direction: IN1=HIGH, IN2=LOW (adjust if pumps run backwards)
- Emergency stop sets all pins LOW

**Base Pump System:**
- Each game round randomly selects 1 base pump (base_pump_id) from [1,2,3,4]
- All players use the SAME pump for consistency (set in `/api/game/set-base-wine`)
- Different durations based on game events (0.4-0.7 seconds typical)

### API Design Patterns

**Synchronization Strategy:**
- Client polls `/api/room/state` every 500ms
- Shared state fields (dice_values, current_question, base_wine_color) ensure all clients display same content
- No WebSockets - relies on frequent HTTP polling

**Player Management:**
- player_id stored in HTTP-only cookie
- Heartbeat required every 10 minutes (600s timeout)
- Automatic queue promotion when player leaves

**Turn Management:**
- Only current player (via `current_player_id`) can call turn-ending actions
- `/api/game/next-turn` validates player_id matches current turn

## Key Implementation Details

### Game State Synchronization
The `GameRoom` class maintains authoritative state that syncs to all clients:
- `base_wine_color` + `base_pump_id`: Which pump/color is active
- `dice_values`: Current dice roll [die1, die2]
- `current_question` + `current_answer`: Active question
- `wine_stack`: List of colors added to drink
- `player_scores`: Dict of player_id → score

### Wheel Spin Consistency
Uses seed-based randomization to ensure all clients see identical wheel animation:
1. Backend generates `spin_seed` on `/api/wheel/spin`
2. Calculates `winner_index` using `Random(spin_seed)`
3. Frontend uses same seed for animation synchronization
4. `wheel_candidates` snapshot prevents player list changes during spin

### Event-Driven Pump Control
The `/api/game/event` endpoint is the recommended flow:
```python
POST /api/game/event
{
  "mode": "family",
  "event": "score",
  "score": 7
}
→ Backend calls game_logic.resolve_game_event()
→ Returns pump instructions (pump_id, duration)
→ pump_controller.pump_out() executes
```

Legacy direct pump control exists for testing (`/api/pump/out`, `/api/pump/stop`)

### Question Types
- **Truth**: Personal questions (from db.truth_questions)
- **Dare**: Challenge tasks (from db.dare_questions)
- **LSA**: Linux trivia with multiple choice (from db.lsa_questions)

API endpoints: `/api/truth`, `/api/dare`, `/api/lsa` return random questions

## Common Tasks

### Adding New Game Rules
1. Edit `GAME_RULES` dict in game_logic.py
2. Add score thresholds as tuple keys: `(4, 8): 0.4` means scores 4 or 8 → 0.4s
3. No frontend changes needed (uses `/api/game/event`)

### Adding New Questions
1. Edit arrays in db.py (truth_questions, dare_questions, lsa_questions)
2. LSA questions format: `{"question": "...", "options": [...], "answer": "C"}`

### Testing Pumps Without Game
```bash
curl -X POST http://localhost:8000/api/pump/out \
  -H "Content-Type: application/json" \
  -d '{"player_id": 1, "duration": 2.0}'

# Emergency stop
curl -X POST http://localhost:8000/api/pump/stop \
  -H "Content-Type: application/json" \
  -d '{"player_id": 0}'
```

### Resetting Game State
```bash
# Full room reset (clears all players)
curl -X POST http://localhost:8000/api/room/reset

# Game reset (keeps players, resets scores/rounds)
curl -X POST http://localhost:8000/api/game/reset
```

### Debugging Wheel Issues
Access `/wheel-debug` route for standalone wheel testing UI

## Important Notes

- **GPIO Permissions**: User must be in `gpio` group or run with sudo/root
- **Simulation Mode**: Code auto-detects missing RPi.GPIO and logs actions instead
- **Chinese Comments**: Much of the codebase uses Chinese comments (Traditional Chinese)
- **Static File Serving**: PartyGame folder mounted at root - main.py assumes `../PartyGame/` relative path
- **No Authentication**: Single shared game room, no user accounts
- **Heartbeat Critical**: Clients must poll `/api/room/heartbeat` or get kicked after 10min

## File Structure Context

```
/home/pi/final_project/
├── main.py              # FastAPI app + game room logic
├── game_logic.py        # Pure rule engine (event → pump actions)
├── pump_controller.py   # GPIO hardware control
├── db.py                # Question database
├── requirements.txt     # Python dependencies
├── Dockerfile           # ARM64 container config
└── ../PartyGame/        # Frontend (relative path from main.py)
    ├── index.html       # Landing page
    ├── mode.html        # Mode selection
    ├── setup.html       # Room/lobby
    ├── game.html        # Main game UI
    ├── script.js        # Client game logic
    └── style.css        # Styling
```
