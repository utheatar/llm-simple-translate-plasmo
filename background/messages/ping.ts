import type { PlasmoMessaging } from "@plasmohq/messaging"
import { getAppSettings } from "~lib/storage"

// 简单的心跳检测：返回当前是否有可用 API 配置
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
    const settings = await getAppSettings()
    const enabledApis = settings.apiList.filter(a => a.isEnabled)
    res.send({
        message: enabledApis.length > 0
            ? `Background active. ${enabledApis.length} API(s) enabled.`
            : "Background active. No enabled API configured."
    })
}

export default handler
