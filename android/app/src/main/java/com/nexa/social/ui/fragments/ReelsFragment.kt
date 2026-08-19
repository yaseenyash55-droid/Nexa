package com.nexa.social.ui.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
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
            Toast.makeText(context, "Liked reel ${reel.reelId}", Toast.LENGTH_SHORT).show()
        }
        binding.viewPager.adapter = reelAdapter
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is ReelsUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                    }
                    is ReelsUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        reelAdapter.submitList(state.reels)
                    }
                    is ReelsUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        Toast.makeText(context, state.message, Toast.LENGTH_SHORT).show()
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
