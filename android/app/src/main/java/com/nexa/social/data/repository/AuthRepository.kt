package com.nexa.social.data.repository

import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.ForgotPasswordRequest
import com.nexa.social.data.models.LoginRequest
import com.nexa.social.data.models.RegisterRequest
import com.nexa.social.data.models.User
import com.nexa.social.data.models.VerifyEmailRequest
import com.nexa.social.data.models.VerifyLoginOtpRequest
import com.nexa.social.utils.SocketManager
import com.nexa.social.utils.TokenManager

sealed interface LoginOutcome {
    data class Authenticated(val user: User) : LoginOutcome
    data class OtpRequired(
        val challengeId: String,
        val maskedEmail: String?,
        val expiresAt: String?
    ) : LoginOutcome
}

class AuthRepository(private val tokenManager: TokenManager) {

    suspend fun register(request: RegisterRequest): Result<User> = try {
        val response = NexaApiClient.authApi.register(request)
        val data = response.body()?.data
        if (response.isSuccessful && data != null) {
            saveSession(data.accessToken, data.refreshToken, data.user)
            Result.success(data.user)
        } else Result.failure(Exception(errorMessage(response.body()?.error?.message, response.body()?.message, "Registration failed (${response.code()})")))
    } catch (e: Exception) { Result.failure(e) }

    suspend fun login(username: String, password: String): Result<LoginOutcome> = try {
        val response = NexaApiClient.authApi.login(LoginRequest(username, password))
        val body = response.body()
        val data = body?.data
        if (!response.isSuccessful || data == null) {
            Result.failure(Exception(errorMessage(body?.error?.message, body?.message, "Invalid username/email or password (${response.code()})")))
        } else if (data.mfaRequired) {
            val challengeId = data.challengeId
            if (challengeId.isNullOrBlank()) Result.failure(Exception("The server returned an invalid verification challenge"))
            else Result.success(LoginOutcome.OtpRequired(challengeId, data.maskedEmail, data.expiresAt))
        } else {
            val user = data.user
            val accessToken = data.accessToken
            if (user == null || accessToken.isNullOrBlank()) Result.failure(Exception("The server returned an incomplete login response"))
            else {
                saveSession(accessToken, data.refreshToken, user)
                Result.success(LoginOutcome.Authenticated(user))
            }
        }
    } catch (e: Exception) { Result.failure(e) }

    suspend fun verifyLoginOtp(challengeId: String, code: String): Result<User> = try {
        val response = NexaApiClient.authApi.verifyLoginOtp(VerifyLoginOtpRequest(challengeId, code))
        val body = response.body()
        val data = body?.data
        if (response.isSuccessful && data != null) {
            saveSession(data.accessToken, data.refreshToken, data.user)
            Result.success(data.user)
        } else Result.failure(Exception(errorMessage(body?.error?.message, body?.message, "Verification failed (${response.code()})")))
    } catch (e: Exception) { Result.failure(e) }

    suspend fun forgotPassword(email: String): Result<String> = try {
        val response = NexaApiClient.authApi.forgotPassword(ForgotPasswordRequest(email))
        if (response.isSuccessful) Result.success(response.body()?.message ?: "Reset instructions sent")
        else Result.failure(Exception(response.body()?.error?.message ?: "Failed to request password reset"))
    } catch (e: Exception) { Result.failure(e) }

    suspend fun verifyEmail(token: String): Result<String> = try {
        val response = NexaApiClient.authApi.verifyEmail(VerifyEmailRequest(token))
        if (response.isSuccessful) Result.success(response.body()?.message ?: "Email verified")
        else Result.failure(Exception(response.body()?.error?.message ?: "Verification failed"))
    } catch (e: Exception) { Result.failure(e) }

    suspend fun resendVerification(email: String): Result<String> = try {
        val response = NexaApiClient.authApi.resendVerification(mapOf("email" to email))
        if (response.isSuccessful) Result.success(response.body()?.message ?: "Verification email sent")
        else Result.failure(Exception(response.body()?.error?.message ?: "Failed to resend verification email"))
    } catch (e: Exception) { Result.failure(e) }

    suspend fun logout(): Result<Unit> {
        val refreshToken = tokenManager.refreshToken
        try { NexaApiClient.authApi.logout(if (refreshToken.isNullOrEmpty()) emptyMap() else mapOf("refreshToken" to refreshToken)) } catch (_: Exception) {}
        SocketManager.disconnect()
        tokenManager.clear()
        return Result.success(Unit)
    }

    private fun saveSession(accessToken: String, refreshToken: String?, user: User) {
        tokenManager.saveTokens(accessToken, refreshToken, user.userId, user.username, user.displayName)
    }

    private fun errorMessage(error: String?, message: String?, fallback: String) = error ?: message ?: fallback
}
