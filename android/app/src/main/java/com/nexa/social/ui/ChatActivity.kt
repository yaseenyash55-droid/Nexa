package com.nexa.social.ui

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.widget.GridLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.DisplayMessage
import com.nexa.social.data.models.SendDirectMessageRequest
import com.nexa.social.databinding.ActivityChatBinding
import com.nexa.social.utils.LocalChatStorage
import com.nexa.social.utils.PreferenceManager
import com.nexa.social.utils.SocketManager
import kotlinx.coroutines.Dispatchers
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

    // Attachment Launchers
    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            uploadAndSendAttachment(uri, "file")
        }
    }

    private val galleryPickerLauncher = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            uploadAndSendAttachment(uri, "photo")
        }
    }

    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success: Boolean ->
        if (success && cameraTempFile != null && cameraTempFile!!.exists() && cameraTempFile!!.length() > 0) {
            val uri = Uri.fromFile(cameraTempFile)
            uploadAndSendAttachment(uri, "photo")
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
        SocketManager.unregisterIncomingCallListener()
        super.onStop()
    }

    private fun setupToolbar() {
        binding.toolbar.title = targetName
        binding.toolbar.subtitle = if (chatType == "direct") "Direct Conversation" else "Group Conversation"
        binding.toolbar.setNavigationOnClickListener { finish() }
        binding.toolbar.inflateMenu(R.menu.chat_call_menu)
        binding.toolbar.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_voice_call -> {
                    startActivity(CallActivity.outgoingIntent(this, targetId, targetName, "audio"))
                    true
                }
                R.id.action_video_call -> {
                    startActivity(CallActivity.outgoingIntent(this, targetId, targetName, "video"))
                    true
                }
                R.id.action_change_theme -> {
                    showThemePickerDialog()
                    true
                }
                R.id.action_mark_all_read -> {
                    markAllMessagesAsRead()
                    true
                }
                else -> false
            }
        }
    }

    private fun showThemePickerDialog() {
        val themes = com.nexa.social.utils.ChatTheme.values()
        val themeNames = themes.map { it.displayName }.toTypedArray()
        val currentTheme = themeManager.getThemeForChat(targetId, chatType)
        val selectedIndex = themes.indexOf(currentTheme).coerceAtLeast(0)

        AlertDialog.Builder(this)
            .setTitle("Select Chat Theme 🎨")
            .setSingleChoiceItems(themeNames, selectedIndex) { dialog, which ->
                val selectedTheme = themes[which]
                themeManager.setThemeForChat(targetId, chatType, selectedTheme)
                adapter.setChatTheme(selectedTheme)
                Toast.makeText(this, "Applied: ${selectedTheme.displayName}", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
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
                        isRead = false
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
                        isRead = false
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

    private fun setupSendButton() {
        binding.btnSend.setOnClickListener {
            val text = binding.etMessage.text.toString().trim()
            if (text.isNotEmpty()) {
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

        // 1. Files / Scoped Local Storage
        sheetView.findViewById<View>(R.id.btnAttachFile).setOnClickListener {
            bottomSheet.dismiss()
            filePickerLauncher.launch("*/*")
        }

        // 2. Photos / Gallery (Scoped Storage Photo Picker)
        sheetView.findViewById<View>(R.id.btnAttachGallery).setOnClickListener {
            bottomSheet.dismiss()
            galleryPickerLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)
            )
        }

        // 3. Camera
        sheetView.findViewById<View>(R.id.btnAttachCamera).setOnClickListener {
            bottomSheet.dismiss()
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                launchCameraCapture()
            } else {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }

        // 4. Stickers / Emojis
        sheetView.findViewById<View>(R.id.btnAttachStickers).setOnClickListener {
            bottomSheet.dismiss()
            showEmojiPickerDialog()
        }

        // 5. GIFs
        sheetView.findViewById<View>(R.id.btnAttachGif).setOnClickListener {
            bottomSheet.dismiss()
            showGifPickerDialog()
        }

        bottomSheet.show()
    }

    private fun showGifPickerDialog() {
        GifPickerDialogFragment { gifUrl, _ ->
            sendMessage("[GIF: $gifUrl]")
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

    private fun uploadAndSendAttachment(uri: Uri, kind: String) {
        Toast.makeText(this, "Uploading attachment…", Toast.LENGTH_SHORT).show()
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val inputStream: InputStream = contentResolver.openInputStream(uri) ?: return@launch
                val tempFile = File.createTempFile("chat_upload_", ".tmp", cacheDir)
                val outputStream = FileOutputStream(tempFile)
                inputStream.copyTo(outputStream)
                inputStream.close()
                outputStream.flush()
                outputStream.close()

                val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
                val requestFile: RequestBody = tempFile.asRequestBody(mimeType.toMediaTypeOrNull())
                val filePart = MultipartBody.Part.createFormData("file", tempFile.name, requestFile)
                val kindPart = kind.toRequestBody("text/plain".toMediaTypeOrNull())

                val res = NexaApiClient.postApi.uploadMedia(filePart, kindPart)
                withContext(Dispatchers.Main) {
                    tempFile.delete()
                    if (res.isSuccessful && res.body()?.data?.publicUrl != null) {
                        val publicUrl = res.body()!!.data!!.publicUrl!!
                        val messageText = if (kind == "photo") "📷 [Photo] $publicUrl" else "📁 [File] $publicUrl"
                        sendMessage(messageText)
                    } else {
                        Toast.makeText(this@ChatActivity, "Failed to upload attachment", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@ChatActivity, "Upload error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
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
                            isRead = m.isRead
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
                            isRead = false
                        )
                    }
                    localChatStorage.saveMessages(currentUserId, targetId, chatType, displayList)
                    withContext(Dispatchers.Main) {
                        adapter.submitList(displayList)
                        if (displayList.isNotEmpty()) {
                            binding.rvMessages.scrollToPosition(displayList.size - 1)
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
        val currentUserId = prefManager.userId
        binding.btnSend.isEnabled = false

        if (chatType == "direct") {
            stopTypingRunnable?.let { mainHandler.removeCallbacks(it) }
            SocketManager.emitTypingStop(targetId)
            isEmittingTyping = false
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                if (chatType == "direct") {
                    val req = SendDirectMessageRequest(receiverId = targetId, content = content)
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
                        localChatStorage.clearDraft(currentUserId, targetId, chatType)
                        if (msg != null) {
                            val displayMsg = DisplayMessage(
                                id = msg.messageId,
                                senderId = currentUserId,
                                senderName = null,
                                content = msg.content,
                                isSelf = true,
                                timestamp = msg.createdAt,
                                isRead = false
                            )
                            adapter.addMessage(displayMsg)
                            localChatStorage.addMessage(currentUserId, targetId, chatType, displayMsg)
                            binding.rvMessages.smoothScrollToPosition(adapter.itemCount - 1)
                        }
                    }
                } else {
                    val res = NexaApiClient.groupApi.sendGroupMessage(targetId, mapOf("content" to content))
                    if (!res.isSuccessful) {
                        throw IllegalStateException(
                            res.body()?.error?.message ?: "Server rejected group message (${res.code()})"
                        )
                    }
                    val msg = res.body()?.data
                    withContext(Dispatchers.Main) {
                        binding.btnSend.isEnabled = true
                        binding.etMessage.setText("")
                        localChatStorage.clearDraft(currentUserId, targetId, chatType)
                        if (msg != null) {
                            val displayMsg = DisplayMessage(
                                id = msg.messageId,
                                senderId = currentUserId,
                                senderName = null,
                                content = msg.content,
                                isSelf = true,
                                timestamp = msg.createdAt,
                                isRead = false
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
}
