export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface ApiConfig {
    id: string;
    name: string;
    provider: LLMProvider;
    baseUrl: string;
    apiKey: string;
    model: string;
    promptId: string;
    isEnabled: boolean;
}

export interface PromptConfig {
    id: string;
    name: string;
    content: string;
    // 标记是否为系统默认，防止被删除
    isDefault?: boolean;
}

// 翻译历史项定义
export interface TranslationHistoryItem {
    id: string;
    timestamp: number;
    sourceText: string;
    targetText: string;
    sourceLang?: string;
    targetLang: string;
    apiId: string; // 记录用的哪个 API
}

export interface AppSettings {
    // 界面设置
    theme: 'light' | 'dark' | 'system';

    // 语言
    targetLang1: string; // e.g., 'zh-CN'
    targetLang2: string; // e.g., 'en'
    autoSwapLang: boolean;

    // API 策略
    apiList: ApiConfig[];
    autoSwitchApi: boolean; // 故障转移开关

    // 提示词列表
    prompts: PromptConfig[];

    // 划词 UI 设置
    selectionMode: 'icon' | 'panel' | 'off';
    selectionDelay: number;
    iconSize: 32 | 48 | 96 | 128;
    iconOffsetX: number;
    iconOffsetY: number;

    // 翻译面板设置
    panelWidth: number;
    panelHeight: number;
    panelFontSize: number;
    panelInitialPos: 'top' | 'bottom'; // 相对文本位置

    // Popup 设置
    popupAutoTranslate: boolean;
    popupDebounceTime: number;
    popupLastTargetLang?: string; // 记住 Popup 上次选择的目标语言，持久化跨会话

    // history
    history: TranslationHistoryItem[];

    // 高级/其他设置
    historyLimit: number;
    cacheEnabled: boolean;
    debugMode: boolean;
}

// 定义默认的 Prompt 内容
export const DEFAULT_PROMPT_ID = "default_translator";
// default system prompt template for translation tasks
export const DEFAULT_SYSTEM_PROMPT = `You are a professional translation engine. The target language is {{to}}.

**Task:**
Analyze the input. Is it a single word/phrase (Lexical Unit) or a sentence/text (Discourse)?

**Response Logic:**

**CASE A: Input is a Word/Phrase**
(e.g., "run", "state-of-the-art", "apple", "look after")
Output a structured dictionary entry in Markdown:
1.  **Definitions**: List parts of speech and meanings.
2.  **Example**: Provide one example sentence.

*Template for Case A:*
**[Word]**
- *[POS]* [Meaning 1]
- *[POS]* [Meaning 2]
...
> **Example:** [Example sentence]

**CASE B: Input is a Sentence/Text**
(e.g., "I like apples.", "The weather is good today.")
Output ONLY the direct translation. Do not wrap it in quotes or markdown code blocks.`

/** 
 * Generate system prompt based on template and languages
 * @param template The prompt template containing placeholders
 * @param targetLang The target language for translation
 * @returns The constructed system prompt
 */
export function buildSystemPrompt(template: string, targetLang: string): string {
    return template
        .replace("{{to}}", targetLang)
}

// 常见语言列表，实际项目中可扩展或移至 constants
export const LANGUAGES = [
    { code: 'zh-CN', name: '简体中文' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'es', name: 'Español' },
]

// 默认设置常量
export const DEFAULT_SETTINGS: AppSettings = {
    theme: 'system',
    // 语言
    targetLang1: 'zh-CN',
    targetLang2: 'en',
    autoSwapLang: true,
    // API
    apiList: [],
    autoSwitchApi: true,
    // 提示词
    prompts: [
        {
            id: DEFAULT_PROMPT_ID,
            name: "默认通用翻译 (General)",
            content: DEFAULT_SYSTEM_PROMPT,
            isDefault: true
        }
    ],
    // 划词
    selectionMode: 'icon',
    selectionDelay: 300,
    iconSize: 48,
    iconOffsetX: 10,
    iconOffsetY: 10,
    panelWidth: 500,
    panelHeight: 200,
    panelFontSize: 18,
    panelInitialPos: 'top',
    // Popup
    popupAutoTranslate: true,
    popupDebounceTime: 800,
    // 默认空历史
    history: [],
    // Advanced
    historyLimit: 10,
    cacheEnabled: true,
    debugMode: false
}

// [Helper] 安全获取 Prompt 的方法 (防止 ID 失效)
export function getPromptContent(promptId: string, prompts: PromptConfig[]): string {
    const prompt = prompts.find(p => p.id === promptId);
    return prompt ? prompt.content : DEFAULT_SYSTEM_PROMPT;
}

// 定义请求和响应的类型，方便前端推断
export interface TranslateRequestBody {
    text: string
    sourceLang: string
    targetLang: string
    trigger?: 'selection' | 'popup' // 区分来源：划词 vs Popup
    signal?: AbortSignal // 可选的取消信号
}

export interface TranslateResponseBody {
    status: "streaming" | "completed" | "error"
    chunk?: string      // 增量文本
    fullText?: string   // 最终文本
    errorMsg?: string   // 错误信息
    apiName?: string    // 告知前端用的是哪个 API
}