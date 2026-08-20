package com.nexa.social.data.repository

import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.User

class UserRepository {
    suspend fun getProfile(username: String): Result<User> {
        return try {
            val response = NexaApiClient.userApi.getProfileByUsername(username)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Profile not found"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun searchUsers(query: String): Result<List<User>> {
        return try {
            val response = NexaApiClient.userApi.searchUsers(query)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Search failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateProfile(userId: Int, request: com.nexa.social.data.models.UpdateProfileRequest): Result<User> {
        return try {
            val response = NexaApiClient.userApi.updateProfile(userId, request)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to update profile"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getFollowers(userId: Int): Result<List<User>> {
        return try {
            val response = NexaApiClient.userApi.getFollowers(userId)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to load followers"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getFollowing(userId: Int): Result<List<User>> {
        return try {
            val response = NexaApiClient.userApi.getFollowing(userId)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to load following"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun followUser(userId: Int): Result<Unit> {
        return try {
            val response = NexaApiClient.userApi.followUser(userId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to follow user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun unfollowUser(userId: Int): Result<Unit> {
        return try {
            val response = NexaApiClient.userApi.unfollowUser(userId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to unfollow user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
