#!/usr/bin/env python3
"""
Test runner for the social pipeline.
Provides easy commands to run different test suites.
"""
import sys
import subprocess
import argparse
from pathlib import Path

def run_command(cmd):
    """Run a command and return exit code."""
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True)
    return result.returncode

def main():
    parser = argparse.ArgumentParser(description="Run social pipeline tests")
    parser.add_argument(
        "suite",
        nargs="?",
        default="all",
        choices=["all", "unit", "integration", "e2e", "coverage"],
        help="Test suite to run (default: all)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "-x", "--exitfirst",
        action="store_true",
        help="Exit on first failure"
    )
    parser.add_argument(
        "-k", "--keyword",
        help="Run tests matching keyword"
    )
    parser.add_argument(
        "--slow",
        action="store_true",
        help="Include slow tests"
    )
    
    args = parser.parse_args()
    
    # Base pytest command
    cmd_parts = ["pytest"]
    
    # Add verbosity
    if args.verbose:
        cmd_parts.append("-vv")
    else:
        cmd_parts.append("-v")
    
    # Add exit on first failure
    if args.exitfirst:
        cmd_parts.append("-x")
    
    # Add keyword filter
    if args.keyword:
        cmd_parts.append(f"-k {args.keyword}")
    
    # Skip slow tests unless requested
    if not args.slow:
        cmd_parts.append("-m 'not slow'")
    
    # Select test suite
    if args.suite == "unit":
        cmd_parts.append("tests/unit/")
        print("🧪 Running unit tests...")
    elif args.suite == "integration":
        cmd_parts.append("tests/integration/")
        print("🔗 Running integration tests...")
    elif args.suite == "e2e":
        cmd_parts.append("tests/e2e/")
        print("🚀 Running end-to-end tests...")
    elif args.suite == "coverage":
        cmd_parts = ["pytest", "--cov=.", "--cov-report=html", "--cov-report=term-missing"]
        print("📊 Running tests with coverage...")
    else:
        print("🧪 Running all tests...")
    
    # Build final command
    cmd = " ".join(cmd_parts)
    
    # Run tests
    exit_code = run_command(cmd)
    
    if args.suite == "coverage" and exit_code == 0:
        print("\n📊 Coverage report generated in htmlcov/index.html")
        print("Open with: open htmlcov/index.html")
    
    return exit_code

if __name__ == "__main__":
    sys.exit(main())