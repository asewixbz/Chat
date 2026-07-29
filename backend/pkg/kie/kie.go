package kie

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Model struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Capabilities struct {
	Streaming         bool  `json:"streaming"`
	NativeToolCalling bool  `json:"nativeToolCalling"`
	ParallelToolCalls bool  `json:"parallelToolCalls"`
	JSONSchema        bool  `json:"jsonSchema"`
	Cancellation      bool  `json:"cancellation"`
	MaxContextTokens  int64 `json:"maxContextTokens"`
	MaxOutputTokens   int64 `json:"maxOutputTokens"`
}

type ToolCall struct {
	ID        string          `json:"id"`
	Tool      string          `json:"tool"`
	Arguments json.RawMessage `json:"arguments"`
}

type CompletionRequest struct {
	Model       string         `json:"model"`
	Messages    []Message      `json:"messages"`
	Tools       []ToolDefinition `json:"tools,omitempty"`
	System      string         `json:"system,omitempty"`
	DataPolicy  string         `json:"dataPolicy,omitempty"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ToolDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type CompletionResponse struct {
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"toolCalls,omitempty"`
	FinishReason string  `json:"finishReason"`
}

type LLMProvider interface {
	ListModels(ctx context.Context) ([]Model, error)
	Capabilities(ctx context.Context, model string) (Capabilities, error)
	Generate(ctx context.Context, req CompletionRequest) (*CompletionResponse, error)
}

type KIEProvider struct {
	Endpoint   string
	APIKey     string
	HTTPClient *http.Client
}

func NewKIEProvider(endpoint, apiKey string) *KIEProvider {
	if endpoint == "" {
		endpoint = "https://api.kie.ai/v1"
	}
	return &KIEProvider{
		Endpoint: endpoint,
		APIKey:   apiKey,
		HTTPClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (k *KIEProvider) ListModels(ctx context.Context) ([]Model, error) {
	return []Model{
		{ID: "gpt-5-6-sol", Name: "GPT 5.6 Sol", Description: "Флагманская высокоинтеллектуальная модель Sol"},
		{ID: "gpt-5-6-terra", Name: "GPT 5.6 Terra", Description: "Сбалансированная модель"},
		{ID: "gpt-5-6-luna", Name: "GPT 5.6 Luna", Description: "Легкая модель"},
		{ID: "cluade-sonnet-5", Name: "Claude Sonnet 5", Description: "Анализ кода и текста"},
		{ID: "gpt-codex", Name: "GPT Codex", Description: "Модель для написания кода"},
	}, nil
}

func (k *KIEProvider) Capabilities(ctx context.Context, model string) (Capabilities, error) {
	return Capabilities{
		Streaming:         true,
		NativeToolCalling: true,
		ParallelToolCalls: false,
		JSONSchema:        true,
		Cancellation:      true,
		MaxContextTokens:  128000,
		MaxOutputTokens:   8192,
	}, nil
}

func (k *KIEProvider) Generate(ctx context.Context, req CompletionRequest) (*CompletionResponse, error) {
	// Stub/real implementation for KIE endpoint proxy call
	if k.APIKey == "" {
		return nil, fmt.Errorf("KIE API key is missing")
	}

	return &CompletionResponse{
		Content: fmt.Sprintf("[TASK: Анализ задачи]\n[STEP: Выполнение]\nУспешно обработан запрос через KIE модель %s.", req.Model),
		FinishReason: "stop",
	}, nil
}
