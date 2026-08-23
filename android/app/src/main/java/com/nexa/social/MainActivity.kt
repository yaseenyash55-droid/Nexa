package com.nexa.social

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.google.firebase.messaging.FirebaseMessaging
import com.nexa.social.data.models.FcmTokenRequest
import com.nexa.social.data.models.NotificationDestination
import com.nexa.social.databinding.ActivityMainBinding
import com.nexa.social.ui.CreatePostActivity
import com.nexa.social.ui.LoginActivity
import com.nexa.social.utils.NetworkMonitor
import com.nexa.social.utils.NotificationHelper
import com.nexa.social.utils.PreferenceManager
import com.nexa.social.utils.SocketManager
import com.nexa.social.utils.TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

import androidx.activity.viewModels
import com.nexa.social.ui.viewmodels.HomeViewModel

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefManager: PreferenceManager
    private lateinit var networkMonitor: NetworkMonitor
    private val homeViewModel: HomeViewModel by viewModels()

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            fetchAndRegisterFcmToken()
        }
    }

    private val createPostLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            homeViewModel.loadFeed(isRefresh = true)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefManager = PreferenceManager(this)
        networkMonitor = NetworkMonitor(this)

        NotificationHelper.createNotificationChannel(this)
        requestNotificationPermission()

        setupNavigation()
        setupFab()
        setupNetworkMonitoring()

        try {
            val tokenManager = TokenManager(this)
            tokenManager.accessToken?.let { token ->
                SocketManager.connect(token)
            }
        } catch (_: Exception) {}

        handleNotificationIntent(intent)
    }

    private fun setupNavigation() {
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        val navController = navHostFragment.navController
        binding.bottomNavigation.setupWithNavController(navController)
    }

    private fun setupFab() {
        binding.fabCreatePost.setOnClickListener {
            if (!prefManager.isLoggedIn) {
                Toast.makeText(this, "Please log in to publish a post", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, LoginActivity::class.java))
            } else {
                createPostLauncher.launch(Intent(this, CreatePostActivity::class.java))
            }
        }
    }

    private fun setupNetworkMonitoring() {
        networkMonitor.isOnline.observe(this) { isOnline ->
            if (!isOnline) {
                Toast.makeText(this, "You are currently offline", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun handleNotificationIntent(intent: Intent?) {
        val destinationStr = intent?.getStringExtra(NotificationHelper.EXTRA_DESTINATION)
        val resourceId = intent?.getStringExtra(NotificationHelper.EXTRA_RESOURCE_ID)
        val secondaryId = intent?.getStringExtra(NotificationHelper.EXTRA_SECONDARY_ID)

        if (destinationStr != null) {
            val destination = NotificationDestination.fromString(destinationStr)
            val navHostFragment = supportFragmentManager
                .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
            val navController = navHostFragment.navController

            when (destination) {
                NotificationDestination.HOME -> navController.navigate(R.id.navigation_home)
                NotificationDestination.EXPLORE -> navController.navigate(R.id.navigation_explore)
                NotificationDestination.MESSAGES -> navController.navigate(R.id.navigation_messages)
                NotificationDestination.CHAT -> {
                    val id = resourceId?.toIntOrNull()
                    if (id != null && id > 0) {
                        val chatIntent = Intent(this, com.nexa.social.ui.ChatActivity::class.java).apply {
                            putExtra(com.nexa.social.ui.ChatActivity.EXTRA_CHAT_TYPE, "direct")
                            putExtra(com.nexa.social.ui.ChatActivity.EXTRA_TARGET_ID, id)
                            putExtra(com.nexa.social.ui.ChatActivity.EXTRA_TARGET_NAME, secondaryId ?: "Direct Message")
                        }
                        startActivity(chatIntent)
                    } else {
                        navController.navigate(R.id.navigation_messages)
                    }
                }
                NotificationDestination.POST -> {
                    val id = resourceId?.toIntOrNull()
                    if (id != null && id > 0) {
                        val bundle = Bundle().apply { putString("postId", id.toString()) }
                        navController.navigate(R.id.navigation_home, bundle)
                    } else {
                        navController.navigate(R.id.navigation_home)
                    }
                }
                NotificationDestination.REEL -> {
                    val id = resourceId?.toIntOrNull()
                    if (id != null && id > 0) {
                        val bundle = Bundle().apply { putString("reelId", id.toString()) }
                        navController.navigate(R.id.navigation_reels, bundle)
                    } else {
                        navController.navigate(R.id.navigation_reels)
                    }
                }
                NotificationDestination.PROFILE -> {
                    if (!resourceId.isNullOrBlank()) {
                        val bundle = Bundle().apply { putString("username", resourceId) }
                        navController.navigate(R.id.navigation_profile, bundle)
                    } else {
                        navController.navigate(R.id.navigation_home)
                    }
                }
            }
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                fetchAndRegisterFcmToken()
            }
        } else {
            fetchAndRegisterFcmToken()
        }
    }

    private fun fetchAndRegisterFcmToken() {
        if (!prefManager.isLoggedIn) return

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful && task.result != null) {
                val fcmToken = task.result
                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        NexaApiClient.authApi.registerFcmToken(
                            FcmTokenRequest(fcmToken = fcmToken, platform = "android")
                        )
                    } catch (_: Exception) {
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleNotificationIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        networkMonitor.startMonitoring()
        SocketManager.registerIncomingCallListener { call ->
            startActivity(
                com.nexa.social.ui.CallActivity.incomingIntent(
                    this,
                    call.callId,
                    call.callerId,
                    call.callerUsername,
                    call.callType
                )
            )
        }
    }

    override fun onStop() {
        SocketManager.unregisterIncomingCallListener()
        super.onStop()
        networkMonitor.stopMonitoring()
    }
}
