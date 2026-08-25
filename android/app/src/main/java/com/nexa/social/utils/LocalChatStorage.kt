package com.nexa.social.utils

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.nexa.social.data.models.DisplayMessage

class LocalChatStorage(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()

    companion object {
        private const val PREF_NAME = "nexa_local_chat_storage"
        private const val KEY_PREFIX_DM = "cached_dm_"
        private const val KEY_PREFIX_GROUP = "cached_group_"
        private const val MAX_CACHED_MESSAGES_PER_CHAT = 200

        @Volatile
        private var INSTANCE: LocalChatStorage? = null

        fun getInstance(context: Context): LocalChatStorage {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: LocalChatStorage(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    private fun getStorageKey(currentUserId: Int, targetId: Int, chatType: String): String {
        return if (chatType == "direct") {
            val lower = minOf(currentUserId, targetId)
            val higher = maxOf(currentUserId, targetId)
            "${KEY_PREFIX_DM}${lower}_${higher}"
        } else {
            "${KEY_PREFIX_GROUP}${targetId}"
        }
    }

    @Synchronized
    fun getMessages(currentUserId: Int, targetId: Int, chatType: String): List<DisplayMessage> {
        val key = getStorageKey(currentUserId, targetId, chatType)
        val json = prefs.getString(key, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<DisplayMessage>>() {}.type
            gson.fromJson<List<DisplayMessage>>(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    @Synchronized
    fun saveMessages(currentUserId: Int, targetId: Int, chatType: String, messages: List<DisplayMessage>) {
        val key = getStorageKey(currentUserId, targetId, chatType)
        val trimmed = if (messages.size > MAX_CACHED_MESSAGES_PER_CHAT) {
            messages.takeLast(MAX_CACHED_MESSAGES_PER_CHAT)
        } else {
            messages
        }
        try {
            val json = gson.toJson(trimmed)
            prefs.edit().putString(key, json).apply()
        } catch (_: Exception) {}
    }

    @Synchronized
    fun addMessage(currentUserId: Int, targetId: Int, chatType: String, message: DisplayMessage) {
        val current = getMessages(currentUserId, targetId, chatType).toMutableList()
        val index = current.indexOfFirst { it.id == message.id }
        if (index >= 0) {
            current[index] = message
        } else {
            current.add(message)
        }
        saveMessages(currentUserId, targetId, chatType, current)
    }

    @Synchronized
    fun markMessageRead(currentUserId: Int, targetId: Int, chatType: String, messageId: Int) {
        val current = getMessages(currentUserId, targetId, chatType).toMutableList()
        var changed = false
        for (i in current.indices) {
            if (current[i].id == messageId) {
                current[i] = current[i].copy(isRead = true)
                changed = true
                break
            }
        }
        if (changed) {
            saveMessages(currentUserId, targetId, chatType, current)
        }
    }

    @Synchronized
    fun markAllRead(currentUserId: Int, targetId: Int, chatType: String) {
        val current = getMessages(currentUserId, targetId, chatType).map { it.copy(isRead = true) }
        saveMessages(currentUserId, targetId, chatType, current)
    }

    @Synchronized
    fun clearChat(currentUserId: Int, targetId: Int, chatType: String) {
        val key = getStorageKey(currentUserId, targetId, chatType)
        prefs.edit().remove(key).apply()
    }
}
