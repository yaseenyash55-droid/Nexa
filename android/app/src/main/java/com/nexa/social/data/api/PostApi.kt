package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.CreatePostRequest
import com.nexa.social.data.models.MediaUploadResponse
import com.nexa.social.data.models.Post
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Query

interface PostApi {
    @GET("posts/feed")
    suspend fun getFeed(
        @Query("scope") scope: String = "global",
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0
    ): Response<ApiResponse<List<Post>>>

    @GET("posts/bookmarks")
    suspend fun getBookmarks(
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0
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

    @POST("posts/{id}/like")
    suspend fun likePost(@retrofit2.http.Path("id") id: Int): Response<ApiResponse<Map<String, Any>>>

    @DELETE("posts/{id}/like")
    suspend fun unlikePost(@retrofit2.http.Path("id") id: Int): Response<ApiResponse<Map<String, Any>>>

    @POST("posts/{id}/bookmark")
    suspend fun bookmarkPost(@retrofit2.http.Path("id") id: Int): Response<ApiResponse<Map<String, Any>>>

    @DELETE("posts/{id}/bookmark")
    suspend fun unbookmarkPost(@retrofit2.http.Path("id") id: Int): Response<ApiResponse<Map<String, Any>>>

    @GET("social/reels")
    suspend fun getReels(
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0
    ): Response<ApiResponse<List<com.nexa.social.data.models.Reel>>>

    @POST("social/reels/{id}/like")
    suspend fun likeReel(@retrofit2.http.Path("id") id: Int): Response<ApiResponse<Map<String, Any>>>

    @DELETE("social/reels/{id}/like")
    suspend fun unlikeReel(@retrofit2.http.Path("id") id: Int): Response<ApiResponse<Map<String, Any>>>

    @GET("posts/{id}/comments")
    suspend fun getComments(@retrofit2.http.Path("id") id: Int): Response<ApiResponse<List<com.nexa.social.data.models.Comment>>>

    @POST("posts/{id}/comment")
    suspend fun addComment(
        @retrofit2.http.Path("id") id: Int,
        @Body request: com.nexa.social.data.models.CreateCommentRequest
    ): Response<ApiResponse<com.nexa.social.data.models.Comment>>

    @DELETE("posts/{id}")
    suspend fun deletePost(@retrofit2.http.Path("id") id: Int): Response<ApiResponse<Map<String, Any>>>

    @DELETE("posts/{postId}/comments/{commentId}")
    suspend fun deleteComment(
        @retrofit2.http.Path("postId") postId: Int,
        @retrofit2.http.Path("commentId") commentId: Int
    ): Response<ApiResponse<Map<String, Any>>>
}
