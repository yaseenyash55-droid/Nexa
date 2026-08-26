package com.nexa.social.data.repository

import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.CreateStoryRequest
import com.nexa.social.data.models.Story

class StoryRepository {
    suspend fun getFeed(): Result<List<Story>> = runCatching {
        val response = NexaApiClient.storyApi.getFeed()
        val body = response.body()
        if (!response.isSuccessful) {
            throw IllegalStateException(body?.error?.message ?: body?.message ?: "Unable to load Cosmic")
        }
        body?.data ?: throw IllegalStateException(body?.error?.message ?: body?.message ?: "Cosmic response was empty")
    }

    suspend fun createStory(mediaUrl: String, caption: String?): Result<Story> = runCatching {
        val response = NexaApiClient.storyApi.createStory(CreateStoryRequest(mediaUrl, caption))
        val body = response.body()
        if (!response.isSuccessful) {
            throw IllegalStateException(body?.error?.message ?: body?.message ?: "Unable to publish Cosmic")
        }
        body?.data ?: throw IllegalStateException(body?.error?.message ?: body?.message ?: "Cosmic response was empty")
    }
}
