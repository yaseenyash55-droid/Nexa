package com.nexa.social.data.models

enum class NotificationDestination {
    HOME,
    EXPLORE,
    MESSAGES,
    CHAT,
    POST,
    REEL,
    PROFILE,
    CALL,
    CALL_INVITE;

    companion object {
        fun fromString(value: String?): NotificationDestination {
            return try {
                valueOf(value?.uppercase() ?: "HOME")
            } catch (e: Exception) {
                HOME
            }
        }
    }
}
