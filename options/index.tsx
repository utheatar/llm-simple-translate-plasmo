import { useState, useEffect } from "react"
import { Settings, Server, MessageSquare, MousePointer2, Info, Sliders, Database } from "lucide-react"
import { useAppSettings } from "~lib/storage"
import { GeneralSettings } from "./sections/GeneralSettings"
import { ApiSettings } from "./sections/ApiSettings"
import { PromptSettings } from "./sections/PromptSettings"
import { SelectionSettings } from "./sections/SelectionSettings"
import { PopupSettings } from "./sections/PopupSettings"
import { AdvancedSettings } from "./sections/AdvancedSettings"
import "~style.css"
import packageJson from "~package.json"

function OptionsIndex() {
    const [activeTab, setActiveTab] = useState("general")
    const [settings] = useAppSettings()

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

    const renderContent = () => {
        switch (activeTab) {
            case "general": return <GeneralSettings />
            case "api": return <ApiSettings />
            case "prompts": return <PromptSettings />
            case "selection": return <SelectionSettings />
            case "popup": return <PopupSettings />
            case "advanced": return <AdvancedSettings />
            case "about": return (
                <div className="p-8 text-center text-muted-foreground">
                    <h2 className="text-xl font-bold mb-2 text-foreground">LLM Translator</h2>
                    <p>Designed for power users who want to bring their own models.</p>
                    <div className="mt-8 border p-4 rounded bg-muted text-left text-xs font-mono text-muted-foreground">
                        MIT License <br />
                        Built with Plasmo, React, Tailwind & OpenAI API.
                    </div>
                </div>
            )
            default: return <GeneralSettings />
        }
    }

    const menuItems = [
        { id: "general", label: "常规设置", icon: Settings },
        { id: "api", label: "API 服务", icon: Server },
        { id: "prompts", label: "AI 提示词", icon: MessageSquare },
        { id: "selection", label: "划词交互", icon: MousePointer2 },
        { id: "popup", label: "Popup 设置", icon: Sliders },
        { id: "advanced", label: "高级设置", icon: Database },
        { id: "about", label: "关于插件", icon: Info },
    ]

    const pluginVersion = packageJson.manifest.version

    return (
        <div className="min-h-screen bg-background flex text-foreground transition-colors duration-200">
            {/* 侧边栏 */}
            <aside className="w-64 border-r bg-card flex flex-col fixed h-full z-10">
                <div className="p-6 border-b">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        LLM Translator
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">v{pluginVersion} Dev</p>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => {
                        const Icon = item.icon
                        const isActive = activeTab === item.id
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive
                                    ? "bg-primary/10 text-primary" // 使用 primary 的透明背景
                                    : "text-muted-foreground hover:bg-muted"
                                    }`}
                            >
                                <Icon size={18} />
                                {item.label}
                            </button>
                        )
                    })}
                </nav>
            </aside>

            {/* 主内容区 */}
            <main className="flex-1 ml-64 p-8 max-w-4xl">
                {/* 这里的 bg-card 确保了内容块在黑夜模式下是深灰/黑色，而不是纯透明 */}
                <div className="bg-card rounded-xl shadow-sm border p-8 min-h-[500px] animate-in fade-in duration-200">
                    {renderContent()}
                </div>
            </main>
        </div>
    )
}

export default OptionsIndex