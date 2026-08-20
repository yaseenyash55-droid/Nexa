package com.nexa.social.ui.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.nexa.social.databinding.FragmentReelsBinding
import com.nexa.social.ui.adapters.ReelAdapter
import com.nexa.social.ui.viewmodels.ReelsUiState
import com.nexa.social.ui.viewmodels.ReelsViewModel
import kotlinx.coroutines.launch

class ReelsFragment : Fragment() {
    private var _binding: FragmentReelsBinding? = null
    private val binding get() = _binding!!
    private val viewModel: ReelsViewModel by viewModels()
    private lateinit var reelAdapter: ReelAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentReelsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViewPager()
        observeViewModel()
    }

    private fun setupViewPager() {
        reelAdapter = ReelAdapter { reel ->
            viewModel.toggleLike(reel)
        }
        binding.viewPager.adapter = reelAdapter

        binding.viewPager.registerOnPageChangeCallback(object : androidx.viewpager2.widget.ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
                if (position >= reelAdapter.itemCount - 3 && reelAdapter.itemCount > 0) {
                    viewModel.loadReels(isLoadMore = true)
                }
            }
        })
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is ReelsUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.tvReelsStatus.visibility = View.GONE
                    }
                    is ReelsUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.tvReelsStatus.visibility = View.GONE
                        reelAdapter.submitList(state.reels)
                    }
                    is ReelsUiState.Empty -> {
                        binding.progressBar.visibility = View.GONE
                        binding.tvReelsStatus.visibility = View.VISIBLE
                        binding.tvReelsStatus.text = "No reels available right now. Check back later!"
                        reelAdapter.submitList(emptyList())
                    }
                    is ReelsUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        binding.tvReelsStatus.visibility = View.VISIBLE
                        binding.tvReelsStatus.text = "${state.message}\nTap to retry"
                        binding.tvReelsStatus.setOnClickListener {
                            viewModel.loadReels(isRefresh = true)
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.loadReels(isRefresh = true)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
