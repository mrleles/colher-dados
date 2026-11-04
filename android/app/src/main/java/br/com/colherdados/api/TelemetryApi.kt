package br.com.colherdados.api

import br.com.colherdados.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object TelemetryApi {
    fun submit(token: String, metrics: JSONObject) {
        val endpoint = URL(BuildConfig.API_BASE_URL.trimEnd('/') + "/api/telemetry/android/collect")
        val connection = endpoint.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 15_000
        connection.readTimeout = 20_000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Accept", "application/json")
        try {
            val body = JSONObject().put("token", token).put("metrics", metrics).toString()
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(response).optString("error") }.getOrNull()
                throw IllegalStateException(message?.takeIf { it.isNotBlank() } ?: "Falha ao enviar diagnóstico (HTTP $status).")
            }
        } finally {
            connection.disconnect()
        }
    }
}
