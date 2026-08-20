package com.nexa.social.data.models

import com.google.gson.annotations.SerializedName

data class ApiResponse<T>(
    @SerializedName("data") val data: T?,
    @SerializedName("message") val message: String?,
    @SerializedName("error") val error: ApiError?
)

data class ApiError(
    @SerializedName("code") val code: String?,
    @SerializedName("message") val message: String?,
    @SerializedName("details") val details: List<Any>?
)

data class User(
    @SerializedName("userId") val userId: Int,
    @SerializedName("username") val username: String,
    @SerializedName("email") val email: String?,
    @SerializedName("displayName") val displayName: String,
    @SerializedName("bio") val bio: String? = null,
    @SerializedName("profileImageUrl") val profileImageUrl: String? = null,
    @SerializedName("coverImageUrl") val coverImageUrl: String? = null,
    @SerializedName("location") val location: String? = null,
    @SerializedName("websiteUrl") val websiteUrl: String? = null,
    @SerializedName("followersCount") val followersCount: Int = 0,
    @SerializedName("followingCount") val followingCount: Int = 0
)

data class LoginRequest(
    @SerializedName("emailOrUsername") val emailOrUsername: String,
    @SerializedName("password") val password: String
)

data class RegisterRequest(
    @SerializedName("username") val username: String,
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("displayName") val displayName: String,
    @SerializedName("bio") val bio: String? = null,
    @SerializedName("location") val location: String? = null,
    @SerializedName("websiteUrl") val websiteUrl: String? = null
)

data class ForgotPasswordRequest(
    @SerializedName("email") val email: String
)

data class VerifyEmailRequest(
    @SerializedName("token") val token: String
)

data class ResetPasswordRequest(
    @SerializedName("token") val token: String,
    @SerializedName("newPassword") val newPassword: String
)

data class LoginResponse(
    @SerializedName("user") val user: User,
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String?
)

data class RefreshTokenRequest(
    @SerializedName("refreshToken") val refreshToken: String
)

data class RefreshTokenResponse(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String?
)

data class Post(
    @SerializedName("postId") val postId: Int,
    @SerializedName("userId") val userId: Int,
    @SerializedName("content") val content: String?,
    @SerializedName("imageUrl") val imageUrl: String?,
    @SerializedName("likesCount") val likesCount: Int = 0,
    @SerializedName("commentsCount") val commentsCount: Int = 0,
    @SerializedName("isLiked") val isLiked: Boolean = false,
    @SerializedName("isBookmarked") val isBookmarked: Boolean = false,
    @SerializedName("author") val author: User,
    @SerializedName("createdAt") val createdAt: String?
)

data class Reel(
    @SerializedName("reelId") val reelId: Int,
    @SerializedName("userId") val userId: Int,
    @SerializedName("videoUrl") val videoUrl: String,
    @SerializedName("caption") val caption: String?,
    @SerializedName("likesCount") val likesCount: Int = 0,
    @SerializedName("isLiked") val isLiked: Boolean = false,
    @SerializedName("author") val author: User,
    @SerializedName("createdAt") val createdAt: String?
)

data class Message(
    @SerializedName("messageId") val messageId: Int,
    @SerializedName("senderId") val senderId: Int,
    @SerializedName("receiverId") val receiverId: Int,
    @SerializedName("content") val content: String,
    @SerializedName("isRead") val isRead: Boolean = false,
    @SerializedName("createdAt") val createdAt: String?
)

data class SendDirectMessageRequest(
    @SerializedName("receiverId") val receiverId: Int,
    @SerializedName("content") val content: String
)

data class MarkReadResponse(
    @SerializedName("rowsAffected") val rowsAffected: Int?,
    @SerializedName("read") val read: Boolean?,
    @SerializedName("readAt") val readAt: String?
)

data class Conversation(
    @SerializedName("otherUserId") val otherUserId: Int,
    @SerializedName("username") val username: String,
    @SerializedName("displayName") val displayName: String,
    @SerializedName("profileImageUrl") val profileImageUrl: String?,
    @SerializedName("lastMessage") val lastMessage: String,
    @SerializedName("lastMessageAt") val lastMessageAt: String,
    @SerializedName("unreadCount") val unreadCount: Int
)

data class Group(
    @SerializedName("groupId") val groupId: Int,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String?,
    @SerializedName("createdBy") val createdBy: Int,
    @SerializedName("avatarUrl") val avatarUrl: String?,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("membersCount") val membersCount: Int = 1,
    @SerializedName("lastMessage") val lastMessage: String?
)

data class GroupSender(
    @SerializedName("userId") val userId: Int,
    @SerializedName("username") val username: String,
    @SerializedName("displayName") val displayName: String,
    @SerializedName("profileImageUrl") val profileImageUrl: String?
)

data class GroupMessage(
    @SerializedName("messageId") val messageId: Int,
    @SerializedName("groupId") val groupId: Int,
    @SerializedName("senderId") val senderId: Int,
    @SerializedName("sender") val sender: GroupSender,
    @SerializedName("content") val content: String,
    @SerializedName("createdAt") val createdAt: String?
)

data class Broadcast(
    @SerializedName("broadcastId") val broadcastId: Int,
    @SerializedName("senderId") val senderId: Int,
    @SerializedName("title") val title: String?,
    @SerializedName("content") val content: String,
    @SerializedName("recipientsCount") val recipientsCount: Int,
    @SerializedName("createdAt") val createdAt: String?
)

data class MediaUploadResponse(
    @SerializedName("assetId") val assetId: String?,
    @SerializedName("publicUrl") val publicUrl: String?,
    @SerializedName("mediaKind") val mediaKind: String?
)

data class CreatePostRequest(
    @SerializedName("content") val content: String,
    @SerializedName("imageUrl") val imageUrl: String? = null
)

data class FcmTokenRequest(
    @SerializedName("fcmToken") val fcmToken: String,
    @SerializedName("platform") val platform: String = "android",
    @SerializedName("deviceId") val deviceId: String? = null
)

data class DisplayMessage(
    val id: Int,
    val senderId: Int,
    val senderName: String?,
    val content: String,
    val isSelf: Boolean,
    val timestamp: String?
)

data class Comment(
    @SerializedName("commentId") val commentId: Int,
    @SerializedName("postId") val postId: Int,
    @SerializedName("userId") val userId: Int,
    @SerializedName("content") val content: String,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("author") val author: User? = null
)

data class CreateCommentRequest(
    @SerializedName("content") val content: String
)

data class UpdateProfileRequest(
    @SerializedName("displayName") val displayName: String?,
    @SerializedName("bio") val bio: String? = null,
    @SerializedName("location") val location: String? = null,
    @SerializedName("websiteUrl") val websiteUrl: String? = null,
    @SerializedName("profileImageUrl") val profileImageUrl: String? = null,
    @SerializedName("coverImageUrl") val coverImageUrl: String? = null
)
