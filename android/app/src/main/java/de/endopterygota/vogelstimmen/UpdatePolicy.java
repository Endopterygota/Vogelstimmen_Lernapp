package de.endopterygota.vogelstimmen;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Only stable versions and HTTPS assets belonging to this app are accepted. */
public final class UpdatePolicy {
    public static final String REPOSITORY = "Endopterygota/Vogelstimmen_Lernapp";
    public static final long MAX_APK_BYTES = 150L * 1024 * 1024;
    private static final Pattern VERSION = Pattern.compile("^v?(\\d+)\\.(\\d+)\\.(\\d+)$");

    private UpdatePolicy() {}

    public static int compareVersions(String a, String b) {
        Matcher left = VERSION.matcher(a);
        Matcher right = VERSION.matcher(b);
        if (!left.matches() || !right.matches()) throw new IllegalArgumentException("Ungültige Versionsnummer.");
        for (int i = 1; i <= 3; i++) {
            int compared = new java.math.BigInteger(left.group(i)).compareTo(new java.math.BigInteger(right.group(i)));
            if (compared != 0) return compared;
        }
        return 0;
    }

    public static boolean isReleaseAsset(String url) {
        try {
            URI uri = new URI(url);
            return "https".equals(uri.getScheme()) && "github.com".equals(uri.getHost())
                && uri.getUserInfo() == null && uri.getPort() == -1
                && uri.getPath().startsWith("/" + REPOSITORY + "/releases/download/")
                && uri.getPath().endsWith(".apk") && !uri.getPath().contains("/../");
        } catch (Exception e) { return false; }
    }

    public static boolean isDownloadHost(String url) {
        try {
            URI uri = new URI(url);
            String host = uri.getHost();
            return "https".equals(uri.getScheme()) && uri.getUserInfo() == null && uri.getPort() == -1
                && ("github.com".equals(host) || "release-assets.githubusercontent.com".equals(host)
                    || "objects.githubusercontent.com".equals(host));
        } catch (Exception e) { return false; }
    }
}
