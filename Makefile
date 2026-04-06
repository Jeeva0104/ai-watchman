.PHONY: help build build-dev up dev down logs clean test shell db-shell pull status monitoring-logs

# Default target
help:
	@echo "AI Watchman - Docker Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build          Build all production images"
	@echo "  build-dev      Build development images"
	@echo "  up             Start production stack (includes monitoring)"
	@echo "  dev            Start development stack"
	@echo "  down           Stop all containers"
	@echo "  logs           View container logs"
	@echo "  clean          Remove containers, volumes, images, and ALL data"
	@echo "  test           Run tests"
	@echo "  shell          Open shell in backend container"
	@echo "  db-shell       Open SQLite shell"
	@echo "  pull           Pull latest base images"
	@echo "  status         Show container status"
	@echo ""
	@echo "Monitoring:"
	@echo "  monitoring-logs View Prometheus/Grafana logs"

# Build production images
build:
	docker compose build

# Build development images
build-dev:
	docker compose -f docker-compose.dev.yml build

# Start production stack
up:
	docker compose up -d
	@echo ""
	@echo "AI Watchman is running:"
	@echo "  Frontend:   http://localhost"
	@echo "  Backend:    http://localhost:4990"
	@echo "  Grafana:    http://localhost:3001 (admin/watchman)"
	@echo "  Prometheus: http://localhost:9090"

# Start development stack
dev:
	docker compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "Development server running:"
	@echo "  Frontend:   http://localhost:3000"
	@echo "  Backend:    http://localhost:4990"
	@echo "  Grafana:    http://localhost:3001 (admin/watchman)"
	@echo "  Prometheus: http://localhost:9090"

# Stop all containers
down:
	docker compose down
	@docker compose -f docker-compose.dev.yml down 2>/dev/null || true

# View logs
logs:
	docker compose logs -f

# Clean up everything (with confirmation)
clean:
	@echo ""
	@echo "⚠️  WARNING: This will delete ALL data including:"
	@echo "   - Docker containers and volumes"
	@echo "   - Database files (watchman.db)"
	@echo "   - Built images"
	@echo ""
	@read -p "Continue? [y/N]: " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo ""
	docker compose down -v --rmi local 2>/dev/null || true
	docker compose -f docker-compose.dev.yml down -v --rmi local 2>/dev/null || true
	docker system prune -f
	@rm -rf ./data/*.db ./data/*.db-wal ./data/*.db-shm 2>/dev/null || true
	@echo ""
	@echo "✓ Cleanup complete"

# Run tests
test:
	cd web && npm test

# Open shell in backend container
shell:
	docker compose exec backend sh

# Open SQLite shell
db-shell:
	docker compose exec backend sqlite3 /data/watchman.db

# Pull latest images
pull:
	docker compose pull

# Show status
status:
	@docker compose ps 2>/dev/null || echo "No containers running"

# View monitoring logs
monitoring-logs:
	docker compose logs -f prometheus grafana
