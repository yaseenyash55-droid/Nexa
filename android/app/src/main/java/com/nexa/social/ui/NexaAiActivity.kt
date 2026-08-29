package com.nexa.social.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.core.view.GravityCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButtonToggleGroup
import com.nexa.social.R
import com.nexa.social.data.models.AiConversation
import com.nexa.social.data.models.AiMemory
import com.nexa.social.data.models.AiMessage
import com.nexa.social.data.models.AiPreference
import com.nexa.social.data.models.AiUpdatePreferencesRequest
import com.nexa.social.data.repository.AiRepository
import com.nexa.social.data.repository.AiStreamListener
import com.nexa.social.data.repository.CancellableStream
import com.nexa.social.databinding.ActivityNexaAiBinding
import com.nexa.social.utils.NetworkMonitor
import com.nexa.social.utils.PreferenceManager
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class NexaAiActivity : AppCompatActivity() {

    private lateinit var binding: ActivityNexaAiBinding
    private lateinit var aiRepository: AiRepository
    private lateinit var prefManager: PreferenceManager
    private lateinit var networkMonitor: NetworkMonitor

    private lateinit var messagesAdapter: AiMessagesAdapter
    private lateinit var conversationsAdapter: AiConversationsAdapter

    private val messagesList = mutableListOf<AiMessage>()
    private var activeConversationId: Int? = null
    private var isStreaming = false
    private var currentStream: CancellableStream? = null

    companion object {
        const val EXTRA_CONVERSATION_ID = "extra_conversation_id"

        fun createIntent(context: Context, conversationId: Int? = null): Intent {
            return Intent(context, NexaAiActivity::class.java).apply {
                if (conversationId != null) {
                    putExtra(EXTRA_CONVERSATION_ID, conversationId)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNexaAiBinding.inflate(layoutInflater)
        setContentView(binding.root)

        aiRepository = AiRepository()
        prefManager = PreferenceManager(this)
        networkMonitor = NetworkMonitor(this)

        val initialConvId = intent.getIntExtra(EXTRA_CONVERSATION_ID, -1)
        if (initialConvId > 0) {
            activeConversationId = initialConvId
        }

        setupToolbar()
        setupRecyclerViews()
        setupComposer()
        setupQuickPrompts()
        setupNetworkMonitoring()

        fetchAiStatus()
        loadConversations()

        if (activeConversationId != null) {
            loadConversation(activeConversationId!!)
        }
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.btnToggleHistory.setOnClickListener {
            if (binding.drawerLayout.isDrawerOpen(GravityCompat.END)) {
                binding.drawerLayout.closeDrawer(GravityCompat.END)
            } else {
                binding.drawerLayout.openDrawer(GravityCompat.END)
            }
        }

        binding.btnAiSettings.setOnClickListener {
            showSettingsBottomSheet()
        }

        binding.btnNewChat.setOnClickListener {
            startNewConversation()
        }
    }

    private fun setupRecyclerViews() {
        messagesAdapter = AiMessagesAdapter()
        binding.rvAiMessages.apply {
            adapter = messagesAdapter
            layoutManager = LinearLayoutManager(this@NexaAiActivity).apply {
                stackFromEnd = true
            }
        }

        conversationsAdapter = AiConversationsAdapter(
            onConversationSelected = { conv ->
                if (isStreaming) stopGeneration()
                activeConversationId = conv.conversationId
                loadConversation(conv.conversationId)
                binding.drawerLayout.closeDrawer(GravityCompat.END)
            },
            onDeleteClicked = { conv ->
                confirmDeleteConversation(conv)
            }
        )
        binding.rvConversationsDrawer.apply {
            adapter = conversationsAdapter
            layoutManager = LinearLayoutManager(this@NexaAiActivity)
        }
    }

    private fun setupComposer() {
        binding.btnAiSend.setOnClickListener {
            val text = binding.etAiInput.text.toString().trim()
            if (text.isNotEmpty()) {
                sendMessage(text)
            }
        }

        binding.etAiInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                val text = binding.etAiInput.text.toString().trim()
                if (text.isNotEmpty()) {
                    sendMessage(text)
                }
                true
            } else {
                false
            }
        }

        binding.btnStopGeneration.setOnClickListener {
            stopGeneration()
        }
    }

    private fun setupQuickPrompts() {
        binding.chipPromptExplain.setOnClickListener {
            binding.etAiInput.setText("Explain this concept simply: ")
            binding.etAiInput.setSelection(binding.etAiInput.text.length)
            focusInput()
        }

        binding.chipPromptCaption.setOnClickListener {
            binding.etAiInput.setText("Generate an engaging social media post caption about ")
            binding.etAiInput.setSelection(binding.etAiInput.text.length)
            focusInput()
        }

        binding.chipPromptBrainstorm.setOnClickListener {
            binding.etAiInput.setText("Brainstorm 5 creative ideas for ")
            binding.etAiInput.setSelection(binding.etAiInput.text.length)
            focusInput()
        }

        binding.chipPromptCode.setOnClickListener {
            binding.etAiInput.setText("Write and explain code for ")
            binding.etAiInput.setSelection(binding.etAiInput.text.length)
            focusInput()
        }
    }

    private fun focusInput() {
        binding.etAiInput.requestFocus()
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.showSoftInput(binding.etAiInput, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun setupNetworkMonitoring() {
        networkMonitor.isOnline.observe(this) { isOnline ->
            if (!isOnline) {
                binding.tvOfflineBanner.visibility = View.VISIBLE
            } else {
                binding.tvOfflineBanner.visibility = View.GONE
            }
        }
    }

    private fun fetchAiStatus() {
        lifecycleScope.launch {
            val result = aiRepository.getStatus()
            result.onSuccess { status ->
                binding.tvAiStatusSubtitle.text = if (status.enabled) {
                    "Online • ${status.model ?: "Intelligent Assistant"}"
                } else {
                    "Offline • Service Unavailable"
                }
            }.onFailure {
                binding.tvAiStatusSubtitle.text = "Online • Intelligent Assistant"
            }
        }
    }

    private fun loadConversations() {
        lifecycleScope.launch {
            val result = aiRepository.getConversations()
            result.onSuccess { list ->
                conversationsAdapter.submitList(list)
                binding.tvEmptyConversations.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            }.onFailure {
                binding.tvEmptyConversations.visibility = if (conversationsAdapter.currentList.isEmpty()) View.VISIBLE else View.GONE
            }
        }
    }

    private fun loadConversation(id: Int) {
        lifecycleScope.launch {
            val result = aiRepository.getConversation(id)
            result.onSuccess { details ->
                messagesList.clear()
                messagesList.addAll(details.messages)
                messagesAdapter.submitList(messagesList.toList())
                updateEmptyState()
                scrollToBottom()
            }.onFailure { err ->
                Toast.makeText(this@NexaAiActivity, err.message ?: "Failed to load messages", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun startNewConversation() {
        if (isStreaming) stopGeneration()
        activeConversationId = null
        messagesList.clear()
        messagesAdapter.submitList(emptyList())
        updateEmptyState()
        binding.drawerLayout.closeDrawer(GravityCompat.END)
    }

    private fun confirmDeleteConversation(conversation: AiConversation) {
        AlertDialog.Builder(this)
            .setTitle("Delete Conversation")
            .setMessage("Are you sure you want to delete \"${conversation.title}\"?")
            .setPositiveButton("Delete") { _, _ ->
                lifecycleScope.launch {
                    val result = aiRepository.deleteConversation(conversation.conversationId)
                    result.onSuccess {
                        Toast.makeText(this@NexaAiActivity, "Conversation deleted", Toast.LENGTH_SHORT).show()
                        if (activeConversationId == conversation.conversationId) {
                            startNewConversation()
                        }
                        loadConversations()
                    }.onFailure { err ->
                        Toast.makeText(this@NexaAiActivity, err.message ?: "Delete failed", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun sendMessage(prompt: String) {
        if (isStreaming) return

        if (networkMonitor.isOnline.value == false) {
            Toast.makeText(this, "NEXA AI requires an active internet connection.", Toast.LENGTH_SHORT).show()
            return
        }

        binding.etAiInput.setText("")
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())

        // 1. Append User Message
        val userMsg = AiMessage(
            role = "user",
            content = prompt,
            createdAt = nowIso
        )
        messagesList.add(userMsg)

        // 2. Append Placeholder Assistant Message
        val assistantMsg = AiMessage(
            role = "assistant",
            content = "",
            createdAt = nowIso,
            isStreaming = true
        )
        messagesList.add(assistantMsg)

        messagesAdapter.submitList(messagesList.toList())
        updateEmptyState()
        scrollToBottom()

        // 3. UI State -> Streaming
        setStreamingUiState(true)

        // 4. Start Streaming SSE
        val assistantIndex = messagesList.size - 1
        val responseBuffer = StringBuilder()

        currentStream = aiRepository.streamChat(
            scope = lifecycleScope,
            message = prompt,
            conversationId = activeConversationId,
            listener = object : AiStreamListener {
                override fun onChunk(chunk: String) {
                    responseBuffer.append(chunk)
                    if (assistantIndex in messagesList.indices) {
                        messagesList[assistantIndex] = messagesList[assistantIndex].copy(
                            content = responseBuffer.toString(),
                            isStreaming = true
                        )
                        messagesAdapter.notifyItemChanged(assistantIndex)
                        scrollToBottom()
                    }
                }

                override fun onComplete(fullText: String, conversationId: Int) {
                    val finalText = if (fullText.isNotBlank()) fullText else responseBuffer.toString()
                    activeConversationId = conversationId
                    if (assistantIndex in messagesList.indices) {
                        messagesList[assistantIndex] = messagesList[assistantIndex].copy(
                            content = finalText,
                            conversationId = conversationId,
                            isStreaming = false
                        )
                        messagesAdapter.notifyItemChanged(assistantIndex)
                    }
                    setStreamingUiState(false)
                    loadConversations()
                }

                override fun onError(error: Throwable) {
                    val errorText = error.message ?: "Failed to generate AI response"
                    if (assistantIndex in messagesList.indices) {
                        val currentText = responseBuffer.toString()
                        val combined = if (currentText.isBlank()) {
                            "⚠️ $errorText"
                        } else {
                            "$currentText\n\n⚠️ $errorText"
                        }
                        messagesList[assistantIndex] = messagesList[assistantIndex].copy(
                            content = combined,
                            isStreaming = false
                        )
                        messagesAdapter.notifyItemChanged(assistantIndex)
                    }
                    setStreamingUiState(false)
                    Toast.makeText(this@NexaAiActivity, errorText, Toast.LENGTH_LONG).show()
                }
            }
        )
    }

    private fun stopGeneration() {
        currentStream?.cancel()
        currentStream = null
        if (messagesList.isNotEmpty()) {
            val lastIdx = messagesList.size - 1
            if (messagesList[lastIdx].isStreaming) {
                messagesList[lastIdx] = messagesList[lastIdx].copy(isStreaming = false)
                messagesAdapter.notifyItemChanged(lastIdx)
            }
        }
        setStreamingUiState(false)
        Toast.makeText(this, "Generation stopped", Toast.LENGTH_SHORT).show()
    }

    private fun setStreamingUiState(streaming: Boolean) {
        isStreaming = streaming
        binding.btnStopGeneration.visibility = if (streaming) View.VISIBLE else View.GONE
        binding.btnAiSend.visibility = if (streaming) View.GONE else View.VISIBLE
        binding.hsvQuickPrompts.visibility = if (streaming) View.GONE else View.VISIBLE
    }

    private fun updateEmptyState() {
        binding.llEmptyWelcome.visibility = if (messagesList.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun scrollToBottom() {
        if (messagesList.isNotEmpty()) {
            binding.rvAiMessages.post {
                binding.rvAiMessages.smoothScrollToPosition(messagesList.size - 1)
            }
        }
    }

    private fun showSettingsBottomSheet() {
        val dialog = BottomSheetDialog(this)
        val dialogView = layoutInflater.inflate(R.layout.dialog_ai_settings, null)
        dialog.setContentView(dialogView)

        val switchPersonalization = dialogView.findViewById<SwitchCompat>(R.id.switchPersonalization)
        val toggleResponseLength = dialogView.findViewById<MaterialButtonToggleGroup>(R.id.toggleResponseLength)
        val etLanguage = dialogView.findViewById<EditText>(R.id.etLanguage)
        val etTone = dialogView.findViewById<EditText>(R.id.etTone)
        val btnSavePreferences = dialogView.findViewById<Button>(R.id.btnSavePreferences)
        val btnCloseSettings = dialogView.findViewById<View>(R.id.btnCloseSettings)

        val etNewMemoryKey = dialogView.findViewById<EditText>(R.id.etNewMemoryKey)
        val etNewMemoryCategory = dialogView.findViewById<EditText>(R.id.etNewMemoryCategory)
        val etNewMemoryContent = dialogView.findViewById<EditText>(R.id.etNewMemoryContent)
        val btnAddMemory = dialogView.findViewById<Button>(R.id.btnAddMemory)
        val btnClearAllMemories = dialogView.findViewById<Button>(R.id.btnClearAllMemories)
        val rvMemories = dialogView.findViewById<RecyclerView>(R.id.rvMemories)
        val tvEmptyMemories = dialogView.findViewById<TextView>(R.id.tvEmptyMemories)

        btnCloseSettings.setOnClickListener { dialog.dismiss() }

        // Setup Memories RecyclerView
        lateinit var memoriesAdapter: AiMemoriesAdapter
        memoriesAdapter = AiMemoriesAdapter(
            onDeleteClicked = { memory ->
                lifecycleScope.launch {
                    val result = aiRepository.deleteMemory(memory.memoryId)
                    result.onSuccess {
                        Toast.makeText(this@NexaAiActivity, "Memory deleted", Toast.LENGTH_SHORT).show()
                        loadMemoriesForDialog(memoriesAdapter, tvEmptyMemories)
                    }.onFailure {
                        Toast.makeText(this@NexaAiActivity, "Failed to delete memory", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
        rvMemories.layoutManager = LinearLayoutManager(this)
        rvMemories.adapter = memoriesAdapter

        // Load Preferences
        lifecycleScope.launch {
            val prefResult = aiRepository.getPreferences()
            prefResult.onSuccess { prefs ->
                switchPersonalization.isChecked = prefs.personalizationEnabled
                etLanguage.setText(prefs.preferredLanguage)
                etTone.setText(prefs.writingTone)
                when (prefs.responseLength) {
                    "concise" -> toggleResponseLength.check(R.id.btnLengthConcise)
                    "detailed" -> toggleResponseLength.check(R.id.btnLengthDetailed)
                    else -> toggleResponseLength.check(R.id.btnLengthBalanced)
                }
            }
        }

        // Save Preferences
        btnSavePreferences.setOnClickListener {
            val length = when (toggleResponseLength.checkedButtonId) {
                R.id.btnLengthConcise -> "concise"
                R.id.btnLengthDetailed -> "detailed"
                else -> "balanced"
            }
            val updateReq = AiUpdatePreferencesRequest(
                personalizationEnabled = switchPersonalization.isChecked,
                preferredLanguage = etLanguage.text.toString().trim().ifEmpty { "en" },
                responseLength = length,
                writingTone = etTone.text.toString().trim().ifEmpty { "friendly" }
            )
            lifecycleScope.launch {
                val updateResult = aiRepository.updatePreferences(updateReq)
                updateResult.onSuccess {
                    Toast.makeText(this@NexaAiActivity, "Preferences saved", Toast.LENGTH_SHORT).show()
                }.onFailure { err ->
                    Toast.makeText(this@NexaAiActivity, err.message ?: "Failed to save preferences", Toast.LENGTH_SHORT).show()
                }
            }
        }

        // Load Memories
        loadMemoriesForDialog(memoriesAdapter, tvEmptyMemories)

        // Add Memory
        btnAddMemory.setOnClickListener {
            val key = etNewMemoryKey.text.toString().trim()
            val cat = etNewMemoryCategory.text.toString().trim().ifEmpty { "general" }
            val content = etNewMemoryContent.text.toString().trim()

            if (key.isEmpty() || content.isEmpty()) {
                Toast.makeText(this, "Please enter both key and memory content", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            lifecycleScope.launch {
                val res = aiRepository.createMemory(key, content, cat)
                res.onSuccess {
                    Toast.makeText(this@NexaAiActivity, "Memory saved", Toast.LENGTH_SHORT).show()
                    etNewMemoryKey.setText("")
                    etNewMemoryContent.setText("")
                    loadMemoriesForDialog(memoriesAdapter, tvEmptyMemories)
                }.onFailure { err ->
                    Toast.makeText(this@NexaAiActivity, err.message ?: "Failed to save memory", Toast.LENGTH_SHORT).show()
                }
            }
        }

        // Clear All Memories
        btnClearAllMemories.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Clear All Memories")
                .setMessage("Are you sure you want to clear all stored AI memories?")
                .setPositiveButton("Clear All") { _, _ ->
                    lifecycleScope.launch {
                        val res = aiRepository.clearAllMemories()
                        res.onSuccess {
                            Toast.makeText(this@NexaAiActivity, "All memories cleared", Toast.LENGTH_SHORT).show()
                            loadMemoriesForDialog(memoriesAdapter, tvEmptyMemories)
                        }.onFailure {
                            Toast.makeText(this@NexaAiActivity, "Failed to clear memories", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        dialog.show()
    }

    private fun loadMemoriesForDialog(adapter: AiMemoriesAdapter, tvEmpty: TextView) {
        lifecycleScope.launch {
            val memoriesResult = aiRepository.getMemories()
            memoriesResult.onSuccess { list ->
                adapter.submitList(list)
                tvEmpty.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            }.onFailure {
                tvEmpty.visibility = View.VISIBLE
            }
        }
    }

    override fun onStart() {
        super.onStart()
        networkMonitor.startMonitoring()
    }

    override fun onStop() {
        super.onStop()
        networkMonitor.stopMonitoring()
    }

    override fun onDestroy() {
        super.onDestroy()
        currentStream?.cancel()
    }
}
