package com.nexa.social

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
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
import com.nexa.social.databinding.ActivityMainBinding
import com.nexa.social.ui.CreatePostActivity
import com.nexa.social.ui.LoginActivity
import com.nexa.social.utils.NetworkUtils
import com.nexa.social.utils.PreferenceManager

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefManager: PreferenceManager
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingPermissionRequest: PermissionRequest? = null

    private var currentTabId: Int = R.id.navigation_home

    private val createPostLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            // Refresh feed after publishing a post
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
        val allGranted = permissions.values.all { it }
        if (allGranted && pendingPermissionRequest != null) {
            pendingPermissionRequest?.grant(pendingPermissionRequest?.resources)
        } else {
            pendingPermissionRequest?.deny()
            Toast.makeText(this, "Camera & Audio permissions are required for calling features", Toast.LENGTH_SHORT).show()
        }
        pendingPermissionRequest = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefManager = PreferenceManager(this)

        setupBackNavigation()
        setupSwipeRefresh()
        setupWebView()
        setupBottomNavigation()
        setupFab()
        setupRetryButton()

        loadTab(R.id.navigation_home)
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
            if (NetworkUtils.isNetworkAvailable(this)) {
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
        val targetUrl = when (tabId) {
            R.id.navigation_home -> "https://nexa-social-app.surge.sh/"
            R.id.navigation_explore -> "https://nexa-social-app.surge.sh/explore"
            R.id.navigation_reels -> "https://nexa-social-app.surge.sh/reels"
            R.id.navigation_profile -> {
                val username = prefManager.username
                if (!username.isNullOrEmpty()) {
                    "https://nexa-social-app.surge.sh/profile/$username"
                } else {
                    "https://nexa-social-app.surge.sh/login"
                }
            }
            else -> "https://nexa-social-app.surge.sh/"
        }

        loadUrl(targetUrl)
    }

    private fun loadUrl(url: String) {
        if (!NetworkUtils.isNetworkAvailable(this)) {
            showOfflineError()
        } else {
            showWebViewContent()
            binding.progressBarHorizontal.visibility = View.VISIBLE
            binding.webView.loadUrl(url)
        }
    }

    private fun setupWebView() {
        val settings: WebSettings = binding.webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.setSupportZoom(false)
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.21) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }

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
                val requestedResources = request.resources
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
                    request.grant(requestedResources)
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

                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
                }
                fileChooserLauncher.launch(Intent.createChooser(intent, "Select Media Post File"))
                return true
            }
        }

        binding.webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("http://") || url.startsWith("https://")) return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    return true
                } catch (e: Exception) {
                    return false
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                binding.swipeRefreshLayout.isRefreshing = false
                if (NetworkUtils.isNetworkAvailable(this@MainActivity)) {
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
        binding.progressBarHorizontal.visibility = View.GONE
    }

    private fun showWebViewContent() {
        binding.errorView.visibility = View.GONE
        binding.swipeRefreshLayout.visibility = View.VISIBLE
    }
}
