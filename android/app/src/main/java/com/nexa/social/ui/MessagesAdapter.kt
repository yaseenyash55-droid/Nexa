package com.nexa.social.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.nexa.social.R
import com.nexa.social.data.models.DisplayMessage
import com.nexa.social.utils.ChatTheme

class MessagesAdapter(
    private val currentUserId: Int,
    private var chatTheme: ChatTheme = ChatTheme.INDIGO_DEFAULT,
    private val onMarkAsReadClick: ((DisplayMessage) -> Unit)? = null
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private val messages = mutableListOf<DisplayMessage>()

    fun setChatTheme(newTheme: ChatTheme) {
        this.chatTheme = newTheme
        notifyDataSetChanged()
    }

    fun submitList(newMessages: List<DisplayMessage>) {
        messages.clear()
        messages.addAll(newMessages)
        notifyDataSetChanged()
    }

    fun addMessage(message: DisplayMessage) {
        val existingIndex = messages.indexOfFirst { it.id == message.id }
        if (existingIndex >= 0) {
            messages[existingIndex] = message
            notifyItemChanged(existingIndex)
        } else {
            messages.add(message)
            notifyItemInserted(messages.size - 1)
        }
    }

    fun markMessageRead(messageId: Int) {
        val index = messages.indexOfFirst { it.id == messageId }
        if (index >= 0) {
            messages[index] = messages[index].copy(isRead = true)
            notifyItemChanged(index)
        }
    }

    fun markAllRead() {
        for (i in messages.indices) {
            if (!messages[i].isRead) {
                messages[i] = messages[i].copy(isRead = true)
            }
        }
        notifyDataSetChanged()
    }

    fun getItems(): List<DisplayMessage> = messages.toList()

    override fun getItemViewType(position: Int): Int {
        return if (messages[position].isSelf) TYPE_SENT else TYPE_RECEIVED
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return if (viewType == TYPE_SENT) {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_message_sent, parent, false)
            SentViewHolder(view)
        } else {
            val view = LayoutInflater.from(parent.context).inflate(R.layout.item_message_received, parent, false)
            ReceivedViewHolder(view, onMarkAsReadClick)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val msg = messages[position]
        if (holder is SentViewHolder) {
            holder.bind(msg, chatTheme)
        } else if (holder is ReceivedViewHolder) {
            holder.bind(msg, chatTheme)
        }
    }

    override fun getItemCount(): Int = messages.size

    class SentViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)
        private val tvReadStatus: TextView? = itemView.findViewById(R.id.tvReadStatus)
        private val bubbleLayout: View? = itemView.findViewById(R.id.bubbleLayout)

        fun bind(msg: DisplayMessage, theme: ChatTheme) {
            bubbleLayout?.background = theme.createSentBubbleDrawable()
            tvContent.setTextColor(theme.sentTextColor)
            tvContent.text = msg.content
            val time = formatTimestamp(msg.timestamp) ?: "Sent"
            tvTime.text = time
            if (msg.isRead) {
                tvReadStatus?.visibility = View.VISIBLE
                tvReadStatus?.text = "✓✓ Read"
                tvReadStatus?.setTextColor(theme.readReceiptColor)
            } else {
                tvReadStatus?.visibility = View.GONE
            }
        }
    }

    class ReceivedViewHolder(
        itemView: View,
        private val onMarkAsReadClick: ((DisplayMessage) -> Unit)?
    ) : RecyclerView.ViewHolder(itemView) {
        private val tvSenderName: TextView = itemView.findViewById(R.id.tvSenderName)
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)
        private val btnMarkRead: TextView? = itemView.findViewById(R.id.btnMarkRead)
        private val tvReadStatus: TextView? = itemView.findViewById(R.id.tvReadStatus)
        private val bubbleLayout: View? = itemView.findViewById(R.id.bubbleLayout)

        fun bind(msg: DisplayMessage, theme: ChatTheme) {
            bubbleLayout?.background = theme.createReceivedBubbleDrawable()
            tvContent.setTextColor(theme.receivedTextColor)
            if (!msg.senderName.isNullOrEmpty()) {
                tvSenderName.text = msg.senderName
                tvSenderName.visibility = View.VISIBLE
            } else {
                tvSenderName.visibility = View.GONE
            }

            tvContent.text = msg.content
            tvTime.text = formatTimestamp(msg.timestamp) ?: "Received"

            if (msg.isRead) {
                btnMarkRead?.visibility = View.GONE
                tvReadStatus?.visibility = View.VISIBLE
                tvReadStatus?.setTextColor(theme.readReceiptColor)
            } else {
                btnMarkRead?.visibility = View.VISIBLE
                btnMarkRead?.background = theme.createMarkReadButtonDrawable()
                btnMarkRead?.setTextColor(theme.markReadTextColor)
                tvReadStatus?.visibility = View.GONE
                btnMarkRead?.setOnClickListener {
                    onMarkAsReadClick?.invoke(msg)
                }
            }

            bubbleLayout?.setOnLongClickListener {
                if (!msg.isRead) {
                    onMarkAsReadClick?.invoke(msg)
                }
                true
            }
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
