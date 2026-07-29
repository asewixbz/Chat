package git

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type GitStatusFile struct {
	Path   string `json:"path"`
	Status string `json:"status"` // modified, added, deleted, untracked, staged
}

type GitInfo struct {
	Branch string          `json:"branch"`
	Clean  bool            `json:"clean"`
	Files  []GitStatusFile `json:"files"`
	Ahead  int             `json:"ahead"`
	Behind int             `json:"behind"`
}

type WorktreeInfo struct {
	WorkspaceID string `json:"workspaceId"`
	RunID       string `json:"runId"`
	Path        string `json:"path"`
	Branch      string `json:"branch"`
	Active      bool   `json:"active"`
}

type GitManager struct {
	WorktreesBaseDir string
}

func NewGitManager(worktreesBase string) *GitManager {
	if worktreesBase == "" {
		home, _ := os.UserHomeDir()
		worktreesBase = filepath.Join(home, ".local/share/neurocode/worktrees")
	}
	os.MkdirAll(worktreesBase, 0755)
	return &GitManager{
		WorktreesBaseDir: worktreesBase,
	}
}

func (g *GitManager) GetStatus(repoPath string) (*GitInfo, error) {
	cmd := exec.Command("git", "status", "--porcelain", "-b")
	cmd.Dir = repoPath
	var out bytes.Buffer
	cmd.Stdout = &out

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("git status error: %w", err)
	}

	lines := strings.Split(out.String(), "\n")
	info := &GitInfo{
		Branch: "main",
		Clean:  true,
		Files:  []GitStatusFile{},
	}

	for i, line := range lines {
		if line == "" {
			continue
		}
		if i == 0 && strings.HasPrefix(line, "## ") {
			branchHeader := strings.TrimPrefix(line, "## ")
			parts := strings.Split(branchHeader, "...")
			info.Branch = parts[0]
			continue
		}

		info.Clean = false
		statusSymbol := line[0:2]
		filePath := strings.TrimSpace(line[3:])

		statusName := "modified"
		if strings.Contains(statusSymbol, "?") {
			statusName = "untracked"
		} else if strings.Contains(statusSymbol, "A") {
			statusName = "added"
		} else if strings.Contains(statusSymbol, "D") {
			statusName = "deleted"
		} else if statusSymbol[0] != ' ' && statusSymbol[0] != '?' {
			statusName = "staged"
		}

		info.Files = append(info.Files, GitStatusFile{
			Path:   filePath,
			Status: statusName,
		})
	}

	return info, nil
}

func (g *GitManager) CreateWorktree(repoPath string, workspaceID string, sessionID string, runID string) (*WorktreeInfo, error) {
	worktreePath := filepath.Join(g.WorktreesBaseDir, workspaceID, runID)
	branchName := fmt.Sprintf("neurocode/%s/%s", sessionID, runID)

	if err := os.MkdirAll(filepath.Dir(worktreePath), 0755); err != nil {
		return nil, fmt.Errorf("mkdir worktrees dir error: %w", err)
	}

	cmd := exec.Command("git", "worktree", "add", "-b", branchName, worktreePath)
	cmd.Dir = repoPath
	var errOut bytes.Buffer
	cmd.Stderr = &errOut

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("git worktree add error: %s (%w)", errOut.String(), err)
	}

	return &WorktreeInfo{
		WorkspaceID: workspaceID,
		RunID:       runID,
		Path:        worktreePath,
		Branch:      branchName,
		Active:      true,
	}, nil
}

func (g *GitManager) RemoveWorktree(repoPath string, worktreePath string) error {
	cmd := exec.Command("git", "worktree", "remove", "--force", worktreePath)
	cmd.Dir = repoPath
	return cmd.Run()
}
