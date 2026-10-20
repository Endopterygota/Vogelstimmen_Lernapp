package de.endopterygota.vogelstimmen;

import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private volatile RemoteRelease release;

    private static final class RemoteRelease {
        final String version, url, digest;
        final long size;
        RemoteRelease(String version, String url, String digest, long size) {
            this.version = version; this.url = url; this.digest = digest; this.size = size;
        }
    }

    private File updateFile(String name) throws Exception {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new Exception("Kein Speicherplatz für das Update verfügbar.");
        return new File(dir, name);
    }

    @SuppressWarnings("deprecation")
    private PackageInfo installed() throws Exception {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(),
            Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES);
    }

    @PluginMethod
    public void check(PluginCall call) {
        worker.execute(() -> {
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL("https://api.github.com/repos/"
                    + UpdatePolicy.REPOSITORY + "/releases/latest").openConnection();
                connection.setConnectTimeout(15000); connection.setReadTimeout(20000);
                connection.setRequestProperty("User-Agent", "Vogelstimmen-Android-Updater");
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
                connection.setUseCaches(false);
                JSONObject json;
                try {
                    int status = connection.getResponseCode();
                    if (status == 403 || status == 429) throw new Exception("GitHub ist gerade ausgelastet. Bitte später erneut prüfen.");
                    if (status != 200) throw new Exception(status == 404 ? "Noch kein Release verfügbar." : "GitHub konnte nicht erreicht werden (" + status + ").");
                    try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                        byte[] buffer = new byte[8192]; int count;
                        while ((count = input.read(buffer)) != -1) {
                            if (output.size() + count > 1024 * 1024) throw new Exception("Ungültige Release-Antwort.");
                            output.write(buffer, 0, count);
                        }
                        json = new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
                    }
                } finally { connection.disconnect(); }
                if (json.optBoolean("draft") || json.optBoolean("prerelease")) throw new Exception("Kein stabiles Release verfügbar.");
                String version = json.getString("tag_name");
                PackageInfo current = installed();
                boolean newer = UpdatePolicy.compareVersions(version, current.versionName) > 0;
                RemoteRelease candidate = null;
                JSONArray assets = json.getJSONArray("assets");
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.getJSONObject(i);
                    String url = asset.optString("browser_download_url");
                    long size = asset.optLong("size");
                    if ("uploaded".equals(asset.optString("state")) && asset.optString("name").matches("Vogelstimmen-[0-9]+\\.[0-9]+\\.[0-9]+\\.apk")
                        && UpdatePolicy.isReleaseAsset(url) && size > 0 && size <= UpdatePolicy.MAX_APK_BYTES) {
                        candidate = new RemoteRelease(version, url, asset.optString("digest", ""), size);
                        break;
                    }
                }
                if (newer && candidate == null) throw new Exception("Das neueste Release enthält noch keine passende APK. Bitte später erneut prüfen.");
                release = newer ? candidate : null;
                JSObject result = new JSObject();
                result.put("installedVersion", current.versionName);
                result.put("latestVersion", version.replaceFirst("^v", ""));
                result.put("available", newer);
                result.put("size", candidate == null ? 0 : candidate.size);
                call.resolve(result);
            } catch (Exception e) { call.reject(message(e, "Updates konnten nicht geprüft werden. Bitte die Internetverbindung prüfen.")); }
        });
    }

    @PluginMethod
    public void download(PluginCall call) {
        RemoteRelease candidate = release;
        if (candidate == null) { call.reject("Bitte zuerst nach Updates suchen."); return; }
        if (!downloading.compareAndSet(false, true)) { call.reject("Ein Download läuft bereits."); return; }
        worker.execute(() -> {
            File partial = null;
            try {
                partial = updateFile("download.apk");
                File target = updateFile("latest.apk");
                if (target.exists() && !target.delete()) throw new Exception("Das vorige Update konnte nicht ersetzt werden.");
                HttpURLConnection connection = openDownload(candidate.url);
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long received = 0, lastEvent = 0;
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[65536]; int count;
                    while ((count = input.read(buffer)) != -1) {
                        if (Thread.currentThread().isInterrupted()) throw new Exception("Download abgebrochen.");
                        received += count;
                        if (received > candidate.size || received > UpdatePolicy.MAX_APK_BYTES) throw new Exception("Die Update-Datei hat eine unerwartete Größe.");
                        output.write(buffer, 0, count); digest.update(buffer, 0, count);
                        if (System.currentTimeMillis() - lastEvent > 250) {
                            JSObject event = new JSObject(); event.put("received", received); event.put("total", candidate.size);
                            notifyListeners("downloadProgress", event); lastEvent = System.currentTimeMillis();
                        }
                    }
                } finally { connection.disconnect(); }
                if (received != candidate.size) throw new Exception("Der Download ist unvollständig. Bitte erneut versuchen.");
                if (candidate.digest.startsWith("sha256:") && !candidate.digest.substring(7).equalsIgnoreCase(hex(digest.digest())))
                    throw new Exception("Die Prüfsumme des Downloads stimmt nicht überein.");
                validateApk(partial);
                if (!partial.renameTo(target)) throw new Exception("Das Update konnte nicht gespeichert werden.");
                JSObject result = new JSObject(); result.put("ready", true); call.resolve(result);
            } catch (Exception e) {
                if (partial != null) partial.delete();
                call.reject(message(e, "Download fehlgeschlagen. Bitte die Internetverbindung und den freien Speicher prüfen."));
            } finally { downloading.set(false); }
        });
    }

    private HttpURLConnection openDownload(String initial) throws Exception {
        String url = initial;
        for (int redirects = 0; redirects < 6; redirects++) {
            if (!UpdatePolicy.isDownloadHost(url)) throw new Exception("Nicht unterstützte Download-Adresse.");
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(20000); connection.setReadTimeout(30000); connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", "Vogelstimmen-Android-Updater");
            int status;
            try { status = connection.getResponseCode(); } catch (Exception e) { connection.disconnect(); throw e; }
            if (status == 200) return connection;
            String location = connection.getHeaderField("Location"); connection.disconnect();
            if ((status == 301 || status == 302 || status == 303 || status == 307 || status == 308) && location != null) {
                url = new URL(new URL(url), location).toString();
            } else { throw new Exception("Der APK-Download konnte nicht gestartet werden (" + status + ")."); }
        }
        throw new Exception("Zu viele Download-Weiterleitungen.");
    }

    @SuppressWarnings("deprecation")
    private void validateApk(File file) throws Exception {
        PackageManager manager = getContext().getPackageManager();
        PackageInfo apk = manager.getPackageArchiveInfo(file.getAbsolutePath(),
            Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES);
        PackageInfo current = installed();
        if (apk == null || !current.packageName.equals(apk.packageName)) throw new Exception("Die Datei ist kein Update für Vogelstimmen.");
        long apkCode = Build.VERSION.SDK_INT >= 28 ? apk.getLongVersionCode() : apk.versionCode;
        long currentCode = Build.VERSION.SDK_INT >= 28 ? current.getLongVersionCode() : current.versionCode;
        if (apkCode <= currentCode || UpdatePolicy.compareVersions(apk.versionName, current.versionName) <= 0)
            throw new Exception("Diese APK ist nicht neuer als die installierte App.");
        if (release != null && UpdatePolicy.compareVersions(apk.versionName, release.version) != 0)
            throw new Exception("Die APK-Version passt nicht zum Release.");
        Signature[] a = Build.VERSION.SDK_INT >= 28 ? (apk.signingInfo == null ? null : apk.signingInfo.getApkContentsSigners()) : apk.signatures;
        Signature[] b = Build.VERSION.SDK_INT >= 28 ? (current.signingInfo == null ? null : current.signingInfo.getApkContentsSigners()) : current.signatures;
        if (a == null || b == null || a.length == 0 || a.length != b.length) throw new Exception("Die Signatur des Updates konnte nicht bestätigt werden.");
        String[] left = new String[a.length], right = new String[b.length];
        for (int i = 0; i < a.length; i++) left[i] = hex(MessageDigest.getInstance("SHA-256").digest(a[i].toByteArray()));
        for (int i = 0; i < b.length; i++) right[i] = hex(MessageDigest.getInstance("SHA-256").digest(b[i].toByteArray()));
        Arrays.sort(left); Arrays.sort(right);
        if (!Arrays.equals(left, right)) throw new Exception("Das Update wurde mit einem anderen Schlüssel signiert und kann nicht installiert werden.");
    }

    @PluginMethod
    public void install(PluginCall call) {
        worker.execute(() -> {
            try {
                File file = updateFile("latest.apk");
                if (!file.isFile()) throw new Exception("Bitte das Update erneut herunterladen.");
                validateApk(file);
                getActivity().runOnUiThread(() -> {
                    try {
                        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                            Intent permission = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:" + getContext().getPackageName()));
                            startActivityForResult(call, permission, "installationPermissionResult");
                            return;
                        }
                        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                        Intent installer = new Intent(Intent.ACTION_VIEW);
                        installer.setDataAndType(uri, "application/vnd.android.package-archive");
                        installer.setClipData(ClipData.newRawUri("Vogelstimmen Update", uri));
                        installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        getActivity().startActivity(installer);
                        JSObject result = new JSObject(); result.put("installerOpened", true); call.resolve(result);
                    } catch (Exception e) { call.reject("Die Android-Installation konnte nicht geöffnet werden. Bitte erneut versuchen."); }
                });
            } catch (Exception e) { call.reject(message(e, "Das Update konnte nicht zur Installation geöffnet werden.")); }
        });
    }

    @ActivityCallback
    private void installationPermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            call.reject("Die Installation wurde noch nicht erlaubt. Bitte „Apps aus dieser Quelle zulassen“ aktivieren und erneut installieren.");
        } else { install(call); }
    }

    private static String hex(byte[] value) {
        StringBuilder result = new StringBuilder();
        for (byte b : value) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
        return result.toString();
    }

    private static String message(Exception error, String fallback) {
        // Network errors get a useful German message; validation errors retain their explanation.
        return error instanceof java.io.IOException ? fallback : (error.getMessage() == null ? fallback : error.getMessage());
    }

    @Override
    protected void handleOnDestroy() { worker.shutdownNow(); }
}
