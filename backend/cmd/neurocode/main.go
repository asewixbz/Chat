package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"neurocode/pkg/config"
	"neurocode/pkg/git"
	"neurocode/pkg/kie"
	"neurocode/pkg/pty"
	"neurocode/pkg/security"
	"neurocode/pkg/workspace"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	configPath := flag.String("config", "", "Path to config file")
	allowRoot := flag.Bool("allow-root", false, "Allow running backend as root user")
	portFlag := flag.Int("port", 8080, "Override HTTP port")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// Load Configuration
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		slog.Error("Failed to load configuration", "error", err)
		os.Exit(1)
	}

	if *portFlag != 8080 {
		cfg.Server.Port = *portFlag
	}

	// Initialize Security Manager & check root execution guard
	secMgr := security.NewSecurityManager(cfg.Security.DefaultApprovalPolicy, *allowRoot)
	if err := secMgr.CheckRootPermission(); err != nil {
		slog.Error("Root check failed", "error", err)
		if !*allowRoot {
			os.Exit(1)
		}
	}

	// Initialize Git Manager
	gitMgr := git.NewGitManager(cfg.Storage.WorktreesDir)

	// Initialize PTY Terminal Manager
	termMgr := pty.NewTerminalManager(cfg.Terminals.MaxGlobal, cfg.Terminals.MaxPerWorkspace, cfg.Terminals.OutputBufferBytes)

	// Initialize Workspace Manager
	wsMgr := workspace.NewWorkspaceManager(cfg.Workspace.MaxSizeBytes, cfg.Workspace.MaxFiles)

	// Initialize KIE LLM Provider
	kieApiKey := os.Getenv("KIE_API_KEY")
	llmProvider := kie.NewKIEProvider("https://api.kie.ai/v1", kieApiKey)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// REST API Routes
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"neurocode-orchestrator","version":"1.0.0"}`)
	})

	r.Get("/api/v1/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","config":%v}`, cfg)
	})

	r.Post("/api/v1/workspaces/scan", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			path = "."
		}
		tree, stats, err := wsMgr.ScanWorkspace(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","tree":%v,"stats":%v}`, tree, stats)
	})

	r.Get("/api/v1/git/status", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Query().Get("path")
		if path == "" {
			path = "."
		}
		info, err := gitMgr.GetStatus(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","git":%v}`, info)
	})

	r.Get("/api/v1/llm/models", func(w http.ResponseWriter, r *http.Request) {
		models, err := llmProvider.ListModels(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","models":%v}`, models)
	})

	serverAddr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	srv := &http.Server{
		Addr:    serverAddr,
		Handler: r,
	}

	go func() {
		slog.Info("Neurocode Go Orchestrator backend starting", "address", serverAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server error", "error", err)
		}
	}()

	// Graceful shutdown on Linux signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down Neurocode Go Orchestrator backend...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = srv.Shutdown(ctx)
	slog.Info("Neurocode backend stopped successfully.")
}
