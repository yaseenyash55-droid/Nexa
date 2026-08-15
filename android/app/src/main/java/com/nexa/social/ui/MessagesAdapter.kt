package com.nexa.social.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.nexa.social.R
import com.nexa.social.utils.AndroidE2EE

data class DisplayMessage(
    val id: Int,
    val senderId: Int,
    val senderName: String?,
    val rawContent: String,
    val isSelf: Boolean,
    val timestamp: String?
)

class MessagesAdapter(
    private val currentUserId: Int,
    private val otherUserId: Int?
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        private const val TYPE_SENT = 1
        private const val TYPE_RECEIVED = 2
    }

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
        val (decryptedText, isEncrypted) = if (otherUserId != null) {
            AndroidE2EE.decryptMessage(currentUserId, otherUserId, msg.rawContent)
        } else {
            Pair(msg.rawContent, false)
        }

        if (holder is SentViewHolder) {
            holder.bind(msg, decryptedText, isEncrypted)
        } else if (holder is ReceivedViewHolder) {
            holder.bind(msg, decryptedText, isEncrypted)
        }
    }

    override fun getItemCount(): Int = messages.size

    class SentViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)

        fun bind(msg: DisplayMessage, decryptedText: String, isEncrypted: Boolean) {
            tvContent.text = decryptedText
            tvTime.text = if (isEncrypted) "🔒 E2EE" else "Sent"
        }
    }

    class ReceivedViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvSenderName: TextView = itemView.findViewById(R.id.tvSenderName)
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)

        fun bind(msg: DisplayMessage, decryptedText: String, isEncrypted: Boolean) {
            if (!msg.senderName.isNullOrEmpty()) {
                tvSenderName.text = msg.senderName
                tvSenderName.visibility = View.VISIBLE
            } else {
                tvSenderName.visibility = View.GONE
            }

            tvContent.text = decryptedText
            tvTime.text = if (isEncrypted) "🔒 E2EE" else "Received"
        }
    }
}
