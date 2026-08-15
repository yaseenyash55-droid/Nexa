package com.nexa.social.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
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

    private var activeTab: Int = 0 // 0 = Direct, 1 = Groups, 2 = Broadcasts

    private val actionLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            loadData()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityConversationsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefManager = PreferenceManager(this)

        setupToolbar()
        setupRecyclerView()
        setupTabLayout()
        setupFabs()
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
                is ConversationItem.BroadcastList -> {
                    val builder = AlertDialog.Builder(this)
                    builder.setTitle(item.broadcast.title ?: "Broadcast Log")
                    builder.setMessage("Dispatched to ${item.broadcast.recipientsCount} recipients:\n\n${item.broadcast.content}")
                    builder.setPositiveButton("Close") { dialog, _ -> dialog.dismiss() }
                    builder.show()
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

    private fun setupFabs() {
        binding.fabCreateGroup.setOnClickListener {
            actionLauncher.launch(Intent(this, CreateGroupActivity::class.java))
        }

        binding.fabBroadcast.setOnClickListener {
            actionLauncher.launch(Intent(this, CreateBroadcastActivity::class.java))
        }
    }

    private fun loadData() {
        binding.swipeRefresh.isRefreshing = true
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                when (activeTab) {
                    0 -> {
                        val res = NexaApiClient.authApi.getSuggestions()
                        val users = res.body()?.data ?: emptyList()
                        val items = users.map { ConversationItem.Direct(it) }
                        withContext(Dispatchers.Main) {
                            adapter.submitList(items)
                            binding.swipeRefresh.isRefreshing = false
                        }
                    }
                    1 -> {
                        val res = NexaApiClient.groupApi.getUserGroups()
                        val groups = res.body()?.data ?: emptyList()
                        val items = groups.map { ConversationItem.GroupChat(it) }
                        withContext(Dispatchers.Main) {
                            adapter.submitList(items)
                            binding.swipeRefresh.isRefreshing = false
                        }
                    }
                    else -> {
                        val res = NexaApiClient.messageApi.getUserBroadcasts()
                        val broadcasts = res.body()?.data ?: emptyList()
                        val items = broadcasts.map { ConversationItem.BroadcastList(it) }
                        withContext(Dispatchers.Main) {
                            adapter.submitList(items)
                            binding.swipeRefresh.isRefreshing = false
                        }
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
}
