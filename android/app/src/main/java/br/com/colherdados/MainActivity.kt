package br.com.colherdados

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import br.com.colherdados.api.TelemetryApi
import br.com.colherdados.network.NetworkCollector
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var status: TextView
    private lateinit var details: TextView
    private lateinit var collectButton: Button
    private lateinit var sendButton: Button
    private var metrics: JSONObject? = null
    private var token: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        token = intent?.data?.getQueryParameter("token")
        render()
        if (token.isNullOrBlank()) status.text = "Abra este aplicativo pelo link de diagnóstico fornecido na página Colher Dados."
    }

    private fun render() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 36, 28, 28)
            setBackgroundColor(0xFFF6F8FA.toInt())
        }
        root.addView(TextView(this).apply {
            text = "Colher Dados"; textSize = 27f; setTextColor(0xFF17212B.toInt())
        })
        root.addView(TextView(this).apply {
            text = "Identifique as informações de rede disponibilizadas pelo Android. Você poderá revisar os dados antes de enviá-los ao atendente."
            textSize = 15f; setTextColor(0xFF526170.toInt()); setPadding(0, 12, 0, 20)
        })
        status = TextView(this).apply {
            text = "Pronto para iniciar."; textSize = 15f; setTextColor(0xFF245A48.toInt()); setPadding(0, 8, 0, 16)
        }
        details = TextView(this).apply { textSize = 14f; setTextColor(0xFF263442.toInt()); setPadding(0, 12, 0, 20) }
        collectButton = Button(this).apply { text = "Coletar informações"; setOnClickListener { collect() } }
        sendButton = Button(this).apply { text = "Autorizar e enviar ao atendente"; isEnabled = false; setOnClickListener { send() } }
        root.addView(status)
        root.addView(details)
        root.addView(collectButton)
        root.addView(sendButton)
        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun collect() {
        collectButton.isEnabled = false
        sendButton.isEnabled = false
        status.text = "Coletando informações da conexão ativa…"
        executor.execute {
            try {
                val result = NetworkCollector.collect(this)
                runOnUiThread {
                    metrics = result
                    details.text = formatMetrics(result)
                    status.text = "Coleta concluída. Revise as informações antes de enviar."
                    collectButton.isEnabled = true
                    sendButton.isEnabled = !token.isNullOrBlank()
                }
            } catch (error: Exception) {
                runOnUiThread {
                    status.text = "Não foi possível coletar os dados: " + (error.message ?: "erro inesperado")
                    collectButton.isEnabled = true
                }
            }
        }
    }

    private fun send() {
        val currentToken = token
        val currentMetrics = metrics
        if (currentToken.isNullOrBlank() || currentMetrics == null) {
            status.text = "Abra o aplicativo pelo link da sessão e faça a coleta primeiro."
            return
        }
        sendButton.isEnabled = false
        collectButton.isEnabled = false
        status.text = "Enviando com segurança…"
        executor.execute {
            try {
                TelemetryApi.submit(currentToken, currentMetrics)
                runOnUiThread {
                    status.text = "Diagnóstico enviado. Você já pode retornar ao atendente."
                    details.append("\n\nEnvio concluído.")
                    token = null
                }
            } catch (error: Exception) {
                runOnUiThread {
                    status.text = error.message ?: "Não foi possível enviar. Verifique a conexão e tente novamente."
                    sendButton.isEnabled = true
                    collectButton.isEnabled = true
                }
            }
        }
    }

    private fun formatMetrics(data: JSONObject): String {
        fun value(key: String): String = data.optString(key).takeUnless { it == "null" || it.isBlank() } ?: "Não informado"
        fun array(key: String): String {
            val values = data.optJSONArray(key) ?: JSONArray()
            return (0 until values.length()).joinToString(", ") { values.optString(it) }.ifBlank { "Não informado" }
        }
        return buildString {
            appendLine("CONEXÃO")
            appendLine("Tipo: " + value("connectionType"))
            appendLine("Internet: " + if (data.optBoolean("internetValidated")) "Conexão validada" else if (data.optBoolean("internetAvailable")) "Internet não validada" else "Sem capacidade de Internet")
            appendLine("Interface: " + value("activeInterface"))
            appendLine("VPN detectada: " + if (data.isNull("vpnActive")) "Não determinado" else if (data.optBoolean("vpnActive")) "Sim" else "Não")
            appendLine()
            appendLine("DNS DISPONIBILIZADO AO DISPOSITIVO")
            appendLine(array("dnsServers"))
            appendLine("Origem: configuração de rede informada pelo Android; não confirma a origem DHCP nem o DNS upstream do roteador.")
            appendLine()
            appendLine("DNS PRIVADO DO ANDROID")
            appendLine("Ativo: " + if (data.isNull("privateDnsActive")) "Não determinado" else if (data.optBoolean("privateDnsActive")) "Sim" else "Não")
            appendLine("Hostname: " + value("privateDnsServerName"))
            appendLine()
            appendLine("REDE")
            appendLine("Gateway padrão: " + value("gateway"))
            appendLine("Endereços locais: " + array("localAddresses"))
            appendLine("Android: " + value("androidVersion") + " (API " + data.optInt("sdkInt") + ")")
            appendLine("Dispositivo: " + value("manufacturer") + " " + value("model"))
            appendLine()
            append("DNS upstream do roteador não é inferido por este diagnóstico.")
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        token = intent.data?.getQueryParameter("token")
        status.text = if (token.isNullOrBlank()) "Link de diagnóstico inválido." else "Sessão de diagnóstico recebida."
    }

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
    }
}
