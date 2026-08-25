package com.nexa.social.utils

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.drawable.GradientDrawable

enum class ChatTheme(
    val themeId: String,
    val displayName: String,
    val sentStartColor: Int,
    val sentEndColor: Int,
    val receivedBgColor: Int,
    val sentTextColor: Int = Color.WHITE,
    val receivedTextColor: Int = Color.parseColor("#F8FAFC"),
    val markReadBtnColor: Int = Color.parseColor("#312E81"),
    val markReadTextColor: Int = Color.parseColor("#A5B4FC"),
    val readReceiptColor: Int = Color.parseColor("#6EE7B7")
) {
    INDIGO_DEFAULT(
        themeId = "indigo_default",
        displayName = "Midnight Indigo (Default)",
        sentStartColor = Color.parseColor("#4F46E5"),
        sentEndColor = Color.parseColor("#4338CA"),
        receivedBgColor = Color.parseColor("#1E293B"),
        markReadBtnColor = Color.parseColor("#312E81"),
        markReadTextColor = Color.parseColor("#A5B4FC"),
        readReceiptColor = Color.parseColor("#6EE7B7")
    ),
    SUNSET_BERRY(
        themeId = "sunset_berry",
        displayName = "Sunset Berry 🌅",
        sentStartColor = Color.parseColor("#EC4899"),
        sentEndColor = Color.parseColor("#F43F5E"),
        receivedBgColor = Color.parseColor("#2E1022"),
        markReadBtnColor = Color.parseColor("#831843"),
        markReadTextColor = Color.parseColor("#FBCFE8"),
        readReceiptColor = Color.parseColor("#F472B6")
    ),
    CYBER_EMERALD(
        themeId = "cyber_emerald",
        displayName = "Cyber Emerald 🌿",
        sentStartColor = Color.parseColor("#059669"),
        sentEndColor = Color.parseColor("#10B981"),
        receivedBgColor = Color.parseColor("#063726"),
        markReadBtnColor = Color.parseColor("#064E3B"),
        markReadTextColor = Color.parseColor("#A7F3D0"),
        readReceiptColor = Color.parseColor("#34D399")
    ),
    OCEAN_CYAN(
        themeId = "ocean_cyan",
        displayName = "Ocean Breeze 🌊",
        sentStartColor = Color.parseColor("#0284C7"),
        sentEndColor = Color.parseColor("#06B6D4"),
        receivedBgColor = Color.parseColor("#082F49"),
        markReadBtnColor = Color.parseColor("#0C4A6E"),
        markReadTextColor = Color.parseColor("#BAE6FD"),
        readReceiptColor = Color.parseColor("#38BDF8")
    ),
    ROYAL_PURPLE(
        themeId = "royal_purple",
        displayName = "Royal Velvet 🔮",
        sentStartColor = Color.parseColor("#7C3AED"),
        sentEndColor = Color.parseColor("#9333EA"),
        receivedBgColor = Color.parseColor("#2E1065"),
        markReadBtnColor = Color.parseColor("#581C87"),
        markReadTextColor = Color.parseColor("#E9D5FF"),
        readReceiptColor = Color.parseColor("#C084FC")
    ),
    AMBER_FLAME(
        themeId = "amber_flame",
        displayName = "Amber Flame 🔥",
        sentStartColor = Color.parseColor("#D97706"),
        sentEndColor = Color.parseColor("#F59E0B"),
        receivedBgColor = Color.parseColor("#381E04"),
        markReadBtnColor = Color.parseColor("#78350F"),
        markReadTextColor = Color.parseColor("#FDE68A"),
        readReceiptColor = Color.parseColor("#FBBF24")
    );

    fun createSentBubbleDrawable(cornerRadiusPx: Float = 36f): GradientDrawable {
        return GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            intArrayOf(sentStartColor, sentEndColor)
        ).apply {
            cornerRadius = cornerRadiusPx
        }
    }

    fun createReceivedBubbleDrawable(cornerRadiusPx: Float = 36f): GradientDrawable {
        return GradientDrawable().apply {
            setColor(receivedBgColor)
            cornerRadius = cornerRadiusPx
        }
    }

    fun createMarkReadButtonDrawable(cornerRadiusPx: Float = 20f): GradientDrawable {
        return GradientDrawable().apply {
            setColor(markReadBtnColor)
            cornerRadius = cornerRadiusPx
        }
    }
}

class ChatThemeManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREF_NAME = "nexa_chat_theme_prefs"
        private const val KEY_PREFIX_THEME = "chat_theme_"

        @Volatile
        private var INSTANCE: ChatThemeManager? = null

        fun getInstance(context: Context): ChatThemeManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ChatThemeManager(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    fun getThemeForChat(targetId: Int, chatType: String): ChatTheme {
        val key = "${KEY_PREFIX_THEME}${chatType}_$targetId"
        val themeId = prefs.getString(key, ChatTheme.INDIGO_DEFAULT.themeId)
        return ChatTheme.values().firstOrNull { it.themeId == themeId } ?: ChatTheme.INDIGO_DEFAULT
    }

    fun setThemeForChat(targetId: Int, chatType: String, theme: ChatTheme) {
        val key = "${KEY_PREFIX_THEME}${chatType}_$targetId"
        prefs.edit().putString(key, theme.themeId).apply()
    }
}
