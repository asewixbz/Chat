import { ModelId, ModelParameters, KIE_MODELS } from '../types';
import { Sliders, HelpCircle, ChevronDown, ChevronUp, RefreshCw, Activity } from 'lucide-react';
import ApiStatusIndicator, { ApiStatusType } from './ApiStatusIndicator';

interface ModelSettingsProps {
  selectedModelId: ModelId;
  onModelChange: (modelId: ModelId) => void;
  parameters: ModelParameters;
  onParamChange: (params: Partial<ModelParameters>) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onResetParams: () => void;
  apiStatus?: ApiStatusType;
  apiLatency?: number | null;
  onOpenDiagnostics?: () => void;
}

export default function ModelSettings({
  selectedModelId,
  onModelChange,
  parameters,
  onParamChange,
  isOpen,
  onToggleOpen,
  onResetParams,
  apiStatus = 'unknown',
  apiLatency = null,
  onOpenDiagnostics
}: ModelSettingsProps) {
  const currentModel = KIE_MODELS[selectedModelId] || {
    id: selectedModelId,
    name: selectedModelId,
    description: 'Пользовательская модель Kie API',
    endpoint: `/${selectedModelId}/v1/chat/completions`,
    supportedParams: ['temperature', 'maxTokens', 'systemPrompt'] as const
  };

  // Helper to update individual parameters
  const updateParam = (key: keyof ModelParameters, value: any) => {
    onParamChange({ [key]: value });
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm transition-all duration-300">
      {/* Settings bar / trigger */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100/50 gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleOpen}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors py-1 px-2 rounded-md hover:bg-slate-200/50 cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5 text-sky-600" />
            <span className="font-display">Параметры: {currentModel.name}</span>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>

          {onOpenDiagnostics && (
            <ApiStatusIndicator
              status={apiStatus}
              latencyMs={apiLatency}
              onOpenDiagnostics={onOpenDiagnostics}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 px-2 py-1 rounded-md transition-all cursor-pointer"
              title="Запустить диагностику Kie API"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Диагностика API</span>
            </button>
          )}

          {/* Model Dropdown Selection */}
          <div className="relative">
            <select
              value={selectedModelId}
              onChange={(e) => onModelChange(e.target.value as ModelId)}
              className="text-[12px] bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1 font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer appearance-none max-w-[150px] sm:max-w-[200px] truncate"
            >
              {Object.keys(KIE_MODELS).map((modelId) => (
                <option key={modelId} value={modelId}>
                  {KIE_MODELS[modelId].name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-450 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Model Description & Sliders */}
      {isOpen && (
        <div className="p-4 space-y-4 border-t border-slate-100 bg-white/50 animate-fade-in text-[13px]">
          {/* Active Model Header & Description */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h5 className="font-semibold text-slate-900 font-display flex items-center gap-1.5">
                {currentModel.name}
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  Kie AI
                </span>
              </h5>
              <button
                onClick={onResetParams}
                className="text-[11px] text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 cursor-pointer"
                title="Сбросить параметры"
              >
                <RefreshCw className="h-3 w-3" />
                Сбросить
              </button>
            </div>
            <p className="text-slate-500 text-[12px] leading-snug">{currentModel.description}</p>
          </div>

          {/* Dynamic Grid for Model Parameters */}
          {(currentModel.supportedParams?.includes('temperature') ||
            currentModel.supportedParams?.includes('maxTokens') ||
            currentModel.supportedParams?.includes('reasoningEffort') ||
            currentModel.supportedParams?.includes('webSearch')) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              
              {/* 1. TEMPERATURE */}
              {currentModel.supportedParams?.includes('temperature') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-slate-700 flex items-center gap-1">
                      Температура (Temperature)
                      <span className="group relative">
                        <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-900 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 leading-normal">
                          Высокая температура дает творческие ответы, низкая — точные и стабильные.
                        </span>
                      </span>
                    </label>
                    <span className="font-mono text-slate-900 font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                      {parameters.temperature ?? 0.7}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.05"
                    value={parameters.temperature ?? 0.7}
                    onChange={(e) => updateParam('temperature', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                  />
                </div>
              )}

              {/* 2. MAX TOKENS */}
              {currentModel.supportedParams?.includes('maxTokens') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-slate-700 flex items-center gap-1">
                      Длина ответа (Max Output Tokens)
                    </label>
                    <span className="font-mono text-slate-900 font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                      {parameters.maxTokens ?? 1000}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="4096"
                    step="50"
                    value={parameters.maxTokens ?? 1000}
                    onChange={(e) => updateParam('maxTokens', parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                  />
                </div>
              )}

              {/* 3. REASONING EFFORT */}
              {currentModel.supportedParams?.includes('reasoningEffort') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-slate-700 flex items-center gap-1">
                      Глубина рассуждений (Reasoning Effort)
                      <span className="group relative">
                        <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-900 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 leading-normal">
                          Уровень глубины рассуждений модели. Более высокая глубина увеличивает время ответа, но дает более точный и обоснованный результат.
                        </span>
                      </span>
                    </label>
                    <span className="font-mono text-slate-900 font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-[11px] uppercase">
                      {parameters.reasoningEffort ?? 'low'}
                    </span>
                  </div>
                  <select
                    value={parameters.reasoningEffort ?? 'low'}
                    onChange={(e) => updateParam('reasoningEffort', e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white focus:outline-hidden focus:border-sky-500 transition-all font-sans cursor-pointer h-[34px]"
                  >
                    <option value="low">Low (Поверхностный)</option>
                    <option value="medium">Medium (Средний)</option>
                    <option value="high">High (Глубокий)</option>
                    <option value="xhigh">Extra High (Максимальный)</option>
                  </select>
                </div>
              )}

              {/* 4. WEB SEARCH TOGGLE */}
              {currentModel.supportedParams?.includes('webSearch') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs h-[20px]">
                    <label className="font-medium text-slate-700 flex items-center gap-1">
                      Поиск в интернете (Web Search)
                      <span className="group relative">
                        <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-900 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-55 leading-normal">
                          Включает поиск в реальном времени в интернете для получения актуальной информации.
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="flex items-center h-[34px]">
                    <button
                      type="button"
                      onClick={() => updateParam('webSearch', !parameters.webSearch)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        parameters.webSearch ? 'bg-sky-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          parameters.webSearch ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="ml-2 text-xs text-slate-500 font-medium">
                      {parameters.webSearch ? 'Включен' : 'Выключен'}
                    </span>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* 5. SYSTEM PROMPT */}
          {currentModel.supportedParams?.includes('systemPrompt') && (
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-medium text-slate-700 flex items-center justify-between">
                <span>Системный / служебный промпт</span>
                <span className="text-[10px] text-slate-400 font-normal">Инструкция для поведения модели</span>
              </label>
              <textarea
                rows={2}
                value={parameters.systemPrompt ?? ''}
                onChange={(e) => updateParam('systemPrompt', e.target.value)}
                placeholder="Пример: Пиши как Шекспир / Отвечай только на русском / Ты эксперт в Node.js..."
                className="w-full text-xs border border-slate-200/80 rounded-lg p-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-sky-500 transition-all font-sans placeholder-slate-400 resize-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
