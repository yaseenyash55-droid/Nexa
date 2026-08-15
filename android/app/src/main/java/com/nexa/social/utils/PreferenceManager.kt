package com.nexa.social.utils

import android.content.Context

class PreferenceManager(context: Context) {
    private val tokenManager = TokenManager(context)

    var accessToken: String?
        get() = tokenManager.accessToken
        set(value) { tokenManager.accessToken = value }

    var refreshToken: String?
        get() = tokenManager.refreshToken
        set(value) { tokenManager.refreshToken = value }

    var username: String?
        get() = tokenManager.username
        set(value) { tokenManager.username = value }

    var displayName: String?
        get() = tokenManager.displayName
        set(value) { tokenManager.displayName = value }

    var userId: Int
        get() = tokenManager.userId
        set(value) { tokenManager.userId = value }

    val isLoggedIn: Boolean
        get() = tokenManager.isLoggedIn

    fun saveUserSession(
        accessToken: String,
        refreshToken: String?,
        userId: Int,
        username: String,
        displayName: String
    ) {
        tokenManager.saveTokens(accessToken, refreshToken, userId, username, displayName)
    }

    fun clear() {
        tokenManager.clear()
    }
}
