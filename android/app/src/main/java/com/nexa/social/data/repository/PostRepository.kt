package com.nexa.social.data.repository

import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.Post
import com.nexa.social.data.models.CreatePostRequest

class PostRepository {
    suspend fun getFeed(limit: Int = 20, offset: Int = 0): Result<List<Post>> {
        return try {
            val response = NexaApiClient.postApi.getFeed(limit = limit, offset = offset)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to fetch feed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun likePost(postId: Int): Result<Unit> {
        return try {
            val response = NexaApiClient.postApi.likePost(postId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to like post"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun unlikePost(postId: Int): Result<Unit> {
        return try {
            val response = NexaApiClient.postApi.unlikePost(postId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to unlike post"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun bookmarkPost(postId: Int): Result<Unit> {
        return try {
            val response = NexaApiClient.postApi.bookmarkPost(postId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to bookmark post"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun unbookmarkPost(postId: Int): Result<Unit> {
        return try {
            val response = NexaApiClient.postApi.unbookmarkPost(postId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to unbookmark post"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getReels(limit: Int = 20, offset: Int = 0): Result<List<com.nexa.social.data.models.Reel>> {
        return try {
            val response = NexaApiClient.postApi.getReels(limit = limit, offset = offset)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to fetch reels"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun likeReel(reelId: Int): Result<Unit> {
        return try {
            val response = NexaApiClient.postApi.likeReel(reelId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to like reel"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun unlikeReel(reelId: Int): Result<Unit> {
        return try {
            val response = NexaApiClient.postApi.unlikeReel(reelId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to unlike reel"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
