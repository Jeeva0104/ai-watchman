# AI Watchman

A real-time monitoring dashboard for AI agent events with WebSocket streaming, Prometheus metrics, and Grafana visualization.

## Features

- **Real-time Event Streaming** - WebSocket-based live event feed
- **Session Tracking** - Monitor agent sessions and their lifecycle
- **Tool Call Monitoring** - Track tool usage and performance
- **Metrics & Observability** - Built-in Prometheus and Grafana integration
- **Docker Ready** - Full containerized deployment with one command

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)
- Node.js 20+ (for local development without Docker)

## Quick Start (Docker)

```bash
# Clone the repository
git clone https://github.com/Jeeva0104/ai-watchman.git
cd ai-watchman

# Build and start all services
make build
make up
```

That's it! All services will be running.

## URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost | Main dashboard UI |
| **Backend API** | http://localhost:4990 | REST API and WebSocket endpoint |
| **Grafana** | http://localhost:3001 | Metrics dashboards |
| **Prometheus** | http://localhost:9090 | Metrics database |

### Grafana Credentials

- **Username:** `admin`
- **Password:** `watchman`

## Installation

### Option 1: Docker (Recommended)

**Production Stack:**
```bash
# Build images
make build

# Start all services (frontend, backend, prometheus, grafana)
make up

# View logs
make logs

# Stop services
make down
```

**Development Stack:**
```bash
# Build development images
make build-dev

# Start with hot reload
make dev

# Frontend dev server: http://localhost:3000
# Backend: http://localhost:4990
```

### Option 2: Local Development (No Docker)

**Backend:**
```bash
cd service
npm install
npm run dev    # Development with hot reload
# or
npm run build && npm start  # Production
```

**Frontend:**
```bash
cd web
npm install
npm run dev    # Development server at http://localhost:3000
npm run build  # Production build
```

## Configuration

Environment variables can be set in a `.env` file (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `80` | Frontend port |
| `GRAFANA_PORT` | `3001` | Grafana web UI port |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `watchman` | Grafana admin password |
| `VERBOSE` | `false` | Enable verbose logging |

## Makefile Commands

```bash
make help          # Show all available commands
make build         # Build production Docker images
make build-dev     # Build development Docker images
make up            # Start production stack
make dev           # Start development stack
make down          # Stop all containers
make logs          # View container logs
make status        # Show container status
make test          # Run tests
make shell         # Open shell in backend container
make db-shell      # Open SQLite shell
make clean         # Remove all containers, volumes, and data
make setup-hooks   # Generate hooks config for a project
```

## Configure Hooks for Your Project

To send Claude Code events from another project to AI Watchman:

```bash
# Generate hooks config for your project
make setup-hooks PROJECT_SLUG=my-project

# With custom API URL (if AI Watchman is on a different host)
make setup-hooks PROJECT_SLUG=my-project API_URL=http://192.168.1.100:4990
```

Copy the generated JSON and add it to your project's `.claude/settings.json`:

```json
{
  "env": {
    "AI_WATCHMAN_PROJECT_SLUG": "my-project",
    "AI_WATCHMAN_API_URL": "http://localhost:4990"
  },
  "hooks": {
    "SessionStart": [...],
    "PostToolUse": [...],
    ...
  }
}
```

### How It Works

```
Claude Code Hooks → hook.sh → cli.mjs → AI Watchman API → Dashboard
```

The hook runner (`hook.sh`) is non-blocking - it backgrounds the CLI and exits in ~2-5ms, so your Claude Code session won't be delayed.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   SQLite    │
│   (React)   │     │  (Fastify)  │     │  Database   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ Prometheus  │────▶│   Grafana   │
                    │  (metrics)  │     │ (dashboards)│
                    └─────────────┘     └─────────────┘
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Health check |
| `/events` | GET | List events (paginated) |
| `/events/stream` | WS | WebSocket event stream |
| `/sessions` | GET | List sessions |
| `/metrics` | GET | Prometheus metrics |

## Repository

- **GitHub:** https://github.com/Jeeva0104/ai-watchman

## License

MIT
