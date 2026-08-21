package com.nexa.social.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.nexa.social.R
import com.nexa.social.data.models.DisplayMessage

class MessagesAdapter(
    private val currentUserId: Int
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private val messages = mutableListOf<DisplayMessage>()

    fun submitList(newMessages: List<DisplayMessage>) {
        messages.clear()
        messages.addAll(newMessages)
        notifyDataSetChanged()
    }

    fun addMessage(message: DisplayMessage) {
        messages.add(message)
        notifyItemInserted(messages.size - 1)
    }

    fun markMessageRead(messageId: Int) {
        val index = messages.indexOfFirst { it.id == messageId }
        if (index >= 0 && messages[index].isSelf) {
            messages[index] = messages[index].copy(isRead = true)
            notifyItemChanged(index)
        }
    }

    override fun getItemViewType(position: Int): Int {
        return if (messages[position].isSelf) TYPE_SENT else TYPE_RECEIVED
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return if (viewType == TYPE_SENT) {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_message_sent, parent, false)
            SentViewHolder(view)
        } else {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_message_received, parent, false)
            ReceivedViewHolder(view)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val msg = messages[position]
        if (holder is SentViewHolder) {
            holder.bind(msg)
        } else if (holder is ReceivedViewHolder) {
            holder.bind(msg)
        }
    }

    override fun getItemCount(): Int = messages.size

    class SentViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)

        fun bind(msg: DisplayMessage) {
            tvContent.text = msg.content
            val time = formatTimestamp(msg.timestamp) ?: "Sent"
            tvTime.text = if (msg.isRead) "$time â€¢ Read" else time
        }
    }

    class ReceivedViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvSenderName: TextView = itemView.findViewById(R.id.tvSenderName)
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)

        fun bind(msg: DisplayMessage) {
            if (!msg.senderName.isNullOrEmpty()) {
                tvSenderName.text = msg.senderName
                tvSenderName.visibility = View.VISIBLE
            } else {
                tvSenderName.visibility = View.GONE
            }

            tvContent.text = msg.content
            tvTime.text = formatTimestamp(msg.timestamp) ?: "Received"
        }
    }

    companion object {
        private const val TYPE_SENT = 1
        private const val TYPE_RECEIVED = 2

        fun formatTimestamp(timestamp: String?): String? {
            if (timestamp.isNullOrEmpty()) return null
            return try {
                if (timestamp.length >= 16 && timestamp.contains("T")) {
                    timestamp.substring(11, 16)
                } else {
                    timestamp
                }
            } catch (_: Exception) {
                timestamp
            }
        }
    }
}
