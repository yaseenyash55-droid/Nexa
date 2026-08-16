package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.FcmTokenRequest
import com.nexa.social.data.models.LoginRequest
import com.nexa.social.data.models.LoginResponse
import com.nexa.social.data.models.RefreshTokenRequest
import com.nexa.social.data.models.RefreshTokenResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.POST

interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<LoginResponse>>

    @POST("auth/refresh")
    suspend fun refresh(@Body request: RefreshTokenRequest): Response<ApiResponse<RefreshTokenResponse>>

    @POST("auth/logout")
    suspend fun logout(): Response<ApiResponse<Map<String, Any>>>

    @POST("notifications/register")
    suspend fun registerFcmToken(@Body request: FcmTokenRequest): Response<ApiResponse<Map<String, Any>>>

    @DELETE("notifications/fcm-token")
    suspend fun revokeFcmToken(@Body request: FcmTokenRequest): Response<ApiResponse<Map<String, Any>>>
}
