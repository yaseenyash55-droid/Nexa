package com.nexa.social.data.api

import com.google.gson.annotations.SerializedName
import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.FcmTokenRequest
import com.nexa.social.data.models.LoginRequest
import com.nexa.social.data.models.LoginResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

data class RefreshTokenRequest(
    @SerializedName("refreshToken") val refreshToken: String
)

data class RefreshTokenResponse(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String?
)

interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<LoginResponse>>

    @POST("auth/refresh")
    suspend fun refresh(@Body request: RefreshTokenRequest): Response<ApiResponse<RefreshTokenResponse>>

    @POST("auth/logout")
    suspend fun logout(@Header("Authorization") token: String): Response<ApiResponse<Any>>

    @POST("notifications/register")
    suspend fun registerFcmToken(@Body request: FcmTokenRequest): Response<ApiResponse<Any>>
}
