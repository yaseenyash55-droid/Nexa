package com.nexa.social.ui.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.Conversation
import com.nexa.social.databinding.ItemConversationBinding

class ConversationAdapter(
    private val onClick: (Conversation) -> Unit
) : ListAdapter<Conversation, ConversationAdapter.ConversationViewHolder>(ConversationDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ConversationViewHolder {
        val binding = ItemConversationBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ConversationViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ConversationViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ConversationViewHolder(private val binding: ItemConversationBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(conversation: Conversation) {
            binding.tvDisplayName.text = conversation.resolvedDisplayName()
            binding.tvUsername.text = "@${conversation.resolvedUsername()}"
            binding.tvUsername.visibility = View.VISIBLE
            binding.tvLastMessage.text = conversation.messagePreview()
            binding.tvTimestamp.text = conversation.lastMessageAt.orEmpty()

            if (conversation.unreadCount > 0) {
                binding.unreadBadge.visibility = View.VISIBLE
                binding.unreadBadge.text = conversation.unreadCount.toString()
            } else {
                binding.unreadBadge.visibility = View.GONE
            }

            val avatarUrl = conversation.resolvedProfileImageUrl()?.let {
                if (it.startsWith("http")) it else "${NexaApiClient.BASE_URL.removeSuffix("api/")}${it.removePrefix("/")}"
            }
            binding.ivAvatar.load(avatarUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_profile)
                error(R.drawable.ic_profile)
                transformations(CircleCropTransformation())
            }

            binding.root.setOnClickListener { onClick(conversation) }
        }
    }

    class ConversationDiffCallback : DiffUtil.ItemCallback<Conversation>() {
        override fun areItemsTheSame(oldItem: Conversation, newItem: Conversation): Boolean = oldItem.otherUserId == newItem.otherUserId
        override fun areContentsTheSame(oldItem: Conversation, newItem: Conversation): Boolean = oldItem == newItem
    }
}
