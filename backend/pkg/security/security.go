package security

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type PolicyLevel string

const (
	PolicyStrict   PolicyLevel = "strict"
	PolicySafeAuto PolicyLevel = "safe-auto"
	PolicyFullAuto PolicyLevel = "full-auto"
)

type OperationCategory string

const (
	OpNetworkRead    OperationCategory = "network_read"
	OpPackageInstall OperationCategory = "package_install"
	OpGitFetch       OperationCategory = "git_fetch"
	OpGitPush        OperationCategory = "git_push"
	OpArbitraryUpload OperationCategory = "arbitrary_upload"
	OpRemoteExec     OperationCategory = "remote_execution"
	OpOutsideAccess  OperationCategory = "outside_workspace_access"
)

type ApprovalRequest struct {
	ID           string            `json:"id"`
	WorkspaceID  string            `json:"workspaceId"`
	RunID        string            `json:"runId,omitempty"`
	Tool         string            `json:"tool"`
	Command      string            `json:"command,omitempty"`
	Path         string            `json:"path,omitempty"`
	Reason       string            `json:"reason"`
	Category     OperationCategory `json:"category"`
	Status       string            `json:"status"` // pending, approved, rejected
	CreatedAt    string            `json:"createdAt"`
}

type SecurityManager struct {
	mu                 sync.RWMutex
	defaultPolicy      PolicyLevel
	allowRoot          bool
	rootWarningAccepted bool
	pendingApprovals   map[string]*ApprovalRequest
	outsidePermissions map[string]map[string]bool // workspace -> canonical path -> permitted
}

var SensitiveRootDirs = []string{
	"/", "/etc", "/usr", "/bin", "/sbin", "/boot", "/proc", "/sys", "/dev", "/run",
}

var SensitiveHomePaths = []string{
	".ssh", ".gnupg", ".config", ".local/share/keyrings", ".aws", ".kube",
}

func NewSecurityManager(defaultPolicy string, allowRoot bool) *SecurityManager {
	pol := PolicySafeAuto
	if defaultPolicy == "strict" {
		pol = PolicyStrict
	} else if defaultPolicy == "full-auto" {
		pol = PolicyFullAuto
	}

	return &SecurityManager{
		defaultPolicy:      pol,
		allowRoot:          allowRoot,
		pendingApprovals:   make(map[string]*ApprovalRequest),
		outsidePermissions: make(map[string]map[string]bool),
	}
}

func (s *SecurityManager) CheckRootPermission() error {
	if os.Geteuid() == 0 && !s.allowRoot {
		return fmt.Errorf("CRITICAL SECURITY ERROR: backend running as root without --allow-root flag")
	}
	return nil
}

func (s *SecurityManager) RequiresApproval(workspacePath string, tool string, cmd string, path string) (bool, OperationCategory, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Outside workspace check
	if path != "" {
		rel, err := filepath.Rel(workspacePath, path)
		if err != nil || strings.HasPrefix(rel, "..") {
			// Path is outside workspace
			for _, sensitive := range SensitiveRootDirs {
				if path == sensitive {
					return true, OpOutsideAccess, fmt.Sprintf("Access to sensitive root directory '%s' requires explicit approval", path)
				}
			}
			for _, sensitiveHome := range SensitiveHomePaths {
				if strings.Contains(path, sensitiveHome) {
					return true, OpOutsideAccess, fmt.Sprintf("Access to sensitive security directory '%s' requires elevated approval", sensitiveHome)
				}
			}
			return true, OpOutsideAccess, fmt.Sprintf("Access to path '%s' outside workspace requires approval", path)
		}
	}

	// Command / Tool checks
	lowerCmd := strings.ToLower(cmd)
	if strings.Contains(lowerCmd, "git push") {
		return true, OpGitPush, "Git push command alters remote repository state"
	}
	if strings.Contains(lowerCmd, "git commit") {
		return true, OpGitPush, "Git commit alters version history"
	}
	if strings.Contains(lowerCmd, "curl | sh") || strings.Contains(lowerCmd, "wget | sh") || strings.Contains(lowerCmd, "curl | bash") {
		return true, OpRemoteExec, "Piping network download directly into shell execution is high risk"
	}

	if s.defaultPolicy == PolicyStrict {
		return true, OpRemoteExec, "Strict policy requires approval for all commands"
	}

	return false, "", ""
}

func (s *SecurityManager) RegisterApproval(req *ApprovalRequest) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pendingApprovals[req.ID] = req
}

func (s *SecurityManager) ResolveApproval(id string, approved bool) (*ApprovalRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	req, exists := s.pendingApprovals[id]
	if !exists {
		return nil, fmt.Errorf("approval request %s not found", id)
	}

	if approved {
		req.Status = "approved"
	} else {
		req.Status = "rejected"
	}

	return req, nil
}
