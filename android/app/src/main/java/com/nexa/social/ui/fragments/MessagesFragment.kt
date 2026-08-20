package com.nexa.social.ui.fragments

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.nexa.social.databinding.FragmentMessagesBinding
import com.nexa.social.ui.ChatActivity
import com.nexa.social.ui.adapters.ConversationAdapter
import com.nexa.social.ui.viewmodels.MessagesUiState
import com.nexa.social.ui.viewmodels.MessagesViewModel
import kotlinx.coroutines.launch

class MessagesFragment : Fragment() {
    private var _binding: FragmentMessagesBinding? = null
    private val binding get() = _binding!!
    private val viewModel: MessagesViewModel by viewModels()
    private lateinit var conversationAdapter: ConversationAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentMessagesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSwipeRefresh()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        conversationAdapter = ConversationAdapter { conversation ->
            if (conversation.otherUserId > 0) {
                val intent = Intent(context, ChatActivity::class.java).apply {
                    putExtra(ChatActivity.EXTRA_TARGET_ID, conversation.otherUserId)
                    val targetName = if (conversation.displayName.isNotBlank()) conversation.displayName else conversation.username
                    putExtra(ChatActivity.EXTRA_TARGET_NAME, targetName)
                    putExtra(ChatActivity.EXTRA_CHAT_TYPE, "direct")
                    // Backward-compatible extras
                    putExtra("userId", conversation.otherUserId)
                    putExtra("username", conversation.username)
                    putExtra("displayName", conversation.displayName)
                }
                startActivity(intent)
            }
        }
        binding.rvConversations.adapter = conversationAdapter
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
                        conversationAdapter.submitList(state.conversations)
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
        super.onDestroyView()
        _binding = null
    }
}
