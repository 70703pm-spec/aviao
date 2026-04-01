"""Main agent implementation for God's Eye Optimizer."""

from pydantic_ai import Agent, RunContext
from typing import Any, Dict, List
import time

from .providers import get_ollama_model
from .dependencies import OptimizerDependencies, create_optimizer_dependencies
from .prompts import MAIN_SYSTEM_PROMPT
from .tools import (
    analyze_codebase,
    profile_performance,
    optimize_graphics,
    detect_bugs,
    analyze_ui_ux
)


# Initialize the optimizer agent with Ollama Qwen
optimizer_agent = Agent(
    get_ollama_model("qwen3"),
    deps_type=OptimizerDependencies,
    system_prompt=MAIN_SYSTEM_PROMPT
)

# Register optimization tools
optimizer_agent.tool(analyze_codebase)
optimizer_agent.tool(profile_performance)
optimizer_agent.tool(optimize_graphics)
optimizer_agent.tool(detect_bugs)
optimizer_agent.tool(analyze_ui_ux)


async def run_full_analysis(
    workspace_root: str = None,
    analysis_depth: str = "comprehensive"
) -> Dict[str, Any]:
    """
    Run a comprehensive analysis of the God's Eye application.
    
    Args:
        workspace_root: Optional workspace root path
        analysis_depth: Depth of analysis ("quick" or "comprehensive")
    
    Returns:
        Complete analysis report
    """
    deps = create_optimizer_dependencies(workspace_root)
    deps.analysis_depth = analysis_depth
    
    start_time = time.time()
    
    # Run various analyses
    results = {
        "timestamp": start_time,
        "analysis_depth": analysis_depth,
        "reports": {}
    }
    
    try:
        # Frontend performance analysis
        if "frontend" in deps.target_components:
            frontend_result = await optimizer_agent.run(
                "Analyze frontend code for performance bottlenecks and rendering issues",
                deps=deps
            )
            results["reports"]["frontend_performance"] = frontend_result.data
            
            # Graphics optimization
            graphics_result = await optimizer_agent.run(
                "Analyze globe rendering and suggest graphics optimizations for better FPS",
                deps=deps
            )
            results["reports"]["graphics_optimization"] = graphics_result.data
            
            # UI/UX analysis
            ui_result = await optimizer_agent.run(
                "Analyze UI responsiveness and suggest UX improvements",
                deps=deps
            )
            results["reports"]["ui_ux_analysis"] = ui_result.data
        
        # Backend analysis
        if "backend" in deps.target_components:
            backend_result = await optimizer_agent.run(
                "Analyze backend code for performance issues and API bottlenecks",
                deps=deps
            )
            results["reports"]["backend_performance"] = backend_result.data
        
        # Bug detection
        bug_result = await optimizer_agent.run(
            "Detect crashes, errors, and broken functionality across the application",
            deps=deps
        )
        results["reports"]["bug_detection"] = bug_result.data
        
    except Exception as e:
        results["error"] = str(e)
    
    results["duration_seconds"] = time.time() - start_time
    
    return results


async def optimize_component(
    component: str,
    issue_type: str,
    workspace_root: str = None
) -> Dict[str, Any]:
    """
    Optimize a specific component for a particular issue type.
    
    Args:
        component: Component to optimize ("frontend", "backend", "database")
        issue_type: Type of issue ("performance", "graphics", "memory", "crashes")
        workspace_root: Optional workspace root path
    
    Returns:
        Optimization recommendations
    """
    deps = create_optimizer_dependencies(workspace_root)
    
    prompt_map = {
        ("frontend", "performance"): "Analyze frontend performance bottlenecks and suggest fixes",
        ("frontend", "graphics"): "Optimize graphics rendering and suggest FPS improvements",
        ("frontend", "memory"): "Identify memory leaks and suggest memory optimizations",
        ("backend", "performance"): "Analyze backend API performance and suggest improvements",
        ("backend", "crashes"): "Detect and fix backend crashes and error handling",
    }
    
    prompt = prompt_map.get((component, issue_type), 
                           f"Analyze {component} for {issue_type} issues and provide solutions")
    
    result = await optimizer_agent.run(prompt, deps=deps)
    
    return {
        "component": component,
        "issue_type": issue_type,
        "recommendations": result.data,
        "timestamp": time.time()
    }


def generate_optimization_report(analysis_results: Dict[str, Any]) -> str:
    """
    Generate a formatted optimization report from analysis results.
    
    Args:
        analysis_results: Results from run_full_analysis
    
    Returns:
        Formatted markdown report
    """
    report_lines = [
        "# God's Eye Optimization Report",
        f"**Analysis Date:** {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(analysis_results.get('timestamp', time.time())))}",
        f"**Analysis Depth:** {analysis_results.get('analysis_depth', 'unknown')}",
        f"**Duration:** {analysis_results.get('duration_seconds', 0):.2f} seconds",
        ""
    ]
    
    if "error" in analysis_results:
        report_lines.extend([
            "## Error",
            f"An error occurred during analysis: {analysis_results['error']}",
            ""
        ])
        return "\n".join(report_lines)
    
    reports = analysis_results.get("reports", {})
    
    # Frontend Performance
    if "frontend_performance" in reports:
        report_lines.extend([
            "## Frontend Performance Analysis",
            str(reports["frontend_performance"]),
            ""
        ])
    
    # Graphics Optimization
    if "graphics_optimization" in reports:
        report_lines.extend([
            "## Graphics Optimization Recommendations",
            str(reports["graphics_optimization"]),
            ""
        ])
    
    # UI/UX Analysis
    if "ui_ux_analysis" in reports:
        report_lines.extend([
            "## UI/UX Improvements",
            str(reports["ui_ux_analysis"]),
            ""
        ])
    
    # Backend Performance
    if "backend_performance" in reports:
        report_lines.extend([
            "## Backend Performance Analysis",
            str(reports["backend_performance"]),
            ""
        ])
    
    # Bug Detection
    if "bug_detection" in reports:
        report_lines.extend([
            "## Bug Detection Results",
            str(reports["bug_detection"]),
            ""
        ])
    
    report_lines.extend([
        "## Summary",
        "This report provides prioritized recommendations to improve God's Eye application performance,",
        "graphics quality, and overall user experience. Implement changes starting with high-impact items.",
        ""
    ])
    
    return "\n".join(report_lines)