"""Configuration settings for the God's Eye Optimizer Agent."""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration settings for the optimizer agent."""
    
    # Workspace Configuration
    workspace_root: str = Field(default="/Users/geisaangeli/Desktop/aviao", 
                               description="Root path of the God's Eye project")
    
    # Analysis Configuration
    analysis_depth: str = Field(default="comprehensive", 
                               description="Analysis depth: quick/comprehensive")
    target_components: List[str] = Field(default_factory=lambda: ["frontend", "backend", "database"], 
                                        description="Components to analyze")
    
    # Performance Thresholds
    min_fps_threshold: int = Field(default=30, description="Minimum acceptable FPS")
    max_memory_mb: int = Field(default=500, description="Maximum memory usage in MB")
    max_api_latency_ms: int = Field(default=1000, description="Maximum API latency in milliseconds")
    
    # Output Configuration
    output_format: str = Field(default="markdown", description="Report output format")
    include_code_examples: bool = Field(default=True, description="Include code examples")
    max_recommendations: int = Field(default=10, description="Maximum recommendations per analysis")
    
    # LLM Configuration (default to Ollama)
    llm_provider: str = Field(default="ollama")
    llm_api_key: Optional[str] = Field(default="ollama")
    llm_model: str = Field(default="qwen3")
    llm_base_url: str = Field(default="http://localhost:11434/v1")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()