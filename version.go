package main

// Version information injected at build time via -ldflags
// Example: -X main.Version=0.1.0 -X main.BuildTime=2026-01-06_10:30:00 -X main.GitCommit=abc123
// For development builds without ldflags, these show default values
var (
	Version   = "dev"
	BuildTime = "unknown"
	GitCommit = "unknown"
)
