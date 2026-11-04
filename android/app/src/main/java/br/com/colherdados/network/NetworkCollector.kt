package br.com.colherdados.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

object NetworkCollector {
    fun collect(context: Context): JSONObject {
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = manager.activeNetwork
        val capabilities = network?.let { manager.getNetworkCapabilities(it) }
        val properties = network?.let { manager.getLinkProperties(it) }
        val vpn = capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true
        val type = when {
            network == null || capabilities == null -> "none"
            vpn -> "vpn"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            else -> "other"
        }
        val dns = JSONArray()
        properties?.dnsServers?.forEach { dns.put(it.hostAddress ?: it.toString()) }
        val routes = JSONArray()
        var gateway: String? = null
        properties?.routes?.forEach { route ->
            val gatewayAddress = route.gateway?.hostAddress
            routes.put(JSONObject().put("destination", route.destination.toString())
                .put("gateway", gatewayAddress ?: JSONObject.NULL).put("default", route.isDefaultRoute))
            if (route.isDefaultRoute && gatewayAddress != null && gatewayAddress != "0.0.0.0" && gatewayAddress != "::") gateway = gatewayAddress
        }
        val addresses = JSONArray()
        properties?.linkAddresses?.forEach { link ->
            val address = link.address
            if (!address.isLoopbackAddress && !address.isLinkLocalAddress) addresses.put(address.hostAddress ?: address.toString())
        }
        val privateDnsActive = if (Build.VERSION.SDK_INT >= 28) properties?.isPrivateDnsActive ?: false else false
        val privateDnsName = if (Build.VERSION.SDK_INT >= 28) properties?.privateDnsServerName else null
        return JSONObject()
            .put("androidVersion", Build.VERSION.RELEASE ?: "unknown")
            .put("sdkInt", Build.VERSION.SDK_INT)
            .put("manufacturer", Build.MANUFACTURER.take(100))
            .put("model", Build.MODEL.take(120))
            .put("connectionType", type)
            .put("vpnActive", vpn)
            .put("activeInterface", properties?.interfaceName ?: JSONObject.NULL)
            .put("dnsServers", dns)
            .put("privateDnsActive", privateDnsActive)
            .put("privateDnsServerName", privateDnsName ?: JSONObject.NULL)
            .put("gateway", gateway ?: JSONObject.NULL)
            .put("routes", routes)
            .put("localAddresses", addresses)
            .put("clientCollectedAt", Instant.now().toString())
    }
}
