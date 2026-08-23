package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.CreateStoryRequest
import com.nexa.social.data.models.Story
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface StoryApi {
    @GET("stories/feed")
    suspend fun getFeed(): Response<ApiResponse<List<Story>>>

    @POST("stories")
    suspend fun createStory(@Body request: CreateStoryRequest): Response<ApiResponse<Story>>

    @DELETE("stories/{id}")
    suspend fun deleteStory(@Path("id") storyId: Int): Response<ApiResponse<Map<String, Any>>>
}
