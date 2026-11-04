package com.madfootball.game;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Landscape, full-screen game: hide the status / navigation bars and keep the screen on.
 * Also exposes window.MFNative to the game for self-updates: the APK is downloaded in the
 * background and handed to the Android package installer (src/engine/update.ts).
 */
public class MainActivity extends BridgeActivity {
    private volatile boolean downloading = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
        WebView wv = getBridge().getWebView();
        wv.addJavascriptInterface(new Updater(), "MFNative");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    private File apkFile() {
        File dir = new File(getCacheDir(), "update");
        dir.mkdirs();
        return new File(dir, "MadFootball.apk");
    }

    private void notifyJs(String state, double value) {
        final String js = "window.__mfUpdate && window.__mfUpdate('" + state + "'," + value + ")";
        runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }

    private class Updater {
        @JavascriptInterface
        public void download(final String url) {
            if (downloading || url == null || !url.startsWith("https://")) return;
            downloading = true;
            new Thread(() -> {
                File out = apkFile();
                File part = new File(out.getPath() + ".part");
                try {
                    String target = url;
                    HttpURLConnection con = null;
                    boolean ok = false;
                    // follow GitHub's redirect to the asset host by hand (https only)
                    for (int i = 0; i < 6; i++) {
                        con = (HttpURLConnection) new URL(target).openConnection();
                        con.setInstanceFollowRedirects(false);
                        con.setConnectTimeout(15000);
                        con.setReadTimeout(30000);
                        int code = con.getResponseCode();
                        if (code >= 300 && code < 400) {
                            String loc = con.getHeaderField("Location");
                            con.disconnect();
                            if (loc == null || !loc.startsWith("https://")) throw new Exception("bad redirect");
                            target = loc;
                            continue;
                        }
                        if (code != 200) throw new Exception("HTTP " + code);
                        ok = true;
                        break;
                    }
                    if (!ok) throw new Exception("too many redirects");
                    long total = con.getContentLengthLong();
                    long done = 0;
                    long lastNotify = 0;
                    try (InputStream in = con.getInputStream(); OutputStream os = new FileOutputStream(part)) {
                        byte[] buf = new byte[64 * 1024];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            os.write(buf, 0, n);
                            done += n;
                            long now = System.currentTimeMillis();
                            if (total > 0 && now - lastNotify > 200) {
                                lastNotify = now;
                                notifyJs("progress", (double) done / total);
                            }
                        }
                    }
                    con.disconnect();
                    if (out.exists()) out.delete();
                    if (!part.renameTo(out)) throw new Exception("rename failed");
                    notifyJs("ready", 1);
                } catch (Exception e) {
                    part.delete();
                    notifyJs("error", 0);
                } finally {
                    downloading = false;
                }
            }).start();
        }

        /** Opens the system installer. Returns false if the user must first allow installs from this app. */
        @JavascriptInterface
        public boolean install() {
            File f = apkFile();
            if (!f.exists()) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()));
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(s);
                return false;
            }
            Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return true;
        }
    }
}
