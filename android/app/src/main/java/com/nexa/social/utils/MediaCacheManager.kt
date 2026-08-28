package com.nexa.social.utils

import android.content.Context
import android.os.Handler
import android.os.Looper
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest

object MediaCacheManager {

    private const val CACHE_DIR_NAME = "media_cache"
    private const val MAX_CACHE_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB
    private val client = OkHttpClient()
    private val mainHandler = Handler(Looper.getMainLooper())

    private fun getCacheDir(context: Context): File {
        val dir = File(context.cacheDir, CACHE_DIR_NAME)
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    private fun String.md5(): String {
        return try {
            val md = MessageDigest.getInstance("MD5")
            val bytes = md.digest(this.toByteArray())
            bytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            this.hashCode().toString()
        }
    }

    /**
     * Tries to get the cached file or downloads it asynchronously.
     * Invokes the callback on the Main Thread.
     */
    fun getCachedFileOrDownload(
        context: Context,
        url: String,
        onComplete: (File?) -> Unit
    ) {
        val appCtx = context.applicationContext
        val cacheDir = getCacheDir(appCtx)
        val fileName = url.md5()
        val targetFile = File(cacheDir, fileName)

        // If exists, touch file to update lastModified (LRU) and return it
        if (targetFile.exists() && targetFile.length() > 0) {
            targetFile.setLastModified(System.currentTimeMillis())
            onComplete(targetFile)
            return;
        }

        // Fetch/Download asynchronously
        val request = Request.Builder().url(url).build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                mainHandler.post {
                    onComplete(null)
                }
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    mainHandler.post { onComplete(null) }
                    return
                }
                val body = response.body
                if (body == null) {
                    mainHandler.post { onComplete(null) }
                    return
                }

                var fos: FileOutputStream? = null
                try {
                    val tempFile = File.createTempFile("download_", "_tmp", cacheDir)
                    fos = FileOutputStream(tempFile)
                    body.byteStream().use { input ->
                        input.copyTo(fos!!)
                    }
                    fos!!.close()
                    fos = null

                    if (tempFile.renameTo(targetFile)) {
                        targetFile.setLastModified(System.currentTimeMillis())
                        evictOldestFiles(cacheDir)
                        mainHandler.post { onComplete(targetFile) }
                    } else {
                        mainHandler.post { onComplete(null) }
                    }
                } catch (e: Exception) {
                    mainHandler.post { onComplete(null) }
                } finally {
                    try {
                        fos?.close()
                    } catch (_: Exception) {}
                }
            }
        })
    }

    /**
     * Clears all files in the media cache directory.
     */
    fun clearCache(context: Context): Boolean {
        return try {
            val cacheDir = getCacheDir(context)
            val files = cacheDir.listFiles() ?: return true
            var success = true
            for (file in files) {
                if (file.exists() && !file.delete()) {
                    success = false
                }
            }
            success
        } catch (e: Exception) {
            false
        }
    }

    /**
     * LRU Eviction: Removes oldest accessed files to keep cache within maximum size limit.
     */
    @Synchronized
    private fun evictOldestFiles(cacheDir: File) {
        try {
            val files = cacheDir.listFiles() ?: return
            var currentSize = files.sumOf { it.length() }

            if (currentSize <= MAX_CACHE_SIZE_BYTES) return

            // Sort files by last modified time ascending (oldest first)
            val sortedFiles = files.sortedBy { it.lastModified() }
            for (file in sortedFiles) {
                if (currentSize <= MAX_CACHE_SIZE_BYTES) break
                val fileSize = file.length()
                if (file.exists() && file.delete()) {
                    currentSize -= fileSize
                }
            }
        } catch (_: Exception) {}
    }
}
