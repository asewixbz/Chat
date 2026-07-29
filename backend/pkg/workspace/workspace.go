package workspace

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type FileNode struct {
	Name      string      `json:"name"`
	Path      string      `json:"path"`
	Type      string      `json:"type"` // file or directory
	Size      int64       `json:"size,omitempty"`
	UpdatedAt string      `json:"updatedAt,omitempty"`
	Children  []*FileNode `json:"children,omitempty"`
}

type IndexStats struct {
	TotalSizeBytes int64 `json:"totalSizeBytes"`
	TotalFiles     int   `json:"totalFiles"`
	ExceedsLimit   bool  `json:"exceedsLimit"`
}

type WorkspaceManager struct {
	MaxSizeBytes int64
	MaxFiles     int
}

var IgnoredDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	"vendor":       true,
	"dist":         true,
	"build":        true,
	".next":        true,
	"coverage":     true,
}

func NewWorkspaceManager(maxSizeBytes int64, maxFiles int) *WorkspaceManager {
	if maxSizeBytes <= 0 {
		maxSizeBytes = 524288000 // 500 MB
	}
	if maxFiles <= 0 {
		maxFiles = 100000
	}
	return &WorkspaceManager{
		MaxSizeBytes: maxSizeBytes,
		MaxFiles:     maxFiles,
	}
}

func (wm *WorkspaceManager) ScanWorkspace(rootPath string) (*FileNode, *IndexStats, error) {
	absPath, err := filepath.Abs(rootPath)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid path: %w", err)
	}

	stats := &IndexStats{}
	rootNode := &FileNode{
		Name: filepath.Base(absPath),
		Path: absPath,
		Type: "directory",
	}

	err = wm.scanRecursive(absPath, rootNode, stats, 0, 4)
	if err != nil {
		return nil, nil, err
	}

	if stats.TotalSizeBytes > wm.MaxSizeBytes {
		stats.ExceedsLimit = true
	}

	return rootNode, stats, nil
}

func (wm *WorkspaceManager) scanRecursive(currentPath string, node *FileNode, stats *IndexStats, currentDepth int, maxDepth int) error {
	if currentDepth > maxDepth || stats.TotalFiles >= wm.MaxFiles {
		return nil
	}

	entries, err := os.ReadDir(currentPath)
	if err != nil {
		return nil
	}

	for _, entry := range entries {
		name := entry.Name()
		fullPath := filepath.Join(currentPath, name)

		if entry.IsDir() {
			if IgnoredDirs[name] {
				continue
			}
			childNode := &FileNode{
				Name: name,
				Path: fullPath,
				Type: "directory",
			}
			wm.scanRecursive(fullPath, childNode, stats, currentDepth+1, maxDepth)
			node.Children = append(node.Children, childNode)
		} else {
			info, err := entry.Info()
			if err != nil {
				continue
			}

			stats.TotalFiles++
			stats.TotalSizeBytes += info.Size()

			childNode := &FileNode{
				Name:      name,
				Path:      fullPath,
				Type:      "file",
				Size:      info.Size(),
				UpdatedAt: info.ModTime().Format("2006-01-02 15:04:05"),
			}
			node.Children = append(node.Children, childNode)
		}
	}

	return nil
}

func (wm *WorkspaceManager) ReadFileChunk(filePath string, startByte int64, maxBytes int64) ([]byte, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("open file error: %w", err)
	}
	defer file.Close()

	if startByte > 0 {
		_, err = file.Seek(startByte, 0)
		if err != nil {
			return nil, fmt.Errorf("seek file error: %w", err)
		}
	}

	buf := make([]byte, maxBytes)
	n, err := file.Read(buf)
	if err != nil && n == 0 {
		return nil, err
	}

	return buf[:n], nil
}
