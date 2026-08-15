package com.nexa.social.utils

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

class NetworkMonitor(context: Context) {

    private val connectivityManager =
        context.applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _isOnline = MutableLiveData<Boolean>()
    val isOnline: LiveData<Boolean> get() = _isOnline

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            _isOnline.postValue(true)
        }

        override fun onLost(network: Network) {
            val isStillConnected = checkCurrentConnectivity()
            _isOnline.postValue(isStillConnected)
        }

        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
            val hasInternet = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            _isOnline.postValue(hasInternet)
        }
    }

    init {
        _isOnline.value = checkCurrentConnectivity()
    }

    fun startMonitoring() {
        _isOnline.value = checkCurrentConnectivity()
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        try {
            connectivityManager.registerNetworkCallback(request, networkCallback)
        } catch (e: Exception) {
            // Fallback for missing permissions or framework exceptions
        }
    }

    fun stopMonitoring() {
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (e: Exception) {
            // Already unregistered
        }
    }

    private fun checkCurrentConnectivity(): Boolean {
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
