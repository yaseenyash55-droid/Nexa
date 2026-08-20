package com.nexa.social.data.repository

import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.ForgotPasswordRequest
import com.nexa.social.data.models.LoginRequest
import com.nexa.social.data.models.RegisterRequest
import com.nexa.social.data.models.User
import com.nexa.social.data.models.VerifyEmailRequest
import com.nexa.social.utils.SocketManager
import com.nexa.social.utils.TokenManager

class AuthRepository(private val tokenManager: TokenManager) {

    suspend fun register(request: RegisterRequest): Result<User> {
        return try {
            val response = NexaApiClient.authApi.register(request)
            if (response.isSuccessful && response.body()?.data != null) {
                val data = response.body()!!.data!!
                tokenManager.saveTokens(
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
                    ?: "Registration failed (${response.code()})"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun login(username: String, password: String): Result<User> {
        return try {
            val response = NexaApiClient.authApi.login(LoginRequest(username, password))
            if (response.isSuccessful && response.body()?.data != null) {
                val data = response.body()!!.data!!
                tokenManager.saveTokens(
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
                    ?: "Invalid username/email or password (${response.code()})"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun forgotPassword(email: String): Result<String> {
        return try {
            val response = NexaApiClient.authApi.forgotPassword(ForgotPasswordRequest(email))
            if (response.isSuccessful) {
                Result.success(response.body()?.message ?: "Reset instructions sent")
            } else {
                val errorMsg = response.body()?.error?.message ?: "Failed to request password reset"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyEmail(token: String): Result<String> {
        return try {
            val response = NexaApiClient.authApi.verifyEmail(VerifyEmailRequest(token))
            if (response.isSuccessful) {
                Result.success(response.body()?.message ?: "Email verified")
            } else {
                val errorMsg = response.body()?.error?.message ?: "Verification failed"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun resendVerification(email: String): Result<String> {
        return try {
            val response = NexaApiClient.authApi.resendVerification(mapOf("email" to email))
            if (response.isSuccessful) {
                Result.success(response.body()?.message ?: "Verification email sent")
            } else {
                val errorMsg = response.body()?.error?.message ?: "Failed to resend verification email"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout(): Result<Unit> {
        return try {
            val token = tokenManager.accessToken
            if (!token.isNullOrEmpty()) {
                try {
                    NexaApiClient.authApi.logout()
                } catch (_: Exception) {}
            }
            SocketManager.disconnect()
            tokenManager.clear()
            Result.success(Unit)
        } catch (_: Exception) {
            SocketManager.disconnect()
            tokenManager.clear()
            Result.success(Unit)
        }
    }
}
