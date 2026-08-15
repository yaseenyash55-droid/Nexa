package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.LoginRequest
import com.nexa.social.data.models.LoginResponse
import com.nexa.social.data.models.User
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<LoginResponse>>

    @GET("auth/me")
    suspend fun getCurrentUser(): Response<ApiResponse<User>>

    @POST("auth/logout")
    suspend fun logout(): Response<ApiResponse<Any>>
}
