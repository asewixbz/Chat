package pty

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
)

type TerminalSession struct {
	ID          string
	WorkspaceID string
	Cmd         *exec.Cmd
	PtyFile     *os.File
	Cols        uint16
	Rows        uint16
	Buffer      []byte
	Status      string // starting, running, exited, terminated
	mu          sync.Mutex
	subscribers map[chan string]bool
}

type TerminalManager struct {
	mu          sync.RWMutex
	sessions    map[string]*TerminalSession
	maxGlobal   int
	maxPerWs    int
	bufferSize  int
}

func NewTerminalManager(maxGlobal, maxPerWs, bufferSize int) *TerminalManager {
	if bufferSize == 0 {
		bufferSize = 2097152 // 2MB
	}
	return &TerminalManager{
		sessions:   make(map[string]*TerminalSession),
		maxGlobal:  maxGlobal,
		maxPerWs:   maxPerWs,
		bufferSize: bufferSize,
	}
}

func (tm *TerminalManager) CreateTerminal(id string, workspaceID string, cwd string, shell string, cols, rows uint16) (*TerminalSession, error) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if len(tm.sessions) >= tm.maxGlobal {
		return nil, fmt.Errorf("global maximum PTY sessions limit (%d) reached", tm.maxGlobal)
	}

	if shell == "" {
		shell = "/bin/bash"
	}
	if cwd == "" {
		cwd = "."
	}

	cmd := exec.Command(shell)
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true, // Place process in separate Linux process group
	}

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
	if err != nil {
		return nil, fmt.Errorf("pty start error: %w", err)
	}

	session := &TerminalSession{
		ID:          id,
		WorkspaceID: workspaceID,
		Cmd:         cmd,
		PtyFile:     ptmx,
		Cols:        cols,
		Rows:        rows,
		Buffer:      make([]byte, 0, 1024),
		Status:      "running",
		subscribers: make(map[chan string]bool),
	}

	tm.sessions[id] = session

	// Async output reader loop
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			if err != nil {
				session.mu.Lock()
				session.Status = "exited"
				session.mu.Unlock()
				break
			}
			if n > 0 {
				data := string(buf[:n])
				session.mu.Lock()
				session.Buffer = append(session.Buffer, buf[:n]...)
				if len(session.Buffer) > tm.bufferSize {
					session.Buffer = session.Buffer[len(session.Buffer)-tm.bufferSize:]
				}
				for ch := range session.subscribers {
					select {
					case ch <- data:
					default:
					}
				}
				session.mu.Unlock()
			}
		}
	}()

	return session, nil
}

func (tm *TerminalManager) WriteInput(id string, input string) error {
	tm.mu.RLock()
	session, exists := tm.sessions[id]
	tm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("terminal %s not found", id)
	}

	_, err := io.WriteString(session.PtyFile, input)
	return err
}

func (tm *TerminalManager) Resize(id string, cols, rows uint16) error {
	tm.mu.RLock()
	session, exists := tm.sessions[id]
	tm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("terminal %s not found", id)
	}

	session.Cols = cols
	session.Rows = rows
	return pty.Setsize(session.PtyFile, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
}

func (tm *TerminalManager) SendSignal(id string, sig syscall.Signal) error {
	tm.mu.RLock()
	session, exists := tm.sessions[id]
	tm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("terminal %s not found", id)
	}

	if session.Cmd.Process != nil {
		// Send signal to Linux Process Group (-pgid)
		pgid, err := syscall.Getpgid(session.Cmd.Process.Pid)
		if err == nil {
			return syscall.Kill(-pgid, sig)
		}
		return session.Cmd.Process.Signal(sig)
	}
	return nil
}

func (tm *TerminalManager) CloseTerminal(id string) error {
	tm.mu.Lock()
	session, exists := tm.sessions[id]
	delete(tm.sessions, id)
	tm.mu.Unlock()

	if !exists {
		return nil
	}

	// Send SIGTERM then SIGKILL to process group after grace period
	if session.Cmd.Process != nil {
		pgid, err := syscall.Getpgid(session.Cmd.Process.Pid)
		if err == nil {
			syscall.Kill(-pgid, syscall.SIGTERM)
			go func() {
				time.Sleep(1000 * time.Millisecond)
				syscall.Kill(-pgid, syscall.SIGKILL)
			}()
		}
	}

	session.PtyFile.Close()
	return nil
}

func (tm *TerminalManager) GetSession(id string) (*TerminalSession, bool) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	session, exists := tm.sessions[id]
	return session, exists
}
