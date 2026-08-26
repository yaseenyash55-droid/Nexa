package com.nexa.social.ui.adapters

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.google.android.material.button.MaterialButton
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.User

class UserConnectionAdapter(
    private val currentUserId: Int,
    private val isOwnerProfile: Boolean,
    private var activeTab: String = "followers",
    private val onUserClick: (User) -> Unit,
    private val onMessageClick: (User) -> Unit,
    private val onFollowToggle: (User, Boolean) -> Unit,
    private val onRemoveFollowerClick: ((User) -> Unit)? = null
) : RecyclerView.Adapter<UserConnectionAdapter.UserViewHolder>() {

    private val users = mutableListOf<User>()
    private val followingStateMap = mutableMapOf<Int, Boolean>()

    fun submitList(newUsers: List<User>, tab: String = activeTab) {
        this.activeTab = tab
        users.clear()
        users.addAll(newUsers)
        newUsers.forEach { user ->
            if (!followingStateMap.containsKey(user.userId)) {
                followingStateMap[user.userId] = user.isFollowing
            }
        }
        notifyDataSetChanged()
    }

    fun updateUserFollowState(userId: Int, isFollowing: Boolean) {
        followingStateMap[userId] = isFollowing
        val index = users.indexOfFirst { it.userId == userId }
        if (index >= 0) {
            notifyItemChanged(index)
        }
    }

    fun removeUser(userId: Int) {
        val index = users.indexOfFirst { it.userId == userId }
        if (index >= 0) {
            users.removeAt(index)
            notifyItemRemoved(index)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_user_connection, parent, false)
        return UserViewHolder(view)
    }

    override fun onBindViewHolder(holder: UserViewHolder, position: Int) {
        holder.bind(users[position])
    }

    override fun getItemCount(): Int = users.size

    inner class UserViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val ivAvatar: ImageView = itemView.findViewById(R.id.ivUserAvatar)
        private val tvDisplayName: TextView = itemView.findViewById(R.id.tvDisplayName)
        private val tvUsername: TextView = itemView.findViewById(R.id.tvUsername)
        private val btnDirectMessage: ImageButton = itemView.findViewById(R.id.btnDirectMessage)
        private val btnFollowAction: MaterialButton = itemView.findViewById(R.id.btnFollowAction)

        fun bind(user: User) {
            tvDisplayName.text = user.displayName.ifEmpty { user.username }
            tvUsername.text = "@${user.username}"

            val avatarUrl = user.profileImageUrl?.let {
                if (it.startsWith("http")) it else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${it.removePrefix("/")}"
            }
            ivAvatar.load(avatarUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_profile)
                error(R.drawable.ic_profile)
                transformations(CircleCropTransformation())
            }

            val isSelf = user.userId == currentUserId

            if (isSelf) {
                btnDirectMessage.visibility = View.GONE
                btnFollowAction.visibility = View.GONE
            } else {
                btnDirectMessage.visibility = View.VISIBLE
                btnFollowAction.visibility = View.VISIBLE

                val isFollowing = followingStateMap[user.userId] ?: user.isFollowing

                if (isOwnerProfile && activeTab == "followers") {
                    // Profile owner can remove follower
                    btnFollowAction.text = "Remove"
                    btnFollowAction.setBackgroundColor(ContextCompat.getColor(itemView.context, R.color.border_dark))
                    btnFollowAction.setTextColor(ContextCompat.getColor(itemView.context, R.color.text_secondary))
                    btnFollowAction.setOnClickListener {
                        onRemoveFollowerClick?.invoke(user)
                    }
                } else {
                    if (isFollowing) {
                        btnFollowAction.text = "Following"
                        btnFollowAction.setBackgroundColor(ContextCompat.getColor(itemView.context, R.color.border_dark))
                        btnFollowAction.setTextColor(Color.WHITE)
                    } else {
                        btnFollowAction.text = "Follow"
                        btnFollowAction.setBackgroundColor(ContextCompat.getColor(itemView.context, R.color.brand_indigo))
                        btnFollowAction.setTextColor(Color.WHITE)
                    }
                    btnFollowAction.setOnClickListener {
                        onFollowToggle(user, isFollowing)
                    }
                }

                btnDirectMessage.setOnClickListener {
                    onMessageClick(user)
                }
            }

            itemView.setOnClickListener {
                onUserClick(user)
            }
        }
    }
}
