package com.nexa.social.ui

import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.SeekBar
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.google.android.material.card.MaterialCardView
import com.google.android.material.imageview.ShapeableImageView
import com.nexa.social.R
import com.nexa.social.data.models.DisplayMessage
import com.nexa.social.data.models.MessageAttachment
import com.nexa.social.data.models.MusicMetadata
import com.nexa.social.data.models.MusicTrack
import com.nexa.social.utils.ChatTheme
import com.nexa.social.utils.MediaCacheManager
import com.nexa.social.utils.MusicPlayerManager

class MessagesAdapter(
    private val currentUserId: Int,
    private var chatTheme: ChatTheme = ChatTheme.INDIGO_DEFAULT,
    private val onMarkAsReadClick: ((DisplayMessage) -> Unit)? = null
) : RecyclerView.Adapter<RecyclerView.ViewHolder>(), MusicPlayerManager.PlayerListener {

    private val messages = mutableListOf<DisplayMessage>()
    private var currentlyPlayingTrackId: String? = null
    private var isPlayingMusic: Boolean = false
    private var currentMusicPositionMs: Long = 0
    private var currentMusicDurationMs: Long = 0

    init {
        MusicPlayerManager.addListener(this)
    }

    fun release() {
        MusicPlayerManager.removeListener(this)
    }

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
        val msg = messages[position]
        val isMusic = getMusicAttachment(msg) != null
        val isVideo = getVideoAttachment(msg) != null

        return when {
            isMusic -> if (msg.isSelf) TYPE_SENT_MUSIC else TYPE_RECEIVED_MUSIC
            isVideo -> if (msg.isSelf) TYPE_SENT_VIDEO else TYPE_RECEIVED_VIDEO
            else -> if (msg.isSelf) TYPE_SENT_DEFAULT else TYPE_RECEIVED_DEFAULT
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_SENT_MUSIC -> {
                val view = inflater.inflate(R.layout.item_message_music_sent, parent, false)
                SentMusicViewHolder(view)
            }
            TYPE_RECEIVED_MUSIC -> {
                val view = inflater.inflate(R.layout.item_message_music_received, parent, false)
                ReceivedMusicViewHolder(view, onMarkAsReadClick)
            }
            TYPE_SENT_VIDEO -> {
                val view = inflater.inflate(R.layout.item_message_video_sent, parent, false)
                SentVideoViewHolder(view)
            }
            TYPE_RECEIVED_VIDEO -> {
                val view = inflater.inflate(R.layout.item_message_video_received, parent, false)
                ReceivedVideoViewHolder(view, onMarkAsReadClick)
            }
            TYPE_SENT_DEFAULT -> {
                val view = inflater.inflate(R.layout.item_message_sent, parent, false)
                SentViewHolder(view)
            }
            else -> {
                val view = inflater.inflate(R.layout.item_message_received, parent, false)
                ReceivedViewHolder(view, onMarkAsReadClick)
            }
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val msg = messages[position]
        when (holder) {
            is SentMusicViewHolder -> {
                val music = getMusicAttachment(msg)
                holder.bind(msg, music, chatTheme, currentlyPlayingTrackId, isPlayingMusic, currentMusicPositionMs, currentMusicDurationMs)
            }
            is ReceivedMusicViewHolder -> {
                val music = getMusicAttachment(msg)
                holder.bind(msg, music, chatTheme, currentlyPlayingTrackId, isPlayingMusic, currentMusicPositionMs, currentMusicDurationMs)
            }
            is SentVideoViewHolder -> {
                val videoUrl = getVideoAttachment(msg)
                holder.bind(msg, videoUrl, chatTheme)
            }
            is ReceivedVideoViewHolder -> {
                val videoUrl = getVideoAttachment(msg)
                holder.bind(msg, videoUrl, chatTheme)
            }
            is SentViewHolder -> holder.bind(msg, chatTheme)
            is ReceivedViewHolder -> holder.bind(msg, chatTheme)
        }
    }

    override fun getItemCount(): Int = messages.size

    // PlayerListener callbacks
    override fun onTrackChanged(track: MusicTrack?) {
        currentlyPlayingTrackId = track?.id
        isPlayingMusic = MusicPlayerManager.isPlaying
        notifyDataSetChanged()
    }

    override fun onPlaybackStateChanged(isPlaying: Boolean) {
        isPlayingMusic = isPlaying
        notifyDataSetChanged()
    }

    override fun onProgressUpdate(currentPositionMs: Long, durationMs: Long) {
        currentMusicPositionMs = currentPositionMs
        currentMusicDurationMs = durationMs
        // Update visible music cards if needed
    }

    // --- ViewHolders ---

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

            bindStructuredOrLegacyAttachments(
                msg = msg,
                tvContent = tvContent,
                cardMedia = cardMedia,
                imgMediaAttachment = imgMediaAttachment,
                layoutFileAttachment = layoutFileAttachment,
                tvFileName = tvFileName
            )

            tvTime.text = formatTimestamp(msg.timestamp) ?: "Sent"
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
            if (msg.isAi || msg.aiAgent == "nexa" || msg.senderName == "NEXA AI") {
                tvSenderName.text = "✨ NEXA AI"
                tvSenderName.setTextColor(0xFF06B6D4.toInt())
                tvSenderName.visibility = View.VISIBLE
            } else if (!msg.senderName.isNullOrEmpty()) {
                tvSenderName.text = msg.senderName
                tvSenderName.setTextColor(0xFF94A3B8.toInt())
                tvSenderName.visibility = View.VISIBLE
            } else {
                tvSenderName.visibility = View.GONE
            }

            bindStructuredOrLegacyAttachments(
                msg = msg,
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

    class SentMusicViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val bubbleLayout: View? = itemView.findViewById(R.id.bubbleLayout)
        private val ivMusicCover: ShapeableImageView = itemView.findViewById(R.id.ivMusicCover)
        private val tvMusicTitle: TextView = itemView.findViewById(R.id.tvMusicTitle)
        private val tvMusicArtist: TextView = itemView.findViewById(R.id.tvMusicArtist)
        private val btnMusicPlayPause: ImageButton = itemView.findViewById(R.id.btnMusicPlayPause)
        private val seekMusicProgress: SeekBar = itemView.findViewById(R.id.seekMusicProgress)
        private val tvMusicCurrentTime: TextView = itemView.findViewById(R.id.tvMusicCurrentTime)
        private val tvMusicDuration: TextView = itemView.findViewById(R.id.tvMusicDuration)
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)
        private val tvReadStatus: TextView? = itemView.findViewById(R.id.tvReadStatus)

        fun bind(
            msg: DisplayMessage,
            music: MusicMetadata?,
            theme: ChatTheme,
            playingTrackId: String?,
            isPlaying: Boolean,
            posMs: Long,
            durMs: Long
        ) {
            bubbleLayout?.background = theme.createSentBubbleDrawable()

            if (music != null) {
                tvMusicTitle.text = music.title
                tvMusicArtist.text = "${music.artist} • Jamendo"
                ivMusicCover.load(music.artworkUrl) {
                    crossfade(true)
                    placeholder(R.drawable.ic_gallery)
                    error(R.drawable.ic_gallery)
                }

                val isThisTrackPlaying = playingTrackId == music.id && isPlaying
                btnMusicPlayPause.setImageResource(
                    if (isThisTrackPlaying) R.drawable.ic_call_audio else R.drawable.ic_call_audio
                )

                val durSec = music.duration ?: ((durMs / 1000).toInt())
                tvMusicDuration.text = formatDuration(durSec)

                btnMusicPlayPause.setOnClickListener {
                    val track = MusicTrack(
                        id = music.id,
                        name = music.title,
                        artistName = music.artist,
                        duration = music.duration ?: 180,
                        audioUrl = music.audioUrl,
                        image = music.artworkUrl
                    )
                    if (playingTrackId == music.id && isPlaying) {
                        MusicPlayerManager.pause()
                    } else {
                        MusicPlayerManager.playTrack(itemView.context, track)
                    }
                }
            }

            if (msg.content.isNotBlank() && !msg.content.startsWith("🎵")) {
                tvContent.text = msg.content
                tvContent.visibility = View.VISIBLE
            } else {
                tvContent.visibility = View.GONE
            }

            tvTime.text = formatTimestamp(msg.timestamp) ?: "Sent"
            if (msg.isRead) {
                tvReadStatus?.visibility = View.VISIBLE
                tvReadStatus?.text = "✓✓ Read"
                tvReadStatus?.setTextColor(theme.readReceiptColor)
            } else {
                tvReadStatus?.visibility = View.GONE
            }
        }
    }

    class ReceivedMusicViewHolder(
        itemView: View,
        private val onMarkAsReadClick: ((DisplayMessage) -> Unit)?
    ) : RecyclerView.ViewHolder(itemView) {
        private val bubbleLayout: View? = itemView.findViewById(R.id.bubbleLayout)
        private val tvSenderName: TextView = itemView.findViewById(R.id.tvSenderName)
        private val ivMusicCover: ShapeableImageView = itemView.findViewById(R.id.ivMusicCover)
        private val tvMusicTitle: TextView = itemView.findViewById(R.id.tvMusicTitle)
        private val tvMusicArtist: TextView = itemView.findViewById(R.id.tvMusicArtist)
        private val btnMusicPlayPause: ImageButton = itemView.findViewById(R.id.btnMusicPlayPause)
        private val seekMusicProgress: SeekBar = itemView.findViewById(R.id.seekMusicProgress)
        private val tvMusicCurrentTime: TextView = itemView.findViewById(R.id.tvMusicCurrentTime)
        private val tvMusicDuration: TextView = itemView.findViewById(R.id.tvMusicDuration)
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)
        private val btnMarkRead: TextView? = itemView.findViewById(R.id.btnMarkRead)
        private val tvReadStatus: TextView? = itemView.findViewById(R.id.tvReadStatus)

        fun bind(
            msg: DisplayMessage,
            music: MusicMetadata?,
            theme: ChatTheme,
            playingTrackId: String?,
            isPlaying: Boolean,
            posMs: Long,
            durMs: Long
        ) {
            bubbleLayout?.background = theme.createReceivedBubbleDrawable()

            if (!msg.senderName.isNullOrEmpty()) {
                tvSenderName.text = msg.senderName
                tvSenderName.visibility = View.VISIBLE
            } else {
                tvSenderName.visibility = View.GONE
            }

            if (music != null) {
                tvMusicTitle.text = music.title
                tvMusicArtist.text = "${music.artist} • Jamendo"
                ivMusicCover.load(music.artworkUrl) {
                    crossfade(true)
                    placeholder(R.drawable.ic_gallery)
                    error(R.drawable.ic_gallery)
                }

                val isThisTrackPlaying = playingTrackId == music.id && isPlaying
                btnMusicPlayPause.setImageResource(
                    if (isThisTrackPlaying) R.drawable.ic_call_audio else R.drawable.ic_call_audio
                )

                val durSec = music.duration ?: ((durMs / 1000).toInt())
                tvMusicDuration.text = formatDuration(durSec)

                btnMusicPlayPause.setOnClickListener {
                    val track = MusicTrack(
                        id = music.id,
                        name = music.title,
                        artistName = music.artist,
                        duration = music.duration ?: 180,
                        audioUrl = music.audioUrl,
                        image = music.artworkUrl
                    )
                    if (playingTrackId == music.id && isPlaying) {
                        MusicPlayerManager.pause()
                    } else {
                        MusicPlayerManager.playTrack(itemView.context, track)
                    }
                }
            }

            if (msg.content.isNotBlank() && !msg.content.startsWith("🎵")) {
                tvContent.text = msg.content
                tvContent.visibility = View.VISIBLE
            } else {
                tvContent.visibility = View.GONE
            }

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
        }
    }

    class SentVideoViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val bubbleLayout: View? = itemView.findViewById(R.id.bubbleLayout)
        private val imgVideoThumbnail: ImageView = itemView.findViewById(R.id.imgVideoThumbnail)
        private val cardVideo: MaterialCardView = itemView.findViewById(R.id.cardVideo)
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)
        private val tvReadStatus: TextView? = itemView.findViewById(R.id.tvReadStatus)

        fun bind(msg: DisplayMessage, videoUrl: String?, theme: ChatTheme) {
            bubbleLayout?.background = theme.createSentBubbleDrawable()

            if (videoUrl != null) {
                imgVideoThumbnail.load(videoUrl) {
                    crossfade(true)
                    placeholder(R.drawable.bg_input_field)
                    error(R.drawable.bg_input_field)
                }
                cardVideo.setOnClickListener {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(videoUrl)).apply {
                            setDataAndType(Uri.parse(videoUrl), "video/*")
                        }
                        itemView.context.startActivity(intent)
                    } catch (_: Exception) {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(videoUrl))
                            itemView.context.startActivity(intent)
                        } catch (_: Exception) {}
                    }
                }
            }

            val cleanText = msg.content.replace(Regex("""🎥\s*\[Video\]\s*https?://\S+"""), "").trim()
            if (cleanText.isNotBlank()) {
                tvContent.text = cleanText
                tvContent.visibility = View.VISIBLE
            } else {
                tvContent.visibility = View.GONE
            }

            tvTime.text = formatTimestamp(msg.timestamp) ?: "Sent"
            if (msg.isRead) {
                tvReadStatus?.visibility = View.VISIBLE
                tvReadStatus?.text = "✓✓ Read"
                tvReadStatus?.setTextColor(theme.readReceiptColor)
            } else {
                tvReadStatus?.visibility = View.GONE
            }
        }
    }

    class ReceivedVideoViewHolder(
        itemView: View,
        private val onMarkAsReadClick: ((DisplayMessage) -> Unit)?
    ) : RecyclerView.ViewHolder(itemView) {
        private val bubbleLayout: View? = itemView.findViewById(R.id.bubbleLayout)
        private val tvSenderName: TextView = itemView.findViewById(R.id.tvSenderName)
        private val imgVideoThumbnail: ImageView = itemView.findViewById(R.id.imgVideoThumbnail)
        private val cardVideo: MaterialCardView = itemView.findViewById(R.id.cardVideo)
        private val tvContent: TextView = itemView.findViewById(R.id.tvContent)
        private val tvTime: TextView = itemView.findViewById(R.id.tvTime)
        private val btnMarkRead: TextView? = itemView.findViewById(R.id.btnMarkRead)
        private val tvReadStatus: TextView? = itemView.findViewById(R.id.tvReadStatus)

        fun bind(msg: DisplayMessage, videoUrl: String?, theme: ChatTheme) {
            bubbleLayout?.background = theme.createReceivedBubbleDrawable()

            if (!msg.senderName.isNullOrEmpty()) {
                tvSenderName.text = msg.senderName
                tvSenderName.visibility = View.VISIBLE
            } else {
                tvSenderName.visibility = View.GONE
            }

            if (videoUrl != null) {
                imgVideoThumbnail.load(videoUrl) {
                    crossfade(true)
                    placeholder(R.drawable.bg_input_field)
                    error(R.drawable.bg_input_field)
                }
                cardVideo.setOnClickListener {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(videoUrl)).apply {
                            setDataAndType(Uri.parse(videoUrl), "video/*")
                        }
                        itemView.context.startActivity(intent)
                    } catch (_: Exception) {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(videoUrl))
                            itemView.context.startActivity(intent)
                        } catch (_: Exception) {}
                    }
                }
            }

            val cleanText = msg.content.replace(Regex("""🎥\s*\[Video\]\s*https?://\S+"""), "").trim()
            if (cleanText.isNotBlank()) {
                tvContent.text = cleanText
                tvContent.visibility = View.VISIBLE
            } else {
                tvContent.visibility = View.GONE
            }

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
        }
    }

    companion object {
        private const val TYPE_SENT_DEFAULT = 1
        private const val TYPE_RECEIVED_DEFAULT = 2
        private const val TYPE_SENT_MUSIC = 3
        private const val TYPE_RECEIVED_MUSIC = 4
        private const val TYPE_SENT_VIDEO = 5
        private const val TYPE_RECEIVED_VIDEO = 6

        private val photoRegex = Regex("""(?:📷\s*\[Photo\]\s*|(?:^|\s))(https?://\S+\.(?:jpg|jpeg|png|webp|gif)(?:\?\S*)?|https?://\S*supabase\.co\S*|https?://\S*/uploads/\S+)""", RegexOption.IGNORE_CASE)
        private val videoRegex = Regex("""(?:🎥\s*\[Video\]\s*)(https?://\S+)""", RegexOption.IGNORE_CASE)
        private val fileRegex = Regex("""(?:📁\s*\[File\]\s*)(https?://\S+)""", RegexOption.IGNORE_CASE)
        private val gifRegex = Regex("""^\[GIF:\s*(https?://\S+?)\]$""", RegexOption.IGNORE_CASE)
        private val musicRegex = Regex("""🎵\s*\[Music\]\s*([^—\n]+)\s*—\s*([^\n]+)\s*(https?://\S+)""", RegexOption.IGNORE_CASE)

        fun getMusicAttachment(msg: DisplayMessage): MusicMetadata? {
            val structured = msg.attachments.firstOrNull { it.type == "music" }
            if (structured != null) {
                return structured.resolvedMusic()
            }
            val match = musicRegex.find(msg.content)
            if (match != null) {
                return MusicMetadata(
                    provider = "jamendo",
                    id = match.groupValues[3],
                    title = match.groupValues[1].trim(),
                    artist = match.groupValues[2].trim(),
                    audioUrl = match.groupValues[3].trim()
                )
            }
            return null
        }

        fun getVideoAttachment(msg: DisplayMessage): String? {
            val structured = msg.attachments.firstOrNull { it.type == "video" }
            if (structured?.url != null) return structured.url
            val match = videoRegex.find(msg.content)
            return match?.groupValues?.get(1)
        }

        private fun bindStructuredOrLegacyAttachments(
            msg: DisplayMessage,
            tvContent: TextView,
            cardMedia: MaterialCardView?,
            imgMediaAttachment: ImageView?,
            layoutFileAttachment: View?,
            tvFileName: TextView?
        ) {
            val context = tvContent.context

            // 1. Structured Image or GIF
            val imageAttachment = msg.attachments.firstOrNull { it.type == "image" || it.type == "gif" }
            if (imageAttachment?.url != null) {
                cardMedia?.visibility = View.VISIBLE
                imgMediaAttachment?.setImageResource(R.drawable.ic_gallery)

                MediaCacheManager.getCachedFileOrDownload(context, imageAttachment.url) { localFile ->
                    imgMediaAttachment?.load(localFile ?: imageAttachment.url) {
                        crossfade(true)
                        placeholder(R.drawable.ic_gallery)
                        error(R.drawable.ic_gallery)
                    }
                }
                cardMedia?.setOnClickListener {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(imageAttachment.url))
                        context.startActivity(intent)
                    } catch (_: Exception) {}
                }
                layoutFileAttachment?.visibility = View.GONE
                if (msg.content.isNotBlank()) {
                    tvContent.text = msg.content
                    tvContent.visibility = View.VISIBLE
                } else {
                    tvContent.visibility = View.GONE
                }
                return
            }

            // 2. Structured File / Document
            val fileAttachment = msg.attachments.firstOrNull { it.type == "file" }
            if (fileAttachment?.url != null) {
                layoutFileAttachment?.visibility = View.VISIBLE
                tvFileName?.text = fileAttachment.filename ?: "Document"

                layoutFileAttachment?.setOnClickListener {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(fileAttachment.url))
                        context.startActivity(intent)
                    } catch (_: Exception) {}
                }
                cardMedia?.visibility = View.GONE
                if (msg.content.isNotBlank()) {
                    tvContent.text = msg.content
                    tvContent.visibility = View.VISIBLE
                } else {
                    tvContent.visibility = View.GONE
                }
                return
            }

            // 3. Legacy string fallbacks
            val gifMatch = gifRegex.find(msg.content.trim())
            if (gifMatch != null) {
                val gifUrl = gifMatch.groupValues[1]
                cardMedia?.visibility = View.VISIBLE
                imgMediaAttachment?.setImageResource(R.drawable.bg_input_field)
                MediaCacheManager.getCachedFileOrDownload(context, gifUrl) { localFile ->
                    imgMediaAttachment?.load(localFile ?: gifUrl) {
                        crossfade(true)
                        placeholder(R.drawable.bg_input_field)
                        error(R.drawable.bg_input_field)
                    }
                }
                cardMedia?.setOnClickListener {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(gifUrl))
                        context.startActivity(intent)
                    } catch (_: Exception) {}
                }
                layoutFileAttachment?.visibility = View.GONE
                tvContent.visibility = View.GONE
                return
            }

            val photoMatch = photoRegex.find(msg.content)
            val fileMatch = fileRegex.find(msg.content)

            if (photoMatch != null) {
                val url = photoMatch.groupValues[1]
                val cleanText = msg.content.replace(photoMatch.value, "").trim()

                cardMedia?.visibility = View.VISIBLE
                imgMediaAttachment?.setImageResource(R.drawable.ic_gallery)

                MediaCacheManager.getCachedFileOrDownload(context, url) { localFile ->
                    imgMediaAttachment?.load(localFile ?: url) {
                        crossfade(true)
                        placeholder(R.drawable.ic_gallery)
                        error(R.drawable.ic_gallery)
                    }
                }
                cardMedia?.setOnClickListener {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        context.startActivity(intent)
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
                val cleanText = msg.content.replace(fileMatch.value, "").trim()
                val fileName = url.substringAfterLast("/").substringBefore("?")

                layoutFileAttachment?.visibility = View.VISIBLE
                tvFileName?.text = Uri.decode(fileName)

                layoutFileAttachment?.setOnClickListener {
                    MediaCacheManager.getCachedFileOrDownload(context, url) { localFile ->
                        try {
                            val uri = if (localFile != null) Uri.fromFile(localFile) else Uri.parse(url)
                            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                                if (localFile != null) {
                                    setDataAndType(uri, context.contentResolver.getType(uri) ?: "*/*")
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                            }
                            context.startActivity(intent)
                        } catch (_: Exception) {
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
            tvContent.text = msg.content
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

        fun formatDuration(seconds: Int): String {
            val mins = seconds / 60
            val secs = seconds % 60
            return "%d:%02d".format(mins, secs)
        }
    }
}
