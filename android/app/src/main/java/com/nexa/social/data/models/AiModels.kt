package com.nexa.social.data.models

import com.google.gson.annotations.SerializedName

data class AiConversation(
    @SerializedName("conversationId") val conversationId: Int,
    @SerializedName("userId") val userId: Int,
    @SerializedName("title") val title: String,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null
)

data class AiMessage(
    @SerializedName("messageId") val messageId: Int? = null,
    @SerializedName("conversationId") val conversationId: Int? = null,
    @SerializedName("role") val role: String, // "user" | "assistant" | "system"
    @SerializedName("content") val content: String,
    @SerializedName("createdAt") val createdAt: String? = null,
    val isStreaming: Boolean = false
)

data class AiConversationDetails(
    @SerializedName("conversation") val conversation: AiConversation,
    @SerializedName("messages") val messages: List<AiMessage>
)

data class AiChatRequest(
    @SerializedName("message") val message: String,
    @SerializedName("conversationId") val conversationId: Int? = null
)

data class AiChatResponse(
    @SerializedName("message") val message: String,
    @SerializedName("conversationId") val conversationId: Int,
    @SerializedName("provider") val provider: String? = null,
    @SerializedName("model") val model: String? = null
)

data class AiWritingRequest(
    @SerializedName("operation") val operation: String,
    @SerializedName("text") val text: String? = null,
    @SerializedName("targetLanguage") val targetLanguage: String? = null
)

data class AiWritingResponse(
    @SerializedName("result") val result: String,
    @SerializedName("operation") val operation: String,
    @SerializedName("originalText") val originalText: String? = null,
    @SerializedName("model") val model: String? = null
)

data class AiPreference(
    @SerializedName("userId") val userId: Int,
    @SerializedName("personalizationEnabled") val personalizationEnabled: Boolean = false,
    @SerializedName("preferredLanguage") val preferredLanguage: String = "en",
    @SerializedName("responseLength") val responseLength: String = "balanced", // "concise" | "balanced" | "detailed"
    @SerializedName("writingTone") val writingTone: String = "friendly",
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null
)

data class AiUpdatePreferencesRequest(
    @SerializedName("personalizationEnabled") val personalizationEnabled: Boolean? = null,
    @SerializedName("preferredLanguage") val preferredLanguage: String? = null,
    @SerializedName("responseLength") val responseLength: String? = null,
    @SerializedName("writingTone") val writingTone: String? = null
)

data class AiMemory(
    @SerializedName("memoryId") val memoryId: Int,
    @SerializedName("userId") val userId: Int,
    @SerializedName("keyName") val keyName: String,
    @SerializedName("content") val content: String,
    @SerializedName("category") val category: String = "general",
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("updatedAt") val updatedAt: String? = null
)

data class AiCreateMemoryRequest(
    @SerializedName("keyName") val keyName: String,
    @SerializedName("content") val content: String,
    @SerializedName("category") val category: String = "general"
)

data class AiStatus(
    @SerializedName("enabled") val enabled: Boolean,
    @SerializedName("provider") val provider: String? = null,
    @SerializedName("model") val model: String? = null
)

data class AiCreateConversationRequest(
    @SerializedName("title") val title: String? = null
)
