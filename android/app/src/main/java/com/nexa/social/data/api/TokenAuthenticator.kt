package com.nexa.social.data.api

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.nexa.social.data.models.ApiResponse
import com.nexa.social.utils.TokenManager
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route

class TokenAuthenticator(
    private val tokenManager: TokenManager,
    private val baseUrl: String
) : Authenticator {

    private val gson = Gson()

    override fun authenticate(route: Route?, response: Response): Request? {
        // Prevent infinite loops if refresh endpoint itself returns 401
        if (response.request.url.encodedPath.endsWith("auth/refresh") ||
            response.request.url.encodedPath.endsWith("auth/login")
        ) {
            return null
        }

        val refreshToken = tokenManager.refreshToken
        if (refreshToken.isNullOrEmpty()) {
            tokenManager.clear()
            return null
        }

        synchronized(this) {
            // Check if another thread already refreshed the token
            val currentToken = tokenManager.accessToken
            val requestToken = response.request.header("Authorization")?.replace("Bearer ", "")

            if (currentToken != null && currentToken != requestToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $currentToken")
                    .build()
            }

            // Perform synchronous refresh HTTP request
            val newAccessToken = performTokenRefresh(refreshToken)
            if (newAccessToken != null) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $newAccessToken")
                    .build()
            } else {
                tokenManager.clear()
                return null
            }
        }
    }

    private fun performTokenRefresh(refreshToken: String): String? {
        return try {
            val client = OkHttpClient.Builder().build()
            val jsonBody = gson.toJson(mapOf("refreshToken" to refreshToken))
            val body = jsonBody.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())

            val refreshRequest = Request.Builder()
                .url("${baseUrl}auth/refresh")
                .post(body)
                .build()

            val refreshResponse = client.newCall(refreshRequest).execute()
            if (refreshResponse.isSuccessful && refreshResponse.body != null) {
                val responseString = refreshResponse.body!!.string()
                val type = object : TypeToken<ApiResponse<RefreshTokenResponse>>() {}.type
                val apiResponse: ApiResponse<RefreshTokenResponse>? = gson.fromJson(responseString, type)

                val data = apiResponse?.data
                if (data != null && !data.accessToken.isNullOrEmpty()) {
                    tokenManager.updateAccessToken(data.accessToken, data.refreshToken)
                    data.accessToken
                } else null
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
}
