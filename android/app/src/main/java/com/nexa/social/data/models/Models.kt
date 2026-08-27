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
    @SerializedName("followingCount") val followingCount: Int = 0,
    @SerializedName("isFollowing") val isFollowing: Boolean = false
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
    @SerializedName("email") val email: String,
    @SerializedName("code") val code: String
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

data class LoginResultResponse(
    @SerializedName("mfaRequired") val mfaRequired: Boolean = false,
    @SerializedName("challengeId") val challengeId: String? = null,
    @SerializedName("expiresAt") val expiresAt: String? = null,
    @SerializedName("maskedEmail") val maskedEmail: String? = null,
    @SerializedName("user") val user: User? = null,
    @SerializedName("accessToken") val accessToken: String? = null,
    @SerializedName("refreshToken") val refreshToken: String? = null
)

data class VerifyLoginOtpRequest(
    @SerializedName("challengeId") val challengeId: String,
    @SerializedName("code") val code: String
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

data class Story(
    @SerializedName("storyId") val storyId: Int,
    @SerializedName("userId") val userId: Int,
    @SerializedName("author") val author: User,
    @SerializedName("mediaUrl") val mediaUrl: String,
    @SerializedName("caption") val caption: String?,
    @SerializedName("musicTrackId") val musicTrackId: String? = null,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("expiresAt") val expiresAt: String?
)

data class CreateStoryRequest(
    @SerializedName("mediaUrl") val mediaUrl: String,
    @SerializedName("caption") val caption: String? = null,
    @SerializedName("musicTrackId") val musicTrackId: String? = null
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

data class ConversationParticipant(
    @SerializedName("userId") val userId: Int? = null,
    @SerializedName("username") val username: String? = null,
    @SerializedName("displayName") val displayName: String? = null,
    @SerializedName("profileImageUrl") val profileImageUrl: String? = null
)

data class Conversation(
    @SerializedName(value = "otherUserId", alternate = ["partnerId", "OTHER_USER_ID", "userId", "targetUserId"]) val otherUserId: Int,
    @SerializedName(value = "username", alternate = ["USERNAME", "handle", "userHandle"]) val username: String? = null,
    @SerializedName(value = "displayName", alternate = ["DISPLAY_NAME", "name", "fullName"]) val displayName: String? = null,
    @SerializedName(value = "profileImageUrl", alternate = ["PROFILE_IMAGE_URL", "avatarUrl", "avatar"]) val profileImageUrl: String? = null,
    @SerializedName(value = "lastMessage", alternate = ["LAST_MESSAGE", "content", "preview"]) val lastMessage: String? = null,
    @SerializedName(value = "lastMessageAt", alternate = ["LAST_MESSAGE_AT", "createdAt", "timestamp"]) val lastMessageAt: String? = null,
    @SerializedName(value = "unreadCount", alternate = ["UNREAD_COUNT", "unread_count"]) val unreadCount: Int = 0,
    @SerializedName(value = "user", alternate = ["participant", "otherUser"]) val participant: ConversationParticipant? = null
) {
    fun resolvedUsername(): String =
        username?.trim()?.takeIf { it.isNotEmpty() }
            ?: participant?.username?.trim()?.takeIf { it.isNotEmpty() }
            ?: "user_$otherUserId"

    fun resolvedDisplayName(): String =
        displayName?.trim()?.takeIf { it.isNotEmpty() }
            ?: participant?.displayName?.trim()?.takeIf { it.isNotEmpty() }
            ?: resolvedUsername()

    fun resolvedProfileImageUrl(): String? =
        profileImageUrl?.trim()?.takeIf { it.isNotEmpty() }
            ?: participant?.profileImageUrl?.trim()?.takeIf { it.isNotEmpty() }

    fun messagePreview(): String =
        lastMessage?.trim()?.takeIf { it.isNotEmpty() } ?: "Start a conversation"

    fun matchesSearch(query: String): Boolean {
        val normalizedQuery = query.trim()
        if (normalizedQuery.isEmpty()) return true
        return resolvedDisplayName().contains(normalizedQuery, ignoreCase = true) ||
            resolvedUsername().contains(normalizedQuery, ignoreCase = true) ||
            lastMessage.orEmpty().contains(normalizedQuery, ignoreCase = true)
    }
}

data class Group(
    @SerializedName(value = "groupId", alternate = ["GROUP_ID"]) val groupId: Int,
    @SerializedName(value = "name", alternate = ["NAME"]) val name: String,
    @SerializedName(value = "description", alternate = ["DESCRIPTION"]) val description: String?,
    @SerializedName(value = "createdBy", alternate = ["CREATED_BY"]) val createdBy: Int,
    @SerializedName(value = "avatarUrl", alternate = ["AVATAR_URL"]) val avatarUrl: String?,
    @SerializedName(value = "createdAt", alternate = ["CREATED_AT"]) val createdAt: String?,
    @SerializedName(value = "membersCount", alternate = ["MEMBERS_COUNT"]) val membersCount: Int = 1,
    @SerializedName(value = "lastMessage", alternate = ["LAST_MESSAGE"]) val lastMessage: String?,
    @SerializedName(value = "onlyAdminsCanPost", alternate = ["ONLY_ADMINS_CAN_POST"]) val onlyAdminsCanPost: Boolean = false
)

data class GroupMemberUser(
    @SerializedName(value = "userId", alternate = ["USER_ID"]) val userId: Int,
    @SerializedName(value = "username", alternate = ["USERNAME"]) val username: String,
    @SerializedName(value = "displayName", alternate = ["DISPLAY_NAME"]) val displayName: String,
    @SerializedName(value = "profileImageUrl", alternate = ["PROFILE_IMAGE_URL"]) val profileImageUrl: String? = null
)

data class GroupMember(
    @SerializedName(value = "groupId", alternate = ["GROUP_ID"]) val groupId: Int,
    @SerializedName(value = "userId", alternate = ["USER_ID"]) val userId: Int,
    @SerializedName(value = "role", alternate = ["ROLE"]) val role: String = "MEMBER",
    @SerializedName(value = "joinedAt", alternate = ["JOINED_AT"]) val joinedAt: String? = null,
    @SerializedName("user") val user: GroupMemberUser? = null
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

data class IceServerConfiguration(
    @SerializedName("urls") val urls: List<String> = emptyList(),
    @SerializedName("username") val username: String? = null,
    @SerializedName("credential") val credential: String? = null
)

data class IceConfiguration(
    @SerializedName("enabled") val enabled: Boolean = false,
    @SerializedName("iceServers") val iceServers: List<IceServerConfiguration> = emptyList(),
    @SerializedName("reason") val reason: String? = null
)

data class DisplayMessage(
    val id: Int,
    val senderId: Int,
    val senderName: String?,
    val content: String,
    val isSelf: Boolean,
    val timestamp: String?,
    val isRead: Boolean = false
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
    @SerializedName("username") val username: String? = null,
    @SerializedName("displayName") val displayName: String?,
    @SerializedName("bio") val bio: String? = null,
    @SerializedName("location") val location: String? = null,
    @SerializedName("websiteUrl") val websiteUrl: String? = null,
    @SerializedName("profileImageUrl") val profileImageUrl: String? = null,
    @SerializedName("coverImageUrl") val coverImageUrl: String? = null
)
