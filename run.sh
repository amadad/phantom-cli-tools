#!/bin/bash
# Simple run script for Agent Social

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default action
ACTION=${1:-run}

case $ACTION in
    # Run once with default settings
    run)
        echo "🚀 Running Agent Social pipeline..."
        uv run python main.py "${@:2}"
        ;;
    
    # Run v2 with enhancements
    run-v2)
        echo "🚀 Running Agent Social v2 (enhanced)..."
        uv run python main_v2.py "${@:2}"
        ;;
    
    # Run with specific topic
    test)
        echo "🧪 Testing Agent Social with sample content..."
        uv run python main.py --topic "caregiving tips for the holidays" --no-stories
        ;;
    
    # Test v2
    test-v2)
        echo "🧪 Testing Agent Social v2 with enhancements..."
        uv run python main_v2.py --topic "caregiving tips for the holidays"
        ;;
    
    # Run scheduler
    schedule)
        echo "📅 Starting Agent Social scheduler (every 6 hours)..."
        uv run python main.py --schedule 6
        ;;
    
    # Run v2 scheduler
    schedule-v2)
        echo "📅 Starting Agent Social v2 scheduler with TRELLIS..."
        uv run python main_v2.py --schedule 6
        ;;
    
    # Docker commands
    docker-build)
        echo "🐳 Building Docker image..."
        docker build -t agent-social:latest .
        ;;
    
    docker-run)
        echo "🐳 Running in Docker..."
        docker run --rm --env-file .env -v $(pwd)/output:/app/output agent-social:latest "${@:2}"
        ;;
    
    docker-schedule)
        echo "🐳 Running scheduler in Docker..."
        docker-compose --profile scheduler up -d
        ;;
    
    docker-logs)
        echo "📋 Showing Docker logs..."
        docker-compose --profile scheduler logs -f
        ;;
    
    docker-stop)
        echo "🛑 Stopping Docker services..."
        docker-compose --profile scheduler down
        ;;
    
    # Help
    *)
        echo "Agent Social - Run Script"
        echo "========================"
        echo ""
        echo "Usage: ./run.sh [command] [options]"
        echo ""
        echo "Commands:"
        echo "  run          Run pipeline once (v1 - stable)"
        echo "  run-v2       Run pipeline once (v2 - enhanced)"
        echo "  test         Test with sample content (v1)"
        echo "  test-v2      Test with sample content (v2)"
        echo "  schedule     Run scheduler (v1)"
        echo "  schedule-v2  Run scheduler with TRELLIS (v2)"
        echo ""
        echo "Docker commands:"
        echo "  docker-build    Build Docker image"
        echo "  docker-run      Run in Docker once"
        echo "  docker-schedule Start scheduler in Docker"
        echo "  docker-logs     Show Docker logs"
        echo "  docker-stop     Stop Docker services"
        echo ""
        echo "Examples:"
        echo "  ./run.sh run --topic 'self-care tips'"
        echo "  ./run.sh run-v2 --topic 'self-care tips' --no-trellis"
        echo "  ./run.sh test-v2"
        echo "  ./run.sh docker-schedule"
        ;;
esac