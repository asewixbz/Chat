package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Storage   StorageConfig   `yaml:"storage"`
	Workers   WorkersConfig   `yaml:"workers"`
	Terminals TerminalsConfig `yaml:"terminals"`
	Workspace WorkspaceConfig `yaml:"workspace"`
	Agent     AgentConfig     `yaml:"agent"`
	Security  SecurityConfig  `yaml:"security"`
	Git       GitConfig       `yaml:"git"`
	LLM       LLMConfig       `yaml:"llm"`
}

type ServerConfig struct {
	Host          string `yaml:"host"`
	Port          int    `yaml:"port"`
	AuthTokenFile string `yaml:"authTokenFile"`
}

type StorageConfig struct {
	Database     string `yaml:"database"`
	ArtifactsDir string `yaml:"artifactsDir"`
	WorktreesDir string `yaml:"worktreesDir"`
}

type WorkersConfig struct {
	AgentWorkers             int   `yaml:"agentWorkers"`
	CommandWorkers           int   `yaml:"commandWorkers"`
	MaxReadRunsPerWorkspace  int   `yaml:"maxReadRunsPerWorkspace"`
	MaxWriteRunsPerWorkspace int   `yaml:"maxWriteRunsPerWorkspace"`
	HeartbeatIntervalMs      int64 `yaml:"heartbeatIntervalMs"`
	HeartbeatTimeoutMs       int64 `yaml:"heartbeatTimeoutMs"`
	DefaultCommandTimeoutMs  int64 `yaml:"defaultCommandTimeoutMs"`
	DefaultRunTimeoutMs      int64 `yaml:"defaultRunTimeoutMs"`
	MaxRunTimeoutMs          int64 `yaml:"maxRunTimeoutMs"`
}

type TerminalsConfig struct {
	MaxGlobal        int   `yaml:"maxGlobal"`
	MaxPerWorkspace  int   `yaml:"maxPerWorkspace"`
	IdleTimeoutMs    int64 `yaml:"idleTimeoutMs"`
	OutputBufferBytes int  `yaml:"outputBufferBytes"`
}

type WorkspaceConfig struct {
	MaxSizeBytes           int64 `yaml:"maxSizeBytes"`
	MaxFiles               int   `yaml:"maxFiles"`
	MaxSingleTextFileBytes int64 `yaml:"maxSingleTextFileBytes"`
	MaxReadResultBytes     int64 `yaml:"maxReadResultBytes"`
}

type AgentConfig struct {
	MaxSteps             int  `yaml:"maxSteps"`
	MaxToolCalls         int  `yaml:"maxToolCalls"`
	MaxOutputBytes       int64`yaml:"maxOutputBytes"`
	AllowJsonToolFallback bool `yaml:"allowJsonToolFallback"`
}

type SecurityConfig struct {
	DefaultApprovalPolicy             string        `yaml:"defaultApprovalPolicy"`
	AllowNetwork                      bool          `yaml:"allowNetwork"`
	AllowOutsideWorkspaceWithApproval bool          `yaml:"allowOutsideWorkspaceWithApproval"`
	FollowExternalSymlinks            bool          `yaml:"followExternalSymlinks"`
	AllowRoot                         bool          `yaml:"allowRoot"`
	Sandbox                           SandboxConfig `yaml:"sandbox"`
}

type SandboxConfig struct {
	Enabled bool `yaml:"enabled"`
}

type GitConfig struct {
	WorktreesEnabled         bool `yaml:"worktreesEnabled"`
	AutoCommit               bool `yaml:"autoCommit"`
	RequireApprovalForCommit bool `yaml:"requireApprovalForCommit"`
	RequireApprovalForPush   bool `yaml:"requireApprovalForPush"`
	AllowForcePush           bool `yaml:"allowForcePush"`
}

type LLMConfig struct {
	Provider   string `yaml:"provider"`
	Model      string `yaml:"model"`
	DataPolicy string `yaml:"dataPolicy"` // local-only, allow-external, confirm-external
}

func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Host:          "127.0.0.1",
			Port:          8080,
			AuthTokenFile: "~/.config/neurocode/token",
		},
		Storage: StorageConfig{
			Database:     "~/.local/share/neurocode/data.db",
			ArtifactsDir: "~/.local/share/neurocode/artifacts",
			WorktreesDir: "~/.local/share/neurocode/worktrees",
		},
		Workers: WorkersConfig{
			AgentWorkers:             4,
			CommandWorkers:           8,
			MaxReadRunsPerWorkspace:  4,
			MaxWriteRunsPerWorkspace: 2,
			HeartbeatIntervalMs:      5000,
			HeartbeatTimeoutMs:       20000,
			DefaultCommandTimeoutMs:  120000,
			DefaultRunTimeoutMs:      1800000,
			MaxRunTimeoutMs:          14400000,
		},
		Terminals: TerminalsConfig{
			MaxGlobal:         12,
			MaxPerWorkspace:   4,
			IdleTimeoutMs:     3600000,
			OutputBufferBytes: 2097152,
		},
		Workspace: WorkspaceConfig{
			MaxSizeBytes:           524288000, // 500 MB
			MaxFiles:               100000,
			MaxSingleTextFileBytes: 5242880,   // 5 MB
			MaxReadResultBytes:     1048576,
		},
		Agent: AgentConfig{
			MaxSteps:              50,
			MaxToolCalls:          100,
			MaxOutputBytes:        10485760,
			AllowJsonToolFallback: true,
		},
		Security: SecurityConfig{
			DefaultApprovalPolicy:             "safe-auto",
			AllowNetwork:                      true,
			AllowOutsideWorkspaceWithApproval: true,
			FollowExternalSymlinks:            false,
			AllowRoot:                         false,
			Sandbox: SandboxConfig{
				Enabled: false,
			},
		},
		Git: GitConfig{
			WorktreesEnabled:         true,
			AutoCommit:               false,
			RequireApprovalForCommit: true,
			RequireApprovalForPush:   true,
			AllowForcePush:           false,
		},
		LLM: LLMConfig{
			Provider:   "kie",
			Model:      "gpt-5-6-sol",
			DataPolicy: "confirm-external",
		},
	}
}

func LoadConfig(path string) (*Config, error) {
	cfg := DefaultConfig()
	if path == "" {
		return cfg, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return nil, fmt.Errorf("read config file error: %w", err)
	}

	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config error: %w", err)
	}

	return cfg, nil
}
