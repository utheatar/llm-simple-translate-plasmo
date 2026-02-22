import { useState, useEffect, useRef } from "react"
import { Settings, ArrowRightLeft, Sparkles, XCircle, Copy, Check } from "lucide-react"
import { useAppSettings } from "~lib/storage"
import { LANGUAGES, type TranslateRequestBody, type TranslateResponseBody } from "~lib/types"
import ReactMarkdown from "react-markdown"
import { usePort } from "@plasmohq/messaging/hook"
import "~style.css"

function Popup() {
  const [settings, setSettings] = useAppSettings()

  // UI State
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sourceLang, setSourceLang] = useState("auto")
  const [targetLang, setTargetLang] = useState("zh-CN")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [usedApiName, setUsedApiName] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // 目标语言仅在首次加载时从存储初始化，后续不跟随 settings 变化重置
  const targetLangInitialized = useRef(false)
  // 防抖 Timer
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // 1. 建立连接
  const mailPort = usePort<TranslateRequestBody, TranslateResponseBody>("translate")

  // 2. 监听消息
  useEffect(() => {
    if (mailPort.data) {
      const msg = mailPort.data

      if (msg.status === "streaming") {
        setIsLoading(true)
        if (msg.chunk) setOutputText(prev => prev + msg.chunk)
        if (msg.fullText) setOutputText(msg.fullText)
        if (msg.apiName) setUsedApiName(msg.apiName)
      }
      else if (msg.status === "completed") {
        setIsLoading(false)
        if (msg.fullText) {
          setOutputText(msg.fullText)
        }
        if (msg.apiName) {
          setUsedApiName(msg.apiName)
        }
      }
      else if (msg.status === "error") {
        setIsLoading(false)
        setErrorMsg(msg.errorMsg || "未知错误")
      }
    }
  }, [mailPort.data])

  // 根据 theme 设置，将 dark class 应用到 html 元素
  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    const applyTheme = () => {
      if (settings.theme === 'dark') {
        root.classList.add('dark')
      } else if (settings.theme === 'light') {
        root.classList.remove('dark')
      } else {
        root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches)
      }
    }
    applyTheme()
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', applyTheme)
      return () => mq.removeEventListener('change', applyTheme)
    }
  }, [settings?.theme])

  // 初始化目标语言：仅首次加载时从存储读取，不随后续 settings 更新而重置
  useEffect(() => {
    if (settings && !targetLangInitialized.current) {
      targetLangInitialized.current = true
      setTargetLang(settings.popupLastTargetLang || settings.targetLang1)
    }
  }, [settings])

  // 修改目标语言：同时持久化到存储，确保跨 popup 开关会话保持
  const handleTargetLangChange = (lang: string) => {
    setTargetLang(lang)
    if (settings) {
      setSettings({ ...settings, popupLastTargetLang: lang })
    }
  }

  // 3. 发送请求
  const doTranslate = (text: string) => {
    if (!text.trim()) return

    // 重置状态
    setIsLoading(true)
    setErrorMsg(null)
    setUsedApiName(null)
    setOutputText("")

    // 发送
    mailPort.send({
      text,
      sourceLang,
      targetLang,
      trigger: 'popup'
    })
  }

  // 输入处理 (含防抖)
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setInputText(text)

    if (!settings) return

    if (settings.popupAutoTranslate) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)

      if (text.trim().length > 0) {
        setIsLoading(true)
        setErrorMsg(null)
        setOutputText("")

        debounceTimer.current = setTimeout(() => {
          doTranslate(text)
        }, settings.popupDebounceTime)
      } else {
        setIsLoading(false)
        setOutputText("")
      }
    }
  }

  const handleManualTranslate = () => { if (inputText.trim()) doTranslate(inputText) }

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const swapLanguages = () => {
    if (sourceLang === 'auto') return
    const prevSource = sourceLang
    setSourceLang(targetLang)
    handleTargetLangChange(prevSource)
  }

  if (!settings) return <div className="p-4">Loading settings...</div>

  return (
    <div className="w-[400px] min-h-[500px] bg-background text-foreground flex flex-col font-sans">
      {/* 头部 */}
      <header className="h-12 border-b border-border flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-2 font-bold text-primary">
          <Sparkles size={18} />
          <span>LLM Translator</span>
        </div>
        <button onClick={() => chrome.runtime.openOptionsPage()} className="p-2 text-muted-foreground hover:bg-muted rounded-full">
          <Settings size={18} />
        </button>
      </header>

      {/* 语言栏 */}
      <div className="h-12 border-b border-border flex items-center justify-between px-2 bg-muted/30">
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          className="bg-transparent text-sm font-medium py-1 px-2 rounded hover:bg-muted focus:outline-none max-w-[120px]"
        >
          <option value="auto">自动检测</option>
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>

        <button onClick={swapLanguages} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded">
          <ArrowRightLeft size={14} />
        </button>

        <select
          value={targetLang}
          onChange={(e) => handleTargetLangChange(e.target.value)}
          className="bg-transparent text-sm font-medium text-primary py-1 px-2 rounded hover:bg-muted focus:outline-none max-w-[120px] text-right"
        >
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </div>

      {/* 内容区 */}
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={handleInputChange}
            placeholder="输入文字开始翻译..."
            className="w-full min-h-[100px] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground text-base leading-relaxed"
            spellCheck={false}
          />
          {inputText && (
            <button onClick={() => { setInputText(""); setOutputText(""); }} className="absolute top-0 right-0 text-muted-foreground hover:text-foreground">
              <XCircle size={16} />
            </button>
          )}
        </div>

        {!settings.popupAutoTranslate && (
          <button
            onClick={handleManualTranslate}
            disabled={isLoading || !inputText.trim()}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "翻译中..." : "翻译"}
          </button>
        )}

        {(outputText || isLoading || errorMsg) && <div className="h-px bg-border w-full my-1"></div>}

        <div className="flex-1 min-h-[100px] relative pb-6">
          {errorMsg ? (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20">
              <p className="font-bold mb-1">翻译出错</p>
              {errorMsg}
            </div>
          ) : (
            <>
              {usedApiName && (
                <div className="mb-2">
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">via {usedApiName}</span>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
                {isLoading && !outputText ? (
                  <div className="space-y-3 animate-pulse pt-2">
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                ) : (
                  <ReactMarkdown>{outputText}</ReactMarkdown>
                )}
              </div>
              {outputText && !isLoading && (
                <div className="absolute bottom-0 right-0">
                  <button onClick={handleCopy} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded flex items-center gap-1 text-xs">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "已复制" : ""}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default Popup