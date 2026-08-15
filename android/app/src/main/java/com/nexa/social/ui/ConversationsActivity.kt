package com.nexa.social.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.tabs.TabLayout
import com.nexa.social.NexaApiClient
import com.nexa.social.databinding.ActivityConversationsBinding
import com.nexa.social.utils.PreferenceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ConversationsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityConversationsBinding
    private lateinit var prefManager: PreferenceManager
    private lateinit var adapter: ConversationsAdapter

    private var activeTab: Int = 0 // 0 = Direct, 1 = Groups

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityConversationsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefManager = PreferenceManager(this)

        setupToolbar()
        setupRecyclerView()
        setupTabLayout()
        setupFab()
        setupSwipeRefresh()

        loadData()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupRecyclerView() {
        adapter = ConversationsAdapter { item ->
            when (item) {
                is ConversationItem.Direct -> {
                    val intent = Intent(this, ChatActivity::class.java).apply {
                        putExtra(ChatActivity.EXTRA_CHAT_TYPE, "direct")
                        putExtra(ChatActivity.EXTRA_TARGET_ID, item.user.userId)
                        putExtra(ChatActivity.EXTRA_TARGET_NAME, item.user.displayName)
                    }
                    startActivity(intent)
                }
                is ConversationItem.GroupChat -> {
                    val intent = Intent(this, ChatActivity::class.java).apply {
                        putExtra(ChatActivity.EXTRA_CHAT_TYPE, "group")
                        putExtra(ChatActivity.EXTRA_TARGET_ID, item.group.groupId)
                        putExtra(ChatActivity.EXTRA_TARGET_NAME, item.group.name)
                    }
                    startActivity(intent)
                }
            }
        }

        binding.rvConversations.layoutManager = LinearLayoutManager(this)
        binding.rvConversations.adapter = adapter
    }

    private fun setupTabLayout() {
        binding.tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                activeTab = tab?.position ?: 0
                loadData()
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            loadData()
        }
    }

    private fun setupFab() {
        binding.fabBroadcast.setOnClickListener {
            showBroadcastDialog()
        }
    }

    private fun loadData() {
        binding.swipeRefresh.isRefreshing = true
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                if (activeTab == 0) {
                    val res = NexaApiClient.authApi.getSuggestions()
                    val users = res.body()?.data ?: emptyList()
                    val items = users.map { ConversationItem.Direct(it) }
                    withContext(Dispatchers.Main) {
                        adapter.submitList(items)
                        binding.swipeRefresh.isRefreshing = false
                    }
                } else {
                    val res = NexaApiClient.groupApi.getUserGroups()
                    val groups = res.body()?.data ?: emptyList()
                    val items = groups.map { ConversationItem.GroupChat(it) }
                    withContext(Dispatchers.Main) {
                        adapter.submitList(items)
                        binding.swipeRefresh.isRefreshing = false
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.swipeRefresh.isRefreshing = false
                    Toast.makeText(this@ConversationsActivity, "Failed to load: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showBroadcastDialog() {
        val builder = AlertDialog.Builder(this)
        builder.setTitle("New Message Broadcast")
        builder.setMessage("Broadcast message will be sent as individual 1-on-1 direct messages to contacts.")
        builder.setPositiveButton("Dispatch") { dialog, _ ->
            dialog.dismiss()
            Toast.makeText(this, "Broadcast feature active. Open a conversation or web portal to select target list.", Toast.LENGTH_LONG).show()
        }
        builder.setNegativeButton("Cancel") { dialog, _ -> dialog.dismiss() }
        builder.show()
    }
}
