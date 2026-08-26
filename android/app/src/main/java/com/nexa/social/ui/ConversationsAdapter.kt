package com.nexa.social.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.Broadcast
import com.nexa.social.data.models.Conversation
import com.nexa.social.data.models.Group

sealed class ConversationItem {
    data class Direct(val conversation: Conversation) : ConversationItem()
    data class GroupChat(val group: Group) : ConversationItem()
    data class BroadcastList(val broadcast: Broadcast) : ConversationItem()
}

class ConversationsAdapter(
    private val onItemClick: (ConversationItem) -> Unit
) : RecyclerView.Adapter<ConversationsAdapter.ViewHolder>() {

    private val items = mutableListOf<ConversationItem>()

    fun submitList(newItems: List<ConversationItem>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_conversation, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val ivAvatar: ImageView = itemView.findViewById(R.id.ivAvatar)
        private val tvDisplayName: TextView = itemView.findViewById(R.id.tvDisplayName)
        private val tvUsername: TextView = itemView.findViewById(R.id.tvUsername)
        private val tvLastMessage: TextView = itemView.findViewById(R.id.tvLastMessage)
        private val tvTimestamp: TextView = itemView.findViewById(R.id.tvTimestamp)
        private val unreadBadge: TextView = itemView.findViewById(R.id.unreadBadge)

        fun bind(item: ConversationItem) {
            when (item) {
                is ConversationItem.Direct -> {
                    val conv = item.conversation
                    tvDisplayName.text = conv.resolvedDisplayName()
                    tvUsername.text = "@${conv.resolvedUsername()}"
                    tvUsername.visibility = View.VISIBLE

                    val lastMsg = conv.lastMessage?.trim() ?: ""
                    tvLastMessage.text = when {
                        lastMsg.startsWith("[GIF:") || lastMsg.endsWith(".gif") -> "✨ GIF animation"
                        lastMsg.contains("[Photo]") || lastMsg.contains("📷") -> "📷 Photo attachment"
                        lastMsg.contains("[File]") || lastMsg.contains("📁") -> "📁 File attachment"
                        lastMsg.isNotEmpty() -> lastMsg
                        else -> "Tap to send message"
                    }

                    tvTimestamp.text = formatTimestamp(conv.lastMessageAt)

                    if (conv.unreadCount > 0) {
                        unreadBadge.text = if (conv.unreadCount > 99) "99+" else conv.unreadCount.toString()
                        unreadBadge.visibility = View.VISIBLE
                    } else {
                        unreadBadge.visibility = View.GONE
                    }

                    val avatarUrl = conv.resolvedProfileImageUrl()?.let {
                        if (it.startsWith("http")) it else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${it.removePrefix("/")}"
                    }
                    ivAvatar.load(avatarUrl) {
                        crossfade(true)
                        placeholder(R.drawable.ic_profile)
                        error(R.drawable.ic_profile)
                        transformations(CircleCropTransformation())
                    }
                }
                is ConversationItem.GroupChat -> {
                    val group = item.group
                    tvDisplayName.text = group.name
                    tvUsername.text = "(${group.membersCount ?: 1} members)"
                    tvUsername.visibility = View.VISIBLE

                    val lastMsg = group.lastMessage?.trim() ?: ""
                    tvLastMessage.text = if (lastMsg.isNotEmpty()) lastMsg else (group.description ?: "Group conversation")
                    tvTimestamp.text = formatTimestamp(group.createdAt)
                    unreadBadge.visibility = View.GONE

                    val avatarUrl = group.avatarUrl?.let {
                        if (it.startsWith("http")) it else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${it.removePrefix("/")}"
                    }
                    ivAvatar.load(avatarUrl) {
                        crossfade(true)
                        placeholder(R.drawable.ic_profile)
                        error(R.drawable.ic_profile)
                        transformations(CircleCropTransformation())
                    }
                }
                is ConversationItem.BroadcastList -> {
                    val bc = item.broadcast
                    tvDisplayName.text = bc.title ?: "Broadcast"
                    tvUsername.text = "(${bc.recipientsCount} recipients)"
                    tvUsername.visibility = View.VISIBLE
                    tvLastMessage.text = bc.content
                    tvTimestamp.text = formatTimestamp(bc.createdAt)
                    unreadBadge.visibility = View.GONE

                    ivAvatar.load(R.drawable.ic_profile) {
                        transformations(CircleCropTransformation())
                    }
                }
            }

            itemView.setOnClickListener {
                onItemClick(item)
            }
        }

        private fun formatTimestamp(timestamp: String?): String {
            if (timestamp.isNullOrEmpty()) return ""
            return try {
                if (timestamp.length >= 16 && timestamp.contains("T")) {
                    timestamp.substring(11, 16)
                } else {
                    timestamp
                }
            } catch (_: Exception) {
                ""
            }
        }
    }
}
