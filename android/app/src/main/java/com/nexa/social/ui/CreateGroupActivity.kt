package com.nexa.social.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.nexa.social.NexaApiClient
import com.nexa.social.databinding.ActivityCreateGroupBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CreateGroupActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCreateGroupBinding
    private lateinit var adapter: ContactsSelectionAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCreateGroupBinding.inflate(layoutInflater)
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
                val res = NexaApiClient.authApi.getSuggestions()
                val users = res.body()?.data ?: emptyList()
                withContext(Dispatchers.Main) {
                    adapter.submitList(users)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@CreateGroupActivity, "Failed to load contacts: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun setupSubmitButton() {
        binding.btnCreateGroup.setOnClickListener {
            val name = binding.etGroupName.text.toString().trim()
            val desc = binding.etGroupDesc.text.toString().trim()
            val selectedIds = adapter.getSelectedUserIds()

            if (name.isEmpty()) {
                Toast.makeText(this, "Please enter a group name", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (selectedIds.isEmpty()) {
                Toast.makeText(this, "Please select at least one member", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            binding.btnCreateGroup.isEnabled = false
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val body = mapOf(
                        "name" to name,
                        "description" to desc,
                        "memberIds" to selectedIds
                    )
                    val res = NexaApiClient.groupApi.createGroup(body)
                    if (res.isSuccessful && res.body()?.data != null) {
                        withContext(Dispatchers.Main) {
                            Toast.makeText(this@CreateGroupActivity, "Group created successfully!", Toast.LENGTH_SHORT).show()
                            setResult(RESULT_OK)
                            finish()
                        }
                    } else {
                        withContext(Dispatchers.Main) {
                            binding.btnCreateGroup.isEnabled = true
                            Toast.makeText(this@CreateGroupActivity, res.body()?.error?.message ?: "Failed to create group", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        binding.btnCreateGroup.isEnabled = true
                        Toast.makeText(this@CreateGroupActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }
}
