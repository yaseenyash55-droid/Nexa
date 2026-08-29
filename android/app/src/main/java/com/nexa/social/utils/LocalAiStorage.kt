package com.nexa.social.utils

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.nexa.social.data.models.AiConversation
import com.nexa.social.data.models.AiMessage

class LocalAiStorage(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()

    companion object {
        private const val PREF_NAME = "nexa_local_ai_storage"
        private const val KEY_CONVERSATIONS = "cached_conversations"
        private const val KEY_LAST_CONVERSATION_ID = "last_conversation_id"
        private const val KEY_MESSAGES_PREFIX = "cached_messages_"

        @Volatile
        private var INSTANCE: LocalAiStorage? = null

        fun getInstance(context: Context): LocalAiStorage {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: LocalAiStorage(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    fun getConversations(): List<AiConversation> {
        val json = prefs.getString(KEY_CONVERSATIONS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<AiConversation>>() {}.type
            gson.fromJson<List<AiConversation>>(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun saveConversations(conversations: List<AiConversation>) {
        try {
            prefs.edit().putString(KEY_CONVERSATIONS, gson.toJson(conversations)).apply()
        } catch (_: Exception) {
        }
    }

    fun getMessages(conversationId: Int): List<AiMessage> {
        val json = prefs.getString("$KEY_MESSAGES_PREFIX$conversationId", null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<AiMessage>>() {}.type
            gson.fromJson<List<AiMessage>>(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun saveMessages(conversationId: Int, messages: List<AiMessage>) {
        try {
            val persisted = messages.map { it.copy(isStreaming = false, isError = false) }
            prefs.edit().putString("$KEY_MESSAGES_PREFIX$conversationId", gson.toJson(persisted)).apply()
        } catch (_: Exception) {
        }
    }

    fun getLastConversationId(): Int? {
        val id = prefs.getInt(KEY_LAST_CONVERSATION_ID, -1)
        return if (id > 0) id else null
    }

    fun setLastConversationId(conversationId: Int?) {
        if (conversationId != null && conversationId > 0) {
            prefs.edit().putInt(KEY_LAST_CONVERSATION_ID, conversationId).apply()
        } else {
            prefs.edit().remove(KEY_LAST_CONVERSATION_ID).apply()
        }
    }

    fun deleteConversation(conversationId: Int) {
        val remaining = getConversations().filter { it.conversationId != conversationId }
        saveConversations(remaining)
        prefs.edit().remove("$KEY_MESSAGES_PREFIX$conversationId").apply()
        if (getLastConversationId() == conversationId) {
            setLastConversationId(null)
        }
    }
}
