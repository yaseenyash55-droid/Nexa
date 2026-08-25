package com.nexa.social.ui

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
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
        setupTypingListeners()
        setupRealtimeMessageListeners()
        setupTextWatcher()

        // Immediate offline storage load
        loadCachedMessages()

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

        androidx.appcompat.app.AlertDialog.Builder(this)
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
        SocketManager.setTypingListeners(
            onStart = { userId, username ->
                if (chatType == "direct" && userId == targetId) {
                    binding.tvTypingIndicator.text = "${username ?: targetName} is typing..."
                    binding.tvTypingIndicator.visibility = View.VISIBLE
                }
            },
            onStop = { userId ->
                if (chatType == "direct" && userId == targetId) {
                    binding.tvTypingIndicator.visibility = View.GONE
                }
            }
        )
    }

    private fun setupTextWatcher() {
        binding.etMessage.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                if (chatType != "direct" || targetId == 0) return

                if (!s.isNullOrEmpty()) {
                    if (!isEmittingTyping) {
                        isEmittingTyping = true
                        SocketManager.emitTypingStart(targetId)
                    }

                    stopTypingRunnable?.let { mainHandler.removeCallbacks(it) }
                    stopTypingRunnable = Runnable {
                        SocketManager.emitTypingStop(targetId)
                        isEmittingTyping = false
                    }
                    mainHandler.postDelayed(stopTypingRunnable!!, 2000)
                } else {
                    stopTypingRunnable?.let { mainHandler.removeCallbacks(it) }
                    SocketManager.emitTypingStop(targetId)
                    isEmittingTyping = false
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun setupSendButton() {
        binding.btnSend.setOnClickListener {
            val text = binding.etMessage.text.toString().trim()
            if (text.isNotEmpty()) {
                sendMessage(text)
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
                        ?: throw IllegalStateException("Server returned an empty message response")
                    val displayMsg = DisplayMessage(
                        id = msg.messageId,
                        senderId = msg.senderId,
                        senderName = null,
                        content = msg.content,
                        isSelf = true,
                        timestamp = msg.createdAt,
                        isRead = false
                    )
                    localChatStorage.addMessage(currentUserId, targetId, chatType, displayMsg)
                    withContext(Dispatchers.Main) {
                        if (binding.etMessage.text.toString().trim() == content) {
                            binding.etMessage.setText("")
                        }
                        adapter.addMessage(displayMsg)
                        binding.rvMessages.smoothScrollToPosition(adapter.itemCount - 1)
                    }
                } else {
                    val res = NexaApiClient.groupApi.sendGroupMessage(targetId, mapOf("content" to content))
                    if (!res.isSuccessful) {
                        throw IllegalStateException(
                            res.body()?.error?.message ?: "Server rejected group message (${res.code()})"
                        )
                    }
                    val msg = res.body()?.data
                        ?: throw IllegalStateException("Server returned an empty group message response")
                    val displayMsg = DisplayMessage(
                        id = msg.messageId,
                        senderId = msg.senderId,
                        senderName = msg.sender.displayName,
                        content = msg.content,
                        isSelf = true,
                        timestamp = msg.createdAt,
                        isRead = false
                    )
                    localChatStorage.addMessage(currentUserId, targetId, chatType, displayMsg)
                    withContext(Dispatchers.Main) {
                        if (binding.etMessage.text.toString().trim() == content) {
                            binding.etMessage.setText("")
                        }
                        adapter.addMessage(displayMsg)
                        binding.rvMessages.smoothScrollToPosition(adapter.itemCount - 1)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@ChatActivity, "Failed to send: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                withContext(Dispatchers.Main) {
                    binding.btnSend.isEnabled = true
                }
            }
        }
    }
}
