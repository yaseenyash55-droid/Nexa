package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.MediaUploadResponse
import com.nexa.social.data.models.User
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.Part
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface UserApi {
    @Multipart
    @POST("media/upload")
    suspend fun uploadProfileImage(
        @Part file: MultipartBody.Part,
        @Part("kind") kind: RequestBody
    ): Response<ApiResponse<MediaUploadResponse>>

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

    @retrofit2.http.PUT("users/{id}")
    suspend fun updateProfile(
        @Path("id") id: Int,
        @retrofit2.http.Body request: com.nexa.social.data.models.UpdateProfileRequest
    ): Response<ApiResponse<User>>

    @GET("users/{id}/followers")
    suspend fun getFollowers(@Path("id") id: Int): Response<ApiResponse<List<User>>>

    @GET("users/{id}/following")
    suspend fun getFollowing(@Path("id") id: Int): Response<ApiResponse<List<User>>>
}
