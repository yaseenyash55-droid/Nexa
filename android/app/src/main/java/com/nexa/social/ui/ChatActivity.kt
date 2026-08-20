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
import com.nexa.social.data.models.DisplayMessage
import com.nexa.social.data.models.SendDirectMessageRequest
import com.nexa.social.databinding.ActivityChatBinding
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

        chatType = intent.getStringExtra(EXTRA_CHAT_TYPE) ?: "direct"
        targetId = intent.getIntExtra(EXTRA_TARGET_ID, intent.getIntExtra("userId", 0))
        targetName = intent.getStringExtra(EXTRA_TARGET_NAME)
            ?: intent.getStringExtra("displayName")
            ?: intent.getStringExtra("username")
            ?: "Chat"

        if (targetId <= 0) {
            Toast.makeText(this, "Invalid chat recipient", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        setupToolbar()
        setupRecyclerView()
        setupSendButton()
        setupTypingListeners()
        setupRealtimeMessageListeners()
        setupTextWatcher()

        loadMessages()
    }

    override fun onDestroy() {
        super.onDestroy()
        SocketManager.removeTypingListeners()
        SocketManager.unregisterMessageListener()
        SocketManager.unregisterGroupMessageListener()
        stopTypingRunnable?.let { mainHandler.removeCallbacks(it) }
    }

    private fun setupToolbar() {
        binding.toolbar.title = targetName
        binding.toolbar.subtitle = if (chatType == "direct") "Direct Conversation" else "Group Conversation"
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupRecyclerView() {
        val currentUserId = prefManager.userId
        adapter = MessagesAdapter(currentUserId = currentUserId)

        binding.rvMessages.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        binding.rvMessages.adapter = adapter
    }

    private fun setupRealtimeMessageListeners() {
        if (chatType == "direct") {
            SocketManager.registerMessageListener { message ->
                if (message.senderId == targetId) {
                    val displayMsg = DisplayMessage(
                        id = message.messageId,
                        senderId = message.senderId,
                        senderName = targetName,
                        content = message.content,
                        isSelf = false,
                        timestamp = message.createdAt
                    )
                    adapter.addMessage(displayMsg)
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
                        timestamp = groupMsg.createdAt
                    )
                    adapter.addMessage(displayMsg)
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
                    val rawMessages = res.body()?.data ?: emptyList()
                    val displayList = rawMessages.map { m ->
                        DisplayMessage(
                            id = m.messageId,
                            senderId = m.senderId,
                            senderName = if (m.senderId == currentUserId) null else targetName,
                            content = m.content,
                            isSelf = m.senderId == currentUserId,
                            timestamp = m.createdAt
                        )
                    }
                    withContext(Dispatchers.Main) {
                        adapter.submitList(displayList)
                        if (displayList.isNotEmpty()) {
                            binding.rvMessages.scrollToPosition(displayList.size - 1)
                        }
                    }
                } else {
                    val res = NexaApiClient.groupApi.getGroupMessages(targetId)
                    val rawMessages = res.body()?.data ?: emptyList()
                    val displayList = rawMessages.map { m ->
                        DisplayMessage(
                            id = m.messageId,
                            senderId = m.senderId,
                            senderName = m.sender.displayName,
                            content = m.content,
                            isSelf = m.senderId == currentUserId,
                            timestamp = m.createdAt
                        )
                    }
                    withContext(Dispatchers.Main) {
                        adapter.submitList(displayList)
                        if (displayList.isNotEmpty()) {
                            binding.rvMessages.scrollToPosition(displayList.size - 1)
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@ChatActivity, "Failed to load messages: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun sendMessage(content: String) {
        val currentUserId = prefManager.userId
        binding.etMessage.setText("")

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
                    val msg = res.body()?.data
                    if (msg != null) {
                        val displayMsg = DisplayMessage(
                            id = msg.messageId,
                            senderId = msg.senderId,
                            senderName = null,
                            content = msg.content,
                            isSelf = true,
                            timestamp = msg.createdAt
                        )
                        withContext(Dispatchers.Main) {
                            adapter.addMessage(displayMsg)
                            binding.rvMessages.smoothScrollToPosition(adapter.itemCount - 1)
                        }
                    }
                } else {
                    val res = NexaApiClient.groupApi.sendGroupMessage(targetId, mapOf("content" to content))
                    val msg = res.body()?.data
                    if (msg != null) {
                        val displayMsg = DisplayMessage(
                            id = msg.messageId,
                            senderId = msg.senderId,
                            senderName = msg.sender.displayName,
                            content = msg.content,
                            isSelf = true,
                            timestamp = msg.createdAt
                        )
                        withContext(Dispatchers.Main) {
                            adapter.addMessage(displayMsg)
                            binding.rvMessages.smoothScrollToPosition(adapter.itemCount - 1)
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@ChatActivity, "Failed to send: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
