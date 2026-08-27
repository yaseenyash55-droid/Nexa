package com.nexa.social.ui

import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.google.android.material.card.MaterialCardView
import com.nexa.social.R
import com.nexa.social.data.models.DisplayMessage
import com.nexa.social.utils.ChatTheme

import com.nexa.social.utils.MediaCacheManager

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
        private val cardMedia: MaterialCardView? = itemView.findViewById(R.id.cardMedia)
        private val imgMediaAttachment: ImageView? = itemView.findViewById(R.id.imgMediaAttachment)
        private val layoutFileAttachment: View? = itemView.findViewById(R.id.layoutFileAttachment)
        private val tvFileName: TextView? = itemView.findViewById(R.id.tvFileName)

        fun bind(msg: DisplayMessage, theme: ChatTheme) {
            bubbleLayout?.background = theme.createSentBubbleDrawable()
            tvContent.setTextColor(theme.sentTextColor)

            bindMessageAttachments(
                content = msg.content,
                tvContent = tvContent,
                cardMedia = cardMedia,
                imgMediaAttachment = imgMediaAttachment,
                layoutFileAttachment = layoutFileAttachment,
                tvFileName = tvFileName
            )

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
        private val cardMedia: MaterialCardView? = itemView.findViewById(R.id.cardMedia)
        private val imgMediaAttachment: ImageView? = itemView.findViewById(R.id.imgMediaAttachment)
        private val layoutFileAttachment: View? = itemView.findViewById(R.id.layoutFileAttachment)
        private val tvFileName: TextView? = itemView.findViewById(R.id.tvFileName)

        fun bind(msg: DisplayMessage, theme: ChatTheme) {
            bubbleLayout?.background = theme.createReceivedBubbleDrawable()
            tvContent.setTextColor(theme.receivedTextColor)
            if (!msg.senderName.isNullOrEmpty()) {
                tvSenderName.text = msg.senderName
                tvSenderName.visibility = View.VISIBLE
            } else {
                tvSenderName.visibility = View.GONE
            }

            bindMessageAttachments(
                content = msg.content,
                tvContent = tvContent,
                cardMedia = cardMedia,
                imgMediaAttachment = imgMediaAttachment,
                layoutFileAttachment = layoutFileAttachment,
                tvFileName = tvFileName
            )

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

        private val photoRegex = Regex("""(?:📷\s*\[Photo\]\s*|(?:^|\s))(https?://\S+\.(?:jpg|jpeg|png|webp|gif)(?:\?\S*)?|https?://\S*supabase\.co\S*|https?://\S*/uploads/\S+)""", RegexOption.IGNORE_CASE)
        private val fileRegex = Regex("""(?:📁\s*\[File\]\s*)(https?://\S+)""", RegexOption.IGNORE_CASE)
        private val gifRegex = Regex("""^\[GIF:\s*(https?://\S+?)\]$""", RegexOption.IGNORE_CASE)

        private fun bindMessageAttachments(
            content: String,
            tvContent: TextView,
            cardMedia: MaterialCardView?,
            imgMediaAttachment: ImageView?,
            layoutFileAttachment: View?,
            tvFileName: TextView?
        ) {
            val context = tvContent.context
            val gifMatch = gifRegex.find(content.trim())
            if (gifMatch != null) {
                val gifUrl = gifMatch.groupValues[1]
                cardMedia?.visibility = View.VISIBLE
                
                // Show placeholder/loading state first
                imgMediaAttachment?.setImageResource(R.drawable.bg_input_field)
                
                MediaCacheManager.getCachedFileOrDownload(context, gifUrl) { localFile ->
                    if (localFile != null) {
                        imgMediaAttachment?.load(localFile) {
                            crossfade(true)
                            placeholder(R.drawable.bg_input_field)
                            error(R.drawable.bg_input_field)
                        }
                    } else {
                        imgMediaAttachment?.load(gifUrl) {
                            crossfade(true)
                            placeholder(R.drawable.bg_input_field)
                            error(R.drawable.bg_input_field)
                        }
                    }
                }
                cardMedia?.setOnClickListener {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(gifUrl))
                        it.context.startActivity(intent)
                    } catch (_: Exception) {}
                }
                layoutFileAttachment?.visibility = View.GONE
                tvContent.visibility = View.GONE
                return
            }

            val photoMatch = photoRegex.find(content)
            val fileMatch = fileRegex.find(content)

            if (photoMatch != null) {
                val url = photoMatch.groupValues[1]
                val cleanText = content.replace(photoMatch.value, "").trim()

                cardMedia?.visibility = View.VISIBLE
                
                // Show placeholder/loading state first
                imgMediaAttachment?.setImageResource(R.drawable.ic_gallery)

                MediaCacheManager.getCachedFileOrDownload(context, url) { localFile ->
                    if (localFile != null) {
                        imgMediaAttachment?.load(localFile) {
                            crossfade(true)
                            placeholder(R.drawable.ic_gallery)
                            error(R.drawable.ic_gallery)
                        }
                    } else {
                        imgMediaAttachment?.load(url) {
                            crossfade(true)
                            placeholder(R.drawable.ic_gallery)
                            error(R.drawable.ic_gallery)
                        }
                    }
                }
                cardMedia?.setOnClickListener {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        it.context.startActivity(intent)
                    } catch (_: Exception) {}
                }

                layoutFileAttachment?.visibility = View.GONE
                if (cleanText.isNotEmpty()) {
                    tvContent.text = cleanText
                    tvContent.visibility = View.VISIBLE
                } else {
                    tvContent.visibility = View.GONE
                }
                return
            }

            if (fileMatch != null) {
                val url = fileMatch.groupValues[1]
                val cleanText = content.replace(fileMatch.value, "").trim()
                val fileName = url.substringAfterLast("/").substringBefore("?")

                layoutFileAttachment?.visibility = View.VISIBLE
                tvFileName?.text = Uri.decode(fileName)
                
                layoutFileAttachment?.setOnClickListener {
                    // Start checking cache or download file to open
                    MediaCacheManager.getCachedFileOrDownload(context, url) { localFile ->
                        try {
                            val uri = if (localFile != null) {
                                // Fallback to content URI if needed, or open directly
                                Uri.fromFile(localFile)
                            } else {
                                Uri.parse(url)
                            }
                            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                                if (localFile != null) {
                                    setDataAndType(uri, context.contentResolver.getType(uri) ?: "*/*")
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                            }
                            context.startActivity(intent)
                        } catch (_: Exception) {
                            // Fallback to opening raw URL in browser
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                context.startActivity(intent)
                            } catch (_: Exception) {}
                        }
                    }
                }

                cardMedia?.visibility = View.GONE
                if (cleanText.isNotEmpty()) {
                    tvContent.text = cleanText
                    tvContent.visibility = View.VISIBLE
                } else {
                    tvContent.visibility = View.GONE
                }
                return
            }

            // Normal text message
            cardMedia?.visibility = View.GONE
            layoutFileAttachment?.visibility = View.GONE
            tvContent.text = content
            tvContent.visibility = View.VISIBLE
        }

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
