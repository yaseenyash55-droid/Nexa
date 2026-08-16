package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.CreatePostRequest
import com.nexa.social.data.models.MediaUploadResponse
import com.nexa.social.data.models.Post
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Query

interface PostApi {
    @GET("posts/feed")
    suspend fun getFeed(
        @Query("scope") scope: String = "global",
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<Post>>>

    @Multipart
    @POST("media/upload")
    suspend fun uploadMedia(
        @Part file: MultipartBody.Part,
        @Part("kind") kind: RequestBody
    ): Response<ApiResponse<MediaUploadResponse>>

    @POST("posts/create")
    suspend fun createPost(
        @Body request: CreatePostRequest
    ): Response<ApiResponse<Post>>
}
