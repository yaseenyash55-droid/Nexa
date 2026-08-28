package com.nexa.social.ui

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.DisplayMessage
import com.nexa.social.data.models.MessageAttachment
import com.nexa.social.data.models.MusicMetadata
import com.nexa.social.data.models.MusicTrack
import com.nexa.social.data.models.SendDirectMessageRequest
import com.nexa.social.data.models.SendGroupMessageRequest
import com.nexa.social.databinding.ActivityChatBinding
import com.nexa.social.utils.LocalChatStorage
import com.nexa.social.utils.PreferenceManager
import com.nexa.social.utils.SocketManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class ChatActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_CHAT_TYPE = "extra_chat_type"
        const val EXTRA_TARGET_ID = "extra_target_id"
        const val EXTRA_TARGET_NAME = "extra_target_name"
    }

    private lateinit var binding: ActivityChatBinding
    private lateinit var prefManager: PreferenceManager
    private lateinit var localChatStorage: LocalChatStorage
    private lateinit var themeManager: com.nexa.social.utils.ChatThemeManager
    private lateinit var adapter: MessagesAdapter

    private var chatType: String = "direct"
    private var targetId: Int = 0
    private var targetName: String = "Chat"

    private val mainHandler = Handler(Looper.getMainLooper())
    private var stopTypingRunnable: Runnable? = null
    private var isEmittingTyping = false
    private var cameraTempFile: File? = null

    // Pending attachment state
    private var pendingAttachment: MessageAttachment? = null
    private var isUploadingAttachment = false
    private var uploadJob: Job? = null

    // Attachment Launchers
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            handleLocalFileSelected(uri, "file")
        }
    }

    private val photoPickerLauncher = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            handleLocalFileSelected(uri, "photo")
        }
    }

    private val videoPickerLauncher = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            handleLocalFileSelected(uri, "video")
        }
    }

    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success: Boolean ->
        if (success && cameraTempFile != null && cameraTempFile!!.exists() && cameraTempFile!!.length() > 0) {
            val uri = Uri.fromFile(cameraTempFile)
            handleLocalFileSelected(uri, "photo")
        }
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            launchCameraCapture()
        } else {
            Toast.makeText(this, "Camera permission required to capture photos", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityChatBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefManager = PreferenceManager(this)
        localChatStorage = LocalChatStorage.getInstance(this)
        themeManager = com.nexa.social.utils.ChatThemeManager.getInstance(this)

        chatType = intent.getStringExtra(EXTRA_CHAT_TYPE) ?: "direct"
        targetId = intent.getIntExtra(EXTRA_TARGET_ID, 0)
        targetName = intent.getStringExtra(EXTRA_TARGET_NAME) ?: "Chat"

        if (targetId <= 0) {
            Toast.makeText(this, "Invalid chat recipient ID", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        setupToolbar()
        setupRecyclerView()
        setupSendButton()
        setupAttachmentButton()
        setupEmojiButton()
        setupAttachmentPreview()
        setupTypingListeners()
        setupRealtimeMessageListeners()
        setupTextWatcher()

        // Immediate offline storage load
        loadCachedMessages()

        // Restore unsent message draft
        val savedDraft = localChatStorage.getDraft(prefManager.userId, targetId, chatType)
        if (savedDraft.isNotBlank()) {
            binding.etMessage.setText(savedDraft)
            binding.etMessage.setSelection(savedDraft.length)
        }

        // Network sync
        loadMessages()
    }

    override fun onDestroy() {
        super.onDestroy()
        adapter.release()
        uploadJob?.cancel()
        SocketManager.removeTypingListeners()
        SocketManager.unregisterMessageListener()
        SocketManager.unregisterMessageReadListener()
        SocketManager.unregisterGroupMessageListener()
        stopTypingRunnable?.let { mainHandler.removeCallbacks(it) }
        try { cameraTempFile?.delete() } catch (_: Exception) {}
    }

    override fun onStart() {
        super.onStart()
        SocketManager.registerIncomingCallListener { call ->
            startActivity(
                CallActivity.incomingIntent(
                    this,
                    call.callId,
                    call.callerId,
                    call.callerUsername,
                    call.callType
                )
            )
        }
    }

    override fun onStop() {
        super.onStop()
        SocketManager.unregisterIncomingCallListener()
    }

    private fun setupToolbar() {
        binding.toolbar.title = targetName
        binding.toolbar.subtitle = if (chatType == "direct") "Online • End-to-End Secure" else "Group Conversation"
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun showChatOptionsMenu() {
        val options = arrayOf(
            "Mark all as read",
            "Clear conversation cache",
            "Change chat theme"
        )
        AlertDialog.Builder(this)
            .setTitle(targetName)
            .setItems(options) { _, which ->
                when (which) {
                    0 -> markAllMessagesAsRead()
                    1 -> clearChatCache()
                    2 -> showThemePickerDialog()
                }
            }
            .show()
    }

    private fun showThemePickerDialog() {
        val themes = com.nexa.social.utils.ChatTheme.values()
        val themeNames = themes.map { it.displayName }.toTypedArray()
        val currentTheme = themeManager.getThemeForChat(targetId, chatType)
        val selectedIndex = themes.indexOf(currentTheme).coerceAtLeast(0)

        AlertDialog.Builder(this)
            .setTitle("Select Chat Theme")
            .setSingleChoiceItems(themeNames, selectedIndex) { dialog, which ->
                val chosenTheme = themes[which]
                themeManager.setThemeForChat(targetId, chatType, chosenTheme)
                adapter.setChatTheme(chosenTheme)
                Toast.makeText(this, "Theme set to ${chosenTheme.displayName}", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun clearChatCache() {
        val currentUserId = prefManager.userId
        localChatStorage.clearChat(currentUserId, targetId, chatType)
        adapter.submitList(emptyList())
        Toast.makeText(this, "Local cache cleared", Toast.LENGTH_SHORT).show()
    }

    private fun setupRecyclerView() {
        val currentUserId = prefManager.userId
        val currentTheme = themeManager.getThemeForChat(targetId, chatType)
        adapter = MessagesAdapter(
            currentUserId = currentUserId,
            chatTheme = currentTheme,
            onMarkAsReadClick = { msg ->
                markSingleMessageAsRead(msg)
            }
        )

        binding.rvMessages.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        binding.rvMessages.adapter = adapter
    }

    private fun loadCachedMessages() {
        val currentUserId = prefManager.userId
        val cached = localChatStorage.getMessages(currentUserId, targetId, chatType)
        if (cached.isNotEmpty()) {
            adapter.submitList(cached)
            binding.rvMessages.scrollToPosition(cached.size - 1)
        }
    }

    private fun setupRealtimeMessageListeners() {
        val currentUserId = prefManager.userId
        SocketManager.registerMessageReadListener { messageId, _ ->
            adapter.markMessageRead(messageId)
            localChatStorage.markMessageRead(currentUserId, targetId, chatType, messageId)
        }
        if (chatType == "direct") {
            SocketManager.registerMessageListener { message ->
                if (message.senderId == targetId) {
                    val displayMsg = DisplayMessage(
                        id = message.messageId,
                        senderId = message.senderId,
                        senderName = targetName,
                        content = message.content,
                        isSelf = false,
                        timestamp = message.createdAt,
                        isRead = false,
                        attachments = message.attachments
                    )
                    adapter.addMessage(displayMsg)
                    localChatStorage.addMessage(currentUserId, targetId, chatType, displayMsg)
                    binding.rvMessages.smoothScrollToPosition(adapter.itemCount - 1)

                    // Automatically acknowledge read receipt
                    lifecycleScope.launch(Dispatchers.IO) {
                        try {
                            NexaApiClient.messageApi.markMessageRead(message.messageId)
                        } catch (_: Exception) {}
                    }
                }
            }
        } else {
            SocketManager.registerGroupMessageListener { groupMsg ->
                if (groupMsg.groupId == targetId && groupMsg.senderId != prefManager.userId) {
                    val displayMsg = DisplayMessage(
                        id = groupMsg.messageId,
                        senderId = groupMsg.senderId,
                        senderName = groupMsg.sender.displayName,
                        content = groupMsg.content,
                        isSelf = false,
                        timestamp = groupMsg.createdAt,
                        isRead = false,
                        attachments = groupMsg.attachments
                    )
                    adapter.addMessage(displayMsg)
                    localChatStorage.addMessage(currentUserId, targetId, chatType, displayMsg)
                    binding.rvMessages.smoothScrollToPosition(adapter.itemCount - 1)
                }
            }
        }
    }

    private fun setupTypingListeners() {
        if (chatType != "direct") return
        SocketManager.setTypingListeners(
            onStart = { userId, username ->
                if (userId == targetId) {
                    binding.tvTypingIndicator.text = "${username ?: targetName} is typing…"
                    binding.tvTypingIndicator.visibility = View.VISIBLE
                }
            },
            onStop = { userId ->
                if (userId == targetId) {
                    binding.tvTypingIndicator.visibility = View.GONE
                }
            }
        )
    }

    private fun setupTextWatcher() {
        binding.etMessage.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val currentText = s?.toString() ?: ""
                localChatStorage.saveDraft(prefManager.userId, targetId, chatType, currentText)

                if (chatType == "direct") {
                    if (!s.isNullOrBlank()) {
                        if (!isEmittingTyping) {
                            SocketManager.emitTypingStart(targetId)
                            isEmittingTyping = true
                        }
                        stopTypingRunnable?.let { mainHandler.removeCallbacks(it) }
                        stopTypingRunnable = Runnable {
                            SocketManager.emitTypingStop(targetId)
                            isEmittingTyping = false
                        }.also { mainHandler.postDelayed(it, 3000) }
                    } else {
                        stopTypingRunnable?.let { mainHandler.removeCallbacks(it) }
                        SocketManager.emitTypingStop(targetId)
                        isEmittingTyping = false
                    }
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun setupEmojiButton() {
        binding.btnEmoji.setOnClickListener {
            showEmojiPickerDialog()
        }
    }

    private fun showEmojiPickerDialog() {
        EmojiPickerDialogFragment { emoji ->
            val start = binding.etMessage.selectionStart.coerceAtLeast(0)
            val end = binding.etMessage.selectionEnd.coerceAtLeast(0)
            binding.etMessage.text.replace(minOf(start, end), maxOf(start, end), emoji)
        }.show(supportFragmentManager, "emoji_picker")
    }

    private fun setupAttachmentPreview() {
        val previewCard = binding.layoutAttachmentPreview.cardAttachmentPreview
        val btnRemove = binding.layoutAttachmentPreview.btnRemoveAttachment

        btnRemove.setOnClickListener {
            clearPendingAttachment()
        }
    }

    private fun clearPendingAttachment() {
        uploadJob?.cancel()
        pendingAttachment = null
        isUploadingAttachment = false
        binding.layoutAttachmentPreview.cardAttachmentPreview.visibility = View.GONE
        binding.layoutAttachmentPreview.progressAttachmentUpload.visibility = View.GONE
        binding.layoutAttachmentPreview.btnRetryUpload.visibility = View.GONE
        binding.btnSend.isEnabled = true
        binding.btnSend.alpha = 1.0f
    }

    private fun showPendingAttachment(
        type: String,
        title: String,
        subtitle: String,
        thumbUrl: String? = null,
        iconRes: Int = R.drawable.ic_folder,
        isUploading: Boolean = false
    ) {
        binding.layoutAttachmentPreview.cardAttachmentPreview.visibility = View.VISIBLE
        binding.layoutAttachmentPreview.tvAttachmentTitle.text = title
        binding.layoutAttachmentPreview.tvAttachmentSubtitle.text = subtitle

        if (thumbUrl != null) {
            binding.layoutAttachmentPreview.ivAttachmentThumb.visibility = View.VISIBLE
            binding.layoutAttachmentPreview.ivAttachmentIcon.visibility = View.GONE
            binding.layoutAttachmentPreview.ivAttachmentThumb.load(thumbUrl) {
                crossfade(true)
                placeholder(R.drawable.bg_input_field)
            }
        } else {
            binding.layoutAttachmentPreview.ivAttachmentThumb.visibility = View.GONE
            binding.layoutAttachmentPreview.ivAttachmentIcon.visibility = View.VISIBLE
            binding.layoutAttachmentPreview.ivAttachmentIcon.setImageResource(iconRes)
        }

        if (isUploading) {
            isUploadingAttachment = true
            binding.layoutAttachmentPreview.progressAttachmentUpload.visibility = View.VISIBLE
            binding.btnSend.isEnabled = false
            binding.btnSend.alpha = 0.5f
        } else {
            isUploadingAttachment = false
            binding.layoutAttachmentPreview.progressAttachmentUpload.visibility = View.GONE
            binding.btnSend.isEnabled = true
            binding.btnSend.alpha = 1.0f
        }
    }

    private fun handleLocalFileSelected(uri: Uri, kind: String) {
        val filename = getFileNameFromUri(uri) ?: "attachment_$kind"
        val iconRes = when (kind) {
            "photo" -> R.drawable.ic_gallery
            "video" -> R.drawable.ic_video
            else -> R.drawable.ic_folder
        }

        showPendingAttachment(
            type = kind,
            title = filename,
            subtitle = "Uploading attachment…",
            iconRes = iconRes,
            isUploading = true
        )

        uploadJob?.cancel()
        uploadJob = lifecycleScope.launch(Dispatchers.IO) {
            try {
                val inputStream: InputStream = contentResolver.openInputStream(uri) ?: return@launch
                val tempFile = File.createTempFile("chat_upload_", ".tmp", cacheDir)
                val outputStream = FileOutputStream(tempFile)
                inputStream.copyTo(outputStream)
                inputStream.close()
                outputStream.flush()
                outputStream.close()

                val fileSize = tempFile.length()
                val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
                val requestFile: RequestBody = tempFile.asRequestBody(mimeType.toMediaTypeOrNull())
                val filePart = MultipartBody.Part.createFormData("file", tempFile.name, requestFile)
                val kindPart = (if (kind == "photo") "photo" else if (kind == "video") "video" else "file").toRequestBody("text/plain".toMediaTypeOrNull())

                val res = NexaApiClient.postApi.uploadMedia(filePart, kindPart)
                withContext(Dispatchers.Main) {
                    tempFile.delete()
                    if (res.isSuccessful && res.body()?.data?.publicUrl != null) {
                        val uploadData = res.body()!!.data!!
                        val publicUrl = uploadData.publicUrl!!
                        val assetId = uploadData.assetId

                        val attachmentType = when (kind) {
                            "photo" -> "image"
                            "video" -> "video"
                            else -> "file"
                        }

                        pendingAttachment = MessageAttachment(
                            type = attachmentType,
                            mediaId = assetId,
                            url = publicUrl,
                            filename = filename,
                            mimeType = mimeType,
                            size = fileSize
                        )

                        val sizeStr = formatFileSize(fileSize)
                        showPendingAttachment(
                            type = attachmentType,
                            title = filename,
                            subtitle = "$sizeStr • Ready to send",
                            thumbUrl = if (attachmentType == "image" || attachmentType == "video") publicUrl else null,
                            iconRes = iconRes,
                            isUploading = false
                        )
                    } else {
                        Toast.makeText(this@ChatActivity, "Failed to upload attachment", Toast.LENGTH_SHORT).show()
                        clearPendingAttachment()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@ChatActivity, "Upload error: ${e.message}", Toast.LENGTH_SHORT).show()
                    clearPendingAttachment()
                }
            }
        }
    }

    private fun handleMusicTrackSelected(track: MusicTrack) {
        val musicMeta = MusicMetadata(
            provider = "jamendo",
            id = track.id,
            title = track.name,
            artist = track.artistName,
            artworkUrl = track.resolvedImageUrl().ifEmpty { null },
            audioUrl = track.audioUrl,
            duration = track.duration
        )

        pendingAttachment = MessageAttachment(
            type = "music",
            music = musicMeta,
            url = track.audioUrl,
            filename = "${track.name}.mp3",
            musicProvider = "jamendo",
            musicTrackId = track.id,
            musicTitle = track.name,
            musicArtist = track.artistName,
            musicArtworkUrl = track.resolvedImageUrl().ifEmpty { null },
            musicAudioUrl = track.audioUrl,
            musicDuration = track.duration
        )

        showPendingAttachment(
            type = "music",
            title = track.name,
            subtitle = "${track.artistName} • ${track.formattedDuration()}",
            thumbUrl = track.resolvedImageUrl().ifEmpty { null },
            iconRes = R.drawable.ic_call_audio,
            isUploading = false
        )
    }

    private fun setupSendButton() {
        binding.btnSend.setOnClickListener {
            val text = binding.etMessage.text.toString().trim()
            if (text.isNotEmpty() || pendingAttachment != null) {
                sendMessage(text)
            }
        }
    }

    private fun setupAttachmentButton() {
        binding.btnAddAttachment.setOnClickListener {
            showAttachmentOptionsBottomSheet()
        }
    }

    private fun showAttachmentOptionsBottomSheet() {
        val bottomSheet = BottomSheetDialog(this)
        val sheetView = layoutInflater.inflate(R.layout.dialog_chat_attachments, null)
        bottomSheet.setContentView(sheetView)

        // 1. Photos / Gallery (Scoped Storage Photo Picker)
        sheetView.findViewById<View>(R.id.btnAttachGallery).setOnClickListener {
            bottomSheet.dismiss()
            photoPickerLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
            )
        }

        // 2. Videos (Scoped Storage Video Picker)
        sheetView.findViewById<View>(R.id.btnAttachVideo).setOnClickListener {
            bottomSheet.dismiss()
            videoPickerLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.VideoOnly)
            )
        }

        // 3. Documents / Files (SAF Picker)
        sheetView.findViewById<View>(R.id.btnAttachFile).setOnClickListener {
            bottomSheet.dismiss()
            filePickerLauncher.launch("*/*")
        }

        // 4. Music Track Picker
        sheetView.findViewById<View>(R.id.btnAttachMusic).setOnClickListener {
            bottomSheet.dismiss()
            MusicPickerBottomSheetDialogFragment { selectedTrack ->
                handleMusicTrackSelected(selectedTrack)
            }.show(supportFragmentManager, "music_picker")
        }

        // 5. Camera Capture
        sheetView.findViewById<View>(R.id.btnAttachCamera).setOnClickListener {
            bottomSheet.dismiss()
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                launchCameraCapture()
            } else {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }

        // 6. Stickers / Emojis
        sheetView.findViewById<View>(R.id.btnAttachStickers).setOnClickListener {
            bottomSheet.dismiss()
            showEmojiPickerDialog()
        }

        // 7. GIFs
        sheetView.findViewById<View>(R.id.btnAttachGif).setOnClickListener {
            bottomSheet.dismiss()
            showGifPickerDialog()
        }

        bottomSheet.show()
    }

    private fun showGifPickerDialog() {
        GifPickerDialogFragment { gifUrl, _ ->
            val gifAttachment = MessageAttachment(
                type = "gif",
                url = gifUrl,
                filename = "sticker.gif"
            )
            pendingAttachment = gifAttachment
            sendMessage("")
        }.show(supportFragmentManager, "gif_picker")
    }

    private fun launchCameraCapture() {
        try {
            val tempFile = File.createTempFile("chat_camera_", ".jpg", cacheDir)
            cameraTempFile = tempFile
            val photoUri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                tempFile
            )
            cameraLauncher.launch(photoUri)
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to initialize camera: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun loadMessages() {
        val currentUserId = prefManager.userId
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                if (chatType == "direct") {
                    val res = NexaApiClient.messageApi.getMessagesWithUser(targetId)
                    if (!res.isSuccessful) {
                        throw IllegalStateException(
                            res.body()?.error?.message ?: "Server rejected message history (${res.code()})"
                        )
                    }
                    val rawMessages = res.body()?.data ?: emptyList()
                    val displayList = rawMessages.map { m ->
                        DisplayMessage(
                            id = m.messageId,
                            senderId = m.senderId,
                            senderName = if (m.senderId == currentUserId) null else targetName,
                            content = m.content,
                            isSelf = m.senderId == currentUserId,
                            timestamp = m.createdAt,
                            isRead = m.isRead,
                            attachments = m.attachments
                        )
                    }
                    localChatStorage.saveMessages(currentUserId, targetId, chatType, displayList)
                    withContext(Dispatchers.Main) {
                        adapter.submitList(displayList)
                        if (displayList.isNotEmpty()) {
                            binding.rvMessages.scrollToPosition(displayList.size - 1)
                        }
                    }
                } else {
                    val groupResp = NexaApiClient.groupApi.getGroupById(targetId)
                    val membersResp = NexaApiClient.groupApi.getGroupMembers(targetId)
                    val res = NexaApiClient.groupApi.getGroupMessages(targetId)
                    if (!res.isSuccessful) {
                        throw IllegalStateException(
                            res.body()?.error?.message ?: "Server rejected group history (${res.code()})"
                        )
                    }
                    val rawMessages = res.body()?.data ?: emptyList()
                    val displayList = rawMessages.map { m ->
                        DisplayMessage(
                            id = m.messageId,
                            senderId = m.senderId,
                            senderName = m.sender.displayName,
                            content = m.content,
                            isSelf = m.senderId == currentUserId,
                            timestamp = m.createdAt,
                            isRead = false,
                            attachments = m.attachments
                        )
                    }
                    localChatStorage.saveMessages(currentUserId, targetId, chatType, displayList)

                    val group = groupResp.body()?.data
                    val members = membersResp.body()?.data ?: emptyList()
                    val myRole = members.find { it.userId == currentUserId }?.role
                    val isCreator = group?.createdBy == currentUserId
                    val isAdmin = isCreator || myRole == "ADMIN"
                    val isPostingDisabled = group?.onlyAdminsCanPost == true && !isAdmin

                    withContext(Dispatchers.Main) {
                        adapter.submitList(displayList)
                        if (displayList.isNotEmpty()) {
                            binding.rvMessages.scrollToPosition(displayList.size - 1)
                        }

                        if (isPostingDisabled) {
                            binding.etMessage.isEnabled = false
                            binding.etMessage.hint = "🔒 Only admins can post in this group"
                            binding.btnSend.isEnabled = false
                            binding.btnSend.alpha = 0.5f
                        } else {
                            binding.etMessage.isEnabled = true
                            binding.etMessage.hint = "Type a secure message..."
                            binding.btnSend.isEnabled = true
                            binding.btnSend.alpha = 1.0f
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (adapter.itemCount == 0) {
                        Toast.makeText(this@ChatActivity, "Failed to load messages: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    private fun markSingleMessageAsRead(msg: DisplayMessage) {
        if (msg.isRead) return
        val currentUserId = prefManager.userId
        adapter.markMessageRead(msg.id)
        localChatStorage.markMessageRead(currentUserId, targetId, chatType, msg.id)
        Toast.makeText(this, "Message marked as read", Toast.LENGTH_SHORT).show()
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                NexaApiClient.messageApi.markMessageRead(msg.id)
            } catch (_: Exception) {}
        }
    }

    private fun markAllMessagesAsRead() {
        val currentUserId = prefManager.userId
        adapter.markAllRead()
        localChatStorage.markAllRead(currentUserId, targetId, chatType)
        Toast.makeText(this, "All messages marked as read", Toast.LENGTH_SHORT).show()
        lifecycleScope.launch(Dispatchers.IO) {
            val unreadItems = adapter.getItems().filter { !it.isSelf && it.id > 0 }
            for (item in unreadItems) {
                try {
                    NexaApiClient.messageApi.markMessageRead(item.id)
                } catch (_: Exception) {}
            }
        }
    }

    private fun sendMessage(content: String) {
        if (isUploadingAttachment) {
            Toast.makeText(this, "Please wait for attachment upload to complete", Toast.LENGTH_SHORT).show()
            return
        }

        val currentUserId = prefManager.userId
        val attachmentsToSend = pendingAttachment?.let { listOf(it) }

        if (content.isBlank() && attachmentsToSend.isNullOrEmpty()) {
            return
        }

        binding.btnSend.isEnabled = false

        if (chatType == "direct") {
            stopTypingRunnable?.let { mainHandler.removeCallbacks(it) }
            SocketManager.emitTypingStop(targetId)
            isEmittingTyping = false
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                if (chatType == "direct") {
                    val req = SendDirectMessageRequest(
                        receiverId = targetId,
                        content = content,
                        attachments = attachmentsToSend
                    )
                    val res = NexaApiClient.messageApi.sendMessage(req)
                    if (!res.isSuccessful) {
                        throw IllegalStateException(
                            res.body()?.error?.message ?: "Server rejected message (${res.code()})"
                        )
                    }
                    val msg = res.body()?.data
                    withContext(Dispatchers.Main) {
                        binding.btnSend.isEnabled = true
                        binding.etMessage.setText("")
                        clearPendingAttachment()
                        localChatStorage.clearDraft(currentUserId, targetId, chatType)
                        if (msg != null) {
                            val displayMsg = DisplayMessage(
                                id = msg.messageId,
                                senderId = currentUserId,
                                senderName = null,
                                content = msg.content,
                                isSelf = true,
                                timestamp = msg.createdAt,
                                isRead = false,
                                attachments = msg.attachments
                            )
                            adapter.addMessage(displayMsg)
                            localChatStorage.addMessage(currentUserId, targetId, chatType, displayMsg)
                            binding.rvMessages.smoothScrollToPosition(adapter.itemCount - 1)
                        }
                    }
                } else {
                    val req = SendGroupMessageRequest(
                        content = content,
                        attachments = attachmentsToSend
                    )
                    val res = NexaApiClient.groupApi.sendGroupMessage(targetId, req)
                    if (!res.isSuccessful) {
                        throw IllegalStateException(
                            res.body()?.error?.message ?: "Server rejected group message (${res.code()})"
                        )
                    }
                    val msg = res.body()?.data
                    withContext(Dispatchers.Main) {
                        binding.btnSend.isEnabled = true
                        binding.etMessage.setText("")
                        clearPendingAttachment()
                        localChatStorage.clearDraft(currentUserId, targetId, chatType)
                        if (msg != null) {
                            val displayMsg = DisplayMessage(
                                id = msg.messageId,
                                senderId = currentUserId,
                                senderName = null,
                                content = msg.content,
                                isSelf = true,
                                timestamp = msg.createdAt,
                                isRead = false,
                                attachments = msg.attachments
                            )
                            adapter.addMessage(displayMsg)
                            localChatStorage.addMessage(currentUserId, targetId, chatType, displayMsg)
                            binding.rvMessages.smoothScrollToPosition(adapter.itemCount - 1)
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.btnSend.isEnabled = true
                    Toast.makeText(this@ChatActivity, "Failed to send: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun getFileNameFromUri(uri: Uri): String? {
        return try {
            val cursor = contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val nameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (nameIndex >= 0) it.getString(nameIndex) else null
                } else null
            } ?: uri.lastPathSegment
        } catch (_: Exception) {
            uri.lastPathSegment
        }
    }

    private fun formatFileSize(bytes: Long): String {
        return when {
            bytes >= 1024 * 1024 -> "%.1f MB".format(bytes / (1024.0 * 1024.0))
            bytes >= 1024 -> "%.1f KB".format(bytes / 1024.0)
            else -> "$bytes B"
        }
    }
}
