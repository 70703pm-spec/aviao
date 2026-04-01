"""Dependencies for the God's Eye Optimizer Agent."""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import os


class OptimizerDependencies(BaseModel):
    """Dependencies for the God's Eye optimizer agent."""
    
    # Workspace access
    workspace_root: str = Field(..., description="Root path of the God's Eye project")
    
    # Analysis configuration
    analysis_depth: str = Field(default="comprehensive", description="Analysis depth level")
    target_components: List[str] = Field(default_factory=lambda: ["frontend", "backend"], 
                                        description="Components to analyze")
    
    # Performance thresholds
    min_fps_threshold: int = Field(default=30, description="Minimum acceptable FPS")
    max_memory_mb: int = Field(default=500, description="Maximum memory usage in MB")
    max_api_latency_ms: int = Field(default=1000, description="Maximum API latency in ms")
    
    # Output configuration
    output_format: str = Field(default="markdown", description="Report output format")
    include_code_examples: bool = Field(default=True, description="Include code examples in recommendations")
    max_recommendations: int = Field(default=10, description="Maximum recommendations to generate")
    
    # Session tracking
    session_id: Optional[str] = Field(default=None, description="Analysis session identifier")
    analysis_history: List[Dict[str, Any]] = Field(default_factory=list, 
                                                  description="History of previous analyses")


def create_optimizer_dependencies(workspace_root: Optional[str] = None) -> OptimizerDependencies:
    """
    Create optimizer dependencies with sensible defaults.
    
    Args:
        workspace_root: Optional workspace root path override
    
    Returns:
        Configured OptimizerDependencies instance
    """
    from .settings import settings
    
    root_path = workspace_root or settings.workspace_root
    
    if not os.path.exists(root_path):
        raise ValueError(f"Workspace root path does not exist: {root_path}")
    
    return OptimizerDependencies(
        workspace_root=root_path,
        analysis_depth=settings.analysis_depth,
        target_components=settings.target_components,
        min_fps_threshold=settings.min_fps_threshold,
        max_memory_mb=settings.max_memory_mb,
        max_api_latency_ms=settings.max_api_latency_ms,
        output_format=settings.output_format,
        include_code_examples=settings.include_code_examples,
        max_recommendations=settings.max_recommendations,
    )