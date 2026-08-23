package com.nexa.social.ui.fragments

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.nexa.social.databinding.FragmentMessagesBinding
import com.nexa.social.ui.ChatActivity
import com.nexa.social.ui.adapters.ConversationAdapter
import com.nexa.social.ui.adapters.UserAdapter
import com.nexa.social.ui.viewmodels.MessagesUiState
import com.nexa.social.ui.viewmodels.MessagesViewModel
import com.nexa.social.data.models.Conversation
import com.nexa.social.data.repository.UserRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MessagesFragment : Fragment() {
    private var _binding: FragmentMessagesBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MessagesViewModel by viewModels()
    private lateinit var conversationAdapter: ConversationAdapter
    private lateinit var userAdapter: UserAdapter
    private val userRepository = UserRepository()
    private var allConversations: List<Conversation> = emptyList()
    private var searchJob: Job? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentMessagesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSearch()
        setupSwipeRefresh()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        conversationAdapter = ConversationAdapter { conversation ->
            openDirectChat(
                conversation.otherUserId,
                conversation.resolvedUsername(),
                conversation.resolvedDisplayName()
            )
        }
        userAdapter = UserAdapter { user -> openDirectChat(user.userId, user.username, user.displayName) }
        binding.rvConversations.adapter = conversationAdapter
    }

    private fun setupSearch() {
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(text: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(text: CharSequence?, start: Int, before: Int, count: Int) {
                applySearch(text?.toString().orEmpty())
            }
            override fun afterTextChanged(text: Editable?) = Unit
        })
    }

    private fun applySearch(rawQuery: String) {
        val query = rawQuery.trim()
        searchJob?.cancel()

        if (query.isEmpty()) {
            binding.progressBar.visibility = View.GONE
            binding.tvError.visibility = View.GONE
            binding.tvSearchMode.text = "Conversations"
            binding.rvConversations.adapter = conversationAdapter
            conversationAdapter.submitList(allConversations)
            return
        }

        val matchingConversations = allConversations.filter { conversation ->
            conversation.matchesSearch(query)
        }

        if (matchingConversations.isNotEmpty()) {
            binding.progressBar.visibility = View.GONE
            binding.tvError.visibility = View.GONE
            binding.tvSearchMode.text = "Matching conversations"
            binding.rvConversations.adapter = conversationAdapter
            conversationAdapter.submitList(matchingConversations)
            return
        }

        if (query.length < 2) {
            binding.progressBar.visibility = View.GONE
            binding.tvSearchMode.text = "Search accounts"
            binding.rvConversations.adapter = userAdapter
            userAdapter.submitList(emptyList())
            binding.tvError.visibility = View.VISIBLE
            binding.tvError.text = "Type at least 2 characters to find an account"
            return
        }

        binding.tvSearchMode.text = "Searching accounts"
        binding.progressBar.visibility = View.VISIBLE
        binding.tvError.visibility = View.GONE
        searchJob = viewLifecycleOwner.lifecycleScope.launch {
            delay(300)
            val currentQuery = binding.etSearch.text?.toString()?.trim().orEmpty()
            if (!currentQuery.equals(query, ignoreCase = true)) return@launch

            val users = userRepository.searchUsers(query).getOrElse { emptyList() }
            if (_binding == null || !binding.etSearch.text?.toString()?.trim().equals(query, ignoreCase = true)) {
                return@launch
            }
            binding.progressBar.visibility = View.GONE
            binding.rvConversations.adapter = userAdapter
            binding.tvSearchMode.text = "Accounts"
            userAdapter.submitList(users)
            binding.tvError.visibility = if (users.isEmpty()) View.VISIBLE else View.GONE
            binding.tvError.text = "No conversations or accounts found"
        }
    }

    private fun openDirectChat(userId: Int, username: String, displayName: String) {
        if (userId <= 0) return
        val intent = Intent(context, ChatActivity::class.java).apply {
            putExtra(ChatActivity.EXTRA_TARGET_ID, userId)
            putExtra(ChatActivity.EXTRA_TARGET_NAME, displayName.ifBlank { username })
            putExtra(ChatActivity.EXTRA_CHAT_TYPE, "direct")
            putExtra("userId", userId)
            putExtra("username", username)
            putExtra("displayName", displayName)
        }
        startActivity(intent)
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadConversations()
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.loadConversations()
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is MessagesUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.tvError.visibility = View.GONE
                    }
                    is MessagesUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        binding.tvError.visibility = View.GONE
                        allConversations = state.conversations.filter { it.otherUserId > 0 }
                        applySearch(binding.etSearch.text?.toString().orEmpty())
                    }
                    is MessagesUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        binding.tvError.visibility = View.VISIBLE
                        binding.tvError.text = state.message
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        searchJob?.cancel()
        super.onDestroyView()
        _binding = null
    }
}
