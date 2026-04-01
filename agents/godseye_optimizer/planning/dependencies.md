# Dependencies Configuration for God's Eye Optimizer Agent

## Core Dependencies

### Pydantic AI Setup
```python
from pydantic_ai import Agent, RunContext
from typing import Dict, List, Any, Optional
```

### Code Analysis Dependencies
- `ast`: Python AST parsing for code analysis
- `inspect`: Runtime code inspection
- `sys`: System-level information access
- `os`: File system operations
- `json`: Configuration and data handling

### Performance Monitoring
- `time`: Timing measurements
- `psutil`: System resource monitoring (optional)
- `memory_profiler`: Memory usage analysis (optional)

### Web/Frontend Analysis
- `selenium`: Browser automation for testing (optional)
- `requests`: HTTP client for API analysis
- `beautifulsoup4`: HTML parsing (optional)

## Agent Dependencies Class

```python
class OptimizerDependencies(BaseModel):
    """Dependencies for the God's Eye optimizer agent."""
    
    # File system access
    workspace_root: str = Field(..., description="Root path of the God's Eye project")
    
    # Analysis configuration
    analysis_depth: str = Field(default="comprehensive", description="Depth of analysis: quick/comprehensive")
    target_components: List[str] = Field(default_factory=lambda: ["frontend", "backend"], 
                                        description="Components to analyze")
    
    # Performance thresholds
    min_fps_threshold: int = Field(default=30, description="Minimum acceptable FPS")
    max_memory_mb: int = Field(default=500, description="Maximum memory usage in MB")
    
    # Output configuration
    output_format: str = Field(default="markdown", description="Report output format")
    include_code_examples: bool = Field(default=True, description="Include code examples in recommendations")
```

## Environment Variables

Required environment variables:
- `GODEYE_WORKSPACE_PATH`: Path to the God's Eye project root
- `ANALYSIS_MODE`: "development" | "production" | "testing"
- `PROFILING_ENABLED`: "true" | "false"

## Optional Dependencies

For enhanced analysis capabilities:
- `numpy`: Numerical computing for performance metrics
- `pandas`: Data analysis for large datasets
- `matplotlib`: Visualization of performance data
- `pytest`: Testing framework integration

## Configuration Validation

The agent should validate:
- Workspace path exists and contains expected structure
- Required dependencies are available
- Environment variables are properly set
- Target components exist in the workspace

## Error Handling

Handle missing dependencies gracefully:
- Provide clear error messages for missing optional dependencies
- Fall back to basic analysis when advanced tools unavailable
- Log warnings for configuration issues