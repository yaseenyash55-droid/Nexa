package com.nexa.social.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.nexa.social.R
import com.nexa.social.data.models.AiMessage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class AiMessagesAdapter : ListAdapter<AiMessage, RecyclerView.ViewHolder>(AiMessageDiffCallback()) {

    companion object {
        private const val VIEW_TYPE_USER = 1
        private const val VIEW_TYPE_ASSISTANT = 2
    }

    override fun getItemViewType(position: Int): Int {
        val item = getItem(position)
        return if (item.role == "user") VIEW_TYPE_USER else VIEW_TYPE_ASSISTANT
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == VIEW_TYPE_USER) {
            val view = inflater.inflate(R.layout.item_ai_message_user, parent, false)
            UserMessageViewHolder(view)
        } else {
            val view = inflater.inflate(R.layout.item_ai_message_assistant, parent, false)
            AssistantMessageViewHolder(view)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val item = getItem(position)
        if (holder is UserMessageViewHolder) {
            holder.bind(item)
        } else if (holder is AssistantMessageViewHolder) {
            holder.bind(item)
        }
    }

    class UserMessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)

        fun bind(message: AiMessage) {
            tvContent.text = message.content
            tvTime.text = formatTimestamp(message.createdAt) ?: "Sent"
        }
    }

    class AssistantMessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)
        private val tvModelBadge: TextView = itemView.findViewById(R.id.tvModelBadge)
        private val progressStreaming: ProgressBar = itemView.findViewById(R.id.progressStreaming)
        private val btnCopy: ImageButton = itemView.findViewById(R.id.btnCopy)

        fun bind(message: AiMessage) {
            tvContent.text = message.content
            tvTime.text = formatTimestamp(message.createdAt) ?: "Just now"

            if (message.isStreaming) {
                progressStreaming.visibility = View.VISIBLE
                tvModelBadge.text = "Generating..."
            } else {
                progressStreaming.visibility = View.GONE
                tvModelBadge.text = "Assistant"
            }

            btnCopy.setOnClickListener {
                val context = itemView.context
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("NEXA AI Response", message.content)
                clipboard.setPrimaryClip(clip)
                Toast.makeText(context, "Copied response to clipboard", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private class AiMessageDiffCallback : DiffUtil.ItemCallback<AiMessage>() {
        override fun areItemsTheSame(oldItem: AiMessage, newItem: AiMessage): Boolean {
            return if (oldItem.messageId != null && newItem.messageId != null) {
                oldItem.messageId == newItem.messageId
            } else {
                oldItem.role == newItem.role && oldItem.createdAt == newItem.createdAt
            }
        }

        override fun areContentsTheSame(oldItem: AiMessage, newItem: AiMessage): Boolean {
            return oldItem == newItem
        }
    }
}

private fun formatTimestamp(isoString: String?): String? {
    if (isoString.isNullOrBlank()) return null
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val date: Date = parser.parse(isoString) ?: return null
        val formatter = SimpleDateFormat("h:mm a", Locale.getDefault())
        formatter.format(date)
    } catch (_: Exception) {
        try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val date: Date = parser.parse(isoString) ?: return null
            val formatter = SimpleDateFormat("h:mm a", Locale.getDefault())
            formatter.format(date)
        } catch (_: Exception) {
            null
        }
    }
}
