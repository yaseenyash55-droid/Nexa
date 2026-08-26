package com.nexa.social.ui.fragments

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import com.nexa.social.data.repository.StoryRepository
import com.nexa.social.databinding.FragmentHomeBinding
import com.nexa.social.ui.CreateStoryActivity
import com.nexa.social.ui.StoryViewerActivity
import com.nexa.social.ui.adapters.PostAdapter
import com.nexa.social.ui.adapters.StoryAdapter
import com.nexa.social.ui.viewmodels.HomeUiState
import com.nexa.social.ui.viewmodels.HomeViewModel
import kotlinx.coroutines.launch

class HomeFragment : Fragment() {
    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    private val viewModel: HomeViewModel by activityViewModels()
    private lateinit var postAdapter: PostAdapter
    private lateinit var storyAdapter: StoryAdapter
    private val storyRepository = StoryRepository()

    private val createStoryLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == android.app.Activity.RESULT_OK && _binding != null) {
            loadStories()
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupStories()
        setupSwipeRefresh()
        observeViewModel()
    }

    private fun setupStories() {
        storyAdapter = StoryAdapter(
            currentUserId = com.nexa.social.utils.PreferenceManager(requireContext()).userId,
            onAddStory = {
                createStoryLauncher.launch(Intent(requireContext(), CreateStoryActivity::class.java))
            },
            onStoryClick = { stories ->
                startActivity(StoryViewerActivity.createIntent(requireContext(), stories))
            }
        )
        binding.rvStories.adapter = storyAdapter
    }

    private fun loadStories() {
        viewLifecycleOwner.lifecycleScope.launch {
            storyRepository.getFeed()
                .onSuccess { storyAdapter.submitStories(it) }
                .onFailure {
                    if (storyAdapter.itemCount <= 1) {
                        Toast.makeText(requireContext(), "Cosmic temporarily unavailable", Toast.LENGTH_SHORT).show()
                    }
                }
        }
    }

    private fun setupRecyclerView() {
        postAdapter = PostAdapter(
            onLikeClick = { post ->
                viewModel.toggleLike(post)
            },
            onCommentClick = { post ->
                val dialog = com.nexa.social.ui.CommentsBottomSheetDialogFragment.newInstance(post.postId)
                dialog.show(childFragmentManager, "comments_dialog")
            },
            onBookmarkClick = { post ->
                viewModel.toggleBookmark(post)
            },
            onDeleteClick = { post ->
                lifecycleScope.launch {
                    val repo = com.nexa.social.data.repository.PostRepository()
                    repo.deletePost(post.postId).onSuccess {
                        android.widget.Toast.makeText(requireContext(), "Post deleted successfully", android.widget.Toast.LENGTH_SHORT).show()
                        viewModel.loadFeed(isRefresh = true)
                    }.onFailure {
                        android.widget.Toast.makeText(requireContext(), "Failed to delete post: ${it.message}", android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
            }
        )
        binding.rvFeed.adapter = postAdapter

        binding.rvFeed.addOnScrollListener(object : androidx.recyclerview.widget.RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: androidx.recyclerview.widget.RecyclerView, dx: Int, dy: Int) {
                super.onScrolled(recyclerView, dx, dy)
                if (dy > 0) {
                    val layoutManager = recyclerView.layoutManager as? androidx.recyclerview.widget.LinearLayoutManager
                    val totalItemCount = layoutManager?.itemCount ?: 0
                    val lastVisibleItem = layoutManager?.findLastVisibleItemPosition() ?: 0
                    if (totalItemCount > 0 && lastVisibleItem >= totalItemCount - 4) {
                        viewModel.loadFeed(isLoadMore = true)
                    }
                }
            }
        })
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadFeed(isRefresh = true)
            loadStories()
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is HomeUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.tvError.visibility = View.GONE
                    }
                    is HomeUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        binding.tvError.visibility = View.GONE
                        postAdapter.submitList(state.posts)
                    }
                    is HomeUiState.Empty -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        binding.tvError.visibility = View.VISIBLE
                        binding.tvError.text = "No posts yet. Follow people or create a post to get started!"
                        postAdapter.submitList(emptyList())
                    }
                    is HomeUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        binding.tvError.visibility = View.VISIBLE
                        binding.tvError.text = "${state.message}\nTap to retry"
                        binding.tvError.setOnClickListener {
                            viewModel.loadFeed(isRefresh = true)
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.loadFeed(isRefresh = true)
        loadStories()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
