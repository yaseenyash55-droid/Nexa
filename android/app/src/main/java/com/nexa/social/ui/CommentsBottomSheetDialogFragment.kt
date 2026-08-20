package com.nexa.social.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.nexa.social.data.models.Comment
import com.nexa.social.data.repository.PostRepository
import com.nexa.social.databinding.DialogCommentsBinding
import com.nexa.social.ui.adapters.CommentAdapter
import kotlinx.coroutines.launch

class CommentsBottomSheetDialogFragment : BottomSheetDialogFragment() {

    companion object {
        const val ARG_POST_ID = "arg_post_id"

        fun newInstance(postId: Int): CommentsBottomSheetDialogFragment {
            return CommentsBottomSheetDialogFragment().apply {
                arguments = Bundle().apply {
                    putInt(ARG_POST_ID, postId)
                }
            }
        }
    }

    private var _binding: DialogCommentsBinding? = null
    private val binding get() = _binding!!
    private val postRepository = PostRepository()
    private lateinit var adapter: CommentAdapter
    private var postId: Int = 0
    private val commentsList = mutableListOf<Comment>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        postId = arguments?.getInt(ARG_POST_ID, 0) ?: 0
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = DialogCommentsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSendButton()
        loadComments()
    }

    private fun setupRecyclerView() {
        adapter = CommentAdapter()
        binding.rvComments.adapter = adapter
    }

    private fun setupSendButton() {
        binding.btnSendComment.setOnClickListener {
            val content = binding.etCommentInput.text.toString().trim()
            if (content.isEmpty()) return@setOnClickListener

            binding.btnSendComment.isEnabled = false
            lifecycleScope.launch {
                postRepository.addComment(postId, content).onSuccess { newComment ->
                    commentsList.add(0, newComment)
                    adapter.submitList(commentsList.toList())
                    binding.etCommentInput.text?.clear()
                    binding.tvNoComments.visibility = View.GONE
                    binding.rvComments.scrollToPosition(0)
                }.onFailure { err ->
                    Toast.makeText(context, "Failed to post comment: ${err.message}", Toast.LENGTH_SHORT).show()
                }
                binding.btnSendComment.isEnabled = true
            }
        }
    }

    private fun loadComments() {
        binding.commentsProgressBar.visibility = View.VISIBLE
        binding.tvNoComments.visibility = View.GONE

        lifecycleScope.launch {
            postRepository.getComments(postId).onSuccess { comments ->
                binding.commentsProgressBar.visibility = View.GONE
                commentsList.clear()
                commentsList.addAll(comments)
                adapter.submitList(commentsList.toList())
                binding.tvNoComments.visibility = if (comments.isEmpty()) View.VISIBLE else View.GONE
            }.onFailure { err ->
                binding.commentsProgressBar.visibility = View.GONE
                binding.tvNoComments.visibility = View.VISIBLE
                binding.tvNoComments.text = "Unable to load comments (${err.message})"
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
