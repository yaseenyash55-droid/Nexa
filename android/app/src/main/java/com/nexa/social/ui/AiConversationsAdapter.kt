package com.nexa.social.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.nexa.social.R
import com.nexa.social.data.models.AiConversation
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class AiConversationsAdapter(
    private val onConversationSelected: (AiConversation) -> Unit,
    private val onDeleteClicked: (AiConversation) -> Unit
) : ListAdapter<AiConversation, AiConversationsAdapter.ConversationViewHolder>(AiConversationDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ConversationViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_ai_conversation, parent, false)
        return ConversationViewHolder(view)
    }

    override fun onBindViewHolder(holder: ConversationViewHolder, position: Int) {
        val item = getItem(position)
        holder.bind(item)
    }

    inner class ConversationViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvTitle: TextView = itemView.findViewById(R.id.tvConversationTitle)
        private val tvDate: TextView = itemView.findViewById(R.id.tvConversationDate)
        private val btnDelete: ImageButton = itemView.findViewById(R.id.btnDeleteConversation)

        fun bind(conversation: AiConversation) {
            tvTitle.text = if (conversation.title.isNotBlank()) conversation.title else "Untitled Conversation"
            tvDate.text = formatConversationDate(conversation.updatedAt ?: conversation.createdAt)

            itemView.setOnClickListener {
                onConversationSelected(conversation)
            }

            btnDelete.setOnClickListener {
                onDeleteClicked(conversation)
            }
        }
    }

    private class AiConversationDiffCallback : DiffUtil.ItemCallback<AiConversation>() {
        override fun areItemsTheSame(oldItem: AiConversation, newItem: AiConversation): Boolean {
            return oldItem.conversationId == newItem.conversationId
        }

        override fun areContentsTheSame(oldItem: AiConversation, newItem: AiConversation): Boolean {
            return oldItem == newItem
        }
    }
}

private fun formatConversationDate(isoString: String?): String {
    if (isoString.isNullOrBlank()) return "Recent"
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val date: Date = parser.parse(isoString) ?: return "Recent"
        val formatter = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
        formatter.format(date)
    } catch (_: Exception) {
        try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val date: Date = parser.parse(isoString) ?: return "Recent"
            val formatter = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
            formatter.format(date)
        } catch (_: Exception) {
            "Recent"
        }
    }
}
