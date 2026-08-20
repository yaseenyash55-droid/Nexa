package com.nexa.social.ui.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import com.nexa.social.databinding.FragmentHomeBinding
import com.nexa.social.ui.adapters.PostAdapter
import com.nexa.social.ui.viewmodels.HomeUiState
import com.nexa.social.ui.viewmodels.HomeViewModel
import kotlinx.coroutines.launch

class HomeFragment : Fragment() {
    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!
    private val viewModel: HomeViewModel by activityViewModels()
    private lateinit var postAdapter: PostAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSwipeRefresh()
        observeViewModel()
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
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
