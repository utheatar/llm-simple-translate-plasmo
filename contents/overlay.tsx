import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState, useRef } from "react"
import { useAppSettings } from "~lib/storage"
import { usePort } from "@plasmohq/messaging/hook"
import {
    Book, X, Copy, Check, Sparkles, GripHorizontal
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import type { TranslateRequestBody, TranslateResponseBody } from "~lib/types"

// --- 1. Plasmo 配置 ---
export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"],
    all_frames: true
}

// 注入样式
export const getStyle = () => {
    const style = document.createElement("style")
    style.textContent = cssText
    return style
}

// --- 2. 辅助函数 ---

type UIState = 'hidden' | 'icon' | 'panel'

interface Position {
    x: number
    y: number
}

const calcIconPosition = (mouseX: number, mouseY: number, offsetX: number, offsetY: number): Position => {
    return {
        x: mouseX + offsetX,
        y: mouseY + offsetY
    }
}

const calcPanelPosition = (rect: DOMRect, mode: 'top' | 'bottom', panelWidth: number, panelHeight: number): Position => {
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const viewW = window.innerWidth
    const viewH = window.innerHeight

    let x = rect.left + scrollX
    let y = 0

    if (mode === 'top') {
        y = rect.top + scrollY - panelHeight - 10
    } else {
        y = rect.bottom + scrollY + 10
    }

    // 水平夹紧：不超出右边缘
    x = Math.max(10 + scrollX, Math.min(x, scrollX + viewW - panelWidth - 10))

    // 垂直夹紧：如果超出顶部，翻到文本下方；如果超出底部，翻到文本上方
    if (y < scrollY + 10) {
        y = rect.bottom + scrollY + 10
    }
    if (y + panelHeight > scrollY + viewH - 10) {
        y = rect.top + scrollY - panelHeight - 10
    }
    // 最终保底
    y = Math.max(scrollY + 10, y)

    return { x, y }
}

// --- 3. 主组件 ---
const PlasmoOverlay = () => {
    const [settings] = useAppSettings()

    // UI 状态
    const [uiState, setUiState] = useState<UIState>('hidden')
    const [pos, setPos] = useState<Position>({ x: 0, y: 0 })
    const [selectedText, setSelectedText] = useState("")

    // 翻译状态
    const [translation, setTranslation] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [apiName, setApiName] = useState<string | null>(null)
    const [showSource, setShowSource] = useState(false)

    // 拖拽相关
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

    const translatePort = usePort<TranslateRequestBody, TranslateResponseBody>("translate")
    // AbortController 用于取消请求
    const abortControllerRef = useRef<AbortController | null>(null)
    // handle hover state to prevent hiding UI when interacting with it
    const isHoveringRef = useRef(false)
    const handleMouseEnter = () => { isHoveringRef.current = true }
    const handleMouseLeave = () => { isHoveringRef.current = false }

    // Port 消息监听
    useEffect(() => {
        if (translatePort.data) {
            setCopied(false)
            const msg = translatePort.data
            if (msg.status === "streaming") {
                setIsLoading(true)
                if (msg.chunk) {
                    setTranslation(prev => prev + msg.chunk)
                }
                if (msg.fullText) {
                    setTranslation(msg.fullText)
                }
                if (msg.apiName) setApiName(msg.apiName)
            } else if (msg.status === "completed") {
                setIsLoading(false)
                if (msg.fullText) {
                    setTranslation(msg.fullText)
                }
                if (msg.apiName) {
                    setApiName(msg.apiName)
                }
            } else if (msg.status === "error") {
                setIsLoading(false)
                setError(msg.errorMsg || "Translation Error")
            }
        }
    }, [translatePort.data])

    // --- 核心交互逻辑 ---
    // 监听鼠标按下与抬起事件
    useEffect(() => {
        if (!settings || settings.selectionMode === 'off') return

        const handleMouseDown = (e: MouseEvent) => {
            if (isHoveringRef.current) {
                setIsDragging(true) // 如果在悬停插件上，停止拖拽状态
                return
            } else {
                setUiState('hidden')
            }
        }

        const handleMouseUp = (e: MouseEvent) => {
            if (isHoveringRef.current) return // 如果在悬停插件上，什么都不做

            if (isDragging) {
                setIsDragging(false)
                return
            }

            setTimeout(() => {
                const selection = window.getSelection()
                const text = selection?.toString().trim()

                if (!text) {
                    return
                }

                // 忽略输入框
                if (
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement ||
                    (e.target as HTMLElement).isContentEditable
                ) {
                    return
                }

                // 如果已经显示了面板且正在翻译当前文本，就不重复触发
                if (uiState === 'panel' && text === selectedText) return

                setSelectedText(text)

                if (settings.selectionMode === 'icon') {
                    const iconPos = calcIconPosition(e.pageX, e.pageY, settings.iconOffsetX, settings.iconOffsetY)
                    setPos(iconPos)
                    setUiState('icon')
                } else if (settings.selectionMode === 'panel') {
                    const range = selection.getRangeAt(0)
                    const rect = range.getBoundingClientRect()
                    const panelPos = calcPanelPosition(rect, settings.panelInitialPos, settings.panelWidth, settings.panelHeight)
                    setPos(panelPos)
                    setUiState('panel')
                    doTranslate(text)
                }
            }, settings.selectionDelay)
        }

        document.addEventListener("mouseup", handleMouseUp)
        document.addEventListener("mousedown", handleMouseDown)
        return () => {
            document.removeEventListener("mouseup", handleMouseUp)
            document.removeEventListener("mousedown", handleMouseDown)
        }
    }, [settings, isDragging, uiState, selectedText])

    // 当 UI 隐藏时，强制重置 hovering 状态
    // useEffect(() => {
    //     if (uiState === 'hidden') {
    //         isHoveringRef.current = false
    //     }
    // }, [uiState])

    const doTranslate = (text: string) => {
        // 取消上一个请求
        if (abortControllerRef.current) abortControllerRef.current.abort()
        abortControllerRef.current = new AbortController()

        setTranslation("")
        setError(null)
        setApiName(null)
        setIsLoading(true)
        setShowSource(false)

        translatePort.send({
            text,
            sourceLang: "auto",
            targetLang: settings.targetLang1,
            trigger: 'selection',
        })
    }

    const handleIconClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setUiState('panel')
        // 原地展开，微调 Y 轴以免遮挡
        setPos(prev => ({ x: prev.x, y: prev.y + 10 }))
        doTranslate(selectedText)
    }

    // --- 拖拽逻辑 ---
    const startDrag = (e: React.MouseEvent) => {
        // 阻止默认行为，防止选中文字
        e.preventDefault()
        // 阻止冒泡，防止触发 document 的 mousedown (关闭面板)
        e.stopPropagation()

        setIsDragging(true)
        setDragOffset({
            x: e.clientX - pos.x,
            y: e.clientY - pos.y
        })
    }

    // 监听全局鼠标移动和释放
    useEffect(() => {
        const moveDrag = (e: MouseEvent) => {
            if (isDragging) {
                setPos({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                })
            }
        }

        const stopDrag = () => {
            setIsDragging(false)
        }

        if (isDragging) {
            window.addEventListener('mousemove', moveDrag)
            window.addEventListener('mouseup', stopDrag)
        }
        return () => {
            window.removeEventListener('mousemove', moveDrag)
            window.removeEventListener('mouseup', stopDrag)
        }
    }, [isDragging, dragOffset])


    const [copied, setCopied] = useState(false)
    const handleCopy = () => {
        navigator.clipboard.writeText(translation)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (!settings || uiState === 'hidden') return null

    // 暗黑模式判断
    const isDark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    return (
        <div
            id="plasmo-shadow-container"
            className={`font-sans text-base leading-normal ${isDark ? 'dark' : ''}`}
            style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                zIndex: 2147483647,
                pointerEvents: "auto", // 允许点击
                display: "flex" // 防止高度塌陷
            }}
            // [Bug 1 修复] 移除了 onMouseUp 的 stopPropagation
            // 这样鼠标抬起事件可以冒泡到 window，触发 stopDrag
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* 
               [Bug 2 修复] 
               1. 增加外层包裹 div 处理 dark 类
               2. 显式使用 bg-white 和 dark:bg-zinc-900 确保不透明
               3. 增加 shadow-xl 提升对比度
            */}

            {/* --- 图标模式 UI --- */}
            {uiState === 'icon' && (
                <button
                    onClick={handleIconClick}

                    className="group bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden"
                    style={{
                        width: settings.iconSize,
                        height: settings.iconSize,
                    }}
                >
                    <Book size={settings.iconSize * 0.55} strokeWidth={2} />
                </button>
            )}

            {/* --- 面板模式 UI --- */}
            {uiState === 'panel' && (
                <div
                    className="bg-white dark:bg-zinc-950 text-slate-800 dark:text-slate-100 border border-gray-200 dark:border-zinc-800 shadow-2xl rounded-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                    style={{
                        width: settings.panelWidth,
                        minHeight: settings.panelHeight,
                        fontSize: settings.panelFontSize
                    }}
                >
                    {/* Header */}
                    <div
                        onMouseDown={startDrag}
                        className="h-9 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between px-3 cursor-move select-none"
                    >
                        {/* API indicator and Copy Button */}
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                            {isDragging ? <GripHorizontal size={14} /> : <Sparkles size={14} className="text-blue-600 dark:text-blue-400" />}
                            {/* API indicator */}
                            <span>{apiName || "LLM Translator"}</span>
                            {/* Copy Button */}
                            {!isLoading && translation && (
                                <div className="flex" style={{ zIndex: 10 }}>
                                    <button
                                        onClick={handleCopy}
                                        className="p-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md transition shadow-sm border border-gray-200 dark:border-zinc-700"
                                        title="复制"
                                    >
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            )}
                        </div>



                        {/* close button */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    setUiState('hidden')
                                    handleMouseLeave()
                                }}
                                className="p-1 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 rounded transition"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 overflow-y-auto max-h-[400px] relative">
                        {/* 原文（可折叠，点击展开/收起） */}
                        <div
                            className="mb-3 pb-2 border-b border-gray-100 dark:border-zinc-800 cursor-pointer group/src"
                            onClick={() => setShowSource(v => !v)}
                            title={showSource ? "点击折叠原文" : "点击展开原文"}
                        >
                            <p className={`text-xs text-gray-400 dark:text-gray-500 leading-relaxed select-none ${showSource ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                                {selectedText}
                            </p>
                        </div>
                        {error ? (
                            <div className="text-red-600 dark:text-red-400 text-sm p-3 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/20">
                                {error}
                            </div>
                        ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words">
                                {isLoading && !translation ? (
                                    <div className="space-y-3 animate-pulse pt-1">
                                        <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-3/4"></div>
                                        <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-1/2"></div>
                                        <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-5/6"></div>
                                    </div>
                                ) : (
                                    <ReactMarkdown>{translation}</ReactMarkdown>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default PlasmoOverlay