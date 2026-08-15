package com.nexa.social.data.repository

import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.LoginRequest
import com.nexa.social.data.models.User
import com.nexa.social.utils.PreferenceManager

class AuthRepository(private val prefManager: PreferenceManager) {

    suspend fun login(username: String, password: String): Result<User> {
        return try {
            val response = NexaApiClient.authApi.login(LoginRequest(username, password))
            if (response.isSuccessful && response.body()?.data != null) {
                val data = response.body()!!.data!
                prefManager.saveUserSession(
                    accessToken = data.accessToken,
                    refreshToken = data.refreshToken,
                    userId = data.user.userId,
                    username = data.user.username,
                    displayName = data.user.displayName
                )
                Result.success(data.user)
            } else {
                val errorMsg = response.body()?.error?.message
                    ?: response.body()?.message
                    ?: "Invalid credentials (${response.code()})"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        prefManager.clear()
    }
}
