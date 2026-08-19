package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.User
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface UserApi {
    @GET("users/suggestions")
    suspend fun getSuggestions(
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<User>>>

    @GET("users/search")
    suspend fun searchUsers(
        @Query("q") query: String,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<User>>>

    @GET("users/username/{username}")
    suspend fun getProfileByUsername(@Path("username") username: String): Response<ApiResponse<User>>

    @GET("users/{id}")
    suspend fun getProfileById(@Path("id") id: Int): Response<ApiResponse<User>>

    @POST("users/{id}/follow")
    suspend fun followUser(@Path("id") id: Int): Response<ApiResponse<Map<String, Any>>>

    @DELETE("users/{id}/follow")
    suspend fun unfollowUser(@Path("id") id: Int): Response<ApiResponse<Map<String, Any>>>
}
