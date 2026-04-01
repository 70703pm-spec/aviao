#!/usr/bin/env python3
"""CLI interface for the God's Eye Optimizer Agent."""

import asyncio
import argparse
import sys
from pathlib import Path

# Add the agent directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from agent import run_full_analysis, optimize_component, generate_optimization_report
from dependencies import create_optimizer_dependencies


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="God's Eye Optimizer - Analyze and optimize the flight tracking application"
    )
    
    parser.add_argument(
        "--workspace",
        "-w",
        default="/Users/geisaangeli/Desktop/aviao",
        help="Path to God's Eye workspace root"
    )
    
    parser.add_argument(
        "--depth",
        "-d",
        choices=["quick", "comprehensive"],
        default="comprehensive",
        help="Analysis depth level"
    )
    
    parser.add_argument(
        "--component",
        "-c",
        choices=["frontend", "backend", "database", "all"],
        default="all",
        help="Specific component to analyze"
    )
    
    parser.add_argument(
        "--issue-type",
        "-i",
        choices=["performance", "graphics", "memory", "crashes", "ui"],
        help="Specific issue type to focus on"
    )
    
    parser.add_argument(
        "--output",
        "-o",
        help="Output file for the report"
    )
    
    args = parser.parse_args()
    
    # Validate workspace
    if not Path(args.workspace).exists():
        print(f"Error: Workspace path does not exist: {args.workspace}")
        sys.exit(1)
    
    try:
        if args.issue_type and args.component != "all":
            # Run targeted optimization
            print(f"Running targeted optimization for {args.component} {args.issue_type}...")
            result = asyncio.run(optimize_component(
                component=args.component,
                issue_type=args.issue_type,
                workspace_root=args.workspace
            ))
            
            if args.output:
                with open(args.output, 'w') as f:
                    f.write(str(result))
                print(f"Results saved to: {args.output}")
            else:
                print("Optimization Results:")
                print(result)
                
        else:
            # Run full analysis
            print("Running comprehensive analysis of God's Eye application...")
            print(f"Workspace: {args.workspace}")
            print(f"Analysis depth: {args.depth}")
            print("This may take a few minutes...")
            
            results = asyncio.run(run_full_analysis(
                workspace_root=args.workspace,
                analysis_depth=args.depth
            ))
            
            # Generate report
            report = generate_optimization_report(results)
            
            if args.output:
                with open(args.output, 'w') as f:
                    f.write(report)
                print(f"Analysis report saved to: {args.output}")
            else:
                print("\n" + "="*80)
                print(report)
                print("="*80)
    
    except Exception as e:
        print(f"Error during analysis: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()