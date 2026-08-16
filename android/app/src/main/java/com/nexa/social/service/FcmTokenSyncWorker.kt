package com.nexa.social.service

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.FcmTokenRequest
import com.nexa.social.utils.TokenManager

class FcmTokenSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val fcmToken = inputData.getString(KEY_FCM_TOKEN) ?: return Result.failure()

        return try {
            val tokenManager = TokenManager(applicationContext)
            if (!tokenManager.isLoggedIn) {
                return Result.success()
            }

            NexaApiClient.init(applicationContext)
            val response = NexaApiClient.authApi.registerFcmToken(
                FcmTokenRequest(fcmToken = fcmToken, platform = "android")
            )

            if (response.isSuccessful) {
                Result.success()
            } else if (response.code() in 400..499) {
                Result.failure()
            } else {
                Result.retry()
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val KEY_FCM_TOKEN = "key_fcm_token"
        private const val WORK_NAME = "fcm_token_sync_work"

        fun enqueue(context: Context, token: String) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val workRequest = OneTimeWorkRequestBuilder<FcmTokenSyncWorker>()
                .setConstraints(constraints)
                .setInputData(workDataOf(KEY_FCM_TOKEN to token))
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                workRequest
            )
        }
    }
}
