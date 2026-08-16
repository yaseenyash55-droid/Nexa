package com.nexa.social.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.nexa.social.NexaApiClient
import com.nexa.social.databinding.ActivityCreateBroadcastBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CreateBroadcastActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCreateBroadcastBinding
    private lateinit var adapter: ContactsSelectionAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCreateBroadcastBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupRecyclerView()
        setupSubmitButton()

        loadContacts()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupRecyclerView() {
        adapter = ContactsSelectionAdapter()
        binding.rvContacts.layoutManager = LinearLayoutManager(this)
        binding.rvContacts.adapter = adapter
    }

    private fun loadContacts() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val res = NexaApiClient.userApi.getSuggestions()
                val users = res.body()?.data ?: emptyList()
                withContext(Dispatchers.Main) {
                    adapter.submitList(users)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@CreateBroadcastActivity, "Failed to load contacts: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun setupSubmitButton() {
        binding.btnSendBroadcast.setOnClickListener {
            val title = binding.etTitle.text.toString().trim()
            val message = binding.etMessage.text.toString().trim()
            val selectedIds = adapter.getSelectedUserIds()

            if (message.isEmpty()) {
                Toast.makeText(this, "Broadcast message content cannot be empty", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (selectedIds.isEmpty()) {
                Toast.makeText(this, "Please select at least one recipient", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            binding.btnSendBroadcast.isEnabled = false
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val body = mutableMapOf<String, Any>(
                        "recipientIds" to selectedIds,
                        "message" to message
                    )
                    if (title.isNotEmpty()) {
                        body["title"] = title
                    }

                    val res = NexaApiClient.messageApi.createBroadcast(body)
                    if (res.isSuccessful && res.body()?.data != null) {
                        withContext(Dispatchers.Main) {
                            Toast.makeText(this@CreateBroadcastActivity, "Broadcast dispatched successfully!", Toast.LENGTH_SHORT).show()
                            setResult(RESULT_OK)
                            finish()
                        }
                    } else {
                        withContext(Dispatchers.Main) {
                            binding.btnSendBroadcast.isEnabled = true
                            Toast.makeText(this@CreateBroadcastActivity, res.body()?.error?.message ?: "Failed to dispatch broadcast", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        binding.btnSendBroadcast.isEnabled = true
                        Toast.makeText(this@CreateBroadcastActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }
}
