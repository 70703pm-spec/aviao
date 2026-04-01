#!/usr/bin/env python3
"""Simplified God's Eye Optimizer - Direct analysis without full agent framework."""

import os
import ast
import json
from pathlib import Path
from typing import Dict, List, Any
import time


class GodseyeOptimizer:
    """Simplified optimizer for God's Eye application."""

    def __init__(self, workspace_path: str = "/Users/geisaangeli/Desktop/aviao"):
        self.workspace = Path(workspace_path)
        self.frontend_dir = self.workspace / "frontend" / "src"
        self.backend_dir = self.workspace / "backend" / "src"

    def run_full_analysis(self) -> Dict[str, Any]:
        """Run comprehensive analysis of the application."""
        print("🔍 Running God's Eye Optimization Analysis...")
        print(f"📁 Workspace: {self.workspace}")

        results = {
            "timestamp": time.time(),
            "analysis": {},
            "recommendations": []
        }

        # Analyze frontend
        if self.frontend_dir.exists():
            print("📊 Analyzing frontend code...")
            results["analysis"]["frontend"] = self._analyze_frontend()
        else:
            print("⚠️  Frontend directory not found")

        # Analyze backend
        if self.backend_dir.exists():
            print("📊 Analyzing backend code...")
            results["analysis"]["backend"] = self._analyze_backend()
        else:
            print("⚠️  Backend directory not found")

        # Generate recommendations
        results["recommendations"] = self._generate_recommendations(results["analysis"])

        return results

    def _analyze_frontend(self) -> Dict[str, Any]:
        """Analyze frontend code for issues."""
        analysis = {
            "files_analyzed": 0,
            "issues_found": [],
            "performance_concerns": [],
            "memory_concerns": []
        }

        for root, dirs, files in os.walk(self.frontend_dir):
            for file in files:
                if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                    filepath = Path(root) / file
                    analysis["files_analyzed"] += 1

                    try:
                        issues = self._analyze_react_file(filepath)
                        analysis["issues_found"].extend(issues)
                    except Exception as e:
                        analysis["issues_found"].append({
                            "file": str(filepath),
                            "type": "error",
                            "message": f"Failed to analyze: {str(e)}"
                        })

        return analysis

    def _analyze_backend(self) -> Dict[str, Any]:
        """Analyze backend code for issues."""
        analysis = {
            "files_analyzed": 0,
            "issues_found": [],
            "api_concerns": []
        }

        if self.backend_dir.exists():
            for root, dirs, files in os.walk(self.backend_dir):
                for file in files:
                    if file.endswith(('.js', '.ts')):
                        filepath = Path(root) / file
                        analysis["files_analyzed"] += 1

                        try:
                            with open(filepath, 'r', encoding='utf-8') as f:
                                content = f.read()

                            # Check for common backend issues
                            if "console.log" in content:
                                analysis["issues_found"].append({
                                    "file": str(filepath),
                                    "type": "logging",
                                    "message": "Console.log found in production code"
                                })

                        except Exception as e:
                            analysis["issues_found"].append({
                                "file": str(filepath),
                                "type": "error",
                                "message": f"Failed to analyze: {str(e)}"
                            })

        return analysis

    def _analyze_react_file(self, filepath: Path) -> List[Dict[str, Any]]:
        """Analyze a React file for common issues."""
        issues = []

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Check for React performance issues
            if "function " in content and "export default" in content:
                if "React.memo" not in content and "memo(" not in content:
                    issues.append({
                        "file": str(filepath),
                        "type": "performance",
                        "issue": "Component may benefit from React.memo",
                        "recommendation": "Wrap component with React.memo to prevent unnecessary re-renders"
                    })

            # Check for inline functions
            if "onClick={() =>" in content or "onChange={() =>" in content:
                issues.append({
                    "file": str(filepath),
                    "type": "performance",
                    "issue": "Inline arrow functions in JSX",
                    "recommendation": "Move functions outside render or use useCallback"
                })

            # Check for missing useEffect cleanup
            if "useEffect" in content and "return () =>" not in content:
                issues.append({
                    "file": str(filepath),
                    "type": "memory",
                    "issue": "useEffect without cleanup function",
                    "recommendation": "Add cleanup function to prevent memory leaks"
                })

            # Check for Three.js optimization opportunities
            if "THREE." in content:
                if "LOD" not in content and "LevelOfDetail" not in content:
                    issues.append({
                        "file": str(filepath),
                        "type": "graphics",
                        "issue": "No Level of Detail (LOD) system detected",
                        "recommendation": "Implement LOD for better performance with distant objects"
                    })

        except Exception as e:
            issues.append({
                "file": str(filepath),
                "type": "error",
                "message": f"Analysis failed: {str(e)}"
            })

        return issues

    def _generate_recommendations(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate prioritized recommendations from analysis."""
        recommendations = []

        # Frontend recommendations
        if "frontend" in analysis:
            frontend = analysis["frontend"]

            # Performance recommendations
            perf_issues = [i for i in frontend.get("issues_found", [])
                          if i.get("type") == "performance"]
            if perf_issues:
                recommendations.append({
                    "priority": "high",
                    "category": "performance",
                    "title": "Optimize React Component Rendering",
                    "description": f"Found {len(perf_issues)} performance issues in components",
                    "actions": [
                        "Add React.memo to functional components",
                        "Use useCallback for event handlers",
                        "Implement proper dependency arrays in useEffect"
                    ],
                    "estimated_impact": "20-40% improvement in render performance"
                })

            # Memory recommendations
            memory_issues = [i for i in frontend.get("issues_found", [])
                           if i.get("type") == "memory"]
            if memory_issues:
                recommendations.append({
                    "priority": "high",
                    "category": "memory",
                    "title": "Fix Memory Leaks",
                    "description": f"Found {len(memory_issues)} potential memory leaks",
                    "actions": [
                        "Add cleanup functions to useEffect hooks",
                        "Properly dispose of Three.js objects",
                        "Use WeakMap for caching large objects"
                    ],
                    "estimated_impact": "Reduce memory usage by 30-50%"
                })

            # Graphics recommendations
            graphics_issues = [i for i in frontend.get("issues_found", [])
                             if i.get("type") == "graphics"]
            if graphics_issues:
                recommendations.append({
                    "priority": "medium",
                    "category": "graphics",
                    "title": "Optimize 3D Rendering",
                    "description": f"Found {len(graphics_issues)} graphics optimization opportunities",
                    "actions": [
                        "Implement Level of Detail (LOD) system",
                        "Add frustum culling for off-screen objects",
                        "Use texture compression and mipmaps",
                        "Implement object pooling for frequently created objects"
                    ],
                    "estimated_impact": "50-70% improvement in frame rates"
                })

        # Backend recommendations
        if "backend" in analysis:
            backend = analysis["backend"]

            logging_issues = [i for i in backend.get("issues_found", [])
                            if i.get("type") == "logging"]
            if logging_issues:
                recommendations.append({
                    "priority": "low",
                    "category": "logging",
                    "title": "Clean Up Debug Logging",
                    "description": f"Found {len(logging_issues)} console.log statements",
                    "actions": [
                        "Replace console.log with proper logging library",
                        "Remove debug logs from production code",
                        "Use structured logging with log levels"
                    ],
                    "estimated_impact": "Improved production monitoring"
                })

        return recommendations

    def generate_report(self, results: Dict[str, Any]) -> str:
        """Generate a formatted markdown report."""
        lines = [
            "# God's Eye Optimization Report",
            f"**Analysis Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"**Workspace:** {self.workspace}",
            ""
        ]

        # Summary
        total_issues = 0
        for component, data in results.get("analysis", {}).items():
            issues = data.get("issues_found", [])
            total_issues += len(issues)
            lines.extend([
                f"## {component.title()} Analysis",
                f"- Files analyzed: {data.get('files_analyzed', 0)}",
                f"- Issues found: {len(issues)}",
                ""
            ])

        lines.extend([
            f"## Summary",
            f"Total issues found: {total_issues}",
            ""
        ])

        # Recommendations
        recommendations = results.get("recommendations", [])
        if recommendations:
            lines.append("## Recommendations")
            lines.append("")

            for i, rec in enumerate(recommendations, 1):
                lines.extend([
                    f"### {i}. {rec['title']} ({rec['priority']} priority)",
                    f"**Category:** {rec['category']}",
                    f"**Description:** {rec['description']}",
                    f"**Estimated Impact:** {rec.get('estimated_impact', 'TBD')}",
                    "",
                    "**Actions:**"
                ])

                for action in rec.get("actions", []):
                    lines.append(f"- {action}")

                lines.append("")

        # Detailed issues
        for component, data in results.get("analysis", {}).items():
            issues = data.get("issues_found", [])
            if issues:
                lines.extend([
                    f"## {component.title()} Issues",
                    ""
                ])

                for issue in issues:
                    lines.extend([
                        f"### {issue.get('file', 'Unknown file')}",
                        f"- **Type:** {issue.get('type', 'unknown')}",
                        f"- **Issue:** {issue.get('issue', issue.get('message', 'Unknown issue'))}",
                        f"- **Recommendation:** {issue.get('recommendation', 'N/A')}",
                        ""
                    ])

        return "\n".join(lines)


def main():
    """Main CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="God's Eye Optimizer - Analyze and optimize the flight tracking application"
    )

    parser.add_argument(
        "--workspace", "-w",
        default="/Users/geisaangeli/Desktop/aviao",
        help="Path to God's Eye workspace root"
    )

    parser.add_argument(
        "--output", "-o",
        help="Output file for the report"
    )

    args = parser.parse_args()

    # Validate workspace
    if not Path(args.workspace).exists():
        print(f"❌ Error: Workspace path does not exist: {args.workspace}")
        return 1

    try:
        # Run analysis
        optimizer = GodseyeOptimizer(args.workspace)
        results = optimizer.run_full_analysis()

        # Generate report
        report = optimizer.generate_report(results)

        if args.output:
            with open(args.output, 'w') as f:
                f.write(report)
            print(f"✅ Analysis complete! Report saved to: {args.output}")
        else:
            print("\n" + "="*80)
            print(report)
            print("="*80)

        return 0

    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        return 1


if __name__ == "__main__":
    exit(main())