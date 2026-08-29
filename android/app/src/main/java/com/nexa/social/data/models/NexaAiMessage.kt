package com.nexa.social.data.models

object NexaAiMessage {

    fun isAssistant(
        senderType: String? = null,
        aiAgent: String? = null,
        content: String? = null
    ): Boolean {
        if (senderType.equals("ai", ignoreCase = true)) return true
        if (aiAgent.equals("nexa", ignoreCase = true)) return true
        val text = content?.trim().orEmpty()
        return text.startsWith("🤖 **NEXA AI**") || text.startsWith("✨ NEXA AI")
    }
}
