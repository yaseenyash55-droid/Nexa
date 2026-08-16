package com.nexa.social

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.firebase.messaging.FirebaseMessaging
import com.nexa.social.data.models.FcmTokenRequest
import com.nexa.social.databinding.ActivityMainBinding
import com.nexa.social.ui.CreatePostActivity
import com.nexa.social.ui.LoginActivity
import com.nexa.social.utils.NetworkMonitor
import com.nexa.social.utils.NexaWebAppInterface
import com.nexa.social.utils.NotificationHelper
import com.nexa.social.utils.PreferenceManager
import com.nexa.social.utils.SocketManager
import com.nexa.social.utils.ThemeManager
import com.nexa.social.utils.TokenManager
import com.nexa.social.utils.UrlValidator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefManager: PreferenceManager
    private lateinit var networkMonitor: NetworkMonitor

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermissionRequest: PermissionRequest? = null
    private var currentTabId: Int = R.id.navigation_home
    private var wasOffline: Boolean = false

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
            binding.bottomNavigation.selectedItemId = R.id.navigation_home
            binding.webView.reload()
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (filePathCallback != null) {
            val results: Array<Uri>? = if (result.resultCode == RESULT_OK && result.data != null) {
                val dataString = result.data?.dataString
                if (dataString != null) arrayOf(Uri.parse(dataString)) else null
            } else null

            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val req = pendingPermissionRequest
        if (req != null) {
            val granted = mutableListOf<String>()
            val resources = req.resources ?: emptyArray()

            if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
                permissions[Manifest.permission.CAMERA] == true
            ) {
                granted.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
            }
            if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
                permissions[Manifest.permission.RECORD_AUDIO] == true
            ) {
                granted.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
            }

            if (granted.isNotEmpty()) {
                req.grant(granted.toTypedArray())
            } else {
                req.deny()
                Toast.makeText(this, "Camera & Audio permissions are required for calling features", Toast.LENGTH_SHORT).show()
            }
        }
        pendingPermissionRequest = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefManager = PreferenceManager(this)
        networkMonitor = NetworkMonitor(this)

        NotificationHelper.createNotificationChannel(this)
        requestNotificationPermission()

        setupBackNavigation()
        setupSwipeRefresh()
        setupWebView()
        setupBottomNavigation()
        setupFab()
        setupRetryButton()
        setupNetworkMonitoring()

        try {
            val tokenManager = TokenManager(this)
            tokenManager.accessToken?.let { token ->
                SocketManager.connect(token)
            }
        } catch (_: Exception) {}

        handleNotificationIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        networkMonitor.startMonitoring()
    }

    override fun onStop() {
        super.onStop()
        networkMonitor.stopMonitoring()
        clearPendingPermissionRequest()
    }

    override fun onDestroy() {
        super.onDestroy()
        clearPendingPermissionRequest()
        binding.webView.removeJavascriptInterface("NexaAndroid")
        binding.webView.destroy()
    }

    private fun clearPendingPermissionRequest() {
        pendingPermissionRequest?.deny()
        pendingPermissionRequest = null
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleNotificationIntent(intent)
    }

    private fun setupNetworkMonitoring() {
        networkMonitor.isOnline.observe(this) { isOnline ->
            if (isOnline) {
                binding.offlineBanner.visibility = View.GONE
                if (wasOffline || binding.errorView.visibility == View.VISIBLE) {
                    wasOffline = false
                    showWebViewContent()
                    loadTab(currentTabId)
                }
            } else {
                wasOffline = true
                if (binding.webView.url.isNullOrEmpty() || binding.errorView.visibility == View.VISIBLE) {
                    showOfflineError()
                } else {
                    binding.offlineBanner.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun handleNotificationIntent(intent: Intent?) {
        val targetUrl = intent?.getStringExtra(NotificationHelper.EXTRA_TARGET_URL)
        if (!targetUrl.isNullOrEmpty()) {
            val sanitized = UrlValidator.sanitizeTargetUrl(targetUrl)
            loadUrl(sanitized)
        } else {
            loadTab(R.id.navigation_home)
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
                        // Background notification sync retry handled by WorkManager
                    }
                }
            }
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else if (currentTabId != R.id.navigation_home) {
                    binding.bottomNavigation.selectedItemId = R.id.navigation_home
                } else {
                    finish()
                }
            }
        })
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefreshLayout.setColorSchemeResources(
            R.color.brand_primary,
            R.color.brand_cyan,
            R.color.brand_emerald
        )
        binding.swipeRefreshLayout.setOnRefreshListener {
            val isConnected = networkMonitor.isOnline.value ?: false
            if (isConnected) {
                binding.webView.reload()
            } else {
                binding.swipeRefreshLayout.isRefreshing = false
                showOfflineError()
            }
        }
    }

    private fun setupBottomNavigation() {
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            if (item.itemId == currentTabId) {
                return@setOnItemSelectedListener true
            }
            loadTab(item.itemId)
            true
        }

        binding.bottomNavigation.findViewById<View>(R.id.navigation_profile)?.setOnLongClickListener {
            ThemeManager.showThemeSelectionDialog(this)
            true
        }
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

    private fun loadTab(tabId: Int) {
        currentTabId = tabId
        val baseUrl = UrlValidator.APPROVED_ORIGIN.trimEnd('/')
        val targetUrl = when (tabId) {
            R.id.navigation_home -> "$baseUrl/"
            R.id.navigation_explore -> "$baseUrl/explore"
            R.id.navigation_messages -> "$baseUrl/messages"
            R.id.navigation_reels -> "$baseUrl/reels"
            R.id.navigation_profile -> {
                val username = prefManager.username
                if (!username.isNullOrEmpty()) {
                    "$baseUrl/profile/$username"
                } else {
                    "$baseUrl/login"
                }
            }
            else -> "$baseUrl/"
        }

        loadUrl(targetUrl)
    }

    private fun loadUrl(url: String) {
        val validatedUrl = UrlValidator.sanitizeTargetUrl(url)
        val isConnected = networkMonitor.isOnline.value ?: false
        if (!isConnected) {
            showOfflineError()
        } else {
            showWebViewContent()
            binding.progressBarHorizontal.visibility = View.VISIBLE
            binding.webView.loadUrl(validatedUrl)
        }
    }

    private fun setupWebView() {
        val settings: WebSettings = binding.webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = false
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mediaPlaybackRequiresUserGesture = false
        settings.setSupportZoom(false)
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        CookieManager.getInstance().setAcceptThirdPartyCookies(binding.webView, false)

        // Native Javascript Interface Bridge
        binding.webView.addJavascriptInterface(NexaWebAppInterface(this), "NexaAndroid")

        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    binding.progressBarHorizontal.visibility = View.VISIBLE
                    binding.progressBarHorizontal.progress = newProgress
                } else {
                    binding.progressBarHorizontal.visibility = View.GONE
                    binding.swipeRefreshLayout.isRefreshing = false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return

                // Origin verification
                val origin = request.origin?.toString()
                if (!UrlValidator.isApprovedOrigin(origin)) {
                    request.deny()
                    return
                }

                val requestedResources = request.resources ?: emptyArray()
                val neededPermissions = mutableListOf<String>()

                for (res in requestedResources) {
                    if (res == PermissionRequest.RESOURCE_VIDEO_CAPTURE) {
                        neededPermissions.add(Manifest.permission.CAMERA)
                    } else if (res == PermissionRequest.RESOURCE_AUDIO_CAPTURE) {
                        neededPermissions.add(Manifest.permission.RECORD_AUDIO)
                    }
                }

                val ungranted = neededPermissions.filter {
                    ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED
                }

                if (ungranted.isEmpty()) {
                    val recognized = requestedResources.filter {
                        it == PermissionRequest.RESOURCE_VIDEO_CAPTURE || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                    }.toTypedArray()
                    request.grant(recognized)
                } else {
                    pendingPermissionRequest = request
                    permissionLauncher.launch(ungranted.toTypedArray())
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
                }
                fileChooserLauncher.launch(Intent.createChooser(intent, "Select Media"))
                return true
            }
        }

        binding.webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                val uri = request.url

                // Check if target is canonical approved HTTPS origin
                if (UrlValidator.isApprovedOrigin(url)) {
                    return false
                }

                // If external web link, launch in external browser
                val scheme = uri.scheme
                if (scheme.equals("http", ignoreCase = true) || scheme.equals("https", ignoreCase = true)) {
                    try {
                        val browserIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                            addCategory(Intent.CATEGORY_BROWSABLE)
                        }
                        startActivity(browserIntent)
                    } catch (_: Exception) {}
                    return true
                }

                // Block any other custom/dangerous schemes (javascript:, file:, content:, data:, intent:)
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                binding.swipeRefreshLayout.isRefreshing = false
                val isConnected = networkMonitor.isOnline.value ?: false
                if (isConnected) {
                    showWebViewContent()
                }
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    showOfflineError()
                }
            }
        }
    }

    private fun setupRetryButton() {
        binding.btnRetry.setOnClickListener {
            loadTab(currentTabId)
        }
    }

    private fun showOfflineError() {
        binding.errorView.visibility = View.VISIBLE
        binding.swipeRefreshLayout.visibility = View.GONE
        binding.offlineBanner.visibility = View.GONE
        binding.progressBarHorizontal.visibility = View.GONE
    }

    private fun showWebViewContent() {
        binding.errorView.visibility = View.GONE
        binding.swipeRefreshLayout.visibility = View.VISIBLE
    }
}
