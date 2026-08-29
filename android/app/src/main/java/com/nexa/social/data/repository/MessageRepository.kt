package com.nexa.social.data.repository

import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.Conversation
import com.nexa.social.data.models.Message
import com.nexa.social.data.models.SendDirectMessageRequest

class MessageRepository {
    suspend fun getConversations(): Result<List<Conversation>> {
        return try {
            val response = NexaApiClient.messageApi.getConversations()
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to fetch conversations"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMessages(userId: Int): Result<List<Message>> {
        return try {
            val response = NexaApiClient.messageApi.getMessagesWithUser(userId)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to fetch messages"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendMessage(receiverId: Int, content: String): Result<Message> {
        return try {
            val request = SendDirectMessageRequest(
                receiverId = receiverId,
                content = content,
                replyToMessageId = null // Could be added as parameter if needed
            )
            val response = NexaApiClient.messageApi.sendMessage(request)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to send message"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    suspend fun editMessage(messageId: Int, content: String): Result<Message> {
        return try {
            val response = NexaApiClient.messageApi.editMessage(messageId, com.nexa.social.data.models.EditMessageRequest(content))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to edit message"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun unsendMessage(messageId: Int): Result<Unit> {
        return try {
            val response = NexaApiClient.messageApi.unsendMessage(messageId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to unsend message"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addReaction(messageId: Int, reaction: String): Result<Message> {
        return try {
            val response = NexaApiClient.messageApi.addReaction(messageId, com.nexa.social.data.models.AddReactionRequest(reaction))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to add reaction"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun removeReaction(messageId: Int): Result<Message> {
        return try {
            val response = NexaApiClient.messageApi.removeReaction(messageId)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to remove reaction"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
